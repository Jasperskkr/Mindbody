# 环境与搭建方案

检查日期：2026-11-18。工作目录：`F:\LJP\Mindbody`。

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
