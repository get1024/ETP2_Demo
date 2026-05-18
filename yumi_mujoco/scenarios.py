from __future__ import annotations

import mujoco

from .human_proxy import HumanProxy
from .pick_place_controller import CYCLE_DURATION, PickPlaceController


class BaseScenario:
    def __init__(self, model: mujoco.MjModel, amplitude_scale: float) -> None:
        self.controller = PickPlaceController(model, amplitude_scale=amplitude_scale)
        self.human = HumanProxy()

    def update(self, model: mujoco.MjModel, data: mujoco.MjData, elapsed: float, dt: float) -> None:
        raise NotImplementedError


class TraditionalScenario(BaseScenario):
    def update(self, model: mujoco.MjModel, data: mujoco.MjData, elapsed: float, dt: float) -> None:
        risk = self.human.update(model, data, elapsed, show_prediction=False)
        paused = risk and 0.80 < (self.controller.task_time % CYCLE_DURATION) < 4.70
        self.controller.update(
            model,
            data,
            dt,
            speed_scale=1.0,
            avoid_height=0.0,
            paused=paused,
        )


class FlexibleScenario(BaseScenario):
    def __init__(self, model: mujoco.MjModel, amplitude_scale: float) -> None:
        super().__init__(model, amplitude_scale)
        self.avoid_level = 0.0

    def update(self, model: mujoco.MjModel, data: mujoco.MjData, elapsed: float, dt: float) -> None:
        self.human.update(model, data, elapsed, show_prediction=True)
        target_avoid = self.human.risk_level
        blend = min(1.0, max(0.0, dt * 2.8))
        self.avoid_level += (target_avoid - self.avoid_level) * blend
        speed_scale = 1.0 - 0.35 * self.avoid_level
        avoid_height = 0.16 * self.avoid_level
        self.controller.update(
            model,
            data,
            dt,
            speed_scale=speed_scale,
            avoid_height=avoid_height,
            paused=False,
        )


def make_scenario(name: str, model: mujoco.MjModel, amplitude_scale: float) -> BaseScenario:
    if name == "traditional":
        return TraditionalScenario(model, amplitude_scale)
    if name == "flexible":
        return FlexibleScenario(model, amplitude_scale)
    raise ValueError(f"Unsupported scenario: {name}")
