# MindBody V0.6 实施契约与阶段交接

V0.7 在此基础上新增来源目录、生成快照/检索和哈希门禁；知识作者格式与每域检索以 IMPLEMENTATION_V0.7.md、KNOWLEDGE_BASE.md 为准。本文保留 V0.6 历史交接，其余记录/授权边界继续适用。

本批次在尚未提交的 V0.5 工作区上继续，不重建、不提交/推送/部署。每日记录 v1 格式和既有五个存储接口保持不变。按依赖顺序实施，不并行修改共享文件。

## 开发前约定

- 类型：`src/types/insight.ts` 定义 DailyContext、KnowledgeCard、DailyInsight、InsightConversation。上下文仅含今日四项数值、7 日逐日数值、程序统计、填写情况；不发送身体备注、原始时间戳或用户标识。
- 知识：两个独立 JSON 域 psychology/tcm，包含审核状态、证据类型、来源与稳定引用 ID；前后端共用同一文件。只做原创简短转述，不搬运第三方项目代码/文献库。关键词/标签检索，无向量库。
- 事实：前端纯函数由 listDailyRecords 构造上下文。后端校验上下文、重新计算统计，LLM 不计算数值。无今日记录不给个体洞察；少于两次填写不描述变化，7 日不能解释为长期趋势。
- 服务：FastAPI 绑定本机，默认 mock；真实模式仅显式环境配置后可用。密钥只读服务端环境。不持久化请求、对话或结果，不记录请求体，不启用远程遥测。
- 授权：本地教育预览无需网络。调用前显示确切发送摘要、目的地、模式与外部模型配置（如有），明确点击授权；更换模式/数据或离开页面撤销。未授权不发送健康数据。对话每次发送的文本也需明确预览和确认，不发送过去对话原文。
- 结构化输出：后端 Pydantic 生成 JSON Schema，提供 OpenAPI；真实兼容 Chat Completions 服务以 json_schema 请求。只接收审核卡片 ID 和受控语气字段，解释由审核文案与程序事实构成，任意生成诊断/数字/建议文本拒绝。这样第一版可对任意输出做强约束，不把提示词当作唯一防线。
- 降级：模型失败、无检索、未知引用、危险输出返回标明状态的本地教育模板；危险请求先走确定性回应，必要时引导当地紧急/专业支持，不诊断。对话可以心理/中医/综合切换，不把两域互相推导。
- 微行动：自选一项已审核的轻量行动，只在本次页面内存保留；不修改每日健康记录，无打卡或疗效承诺。

## 文件职责

| 层 | 文件 | 作用 |
| --- | --- | --- |
| 契约 | src/types/insight.ts、backend/models.py | 前端类型与服务端运行时/JSON Schema |
| 事实 | src/utils/daily-context.ts | 今日与 7 日摘要，保留 null 与 0 |
| 内容 | knowledge/psychology.json、tcm.json | 已核实来源的审核卡片，独立域 |
| 教育逻辑 | src/utils/insight.ts | 检索、本地预览、微行动、服务响应校验 |
| 网络 | src/services/insight-api.ts | 本机请求、授权检查、超时/错误 |
| 页面 | src/pages/insight/index.vue | 状态、两域、来源、授权、对话与选择 |
| 后端 | backend/app.py、engine.py | API、确定性策略、LLM JSON Schema 适配 |
| 测试 | tests/insight*.test.cjs、backend/tests/ | 虚构隔离数据、授权、坏引用/输出、故障、旧功能回归 |

## 阶段验收日志

| 阶段 | 接口与文件交接 | 实际验收与下一阶段复用 |
| --- | --- | --- |
| 1 数据契约 | types/insight.ts、utils/daily-context.ts；DailyRecord/v1 不变 | 缺失/0、无今日、单日/多日/窗口过滤测试通过。数值摘要和 contextFacts 可直接用于知识/UI；原 42 项回归继续通过 |
| 2 知识 | knowledge/psychology.json、tcm.json；utils/insight.ts | 4 张卡来源核对完成；双域、审核状态、候选 ID、无匹配测试通过。前后端共用这两份 JSON；无复制第三方项目代码 |
| 3 服务 | backend/models.py、engine.py、app.py；services/insight-api.ts；requirements/检查脚本 | Pydantic 复核、Mock、真实适配器替身、授权、坏引用/危险输出、无检索、超时、配置变化通过；可供页面调用。真实供应商没有实连 |
| 4 UI | pages/insight/index.vue、首页/路由；记录页隐私说明 | 页面内存测试、本机 Mock 真实 HTTP、两域/来源/局限、逐次取消/授权、三视角、单项微行动、空态/仅备注无检索均通过；刷新恢复本地预览 |
| 5 集成/交接 | tests/insight.test.cjs、backend/tests/contract_bridge.cjs、test_insight.py；所有当前文档 | pnpm check：类型通过、Node 50/50、Python 14/14、H5 构建通过；TS→Python API→TS 契约测试通过。320/390/1280 几何布局无横向溢出，320 授权框默认取消与 Escape 实测。详见 VALIDATION_V0.6.md |

## API 与错误约定

- `GET /api/insight/info`：无健康输入，返回 schemaVersion/defaultMode/llmEnabled/providerHost/model/storesHealthData。页面进入不自动调用；准备按钮才读取。
- `GET /api/insight/schema`：返回受控 ModelSelection JSON Schema；`/docs` 有完整请求/响应模型。
- `POST /api/insight`：`{context, mode, serviceMode, question, consent}`。consent 必须是真布尔 true、固定 scope、当次 providerHost/model。DailyContext 的 4 个指标都显式存在，没填为 null。
- 响应 `{schemaVersion:1,date,status,perspectives,reply,notice,help}`；perspective 带同域 ID、审核正文和不确定性。数值事实不由回复生成，仍使用 contextFacts。
- 状态 local_preview 仅在客户端；mock/llm 是不同来源；fallback 明确表示未采用模型输出；blocked 是固定范围/专业支持引导；empty 是无今日记录。
- 知识审核状态支持 draft/source_checked/rejected；当前 4 张示例均为 source_checked，检索拒绝其他状态。它表示来源核对，不表示临床审核。
- 422：输入、统计或授权格式错误，不回显输入；409：模型域名/型号变化，需重看并授权；403：非本机 Origin；413：请求超 24KB；415：非 JSON。网络/超时/响应验证失败在前端提示并保留已有安全内容。
- 无今日不调用模型；无候选明确 fallback；危险请求先分流，模型不接收这些请求。坏 ID/串域/额外文本/无效 JSON/故障降级，不包含供应商错误详情或密钥。

## 来源核对记录

2026-11-19 从公开原网页读取正文/定位核对（网页搜索工具当时 403，改用普通 HTTPS 读取公开页面，无登录/绕过）：

- [NIMH Caring for Your Mental Health](https://www.nimh.nih.gov/health/topics/caring-for-your-mental-health)：自我关怀、社会支持与睡眠段落；两张心理卡为原创简短转述，不复制长段。
- [《黄帝内经·素问第一卷》公版古文](https://zh.wikisource.org/wiki/黃帝內經/素問第一卷)：上古天真论开篇起居/劳作句；中医日常节奏卡仅作为古代理论阅读，不复制现代译注。
- [WHO 中医国际标准术语](https://www.who.int/publications/i/item/9789240042322)：核对出版标题及术语用途；术语框架卡没有编造具体条目、疗效或临床证据。

后端 JSON Schema 使用 Pydantic 的 model_json_schema，核对了 [官方说明](https://docs.pydantic.dev/latest/concepts/json_schema/)。前端/后端共用知识 JSON，内容修改后须重启后端并回归前端候选验证。

## 接续规则

记录保存/删除仍只调用 V0.5 存储接口；首页、记录、历史和洞察各自 onShow 重读。洞察/聊天/行动不持久化，切换视角清空聊天，离页撤销授权并忽略迟到响应。后台无需迁移任何已有数据。

后续周报可复用经校验列表、程序摘要、双域检索和授权服务适配，但必须设计周报专用契约；不能直接发送身体备注或把有限卡片选择器宣称为完整咨询。当前批次完成后停止，不自动接入真实模型或下一阶段。

## 尚未承诺的能力

无临床审核认证、无诊断/处方/治疗；示例卡的“审核”表示来源与转述人工核对，不表示医学效力认证。没有云同步、账号系统、周报或长期对话存储。未验证的小程序/App 不标为通过。
