# 环境与搭建方案

首次检查日期：2026-11-18。工作目录：`F:\LJP\Mindbody`。以下初始化过程为历史记录，当前状态见末尾 V0.7 复核。

## 环境检查

| 项目 | 检查结果 | 影响 |
| --- | --- | --- |
| 操作系统 / 终端 | Windows / PowerShell | 运行说明使用 PowerShell |
| Node.js | 24.19.0 | 满足所选 uni-app 构建工具要求的 ≥ 22.12.0 |
| pnpm | 11.19.0 | 作为唯一包管理器，保留 pnpm-lock.yaml |
| npm / yarn | 当前命令环境不可用 | 不需要额外安装，使用 pnpm |
| Git | 2.44.0.windows.1 | 初始目录为空，尚未初始化仓库 |
| Python | 3.12.10 | 本阶段不用；后端阶段另行检查 FastAPI 环境 |

Node.js 与 pnpm 位于 Codex 缓存运行时目录，并非据此确认系统全局安装。普通 PowerShell 如果无法识别命令，可按 README 将现有运行时临时加入该终端的 PATH。

## 版本选择

根据 DCloud 官方 CLI 文档的 Vue 3 / TypeScript 工程结构搭建最小项目。官方模板仓库的直连请求在当前网络超时，因此采用对应配置手动初始化，没有引入模板下载器。

- uni-app 相关包统一锁定 `3.0.0-5030420261029002`（正式版本系列）。
- 使用框架配套的 Vue `3.4.21`、Vite `5.2.8` 和类型包 `3.4.31`。
- TypeScript `5.6.3` 与 vue-tsc `2.2.12` 负责检查 TS 和 Vue 模板。
- 核对 npm 包元数据后确认，插件要求 Node ≥ 22.12.0，并指定 Vite 5.2.8。
- `@dcloudio/vite-plugin-uni` 的 `latest` 标签指向旧版本，不能据此直接选择依赖。不要单独升级某一个 DCloud 包。
- 不引入 UI 组件库、路由库、状态管理库、图表库或 CSS 预处理器。pnpm 的间接依赖来自框架构建链。

pnpm 11 默认拦截依赖安装脚本。项目内的 `pnpm-workspace.yaml` 明确允许 `esbuild@0.20.2` 的必要安装脚本，禁用 `core-js`、`core-js-pure` 的非必要提示脚本。此配置不改变全局设置；依赖升级后应重新核对对应版本。

## 配置边界

当前仅安装 Web（H5）目标依赖。使用 uni-app 的页面路由、基础组件和 API 为后续复用做准备，微信小程序与原生 App 尚未编译验证。后续阶段需添加对应平台依赖与平台标识。

页面布局目前针对现代 Web 浏览器验证；原生渲染和各类小程序的 CSS 支持需要分别检查。

本地开发服务绑定 `127.0.0.1:5173`，仅供本机浏览器预览。没有配置公开访问或部署。`manifest.json` 禁用了 uni 统计。

2026-11-19，根据用户要求初始化本地 Git，并关联已有仓库 `https://github.com/Jasperskkr/Mindbody`。保留远程 `main` 分支初始提交，在其基础上同步第一阶段源码和文档。

参考：[DCloud 官方 CLI 快速开始](https://uniapp.dcloud.net.cn/quickstart-cli.html)、[官方 Vue TypeScript 模板](https://github.com/dcloudio/uni-preset-vue/tree/vite-ts)、[构建插件元数据](https://registry.npmjs.org/@dcloudio/vite-plugin-uni/3.0.0-5030420261029002)。

## V0.5 复核（2026-11-19）

- 继续既有 Git 项目，基线提交 543f197；未重建、未修改远程配置，未提交/推送/部署。
- Node v24.19.0、pnpm 11.19.0；原 uni-app/Vue/TypeScript/Vite 依赖保持原版本，锁文件未改。
- 历史、管理、趋势使用现有技术，图表为 Vue/CSS；没有新增图表库、状态库、测试框架或平台依赖。
- H5 浏览器实测 320/390/1280px；JSON 下载在独立测试地址实际验证。小程序/App 未编译，导出适配尚未实现，CSS 与确认框需要分别做真机验证。
- 当前检查命令和完整结果见 VALIDATION_V0.5.md。这里不重新声明包版本“最新”或所有跨端兼容。

## V0.6 复核（2026-11-19）

- 前端架构与全部依赖版本不变，未改 pnpm-lock.yaml。知识 JSON 前后端共用，不引入向量库、模型 SDK 或 UI 库。
- 项目内 `.venv` 使用 Python 3.12.10。新增 FastAPI 0.115.12、uvicorn 0.34.2、httpx 0.28.1、Pydantic 2.14.3；直接依赖见 backend/requirements.txt，所有已安装依赖精确清单见 requirements-lock.txt。虚拟环境与缓存忽略。
- 新增依赖用于 HTTP API、运行服务、超时可控的模型请求/测试、运行时校验及 JSON Schema；不需要数据库、dotenv 或外部模型 SDK。配置仅从服务端进程环境读取。
- 前端默认 `127.0.0.1:5173`，本机 API `127.0.0.1:8000`；不改变用户的浏览器存储地址。自动化浏览器使用独立 5175 测试端口的虚构数据。
- pnpm check 新增 Python unittest 与跨语言契约步骤，需先创建 `.venv` 并安装锁定依赖。测试不需要 Key、不调用外部模型。后端仅回环监听，关闭访问日志，无请求/结果持久化。
- H5 Mock 进行了实际本机 HTTP 验证；真实供应商未实连，要求 HTTPS Chat Completions 与 json_schema 支持。原生/小程序没有编译或真机验证，本机 API 地址将来需要平台适配。
- 最新命令结果与限制见 VALIDATION_V0.6.md。

## V0.7 复核（2026-11-25）

原前后端依赖与 pnpm/Python 锁定文件保持不变。维护工具使用现有 Pydantic 与 Python 标准库，生成纯 TS/Python 评分函数；运行中的后端不执行 Node 子进程，不新增模型 SDK/向量服务。`pnpm check` 增加知识生成一致性检查。原生/小程序及真实 LLM 未验证，本机 API 需构建后重启。实际结果见 VALIDATION_V0.7.md。
