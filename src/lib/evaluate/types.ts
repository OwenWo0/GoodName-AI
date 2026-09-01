/**
 * 契约 v2（lead 冻结，见 docs/契约v2-意向吉名与名人匹配.md）：
 * 任意名评估（POST /api/evaluate-names 与 /api/mingren-match 共用的候选形状）。
 * 本文件为唯一事实源——实现方与消费方都以此为准，改形状须 lead 批准。
 */
import type { PingzeResult, WuXing, WugeResult } from '@/lib/types';

/** 单次请求名单上限（与 排除已选 max(300) 同为纵深防御；v2.2 起 30→100，覆盖意向名单满编 60 一程送评）。 */
export const EVALUATE_NAMES_MAX = 100;

export type 契合档位 = '上' | '中上' | '中' | '下';

/** 名字与当前盘喜忌的契合评估（展示口径；分不含爆款/多音等海选信号）。 */
export interface 契合评估 {
  /** 逐字命中喜用神（主药）的五行，按字序。 */
  readonly 命中喜用: readonly WuXing[];
  /** 逐字命中次用的五行，按字序（角色=次用，见 XiyongMingXiItem）。 */
  readonly 命中次用: readonly WuXing[];
  /** 逐字命中忌神的五行，按字序。 */
  readonly 命中忌神: readonly WuXing[];
  readonly 档位: 契合档位;
  /** charStaticScore 的 喜+次+忌 三项之和（可负）。 */
  readonly 分: number;
  /** 人话注记（犯避讳字、表外字提示等），可为空数组。 */
  readonly 说明: readonly string[];
}

/** 单个名字的完整评估：平仄 + 五格 + 爆款度 + 喜忌契合。 */
export interface EvaluatedName {
  /** 名部（不含姓），1-2 汉字。 */
  readonly 名: string;
  /** 非标准字集的字（警告不剔除——意向评估如实呈报；名人匹配场景在过滤链已剔除，此处恒空）。 */
  readonly 表外字: readonly string[];
  readonly 五行: readonly WuXing[];
  readonly 平仄: PingzeResult;
  /** 表外字致笔画不可得时 null（消费方必须判空）。 */
  readonly 五格: WugeResult | null;
  readonly 爆款度: number;
  readonly 契合: 契合评估;
}
