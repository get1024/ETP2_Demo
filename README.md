# ETP2 GoFa CRB 15000 Demo

一个轻量的 ABB GoFa CRB 15000 三维展示页面。当前阶段只做模型呈现，不包含机械臂控制、动作规划或物理仿真。

## What Is Included

- `gofa-viewer/`: Vite + Three.js 前端展示页
- `gofa-viewer/public/models/gofa-crb15000.glb`: 已从 ABB STEP CAD 装配转换出的浏览器模型
- `gofa-viewer/tools/convert-step-to-glb.mjs`: STEP 转 GLB 的本地转换脚本

原始 ABB CAD zip、临时 STEP 文件、`node_modules`、构建产物和旧 YuMi/MuJoCo 原型文件不会提交到仓库。

## Run

```bash
cd gofa-viewer
pnpm install
pnpm dev
```

打开终端输出里的本地地址，默认是：

```text
http://127.0.0.1:5173/
```

## Build

```bash
cd gofa-viewer
pnpm build
```

## Regenerate The Model

如果需要从原始 STEP 重新生成 GLB，把 ABB 的完整装配 STEP 放到：

```text
gofa-viewer/tmp_step/CRB15000_12kg-127_Omnicore_rev00_ASM_CAD.STEP
```

然后运行：

```bash
cd gofa-viewer
pnpm convert
```
