from __future__ import annotations

import mujoco


LEFT_ARM = [
    "yumi_joint_1_l",
    "yumi_joint_2_l",
    "yumi_joint_7_l",
    "yumi_joint_3_l",
    "yumi_joint_4_l",
    "yumi_joint_5_l",
    "yumi_joint_6_l",
]
RIGHT_ARM = [
    "yumi_joint_1_r",
    "yumi_joint_2_r",
    "yumi_joint_7_r",
    "yumi_joint_3_r",
    "yumi_joint_4_r",
    "yumi_joint_5_r",
    "yumi_joint_6_r",
]
GRIPPERS = [
    "gripper_l_joint",
    "gripper_l_joint_m",
    "gripper_r_joint",
    "gripper_r_joint_m",
]
HOME_POSE = {
    "yumi_joint_1_l": -0.55,
    "yumi_joint_2_l": -1.05,
    "yumi_joint_7_l": 0.45,
    "yumi_joint_3_l": 0.65,
    "yumi_joint_4_l": -0.25,
    "yumi_joint_5_l": 1.15,
    "yumi_joint_6_l": 0.0,
    "yumi_joint_1_r": 0.55,
    "yumi_joint_2_r": -1.05,
    "yumi_joint_7_r": -0.45,
    "yumi_joint_3_r": -0.65,
    "yumi_joint_4_r": 0.25,
    "yumi_joint_5_r": 1.15,
    "yumi_joint_6_r": 0.0,
    "gripper_l_joint": 0.012,
    "gripper_l_joint_m": 0.012,
    "gripper_r_joint": 0.012,
    "gripper_r_joint_m": 0.012,
}


def joint_id(model: mujoco.MjModel, name: str) -> int | None:
    index = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_JOINT, name)
    return index if index >= 0 else None


def qpos_address(model: mujoco.MjModel, name: str) -> int | None:
    index = joint_id(model, name)
    if index is None:
        return None
    return int(model.jnt_qposadr[index])


def clamp_to_joint_range(model: mujoco.MjModel, joint_index: int, value: float) -> float:
    if model.jnt_limited[joint_index]:
        lower, upper = model.jnt_range[joint_index]
        return max(float(lower), min(float(upper), value))
    return value


def set_joint_position(model: mujoco.MjModel, data: mujoco.MjData, name: str, value: float) -> None:
    index = joint_id(model, name)
    if index is None:
        return
    address = int(model.jnt_qposadr[index])
    data.qpos[address] = clamp_to_joint_range(model, index, value)


def apply_initial_pose(model: mujoco.MjModel, data: mujoco.MjData) -> None:
    for name, value in HOME_POSE.items():
        set_joint_position(model, data, name, value)
    mujoco.mj_forward(model, data)


def print_joints(model: mujoco.MjModel) -> None:
    print("MuJoCo YuMi joint table")
    print("-" * 78)
    print(f"{'idx':>3}  {'name':<24} {'qpos':>5} {'limited':>7} {'lower':>10} {'upper':>10}")
    for index in range(model.njnt):
        name = mujoco.mj_id2name(model, mujoco.mjtObj.mjOBJ_JOINT, index) or f"joint_{index}"
        lower, upper = model.jnt_range[index]
        print(
            f"{index:>3}  {name:<24} {int(model.jnt_qposadr[index]):>5} "
            f"{bool(model.jnt_limited[index])!s:>7} {float(lower):>10.4f} {float(upper):>10.4f}"
        )

