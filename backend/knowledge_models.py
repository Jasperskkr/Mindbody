"""知识编辑契约；不读取健康记录。来源核对不等于专业审核。"""
from datetime import date
from typing import Annotated, Literal

from pydantic import Field, model_validator

from .models import StrictModel

Domain = Literal['psychology', 'tcm']


class Verification(StrictModel):
    status: Literal['unverified', 'source_checked']
    checkedAt: date | None
    note: str = Field(min_length=1)

    @model_validator(mode='after')
    def checked_date(self):
        if self.status == 'source_checked' and self.checkedAt is None:
            raise ValueError('来源核对必须有日期')
        return self


class Authorization(StrictModel):
    status: Literal['unknown', 'permitted', 'restricted']
    license: str | None
    allowedUses: list[Literal['metadata', 'original_summary', 'excerpt', 'full_text']]
    note: str = Field(min_length=1)

    @model_validator(mode='after')
    def no_assumed_copy_right(self):
        if self.status != 'permitted' and set(self.allowedUses) & {'excerpt', 'full_text'}:
            raise ValueError('授权未知或受限时不得允许摘录/全文复制')
        if self.status == 'permitted' and not self.license:
            raise ValueError('已授权来源必须说明授权依据')
        return self


class SourceDocument(StrictModel):
    id: str = Field(pattern=r'^SRC-[A-Z0-9-]+$')
    version: int = Field(strict=True, ge=1)
    title: str = Field(min_length=1)
    publisher: str = Field(min_length=1)
    url: str = Field(pattern=r'^https://[^\s]+$')
    domains: list[Domain] = Field(min_length=1)
    documentType: Literal['public_health_guidance', 'traditional_text', 'terminology_standard', 'research_paper']
    lifecycle: Literal['active', 'archived']
    verification: Verification
    authorization: Authorization


class CardReview(StrictModel):
    status: Literal['draft', 'source_checked', 'rejected']
    checkedAt: date | None
    scope: str = Field(min_length=1)
    version: int = Field(strict=True, ge=1)


class ProfessionalReview(StrictModel):
    status: Literal['not_reviewed', 'approved', 'rejected']
    reviewer: str | None
    qualification: str | None
    reviewedAt: date | None
    note: str = Field(min_length=1)

    @model_validator(mode='after')
    def reviewer_required(self):
        if self.status != 'not_reviewed' and not all([self.reviewer, self.qualification, self.reviewedAt]):
            raise ValueError('专业审核须记录审核人、资质和日期')
        return self


class KnowledgeCard(StrictModel):
    id: str = Field(pattern=r'^(PSY|TCM)-[A-Z0-9-]+$')
    domain: Domain
    version: int = Field(strict=True, ge=1)
    lifecycle: Literal['active', 'archived']
    title: str = Field(min_length=1)
    tags: list[Literal['mood', 'stress', 'energy', 'sleepHours']]
    keywords: list[str]
    content: str
    uncertainty: str
    evidenceType: Literal['public_health_guidance', 'terminology_standard', 'traditional_text', 'modern_research']
    contentOrigin: Literal['original_summary', 'licensed_excerpt']
    sourceId: str
    sourceVersion: int = Field(strict=True, ge=1)
    sourceLocator: str = Field(min_length=1)
    review: CardReview
    professionalReview: ProfessionalReview

    @model_validator(mode='after')
    def coherent_review(self):
        if not self.id.startswith('PSY-' if self.domain == 'psychology' else 'TCM-'):
            raise ValueError('卡片 ID 与知识域不一致')
        if len(set(self.tags)) != len(self.tags) or len(set(self.keywords)) != len(self.keywords):
            raise ValueError('标签或关键词重复')
        if any(not word.strip() for word in self.keywords):
            raise ValueError('关键词不能为空')
        if self.review.version != self.version:
            raise ValueError('审核版本须与卡片版本一致')
        if self.review.status == 'source_checked' and (not self.content.strip() or not self.uncertainty.strip() or self.review.checkedAt is None):
            raise ValueError('已核对卡片必须有正文、局限和核对日期')
        return self


class KnowledgeChunk(StrictModel):
    """V0.7 仅定义结构；禁止自动导入未知授权全文或自动创建向量。"""
    id: str
    domain: Domain
    sourceId: str
    sourceVersion: int = Field(strict=True, ge=1)
    cardIds: list[str]
    version: int = Field(strict=True, ge=1)
    locator: str
    text: str
    contentHash: str = Field(pattern=r'^[0-9a-f]{64}$')
    lifecycle: Literal['draft', 'active', 'archived']
    embeddingModel: str | None = None


class RetrievalPolicy(StrictModel):
    version: int = Field(strict=True, ge=1)
    topK: dict[Domain, Annotated[int, Field(strict=True, ge=1, le=10)]]
    # 中立评分表达式的操作符由编译器白名单校验，不执行任意代码。
    score: dict

    @model_validator(mode='after')
    def domain_limits(self):
        if set(self.topK) != {'psychology', 'tcm'} or any(type(n) is not int or not 1 <= n <= 10 for n in self.topK.values()):
            raise ValueError('每个知识域的 Top-K 必须为 1–10 整数')
        return self
