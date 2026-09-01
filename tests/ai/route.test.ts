import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { POST } from '@/app/api/analyze/route';

/** 捕获 streamAnalyzeEvents 实参 messages，断言意向确实到达 prompt 层（不 import 其内部实现）。 */
const 捕获 = {
  送出messages: [] as Array<Array<{ role: string; content: string }>>,
};

const ENV_KEYS = ['LLM_API_BASE_URL', 'LLM_API_KEY', 'LLM_MODEL'] as const;
const savedEnv: Array<[string, string | undefined]> = [];

const originalFetch = globalThis.fetch;
const sseEncoder = new TextEncoder();

beforeAll(() => {
  globalThis.fetch = (async (
    _input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ) => {
    try {
      if (init?.body) {
        const parsed = JSON.parse(String(init.body));
        if (parsed.messages) {
          捕获.送出messages.push(parsed.messages);
        }
      }
    } catch {}
    const stream = new ReadableStream({
      start(controller) {
        const chunk = {
          id: 'chatcmpl-test',
          object: 'chat.completion.chunk',
          created: Date.now(),
          model: 'test-model',
          choices: [{ index: 0, delta: { content: '综解测试正文' }, finish_reason: null }],
        };
        controller.enqueue(sseEncoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
        controller.enqueue(sseEncoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });
    return new Response(stream, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream; charset=utf-8' },
    });
  }) as typeof fetch;

  for (const key of ENV_KEYS) {
    savedEnv.push([key, process.env[key]]);
    delete process.env[key]; // 503 路径要求 env 缺失
  }
});

afterAll(() => {
  globalThis.fetch = originalFetch;
  for (const [key, value] of savedEnv) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function post(body: BodyInit): Promise<Response> {
  return POST(
    new Request('http://localhost/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }, // route 只认 JSON（sec-m5 MEDIUM-3）
      body,
    }),
  );
}

const validChartBody = JSON.stringify({
  bazi: { 日主: '甲' },
  xiyongshen: { 强弱等级: '中和' },
  candidates: [],
});

describe('POST /api/analyze 错误路径', () => {
  it('请求体超 1MB → 413 中文 JSON', async () => {
    const huge = JSON.stringify({ padding: 'x'.repeat(1024 * 1024 + 16) });
    const res = await post(huge);
    expect(res.status).toBe(413);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain('请求体过大');
  });

  it('Content-Type 非 JSON → 415（text/plain 跨站盲打面已关）', async () => {
    const res = await POST(
      new Request('http://localhost/api/analyze', { method: 'POST', body: validChartBody }), // 默认 text/plain
    );
    expect(res.status).toBe(415);
    expect((await res.json()).error).toContain('application/json');
  });

  it('非法 JSON → 400 中文 JSON', async () => {
    const res = await post('{不是JSON');
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('不是合法 JSON');
  });

  it('嵌套过深（>64 层）→ 400（深嵌套 JSON 炸调用栈的 DoS 面，sec-m5 HIGH-1c）', async () => {
    let 深值: unknown = 'x';
    for (let i = 0; i < 70; i++) 深值 = [深值];
    const res = await post(JSON.stringify({ bazi: 深值, xiyongshen: {}, candidates: [] }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('嵌套过深');
  });

  it('candidates 超 500 条 → 400（1MB 内塞万级候选即异常）', async () => {
    const 超多候选 = Array.from({ length: 501 }, (_, i) => i);
    const res = await post(JSON.stringify({ bazi: {}, xiyongshen: {}, candidates: 超多候选 }));
    expect(res.status).toBe(400);
  });

  it('缺三大字段 → 400，且提示需要哪些字段', async () => {
    const res = await post(JSON.stringify({ bazi: {} }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('bazi');
    expect(data.error).toContain('xiyongshen');
    expect(data.error).toContain('candidates');
  });

  it('candidates 类型错误（非数组）→ 400', async () => {
    const res = await post(JSON.stringify({ bazi: {}, xiyongshen: {}, candidates: {} }));
    expect(res.status).toBe(400);
  });

  it('env 缺失 + 合法 body → 503 中文 JSON（不发网络）', async () => {
    const res = await post(validChartBody);
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.error).toContain('LLM');
  });
});

describe('POST /api/analyze 意向可选键（契约 v4 §1.1）', () => {
  beforeEach(() => {
    // 外层 beforeAll 已清空 ENV_KEYS；此处仅点亮 mock 场景所需（afterEach 复位，保持外层 503 前提）
    process.env.LLM_API_BASE_URL = 'http://127.0.0.1:9/v1';
    process.env.LLM_API_KEY = 'test-key-not-secret';
    process.env.LLM_MODEL = 'test-model';
  });
  afterEach(() => {
    delete process.env.LLM_API_BASE_URL;
    delete process.env.LLM_API_KEY;
    delete process.env.LLM_MODEL;
  });

  it('body 含 意向吉名/意向评估 → 200 SSE，且意向键透传进 user 消息', async () => {
    const res = await post(
      JSON.stringify({
        bazi: { 日主: '甲' },
        xiyongshen: { 强弱等级: '中和' },
        candidates: [],
        意向吉名: ['知予', '沐宸'],
        意向评估: [{ 名: '知予', 爆款度: 0.31 }, { 名: '沐宸', 爆款度: 0.9 }],
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    const 流文本 = await res.text();
    expect(流文本).toContain('"type":"content"');
    expect(流文本).toContain('综解测试正文');
    expect(流文本.trimEnd().endsWith('data: [DONE]')).toBe(true);
    const user消息 = 捕获.送出messages.at(-1)?.find((m) => m.role === 'user')?.content ?? '';
    expect(user消息).toContain('意向吉名');
    expect(user消息).toContain('意向评估');
    expect(user消息).toContain('沐宸');
  });

  it('意向吉名 超 60 条 → 400（重复名过元素校验，只触 .max(60)）', async () => {
    const 名单61 = Array.from({ length: 61 }, () => '知予');
    const res = await post(
      JSON.stringify({ bazi: {}, xiyongshen: {}, candidates: [], 意向吉名: 名单61 }),
    );
    expect(res.status).toBe(400);
  });

  it('意向吉名 非字符串元素 → 400', async () => {
    const res = await post(
      JSON.stringify({ bazi: {}, xiyongshen: {}, candidates: [], 意向吉名: ['知予', 42] }),
    );
    expect(res.status).toBe(400);
  });

  it('意向吉名 元素超 2 字（非名部）→ 400（z.string().max(2) 名部口径）', async () => {
    const res = await post(
      JSON.stringify({ bazi: {}, xiyongshen: {}, candidates: [], 意向吉名: ['欧阳修之'] }),
    );
    expect(res.status).toBe(400);
  });
});
