# MindBody

一个用于日常身心记录与自我观察的应用。第一阶段完成 uni-app + Vue 3 + TypeScript 初始化与移动端首页，全部状态均为模拟数据。

## 当前进度

更新日期：2026-11-19。版本：0.1.0，第一阶段已完成。

| 功能 | 状态 |
| --- | --- |
| 移动端友好的首页与桌面布局 | 已完成 |
| 今天的日期 | 已完成，使用设备本地时间 |
| 情绪、睡眠、精力、压力与身体感受概览 | 已完成展示，全部为虚构模拟数据 |
| 每日记录入口 | 已完成占位提示，尚不能填写或保存 |
| 历史趋势入口 | 已完成占位提示，尚无历史数据和趋势图 |
| AI 周报入口 | 已展示，保持禁用，未接入 AI |
| PRD、开发路线、协作约定与验证记录 | 已完成 |

本阶段不开发后端、登录、数据库、真实记录存储、知识卡和微习惯。下一步建议为“每日记录表单与本地保存”，尚未开始。

## 本地运行

需要 Node.js ≥ 22.12.0 和 pnpm 11.19.0；已在 Node.js 24.19.0 环境验证。

首次从 GitHub 获取项目，在 PowerShell 中运行：

```powershell
git clone https://github.com/Jasperskkr/Mindbody.git
cd Mindbody
pnpm install --frozen-lockfile
pnpm dev:h5
```

本机已有项目时直接运行：

```powershell
cd F:\LJP\Mindbody
pnpm install
pnpm dev:h5
```

打开浏览器访问 **http://127.0.0.1:5173/**。保持终端运行，修改源码后浏览器通常会自动更新。停止服务时在终端按 `Ctrl+C`。

本次检测使用的是 Codex 提供的运行时。如果你另开普通 PowerShell，提示找不到 `node` 或 `pnpm`，可以先在该窗口运行以下命令，再执行上面的启动步骤：

```powershell
$mindbodyRuntime = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies'
$env:Path = "$mindbodyRuntime\node\bin;$mindbodyRuntime\bin\fallback;$env:Path"
```

这只影响当前终端窗口，不修改系统设置。上述目录对应本次检测到的本机运行时；将来迁移电脑时需要另行准备 Node.js 和 pnpm。

如提示 5173 端口已占用，先检查是不是已有本项目的开发服务；不要直接结束不认识的进程。

## 浏览器预览

- 电脑：直接打开上面的本地地址。
- 手机尺寸：按 `F12` 打开浏览器开发者工具，切换设备工具栏（Chrome / Edge 常用 `Ctrl+Shift+M`），选择 390px 或 320px 宽度，刷新页面。
- 当前默认地址仅能在本机打开，手机模拟是浏览器里的视口模拟，尚未进行真机测试。
- 点击“每日记录”和“历史趋势”会说明后续安排；AI 周报保持禁用。

## 检查与构建

```powershell
pnpm type-check
pnpm build:h5
# 或一次执行以上两项
pnpm check
```

构建产物在 `dist/build/h5/`，该目录已经被 Git 忽略。构建不等于部署，本阶段没有发布到互联网。当前页面以浏览器人工检查配合类型检查和构建验证，不额外安装测试框架。

## 主要文件

```text
src/
  main.ts                 创建 Vue 应用
  App.vue                 全局颜色、字体、按钮基础样式
  pages.json              uni-app 页面路由与导航配置
  manifest.json           应用信息及目标平台配置
  pages/index/index.vue   首页内容、交互和响应式布局
  data/mock.ts            集中的虚构健康数据
  types/health.ts         数据结构的 TypeScript 定义
  utils/date.ts           设备本地日期格式化
docs/
  PRD.md                  需求与当前阶段验收标准
  ROADMAP.md              小步开发路线
  ENVIRONMENT.md          环境、技术兼容性与版本选择
  VALIDATION.md           实际检查结果
AGENTS.md                 AI 与开发者的协作约定
.gitignore                排除依赖、构建产物、私有数据与密钥文件
.npmrc                    精确保存依赖版本并检查 Node 版本
index.html                Web 页面入口、语言和移动端视口
package.json              依赖与启动/检查命令
pnpm-lock.yaml            安装后的精确依赖清单
pnpm-workspace.yaml       项目内的依赖安装脚本许可
vite.config.ts            将 uni-app 插件接入 Vite 构建
tsconfig.json             TypeScript 检查规则
```

## 先掌握这三个基础知识

1. **Vue 单文件组件**：`.vue` 文件分成 `script`（数据和行为）、`template`（页面结构）、`style`（样式）。首页的 `v-for` 把一组数据重复渲染成四张卡片；`@click` 把按钮和函数连接起来。
2. **TypeScript 类型**：`health.ts` 描述数据应当长什么样。例如 `OverviewMetric.id` 只允许四个已定义值，写错字段时编辑器和 `pnpm type-check` 会提示。
3. **响应式数据与界面**：`ref` 包装会变化的数据。模板里的 `{{ today }}` 显示它的值；更新 `today.value` 后 Vue 自动刷新文本。模拟概览暂时不变，所以不需要全部包进 `ref`。

`pnpm` 管理依赖并执行命令，Vite 负责开发时更新页面及生产构建，uni-app 提供跨端组件和页面机制。现阶段先理解上面三个知识点即可。

## 数据与后续开发

本阶段不保存数据、不访问 AI、不开发后端。不得将真实健康记录替换进 mock 文件，也不要把 API 密钥写在前端。`.gitignore` 已忽略环境文件、私有数据目录、导出和数据库文件；以后提交前仍需检查内容。

下一步建议只做一个小任务：**每日记录表单与本地保存**。由用户决定何时开始，当前不自动继续。
