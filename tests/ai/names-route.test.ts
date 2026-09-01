import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { POST } from '@/app/api/analyze-names/route';

/** 假流状态：供 mock 闭包共享，逐用例重置。 */
const 假流状态 = {
  deltas: [] as Array<{ content?: string; reasoning_content?: string }>,
  createError: null as Error | null,
};



const ENV_KEYS = ['LLM_API_BASE_URL', 'LLM_API_KEY', 'LLM_MODEL'] as const;
const savedEnv: Array<[string, string | undefined]> = [];

const originalFetch = globalThis.fetch;
const sseEncoder = new TextEncoder();

beforeAll(() => {
  globalThis.fetch = (async () => {
    if (假流状态.createError) throw 假流状态.createError;
    const stream = new ReadableStream({
      start(controller) {
        for (const d of 假流状态.deltas) {
          const chunk = {
            id: 'chatcmpl-test',
            object: 'chat.completion.chunk',
            created: Date.now(),
            model: 'test-model',
            choices: [{ index: 0, delta: d, finish_reason: null }],
          };
          controller.enqueue(
            sseEncoder.encode(`data: ${JSON.stringify(chunk)}\n\n`),
          );
        }
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
  }
  process.env.LLM_API_BASE_URL = 'https://example.test/v1';
  process.env.LLM_API_KEY = 'test-key';
  process.env.LLM_MODEL = 'test-model';
});

afterAll(() => {
  globalThis.fetch = originalFetch;
  for (const [key, value] of savedEnv) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

beforeEach(() => {
  假流状态.deltas = [];
  假流状态.createError = null;
});

function post(body: BodyInit): Promise<Response> {
  return POST(
    new Request('http://localhost/api/analyze-names', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }, // route 只认 JSON（同 analyze 壳）
      body,
    }),
  );
}

const 合法请求体 = JSON.stringify({
  命盘摘要: { 四柱: ['甲子', '癸酉', '壬戌', '辛丑'], 日主: '壬', 喜用神: ['木', '火'], 忌神: ['金'] },
  评估: [
    {
      名: '沐宸',
      表外字: [],
      五行: ['水', '土'],
      平仄: { 逐字: [], 平仄格式: '仄平', 体系: 'putonghua', 绕口风险: null, 谐音风险: null, 字表校验: { 全部在通用规范汉字表: true, 表外字: [] } },
      五格: null,
      爆款度: 0.9,
      契合: { 命中喜用: ['水'], 命中次用: [], 命中忌神: [], 档位: '中上', 分: 8, 说明: [] },
    },
  ],
});

describe('POST /api/analyze-names 错误路径', () => {
  it('请求体超 1MB → 413 中文 JSON', async () => {
    const huge = JSON.stringify({ padding: 'x'.repeat(1024 * 1024 + 16) });
    const res = await post(huge);
    expect(res.status).toBe(413);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain('请求体过大');
  });

  it('Content-Type 非 JSON → 415（默认 text/plain 跨站盲打面已关）', async () => {
    const res = await POST(
      new Request('http://localhost/api/analyze-names', { method: 'POST', body: 合法请求体 }),
    );
    expect(res.status).toBe(415);
    expect((await res.json()).error).toContain('application/json');
  });

  it('非法 JSON → 400 中文 JSON', async () => {
    const res = await post('{不是JSON');
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('不是合法 JSON');
  });

  it('嵌套过深（>64 层）→ 400（同 analyze 壳的炸栈 DoS 面）', async () => {
    let 深值: unknown = 'x';
    for (let i = 0; i < 70; i++) 深值 = [深值];
    const res = await post(JSON.stringify({ 命盘摘要: { 四柱: [深值, '乙', '丙', '丁'], 日主: '壬', 喜用神: [], 忌神: [] }, 评估: [] }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('嵌套过深');
  });

  it('评估为空数组 → 400（空评估无点评对象）', async () => {
    const res = await post(JSON.stringify({ 命盘摘要: { 四柱: ['甲', '乙', '丙', '丁'], 日主: '壬', 喜用神: ['木'], 忌神: [] }, 评估: [] }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('评估');
  });

  it('评估超 100 条 → 400', async () => {
    const 评估 = Array.from({ length: 101 }, (_, i) => ({ 名: `名${i}` }));
    const res = await post(JSON.stringify({ 命盘摘要: { 四柱: ['甲', '乙', '丙', '丁'], 日主: '壬', 喜用神: ['木'], 忌神: [] }, 评估 }));
    expect(res.status).toBe(400);
  });

  it('缺 命盘摘要/评估 → 400，且提示需要哪些字段', async () => {
    const res = await post(JSON.stringify({ 命盘摘要: { 四柱: ['甲', '乙', '丙', '丁'] } }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('命盘摘要');
    expect(data.error).toContain('评估');
  });

  it('四柱非 4 项 → 400', async () => {
    const res = await post(JSON.stringify({ 命盘摘要: { 四柱: ['甲', '乙'], 日主: '壬', 喜用神: ['木'], 忌神: [] }, 评估: [{ 名: '沐' }] }));
    expect(res.status).toBe(400);
  });

  it('env 缺失 + 合法 body → 503 中文 JSON（不发网络）', async () => {
    const saved = ENV_KEYS.map((k) => [k, process.env[k]] as const);
    for (const k of ENV_KEYS) delete process.env[k];
    try {
      const res = await post(合法请求体);
      expect(res.status).toBe(503);
      const data = await res.json();
      expect(data.error).toContain('LLM');
    } finally {
      for (const [k, v] of saved) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  });
});

describe('POST /api/analyze-names 流式帧（注入假 client，零真实网络）', () => {
  it('双流增量 → content/reasoning 帧原样转发 + [DONE] 收尾 + SSE 头', async () => {
    假流状态.deltas = [{ reasoning_content: '先观其格' }, { content: '「沐宸」' }, { content: '音律谐和。' }];
    const res = await post(合法请求体);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    const 文本 = await res.text();
    expect(文本).toContain('data: {"type":"reasoning","text":"先观其格"}\n\n');
    expect(文本).toContain('data: {"type":"content","text":"「沐宸」"}\n\n');
    expect(文本).toContain('data: {"type":"content","text":"音律谐和。"}\n\n');
    expect(文本.endsWith('data: [DONE]\n\n')).toBe(true);
  });

  it('上游建流即抛 → error 帧（中文摘要、不外泄底层细节）+ [DONE] 收尾', async () => {
    假流状态.createError = new Error('HTTP 500 upstream leaked secret');
    const res = await post(合法请求体);
    expect(res.status).toBe(200); // 帧契约：流中错误走 error 帧，不用非 2xx 状态
    const 文本 = await res.text();
    expect(文本).toContain('data: {"type":"error","message":"大模型调用失败，请稍后重试。"}\n\n');
    expect(文本).not.toContain('upstream leaked secret');
    expect(文本.endsWith('data: [DONE]\n\n')).toBe(true);
  });
});
