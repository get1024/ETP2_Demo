from __future__ import annotations

import mujoco

from .human_proxy import add_human_proxy
from .pick_place_scene import add_pick_place_cell


FLOOR_TOP_Z = 0.0
FLOOR_RENDER_SIZE = 2.4
TABLE_TOP_Z = 0.34


def build_workstation_scene(spec: mujoco.MjSpec) -> None:
    configure_visual(spec)
    add_floor(spec)
    add_background_wall(spec)
    add_lights(spec)
    add_cameras(spec)
    add_table_support(spec)
    add_pick_place_cell(spec)
    add_human_proxy(spec)


def configure_visual(spec: mujoco.MjSpec) -> None:
    """Disable default headlight and set shadow quality."""
    spec.visual.headlight.active = 0
    spec.visual.quality.shadowsize = 4096


def add_floor(spec: mujoco.MjSpec) -> None:
    spec.worldbody.add_geom(
        name="studio_floor",
        type=mujoco.mjtGeom.mjGEOM_PLANE,
        pos=[0.0, 0.0, FLOOR_TOP_Z],
        size=[FLOOR_RENDER_SIZE, FLOOR_RENDER_SIZE, 0.02],
        rgba=[0.68, 0.69, 0.66, 1.0],
    )


def add_background_wall(spec: mujoco.MjSpec) -> None:
    spec.worldbody.add_geom(
        name="matte_back_wall",
        type=mujoco.mjtGeom.mjGEOM_BOX,
        pos=[-0.62, 0.0, 0.75],
        size=[0.025, 1.1, 0.75],
        rgba=[0.56, 0.59, 0.60, 1.0],
    )


def add_lights(spec: mujoco.MjSpec) -> None:
    """Use one strong key light so the bins, item, and path markers read clearly."""
    spec.worldbody.add_light(
        name="main_light",
        pos=[1.0, -1.5, 2.5],
        dir=[-0.3, 0.5, -1.0],
        diffuse=[1.0, 1.0, 1.0],
        ambient=[0.3, 0.3, 0.3],
        castshadow=True,
    )


def add_cameras(spec: mujoco.MjSpec) -> None:
    spec.worldbody.add_camera(
        name="overview",
        pos=[1.25, -1.75, 1.05],
        xyaxes=[0.82, 0.57, 0.0, -0.22, 0.32, 0.92],
    )
    spec.worldbody.add_camera(
        name="front_table",
        pos=[0.95, 0.0, 0.72],
        xyaxes=[0.0, 1.0, 0.0, -0.36, 0.0, 0.93],
    )


def add_table_support(spec: mujoco.MjSpec) -> None:
    for index, y in enumerate([-0.42, 0.42]):
        spec.worldbody.add_geom(
            name=f"workcell_stand_leg_{index + 1}",
            type=mujoco.mjtGeom.mjGEOM_BOX,
            pos=[-0.16, y * 0.72, 0.155],
            size=[0.035, 0.035, 0.16],
            rgba=[0.28, 0.31, 0.33, 1.0],
        )
        spec.worldbody.add_geom(
            name=f"workcell_stand_leg_{index + 3}",
            type=mujoco.mjtGeom.mjGEOM_BOX,
            pos=[0.78, y * 0.72, 0.155],
            size=[0.035, 0.035, 0.16],
            rgba=[0.28, 0.31, 0.33, 1.0],
        )
