from __future__ import annotations

from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SOURCE_URDF = PROJECT_ROOT / "yumi" / "yumi_description" / "urdf" / "yumi.urdf"
LOCAL_MESH_ROOT = PROJECT_ROOT / "yumi" / "yumi_description" / "meshes"
ARCHIVE_MESH_ROOT = PROJECT_ROOT.parent / "_Archive" / "GoFa_Film" / "public" / "models" / "yumi"
GENERATED_DIR = PROJECT_ROOT / ".generated"
MUJOCO_URDF = GENERATED_DIR / "yumi_mujoco.urdf"


def mesh_roots() -> list[Path]:
    """Return available mesh roots, preferring the local ROS description copy."""
    return [root for root in (LOCAL_MESH_ROOT, ARCHIVE_MESH_ROOT) if root.exists()]

