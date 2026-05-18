from __future__ import annotations

import mujoco
import numpy as np


TABLE_TOP_Z = 0.34
WORK_X = 0.38
LEFT_BOX_Y = -0.24
RIGHT_BOX_Y = 0.24
BOX_FLOOR_Z = TABLE_TOP_Z + 0.008
BOX_WALL_Z = TABLE_TOP_Z + 0.045
BOX_HALF = np.array([0.145, 0.105, 0.012])
BOX_WALL_THICKNESS = 0.010
ITEM_SIZE = np.array([0.042, 0.042, 0.030])
ITEM_HALF = ITEM_SIZE / 2.0
ITEM_Z = TABLE_TOP_Z + 0.030 + float(ITEM_HALF[2])
GRIPPER_Z_OFFSET = 0.030
LOW_PATH_Z = ITEM_Z + 0.065
ARC_HEIGHT = 0.085
TRAJECTORY_MARKERS = [f"gripper_path_marker_{index}" for index in range(19)]
ITEM_JOINT = "transfer_item_freejoint"


def add_pick_place_cell(spec: mujoco.MjSpec) -> None:
    add_work_surface(spec)
    add_bins(spec)
    add_transfer_item(spec)
    add_path_markers(spec)
    add_risk_zone_marker(spec)


def add_work_surface(spec: mujoco.MjSpec) -> None:
    spec.worldbody.add_geom(
        name="pick_place_table",
        type=mujoco.mjtGeom.mjGEOM_BOX,
        pos=[WORK_X, 0.0, TABLE_TOP_Z - 0.025],
        size=[0.32, 0.48, 0.025],
        rgba=[0.30, 0.33, 0.34, 1.0],
    )


def add_bins(spec: mujoco.MjSpec) -> None:
    _add_open_bin(
        spec,
        prefix="left_source_bin",
        center=[WORK_X, LEFT_BOX_Y, BOX_FLOOR_Z],
        floor_rgba=[0.12, 0.32, 0.74, 1.0],
        wall_rgba=[0.08, 0.18, 0.42, 1.0],
    )
    _add_open_bin(
        spec,
        prefix="right_target_bin",
        center=[WORK_X, RIGHT_BOX_Y, BOX_FLOOR_Z],
        floor_rgba=[0.12, 0.58, 0.30, 1.0],
        wall_rgba=[0.07, 0.34, 0.18, 1.0],
    )


def _add_open_bin(
    spec: mujoco.MjSpec,
    *,
    prefix: str,
    center: list[float],
    floor_rgba: list[float],
    wall_rgba: list[float],
) -> None:
    x, y, z = center
    spec.worldbody.add_geom(
        name=f"{prefix}_floor",
        type=mujoco.mjtGeom.mjGEOM_BOX,
        pos=[x, y, z],
        size=BOX_HALF.tolist(),
        rgba=floor_rgba,
    )
    wall_z = BOX_WALL_Z
    spec.worldbody.add_geom(
        name=f"{prefix}_front_wall",
        type=mujoco.mjtGeom.mjGEOM_BOX,
        pos=[x + BOX_HALF[0], y, wall_z],
        size=[BOX_WALL_THICKNESS, float(BOX_HALF[1]), 0.045],
        rgba=wall_rgba,
    )
    spec.worldbody.add_geom(
        name=f"{prefix}_back_wall",
        type=mujoco.mjtGeom.mjGEOM_BOX,
        pos=[x - BOX_HALF[0], y, wall_z],
        size=[BOX_WALL_THICKNESS, float(BOX_HALF[1]), 0.045],
        rgba=wall_rgba,
    )
    spec.worldbody.add_geom(
        name=f"{prefix}_outer_wall",
        type=mujoco.mjtGeom.mjGEOM_BOX,
        pos=[x, y + BOX_HALF[1], wall_z],
        size=[float(BOX_HALF[0]), BOX_WALL_THICKNESS, 0.045],
        rgba=wall_rgba,
    )
    spec.worldbody.add_geom(
        name=f"{prefix}_inner_wall",
        type=mujoco.mjtGeom.mjGEOM_BOX,
        pos=[x, y - BOX_HALF[1], wall_z],
        size=[float(BOX_HALF[0]), BOX_WALL_THICKNESS, 0.045],
        rgba=wall_rgba,
    )


def add_transfer_item(spec: mujoco.MjSpec) -> None:
    body = spec.worldbody.add_body(name="transfer_item_body", pos=left_item_position().tolist())
    body.add_freejoint(name=ITEM_JOINT)
    body.add_geom(
        name="transfer_item_core",
        type=mujoco.mjtGeom.mjGEOM_BOX,
        size=ITEM_HALF.tolist(),
        mass=0.06,
        rgba=[0.88, 0.08, 0.05, 1.0],
    )
    body.add_geom(
        name="transfer_item_top",
        type=mujoco.mjtGeom.mjGEOM_BOX,
        pos=[0.0, 0.0, float(ITEM_HALF[2] + 0.0015)],
        size=[float(ITEM_HALF[0]), float(ITEM_HALF[1]), 0.0015],
        rgba=[1.0, 0.22, 0.14, 1.0],
    )


def add_path_markers(spec: mujoco.MjSpec) -> None:
    for index, pos in enumerate(sample_gripper_path(0.0)):
        spec.worldbody.add_geom(
            name=TRAJECTORY_MARKERS[index],
            type=mujoco.mjtGeom.mjGEOM_BOX,
            pos=pos.tolist(),
            size=[0.010, 0.010, 0.010],
            rgba=[1.0, 0.03, 0.02, 0.58],
        )


def add_risk_zone_marker(spec: mujoco.MjSpec) -> None:
    spec.worldbody.add_geom(
        name="front_interference_zone",
        type=mujoco.mjtGeom.mjGEOM_BOX,
        pos=[WORK_X + 0.065, 0.0, TABLE_TOP_Z + 0.004],
        size=[0.105, 0.32, 0.003],
        rgba=[1.0, 0.85, 0.05, 0.22],
    )


def left_item_position() -> np.ndarray:
    return np.array([WORK_X, LEFT_BOX_Y, ITEM_Z])


def right_item_position() -> np.ndarray:
    return np.array([WORK_X, RIGHT_BOX_Y, ITEM_Z])


def gripper_path_position(t: float, avoid_height: float = 0.0) -> np.ndarray:
    t = _clamp01(t)
    y = _lerp(LEFT_BOX_Y, RIGHT_BOX_Y, t)
    x = WORK_X + 0.018 * np.sin(np.pi * t)
    z = LOW_PATH_Z + (ARC_HEIGHT + avoid_height) * np.sin(np.pi * t)
    return np.array([x, y, z])


def item_path_position(t: float, avoid_height: float = 0.0) -> np.ndarray:
    return gripper_path_position(t, avoid_height) - np.array([0.0, 0.0, GRIPPER_Z_OFFSET])


def sample_gripper_path(avoid_height: float) -> list[np.ndarray]:
    return [gripper_path_position(index / (len(TRAJECTORY_MARKERS) - 1), avoid_height) for index in range(len(TRAJECTORY_MARKERS))]


def set_freejoint_pose(
    model: mujoco.MjModel,
    data: mujoco.MjData,
    joint_name: str,
    pos: np.ndarray,
    quat: np.ndarray | None = None,
) -> None:
    joint_id = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_JOINT, joint_name)
    if joint_id < 0:
        raise ValueError(f"Cannot find free joint: {joint_name}")
    qpos_addr = int(model.jnt_qposadr[joint_id])
    data.qpos[qpos_addr : qpos_addr + 3] = pos
    if quat is None:
        quat = np.array([1.0, 0.0, 0.0, 0.0])
    data.qpos[qpos_addr + 3 : qpos_addr + 7] = quat / np.linalg.norm(quat)
    data.qvel[int(model.jnt_dofadr[joint_id]) : int(model.jnt_dofadr[joint_id]) + 6] = 0.0


def get_freejoint_pos(model: mujoco.MjModel, data: mujoco.MjData, joint_name: str) -> np.ndarray:
    joint_id = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_JOINT, joint_name)
    if joint_id < 0:
        raise ValueError(f"Cannot find free joint: {joint_name}")
    qpos_addr = int(model.jnt_qposadr[joint_id])
    return np.array(data.qpos[qpos_addr : qpos_addr + 3])


def update_path_markers(model: mujoco.MjModel, avoid_height: float, alpha: float = 0.58) -> None:
    for index, pos in enumerate(sample_gripper_path(avoid_height)):
        geom_id = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_GEOM, TRAJECTORY_MARKERS[index])
        if geom_id >= 0:
            model.geom_pos[geom_id] = pos
            model.geom_rgba[geom_id, 3] = alpha


def _lerp(start: float, end: float, t: float) -> float:
    return start + (end - start) * t


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))
