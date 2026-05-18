from __future__ import annotations

import os
import shutil
import tempfile
from pathlib import Path
from xml.etree import ElementTree as ET

import mujoco

from .paths import GENERATED_DIR, MUJOCO_URDF, SOURCE_URDF, mesh_roots
from .scene_builder import build_workstation_scene


MESH_FILES = [
    "body.stl",
    *(f"link_{index}.stl" for index in range(1, 8)),
    "gripper/base.stl",
    "gripper/finger.stl",
]


def _find_mesh(relative_path: str) -> Path:
    for root in mesh_roots():
        candidate = root / relative_path
        if candidate.exists():
            return candidate
    searched = ", ".join(str(root) for root in mesh_roots()) or "no mesh roots found"
    raise FileNotFoundError(f"Cannot find mesh '{relative_path}'. Searched: {searched}")


def _atomic_copy(source: Path, target: Path) -> None:
    if target.exists() and target.stat().st_size == source.stat().st_size:
        return

    fd, tmp_name = tempfile.mkstemp(
        dir=target.parent,
        prefix=f"{target.name}.",
        suffix=".tmp",
    )
    os.close(fd)
    tmp_path = Path(tmp_name)
    try:
        shutil.copy2(source, tmp_path)
        tmp_path.replace(target)
    finally:
        if tmp_path.exists():
            tmp_path.unlink()


def prepare_mujoco_urdf() -> Path:
    """Create a MuJoCo-friendly URDF copy without touching the ROS source tree."""
    if not SOURCE_URDF.exists():
        raise FileNotFoundError(f"Cannot find YuMi URDF: {SOURCE_URDF}")

    GENERATED_DIR.mkdir(exist_ok=True)
    for relative_path in MESH_FILES:
        source = _find_mesh(relative_path)
        _atomic_copy(source, GENERATED_DIR / source.name)

    tree = ET.parse(SOURCE_URDF)
    root = tree.getroot()
    package_prefix = "package://yumi_description/"

    for mesh in root.findall(".//mesh"):
        filename = mesh.attrib.get("filename", "")
        if filename.startswith(package_prefix):
            # MuJoCo's URDF loader resolves this model's meshes relative to the
            # generated URDF directory, so keep mesh filenames flat and local.
            mesh.attrib["filename"] = Path(filename).name

    fd, tmp_name = tempfile.mkstemp(
        dir=GENERATED_DIR,
        prefix=f"{MUJOCO_URDF.name}.",
        suffix=".tmp",
    )
    os.close(fd)
    tmp_path = Path(tmp_name)
    try:
        tree.write(tmp_path, encoding="utf-8", xml_declaration=True)
        tmp_path.replace(MUJOCO_URDF)
    finally:
        if tmp_path.exists():
            tmp_path.unlink()
    return MUJOCO_URDF


def load_model() -> tuple[mujoco.MjModel, mujoco.MjData]:
    urdf_path = prepare_mujoco_urdf()
    spec = mujoco.MjSpec.from_file(str(urdf_path))
    build_workstation_scene(spec)
    model = spec.compile()
    data = mujoco.MjData(model)
    mujoco.mj_forward(model, data)
    return model, data
