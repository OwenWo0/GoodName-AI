/**
 * 无命盘抽卡引擎（契约 C3 draw.ts）冒烟：走真 schema.parse + buildPool。
 * 断言对齐 pool 语义——双名「至少一字中喜用神」（五行偏好透传为喜用神，忌神 []），
 * 单名逐字必中；确定性（同输入同输出）；「再抽」= 排除已选 重发与上批零交集、
 * 排除剔除数 留痕；姓氏康熙笔画缺失/指定字不在五行字表/约束矛盾 → DrawUserError（route 报 400）。
 */
import { describe, expect, it } from 'vitest';
import { drawNames, DrawUserError } from '@/lib/draw/draw';
import { drawNamesRequestSchema } from '@/lib/draw/schema';

const run = (over: Record<string, unknown> = {}) =>
  drawNames(drawNamesRequestSchema.parse({ 姓氏: '林', ...over }));

describe('drawNames 正常路径（真 buildPool）', () => {
  it('林 + 五行偏好[水] + 双名：候选非空、逐候选至少一字属水、统计齐全', () => {
    const r = run({ 五行偏好: ['水'], 期望候选数: 10 });
    expect(r.候选.length).toBeGreaterThan(0);
    expect(r.候选.length).toBeLessThanOrEqual(10);
    for (const c of r.候选) {
      expect(c.五行.some((w) => w === '水'), `「${c.名}」未中水`).toBe(true);
    }
    expect(r.统计.初筛字数).toBeGreaterThan(1000);
    expect(r.统计.谐音剔除数).toBeGreaterThanOrEqual(0);
    expect(r.统计.排除剔除数).toBe(0);
  });

  it('林 + 五行偏好[水] + 单名：逐候选独字必属水（单名只走命中侧）', () => {
    const r = run({ 五行偏好: ['水'], 名字形式: '单名', 期望候选数: 5 });
    expect(r.候选.length).toBeGreaterThan(0);
    for (const c of r.候选) expect(c.五行).toEqual(['水']);
  });

  it('五行偏好缺省/空数组 = 不限：照常出候选', () => {
    expect(run({ 期望候选数: 5 }).候选.length).toBe(5);
    expect(run({ 五行偏好: [], 期望候选数: 5 }).候选.length).toBe(5);
  });

  it('确定性：同输入两次 deep-equal（无随机源）', () => {
    const 甲 = run({ 五行偏好: ['水'], 期望候选数: 8 });
    const 乙 = run({ 五行偏好: ['水'], 期望候选数: 8 });
    expect(甲).toEqual(乙);
  });

  it('「再抽」口径：排除已选=上批名部 → 与上批零交集且 排除剔除数 留痕', () => {
    const 上批 = run({ 期望候选数: 5 });
    const 名部 = 上批.候选.map((c) => c.名);
    const 下批 = run({ 期望候选数: 5, 排除已选: 名部 });
    expect(下批.候选.length).toBe(5);
    expect(下批.候选.some((c) => 名部.includes(c.名))).toBe(false);
    expect(下批.统计.排除剔除数).toBeGreaterThanOrEqual(1);
  });
});

describe('drawNames 用户可修正输入 → DrawUserError（route 层 400）', () => {
  it('姓氏康熙笔画缺失（库外字兙，过汉字白名单但无笔画）', () => {
    expect(() => run({ 姓氏: '兙' })).toThrow(DrawUserError);
    expect(() => run({ 姓氏: '兙' })).toThrow(/康熙笔画缺失/);
  });

  it('指定字不在五行字表（龘有康熙笔画 48 但五行库无载）', () => {
    expect(() => run({ 指定字: { 字: '龘' } })).toThrow(/不在五行字表/);
  });

  it('指定字撞避讳/禁用、与姓氏重字 → 约束矛盾', () => {
    expect(() => run({ 指定字: { 字: '雨' }, 避讳字: ['雨'] })).toThrow(/约束矛盾/);
    expect(() => run({ 指定字: { 字: '雨' }, 禁用字: ['雨'] })).toThrow(/约束矛盾/);
    expect(() => run({ 指定字: { 字: '林' } })).toThrow(/与姓氏重字/);
  });
});
