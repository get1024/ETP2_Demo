from __future__ import annotations

import mujoco


FLOOR_TOP_Z = 0.0
FLOOR_RENDER_SIZE = 2.4
TABLE_TOP_Z = 0.34


def build_workstation_scene(spec: mujoco.MjSpec) -> None:
    add_floor(spec)
    add_background_wall(spec)
    add_lights(spec)
    add_cameras(spec)
    add_workbench(spec)
    add_demo_objects(spec)


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
    spec.worldbody.add_light(
        name="studio_key_light",
        pos=[0.1, -2.0, 2.8],
        dir=[-0.05, 0.55, -1.0],
        diffuse=[0.85, 0.82, 0.76],
        ambient=[0.25, 0.25, 0.25],
    )
    spec.worldbody.add_light(
        name="studio_fill_light",
        pos=[1.3, 1.4, 1.7],
        dir=[-0.7, -0.65, -0.7],
        diffuse=[0.35, 0.42, 0.48],
        ambient=[0.08, 0.08, 0.08],
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


def add_workbench(spec: mujoco.MjSpec) -> None:
    spec.worldbody.add_geom(
        name="workbench_top",
        type=mujoco.mjtGeom.mjGEOM_BOX,
        pos=[0.42, 0.0, TABLE_TOP_Z - 0.035],
        size=[0.42, 0.55, 0.035],
        rgba=[0.42, 0.46, 0.48, 1.0],
    )
    for index, y in enumerate([-0.42, 0.42]):
        spec.worldbody.add_geom(
            name=f"workbench_leg_{index + 1}",
            type=mujoco.mjtGeom.mjGEOM_BOX,
            pos=[0.12, y, 0.15],
            size=[0.035, 0.035, 0.15],
            rgba=[0.28, 0.31, 0.33, 1.0],
        )
        spec.worldbody.add_geom(
            name=f"workbench_leg_{index + 3}",
            type=mujoco.mjtGeom.mjGEOM_BOX,
            pos=[0.72, y, 0.15],
            size=[0.035, 0.035, 0.15],
            rgba=[0.28, 0.31, 0.33, 1.0],
        )


def add_demo_objects(spec: mujoco.MjSpec) -> None:
    add_free_cube(
        spec,
        name="red_part",
        pos=[0.45, -0.18, TABLE_TOP_Z + 0.035],
        size=[0.035, 0.035, 0.035],
        mass=0.08,
        rgba=[0.86, 0.20, 0.16, 1.0],
    )
    add_free_cube(
        spec,
        name="blue_part",
        pos=[0.56, 0.16, TABLE_TOP_Z + 0.03],
        size=[0.03, 0.03, 0.03],
        mass=0.06,
        rgba=[0.12, 0.33, 0.82, 1.0],
    )
    spec.worldbody.add_geom(
        name="parts_tray",
        type=mujoco.mjtGeom.mjGEOM_BOX,
        pos=[0.28, 0.22, TABLE_TOP_Z + 0.012],
        size=[0.11, 0.075, 0.012],
        rgba=[0.16, 0.17, 0.18, 1.0],
    )


def add_free_cube(
    spec: mujoco.MjSpec,
    name: str,
    pos: list[float],
    size: list[float],
    mass: float,
    rgba: list[float],
) -> None:
    body = spec.worldbody.add_body(name=f"{name}_body", pos=pos)
    body.add_freejoint(name=f"{name}_freejoint")
    body.add_geom(
        name=f"{name}_geom",
        type=mujoco.mjtGeom.mjGEOM_BOX,
        size=size,
        mass=mass,
        rgba=rgba,
    )

