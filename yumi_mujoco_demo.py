from __future__ import annotations

import argparse
import math
import shutil
import time
from pathlib import Path
from xml.etree import ElementTree as ET

import mujoco


ROOT = Path(__file__).resolve().parent
YUMI_DESCRIPTION = ROOT / "yumi" / "yumi_description"
SOURCE_URDF = YUMI_DESCRIPTION / "urdf" / "yumi.urdf"
GENERATED_DIR = ROOT / ".generated"
MUJOCO_URDF = GENERATED_DIR / "yumi_mujoco.urdf"
FLOOR_TOP_Z = 0.0
FLOOR_RENDER_SIZE = 2.0

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


def prepare_mujoco_urdf() -> Path:
    """Create a MuJoCo-friendly URDF copy without touching the ROS source tree."""
    if not SOURCE_URDF.exists():
        raise FileNotFoundError(f"Cannot find YuMi URDF: {SOURCE_URDF}")

    GENERATED_DIR.mkdir(exist_ok=True)

    mesh_sources = [
        YUMI_DESCRIPTION / "meshes" / "body.stl",
        *(YUMI_DESCRIPTION / "meshes" / f"link_{index}.stl" for index in range(1, 8)),
        YUMI_DESCRIPTION / "meshes" / "gripper" / "base.stl",
        YUMI_DESCRIPTION / "meshes" / "gripper" / "finger.stl",
    ]
    for source in mesh_sources:
        if not source.exists():
            raise FileNotFoundError(f"Cannot find mesh: {source}")
        shutil.copy2(source, GENERATED_DIR / source.name)

    tree = ET.parse(SOURCE_URDF)
    root = tree.getroot()
    package_prefix = "package://yumi_description/"

    for mesh in root.findall(".//mesh"):
        filename = mesh.attrib.get("filename", "")
        if filename.startswith(package_prefix):
            # MuJoCo's URDF loader strips mesh paths in this model, so keep the
            # generated URDF and copied meshes in the same directory.
            mesh.attrib["filename"] = Path(filename).name

    tree.write(MUJOCO_URDF, encoding="utf-8", xml_declaration=True)
    return MUJOCO_URDF


def add_mujoco_scene(spec: mujoco.MjSpec) -> None:
    """Add MuJoCo-native scene elements around the imported YuMi URDF."""
    spec.worldbody.add_geom(
        name="studio_floor",
        type=mujoco.mjtGeom.mjGEOM_PLANE,
        pos=[0.0, 0.0, FLOOR_TOP_Z],
        size=[FLOOR_RENDER_SIZE, FLOOR_RENDER_SIZE, 0.02],
        rgba=[0.72, 0.72, 0.68, 1.0],
    )
    spec.worldbody.add_light(
        name="studio_key_light",
        pos=[0.0, -2.0, 2.8],
        dir=[0.0, 0.5, -1.0],
        diffuse=[0.8, 0.78, 0.72],
        ambient=[0.25, 0.25, 0.25],
    )
    spec.worldbody.add_camera(
        name="studio_overview",
        pos=[1.3, -1.8, 1.0],
        xyaxes=[0.82, 0.57, 0.0, -0.23, 0.33, 0.92],
    )


def load_model() -> tuple[mujoco.MjModel, mujoco.MjData]:
    urdf_path = prepare_mujoco_urdf()
    spec = mujoco.MjSpec.from_file(str(urdf_path))
    add_mujoco_scene(spec)
    model = spec.compile()
    data = mujoco.MjData(model)
    mujoco.mj_forward(model, data)
    return model, data


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


def initial_pose(model: mujoco.MjModel, data: mujoco.MjData) -> None:
    home = {
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
    for name, value in home.items():
        set_joint_position(model, data, name, value)
    mujoco.mj_forward(model, data)


def animate(model: mujoco.MjModel, data: mujoco.MjData, elapsed: float, amplitude_scale: float) -> None:
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
            target = base + side * amplitude * amplitude_scale * math.sin(phase)
            set_joint_position(model, data, name, target)

    gripper_opening = 0.012 + 0.01 * (0.5 + 0.5 * math.sin(elapsed * 1.6))
    for name in GRIPPERS:
        set_joint_position(model, data, name, gripper_opening)

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


def run_headless(model: mujoco.MjModel, data: mujoco.MjData, args: argparse.Namespace) -> None:
    start = time.time()
    while True:
        elapsed = time.time() - start
        animate(model, data, elapsed * args.speed, args.amplitude)
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

    try:
        with mujoco.viewer.launch_passive(model, data) as viewer:
            viewer.cam.distance = 2.2
            viewer.cam.azimuth = 45
            viewer.cam.elevation = -20
            viewer.cam.lookat[:] = [0.0, 0.0, 0.25]

            start = time.time()
            while viewer.is_running():
                elapsed = time.time() - start
                animate(model, data, elapsed * args.speed, args.amplitude)
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


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Lightweight MuJoCo demo for ABB YuMi.")
    parser.add_argument("--headless", action="store_true", help="Run without opening the MuJoCo viewer.")
    parser.add_argument("--duration", type=float, default=0.0, help="Seconds to run; 0 means until the viewer closes.")
    parser.add_argument("--list-joints", action="store_true", help="Print MuJoCo joint indices, qpos addresses, and limits.")
    parser.add_argument("--speed", type=float, default=1.0, help="Animation speed multiplier.")
    parser.add_argument("--amplitude", type=float, default=1.0, help="Joint motion amplitude multiplier.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    model, data = load_model()
    initial_pose(model, data)

    if args.list_joints:
        print_joints(model)
        if args.headless:
            return

    if args.headless:
        run_headless(model, data, args)
    else:
        run_viewer(model, data, args)


if __name__ == "__main__":
    main()
