/**
 * POST /api/ai-naming 错误路径壳测试（无 LLM key，不真实调模型）：
 * 只测 415 / 400（缺字段、偏好非法、偏好超长）与「偏好合法时校验放行」的边界证明
 * （env 缺失 → 503 而非 400，即 500 字与空串偏好均已通过 zod）。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { POST } from '@/app/api/ai-naming/route';

const ENV_KEYS = ['LLM_API_BASE_URL', 'LLM_API_KEY', 'LLM_MODEL'] as const;
const savedEnv: Array<[string, string | undefined]> = [];

beforeAll(() => {
  for (const key of ENV_KEYS) {
    savedEnv.push([key, process.env[key]]);
    delete process.env[key]; // 合法体走 503 短路，绝不出网
  }
});

afterAll(() => {
  for (const [key, value] of savedEnv) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function post(
  body: BodyInit,
  headers: Record<string, string> = { 'Content-Type': 'application/json' },
): Promise<Response> {
  return POST(new Request('http://localhost/api/ai-naming', { method: 'POST', headers, body }));
}

const 合法盘 = { bazi: {}, xiyongshen: {} };

describe('POST /api/ai-naming（起名偏好校验面）', () => {
  it('Content-Type 非 JSON → 415', async () => {
    const res = await POST(
      new Request('http://localhost/api/ai-naming', {
        method: 'POST',
        body: JSON.stringify(合法盘),
      }),
    );
    expect(res.status).toBe(415);
    expect((await res.json()).error).toContain('application/json');
  });

  it('缺少 bazi / xiyongshen → 400 人话', async () => {
    const res = await post(JSON.stringify({ 姓氏: '林' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('bazi');
  });

  it('非法 JSON → 400', async () => {
    const res = await post('{不是JSON');
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('不是合法 JSON');
  });

  it('起名偏好超长（501 字）→ 400 点名上限', async () => {
    const res = await post(JSON.stringify({ ...合法盘, 起名偏好: '水'.repeat(501) }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('起名偏好');
  });

  it('起名偏好非字符串 → 400', async () => {
    const res = await post(JSON.stringify({ ...合法盘, 起名偏好: 42 }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('起名偏好');
  });

  it('起名偏好 500 字边界与空串 → 校验放行（env 缺失时 503 而非 400）', async () => {
    const 五百字 = await post(JSON.stringify({ ...合法盘, 起名偏好: '水'.repeat(500) }));
    expect(五百字.status).toBe(503);

    const 空串 = await post(JSON.stringify({ ...合法盘, 起名偏好: '' }));
    expect(空串.status).toBe(503);
  });
});
