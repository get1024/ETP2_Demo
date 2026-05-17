# ETP2 YuMi MuJoCo Demo

这个文件夹只保留 ABB YuMi 的 Python / MuJoCo 仿真原型，用来直接读取 YuMi 模型、设置关节角度，并在 MuJoCo viewer 中观察双臂动作。

GoFa 的 Three.js 演示已经移到同级目录：

```text
../GoFa Demo/
```

## What Is Included

- `yumi_mujoco_demo.py`: YuMi MuJoCo 仿真入口
- `yumi/`: ABB YuMi ROS/URDF 模型与网格资源
- `pyproject.toml`: Python 项目配置
- `uv.lock`: `uv` 锁定文件
- `.generated/`: 运行时生成的 MuJoCo 友好 URDF 和 STL 复制件

## Setup

```bash
cd "/Users/ryanjoy/Desktop/Project/工程技术实践II/ETP2_Demo"
uv sync
```

## Run Headless Check

```bash
uv run python yumi_mujoco_demo.py --headless --duration 0.2 --list-joints
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
