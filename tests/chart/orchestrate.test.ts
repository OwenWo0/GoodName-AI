import { describe, it, expect } from 'vitest';
import { buildChart, buildBeiJingTime, 农历转公历, ChartUserError } from '@/lib/chart/orchestrate';
import { chartRequestSchema, type ChartRequest } from '@/lib/chart/schema';

// /api/chart 编排层：农历/夏令时/时辰未知/真太阳时开关/双轨五格/候选池组装。

function 请求(overrides: Partial<ChartRequest> = {}): ChartRequest {
  return chartRequestSchema.parse({
    姓氏: '李',
    性别: '男',
    历法: '阳历',
    出生日期: '2025-01-01',
    时辰未知: false,
    出生时间: '12:00',
    经度: 116.4,
    名字形式: '双名',
    ...overrides,
  });
}

describe('农历转公历', () => {
  it('闰月=负数月：2023 闰二月初一 → 2023-03-22', () => {
    expect(农历转公历(2023, 2, 1, true)).toBe('2023-03-22');
  });

  it('平月回环一致：2025 正月初一 → 2025-01-29', () => {
    expect(农历转公历(2025, 1, 1, false)).toBe('2025-01-29');
  });

  it('该年无闰六月（2026）→ ChartUserError', () => {
    expect(() => 农历转公历(2026, 6, 15, true)).toThrow(ChartUserError);
    expect(() => 农历转公历(2026, 6, 15, true)).toThrow(/不合法/);
  });
});

describe('buildBeiJingTime', () => {
  it('拼装秒位 :00；时辰未知 → null', () => {
    expect(buildBeiJingTime('2025-01-01', '08:30', false, undefined)).toBe('2025-01-01 08:30:00');
    expect(buildBeiJingTime('2025-01-01', undefined, true, undefined)).toBeNull();
  });

  it('夏令时：墙钟回拨 1 小时，跨日合法（00:30 → 前一日 23:30）', () => {
    expect(buildBeiJingTime('2025-01-01', '00:30', false, true)).toBe('2024-12-31 23:30:00');
    expect(buildBeiJingTime('2025-01-01', '09:00', false, true)).toBe('2025-01-01 08:00:00');
  });
});

describe('buildChart', () => {
  it('排盘主体：四柱/日主/五行力量/大运/喜用神/候选齐备', () => {
    const r = buildChart(请求());
    expect(r.bazi.四柱.时).not.toBeNull();
    expect(r.bazi.日主).toHaveLength(1);
    expect(r.bazi.五行力量).toHaveLength(5);
    expect(r.bazi.大运.length).toBeGreaterThan(0);
    expect(r.xiyongshen.喜用神.length).toBeGreaterThan(0);
    expect(r.wuge).toBeNull(); // 无草案 → 顶层五格 null
    expect(r.candidates.length).toBeGreaterThan(0);
    const c = r.candidates[0];
    expect(c.五格.天格.数理).toBeGreaterThan(0); // 候选五格独立齐备
    expect(c.平仄.逐字.length).toBeGreaterThan(0);
    expect(c.爆款度).toBeGreaterThanOrEqual(0);
    expect(c.入选依据.length).toBeGreaterThan(0);
  });

  it('输入透传：北京时间/公历出生日期/避讳字', () => {
    const r = buildChart(请求({ 避讳字: ['伟'] }));
    expect(r.输入.北京时间).toBe('2025-01-01 12:00:00');
    expect(r.输入.出生日期).toBe('2025-01-01');
    expect(r.输入.避讳字).toEqual(['伟']);
  });

  it('真太阳时开：经度 116.4 ≠ 标准 120 → 校正分钟非 0；关：恒 0 + 未启用', () => {
    const on = buildChart(请求({ 出生时间: '12:00' }));
    expect(on.bazi.真太阳时.校正分钟).not.toBe(0);
    const off = buildChart(请求({ 使用真太阳时: false }));
    expect(off.bazi.真太阳时.校正分钟).toBe(0);
    expect(off.bazi.真太阳时.未启用).toBe(true);
    expect(off.bazi.真太阳时.校正后本地时间).toBe(off.bazi.真太阳时.输入北京时间);
  });

  it('时辰未知：北京时间=null，出生日期承载，时柱缺位，降级提示在位', () => {
    const r = buildChart(请求({ 时辰未知: true, 出生时间: undefined }));
    expect(r.输入.北京时间).toBeNull();
    expect(r.输入.出生日期).toBe('2025-01-01');
    expect(r.bazi.四柱.时).toBeNull();
    expect(r.bazi.时辰未知提示).toContain('时辰未知');
    expect(r.bazi.真太阳时.正午近似).toBe(true);
  });

  it('农历闰月入参 → 输入.出生日期 为换算后公历', () => {
    const r = buildChart(
      请求({ 历法: '农历', 出生日期: '2023-02-01', 闰月: true, 出生时间: '10:00' }),
    );
    expect(r.输入.出生日期).toBe('2023-03-22');
    expect(r.输入.北京时间).toBe('2023-03-22 10:00:00');
  });

  it('无闰月年份勾选闰月 → ChartUserError（route 层报 400）', () => {
    expect(() => buildChart(请求({ 历法: '农历', 闰月: true }))).toThrow(ChartUserError);
  });

  it('夏令时跨日：北京时间落在前一日 23:30，晚子时流派标注 sect2', () => {
    const r = buildChart(请求({ 出生时间: '00:30', 夏令时: true }));
    expect(r.输入.北京时间).toBe('2024-12-31 23:30:00');
    expect(r.bazi.晚子时流派).toBe('sect2_日不换');
  });

  it('草案平仄：有草案逐字=姓+草案、无草案为 null（卷五消费字段，已并入 ChartResult）', () => {
    const withDraft = buildChart(请求({ 名字草案: '明远' }));
    expect(withDraft.名字草案平仄).not.toBeNull();
    expect(withDraft.名字草案平仄!.逐字).toHaveLength(3); // 李 + 明远
    expect(withDraft.名字草案平仄!.平仄格式).toHaveLength(3);
    expect(withDraft.名字草案平仄!.体系).toBe('putonghua');
    expect(buildChart(请求()).名字草案平仄).toBeNull();
  });

  it('双轨五格：草案五格（顶层）独立于候选五格', () => {
    const r = buildChart(请求({ 名字草案: '明远' }));
    expect(r.wuge).not.toBeNull();
    expect(r.输入.名字草案).toBe('明远');
    const 草案人格 = r.wuge!.人格.数理;
    const 某候选 = r.candidates.find((c) => c.名 !== '明远');
    expect(某候选).toBeDefined();
    expect(某候选!.五格.人格.数理).not.toBe(草案人格);
  });

  it('辈字锁位透传 pool：所有候选第 1 字 = 辈字', () => {
    const r = buildChart(请求({ 辈字: { 字: '明', 位置: '第一' } }));
    expect(r.输入.辈字).toBe('明');
    for (const c of r.candidates) expect([...c.名][0]).toBe('明');
  });

  it('指定字锁位透传 pool + 输入回显（契约 v3 §1.2）：第一/第二只现该位，任一必含', () => {
    const 第一 = buildChart(请求({ 指定字: { 字: '明', 位置: '第一' } }));
    expect(第一.输入.指定字).toEqual({ 字: '明', 位置: '第一' });
    expect(第一.candidates.length).toBeGreaterThan(0);
    for (const c of 第一.candidates) expect([...c.名][0]).toBe('明');

    const 第二 = buildChart(请求({ 指定字: { 字: '明', 位置: '第二' } }));
    for (const c of 第二.candidates) expect([...c.名][1]).toBe('明');

    const 任一 = buildChart(请求({ 指定字: { 字: '明', 位置: '任一' } }));
    for (const c of 任一.candidates) expect(c.名).toContain('明');
  });

  it('未填指定字：输入.指定字 缺省不回显', () => {
    expect(buildChart(请求()).输入.指定字).toBeUndefined();
  });

  it('确定性：同输入两次构建候选序列一致（统计计时字段除外）', () => {
    const a = buildChart(请求());
    const b = buildChart(请求());
    expect(JSON.stringify(a.candidates)).toBe(JSON.stringify(b.candidates));
  });
});

describe('POST /api/chart（route 冒烟）', () => {
  const url = 'http://localhost/api/chart'; // Request 需绝对 URL（node fetch impl）
  const json = (body: string): RequestInit => ({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }, // route 只认 JSON（sec-m5 MEDIUM-3）
    body,
  });

  it('合法请求 → 200 ChartResult', async () => {
    const { POST } = await import('@/app/api/chart/route');
    const res = await POST(new Request(url, json(JSON.stringify(请求()))));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.bazi.四柱.年.干支).toHaveLength(2);
    expect(body.candidates.length).toBeGreaterThan(0);
  });

  it('Content-Type 非 JSON → 415（text/plain 跨站盲打面已关）', async () => {
    const { POST } = await import('@/app/api/chart/route');
    const res = await POST(new Request(url, { method: 'POST', body: '{}' })); // 默认 text/plain
    expect(res.status).toBe(415);
  });

  it('缺出生时间 → 400 中文含字段名', async () => {
    const { POST } = await import('@/app/api/chart/route');
    const bad = { ...请求(), 时辰未知: false } as Record<string, unknown>;
    delete bad.出生时间;
    const res = await POST(new Request(url, json(JSON.stringify(bad))));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('出生时间');
  });

  it('非法 JSON → 400；非法日历日 → 400（schema 层 Date.UTC 回环直拒，原编排层兜底口径上移）', async () => {
    const { POST } = await import('@/app/api/chart/route');
    expect((await POST(new Request(url, json('{')))).status).toBe(400);
    // 绕过 请求() 内的 schema.parse（统一后该日期在 schema 层即拒），直发原始体验 route 拒收
    const res = await POST(new Request(url, json(JSON.stringify({ ...请求(), 出生日期: '2025-13-01' }))));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('出生日期');
  });

  it('GET 未定义 → Next 405（仅 POST）由框架保证，此处仅验证 POST 导出存在', async () => {
    const mod = await import('@/app/api/chart/route');
    expect(typeof mod.POST).toBe('function');
    expect('GET' in mod).toBe(false);
  });
});
