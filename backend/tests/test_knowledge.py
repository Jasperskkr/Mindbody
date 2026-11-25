import copy
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from backend.app import app
from backend.engine import retrieve, generate, Settings
from backend.knowledge import KNOWLEDGE_HASH
from backend.knowledge_models import KnowledgeChunk
from backend.models import InsightRequest
from scripts.knowledge import ROOT, load, read, write, edit, build, validate, bundle, generated_code
from test_insight import fixture


class KnowledgeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.project = Path(self.temp.name)
        self.directory = self.project / 'knowledge'
        shutil.copytree(ROOT / 'knowledge', self.directory)
        build(self.directory, self.project)

    def test_existing_stable_ids_source_links_and_distinct_review(self):
        sources, cards, policy = load(self.directory)
        self.assertEqual({card['id'] for card in cards}, {'PSY-SELFCARE-01', 'PSY-SLEEP-01', 'TCM-DAILY-01', 'TCM-FRAME-01'})
        self.assertEqual(len(sources), 3)
        self.assertTrue(all(card['professionalReview']['status'] == 'not_reviewed' for card in cards))
        self.assertEqual(len(validate(sources, cards, policy)), 3)  # 全文授权未知，明确提示。
        self.assertEqual(len(build(self.directory, self.project, check=True)['cards']), 4)

    def test_duplicate_broken_source_domain_and_missing_authorization_rejected(self):
        sources, cards, policy = load(self.directory)
        for alter in [lambda s, c: c.append(copy.deepcopy(c[0])),
                      lambda s, c: c[0].update(sourceId='SRC-MISSING'),
                      lambda s, c: c[0].update(sourceId='SRC-SUWEN-01'),
                      lambda s, c: s[0].pop('authorization'),
                      lambda s, c: s[0]['authorization'].update(allowedUses=['full_text']),
                      lambda s, c: c[0].update(evidenceType='modern_research')]:
            s, c = copy.deepcopy(sources), copy.deepcopy(cards)
            alter(s, c)
            with self.assertRaises(ValueError):
                validate(s, c, policy)

    def test_draft_revise_review_publish_archive_full_flow_without_old_index(self):
        edit(self.directory, 'draft', 'PSY-SYNTHETIC-01', domain='psychology', source_id='SRC-NIMH-SELFCARE', title='虚构检索测试卡')
        self.assertEqual(len(build(self.directory, self.project)['cards']), 4)
        patch_file = self.project / 'patch.json'
        write(patch_file, {'content': '虚构教育测试文案，不作为健康建议。', 'uncertainty': '仅供软件测试。', 'tags': ['mood'], 'keywords': ['虚构检索']})
        edit(self.directory, 'revise', 'PSY-SYNTHETIC-01', file=patch_file)
        cards = load(self.directory)[1]
        draft = next(c for c in cards if c['id'] == 'PSY-SYNTHETIC-01')
        self.assertEqual((draft['version'], draft['review']['status']), (2, 'draft'))
        edit(self.directory, 'review-card', draft['id'], decision='source_checked', date='2026-11-25', note='虚构测试，只核对结构')
        published = build(self.directory, self.project)
        self.assertEqual(len(published['cards']), 5)
        request = InsightRequest.model_validate(fixture([('2026-11-19', {'mood': 4})]))
        request.question = '虚构检索'
        self.assertEqual(retrieve(request, published['cards'])[0]['id'], draft['id'])
        edit(self.directory, 'revise', draft['id'], file=patch_file)
        updated = build(self.directory, self.project)
        self.assertNotEqual(updated['knowledgeHash'], published['knowledgeHash'])
        self.assertNotIn(draft['id'], {c['id'] for c in updated['cards']})
        edit(self.directory, 'review-card', draft['id'], decision='rejected', date='2026-11-25', note='虚构拒绝测试')
        self.assertEqual(len(build(self.directory, self.project)['cards']), 4)
        edit(self.directory, 'archive', draft['id'])
        self.assertEqual(len(build(self.directory, self.project)['cards']), 4)
        with self.assertRaises(ValueError):
            edit(self.directory, 'draft', draft['id'], domain='psychology', source_id='SRC-NIMH-SELFCARE', title='重复 ID')
        saved = read(self.directory / 'generated.json')
        self.assertNotIn('虚构教育测试文案', json.dumps(saved, ensure_ascii=False))

    def test_source_revision_requires_reverification_and_card_rebinding(self):
        patch_file = self.project / 'source-patch.json'
        write(patch_file, {'title': '虚构来源题名变更测试'})
        edit(self.directory, 'revise', 'SRC-NIMH-SELFCARE', file=patch_file)
        self.assertEqual(len(build(self.directory, self.project)['cards']), 2)
        edit(self.directory, 'verify-source', 'SRC-NIMH-SELFCARE', date='2026-11-25', note='虚构核对测试')
        self.assertEqual(len(build(self.directory, self.project)['cards']), 2)
        edit(self.directory, 'review-card', 'PSY-SLEEP-01', decision='source_checked', date='2026-11-25', note='虚构重绑定测试')
        self.assertEqual(len(build(self.directory, self.project)['cards']), 3)
        edit(self.directory, 'archive', 'SRC-NIMH-SELFCARE')
        self.assertEqual(len(build(self.directory, self.project)['cards']), 2)

    def test_professional_rejection_and_authorization_gate(self):
        edit(self.directory, 'professional-review', 'PSY-SLEEP-01', decision='rejected', reviewer='虚构测试审核人', qualification='仅为测试字段，无真实资质', date='2026-11-25', note='虚构拒绝测试')
        self.assertEqual(len(build(self.directory, self.project)['cards']), 3)
        sources, cards, policy = load(self.directory)
        cards[0]['contentOrigin'] = 'licensed_excerpt'
        self.assertNotIn(cards[0]['id'], {c['id'] for c in bundle(sources, cards, policy)['cards']})
        sources[0]['authorization'].update(status='permitted', license='虚构测试许可', allowedUses=['metadata', 'excerpt'])
        self.assertIn(cards[0]['id'], {c['id'] for c in bundle(sources, cards, policy)['cards']})

    def test_manual_changes_require_version_and_generated_outputs_must_match(self):
        path = self.directory / 'psychology.json'
        cards = read(path)
        cards[0]['content'] = '虚构未经版本更新的修改'
        write(path, cards)
        before = (self.directory / 'generated.json').read_bytes()
        with self.assertRaisesRegex(ValueError, '版本'):
            build(self.directory, self.project)
        self.assertEqual(before, (self.directory / 'generated.json').read_bytes())
        shutil.copyfile(ROOT / 'knowledge/psychology.json', path)
        (self.project / 'backend/generated_ranking.py').write_text('# stale', encoding='utf-8')
        with self.assertRaisesRegex(ValueError, '过期'):
            build(self.directory, self.project, check=True)
        build(self.directory, self.project)
        self.assertEqual(len(build(self.directory, self.project, check=True)['cards']), 4)
        (self.directory / 'manifest.json').unlink()
        with self.assertRaisesRegex(ValueError, '缺少 manifest'):
            build(self.directory, self.project)

    def test_no_physical_removal_wrong_file_domain_or_unsafe_policy(self):
        path = self.directory / 'psychology.json'
        cards = read(path)
        write(path, cards[1:])
        with self.assertRaisesRegex(ValueError, '归档'):
            build(self.directory, self.project)
        cards[0]['domain'] = 'tcm'
        write(path, cards)
        with self.assertRaisesRegex(ValueError, '知识域'):
            load(self.directory)
        sources, cards, policy = load(ROOT / 'knowledge')
        policy['score'] = {'op': '__import__', 'value': 'malicious'}
        with self.assertRaises(ValueError):
            generated_code(policy)
        sources, cards, policy = load(ROOT / 'knowledge')
        for invalid in [True, '2', 0, 11]:
            changed = copy.deepcopy(policy)
            changed['topK']['psychology'] = invalid
            with self.assertRaises(ValueError):
                validate(sources, cards, changed)

    def test_cross_language_per_domain_ranking_with_large_synthetic_corpus(self):
        snapshot = build(self.directory, self.project)
        psy = next(c for c in snapshot['cards'] if c['domain'] == 'psychology')
        cards = snapshot['cards'] + [copy.deepcopy(psy) | {'id': f'PSY-FAKE-{n:03}', 'keywords': ['测试'] * 1} for n in range(50)]
        cards += [copy.deepcopy(psy) | {'id': 'PSY-ARCHIVED-01', 'lifecycle': 'archived'},
                  copy.deepcopy(psy) | {'id': 'PSY-DRAFT-01', 'review': psy['review'] | {'status': 'draft'}}]
        cases = []
        for mode in ['combined', 'psychology', 'tcm']:
            for top in [1, 3]:
                for question in ['', '测试', '睡眠休息', '不相关词']:
                    payload = fixture([('2026-11-19', {'mood': 4})])
                    payload.update(mode=mode, question=question)
                    request = InsightRequest.model_validate(payload)
                    limits = dict(psychology=top, tcm=top)
                    ids = [card['id'] for card in retrieve(request, cards, limits)]
                    if mode == 'combined':
                        self.assertTrue(any(identifier.startswith('TCM-') for identifier in ids))
                    self.assertNotIn('PSY-ARCHIVED-01', ids)
                    self.assertNotIn('PSY-DRAFT-01', ids)
                    cases.append(dict(context=payload['context'], mode=mode, question=question, cards=cards, topK=limits, expected=ids))
        response = subprocess.run(['node', 'backend/tests/knowledge_bridge.cjs'], cwd=ROOT,
                                  input=json.dumps(cases), capture_output=True, text=True, encoding='utf-8', check=True)
        self.assertEqual(response.stdout, '24 ranking cases verified')

    def test_version_mismatch_never_calls_model_and_stale_service_is_unavailable(self):
        payload = fixture()
        payload['knowledgeHash'] = '0' * 64
        client = TestClient(app)
        with patch('backend.engine.call_model') as model:
            self.assertEqual(client.post('/api/insight', json=payload).status_code, 409)
            model.assert_not_called()
        payload['knowledgeHash'] = KNOWLEDGE_HASH
        self.assertEqual(client.post('/api/insight', json=payload).json()['knowledgeHash'], KNOWLEDGE_HASH)
        with patch('backend.app.ensure_current', side_effect=ValueError('synthetic changed snapshot')):
            response = client.get('/api/insight/info', headers={'origin': 'http://localhost:5175'})
            self.assertEqual(response.status_code, 503)
            self.assertEqual(response.headers['access-control-allow-origin'], 'http://localhost:5175')
            with patch('backend.app.generate') as engine:
                self.assertEqual(client.post('/api/insight', json=payload).status_code, 503)
                engine.assert_not_called()

    def test_cli_commands_operate_only_in_temporary_knowledge_directory(self):
        result = subprocess.run([__import__('sys').executable, '-X', 'utf8', str(ROOT / 'scripts/knowledge.py'),
                                 '--root', str(self.directory), 'draft', '--id', 'TCM-CLI-01', '--domain', 'tcm',
                                 '--source-id', 'SRC-SUWEN-01', '--title', '虚构 CLI 测试'], cwd=ROOT, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr.decode('utf-8'))
        self.assertEqual(len(load(self.directory)[1]), 5)
        self.assertEqual(len(read(self.directory / 'generated.json')['cards']), 4)
        real_code = (ROOT / 'backend/generated_ranking.py').read_bytes()
        result = subprocess.run([__import__('sys').executable, '-X', 'utf8', str(ROOT / 'scripts/knowledge.py'),
                                 '--root', str(self.directory), 'build'], cwd=ROOT, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr.decode('utf-8'))
        self.assertEqual(real_code, (ROOT / 'backend/generated_ranking.py').read_bytes())

    def test_chunk_schema_is_defined_without_creating_or_embedding_content(self):
        chunk = KnowledgeChunk(id='CHUNK-TEST', domain='psychology', sourceId='SRC-SYNTHETIC', sourceVersion=1,
                               cardIds=['PSY-SYNTHETIC-01'], version=1, locator='虚构定位', text='虚构内容',
                               contentHash='a' * 64, lifecycle='draft')
        self.assertIsNone(chunk.embeddingModel)

    def test_add_source_is_unverified_and_does_not_implicitly_allow_full_text(self):
        source = copy.deepcopy(load(self.directory)[0][0])
        source.update(id='SRC-SYNTHETIC-NEW', title='虚构新增来源', documentType='research_paper')
        path = self.project / 'source-input.json'
        write(path, source)
        edit(self.directory, 'add-source', None, file=path)
        added = next(s for s in load(self.directory)[0] if s['id'] == source['id'])
        self.assertEqual(added['verification']['status'], 'unverified')
        self.assertNotIn('full_text', added['authorization']['allowedUses'])
        edit(self.directory, 'draft', 'PSY-RESEARCH-01', domain='psychology', source_id=source['id'], title='虚构研究草稿')
        card = next(c for c in load(self.directory)[1] if c['id'] == 'PSY-RESEARCH-01')
        self.assertEqual(card['evidenceType'], 'modern_research')
        self.assertEqual(len(build(self.directory, self.project)['cards']), 4)
