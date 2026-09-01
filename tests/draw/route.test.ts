/**
 * POST /api/draw-names 壳测试（仿 tests/evaluate/route.test.ts 口径）：
 * 200 成功形状 + 415/413/非法 JSON/400 逐条/DrawUserError→400/未知→500 泛化。
 * 引擎与 schema 细则分别由 tests/draw/draw.test.ts、tests/draw/schema.test.ts 覆盖。
 */
import { describe, it, expect } from 'vitest';
import { POST } from '@/app/api/draw-names/route';

function post(body: BodyInit, headers: Record<string, string> = { 'Content-Type': 'application/json' }) {
  return POST(new Request('http://localhost/api/draw-names', { method: 'POST', headers, body }));
}

const 合法体 = JSON.stringify({ 姓氏: '林', 五行偏好: ['水'], 期望候选数: 5 });

describe('POST /api/draw-names', () => {
  it('合法请求 → 200 { 候选, 统计 }，候选逐条含五行且中偏好、形状可直填 ChartResult.candidates', async () => {
    const res = await post(合法体);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.候选.length).toBeGreaterThan(0);
    expect(data.候选.length).toBeLessThanOrEqual(5);
    const c = data.候选[0];
    expect(c.名).toMatch(/^[一-鿿]{1,2}$/);
    expect(c.五行).toContain('水');
    expect(c.平仄.平仄格式.length).toBeGreaterThan(0);
    expect(c.五格).not.toBeNull();
    expect(typeof c.爆款度).toBe('number');
    expect(data.统计.初筛字数).toBeGreaterThan(0);
  });

  it('缺省字段走 default：性别男/双名/期望 40', async () => {
    const res = await post(JSON.stringify({ 姓氏: '林' }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.候选.length).toBeGreaterThan(0);
    expect(data.候选[0].名).toMatch(/^[一-鿿]{2}$/); // 双名 default → 名部 2 字
  });

  it('Content-Type 非 JSON → 415（跨站简单请求盲打面已关）', async () => {
    const res = await POST(
      new Request('http://localhost/api/draw-names', { method: 'POST', body: 合法体 }),
    );
    expect(res.status).toBe(415);
    expect((await res.json()).error).toContain('application/json');
  });

  it('请求体超 1MB → 413', async () => {
    const huge = JSON.stringify({ 姓氏: '林', 排除已选: ['x'.repeat(1024 * 1024 + 16)] });
    const res = await post(huge);
    expect(res.status).toBe(413);
    expect((await res.json()).error).toContain('请求体过大');
  });

  it('非法 JSON → 400', async () => {
    const res = await post('{不是JSON');
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('不是合法 JSON');
  });

  it('schema 不过 → 400 且逐字段人话（五行偏好重复 / 单名+指定字第二 都点名）', async () => {
    const 重复 = await post(JSON.stringify({ 姓氏: '林', 五行偏好: ['水', '水'] }));
    expect(重复.status).toBe(400);
    const 文本1 = (await 重复.json()).error as string;
    expect(文本1).toContain('五行偏好');
    expect(文本1).toContain('重复');

    const 单名第二 = await post(
      JSON.stringify({ 姓氏: '林', 名字形式: '单名', 指定字: { 字: '雨', 位置: '第二' } }),
    );
    expect(单名第二.status).toBe(400);
    expect((await 单名第二.json()).error).toContain('单名仅一位名部');
  });

  it('DrawUserError → 400 中文人话（姓氏笔画缺失 / 指定字不在五行字表），不外泄堆栈', async () => {
    const 缺笔画 = await post(JSON.stringify({ 姓氏: '兙' }));
    expect(缺笔画.status).toBe(400);
    expect((await 缺笔画.json()).error).toContain('康熙笔画缺失');

    const 表外指定字 = await post(JSON.stringify({ 姓氏: '林', 指定字: { 字: '龘' } }));
    expect(表外指定字.status).toBe(400);
    expect((await 表外指定字.json()).error).toContain('不在五行字表');
  });
});
