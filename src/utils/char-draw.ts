/**
 * 单字抽卡（契约 v3 §3.1）—— 纯函数、注入式 rng（仿 SnapshotStorage 范式）。
 * lib 禁 Math.random 纪律不破：随机源由 ctx.rng 注入，本文件零 React、零 Date、
 * 零 Math.random、不 import CharDB（库自带五行）。
 * 语义：排除字过滤 → 喜用神非空时先滤五行∈喜用神、滤空回退全集（回退亦不越过
 * 排除字）→ Math.floor(rng()*候选.length) 等概率取一；空库/全排除 → null。
 * 不可变纪律：filter 产新数组，绝不 mutate 入参。
 */

/** 好意向字（与契约 v3 §2 形状一致；本文件自带声明，不跨 agent import）。 */
export interface 好意向字 {
  字: string;
  五行: '木' | '火' | '土' | '金' | '水';
  意向标签: string[];
  寓意: string;
}

/** 抽卡上下文。rng ∈ [0,1)（UI 层用 crypto.getRandomValues 适配）。 */
export interface 抽卡CTX {
  喜用神?: readonly string[];
  排除字?: readonly string[];
  rng: () => number;
}

/**
 * 从好意向字库抽一个字（契约 v3 §3.1）。
 * 排除字先滤（硬剔，喜用回退也不放宽）；喜用神滤空 → 回退排除后的全集；
 * 仍空（空库/全排除）→ null。
 */
export function 抽卡(库: readonly 好意向字[], ctx: 抽卡CTX): 好意向字 | null {
  const 排除 = new Set(ctx.排除字 ?? []);
  const 候选 = 库.filter((c) => !排除.has(c.字));
  if (候选.length === 0) return null;

  const 喜用 = ctx.喜用神 ?? [];
  const 喜用候选 = 喜用.length === 0 ? [] : 候选.filter((c) => 喜用.includes(c.五行));
  const 抽取池 = 喜用候选.length > 0 ? 喜用候选 : 候选;

  return 抽取池[Math.floor(ctx.rng() * 抽取池.length)] ?? null;
}
