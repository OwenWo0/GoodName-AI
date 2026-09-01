/**
 * POST /api/draw-names 请求 schema 边界（契约 C3）：default 兜底（性别男/双名/
 * 位置任一/期望候选数 40）、汉字白名单、五行偏好拒重复与非法值（空数组合法=不限）、
 * 单名+指定字第二拒（文案逐字对齐 chart）、避讳/禁用 ≤30、排除已选 ≤300、期望候选数 1-100 钳制。
 */
import { describe, expect, it } from 'vitest';
import { drawNamesRequestSchema } from '@/lib/draw/schema';

const ok = (over: Record<string, unknown> = {}) =>
  drawNamesRequestSchema.safeParse({ 姓氏: '林', ...over });

describe('drawNamesRequestSchema 合法形状与 default', () => {
  it('最小合法体只给姓氏，其余 default 兜底', () => {
    const r = ok();
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data).toMatchObject({ 姓氏: '林', 性别: '男', 名字形式: '双名', 期望候选数: 40 });
  });

  it('指定字位置缺省=任一；单名合法；五行偏好空数组合法（=不限）', () => {
    const r = ok({ 名字形式: '单名', 五行偏好: [], 指定字: { 字: '雨' } });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.指定字?.位置).toBe('任一');
  });

  it('全量字段合法：复姓+女+指定字第二+避讳/禁用/排除已选+期望 1/100 边界', () => {
    expect(
      ok({
        姓氏: '欧阳',
        性别: '女',
        指定字: { 字: '雨', 位置: '第二' },
        避讳字: ['伟', '芳'],
        禁用字: ['龘'],
        排除已选: ['雨', '林雨'],
        期望候选数: 100,
      }).success,
    ).toBe(true);
    expect(ok({ 期望候选数: 1 }).success).toBe(true);
  });
});

describe('drawNamesRequestSchema 拒非法', () => {
  it('姓氏白名单：非 1-2 汉字拒（空/3 字/字母）', () => {
    expect(ok({ 姓氏: '' }).success).toBe(false);
    expect(ok({ 姓氏: '林某某' }).success).toBe(false);
    expect(ok({ 姓氏: 'Lin' }).success).toBe(false);
  });

  it('五行偏好：重复拒且人话；非法值拒；6 个拒；5 个全集合法', () => {
    const 重复 = ok({ 五行偏好: ['水', '水'] });
    expect(重复.success).toBe(false);
    if (重复.success) return;
    expect(重复.error.issues[0]?.message).toContain('重复');

    expect(ok({ 五行偏好: ['风'] }).success).toBe(false);
    expect(ok({ 五行偏好: ['木', '火', '土', '金', '水', '木'] }).success).toBe(false);
    expect(ok({ 五行偏好: ['木', '火', '土', '金', '水'] }).success).toBe(true);
  });

  it('单名 + 指定字位置第二拒，文案逐字对齐 chart schema；双名合法', () => {
    const r = ok({ 名字形式: '单名', 指定字: { 字: '雨', 位置: '第二' } });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.error.issues[0]?.message).toBe('单名仅一位名部，指定字位置不能为「第二」');
    expect(r.error.issues[0]?.path).toEqual(['指定字']);

    expect(ok({ 名字形式: '双名', 指定字: { 字: '雨', 位置: '第二' } }).success).toBe(true);
  });

  it('指定字须单个汉字；缺字拒', () => {
    expect(ok({ 指定字: { 字: '雨雨' } }).success).toBe(false);
    expect(ok({ 指定字: { 字: 'a' } }).success).toBe(false);
    expect(ok({ 指定字: { 位置: '第一' } }).success).toBe(false);
  });

  it('避讳/禁用逐字单个汉字 ≤30；排除已选每项 1-4 汉字 ≤300', () => {
    expect(ok({ 避讳字: Array(30).fill('伟') }).success).toBe(true);
    expect(ok({ 避讳字: Array(31).fill('伟') }).success).toBe(false);
    expect(ok({ 禁用字: ['ab'] }).success).toBe(false);
    expect(ok({ 排除已选: Array(300).fill('雨') }).success).toBe(true);
    expect(ok({ 排除已选: Array(301).fill('雨') }).success).toBe(false);
    expect(ok({ 排除已选: ['林某某某某'] }).success).toBe(false); // 5 字名部超界
    expect(ok({ 排除已选: ['某某某某'] }).success).toBe(true); // 4 字上界合法
  });

  it('期望候选数：整数 1-100，越界/小数拒', () => {
    expect(ok({ 期望候选数: 0 }).success).toBe(false);
    expect(ok({ 期望候选数: 101 }).success).toBe(false);
    expect(ok({ 期望候选数: 20.5 }).success).toBe(false);
  });
});
