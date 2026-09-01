/**
 * 契约 v2（lead 冻结，见 docs/契约v2-意向吉名与名人匹配.md）：
 * 名人库条目（src/data/mingren-names.json）与名人匹配（POST /api/mingren-match）形状。
 * 出处诚实铁律：出处只写真实可考来源；当代人物一律 出处类型='公开资料'，宁缺毋滥。
 */
import type { EvaluatedName } from '@/lib/evaluate/types';

export const 出处类型枚举 = ['史传', '科第录', '方志', '公开资料'] as const;
export type 出处类型 = (typeof 出处类型枚举)[number];

export const 名人类别枚举 = [
  '文人',
  '进士',
  '艺术家',
  '科学家',
  '院士',
  '企业家',
  '政治家',
  '其他',
] as const;
export type 名人类别 = (typeof 名人类别枚举)[number];

/** 库条目：名部（不含姓）为匹配单位。 */
export interface MingrenEntry {
  /** 1-2 汉字（复姓可 2 字），仅作展示「原名」用，不参与匹配。 */
  readonly 姓: string;
  /** 1-2 汉字，匹配单位。 */
  readonly 名: string;
  /** 自由文本，如 '北宋' / '当代'。 */
  readonly 时代: string;
  readonly 类别: 名人类别;
  /** ≤30 字，一句话事实，不作评价。 */
  readonly 简介: string;
  /** 真实可考出处，如 '《宋史·苏轼传》' / '中国科学院官网院士名单'。 */
  readonly 出处: string;
  readonly 出处类型: 出处类型;
}

/** 候选卡上的来源条目 = 库条目去掉匹配语义后的展示投影（形状同 MingrenEntry）。 */
export type 名人出处 = MingrenEntry;

/** 名人匹配候选 = 通用评估形状 + 同名部的全部出处（≥1 人，多人并列）。 */
export interface MingrenCandidate extends EvaluatedName {
  readonly 出处: readonly 名人出处[];
}

/** POST /api/mingren-match 成功响应。 */
export interface MingrenMatchResult {
  readonly 候选: readonly MingrenCandidate[];
  /** 库总人数（诊断展示用）。 */
  readonly 库规模: number;
  /** 过滤前按名部+长度命中的不同名数。 */
  readonly 命中名数: number;
}
