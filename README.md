# EPT2 YuMi MuJoCo Demo

这个文件夹保留 ABB YuMi 的 Python / MuJoCo 仿真原型，用来读取 YuMi 模型、搭建一个轻量工作站场景、设置关节角度，并在 MuJoCo viewer 中观察双臂动作。

GoFa 的 Three.js 演示已经移到同级目录：

```text
../GoFa Demo/
```

## What Is Included

- `yumi_mujoco_demo.py`: 很薄的命令行入口
- `yumi_mujoco/robot_loader.py`: 准备 MuJoCo 可读 URDF、复制 STL、加载并编译模型
- `yumi_mujoco/scene_builder.py`: 地面、背景墙、工作台、灯光、相机、演示物体
- `yumi_mujoco/robot_state.py`: 关节查询、qpos 写入、初始姿态、关节表打印
- `yumi_mujoco/controllers.py`: 当前的正弦关节动画控制器
- `yumi_mujoco/runner.py`: 参数解析、headless / viewer 运行循环
- `yumi/`: ABB YuMi ROS/URDF 模型与网格资源
- `pyproject.toml`: Python 项目配置
- `uv.lock`: `uv` 锁定文件
- `.generated/`: 运行时生成的 MuJoCo 友好 URDF 和 STL 复制件

## Setup

```bash
cd "/Users/ryanjoy/Desktop/Project/工程技术实践II/EPT2_Demo"
uv sync
```

## Run Headless Check

```bash
uv run python yumi_mujoco_demo.py --headless --duration 0.2 --list-joints
```

也可以使用项目入口：

```bash
uv run yumi-mujoco-demo --headless --duration 0.2 --list-joints
```

## Run GUI

macOS 下 MuJoCo 图形窗口建议使用 `mjpython`：

```bash
.venv/bin/mjpython yumi_mujoco_demo.py
```

如果 `.venv/bin/mjpython` 报旧路径的 `bad interpreter`，说明虚拟环境是在旧文件夹里生成的，直接重建：

```bash
rm -rf .venv
uv sync
```

## Current Scope

当前仍然是一个“动画演示 demo”：`SineAnimationController` 会直接写入 `data.qpos` 并调用 `mj_forward()`，适合展示模型和理解关节，不等同于真实电机控制。后续如果要做更真实的动力学控制，可以在模型里添加 actuator，然后改成写 `data.ctrl` 并用 `mj_step()` 推进仿真。
