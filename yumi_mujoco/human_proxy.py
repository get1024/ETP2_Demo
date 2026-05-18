from __future__ import annotations

import math

import mujoco
import numpy as np

from .pick_place_scene import TABLE_TOP_Z, WORK_X, set_freejoint_pose


HUMAN_JOINT = "human_proxy_freejoint"
HUMAN_CYCLE = 6.8 / 1.05
PREDICTION_MARKERS = [f"prediction_marker_{index}" for index in range(7)]
HUMAN_Y = 0.0
HUMAN_Z = TABLE_TOP_Z + 0.15


def add_human_proxy(spec: mujoco.MjSpec) -> None:
    body = spec.worldbody.add_body(name="human_proxy_body", pos=[0.88, HUMAN_Y, HUMAN_Z])
    body.add_freejoint(name=HUMAN_JOINT)
    body.add_geom(
        name="human_forearm",
        type=mujoco.mjtGeom.mjGEOM_BOX,
        pos=[0.18, 0.0, 0.0],
        size=[0.18, 0.035, 0.035],
        rgba=[0.18, 0.43, 0.92, 0.38],
    )
    body.add_geom(
        name="human_hand",
        type=mujoco.mjtGeom.mjGEOM_BOX,
        pos=[-0.03, 0.0, -0.004],
        size=[0.055, 0.050, 0.026],
        rgba=[0.08, 0.24, 0.78, 0.50],
    )

    for index, x in enumerate(np.linspace(0.78, WORK_X + 0.03, len(PREDICTION_MARKERS))):
        spec.worldbody.add_geom(
            name=PREDICTION_MARKERS[index],
            type=mujoco.mjtGeom.mjGEOM_BOX,
            pos=[float(x), HUMAN_Y, TABLE_TOP_Z + 0.12],
            size=[0.018, 0.018, 0.006],
            rgba=[0.1, 0.65, 1.0, 0.0],
        )


class HumanProxy:
    def __init__(self) -> None:
        self.visible = True
        self.prediction_visible = False
        self.risk = False
        self.risk_level = 0.0

    def update(self, model: mujoco.MjModel, data: mujoco.MjData, elapsed: float, show_prediction: bool) -> bool:
        cycle_t = elapsed % HUMAN_CYCLE
        x = self._path_x(cycle_t)
        z = HUMAN_Z + 0.010 * math.sin(cycle_t * 2.1)
        set_freejoint_pose(model, data, HUMAN_JOINT, np.array([x, HUMAN_Y, z]), np.array([1.0, 0.0, 0.0, 0.0]))
        self.risk_level = self._risk_level(x)
        self.risk = self.risk_level > 0.08
        self.prediction_visible = show_prediction and cycle_t < 4.7
        self._update_prediction_positions(model, x)
        self._set_prediction_alpha(model, 0.45 if self.prediction_visible else 0.0)
        return self.risk

    def _path_x(self, cycle_t: float) -> float:
        if cycle_t < 1.15:
            return 0.88
        if cycle_t < 2.55:
            return _smooth_lerp(0.88, WORK_X + 0.03, (cycle_t - 1.15) / 1.4)
        if cycle_t < 3.45:
            return WORK_X + 0.03
        if cycle_t < 4.75:
            return _smooth_lerp(WORK_X + 0.03, 0.88, (cycle_t - 3.45) / 1.3)
        return 0.88

    def _risk_level(self, x: float) -> float:
        distance = abs(x - (WORK_X + 0.03))
        return max(0.0, min(1.0, 1.0 - distance / 0.28))

    def _update_prediction_positions(self, model: mujoco.MjModel, current_x: float) -> None:
        for index, x in enumerate(np.linspace(current_x, WORK_X + 0.03, len(PREDICTION_MARKERS))):
            geom_id = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_GEOM, PREDICTION_MARKERS[index])
            if geom_id >= 0:
                model.geom_pos[geom_id] = [float(x), HUMAN_Y, TABLE_TOP_Z + 0.12]

    def _set_prediction_alpha(self, model: mujoco.MjModel, alpha: float) -> None:
        for index, name in enumerate(PREDICTION_MARKERS):
            geom_id = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_GEOM, name)
            if geom_id >= 0:
                model.geom_rgba[geom_id, 3] = alpha * (1.0 - index * 0.07)


def _smooth_lerp(start: float, end: float, t: float) -> float:
    t = max(0.0, min(1.0, t))
    t = t * t * (3.0 - 2.0 * t)
    return start + (end - start) * t
