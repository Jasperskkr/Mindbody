"""只读取已构建的知识快照；源码/索引过期时拒绝启动，不偷偷发布草稿。"""
from pathlib import Path

from scripts.knowledge import build

ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT = build(ROOT / 'knowledge', check=True)
CARDS = SNAPSHOT['cards']
KNOWLEDGE_HASH = SNAPSHOT['knowledgeHash']
TOP_K = SNAPSHOT['policy']['topK']


def ensure_current():
    # 源文件或快照在进程启动后变化，必须先构建/重启；不继续提供已撤回旧内容。
    latest = build(ROOT / 'knowledge', check=True)
    if latest['knowledgeHash'] != KNOWLEDGE_HASH:
        raise ValueError('知识快照已变化')
