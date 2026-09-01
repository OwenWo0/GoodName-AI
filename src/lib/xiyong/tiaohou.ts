/**
 * 调候用神查询：《穷通宝鉴》10 干 × 12 月 = 120 条静态表（src/data/tiaohou.json）。
 *
 * 表的 调候五行 保留原文先后次第（如「丁先庚后」→ [火,金]），不做五行枚举排序，
 * 供 AI 层按顺序加权；来源与校勘记见 JSON._meta。
 * 查询返回拷贝，调用方修改不会污染模块级数据。
 */
import type { WuXing } from '../types';
import 调候数据 from '../../data/tiaohou.json';

interface TiaoHouEntry {
  日主: string;
  月支: string;
  调候五行: string[];
  依据: string;
}

interface TiaoHouFile {
  _meta: { 来源: string; 校勘记: string[] };
  表: TiaoHouEntry[];
}

const 索引: ReadonlyMap<string, TiaoHouEntry> = new Map(
  (调候数据 as TiaoHouFile).表.map((e) => [`${e.日主}-${e.月支}`, e])
);

/** 调候查询结果：五行（原文次第）+ 依据（原文出处择要）。 */
export interface TiaoHouResult {
  五行: WuXing[];
  依据: string;
}

/**
 * 按 日主 + 月支 查调候用神。
 * @throws 干支不在十天干/十二地支组合内（数据缺漏或调用方传错）。
 */
export function findTiaohou(日主: string, 月支: string): TiaoHouResult {
  const entry = 索引.get(`${日主}-${月支}`);
  if (!entry) throw new Error(`调候表缺条目：${日主}日生${月支}月`);
  return { 五行: [...entry.调候五行] as WuXing[], 依据: entry.依据 };
}
