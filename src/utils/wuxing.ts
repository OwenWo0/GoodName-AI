/**
 * 五行关系与天干地支五行派生 —— 纯函数，供展示层使用（对齐竞品「同我/我生…」标签）。
 * 不改动算法层契约：日主五行由日主天干纯函数派生。
 */
import type { WuXing } from '@/lib/types';

/** 五行力量表固定顺序（与 BaziResult.五行力量 约定一致）。 */
export const WUXING_ORDER: readonly WuXing[] = ['木', '火', '土', '金', '水'];

/** 相生：木生火、火生土、土生金、金生水、水生木。 */
const SHENG: Readonly<Record<WuXing, WuXing>> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };

/** 相克：木克土、土克水、水克火、火克金、金克木。 */
const KE: Readonly<Record<WuXing, WuXing>> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };

/** 与日主的五类关系（展示标签）。 */
export type WuxingRelation = '同我' | '我生' | '我克' | '克我' | '生我';

/** 目标五行相对日主的关系。日主须为合法五行，否则抛错（调用方负责取数正确）。 */
export function wuxingRelation(日主: WuXing, 目标: WuXing): WuxingRelation {
  if (目标 === 日主) return '同我';
  if (SHENG[日主] === 目标) return '我生';
  if (KE[日主] === 目标) return '我克';
  if (SHENG[目标] === 日主) return '生我';
  if (KE[目标] === 日主) return '克我';
  throw new Error(`无法判定五行关系：日主=${日主} 目标=${目标}`);
}

const GAN_WUXING: Readonly<Record<string, WuXing>> = {
  甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土',
  己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水',
};

const ZHI_WUXING: Readonly<Record<string, WuXing>> = {
  子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火',
  午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水',
};

/** 天干 → 五行；非天干返回 null。 */
export function ganToWuxing(gan: string): WuXing | null {
  return GAN_WUXING[gan] ?? null;
}

/** 地支 → 五行（本气）；非地支返回 null。 */
export function zhiToWuxing(zhi: string): WuXing | null {
  return ZHI_WUXING[zhi] ?? null;
}

/** 五行 → 色条 Tailwind 类（类名为字面量，Tailwind v4 源码扫描可拾取）。 */
export const WUXING_BAR_CLASS: Readonly<Record<WuXing, string>> = {
  木: 'bg-wuxing-mu',
  火: 'bg-wuxing-huo',
  土: 'bg-wuxing-tu',
  金: 'bg-wuxing-jin',
  水: 'bg-wuxing-shui',
};

/** 五行 → 文字 Tailwind 类。 */
export const WUXING_TEXT_CLASS: Readonly<Record<WuXing, string>> = {
  木: 'text-wuxing-mu',
  火: 'text-wuxing-huo',
  土: 'text-wuxing-tu',
  金: 'text-wuxing-jin',
  水: 'text-wuxing-shui',
};

/** 关系 → 关系标签底色类（克我/我克偏警示，其余中性）。 */
export const RELATION_BADGE_CLASS: Readonly<Record<WuxingRelation, string>> = {
  同我: 'bg-ink/10 text-ink',
  我生: 'bg-dai/10 text-dai',
  我克: 'bg-gold/20 text-ink',
  克我: 'bg-cinnabar/10 text-cinnabar',
  生我: 'bg-wuxing-mu/15 text-wuxing-mu',
};
