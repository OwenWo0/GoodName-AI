/**
 * FixedWindowLimiter 单测：窗口重置、限额、键隔离、Retry-After、内存护栏（时钟注入，确定性）。
 */
import { describe, expect, it } from 'vitest';
import { FixedWindowLimiter } from '@/lib/http/rate-limit';

const 分 = 60_000;

describe('FixedWindowLimiter', () => {
  it('限额内放行、达限拒绝、窗口翻转重新放行', () => {
    const lim = new FixedWindowLimiter(分);
    const t0 = 1_000_000;
    for (let i = 0; i < 5; i++) expect(lim.check('ip', 5, t0 + i * 1000).允许).toBe(true);
    const denied = lim.check('ip', 5, t0 + 5_000);
    expect(denied.允许).toBe(false);
    expect(denied.剩余).toBe(0);
    expect(denied.重试秒).toBeGreaterThan(0);
    expect(lim.check('ip', 5, t0 + 分 - 1).允许).toBe(false);
    expect(lim.check('ip', 5, t0 + 分).允许).toBe(true); // 窗口翻篇
  });

  it('键间隔离：A 打满不影响 B', () => {
    const lim = new FixedWindowLimiter(分);
    const t0 = 0;
    for (let i = 0; i < 3; i++) lim.check('A', 3, t0);
    expect(lim.check('A', 3, t0).允许).toBe(false);
    expect(lim.check('B', 3, t0).允许).toBe(true);
  });

  it('剩余额度逐次递减且不进负数', () => {
    const lim = new FixedWindowLimiter(分);
    expect(lim.check('k', 2, 0).剩余).toBe(1);
    expect(lim.check('k', 2, 1).剩余).toBe(0);
    expect(lim.check('k', 1, 分).剩余).toBe(0); // 新窗口限额 1：放行后剩余钳 0
  });

  it('内存护栏：过期键被回收，不无界增长', () => {
    const lim = new FixedWindowLimiter(1000, 8);
    for (let i = 0; i < 8; i++) lim.check(`k${i}`, 5, 0); // 打满最大键数 8
    lim.check('new', 5, 5000); // 8 个旧键全部过期 → 被清；此次消耗 1 额度
    for (let i = 0; i < 4; i++) expect(lim.check('new', 5, 5000 + i).允许).toBe(true); // 剩 4 额度用尽
    expect(lim.check('new', 5, 5004).允许).toBe(false); // 新键自身仍守限额
  });
});
