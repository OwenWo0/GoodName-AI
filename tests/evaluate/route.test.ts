/**
 * POST /api/evaluate-names 壳测试（仿 tests/ai/route.test.ts 错误路径口径 + 一条 200 成功形状）。
 * 评估内核逻辑由 tests/evaluate/evaluate.test.ts 覆盖，此处只测 HTTP 契约。
 */
import { describe, it, expect } from 'vitest';
import { POST } from '@/app/api/evaluate-names/route';

function post(body: BodyInit, headers: Record<string, string> = { 'Content-Type': 'application/json' }) {
  return POST(new Request('http://localhost/api/evaluate-names', { method: 'POST', headers, body }));
}

const 合法体 = JSON.stringify({
  姓氏: '王',
  名字列表: ['伟'],
  喜用神: ['土'],
  忌神: ['水'],
});

describe('POST /api/evaluate-names', () => {
  it('合法请求 → 200 { 评估: EvaluatedName[] }（形状含平仄/五格/契合）', async () => {
    const res = await post(合法体);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.评估).toHaveLength(1);
    const r = data.评估[0];
    expect(r.名).toBe('伟');
    expect(r.五行).toEqual(['土']);
    expect(r.平仄.平仄格式).toHaveLength(2); // 含姓氏
    expect(r.五格).not.toBeNull();
    expect(r.契合.档位).toBe('上');
    expect(r.契合.命中喜用).toEqual(['土']);
  });

  it('表外字名 → 200（只警告不过滤，评估照常返回）', async () => {
    const res = await post(JSON.stringify({ 姓氏: '王', 名字列表: ['龘'], 喜用神: ['土'] }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.评估[0].表外字).toEqual(['龘']);
  });

  it('Content-Type 非 JSON → 415（跨站简单请求盲打面已关）', async () => {
    const res = await POST(
      new Request('http://localhost/api/evaluate-names', { method: 'POST', body: 合法体 }),
    );
    expect(res.status).toBe(415);
    expect((await res.json()).error).toContain('application/json');
  });

  it('请求体超 1MB → 413', async () => {
    const huge = JSON.stringify({ 姓氏: '王', 名字列表: ['x'.repeat(1024 * 1024 + 16)], 喜用神: ['土'] });
    const res = await post(huge);
    expect(res.status).toBe(413);
    expect((await res.json()).error).toContain('请求体过大');
  });

  it('非法 JSON → 400', async () => {
    const res = await post('{不是JSON');
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('不是合法 JSON');
  });

  it('schema 不过 → 400 且逐字段人话（缺字段 / refine 违例都点名）', async () => {
    const 缺字段 = await post(JSON.stringify({ 姓氏: '王' }));
    expect(缺字段.status).toBe(400);
    const 文本1 = (await 缺字段.json()).error as string;
    expect(文本1).toContain('名字列表');
    expect(文本1).toContain('喜用神');

    const 犯交集 = await post(
      JSON.stringify({ 姓氏: '王', 名字列表: ['伟'], 喜用神: ['土'], 忌神: ['土'] }),
    );
    expect(犯交集.status).toBe(400);
    expect((await 犯交集.json()).error).toContain('交集');
  });
});
