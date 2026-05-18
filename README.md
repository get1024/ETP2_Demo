# EPT2 YuMi MuJoCo Demo

这个文件夹保留 ABB YuMi 的 Python / MuJoCo 仿真原型，用来读取 YuMi 模型、搭建一个轻量左右箱搬运工位，并用 A/B 场景对比展示“柔性共生”。

GoFa 的 Three.js 演示已经移到同级目录：

```text
../GoFa Demo/
```

## What Is Included

- `yumi_mujoco_demo.py`: 很薄的命令行入口
- `yumi_mujoco/robot_loader.py`: 准备 MuJoCo 可读 URDF、复制 STL、加载并编译模型
- `yumi_mujoco/scene_builder.py`: 地面、背景墙、工作台、灯光、相机
- `yumi_mujoco/pick_place_scene.py`: 左右箱、红色物件、夹爪红色轨迹和 free joint 姿态工具
- `yumi_mujoco/pick_place_controller.py`: YuMi 双夹爪协作夹持、左箱取物、右箱放物的状态机和混合约束式 grasp lock
- `yumi_mujoco/human_proxy.py`: 用长方体模拟从正面伸入的人手，并显示预测轨迹线
- `yumi_mujoco/scenarios.py`: `traditional` 与 `flexible` 两套 A/B 场景逻辑
- `yumi_mujoco/robot_state.py`: 关节查询、qpos 写入、初始姿态、关节表打印
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
uv run yumi-mujoco-demo --headless --list-joints
uv run yumi-mujoco-demo --scenario traditional --headless --duration 8
uv run yumi-mujoco-demo --scenario flexible --headless --duration 8
```

## Run GUI

```bash
uv run yumi-mujoco-demo --scenario traditional
uv run yumi-mujoco-demo --scenario flexible
```

默认 `--speed` 为 `1.02`，也就是比基础节奏快 2%。如果临时想看得更慢或更快，可以显式传入 `--speed 1.0` 或其他倍率。

macOS 下 MuJoCo 图形窗口建议使用 `mjpython`：

```bash
.venv/bin/mjpython yumi_mujoco_demo.py --scenario flexible
```

如果 `.venv/bin/mjpython` 报旧路径的 `bad interpreter`，说明虚拟环境是在旧文件夹里生成的，直接重建：

```bash
rm -rf .venv
uv sync
```

## Current Scope

当前是一个稳定的课堂展示 demo，而不是纯物理抓取控制器。机器人关节仍由 qpos 关键帧和轻量 IK 驱动；红色物件是带 free joint 和质量的 MuJoCo 物体，但在“双夹爪夹住并搬运”的阶段使用混合约束式 grasp lock 跟随夹爪路径，以保证演示稳定。

- `traditional`: 人手从正面伸入工作区时，机器人沿原红色轨迹急停等待，表达“安全但中断”的 Stop-and-Go 协作。
- `flexible`: 人手从正面靠近时显示未来轨迹线，机器人平滑减速并把红色夹爪轨迹动态调高，表达“从停下来避开人，到顺着人的动作继续协作”。

人手代理的侵入周期比上一版加快 5%，因此干扰会更频繁地出现在搬运过程里。

后续如果要做真实机器人控制，可再单独升级 actuator、接触力、摩擦夹取、传感器反馈和任务成功率统计。
