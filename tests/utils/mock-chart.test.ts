/**
 * 开发 fixture 守护测试：防止手造数据与 ChartResult 契约漂移（键缺失、状态覆盖丢失）。
 */
import { describe, expect, it } from 'vitest';
import { mockChart } from '@/utils/mock-chart';
import { WUXING_ORDER } from '@/utils/wuxing';

describe('mockChart 契约形状', () => {
  it('五行力量按固定五键齐全', () => {
    expect(mockChart.bazi.五行力量.map((f) => f.五行)).toEqual([...WUXING_ORDER]);
  });

  it('四柱齐、时柱非空、各柱藏干与十神等长', () => {
    const { 年, 月, 日, 时 } = mockChart.bazi.四柱;
    for (const z of [年, 月, 日, 时]) {
      expect(z).not.toBeNull();
      if (z) expect(z.藏干).toHaveLength(z.十神.length);
    }
    expect(mockChart.bazi.日主).toBe(mockChart.bazi.四柱.日.天干);
  });

  it('覆盖展示关键状态：冲突态、争议标注、起运精准、爆款高/低、表外字警告', () => {
    expect(mockChart.xiyongshen.冲突).toBe(true);
    expect(mockChart.xiyongshen.冲突说明).toBeTruthy();
    expect(mockChart.wuge?.争议标注.length).toBeGreaterThan(0);
    expect(mockChart.bazi.起运精准).toBeTruthy();
    const buzz = mockChart.candidates.map((c) => c.爆款度);
    expect(Math.min(...buzz)).toBeLessThan(0.2);
    expect(Math.max(...buzz)).toBeGreaterThan(0.6);
    expect(mockChart.candidates.some((c) => !c.平仄.字表校验.全部在通用规范汉字表)).toBe(true);
  });

  it('卷五数据源：草案平仄扩展字段在位', () => {
    expect(mockChart.名字草案平仄?.平仄格式).toBe('仄平平');
  });
});
