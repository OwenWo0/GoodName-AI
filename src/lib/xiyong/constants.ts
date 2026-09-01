/**
 * 喜用神模块静态数据表 —— 干/支五行、藏干、生克关系、旺衰净分计分表、分档阈值、
 * 调候优先月、格局门最小查表（三合/三会）、五行力量权重。
 *
 * 口径说明：
 * - GAN_WUXING / ZHI_CANGGAN 与 lunar-typescript 的 LunarUtil 输出口径一致，但本模块
 *   必须零依赖（不 import lunar-typescript，见架构文档「依赖方向」），故在此镜像一份；
 *   一致性由 tests/bazi/dual-engine.test.ts 的双引擎对比兜底。
 * - 旺衰为**净分制**（可负）：得令带符号（月令定格）、得地通根（只加不减）、得势净额（克泄耗为负）。
 *   与 bazi.ts 五行力量表（供展示/五行缺失）是两套独立口径，互不消费。
 * - 所有表 Object.freeze，调用方禁止改动。
 */
import type { WuXing } from '../types';

/** 五行相生序（固定输出顺序，sortWx 的基准）。 */
export const WUXING_ORDER: readonly WuXing[] = Object.freeze(['木', '火', '土', '金', '水'] as WuXing[]);

/** 天干 → 五行。 */
export const GAN_WUXING: Readonly<Record<string, WuXing>> = Object.freeze({
  甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水',
});

/** 地支藏干（本气在前；顺序与 lunar-typescript ZHI_HIDE_GAN 一致）。 */
export const ZHI_CANGGAN: Readonly<Record<string, readonly string[]>> = Object.freeze({
  子: ['癸'], 丑: ['己', '癸', '辛'], 寅: ['甲', '丙', '戊'], 卯: ['乙'],
  辰: ['戊', '乙', '癸'], 巳: ['丙', '戊', '庚'], 午: ['丁', '己'], 未: ['己', '丁', '乙'],
  申: ['庚', '壬', '戊'], 酉: ['辛'], 戌: ['戊', '辛', '丁'], 亥: ['壬', '甲'],
});

/** 五行相生：X 生 SHENG[X]。 */
export const SHENG: Readonly<Record<WuXing, WuXing>> = Object.freeze({
  木: '火', 火: '土', 土: '金', 金: '水', 水: '木',
});

/** 五行相克：X 克 KE[X]。 */
export const KE: Readonly<Record<WuXing, WuXing>> = Object.freeze({
  木: '土', 土: '水', 水: '火', 火: '金', 金: '木',
});

/** 藏干三位的层级名（首字=主气/本气，两位=中气，三位起=余气）。 */
export type CangCeng = '主气' | '中气' | '余气';

/** 得令生克关系名（月支藏干五行 对 日主五行）。 */
export type ShengKeRelation = '同我' | '生我' | '我生' | '我克' | '克我';

/**
 * 得令计分表（净分制，带符号）——「月令定格」：分值按 月支藏干五行 与 日主五行 的生克关系取：
 * 同我+45 / 生我+35 / 我生0 / 我克−15 / 克我−30。
 * 中气/余气仅**负分侧**按 DELING_CENG_RATIO 折减计入（失令之克伐即伤月令），
 * 正分侧中余气不另加——生扶之力已由得地通根/得势承担，避免三重计分
 * （依据与判别测试见 wangshuai.ts 分析得令 注释、验收报告 §④）。
 */
export const DELING_FEN: Readonly<Record<ShengKeRelation, number>> = Object.freeze({
  同我: 45, 生我: 35, 我生: 0, 我克: -15, 克我: -30,
});

/** 得令满分基准（月支本气同我）。 */
export const DELING_QUAN = 45;

/** 月支中气/余气折减系数（仅负分侧适用，见 DELING_FEN 注释）。 */
export const DELING_CENG_RATIO: Readonly<Record<'中气' | '余气', number>> = Object.freeze({ 中气: 0.5, 余气: 0.25 });

/**
 * 得地计分表（通根只加不减，维持旧口径不动）：行=柱位，列=藏干层级；
 * 与日主同五行的藏干计该分；月支主气为 0 分（月令之功归得令，避免重复计分），月支中余气保留小分。
 */
export const DEDI_FEN: Readonly<Record<'日' | '月' | '年' | '时', Record<CangCeng, number>>> = Object.freeze({
  日: { 主气: 12, 中气: 6, 余气: 3 },
  月: { 主气: 0, 中气: 3, 余气: 2 },
  年: { 主气: 8, 中气: 4, 余气: 2 },
  时: { 主气: 8, 中气: 4, 余气: 2 },
});

/** 得地满分基准（日主通根四支全部取最高层级相加：12+0+8+8）。 */
export const DEDI_QUAN = 30;

/**
 * 得势计分表（净分制）：透干按十神类别 × 贴隔取分（贴=月干/时干紧贴日主，隔=年干），
 * 官杀财食伤克泄耗日主为负分；另有「无根生扶支」+4（主气生扶日主而不藏日主本气的地支，
 * 通根者归得地不重复计）。合计 clamp 到 [DESHI_FLOOR, DESHI_QUAN]。
 */
export const DESHI_FEN: Readonly<{
  比劫: { 贴: number; 隔: number };
  印星: { 贴: number; 隔: number };
  官杀: { 贴: number; 隔: number };
  财星: { 贴: number; 隔: number };
  食伤: { 贴: number; 隔: number };
  无根生扶支: number;
}> = Object.freeze({
  比劫: { 贴: 8, 隔: 6 },
  印星: { 贴: 6, 隔: 5 },
  官杀: { 贴: -8, 隔: -6 },
  财星: { 贴: -6, 隔: -4 },
  食伤: { 贴: -5, 隔: -3 },
  无根生扶支: 4,
});

/** 得势净额上限/下限（超出按钳位计，钳位写入 明细）。 */
export const DESHI_QUAN = 30;
/** 防御性钳位死分支（评审一轮结论）：现权重组合下可达下界高于此地板，永不触发；保留作保险、勿删。 */
export const DESHI_FLOOR = -30;

/** 旺衰五等等级。 */
export type QiangRuoLevel = '身强' | '偏强' | '中和' | '偏弱' | '身弱';

/**
 * 旺衰分档阈值（净分制重钉，2026-08 喜用神算法修复）：
 * [下限, 等级] 降序匹配；≥55 身强 / ≥20 偏强 / ≥−15 中和 / ≥−45 偏弱 / ≥−60（其余）身弱。
 * 钉档依据（验收报告 §④）：F3 盘【庚午 戊寅 甲午 庚午】实算 21.25 须落 {偏强,身强}
 * ——任务书草案线 25 被实算否决，偏强线取 20（F3 与身强线 55 的中缝由浅入深的第一整数带）。
 */
export const FENDANG_TIERS: readonly [number, QiangRuoLevel][] = Object.freeze([
  [55, '身强'],
  [20, '偏强'],
  [-15, '中和'],
  [-45, '偏弱'],
  [-60, '身弱'],
] as const);

/** 净分制分档：降序找首个 ≥ 下限的档；低于末档下限仍归身弱（末档为兜底）。 */
export function fenDang(得分: number): QiangRuoLevel {
  for (const [下限, 等级] of FENDANG_TIERS) {
    if (得分 >= 下限) return 等级;
  }
  return '身弱';
}

/** 调候优先月支（冬夏月寒燥，调候为急）。 */
export const YOUXIAN_MONTHS: readonly string[] = Object.freeze(['亥', '子', '丑', '巳', '午', '未'] as const);

/**
 * 五行力量权重（全盘计数口径，供格局门力量对比与 bazi 五行力量表）——
 * bazi.ts 的 wuXingForceWeights 从本表 re-export，保证两模块同源。
 */
export const FORCE_WEIGHTS = Object.freeze({
  干: 100,
  月支本气: 120,
  月支中气: 48,
  月支余气: 24,
  他支本气: 100,
  他支中气: 40,
  他支余气: 20,
});

/**
 * 三合局局支 → 五行 最小查表——仅供格局门（从格「月支参与所从神」判定）使用。
 * 禁区约定：六冲/三合全关系/十二长生等完整关系表属 P2，此处钉最小集勿扩。
 */
export const SANHE_ZHI: Readonly<Record<string, WuXing>> = Object.freeze({
  亥: '木', 卯: '木', 未: '木',
  寅: '火', 午: '火', 戌: '火',
  巳: '金', 酉: '金', 丑: '金',
  申: '水', 子: '水', 辰: '水',
});

/** 三会方方支 → 五行 最小查表（同上，仅供格局门）。 */
export const SANHUI_ZHI: Readonly<Record<string, WuXing>> = Object.freeze({
  寅: '木', 卯: '木', 辰: '木',
  巳: '火', 午: '火', 未: '火',
  申: '金', 酉: '金', 戌: '金',
  亥: '水', 子: '水', 丑: '水',
});
