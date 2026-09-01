/**
 * 康熙笔画查询管线 —— 五格计算的唯一笔画来源。
 *
 * 策略（顺序固定）：
 *  ① 简体字为第一主键，kangxi-data kangxiCharDetail 直查（shunshi-kangxi-core
 *     charDetail 的构建期数据提取等价层，含 简→繁 自动映射，Workers 无 fs 可跑；
 *     与包全表对拍见 tests/wuge/kangxi-data-parity.test.ts）；
 *  ② 一简多繁且笔画不同的字（发/愿/面/台/系）走 opencc-js 文本级 cn2t 取语境字形，
 *     再查库重定笔画（例：字库直查 愿→願/14 为误，cn2t 重查 願=19）；
 *  ③ kangxi-overrides.json 补丁表覆盖字库直查冲突（萬→15、里→7），命中必留痕；
 *  ④ 库外字返回 笔画:null + 缺失标注 —— 宁可无解，不出错盘。
 *
 * 不 import next/react/fs/network；opencc-js 词典随包内联，纯函数可测。
 */

import { kangxiCharDetail } from './kangxi-data';
import { Converter } from 'opencc-js';
import overrides from '../../data/kangxi-overrides.json';

/** 来源四态：库直查 / cn2t 一简多繁 / override 补丁 / 缺失。 */
export type Kangxi来源 = '库直查' | 'cn2t' | 'override' | '缺失';

export interface KangxiHit {
  简体: string;
  繁体: string;
  笔画: number | null;
  来源: Kangxi来源;
  /** 有歧义/补丁/缺失时的说明，汇入 争议标注。 */
  争议?: string;
}

export interface KangxiTextResult {
  明细: KangxiHit[];
  /** 任一字缺失则 null（半截和数会悄悄算错五格，比无解更糟）。 */
  总笔画: number | null;
  争议标注: string[];
}

/**
 * 一简多繁白名单：仅收录「cn2t 单字结果对姓名常用义也正确、语境可进一步细化」的字。
 * 曾考虑 台/干/签/回：cn2t 单字 台→臺14、干→幹13、签→籤23 反而不如直查（台=5 合名字常用、
 * 干=3 合天干/姓干、签=簽19 合姓名学主流表），回→迴 为罕用异体，故排除，理由见交付报告。
 */
const AMBIG: Record<string, Array<{ 字: string; 画: number }>> = {
  发: [{ 字: '發', 画: 12 }, { 字: '髮', 画: 15 }],
  愿: [{ 字: '願', 画: 19 }],
  面: [{ 字: '面', 画: 9 }, { 字: '麵', 画: 20 }],
  系: [{ 字: '系', 画: 7 }, { 字: '係', 画: 9 }, { 字: '繫', 画: 19 }],
};

/** override 补丁表：过滤 _meta，仅留 单字→正整数。 */
const PATCH: Record<string, number> = Object.fromEntries(
  Object.entries(overrides).filter(
    (e): e is [string, number] => e[0] !== '_meta' && e[0].length === 1 && typeof e[1] === 'number' && e[1] > 0,
  ),
);

const cn2t = Converter({ from: 'cn', to: 't' });

/** 对文本跑 cn2t；输出长度与输入不一致时返回 null（调用方回退逐字）。 */
function convertText(text: string): string | null {
  const chars = [...text];
  const out = [...cn2t(text)];
  return out.length === chars.length ? out.join('') : null;
}

/** 覆盖补丁查询：先按繁体键（繁体直入场景），再按简体键。 */
function patchOf(简体: string, 繁体: string): { 画: number; 命中键: string } | null {
  if (繁体 in PATCH) return { 画: PATCH[繁体], 命中键: 繁体 };
  if (简体 in PATCH) return { 画: PATCH[简体], 命中键: 简体 };
  return null;
}

/** 由字库详情 + 补丁组装最终结果（来源优先级 override > 基础来源）。 */
function finish(
  简体: string,
  繁体: string,
  笔画: number,
  来源: Kangxi来源,
  争议: string | undefined,
): KangxiHit {
  const p = patchOf(简体, 繁体);
  if (p && p.画 !== 笔画) {
    const note = `「${简体}」override 补丁表：字库直查 ${繁体}/${笔画} → ${p.画}`;
    // 补丁以命中键字形计画（里=7 指「里」本身，非其映射繁体 裏）。
    return { 简体, 繁体: p.命中键, 笔画: p.画, 来源: 'override', 争议: [争议, note].filter(Boolean).join('；') };
  }
  return { 简体, 繁体, 笔画, 来源, 争议 };
}

/** 单字解析核心（不含文本语境）。 */
function resolveOne(简体: string, 语境繁体: string | null): KangxiHit {
  const base = kangxiCharDetail(简体);
  const t = 语境繁体 ?? (简体 in AMBIG ? convertText(简体) : null) ?? 简体;

  if (简体 in AMBIG && t !== 简体) {
    const d2 = kangxiCharDetail(t);
    if (d2 && d2.康熙笔画 != null) {
      const alts = AMBIG[简体].map((a) => `${a.字}(${a.画})`).join('、');
      const note = `「${简体}」一简多繁：取 ${d2.繁体}(${d2.康熙笔画})，备选 ${alts}`;
      return finish(简体, d2.繁体, d2.康熙笔画, 'cn2t', note);
    }
  }

  if (!base || base.康熙笔画 == null) {
    const p = patchOf(简体, 简体);
    if (p) return { 简体, 繁体: p.命中键, 笔画: p.画, 来源: 'override' };
    return { 简体, 繁体: 简体, 笔画: null, 来源: '缺失', 争议: `「${简体}」康熙字典库缺失，五格不可算` };
  }
  return finish(简体, base.繁体, base.康熙笔画, '库直查', undefined);
}

/** 单字查询（无文本语境；一简多繁取 cn2t 单字默认值）。 */
export function kangxiStrokesOf(char: string): KangxiHit {
  return resolveOne(char, null);
}

/**
 * 整串查询：一简多繁字在**文本级** cn2t 后按位取字形（理发→理髮、头发→頭髮），
 * 其余逐字直查。
 */
export function kangxiStrokes(text: string): KangxiTextResult {
  const chars = [...text];
  const conv = convertText(text);
  const 明细 = chars.map((c, i) => resolveOne(c, conv ? conv[i] : null));
  const 缺失或争议 = 明细.map((h) => h.争议).filter((s): s is string => Boolean(s));
  return {
    明细,
    总笔画: 明细.every((h) => h.笔画 != null) ? 明细.reduce((a, h) => a + (h.笔画 as number), 0) : null,
    争议标注: [...new Set(缺失或争议)],
  };
}
