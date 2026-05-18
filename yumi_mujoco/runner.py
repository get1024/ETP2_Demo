from __future__ import annotations

import argparse
import time

import mujoco

from .robot_loader import load_model
from .pick_place_controller import reset_to_home
from .robot_state import print_joints
from .scenarios import make_scenario


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Lightweight MuJoCo workstation demo for ABB YuMi.")
    parser.add_argument("--headless", action="store_true", help="Run without opening the MuJoCo viewer.")
    parser.add_argument("--duration", type=float, default=0.0, help="Seconds to run; 0 means until the viewer closes.")
    parser.add_argument("--list-joints", action="store_true", help="Print MuJoCo joint indices, qpos addresses, and limits.")
    parser.add_argument("--speed", type=float, default=1.02, help="Task speed multiplier.")
    parser.add_argument("--amplitude", type=float, default=1.0, help="Path height and yielding amount multiplier.")
    parser.add_argument(
        "--scenario",
        choices=["traditional", "flexible"],
        default="traditional",
        help="Run the stop-and-go baseline or the flexible yielding demo.",
    )
    return parser


def run_headless(model: mujoco.MjModel, data: mujoco.MjData, args: argparse.Namespace) -> None:
    scenario = make_scenario(args.scenario, model, args.amplitude)
    start = time.time()
    last = start
    while True:
        now = time.time()
        elapsed = now - start
        dt = min(0.05, now - last) * args.speed
        last = now
        scenario.update(model, data, elapsed * args.speed, dt)
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

    scenario = make_scenario(args.scenario, model, args.amplitude)
    try:
        with mujoco.viewer.launch_passive(model, data) as viewer:
            viewer.cam.distance = 2.2
            viewer.cam.azimuth = 45
            viewer.cam.elevation = -20
            viewer.cam.lookat[:] = [0.08, 0.0, 0.34]

            start = time.time()
            last = start
            while viewer.is_running():
                now = time.time()
                elapsed = now - start
                dt = min(0.05, now - last) * args.speed
                last = now
                scenario.update(model, data, elapsed * args.speed, dt)
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
    reset_to_home(model, data)

    if args.list_joints:
        print_joints(model)
        if args.headless:
            return

    if args.headless:
        run_headless(model, data, args)
    else:
        run_viewer(model, data, args)
