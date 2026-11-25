from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware

from .engine import Settings, generate
from .models import DailyInsight, InsightRequest, ModelSelection

app = FastAPI(title='MindBody 本机洞察 API', version='0.6.0')
app.add_middleware(CORSMiddleware, allow_origin_regex=r'https?://(localhost|127\.0\.0\.1):\d+',
                   allow_methods=['GET', 'POST'], allow_headers=['Content-Type'], allow_credentials=False)


@app.middleware('http')
async def protect_request(request: Request, call_next):
    origin = request.headers.get('origin')
    import re
    if origin and not re.fullmatch(r'https?://(localhost|127\.0\.0\.1):\d+', origin):
        return JSONResponse({'detail': '仅允许本机页面访问'}, status_code=403)
    if request.method == 'POST':
        body = await request.body()
        if len(body) > 24_000:
            return JSONResponse({'detail': '请求过大'}, status_code=413)
        if not request.headers.get('content-type', '').startswith('application/json'):
            return JSONResponse({'detail': '需要 JSON 请求'}, status_code=415)
    response = await call_next(request)
    response.headers['Cache-Control'] = 'no-store'
    return response


@app.exception_handler(RequestValidationError)
async def invalid_request(request, exc):
    # 默认校验错误会回显输入；这里刻意不把健康内容发回或写进日志。
    return JSONResponse({'detail': '请求格式、统计摘要或授权不正确，请重新读取并授权。'}, status_code=422)


@app.get('/api/insight/info')
def service_info():
    settings = Settings.load()
    return {'schemaVersion': 1, 'defaultMode': 'mock', 'llmEnabled': settings.available,
            'providerHost': settings.host, 'model': settings.model if settings.available else None, 'storesHealthData': False}


@app.get('/api/insight/schema')
def model_schema():
    return ModelSelection.model_json_schema()


@app.post('/api/insight', response_model=DailyInsight)
def insight(request: InsightRequest):
    try:
        return generate(request, Settings.load())
    except PermissionError:
        return JSONResponse({'detail': '模型目的地或型号已变化，请重新授权。'}, status_code=409)
