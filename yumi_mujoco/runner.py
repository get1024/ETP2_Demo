from __future__ import annotations

import argparse
import time

import mujoco

from .controllers import SineAnimationController
from .robot_loader import load_model
from .robot_state import apply_initial_pose, print_joints


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Lightweight MuJoCo workstation demo for ABB YuMi.")
    parser.add_argument("--headless", action="store_true", help="Run without opening the MuJoCo viewer.")
    parser.add_argument("--duration", type=float, default=0.0, help="Seconds to run; 0 means until the viewer closes.")
    parser.add_argument("--list-joints", action="store_true", help="Print MuJoCo joint indices, qpos addresses, and limits.")
    parser.add_argument("--speed", type=float, default=1.0, help="Animation speed multiplier.")
    parser.add_argument("--amplitude", type=float, default=1.0, help="Joint motion amplitude multiplier.")
    return parser


def run_headless(model: mujoco.MjModel, data: mujoco.MjData, args: argparse.Namespace) -> None:
    controller = SineAnimationController(amplitude_scale=args.amplitude)
    start = time.time()
    while True:
        elapsed = time.time() - start
        controller.update(model, data, elapsed * args.speed)
        if args.duration and elapsed >= args.duration:
            break
        if not args.duration:
            break
        time.sleep(1.0 / 60.0)


def run_viewer(model: mujoco.MjModel, data: mujoco.MjData, args: argparse.Namespace) -> None:
    try:
        import mujoco.viewer
    except Exception as exc:
        raise SystemExit(f"Could not import MuJoCo viewer: {exc}") from exc

    controller = SineAnimationController(amplitude_scale=args.amplitude)
    try:
        with mujoco.viewer.launch_passive(model, data) as viewer:
            viewer.cam.distance = 2.2
            viewer.cam.azimuth = 45
            viewer.cam.elevation = -20
            viewer.cam.lookat[:] = [0.08, 0.0, 0.34]

            start = time.time()
            while viewer.is_running():
                elapsed = time.time() - start
                controller.update(model, data, elapsed * args.speed)
                viewer.sync()
                if args.duration and elapsed >= args.duration:
                    break
                time.sleep(1.0 / 60.0)
    except RuntimeError as exc:
        raise SystemExit(
            "MuJoCo viewer failed to start. On macOS, run the GUI with:\n"
            "  .venv/bin/mjpython yumi_mujoco_demo.py\n"
            f"Original error: {exc}"
        ) from exc


def main(argv: list[str] | None = None) -> None:
    args = build_parser().parse_args(argv)
    model, data = load_model()
    apply_initial_pose(model, data)

    if args.list_joints:
        print_joints(model)
        if args.headless:
            return

    if args.headless:
        run_headless(model, data, args)
    else:
        run_viewer(model, data, args)

