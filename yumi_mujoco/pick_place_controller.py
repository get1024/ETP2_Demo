from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

import mujoco
import numpy as np

from .pick_place_scene import (
    GRIPPER_Z_OFFSET,
    ITEM_JOINT,
    LOW_PATH_Z,
    WORK_X,
    gripper_path_position,
    item_path_position,
    left_item_position,
    right_item_position,
    set_freejoint_pose,
    update_path_markers,
)
from .robot_state import LEFT_ARM, RIGHT_ARM, apply_initial_pose, clamp_to_joint_range, joint_id, qpos_address, set_joint_position


LEFT_GRIPPERS = ["gripper_l_joint", "gripper_l_joint_m"]
RIGHT_GRIPPERS = ["gripper_r_joint", "gripper_r_joint_m"]
OPEN_SIDE_GAP = 0.130
GRASP_SIDE_GAP = 0.055


class PickPlaceState(Enum):
    WAIT_AT_LEFT = "WAIT_AT_LEFT"
    APPROACH_LEFT = "APPROACH_LEFT"
    GRASP_LOCK = "GRASP_LOCK"
    LIFT_FROM_LEFT = "LIFT_FROM_LEFT"
    TRANSFER = "TRANSFER"
    LOWER_TO_RIGHT = "LOWER_TO_RIGHT"
    RELEASE = "RELEASE"
    RESET = "RESET"


@dataclass(frozen=True)
class Phase:
    state: PickPlaceState
    duration: float


PHASES = [
    Phase(PickPlaceState.WAIT_AT_LEFT, 0.65),
    Phase(PickPlaceState.APPROACH_LEFT, 0.70),
    Phase(PickPlaceState.GRASP_LOCK, 0.25),
    Phase(PickPlaceState.LIFT_FROM_LEFT, 0.55),
    Phase(PickPlaceState.TRANSFER, 1.25),
    Phase(PickPlaceState.LOWER_TO_RIGHT, 0.55),
    Phase(PickPlaceState.RELEASE, 0.35),
    Phase(PickPlaceState.RESET, 0.60),
]
CYCLE_DURATION = sum(phase.duration for phase in PHASES)


class ArmIK:
    def __init__(self, model: mujoco.MjModel, joint_names: list[str], body_name: str) -> None:
        self.joint_names = joint_names
        self.body_id = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_BODY, body_name)
        self.qpos_addrs = [qpos_address(model, joint_name) for joint_name in joint_names]
        self.dof_addrs = []
        for joint_name in joint_names:
            j_id = joint_id(model, joint_name)
            if j_id is None:
                raise ValueError(f"Missing joint for IK: {joint_name}")
            self.dof_addrs.append(int(model.jnt_dofadr[j_id]))
        if self.body_id < 0 or any(addr is None for addr in self.qpos_addrs):
            raise ValueError(f"Cannot initialize IK body {body_name}")

    def move_to(self, model: mujoco.MjModel, data: mujoco.MjData, target: np.ndarray, strength: float) -> None:
        for _ in range(4):
            mujoco.mj_forward(model, data)
            error = target - data.xpos[self.body_id]
            if np.linalg.norm(error) < 0.004:
                return
            jacp = np.zeros((3, model.nv))
            jacr = np.zeros((3, model.nv))
            mujoco.mj_jacBody(model, data, jacp, jacr, self.body_id)
            jac = jacp[:, self.dof_addrs]
            damping = 1e-3 * np.eye(3)
            delta = jac.T @ np.linalg.solve(jac @ jac.T + damping, error * strength)
            for joint_name, qpos_addr, dq in zip(self.joint_names, self.qpos_addrs, delta):
                if qpos_addr is None:
                    continue
                j_id = joint_id(model, joint_name)
                if j_id is None:
                    continue
                data.qpos[qpos_addr] = clamp_to_joint_range(model, j_id, float(data.qpos[qpos_addr] + dq))


class PickPlaceController:
    def __init__(self, model: mujoco.MjModel, amplitude_scale: float = 1.0) -> None:
        self.left_arm = ArmIK(model, LEFT_ARM, "gripper_l_finger_l")
        self.right_arm = ArmIK(model, RIGHT_ARM, "gripper_r_finger_l")
        self.task_time = 0.0
        self.amplitude_scale = max(0.6, min(1.35, amplitude_scale))
        self.state = PickPlaceState.WAIT_AT_LEFT

    def update(
        self,
        model: mujoco.MjModel,
        data: mujoco.MjData,
        dt: float,
        *,
        speed_scale: float,
        avoid_height: float,
        paused: bool = False,
    ) -> None:
        if not paused:
            self.task_time += max(0.0, dt) * max(0.0, speed_scale)
        phase, local_t = self._phase_at(self.task_time % CYCLE_DURATION)
        self.state = phase.state
        u = _smooth(local_t / phase.duration if phase.duration else 1.0)
        left_target, right_target, item_pos, gripper_opening = self._targets(phase.state, u, avoid_height)

        update_path_markers(model, avoid_height * self.amplitude_scale, alpha=0.60)
        set_freejoint_pose(model, data, ITEM_JOINT, item_pos)
        self.left_arm.move_to(model, data, left_target, strength=0.62)
        self.right_arm.move_to(model, data, right_target, strength=0.62)
        for name in LEFT_GRIPPERS + RIGHT_GRIPPERS:
            set_joint_position(model, data, name, gripper_opening)
        mujoco.mj_forward(model, data)

    def _phase_at(self, task_time: float) -> tuple[Phase, float]:
        cursor = 0.0
        for phase in PHASES:
            if task_time <= cursor + phase.duration:
                return phase, task_time - cursor
            cursor += phase.duration
        return PHASES[-1], PHASES[-1].duration

    def _targets(
        self,
        state: PickPlaceState,
        u: float,
        avoid_height: float,
    ) -> tuple[np.ndarray, np.ndarray, np.ndarray, float]:
        avoid_height *= self.amplitude_scale
        left_item = left_item_position()
        right_item = right_item_position()
        left_hover_center = left_item + np.array([0.0, 0.0, GRIPPER_Z_OFFSET + 0.080])
        left_grasp_center = left_item + np.array([0.0, 0.0, GRIPPER_Z_OFFSET])
        right_hover_center = right_item + np.array([0.0, 0.0, GRIPPER_Z_OFFSET + 0.080 + avoid_height])
        right_release_center = right_item + np.array([0.0, 0.0, GRIPPER_Z_OFFSET])

        if state == PickPlaceState.WAIT_AT_LEFT:
            left, right = _dual_gripper_targets(left_hover_center, OPEN_SIDE_GAP)
            return left, right, left_item, 0.020

        if state == PickPlaceState.APPROACH_LEFT:
            center = _lerp_vec(left_hover_center, left_grasp_center, u)
            side_gap = _lerp(OPEN_SIDE_GAP, GRASP_SIDE_GAP, u)
            left, right = _dual_gripper_targets(center, side_gap)
            return left, right, left_item, _lerp(0.020, 0.012, u)

        if state == PickPlaceState.GRASP_LOCK:
            left, right = _dual_gripper_targets(left_grasp_center, GRASP_SIDE_GAP)
            return left, right, left_item, 0.006

        if state == PickPlaceState.LIFT_FROM_LEFT:
            lifted_item = _lerp_vec(left_item, item_path_position(0.0, avoid_height), u)
            center = lifted_item + np.array([0.0, 0.0, GRIPPER_Z_OFFSET])
            left, right = _dual_gripper_targets(center, GRASP_SIDE_GAP)
            return left, right, lifted_item, 0.006

        if state == PickPlaceState.TRANSFER:
            center = gripper_path_position(u, avoid_height)
            item = item_path_position(u, avoid_height)
            left, right = _dual_gripper_targets(center, GRASP_SIDE_GAP)
            return left, right, item, 0.006

        if state == PickPlaceState.LOWER_TO_RIGHT:
            start_item = item_path_position(1.0, avoid_height)
            item = _lerp_vec(start_item, right_item, u)
            center = _lerp_vec(start_item + np.array([0.0, 0.0, GRIPPER_Z_OFFSET]), right_release_center, u)
            left, right = _dual_gripper_targets(center, GRASP_SIDE_GAP)
            return left, right, item, 0.006

        if state == PickPlaceState.RELEASE:
            center = _lerp_vec(right_release_center, right_hover_center, u)
            side_gap = _lerp(GRASP_SIDE_GAP, OPEN_SIDE_GAP, u)
            left, right = _dual_gripper_targets(center, side_gap)
            return left, right, right_item, _lerp(0.006, 0.020, u)

        center = _lerp_vec(right_hover_center, left_hover_center, u)
        left, right = _dual_gripper_targets(center, OPEN_SIDE_GAP)
        return left, right, right_item, 0.020


def reset_to_home(model: mujoco.MjModel, data: mujoco.MjData) -> None:
    mujoco.mj_resetData(model, data)
    apply_initial_pose(model, data)
    set_freejoint_pose(model, data, ITEM_JOINT, left_item_position())
    update_path_markers(model, 0.0)
    mujoco.mj_forward(model, data)


def _lerp(start: float, end: float, u: float) -> float:
    return start + (end - start) * u


def _lerp_vec(start: np.ndarray, end: np.ndarray, u: float) -> np.ndarray:
    return start + (end - start) * u


def _dual_gripper_targets(center: np.ndarray, side_gap: float) -> tuple[np.ndarray, np.ndarray]:
    return (
        center + np.array([0.0, side_gap, 0.0]),
        center + np.array([0.0, -side_gap, 0.0]),
    )


def _smooth(u: float) -> float:
    u = max(0.0, min(1.0, u))
    return u * u * (3.0 - 2.0 * u)
