# 知识库维护：从新文献到可检索卡片

对应 V0.7。命令在项目根目录执行；使用 README 配置好的 `.venv`。所有命令只访问知识文件，不访问或迁移健康记录。

## 常用命令

```powershell
pnpm knowledge validate
pnpm knowledge:build
pnpm knowledge:check
```

- validate：检查结构、重复 ID、来源关系、授权与版本纪律；不会生成文件。未知授权会提示，缺少 authorization 字段会报错，不能默认为允许复制。
- build：验证后完整重建正式快照、两端检索代码及版本清单，不追加旧索引；没有审核的卡仍留在作者文件中。
- check：只读检查源文件、快照、版本清单和生成代码是否一致；`pnpm check` 的第一步就是它，不会偷偷重新发布内容。

`pnpm knowledge --help`、`pnpm knowledge draft --help` 可查看参数。底层是 `scripts/knowledge.py`，Node 启动器只负责找到项目 Python 环境。没有新增依赖。

## 添加一篇新文献的完整过程

**1. 先读来源并判断可用范围。** 记录题名、发布者、稳定 URL、原文位置、证据类型与限制；核对授权。文献全文或私人资料不放源码。只读到摘要时不能假装核对了全文。不要使用真实健康数据作为问题样本。

**2. 创建来源输入文件。** 下例是虚构模板，不是经核实的文献。请把它放在已忽略的 `.artifacts/source-input.json`，实际使用时替换为已核实资料：

```json
{
  "id": "SRC-EXAMPLE-01",
  "version": 1,
  "title": "虚构模板：请替换为真实核实的题名",
  "publisher": "虚构发布者",
  "url": "https://example.com/source",
  "domains": ["psychology"],
  "documentType": "research_paper",
  "lifecycle": "active",
  "verification": {"status": "unverified", "checkedAt": null, "note": "尚未核对"},
  "authorization": {
    "status": "unknown", "license": null,
    "allowedUses": ["metadata", "original_summary"],
    "note": "未确认复制权限，不允许全文或摘录；只记录书目信息及原创短转述"
  }
}
```

```powershell
pnpm knowledge add-source --file .artifacts/source-input.json
```

add-source 固定新来源为未核对、版本 1，不能在导入时假称已核实。`research_paper` 对应卡片 `modern_research`；不是研究论文时应选择实际类型。授权用途仍需自己核对，CLI 不会替你确认版权。

**3. 实际核对来源后记录核对范围。** 仅当确实完成核对，才执行以下命令；`--date` 填实际日期，`--note` 填核对了哪部分、没有读到哪部分：

```powershell
pnpm knowledge verify-source --id SRC-EXAMPLE-01 --date 2026-11-25 --note "示例：核对题名和摘要；尚未核对全文"
```

日期只是演示，不代表该虚构模板已核实。

**4. 新建卡片草稿。** ID 永久稳定，心理卡 PSY- 开头，中医卡 TCM- 开头。两个领域不能共用一个卡片 ID。

```powershell
pnpm knowledge draft --id PSY-EXAMPLE-01 --domain psychology --source-id SRC-EXAMPLE-01 --title "虚构草稿标题"
```

卡片为空草稿，不会进入正式检索。用编辑器创建 `.artifacts/card-patch.json`，只写想改的字段，例如：

```json
{
  "content": "虚构测试转述。实际卡片需自己核实来源并原创撰写。",
  "uncertainty": "尚未核对，不用于健康解释。",
  "sourceLocator": "摘要第几段或正文页码/章节，必须实际可定位",
  "tags": ["stress"],
  "keywords": ["虚构测试主题"]
}
```

```powershell
pnpm knowledge revise --id PSY-EXAMPLE-01 --file .artifacts/card-patch.json
```

revise 会递增版本、改回 draft、撤销原专业审核状态并绑定当前来源版本；不能用补丁改 ID、域、生命周期或伪造审核。来源也可以 revise，修改后来源回到 unverified，其旧卡因为来源版本不匹配而暂停发布。

**5. 核对卡片的每句话。** 比较原文、正文与局限；不能编造文献、诊断或过度推论。完成后才记录来源核对：

```powershell
pnpm knowledge review-card --id PSY-EXAMPLE-01 --decision source_checked --date 2026-11-25 --note "填写实际核对范围与限制，示例不等于已经核实"
```

未通过则 `--decision rejected`，不会进入检索。专业审核是另一个独立操作，只有真实合格审核人完成审核后，维护者才可记录：

```powershell
pnpm knowledge professional-review --id PSY-EXAMPLE-01 --decision approved --reviewer "实际审核人" --qualification "实际相关资质" --date 2026-11-25 --note "实际审核范围"
```

此命令是记账工具，不验证现实身份，也不能让 AI 充当合格专业人员。没有专业审核时保留 not_reviewed；专业拒绝后即使来源核对通过，也不会发布。

**6. 发布并验收。**

```powershell
pnpm knowledge validate
pnpm knowledge:build
pnpm check
```

检查正式卡片数量、哈希及授权提示。重启 API，刷新开发网页；生产网页则需重新构建（本批次不部署）。用虚构问题确认能检索到正确领域、ID、正文与来源；无结果保持空，不编造引用。不要改 generated.json 来绕过审核。

## 修改和撤回怎么处理

- 修改：revise 自动升版本并回草稿；重新核对后 build。旧正文会被全量快照替换，不保留在正式检索中。manifest 记录版本/哈希，不是完整历史归档；完整变更历史以后由用户授权的 Git 提交维护。
- 归档单卡：`pnpm knowledge archive --id PSY-EXAMPLE-01`，再 build。原 ID 和作者数据保留，不能物理删除或重复利用。
- 撤回来源：`pnpm knowledge archive --id SRC-EXAMPLE-01`，再 build；依赖它的卡全部退出正式结果。
- 修改来源：重新核对来源后，相关卡也要重新 review-card 绑定新版本，不自动沿用旧内容结论。
- 修改权重/Top-K：编辑 retrieval.json 并递增 version，再 build/check。不能单独修改前端或 Python 评分代码。

build 后未重启的 V0.7 API 会返回 503，而不是继续提供旧内容；前端新旧哈希不同则准备调用时拒绝传输，POST 又核对一次。离线网页中的旧静态预览不能被远程即时撤回，必须刷新/重新发布网页；这项限制需要如实保留。

## 隔离练习与故障恢复

可复制 knowledge 到一个临时练习目录，再用 `pnpm knowledge --root <临时目录>/knowledge ...`。非项目正式知识目录的生成代码放在该目录的父目录中，不覆盖真实项目代码。自动化测试使用系统 TemporaryDirectory，结束后只清理自己创建的虚构文件。

校验失败时先修复明确的源文件错误；不要清除 manifest 来绕过版本检查。手改已发布内容但未升版本会被拒绝。多文件构建不是数据库事务；中途失败可能留下一部分生成文件，check/服务完整性门禁会拒绝使用，修复后重跑 build 即可。避免一边维护知识一边请求洞察；不支持多人并发写入合并。

维护工具不自动抓取网页，不测试链接当前是否仍可访问；核对来源与授权仍由维护者负责。当前 4 张卡沿用 V0.6 的核对日期，没有声称本轮重新核对全部原网页。
