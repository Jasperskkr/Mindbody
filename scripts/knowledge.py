"""维护命令只处理显式知识目录，不访问 uni 存储或浏览器。"""
import argparse
import copy
import hashlib
import json
import os
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from backend.knowledge_models import KnowledgeCard, SourceDocument, RetrievalPolicy

DOMAINS = ('psychology', 'tcm')


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'))


def digest(value):
    return hashlib.sha256(canonical(value).encode('utf-8')).hexdigest()


def read(path):
    def unique(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError(f'JSON 对象字段重复：{key}')
            result[key] = value
        return result
    return json.loads(path.read_text(encoding='utf-8'), object_pairs_hook=unique)


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    os.replace(temporary, path)


def load(directory):
    sources = read(directory / 'sources.json')
    cards = []
    for domain in DOMAINS:
        entries = read(directory / f'{domain}.json')
        if not isinstance(entries, list) or any(card.get('domain') != domain for card in entries):
            raise ValueError(f'{domain}.json 包含错误的知识域或不是数组')
        cards.extend(entries)
    policy = read(directory / 'retrieval.json')
    validate(sources, cards, policy)
    return sources, cards, policy


def validate(sources, cards, policy):
    RetrievalPolicy.model_validate(policy)
    score_expression(policy['score'], 'py')
    identifiers = [entry['id'] for entry in sources + cards]
    if len(set(identifiers)) != len(identifiers):
        raise ValueError('存在重复 ID')
    source_map = {}
    warnings = []
    for raw in sources:
        source = SourceDocument.model_validate(raw)
        source_map[source.id] = source
        if source.authorization.status == 'unknown':
            warnings.append(f'{source.id} 全文授权未知；仅按明确用途使用，不能复制全文')
    for raw in cards:
        card = KnowledgeCard.model_validate(raw)
        source = source_map.get(card.sourceId)
        if source is None:
            raise ValueError(f'{card.id} 引用不存在的来源 {card.sourceId}')
        if card.domain not in source.domains:
            raise ValueError(f'{card.id} 来源与知识域不一致')
        if card.sourceVersion > source.version:
            raise ValueError(f'{card.id} 引用尚不存在的来源版本')
        expected = 'modern_research' if source.documentType == 'research_paper' else source.documentType
        if card.evidenceType != expected:
            raise ValueError(f'{card.id} 证据类型与来源不一致')
    return warnings


def eligible(card, source):
    use = 'original_summary' if card['contentOrigin'] == 'original_summary' else 'excerpt'
    return (card['lifecycle'] == 'active' and card['review']['status'] == 'source_checked'
            and card['professionalReview']['status'] != 'rejected' and source['lifecycle'] == 'active'
            and source['verification']['status'] == 'source_checked' and card['sourceVersion'] == source['version']
            and use in source['authorization']['allowedUses']
            and (use == 'original_summary' or source['authorization']['status'] == 'permitted'))


def manifest(sources, cards, policy):
    return {'schemaVersion': 1, 'items': {item['id']: {'version': item['version'], 'hash': digest(item)} for item in sources + cards},
            'policy': {'version': policy['version'], 'hash': digest(policy)}}


def check_versions(previous, current):
    for identifier, old in previous.get('items', {}).items():
        new = current['items'].get(identifier)
        if new is None:
            raise ValueError(f'{identifier} 不得物理移除；请归档以保留引用历史')
        if new['version'] < old['version'] or (new['hash'] != old['hash'] and new['version'] <= old['version']):
            raise ValueError(f'{identifier} 内容已变更，必须递增版本并重新审核')
    old = previous.get('policy')
    new = current['policy']
    if old and (new['version'] < old['version'] or (old['hash'] != new['hash'] and new['version'] <= old['version'])):
        raise ValueError('检索规则变更必须递增 version')


def bundle(sources, cards, policy):
    source_map = {source['id']: source for source in sources}
    published = []
    for card in sorted(cards, key=lambda item: item['id']):
        source = source_map[card['sourceId']]
        if eligible(card, source):
            published.append(copy.deepcopy(card) | {'source': {
                'title': source['title'], 'publisher': source['publisher'], 'url': source['url'],
                'locator': card['sourceLocator'],
            }})
    ts, py = generated_code(policy)
    result = {'schemaVersion': 1, 'policy': policy, 'implementationHash': digest({'typescript': ts, 'python': py}), 'cards': published,
              'sources': sorted(sources, key=lambda item: item['id'])}
    return result | {'knowledgeHash': digest(result)}


def score_expression(node, target):
    """唯一业务评分定义在 retrieval.json；同一表达式编译到两种语言。"""
    if not isinstance(node, dict):
        raise ValueError('评分表达式必须是对象')
    op = node.get('op')
    if op in ('add', 'multiply') and set(node) == {'op', 'args'} and isinstance(node['args'], list) and len(node['args']) >= 2:
        return '(' + (' + ' if op == 'add' else ' * ').join(score_expression(item, target) for item in node['args']) + ')'
    if op == 'constant' and set(node) == {'op', 'value'} and type(node['value']) is int and 0 <= node['value'] <= 100:
        return str(node['value'])
    if node == {'op': 'tag_matches'}:
        return "sum(tag in tags for tag in card['tags'])" if target == 'py' else 'card.tags.filter(tag => tags.includes(tag)).length'
    if node == {'op': 'keyword_matches'}:
        return "sum(word in question for word in card['keywords'])" if target == 'py' else 'card.keywords.filter(word => question.includes(word)).length'
    raise ValueError('未知或不安全的评分表达式')


def generated_code(policy):
    # 领域循环/稳定排序是适配胶水，评分表达式没有两份手写实现。
    ts = '''// 自动生成：pnpm knowledge:build；请勿手工修改。
import type { KnowledgeCard, KnowledgeDomain } from '../types/insight'
export function rankKnowledge(cards: KnowledgeCard[], tags: string[], question: string, domains: KnowledgeDomain[], topK: Record<KnowledgeDomain, number>): KnowledgeCard[] {
  return domains.flatMap(domain => cards.filter(card => card.domain === domain && card.lifecycle === 'active' && card.review.status === 'source_checked' && card.professionalReview.status !== 'rejected')
    .map(card => ({ card, score: SCORE }))
    .filter(item => item.score > 0).sort((a, b) => b.score - a.score || (a.card.id < b.card.id ? -1 : a.card.id > b.card.id ? 1 : 0))
    .slice(0, topK[domain]).map(item => item.card))
}
'''.replace('SCORE', score_expression(policy['score'], 'ts'))
    py = '''# 自动生成：pnpm knowledge:build；请勿手工修改。
def rank_knowledge(cards, tags, question, domains, top_k):
    result = []
    for domain in domains:
        ranked = []
        for card in cards:
            if card['domain'] != domain or card['lifecycle'] != 'active' or card['review']['status'] != 'source_checked' or card['professionalReview']['status'] == 'rejected':
                continue
            score = SCORE
            if score > 0:
                ranked.append((score, card))
        result.extend(card for score, card in sorted(ranked, key=lambda item: (-item[0], item[1]['id']))[:top_k[domain]])
    return result
'''.replace('SCORE', score_expression(policy['score'], 'py'))
    return ts, py


def build(directory, project=ROOT, check=False):
    sources, cards, policy = load(directory)
    current = manifest(sources, cards, policy)
    previous_path = directory / 'manifest.json'
    if not previous_path.exists() and (directory / 'generated.json').exists():
        raise ValueError('已发布知识缺少 manifest；请恢复版本清单，不可绕过版本检查')
    previous = read(previous_path) if previous_path.exists() else {}
    check_versions(previous, current)
    snapshot = bundle(sources, cards, policy)
    ts, py = generated_code(policy)
    outputs = {directory / 'generated.json': json.dumps(snapshot, ensure_ascii=False, indent=2) + '\n',
               project / 'src/generated/knowledge-ranking.ts': ts, project / 'backend/generated_ranking.py': py}
    if check:
        if current != previous:
            raise ValueError('知识版本清单过期，请执行 knowledge:build')
        for path, expected in outputs.items():
            if not path.exists() or path.read_text(encoding='utf-8') != expected:
                raise ValueError(f'生成数据或检索实现过期：{path.name}，请执行 knowledge:build')
    else:
        for path, content in outputs.items():
            path.parent.mkdir(parents=True, exist_ok=True)
            temporary = path.with_suffix(path.suffix + '.tmp')
            temporary.write_text(content, encoding='utf-8')
            os.replace(temporary, path)
        write(previous_path, current)
    return snapshot


def edit(directory, command, identifier, **options):
    sources, cards, policy = load(directory)
    all_items = sources + cards
    if command == 'add-source':
        item = read(Path(options['file']))
        if item['id'] in {entry['id'] for entry in all_items}:
            raise ValueError('ID 已存在')
        item.update(version=1, lifecycle='active', verification={'status': 'unverified', 'checkedAt': None, 'note': '新增来源，待核对'})
        sources.append(item)
        identifier = item['id']
    elif command == 'draft':
        if identifier in {entry['id'] for entry in all_items}:
            raise ValueError('ID 已存在，归档 ID 也不能复用')
        source = next((entry for entry in sources if entry['id'] == options['source_id']), None)
        if source is None:
            raise ValueError('来源不存在')
        cards.append(dict(id=identifier, domain=options['domain'], version=1, lifecycle='active', title=options['title'],
                          tags=[], keywords=[], content='', uncertainty='', contentOrigin='original_summary', sourceId=source['id'], sourceVersion=source['version'],
                          sourceLocator='待补充原文定位', evidenceType='modern_research' if source['documentType'] == 'research_paper' else source['documentType'],
                          review=dict(status='draft', checkedAt=None, scope='草稿，尚未核对', version=1),
                          professionalReview=dict(status='not_reviewed', reviewer=None, qualification=None, reviewedAt=None, note='未经专业审核')))
    else:
        item = next((entry for entry in all_items if entry['id'] == identifier), None)
        if item is None:
            raise ValueError('找不到 ID')
        is_card = 'domain' in item
        if command == 'revise':
            patch = read(Path(options['file']))
            protected = {'id', 'version', 'domain', 'lifecycle', 'review', 'verification', 'professionalReview'}
            if not isinstance(patch, dict) or not patch or set(patch) & protected:
                raise ValueError('修改补丁为空或含受保护字段，请使用专用命令')
            item.update(patch)
            if is_card:
                item['review'].update(status='draft', checkedAt=None, scope='内容已修改，待重新核对')
                item['professionalReview'] = dict(status='not_reviewed', reviewer=None, qualification=None, reviewedAt=None, note='内容修改，原专业审核不再沿用')
                source = next((source for source in sources if source['id'] == item['sourceId']), None)
                if source:
                    item['sourceVersion'] = source['version']
            else:
                item['verification'] = dict(status='unverified', checkedAt=None, note='来源已修改，待重新核对')
        elif command == 'archive':
            if item['lifecycle'] == 'archived':
                raise ValueError('已经归档')
            item['lifecycle'] = 'archived'
        elif command == 'verify-source':
            if is_card:
                raise ValueError('应指定来源 ID')
            item['verification'] = dict(status='source_checked', checkedAt=options['date'], note=options['note'])
        elif command == 'review-card':
            if not is_card or item['lifecycle'] != 'active':
                raise ValueError('应指定活动卡片')
            source = next(source for source in sources if source['id'] == item['sourceId'])
            if source['verification']['status'] != 'source_checked':
                raise ValueError('须先核对来源')
            item['sourceVersion'] = source['version']
            item['review'].update(status=options['decision'], checkedAt=options['date'], scope=options['note'])
        elif command == 'professional-review':
            if not is_card:
                raise ValueError('应指定卡片')
            item['professionalReview'] = dict(status=options['decision'], reviewer=options['reviewer'], qualification=options['qualification'], reviewedAt=options['date'], note=options['note'])
        item['version'] += 1
        if is_card:
            item['review']['version'] = item['version']
    validate(sources, cards, policy)
    # 单一源文件原子替换；正式快照不随编辑自动发布。
    if identifier.startswith('SRC-'):
        write(directory / 'sources.json', sources)
    else:
        domain = next(card['domain'] for card in cards if card['id'] == identifier)
        write(directory / f'{domain}.json', [card for card in cards if card['domain'] == domain])


def main():
    parser = argparse.ArgumentParser(description='MindBody 知识维护：不会访问健康数据')
    parser.add_argument('--root', type=Path, default=ROOT / 'knowledge', help='知识目录（测试请用临时目录）')
    subs = parser.add_subparsers(dest='command', required=True)
    for command in ('validate', 'build', 'check'):
        subs.add_parser(command)
    for command in ('draft', 'revise', 'archive', 'verify-source', 'review-card', 'professional-review', 'add-source'):
        sub = subs.add_parser(command)
        if command != 'add-source':
            sub.add_argument('--id', required=True)
        if command in ('revise', 'add-source'):
            sub.add_argument('--file', required=True)
        if command == 'draft':
            sub.add_argument('--domain', choices=DOMAINS, required=True)
            sub.add_argument('--source-id', required=True)
            sub.add_argument('--title', required=True)
        if command in ('verify-source', 'review-card', 'professional-review'):
            sub.add_argument('--date', required=True, help='实际核对日期 YYYY-MM-DD')
            sub.add_argument('--note', required=True)
        if command == 'review-card':
            sub.add_argument('--decision', choices=['source_checked', 'rejected'], required=True)
        if command == 'professional-review':
            sub.add_argument('--decision', choices=['approved', 'rejected'], required=True)
            sub.add_argument('--reviewer', required=True)
            sub.add_argument('--qualification', required=True)
    args = vars(parser.parse_args())
    directory, command = args.pop('root'), args.pop('command')
    try:
        if command in ('build', 'check'):
            project = ROOT if directory.resolve() == (ROOT / 'knowledge').resolve() else directory.resolve().parent
            result = build(directory, project=project, check=command == 'check')
            print(f'{command} 通过：正式卡片 {len(result["cards"])}，哈希 {result["knowledgeHash"][:12]}')
        elif command == 'validate':
            sources, cards, policy = load(directory)
            check_versions(read(directory / 'manifest.json'), manifest(sources, cards, policy))
            print(f'校验通过：来源 {len(sources)}，卡片 {len(cards)}')
        else:
            edit(directory, command, args.pop('id', None), **args)
            print('编辑完成；正式快照未变。审核后执行 build，并重载前端/重启 API。')
        sources, cards, policy = load(directory)
        for warning in validate(sources, cards, policy):
            print('授权提示：' + warning)
    except (ValueError, KeyError, OSError) as error:
        print('知识操作失败：' + str(error), file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
