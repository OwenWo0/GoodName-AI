/**
 * M3 候选池私有类型。契约字段（PoolCandidate）直接取 ChartResult.candidates 元素类型，
 * 结构漂移在编译期即被拦住；池的输入/输出类型放本目录，不动 src/lib/types.ts。
 */
import type { WuXing, ChartResult, XiyongMingXiItem } from '@/lib/types';

/** 与 ChartResult.candidates 条目完全同构（禁止另行复制字段定义）。 */
export type PoolCandidate = ChartResult['candidates'][number];

/** 辈字：名内某一位强制锁定为该字。 */
export interface BeiZiLock {
  字: string;
  /** 1 = 名第一字，2 = 名第二字。仅双名可用。 */
  位置: 1 | 2;
}

/** 指定字位置（契约 v3 §1.1）：任一=两遍 union；第一/第二=单遍锁位。 */
export type 指定字位置 = '任一' | '第一' | '第二';

/** 指定字（契约 v3 §0 裁决 1）：硬约束——候选名部必含该字，无合规组合→空态，算法绝不偷偷放宽。 */
export interface 指定字锁定 {
  字: string;
  位置: 指定字位置;
}

/** buildPool 输入（自定义，勿与 ChartResult.输入 混用）。 */
export interface PoolInput {
  /** 单姓或复姓串（1-2 字）。 */
  姓氏: string;
  /** 契约透传字段：v1 算法不消费，保留供上层与 v2 爆款性别榜。 */
  性别: '男' | '女';
  /** 喜用神五行（来自 xiyongshen 输出。「缺≠补」：过滤/评分按喜用神，不按缺失）。 */
  喜用神: WuXing[];
  /** 忌神：命中重罚，双字皆忌剔除。 */
  忌神?: WuXing[];
  /**
   * 喜用神十神明细（来自 XiyongshenResult.喜用神明细）。角色=次用的五行在评分中 +7
   * 替代主用 +14（并立但非主药）；缺省时全部按 +14 旧口径。过滤仍按 喜用神 全集。
   */
  喜用神明细?: XiyongMingXiItem[];
  名字形式: '单名' | '双名';
  辈字?: BeiZiLock;
  /** 指定字（契约 v3 §1.1）：名部硬约束含该字；与辈字可共存（同字 no-op、异字双锁，见 pool.ts planPasses）。 */
  指定字?: 指定字锁定;
  避讳字?: readonly string[];
  禁用字?: readonly string[];
  /**
   * 「重新生成」排重（任务 #28）：已呈候选的名部串（不含姓，1-4 字）集合。
   * 终筛组装期（shortlist→PoolCandidate）剔除 名 ∈ 本集 的组合；池被排空时
   * 自然返回更少/为空候选，不抛错。不改初筛/海选——确定性算法下同输入仍同输出。
   */
  排除已选?: readonly string[];
  /** 默认 40，钳制 1-100。 */
  期望候选数?: number;
}

/** 逐字档案（char-wuxing.json 行 + 爆款权重注入后的不可变视图）。 */
export interface CharInfo {
  readonly 字: string;
  readonly 五行: WuXing;
  /** 五行来源标注（康熙五行库 / 部首X / 笔画尾数法），进 入选依据 可核对。 */
  readonly 来源: string;
  readonly 康熙笔画: number;
  /** 第一读音声调 1-5（轻声=5），仅用于海选期平仄粗评；终稿以 buildPingzeResult 为准。 */
  readonly 声调: number;
  readonly 多音: boolean;
  /** 0-1 爆款权重（buzz-names.json chars 表，0=无据不降权）。 */
  readonly 爆款权重: number;
  /** 通用规范汉字表常用级：1=一级(3500) 2=二级 3=三级 0=表外（生僻，重罚）。 */
  readonly 常用级: 0 | 1 | 2 | 3;
  /** 名字语料频次（name-char-freq.json，剥姓后名部计数；0=表外无据不加分）。常用级=识字频率，此字段才是名字宜用度。 */
  readonly 名字频率: number;
}

/** 一次建池的中间规模统计（可观测性：证明海选没退化成全量精算）。 */
export interface PoolStats {
  readonly 初筛字数: number;
  readonly 可行笔画组合: number;
  readonly 海选对数: number;
  readonly 谐音剔除数: number;
  /** 终筛组装期因 排除已选 命中而剔除的组合数（可观测性：证明排重发生在终筛而非静默）。 */
  readonly 排除剔除数: number;
}

export interface PoolResult {
  readonly 候选: readonly PoolCandidate[];
  readonly 统计: PoolStats;
}

/** 池内五要素枚举。 */
export const 五行全集: readonly WuXing[] = ['木', '火', '土', '金', '水'];
