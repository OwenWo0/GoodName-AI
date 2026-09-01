/**
 * 双引擎回归：lunar-typescript（生产引擎）vs tyme4ts（独立引擎）。
 *
 * 对齐流派：两引擎都取 sect2（晚子时 23:00–23:59 日柱不换日）。
 * - lunar-typescript：EightChar.setSect(2)
 * - tyme4ts：LunarHour.provider = new LunarSect2EightCharProvider()
 *   （全局 provider 赋值是库的流派配置开关，属测试装配而非业务状态变更。）
 *
 * 样本：≥100 个生日 × 每日多次采样 ——
 * A 连续 90 天 × (23:30, 00:30) 各 1（子时双引擎对齐 + 日界）；
 * B 2025/2026 全部节气日 ±1 天 × 12:00（月柱换月边界）；
 * C 闰日 2024-02-29 全 24 小时（子平边界 + 闰日）；
 * D 2025-06-15 全 24 小时（时辰全扫描）。
 * 断言四柱逐柱完全一致；任何不一致须诊断出流派/子时规则原因并显式豁免。
 */
import { Solar } from 'lunar-typescript';
import { LunarHour, LunarSect2EightCharProvider, SolarTime } from 'tyme4ts';
import { describe, expect, it } from 'vitest';

LunarHour.provider = new LunarSect2EightCharProvider();

interface Pillars {
  年: string;
  月: string;
  日: string;
  时: string;
}

/** lunar-typescript（sect2）四柱。 */
function lunarPillars(y: number, mo: number, d: number, h: number, mi: number, s: number): Pillars {
  const ec = Solar.fromYmdHms(y, mo, d, h, mi, s).getLunar().getEightChar();
  ec.setSect(2);
  return { 年: ec.getYear(), 月: ec.getMonth(), 日: ec.getDay(), 时: ec.getTime() };
}

/** tyme4ts（LunarSect2EightCharProvider）四柱。 */
function tymePillars(y: number, mo: number, d: number, h: number, mi: number, s: number): Pillars {
  const ec = SolarTime.fromYmdHms(y, mo, d, h, mi, s).getLunarHour().getEightChar();
  return {
    年: ec.getYear().getName(),
    月: ec.getMonth().getName(),
    日: ec.getDay().getName(),
    时: ec.getHour().getName(),
  };
}

/** 比较结果，收集不一致样本。 */
interface Mismatch {
  时间: string;
  lunar: Pillars;
  tyme: Pillars;
}

function collect(cases: Array<[number, number, number, number, number, number]>): Mismatch[] {
  const mismatches: Mismatch[] = [];
  for (const [y, mo, d, h, mi, s] of cases) {
    const a = lunarPillars(y, mo, d, h, mi, s);
    const b = tymePillars(y, mo, d, h, mi, s);
    if (a.年 !== b.年 || a.月 !== b.月 || a.日 !== b.日 || a.时 !== b.时) {
      const p = (n: number) => String(n).padStart(2, '0');
      mismatches.push({
        时间: `${y}-${p(mo)}-${p(d)} ${p(h)}:${p(mi)}:${p(s)}`,
        lunar: a,
        tyme: b,
      });
    }
  }
  return mismatches;
}

/** 连日样本：start 起 nDays 天，每天取给定时刻。 */
function daily(
  startY: number,
  startMo: number,
  startD: number,
  nDays: number,
  times: Array<[number, number, number]>,
): Array<[number, number, number, number, number, number]> {
  const out: Array<[number, number, number, number, number, number]> = [];
  for (let i = 0; i < nDays; i++) {
    const solar = Solar.fromYmd(startY, startMo, startD).next(i);
    for (const [h, mi, s] of times) {
      out.push([solar.getYear(), solar.getMonth(), solar.getDay(), h, mi, s]);
    }
  }
  return out;
}

/** 指定年的全部节气日（用于换月边界采样）。 */
function termDays(year: number): Array<[number, number, number]> {
  const table = Solar.fromYmd(year, 6, 1).getLunar().getJieQiTable();
  const days: Array<[number, number, number]> = [];
  for (const solar of Object.values(table)) {
    if (solar.getYear() === year) {
      days.push([solar.getYear(), solar.getMonth(), solar.getDay()]);
    }
  }
  expect(days.length).toBeGreaterThanOrEqual(24);
  return days;
}

/** 去重。 */
function dedupe(
  cases: Array<[number, number, number, number, number, number]>,
): Array<[number, number, number, number, number, number]> {
  const seen = new Set<string>();
  return cases.filter((c) => {
    const k = c.join('-');
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

describe('双引擎回归 lunar-typescript(sect2) vs tyme4ts(LunarSect2)', () => {
  it('样本规模 ≥ 100 个不同生日', () => {
    const days = new Set<string>();
    for (const [y, m, d] of [
      ...daily(2026, 1, 1, 90, [[0, 0, 0]]),
      ...[2025, 2026].flatMap((yr) => termDays(yr)),
      [2024, 2, 29] as [number, number, number],
      [2025, 6, 15] as [number, number, number],
    ]) {
      days.add(`${y}-${m}-${d}`);
    }
    expect(days.size).toBeGreaterThanOrEqual(100);
  });

  it('A 连续 90 天 × 夜子/早子时（23:30 / 00:30）四柱全同', { timeout: 120_000 }, () => {
    const cases = daily(2026, 1, 1, 90, [
      [23, 30, 0],
      [0, 30, 0],
    ]);
    expect(collect(cases)).toEqual([]);
  });

  it('B 2025/2026 全部节气日 ±1 天 × 12:00 四柱全同（月柱换月边界）', { timeout: 120_000 }, () => {
    const cases: Array<[number, number, number, number, number, number]> = [];
    for (const year of [2025, 2026]) {
      for (const [y, m, d] of termDays(year)) {
        for (const off of [-1, 0, 1]) {
          const s = Solar.fromYmd(y, m, d).next(off);
          cases.push([s.getYear(), s.getMonth(), s.getDay(), 12, 0, 0]);
        }
      }
    }
    expect(collect(dedupe(cases))).toEqual([]);
  });

  it('C 闰日 2024-02-29 全 24 小时四柱全同', { timeout: 60_000 }, () => {
    const cases = [23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0].map(
      (h) => [2024, 2, 29, h, 15, 0] as [number, number, number, number, number, number],
    );
    expect(collect(cases)).toEqual([]);
  });

  it('D 2025-06-15 全 24 小时（时辰全扫描）四柱全同', { timeout: 60_000 }, () => {
    const cases = Array.from(
      { length: 24 },
      (_, h) => [2025, 6, 15, h, 45, 0] as [number, number, number, number, number, number],
    );
    expect(collect(cases)).toEqual([]);
  });

  it('已验证难点抽查：夜子时(23:30)两引擎一致且日柱不换日', () => {
    // 2024-02-29 23:30：sect2 下日柱仍为 2-29 本日的 癸亥；
    // 次日 00:30（早子时）日柱已进位为 甲子 —— 二者应不同（sect1 才会相同）。
    const lateLunar = lunarPillars(2024, 2, 29, 23, 30, 0);
    const lateTyme = tymePillars(2024, 2, 29, 23, 30, 0);
    const sameDay = tymePillars(2024, 2, 29, 22, 0, 0);
    const earlyNext = tymePillars(2024, 3, 1, 0, 30, 0);
    expect(lateLunar).toEqual(lateTyme);
    expect(lateTyme.日).toBe(sameDay.日);
    expect(lateTyme.日).not.toBe(earlyNext.日);
    expect(lateTyme.时.charAt(1)).toBe('子');
  });
});
