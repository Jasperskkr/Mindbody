from datetime import date, timedelta
from math import isclose
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

Domain = Literal['psychology', 'tcm']
Mode = Literal['psychology', 'tcm', 'combined']


class StrictModel(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)


class Metrics(StrictModel):
    mood: int | None = Field(ge=1, le=5)
    stress: int | None = Field(ge=1, le=5)
    energy: int | None = Field(ge=1, le=5)
    sleepHours: float | None = Field(ge=0, le=24)

    @model_validator(mode='before')
    @classmethod
    def strict_numbers(cls, value):
        if not isinstance(value, dict):
            raise ValueError('指标必须是对象')
        for key, item in value.items():
            if item is not None and (isinstance(item, bool) or not isinstance(item, (int, float))):
                raise ValueError('指标必须为数值或 null')
        # 仅填写身体备注的记录可存在：摘要四项均为 null，备注仍留在浏览器。
        return value


class Sample(StrictModel):
    date: date
    values: Metrics


class Summary(StrictModel):
    count: int = Field(ge=0, le=7)
    average: float | None
    first: float | None
    last: float | None
    change: float | None


class Window(StrictModel):
    startDate: date
    endDate: date
    days: Literal[7]
    recordCount: int = Field(ge=0, le=7)
    metrics: dict[str, Summary]


class DailyContext(StrictModel):
    schemaVersion: Literal[1]
    date: date
    today: Metrics | None
    samples: list[Sample] = Field(max_length=7)
    window: Window

    @model_validator(mode='after')
    def validate_facts(self):
        start = self.date - timedelta(days=6)
        if self.window.startDate != start or self.window.endDate != self.date:
            raise ValueError('日期窗口不一致')
        dates = [sample.date for sample in self.samples]
        if dates != sorted(set(dates)) or any(not start <= day <= self.date for day in dates):
            raise ValueError('样本日期重复、无序或超出窗口')
        actual_today = next((item.values for item in self.samples if item.date == self.date), None)
        if self.today != actual_today or self.window.recordCount != len(self.samples):
            raise ValueError('今日或记录数不一致')
        if set(self.window.metrics) != set(Metrics.model_fields):
            raise ValueError('统计指标不完整')
        # 再次用纯数值运算核对客户端事实；模型不能改写这些数字。
        for metric in Metrics.model_fields:
            values = [getattr(item.values, metric) for item in self.samples if getattr(item.values, metric) is not None]
            expected = dict(count=len(values), average=sum(values) / len(values) if values else None,
                            first=values[0] if values else None, last=values[-1] if values else None,
                            change=values[-1] - values[0] if len(values) >= 2 else None)
            for key, value in expected.items():
                actual = getattr(self.window.metrics[metric], key)
                if (value is None) != (actual is None) or (value is not None and not isclose(value, actual, abs_tol=1e-9)):
                    raise ValueError('程序统计不一致')
        return self


class Consent(StrictModel):
    granted: Literal[True]
    scope: Literal['daily-summary-and-question-v1']
    providerHost: str | None = Field(max_length=200)
    model: str | None = Field(max_length=100)

    @model_validator(mode='before')
    @classmethod
    def explicit_boolean(cls, value):
        if not isinstance(value, dict) or value.get('granted') is not True:
            raise ValueError('必须明确授权')
        return value


class InsightRequest(StrictModel):
    knowledgeHash: str | None = Field(default=None, pattern=r'^[0-9a-f]{64}$')
    context: DailyContext
    mode: Mode
    serviceMode: Literal['mock', 'llm']
    question: str = Field(max_length=300)
    consent: Consent


class Perspective(StrictModel):
    domain: Domain
    title: str
    text: str
    citationIds: list[str]
    uncertainty: str


class DailyInsight(StrictModel):
    schemaVersion: Literal[1] = 1
    date: date
    status: Literal['mock', 'llm', 'fallback', 'blocked', 'empty']
    perspectives: list[Perspective]
    reply: str
    notice: str
    help: str | None = None
    knowledgeHash: str | None = None


class ModelSelection(StrictModel):
    """模型只能选择候选卡与反思句 ID，不能生成诊断、数字或自由健康建议。"""
    psychologyCitationId: str | None
    tcmCitationId: str | None
    reflectionId: Literal['notice', 'context', 'rest']
