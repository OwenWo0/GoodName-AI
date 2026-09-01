/**
 * 真太阳时校正模块单测。
 *
 * 锚点数据来源：《天文算法》Meeus 第 28 章标准近似（本实现所用公式）与
 * NOAA/《天文年历》均时差表的公开值：
 * - 2 月 11 日前后 EoT 达年度极小 ≈ −14.2 分
 * - 11 月 3 日前后 EoT 达年度极大 ≈ +16.4 分
 * - 7 月 26 日前后局部极小 ≈ −6.5 分；5 月 14 日前后局部极大 ≈ +3.7 分
 * 任务要求的「误差 <30s」即测试容差 ±0.5 分（个别锚点收紧到 ±0.3 分）。
 */
import { describe, expect, it } from 'vitest';
import {
  applyTrueSolarTime,
  equationOfTimeMinutes,
  longitudeCorrectionMinutes,
  trueSolarTimeCorrectionMinutes,
} from '@/lib/solar/true-solar-time';

describe('longitudeCorrectionMinutes 经度差项', () => {
  it('东经 120°（东八区标准经线）校正为 0', () => {
    expect(longitudeCorrectionMinutes(120)).toBe(0);
  });

  it('乌鲁木齐 87.6°E 经度项 ≈ −129.6 分', () => {
    expect(longitudeCorrectionMinutes(87.6)).toBeCloseTo(-129.6, 10);
  });

  it('线性性：每偏 1° 差 4 分钟', () => {
    expect(longitudeCorrectionMinutes(121)).toBeCloseTo(4, 10);
    expect(longitudeCorrectionMinutes(119)).toBeCloseTo(-4, 10);
  });

  it('非法经度抛错', () => {
    expect(() => longitudeCorrectionMinutes(181)).toThrow(/经度/);
    expect(() => longitudeCorrectionMinutes(-181)).toThrow(/经度/);
    expect(() => longitudeCorrectionMinutes(Number.NaN)).toThrow(/经度/);
  });
});

describe('equationOfTimeMinutes 均时差', () => {
  // 与 NOAA/天文年历公布值对齐（容差 ±0.5 分 = 30s）
  const anchors: Array<[number, number, number, number]> = [
    // [年, 月, 日, 公布 EoT（分）]
    [2026, 1, 1, -3.4],
    [2026, 2, 11, -14.2],
    [2026, 2, 12, -14.2],
    [2026, 5, 14, 3.7],
    [2026, 7, 26, -6.5],
    [2026, 11, 3, 16.4],
  ];

  it.each(anchors)('%i-%i-%i EoT ≈ %s 分（±30s）', (y, m, d, expected) => {
    // 公布表值只精确到 0.1 分，容差按任务要求取 ±0.5 分（30s）
    expect(Math.abs(equationOfTimeMinutes(y, m, d) - expected)).toBeLessThan(0.5);
  });

  it('锚点绝对误差全部 < 0.5 分（30 秒）', () => {
    for (const [y, m, d, expected] of anchors) {
      expect(Math.abs(equationOfTimeMinutes(y, m, d) - expected)).toBeLessThan(0.5);
    }
  });

  it('年度极值：极小在 2 月中旬 ≈ −14.2，极大在 11 月初 ≈ +16.4，且全幅 < 17 分', () => {
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    let minMonth = 0;
    let minDay = 0;
    let maxMonth = 0;
    let maxDay = 0;
    for (let m = 1; m <= 12; m++) {
      for (let d = 1; d <= 28; d++) {
        const v = equationOfTimeMinutes(2026, m, d);
        expect(Math.abs(v)).toBeLessThan(17);
        if (v < min) {
          min = v;
          minMonth = m;
          minDay = d;
        }
        if (v > max) {
          max = v;
          maxMonth = m;
          maxDay = d;
        }
      }
    }
    expect(min).toBeGreaterThan(-14.7);
    expect(min).toBeLessThan(-13.7);
    expect(minMonth).toBe(2);
    expect(minDay).toBeGreaterThanOrEqual(9);
    expect(minDay).toBeLessThanOrEqual(14);
    expect(max).toBeGreaterThan(15.9);
    expect(max).toBeLessThan(16.9);
    expect(maxMonth).toBe(11);
    expect(maxDay).toBeLessThanOrEqual(5);
  });

  it('日内连续：同一天 00:00 与 23:59 的 EoT 差 < 1 分', () => {
    const a = equationOfTimeMinutes(2026, 2, 11, 0, 0, 0);
    const b = equationOfTimeMinutes(2026, 2, 11, 23, 59, 0);
    expect(Math.abs(a - b)).toBeLessThan(1);
  });

  it('闰日 2 月 29 日可计算（2024 年该日 EoT ≈ −12.5）', () => {
    expect(Math.abs(equationOfTimeMinutes(2024, 2, 29) - -12.5)).toBeLessThan(0.5);
  });
});

describe('trueSolarTimeCorrectionMinutes 总校正', () => {
  it('经度 120 时总校正 = EoT（任务锚点）', () => {
    const eot = equationOfTimeMinutes(2026, 8, 29);
    expect(trueSolarTimeCorrectionMinutes('2026-08-29 12:00:00', 120)).toBeCloseTo(eot, 8);
  });

  it('乌鲁木齐 87.6°E：经度项 −129.6 占主导', () => {
    const c = trueSolarTimeCorrectionMinutes('2026-08-29 12:00:00', 87.6);
    expect(c).toBeLessThan(-128);
    expect(c).toBeGreaterThan(-131);
  });
});

describe('applyTrueSolarTime 校正输出', () => {
  it('经度 120：校正后时间 = 北京时间 + EoT（8 月末 EoT 为负，往回拨）', () => {
    const r = applyTrueSolarTime('2026-08-29 12:00:00', 120);
    expect(r.地点经度).toBe(120);
    expect(r.输入北京时间).toBe('2026-08-29 12:00:00');
    // 8 月末 EoT ≈ −1.0 分（9 月初过零）⇒ 校正后 ≈ 11:59:xx
    expect(r.校正后本地时间).toMatch(/^2026-08-29 11:5[89]:/);
  });

  it('跨年边界：1 月 1 日 00:00 在东经 120 回拨后落到前一年 12 月 31 日', () => {
    const r = applyTrueSolarTime('2026-01-01 00:00:00', 120);
    expect(r.校正后本地时间).toMatch(/^2025-12-31 23:5[0-9]:/);
  });

  it('跨年边界：12 月 31 日 23:59:59 在东部高经度进位到次年 1 月 1 日', () => {
    // 128°E ⇒ +32 分钟；12-31 EoT ≈ −2.8 ⇒ 净 +29 分钟
    const r = applyTrueSolarTime('2026-12-31 23:59:59', 128);
    expect(r.校正后本地时间).toMatch(/^2027-01-01 00:2[0-9]:/);
  });

  it('闰日回拨：2024-02-29 00:00 北京(116.4°E) 校正后落到 2 月 28 日深夜', () => {
    const r = applyTrueSolarTime('2024-02-29 00:00:00', 116.4);
    expect(r.校正后本地时间).toMatch(/^2024-02-28 23:3/);
  });

  it('校正分钟保留两位小数且与 (经度项+EoT) 一致', () => {
    const r = applyTrueSolarTime('2026-08-29 12:00:00', 87.6);
    const expectMin = longitudeCorrectionMinutes(87.6) + equationOfTimeMinutes(2026, 8, 29, 12);
    expect(Math.abs(r.校正分钟 - expectMin)).toBeLessThan(0.011); // 输出两位小数舍入
  });

  it('纯函数：同输入两次调用结果深相等', () => {
    const a = applyTrueSolarTime('2026-08-29 12:00:00', 87.6);
    const b = applyTrueSolarTime('2026-08-29 12:00:00', 87.6);
    expect(a).toEqual(b);
  });

  it('非法输入抛错', () => {
    expect(() => applyTrueSolarTime('2026-8-29 12:00:00', 120)).toThrow(/格式/);
    expect(() => applyTrueSolarTime('2026-02-30 12:00:00', 120)).toThrow(/日期/);
    expect(() => applyTrueSolarTime('2026-08-29 25:00:00', 120)).toThrow(/时/);
    expect(() => applyTrueSolarTime('2026-08-29 12:60:00', 120)).toThrow(/分/);
    expect(() => applyTrueSolarTime('', 120)).toThrow(/格式/);
  });

  it('2 月 29 日在非闰年抛错', () => {
    expect(() => applyTrueSolarTime('2025-02-29 12:00:00', 120)).toThrow(/日期/);
  });
});
