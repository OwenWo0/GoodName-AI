/**
 * 时辰未知（四柱.时=null）降级：得地/得势整体跳过时柱、说明留痕；
 * 缺柱不缩放总分（生克双向不确定，放大=伪造精度）。
 */
import { describe, expect, it } from 'vitest';
import { analyzeWangshuai } from '@/lib/xiyong/wangshuai';
import { 缺时柱, 锚点 } from './fixtures';

describe('时辰未知旺衰降级', () => {
  it('冬木去时柱：时干丙(食伤−5)与时支寅(通根8)整体缺位，总分 47→44 仍偏强', () => {
    const 四柱 = 缺时柱(锚点['冬木']().四柱);
    const w = analyzeWangshuai('甲', 四柱);
    expect(w.得地.得分).toBe(0); // 唯一通根在时支寅，缺位后无根
    expect(w.得势.得分).toBe(9); // 年比隔+6 月食贴−5 年日子×2 无根生扶+8
    expect(w.得分).toBeCloseTo(44, 10); // 35+0+9（不按时辰已知比例放大——缺柱不缩放）
    expect(w.等级).toBe('偏强');
  });

  it('得地/得势说明与明细均留「时辰未知」痕', () => {
    const 四柱 = 缺时柱(锚点['夏火']().四柱);
    const w = analyzeWangshuai('丙', 四柱);
    expect(w.得地.说明).toContain('时辰未知');
    expect(w.得势.说明).toContain('时辰未知');
    expect(w.得地.明细).toContain('时辰未知，时柱未计');
    expect(w.得势.明细).toContain('时辰未知，时柱未计');
  });

  it('缺时柱只减分不翻档（夏火 72→58 仍身强）', () => {
    const w = analyzeWangshuai('丙', 缺时柱(锚点['夏火']().四柱));
    // 去时干甲(印贴+6)去时支午(得地8)：72−14=58 ≥55
    expect(w.得分).toBeCloseTo(58, 10);
    expect(w.等级).toBe('身强');
  });
});
