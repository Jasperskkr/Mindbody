# MindBody V0.5 实施与交接

当前版本已到 V0.6；本文保留 V0.5 存储与管理接口契约，仍适用。新增洞察类型、服务、授权及阶段交接见 [IMPLEMENTATION_V0.6.md](./IMPLEMENTATION_V0.6.md)，最新实测见 [VALIDATION_V0.6.md](./VALIDATION_V0.6.md)。下文“不接 AI/后端”仅描述 V0.5 历史批次。

状态：五个阶段已实现，阶段 5 最终检查结果见下表与 VALIDATION_V0.5.md。基线为 V0.2（543f197），本批次不提交、推送或部署。

## 模块职责与文件所有权

本批次顺序实施，由同一负责人维护共享模块，避免并行修改契约。

| 层 | 文件 | 职责 |
| --- | --- | --- |
| 类型 | `src/types/health.ts` | 复用 DailyRecord，定义存储错误码、导出与趋势格式 |
| 存储 | `src/storage/daily-records.ts` | 所有按日读写、枚举与删除；页面禁止遍历 localStorage |
| 纯工具 | `src/utils/record-validation.ts`、`daily-overview.ts`、`trend-analysis.ts`、`record-export.ts` | 校验、展示转换、日期窗口与统计、JSON 数据包 |
| 平台 | `src/platform/export-json.ts` | H5 Blob 下载与错误反馈；其他平台明确不支持 |
| 页面 | `src/pages/index/`、`record/`、`history/` | 导航、输入、确认操作、加载与反馈 |
| 组件 | `HistoryRecordCard.vue`、`HealthTrendChart.vue`、`ConfirmAction.vue` | 记录展示、趋势图、默认取消的确认框 |
| 测试 | `tests/` | 内存 uni 替身、纯函数、真实页面 setup 集成；只用虚构记录 |

## 统一数据接口

DailyRecord 保持 V0.2 字段、可选语义、createdAt/updatedAt；sleepHours=0 有效。存储前缀仍为 `mindbody:daily-record:v1:`，数据包仍为 `{version:1, record}`，不迁移或另存列表/趋势缓存。

```ts
loadDailyRecord(date: string): Promise<DailyRecord | null>
saveDailyRecord(input: DailyRecordInput): Promise<DailyRecord>
listDailyRecords(): Promise<DailyRecord[]> // 日期倒序；完整成功或报错，不静默漏项
deleteDailyRecord(date: string): Promise<boolean> // 不存在为 false；验证删除后为 true
deleteAllDailyRecords(): Promise<number> // 仅当前版本专用键，返回确认删除数量
```

空存储返回 null / []；字段缺失保持 undefined；API 失败抛错。专用前缀下非法日期键、坏 JSON、版本/字段/日期不匹配都报错，保留原数据。其他应用的值不会被读取或修改。

错误统一为 `DailyRecordStorageError`，含 `code`、可选 `date`，界面显示可读 message：`INVALID_DATE`、`INVALID_RECORD`、`READ_FAILED`、`WRITE_FAILED`、`CORRUPT_RECORD`、`DELETE_FAILED`。批量删除可能中途失败，须报告已确认删除数量并重新读取；不提供虚假的原子事务承诺。批量预检失败时一条也不删；不自动清理损坏记录。

| 错误码 | 触发边界 | 调用方约定 |
| --- | --- | --- |
| INVALID_DATE | 按日读/删参数或 v1 专用键日期非法 | 显示日期错误，不改动数据 |
| INVALID_RECORD | 保存输入无效（包括日期、范围、全空） | 保留表单，修正后再保存 |
| READ_FAILED | 枚举键或读取记录 API 失败 | 显示重试，不能当作空列表，不覆盖 |
| WRITE_FAILED | 保存 API 失败或抛错 | 保留输入，不提示保存成功 |
| CORRUPT_RECORD | 坏 JSON、版本不兼容、日期不匹配、字段/时间戳异常 | 停止完整列表/导出/批量预检，保留原数据 |
| DELETE_FAILED | 删除 API 失败、未实际移除、批量中途失败或发现变化 | 显示已确认删除数（批量），重读实际状态，不盲目自动重试 |

日期不存在是 `null`，全部无记录是 `[]`；“空对象/全空字段的已存包”是损坏记录，不能当成不存在。可选字段缺失为 undefined，趋势用 null 表示该日该项无数据。普通 uni 错误不直接透传原始 payload，避免将记录内容写入日志。导出/趋势纯函数与平台适配层抛出可读 Error，页面统一捕获反馈；它们不修改存储。

## 导出契约

```ts
interface RecordExport {
  schemaVersion: 1
  exportedAt: string // ISO 时间
  records: DailyRecord[]
}
```

调用 listDailyRecords 后用纯函数校验并生成 JSON，保留已定义原始字段和两个时间戳；不补分、不补日期。损坏数据导致整次导出失败。平台层仅负责下载；H5 下载触发后提示已发起下载，不能保证浏览器最终写入磁盘。小程序/App 导出未实现，明确报错。

## 趋势契约

窗口为包含本地今天的最近 7 / 30 个日历日，按日期升序排列；未来和窗口外记录不计入。按日历递增，不用固定毫秒推算跨月日期。

```ts
interface TrendPoint { date: string; value: number | null }
// 每项：id、label、unit、direction、min、max、points、count、average
// HealthTrends：days、startDate、endDate、recordCount、series
```

四项为 mood/stress/energy/sleepHours。缺日期和未填指标均为 null；统计仅计算该指标实际数值，0 小时参与统计。0 项不显示平均值，1 项提示不足以观察变化。固定量表方向，不产生健康分数或医疗判断。使用原有 Vue/CSS 展示简洁图表，无新增依赖。

## 页面刷新与操作确认

- 首页、记录页、历史页在 onShow 读取；不把页面内存当作持久化。
- 历史页唯一记录数组来自 listDailyRecords，记录与趋势均从它派生。重进时重读，失败不展示旧列表为最新数据。
- 删除只由明确点击触发。单条确认显示日期；全部清空需两次确认，第二次强调不可恢复，每步默认焦点为取消。取消不调用删除接口。
- 删除期间禁用重复操作；成功和失败后都重读存储，再更新列表与趋势；返回首页/记录页时同样重读。
- 本轮无后台实时跨标签同步或冲突合并；本地存储不支持跨键原子事务，部分失败如实反馈。

## 阶段验收与交接日志

| 阶段 | 必须通过 | 状态 |
| --- | --- | --- |
| 1 数据访问层 | 旧测试 + 新增排序、坏记录、删除边界、其他键保护、部分失败测试 | 通过：pnpm test 27/27 |
| 2 历史页面 | 倒序、详情、空态、失败重试、重新显示刷新，保留旧功能 | 通过：阶段测试 28/28；最终 H5 详情/刷新/空态实测通过 |
| 3 数据管理 | JSON 可解析且完整、导出失败、单条确认/取消、双重清空、实际状态重读 | 通过：阶段测试 36/36；最终 H5 下载解析、确认/取消与默认焦点实测通过 |
| 4 趋势 | 7/30 日、缺失与 0、跨月年、指标样本数、删除联动 | 通过：阶段测试 40/40；最终 H5 7/30 天、逐日数值与布局实测通过 |
| 5 集成与交付 | 流程 A–F，pnpm check，320/390/1280，文档与版本准确 | 通过：pnpm check（类型、42/42、H5 构建）、浏览器/布局、文件核对；见 VALIDATION_V0.5.md |

每阶段在此记录修改文件、命令结果与可复用接口；未达标先修复。浏览器使用独立测试端口和虚构记录，绝不从日常 5173 端口读取/导出/删除健康数据。

### 阶段 1 交接

已修改 `health.ts`、`daily-records.ts`、`record-validation.ts`，新增 `tests/helpers.cjs`、`storage-management.test.cjs`。新增 7 项接口测试，原 20 项继续通过（`pnpm test` 27/27）。下阶段直接复用五个存储接口与 `DailyRecordStorageError`；无迁移、初始化清空或存储格式变更。

### 阶段 2 交接

新增 `pages/history/index.vue`、`components/HistoryRecordCard.vue`、`tests/history-page.test.cjs`；修改 `pages.json` 和首页导航。`pnpm type-check`、`pnpm test`（28/28）通过。详情只读，未填写由既有概览转换统一处理，`onShow` 重读且失败清除旧列表。下阶段复用 `records`、`refreshRecords()` 与详情组件；删除入口在阶段 3 绑定实际确认流程，浏览器联合验证在最终阶段执行。

### 阶段 3 交接

新增 `utils/record-export.ts`、`platform/export-json.ts`、`components/ConfirmAction.vue`，历史页绑定导出/删除，新增 `record-export.test.cjs`、`data-management-page.test.cjs`。`pnpm type-check`、`pnpm test`（36/36）通过。确认与取消、部分失败重读、导出完整性和下载失败均由虚构测试覆盖。下一阶段直接使用删除后重读的 `records` 计算趋势；无需另建缓存或发出全局数据事件。

### 阶段 4 交接

新增 `utils/trend-analysis.ts`、`components/HealthTrendChart.vue`、`tests/trend-analysis.test.cjs`、`tests/integration.test.cjs`，历史页接入选项卡与 7/30 天范围；记录页改 `onShow` 重读。类型检查和 40 项测试通过，其中完整流程 A–F 从真实页面 setup 经公共存储模块运行，刷新用新运行时模拟；多日排序、跨年/月、缺失和 0 均有断言。最终阶段将验证真实 H5 页面与下载，完善版本/文档；不增加新产品范围。

### 阶段 5 交接

补充历史页旧请求竞态、批量删除期间记录变化的测试，针对性 10/10 通过。保留原 V0.2 的 20 项测试，最终总计 42 项。H5 使用 `localhost:5175` 的独立测试存储，由 UI 创建虚构记录，实际验证保存→首页→历史→趋势、刷新、JSON 下载与解析、取消/确认单条删除、清空两级确认与空态。多日/跨月年的输入通过隔离内存接口测试覆盖，浏览器没有注入多日数据。

历史/趋势在 320、390、1280px 实测无横向溢出，记录页补查 320/390px。修正新组件中 uni 默认按钮居中/边框的局部样式；浏览器未捕获 warn/error。截图保存在被忽略的 `.artifacts/v05-*.jpg`，只含虚构数据。未打开或读写日常 5173 端口的私人记录。

更新 README、PRD、ROADMAP、AGENTS、DATA_FLOW、历史验收索引、ENVIRONMENT，本文件与 VALIDATION_V0.5；package/manifest 标记 0.5.0，未增加依赖或更改锁文件。最终命令结果、文件清单、手动验收和未验证边界见 VALIDATION_V0.5.md。

下一批可直接复用 DailyRecord、五个存储接口、buildHealthTrends 和 JSON 契约；当前没有周报专属类型或 AI 服务。跨标签变化检查只是尽力防护，校验到删除之间仍非原子操作；不要同时在多个标签页修改数据。小程序/App、真机、Safari、海量数据性能未验证。后续开发须另获用户任务授权，本批次到此交付。
