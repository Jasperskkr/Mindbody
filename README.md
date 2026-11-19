# MindBody

一个用于日常身心记录与自我观察的应用，使用 uni-app + Vue 3 + TypeScript。V0.2 支持填写当天记录并保存在本机，首页概览读取同一份当天记录。

## 当前进度

更新日期：2026-11-19。版本：0.2.0，每日记录与本地持久化。

| 功能 | 状态 |
| --- | --- |
| 移动端友好的首页与桌面布局 | 已完成 |
| 今天的日期 | 已完成，使用设备本地时间 |
| 情绪、睡眠、精力、压力与身体感受概览 | 已接入当天本地记录；返回首页或刷新时更新，缺失项显示“未填写”，读取失败可重试 |
| 每日记录 | 已实现表单、校验、本地保存和刷新/重开回填；所有字段可跳过，至少填一项 |
| 历史趋势入口 | 已完成占位提示，尚无历史数据和趋势图 |
| AI 周报入口 | 已展示，保持禁用，未接入 AI |
| PRD、开发路线、协作约定与验证记录 | 已完成 |

没有后端、登录、云同步、趋势图、知识卡或微习惯。本轮完成首页联动后停止；下一步建议单独实现只读的历史记录列表。

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

修改 `pages.json` 新增页面后，尤其从单页变成多页时，需要停止旧服务并重新运行 `pnpm dev:h5`，然后刷新浏览器。只更新页面组件可能会留下旧的单页运行环境，导致每日记录入口无法跳转。

## 浏览器预览

- 电脑：直接打开上面的本地地址。
- 手机尺寸：按 `F12` 打开浏览器开发者工具，切换设备工具栏（Chrome / Edge 常用 `Ctrl+Shift+M`），选择 390px 或 320px 宽度，刷新页面。
- 当前默认地址仅能在本机打开，手机模拟是浏览器里的视口模拟，尚未进行真机测试。
- 点击“每日记录”打开当天表单，保存成功后返回首页即可查看概览；历史趋势仍显示占位提示，AI 周报保持禁用。
- 固定使用同一地址预览：`localhost` 与 `127.0.0.1`、不同端口或浏览器的本地数据互不共享。

## 检查与构建

```powershell
pnpm type-check
pnpm test
pnpm build:h5
# 或一次执行以上三项
pnpm check
```

构建产物在 `dist/build/h5/`，该目录已经被 Git 忽略。构建不等于部署。测试使用 Node 内置测试工具和已安装的 TypeScript/Vue 编译器，不额外安装测试框架，不访问用户浏览器存储。

## 主要文件

```text
src/
  main.ts                 创建 Vue 应用
  App.vue                 全局颜色、字体、按钮基础样式
  pages.json              uni-app 页面路由与导航配置
  manifest.json           应用信息及目标平台配置
  pages/index/index.vue   首页显示时读取当天记录、交互与响应式布局
  pages/record/index.vue  当日记录表单、读取状态及保存反馈
  components/ScaleField.vue  复用的 1–5 量表选择组件
  data/mock.ts            第一阶段虚构示例，当前页面不使用
  data/scales.ts          首页与表单共用的量表文字
  types/health.ts         概览、表单与每日记录的数据类型
  utils/date.ts           设备本地日期格式化
  utils/record-validation.ts  表单解析和运行时数据校验
  utils/daily-overview.ts  把记录转换成概览文字，不写入存储
  storage/daily-records.ts  版本化的按日存储，统一处理读写错误
tests/
  daily-records.test.cjs  虚构数据的校验、存储与日期测试
  record-page.test.cjs    内存替身测试页面的失败反馈与重试
  home-page.test.cjs      首页读取、缺失/0、返回更新、失败重试与过期请求测试
docs/
  PRD.md                  需求与当前阶段验收标准
  ROADMAP.md              小步开发路线
  ENVIRONMENT.md          环境、技术兼容性与版本选择
  VALIDATION.md           实际检查结果
  VALIDATION_V0.2.md       V0.2 检查结果与手动验收步骤
  VALIDATION_HOME.md       首页联动检查与手动验收
  DATA_FLOW.md             输入、保存、读取和显示的数据流教学
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
3. **响应式数据与界面**：`ref` 包装会变化的数据。首页读取结果放进 `record.value`，`computed` 根据它重新生成概览，Vue 自动更新页面。`onShow` 在页面每次出现时触发读取，包括从表单返回。

`pnpm` 管理依赖并执行命令，Vite 负责开发时更新页面及生产构建，uni-app 提供跨端组件和页面机制。现阶段先理解上面三个知识点即可。

## 数据与后续开发

记录只保存在当前设备或浏览器，不上传、不访问 AI。本地存储未加密，清理浏览器数据可能丢失记录。不得将真实健康记录替换进 mock 或测试文件，也不要把 API 密钥写在前端。`.gitignore` 已忽略环境文件、私有数据目录、导出和数据库文件；提交前仍需检查内容。

保存：页面中的 `form` 接收输入 → `parseRecordForm` 将睡眠字符串转成数字并校验 → `saveDailyRecord` 保留创建时间、更新修改时间并调用 `uni.setStorage`。读取：重开记录页时 `loadDailyRecord` 校验数据并回填；首页每次出现时也调用它，再由 `toDailyOverview` 和 `computed` 转成卡片。TypeScript 类型描述约定，运行时校验负责拦住实际收到的错误内容。完整讲解见 [数据流教学](docs/DATA_FLOW.md)。

存储键为 `mindbody:daily-record:v1:YYYY-MM-DD`。未填字段不存为 0 或 3；睡眠填写 0 则按有效数值保留。一天一个记录，再次保存更新当天内容。读取失败或数据格式异常时阻止覆盖，写入失败保留输入。

表单验收见 `docs/VALIDATION_V0.2.md`，首页联动验收见 `docs/VALIDATION_HOME.md`。用户已于 2026-11-19 授权将已验收的 V0.2 提交并推送到现有 GitHub 仓库；同步范围为源码、配置、测试和文档，不包括浏览器记录、密钥或本地产物。没有部署站点。
