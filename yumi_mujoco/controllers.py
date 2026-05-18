from __future__ import annotations

import math

import mujoco

from .robot_state import GRIPPERS, LEFT_ARM, RIGHT_ARM, set_joint_position


class SineAnimationController:
    """Kinematic demo controller that writes qpos for visual motion."""

    def __init__(self, amplitude_scale: float = 1.0) -> None:
        self.amplitude_scale = amplitude_scale

    def update(self, model: mujoco.MjModel, data: mujoco.MjData, elapsed: float) -> None:
        for side_index, names in enumerate((LEFT_ARM, RIGHT_ARM)):
            side = -1.0 if side_index == 0 else 1.0
            for axis_index, name in enumerate(names):
                phase = elapsed * (0.55 + axis_index * 0.05) + axis_index * 0.7
                base = 0.0
                amplitude = 0.45 if axis_index in {0, 2, 3} else 0.25
                if "joint_2" in name:
                    base = -1.05
                    amplitude = 0.18
                if "joint_5" in name:
                    base = 1.1
                target = base + side * amplitude * self.amplitude_scale * math.sin(phase)
                set_joint_position(model, data, name, target)

        gripper_opening = 0.012 + 0.01 * (0.5 + 0.5 * math.sin(elapsed * 1.6))
        for name in GRIPPERS:
            set_joint_position(model, data, name, gripper_opening)

        mujoco.mj_forward(model, data)

