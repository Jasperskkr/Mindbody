# MindBody

一个用于日常身心记录与自我观察的应用，使用 uni-app + Vue 3 + TypeScript。V0.7 在每日记录、历史、导出/删除、趋势与双视角身心洞察基础上，增加可维护的来源、知识审核、版本与检索工具。记录保存在当前浏览器；本地教育预览不联网，服务调用需逐次明确授权。

## 当前进度

更新日期：2026-11-25。版本：0.7.0，双领域知识库工程化。用户已持续授权每批完成检查后提交并同步至现有 GitHub 仓库，不自动部署。

| 功能 | 状态 |
| --- | --- |
| 移动端友好的首页与桌面布局 | 已完成 |
| 今天的日期 | 已完成，使用设备本地时间 |
| 情绪、睡眠、精力、压力与身体感受概览 | 已接入当天本地记录；返回首页或刷新时更新，缺失项显示“未填写”，读取失败可重试 |
| 每日记录 | 已实现表单、校验、本地保存和刷新/重开回填；所有字段可跳过，至少填一项 |
| 历史记录 | 日期倒序、展开详情、空态与失败重试；历史只读，未填显示未填写 |
| 数据管理 | H5 JSON 下载、确认删除单条、双重确认清空；操作后重读实际存储 |
| 7 天 / 30 天趋势 | 情绪、压力、精力、睡眠四项图表和逐日数值；缺失留白、0 小时有效 |
| 身心洞察 | 今日/7 日程序事实、独立心理与中医知识卡、来源与局限、三种对话视角、自选一项微行动 |
| 本机 FastAPI | 默认 Mock；可配置兼容 JSON Schema 的真实模型，密钥仅在服务端 |
| 知识库维护 | 来源/卡片分离、独立专业审核/授权、草稿/版本/归档 CLI、每域 Top-K、快照哈希门禁；仍保留 4 张教育示例 |
| AI 周报入口 | 已展示，保持禁用 |
| PRD、开发路线、协作约定与验证记录 | 已完成 |

真实模型只负责选择候选知识卡和反思句，解释正文使用经来源核对的教育文案，不开放自由医疗回答。对话与微行动仅保留在本页内存，不保存聊天历史或习惯打卡。没有账号、云同步、数据库或周报。本轮不自动进入下一阶段；V0.7 依据用户的持续授权，在验证后提交并同步至 GitHub，未部署。

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

### 启动洞察服务（另开一个终端）

需要 Python 3.12（本机已验证 3.12.10）。首次创建项目内虚拟环境并安装锁定依赖：

```powershell
cd F:\LJP\Mindbody
python -m venv .venv
.\.venv\Scripts\python -m pip install -r backend/requirements-lock.txt
```

随后启动默认 Mock，不需要 API Key：

```powershell
.\.venv\Scripts\python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000 --no-access-log
```

5173 是前端网页端口，8000 是本机 API 端口，两者需要分别运行；前端地址仍是上面的 5173。API 文档在 [本机接口文档](http://127.0.0.1:8000/docs)。仅看本地教育预览时不需要 API 服务。

### 可选真实模型

默认不启用。本机服务端进程需设置 `MINDBODY_ENABLE_LLM=true`、`MINDBODY_LLM_API_KEY`、`MINDBODY_LLM_BASE_URL`、`MINDBODY_LLM_MODEL`，然后重启 API。BASE_URL 是服务商 HTTPS Chat Completions 前缀（程序追加 `/chat/completions`）；服务必须支持 `response_format: json_schema`。没有选定或实连某家服务，兼容性需用虚构数据另行验证。

密钥仅放在启动 API 的终端环境中，不写前端、文档、Git 或命令历史；本项目不自动读取 `.env`。启用后仍需在页面选择真实 AI、查看服务商域名/型号及确切摘要，明确授权当次调用。服务商保留政策由其决定。配置改变会拒绝旧授权。无效引用、超时或不兼容响应会明确降级。

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
- 点击“每日记录”填写当天状态；“历史趋势”进入记录/趋势双视图；“身心洞察”查看双视角教育预览、准备摘要并逐次授权 Mock/真实 AI；AI 周报保持禁用。
- 固定使用同一地址预览：`localhost` 与 `127.0.0.1`、不同端口或浏览器的本地数据互不共享。

## 检查与构建

```powershell
pnpm knowledge:check
pnpm type-check
pnpm test
pnpm test:api
pnpm build:h5
# 或一次执行以上五项（需先安装 Python 虚拟环境依赖）
pnpm check
```

构建产物在 `dist/build/h5/`，该目录已经被 Git 忽略。构建不等于部署。测试使用 Node 内置测试工具和已安装的 TypeScript/Vue 编译器，不额外安装测试框架，不访问用户浏览器存储。

### 维护知识库

```powershell
pnpm knowledge validate
pnpm knowledge:build
pnpm knowledge:check
```

从 [知识库概念](docs/KNOWLEDGE_BASE.md) 开始学习；完整 [新增文献/卡片、审核、修改和归档流程](docs/KNOWLEDGE_MAINTENANCE.md)；[检索与向量检索接续](docs/KNOWLEDGE_RETRIEVAL.md)。编辑作者文件后必须 build；前端刷新/重建、API 重启后再调用。版本不一致时不会自动把健康摘要发送给新版服务。

来源核对、专业审核、证据类型与复制授权分别记录。现有来源全文授权未知，当前只使用元数据与原创短转述；不自动抓取外部全文。Chunk 只定义结构，尚无 Embedding、向量索引或数据库。

## 主要文件

```text
src/
  main.ts                 创建 Vue 应用
  App.vue                 全局颜色、字体、按钮基础样式
  pages.json              uni-app 页面路由与导航配置
  manifest.json           应用信息及目标平台配置
  pages/index/index.vue   首页显示时读取当天记录、交互与响应式布局
  pages/record/index.vue  当日记录表单、读取状态及保存反馈
  pages/history/index.vue  历史/趋势切换、完整列表读取、导出及删除确认
  pages/insight/index.vue  双视角、来源、逐次授权、对话与微行动
  components/ScaleField.vue  复用的 1–5 量表选择组件
  components/HistoryRecordCard.vue  只读卡片、详情与删除入口
  components/HealthTrendChart.vue   CSS 日历柱图、填写统计、逐日表
  components/ConfirmAction.vue      默认取消的确认框
  data/mock.ts            第一阶段虚构示例，当前页面不使用
  data/scales.ts          首页与表单共用的量表文字
  types/health.ts         概览、表单与每日记录的数据类型
  types/insight.ts        摘要、知识卡、洞察、对话和授权契约
  utils/date.ts           设备本地日期格式化
  utils/record-validation.ts  表单解析和运行时数据校验
  utils/daily-overview.ts  把记录转换成概览文字，不写入存储
  utils/trend-analysis.ts  7/30 日窗口、缺失值与每项平均值的纯函数
  utils/daily-context.ts   仅含必要数值的 7 日洞察摘要与程序事实
  utils/insight.ts         知识检索、本地预览与返回内容校验
  services/insight-api.ts  本机 API、授权检查与错误反馈
  utils/record-export.ts   校验完整记录并生成带版本号的 JSON
  platform/export-json.ts  H5 下载适配层，其他端明确不支持
  storage/daily-records.ts  版本化按日读写、列表、删除及错误码
tests/
  insight.test.cjs        洞察摘要、隐私、检索、授权、页面和迟到响应测试
  daily-records.test.cjs  虚构数据的校验、存储与日期测试
  record-page.test.cjs    内存替身测试页面的失败反馈与重试
  home-page.test.cjs      首页读取、缺失/0、返回更新、失败重试与过期请求测试
  storage-management.test.cjs  列表与删除边界、其他键保护、部分失败
  history-page.test.cjs        历史页刷新与失败恢复
  data-management-page.test.cjs  删除确认/取消、导出与操作后重读
  record-export.test.cjs       JSON 完整性和下载失败
  trend-analysis.test.cjs      日期窗口、缺失/0、统计与跨月年
  integration.test.cjs         真实页面 setup 的完整流程 A–F
  helpers.cjs                 隔离内存 uni 与模块/页面测试运行器
knowledge/
  psychology.json、tcm.json  作者维护的卡片（含草稿/归档），关联来源 ID/版本
  sources.json             来源、授权与来源核对目录
  retrieval.json           每域 Top-K 与唯一评分表达式
  manifest.json            发布版本/哈希登记，禁止物理删除稳定 ID
  generated.json           生成的正式知识快照，保留页面兼容字段
scripts/
  knowledge.py、run-knowledge.cjs  知识维护 CLI 与 Python 启动器
src/generated/knowledge-ranking.ts  生成的前端检索实现，禁止手改
backend/
  knowledge_models.py、knowledge.py  知识运行时模型、加载与完整性检查
  generated_ranking.py     生成的 Python 检索实现，禁止手改
  models.py               Pydantic 输入校验、统计复核与模型 JSON Schema
  engine.py               知识检索、风险分流、Mock/LLM 与安全降级
  app.py                  本机 FastAPI 端点、CORS 与不回显输入的错误
  tests/                  API/适配器测试与 TS→Python→TS 契约集成
  requirements-lock.txt   含传递依赖的 Python 安装锁定清单
docs/
  PRD.md                  需求与当前阶段验收标准
  ROADMAP.md              小步开发路线
  ENVIRONMENT.md          环境、技术兼容性与版本选择
  VALIDATION.md           实际检查结果
  VALIDATION_V0.2.md       V0.2 检查结果与手动验收步骤
  VALIDATION_HOME.md       首页联动检查与手动验收
  DATA_FLOW.md             输入、保存、读取和显示的数据流教学
  IMPLEMENTATION_HANDOFF.md  共享接口、职责、阶段验收与接续说明
  VALIDATION_V0.5.md         本批次结果、限制和手动验收
  IMPLEMENTATION_V0.6.md     洞察数据契约与阶段交接
  VALIDATION_V0.6.md         V0.6 历史检查
  IMPLEMENTATION_V0.7.md、VALIDATION_V0.7.md  本批次设计、交接和实际验收
  KNOWLEDGE_BASE.md、KNOWLEDGE_MAINTENANCE.md、KNOWLEDGE_RETRIEVAL.md  知识库教程
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

记录只保存在当前设备或浏览器，本地存储未加密，清理浏览器数据可能丢失记录。洞察默认本地预览；明确授权后发送今日/7 日四项数值、程序统计、本次问题与模式到本机 API，真实模式才转发配置的外部模型。不发送身体备注、原始记录时间戳、用户标识或过去聊天；问题中自行输入的内容仍会发送，授权前请核对。服务不持久化请求或结果。不得把真实健康记录、API 密钥写入源码或测试文件；忽略规则不能替代内容检查。

保存：页面中的 `form` 接收输入 → `parseRecordForm` 将睡眠字符串转成数字并校验 → `saveDailyRecord` 保留创建时间、更新修改时间并调用 `uni.setStorage`。读取：重开记录页时 `loadDailyRecord` 校验数据并回填；首页每次出现时也调用它，再由 `toDailyOverview` 和 `computed` 转成卡片。TypeScript 类型描述约定，运行时校验负责拦住实际收到的错误内容。完整讲解见 [数据流教学](docs/DATA_FLOW.md)。

存储键为 `mindbody:daily-record:v1:YYYY-MM-DD`。未填字段不存为 0 或 3；睡眠填写 0 则按有效数值保留。一天一个记录，再次保存更新当天内容。读取失败或数据格式异常时阻止覆盖，写入失败保留输入。

历史页使用 `listDailyRecords()` 读取完整记录，详情、趋势和导出不各存副本。`buildHealthTrends()` 为每个日期生成数值或 null；平均值只计算该项填写的天数。导出包含 schemaVersion、exportedAt、records，保留已保存字段与时间戳。H5 通过适配层下载，小程序/App 导出尚未实现；当前没有 JSON 导入或恢复功能。

删除无法恢复：单条需确认日期，清空需两次确认。仅删除当前 v1 专用记录键，不清空整个网站存储。损坏或不兼容记录会阻止完整列表、导出和批量清空，原数据保持不动。批量删除不具备数据库事务能力，中途失败可能已删除一部分，会明确提示并重读。不要多标签同时修改记录。

最新验收见 [V0.7 验证报告](docs/VALIDATION_V0.7.md)，交接见 [V0.7 实施说明](docs/IMPLEMENTATION_V0.7.md)；原洞察和存储契约继续保留。知识卡的 source_checked 只表示核对来源/转述，并非临床审核。关键词风险规则不能覆盖所有危险表达；服务只用于本机开发，未实现公开服务所需的认证/限流。离线旧页面无法即时撤回静态知识，需刷新客户端；模型实连、小程序/App 未验证。本批次未部署或处理真实私人记录。
