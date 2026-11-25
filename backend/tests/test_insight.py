import copy
import json
import subprocess
import unittest
from datetime import date, timedelta
from pathlib import Path
from unittest.mock import patch

import httpx
from fastapi.testclient import TestClient
from pydantic import ValidationError

from backend.app import app
from backend.engine import Settings, call_model, generate, retrieve, CARDS
from backend.models import InsightRequest, ModelSelection


def fixture(samples=None, today='2026-11-19'):
    if samples is None:
        samples = [('2026-11-19', {'sleepHours': 0})]
    end = date.fromisoformat(today)
    entries = [{'date': day, 'values': dict(mood=None, stress=None, energy=None, sleepHours=None) | values} for day, values in samples]
    entries.sort(key=lambda entry: entry['date'])
    summary = {}
    for key in ['mood', 'stress', 'energy', 'sleepHours']:
        values = [entry['values'][key] for entry in entries if entry['values'][key] is not None]
        summary[key] = dict(count=len(values), average=sum(values) / len(values) if values else None,
                            first=values[0] if values else None, last=values[-1] if values else None,
                            change=values[-1] - values[0] if len(values) >= 2 else None)
    context = dict(schemaVersion=1, date=today, today=next((entry['values'] for entry in entries if entry['date'] == today), None),
                   samples=entries, window=dict(startDate=str(end - timedelta(days=6)), endDate=today, days=7, recordCount=len(entries), metrics=summary))
    return dict(context=context, mode='combined', serviceMode='mock', question='',
                consent=dict(granted=True, scope='daily-summary-and-question-v1', providerHost=None, model=None))


class InsightTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.off = Settings(False, '', '', '')
        self.on = Settings(True, 'synthetic-test-key', 'https://model.example.test/v1', 'test-model')

    def test_typescript_context_python_api_typescript_response_contract(self):
        root = Path(__file__).resolve().parents[2]
        bridge = str(root / 'backend/tests/contract_bridge.cjs')
        requests = json.loads(subprocess.run(['node', bridge, 'build'], cwd=root,
                              capture_output=True, text=True, encoding='utf-8', check=True).stdout)
        pairs = []
        with patch('backend.app.Settings.load', return_value=self.off):
            for request in requests:
                response = self.client.post('/api/insight', json=request)
                self.assertEqual(response.status_code, 200)
                pairs.append(dict(request=request, response=response.json()))
        result = subprocess.run(['node', bridge, 'verify'], cwd=root, input=json.dumps(pairs),
                                capture_output=True, text=True, encoding='utf-8', check=True)
        self.assertEqual(result.stdout, 'contract verified')

    def test_mock_zero_and_missing_remain_distinct_and_response_has_two_domains(self):
        result = self.client.post('/api/insight', json=fixture())
        self.assertEqual(result.status_code, 200)
        body = result.json()
        self.assertEqual(body['status'], 'mock')
        self.assertEqual({view['domain'] for view in body['perspectives']}, {'psychology', 'tcm'})
        self.assertTrue(all(view['citationIds'] for view in body['perspectives']))
        self.assertNotRegex(body['reply'], r'\d')
        self.assertEqual(result.headers['cache-control'], 'no-store')

    def test_missing_today_and_empty_do_not_generate_explanation(self):
        for samples in [[], [('2026-11-18', {'mood': 2})]]:
            result = self.client.post('/api/insight', json=fixture(samples)).json()
            self.assertEqual(result['status'], 'empty')
            self.assertEqual(result['perspectives'], [])

    def test_note_only_summary_is_valid_but_no_keyword_match_is_honest(self):
        request = InsightRequest.model_validate(fixture([('2026-11-19', {})]))
        result = generate(request, self.off)
        self.assertEqual(result.status, 'fallback')
        self.assertTrue(all(not view.citationIds for view in result.perspectives))

    def test_multiple_days_cross_year_verified_and_tampering_rejected(self):
        payload = fixture([('2026-12-31', {'sleepHours': 8, 'energy': 1}), ('2027-01-02', {'sleepHours': 0})], '2027-01-02')
        model = InsightRequest.model_validate(payload)
        self.assertEqual(model.context.window.metrics['sleepHours'].average, 4)
        self.assertIsNone(model.context.window.metrics['energy'].change)
        for alter in [lambda item: item['context']['window']['metrics']['sleepHours'].update(average=8),
                      lambda item: item['context']['today'].update(sleepHours=5),
                      lambda item: item['context']['samples'].append(item['context']['samples'][0]),
                      lambda item: item['context'].update(bodyNote='synthetic private note')]:
            invalid = copy.deepcopy(payload); alter(invalid)
            self.assertEqual(self.client.post('/api/insight', json=invalid).status_code, 422)

    def test_no_consent_or_false_never_reaches_engine_or_model(self):
        for value in [False, None, 1, 'true']:
            payload = fixture(); payload['consent']['granted'] = value
            with patch('backend.app.generate') as engine:
                response = self.client.post('/api/insight', json=payload)
                self.assertEqual(response.status_code, 422)
                engine.assert_not_called()
        payload = fixture(); del payload['consent']
        self.assertEqual(self.client.post('/api/insight', json=payload).status_code, 422)

    def test_invalid_inputs_do_not_echo_health_content(self):
        payload = fixture(); payload['context']['bodyNote'] = 'synthetic-secret-content'
        response = self.client.post('/api/insight', json=payload)
        self.assertNotIn('synthetic-secret-content', response.text)
        for value in [True, '3', 6, -1, 2.5]:
            payload = fixture(); payload['context']['today']['mood'] = value
            self.assertEqual(self.client.post('/api/insight', json=payload).status_code, 422)

    def test_domains_retrieval_and_empty_results(self):
        for domain in ['psychology', 'tcm']:
            payload = fixture(); payload['mode'] = domain
            request = InsightRequest.model_validate(payload)
            self.assertTrue(all(card['domain'] == domain for card in retrieve(request)))
            result = generate(request, self.off, cards=[])
            self.assertEqual(result.status, 'fallback')
            self.assertEqual(len(result.perspectives), 1)
            self.assertEqual(result.perspectives[0].citationIds, [])

    def test_dangerous_or_medical_requests_block_before_external_call(self):
        for question in ['我想自杀', '给我开方和药量', '帮我做PHQ9分数', '胸痛并呼吸困难', 'diagnose me']:
            payload = self.llm_payload(); payload['question'] = question
            with patch('backend.engine.call_model') as model:
                result = generate(InsightRequest.model_validate(payload), self.on)
                self.assertEqual(result.status, 'blocked')
                self.assertIn('紧急', result.help)
                model.assert_not_called()

    def llm_payload(self):
        payload = fixture(); payload['serviceMode'] = 'llm'
        payload['consent'].update(providerHost=self.on.host, model=self.on.model)
        return payload

    def test_real_adapter_selects_only_checked_candidates(self):
        request = InsightRequest.model_validate(self.llm_payload())
        candidates = retrieve(request)
        selection = dict(psychologyCitationId=next(card['id'] for card in candidates if card['domain'] == 'psychology'),
                         tcmCitationId=next(card['id'] for card in candidates if card['domain'] == 'tcm'), reflectionId='context')
        result = generate(request, self.on, model_call=lambda *args: selection)
        self.assertEqual(result.status, 'llm')
        self.assertEqual(result.perspectives[0].text, next(card['content'] for card in candidates if card['id'] == selection['psychologyCitationId']))

    def test_unknown_reference_wrong_domain_dangerous_extra_text_and_model_failures_fallback(self):
        request = InsightRequest.model_validate(self.llm_payload())
        for output in [dict(psychologyCitationId='FAKE', tcmCitationId=None, reflectionId='notice'),
                       dict(psychologyCitationId='TCM-DAILY-01', tcmCitationId=None, reflectionId='notice'),
                       dict(psychologyCitationId=None, tcmCitationId=None, reflectionId='notice', diagnosis='危险诊断和处方'),
                       dict(psychologyCitationId=None, tcmCitationId=None, reflectionId='你患有疾病'),
                       'not json']:
            result = generate(request, self.on, model_call=lambda *args: output)
            self.assertEqual(result.status, 'fallback')
            self.assertNotIn('危险诊断', result.model_dump_json())
        def failure(*args): raise httpx.TimeoutException('synthetic provider failure')
        self.assertEqual(generate(request, self.on, model_call=failure).status, 'fallback')

    def test_disabled_or_changed_provider_does_not_call_llm(self):
        request = InsightRequest.model_validate(self.llm_payload())
        with patch('backend.engine.call_model') as model:
            self.assertEqual(generate(request, self.off).status, 'fallback')
            with self.assertRaises(PermissionError):
                generate(request, Settings(True, 'test', 'https://changed.example.test/v1', 'test-model'))
            model.assert_not_called()

    def test_schema_request_is_used_by_real_http_adapter_without_actual_network(self):
        request = InsightRequest.model_validate(self.llm_payload())
        content = dict(psychologyCitationId='PSY-SLEEP-01', tcmCitationId='TCM-DAILY-01', reflectionId='rest')
        response = httpx.Response(200, request=httpx.Request('POST', 'https://model.example.test/v1/chat/completions'),
                                  json={'choices': [{'message': {'content': json.dumps(content)}}]})
        with patch('backend.engine.httpx.Client') as client:
            client.return_value.__enter__.return_value.post.return_value = response
            result = call_model(request, retrieve(request), self.on)
            self.assertEqual(result.reflectionId, 'rest')
            kwargs = client.return_value.__enter__.return_value.post.call_args.kwargs
            self.assertEqual(kwargs['json']['response_format']['type'], 'json_schema')
            self.assertFalse(kwargs['json']['response_format']['json_schema']['schema']['additionalProperties'])
            self.assertNotIn('bodyNote', json.dumps(kwargs['json']))

    def test_local_origin_configuration_and_payload_limits(self):
        info = self.client.get('/api/insight/info').json()
        self.assertFalse(info['storesHealthData'])
        self.assertNotIn('api_key', info)
        self.assertEqual(self.client.post('/api/insight', json=fixture(), headers={'origin': 'https://evil.example'}).status_code, 403)
        self.assertEqual(self.client.post('/api/insight', content='x' * 25000, headers={'content-type': 'application/json'}).status_code, 413)
        self.assertEqual(self.client.post('/api/insight', content='x', headers={'content-type': 'text/plain'}).status_code, 415)
        self.assertIn('reflectionId', self.client.get('/api/insight/schema').json()['required'])


if __name__ == '__main__':
    unittest.main()
