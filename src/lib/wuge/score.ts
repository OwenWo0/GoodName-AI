/**
 * 五格综合评分 —— 熊崎派吉凶档加权口径（主 agent 调研定稿，民俗口径非科学结论）。
 *
 * 基础分：五格 大吉95/吉85/半吉70/凶30；三才 大吉95/吉85/半吉65/凶35/大凶15（五档含大凶）。
 * 权重（%）：人格30 / 地格20 / 总格20 / 外格10 / 三才20 / 天格0（祖传豁免：只展示不计分）。
 * 综合分 = Math.round(Σ 权重×基础分 ÷ 100)，整数百分制；理论值域 [27,95]，满分 95 不可达 100。
 * 档位 5 档：≥90 上乘 / 80~89 优良 / 70~79 中上 / 60~69 及格 / <60 欠佳。
 * 越表吉凶值（如五格表「末定」入评分、三才表外断语）→ 抛中文 Error，纯防御不留静默兜底。
 */

import type { WugeResult, WugeTier } from '../types';

/** 五格表实际产出并参与计分的档；「末定」是类型枚举里的防御值、81 表无此断语 → 不入评分表。 */
type 计分档 = '大吉' | '吉' | '半吉' | '凶';

/** 五格（天人地外总）吉凶 → 基础分。 */
export const GE_BASE: Readonly<Record<计分档, number>> = Object.freeze({
  大吉: 95,
  吉: 85,
  半吉: 70,
  凶: 30,
});

/** 三才表实际产出的五档（比五格表多「大凶」）。 */
type 三才档 = '大吉' | '吉' | '半吉' | '凶' | '大凶';

/** 三才吉凶（五档）→ 基础分。 */
export const SANCAI_BASE: Readonly<Record<三才档, number>> = Object.freeze({
  大吉: 95,
  吉: 85,
  半吉: 65,
  凶: 35,
  大凶: 15,
});

/** 权重（百分整数，合计 100；天格 0 = 祖传豁免只展示不计分）。 */
export const WUGE_WEIGHTS: Readonly<{
  人格: number;
  地格: number;
  总格: number;
  外格: number;
  三才: number;
  天格: number;
}> = Object.freeze({ 人格: 30, 地格: 20, 总格: 20, 外格: 10, 三才: 20, 天格: 0 });

/** 综合分 → 5 档话术。 */
export function tierOf(综合分: number): WugeTier {
  if (综合分 >= 90) return '上乘';
  if (综合分 >= 80) return '优良';
  if (综合分 >= 70) return '中上';
  if (综合分 >= 60) return '及格';
  return '欠佳';
}

function lookup(base: Readonly<Record<string, number>>, 档: string, 语境: string): number {
  const v = base[档];
  if (v === undefined) {
    throw new Error(`${语境}吉凶档「${档}」不在评分表（应有 ${Object.keys(base).join('/')}）`);
  }
  return v;
}

/** scoreWuge 只消费计分的五格与三才，天格/明细等字段不参与。 */
export type ScoreInput = Pick<WugeResult, '人格' | '地格' | '总格' | '外格' | '三才'>;

/** 五格综合评分：纯函数，整数运算避免浮点漂移（权重取百分整数后再除 100）。 */
export function scoreWuge(wuge: ScoreInput): { 综合分: number; 档位: WugeTier } {
  const 加权和 =
    WUGE_WEIGHTS.人格 * lookup(GE_BASE, wuge.人格.吉凶, '人格') +
    WUGE_WEIGHTS.地格 * lookup(GE_BASE, wuge.地格.吉凶, '地格') +
    WUGE_WEIGHTS.总格 * lookup(GE_BASE, wuge.总格.吉凶, '总格') +
    WUGE_WEIGHTS.外格 * lookup(GE_BASE, wuge.外格.吉凶, '外格') +
    WUGE_WEIGHTS.三才 * lookup(SANCAI_BASE, wuge.三才.吉凶, '三才');
  const 综合分 = Math.round(加权和 / 100);
  return { 综合分, 档位: tierOf(综合分) };
}
