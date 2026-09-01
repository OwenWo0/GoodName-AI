/**
 * 笔画组合枚举 —— 海选期「格数算术」，只查 81 数理表与三才表，**不调 computeWuge**。
 *
 * 性能关键：五格由「笔画和」唯一决定（天格姓定、人格=姓末+名一、地格=名一+名二或单名+1、
 * 总格=全和、外格=总−人+1，单姓单名恒 2 —— 与 geju.ts 逐式一致），先按笔画值（≤64 档）
 * 枚举组合剪掉大凶，再只对终筛 TopK 组装真 WugeResult。
 */
import shuliJson from '@/data/shuli-81.json';
import sancaiJson from '@/data/sancai.json';
import { reduceShuli, shuliWuxing } from '@/lib/wuge/geju';

type 吉凶 = '大吉' | '吉' | '半吉' | '凶' | '末定';

interface ShuliEntry { 吉凶: 吉凶 }
interface SancaiEntry { 吉凶: string }

const SHULI = shuliJson.数理 as unknown as Record<string, ShuliEntry>;
const SANCAI = sancaiJson.配置 as unknown as Record<string, SancaiEntry>;

/** 数理吉凶评分（天格姓传不评：天格由姓氏继承，姓名学惯例不计名运）。 */
const 吉格分: Record<吉凶, number> = { 大吉: 10, 吉: 7, 半吉: 3, 凶: -12, 末定: 0 };
const 三才分: Record<string, number> = { 大吉: 8, 吉: 6, 半吉: 2, 凶: -10, 大凶: -16 };

export interface ComboScore {
  /** 名第一字康熙笔画（单名时即该名字笔画）。 */
  readonly s1: number;
  /** 名第二字康熙笔画；单名为 null。 */
  readonly s2: number | null;
  readonly 分: number;
  /** 人/地/总/外/三才 人话断语，直接进 入选依据。 */
  readonly 依据: readonly string[];
}

function 断语(标签: string, raw: number): { 分: number; 文: string; 凶: boolean } {
  const n = reduceShuli(raw);
  const e = SHULI[String(n)];
  if (!e) throw new Error(`数理表缺 ${n}（检查 shuli-81.json）`);
  return { 分: 吉格分[e.吉凶], 文: `${标签}${n}${e.吉凶}(${shuliWuxing(n)})`, 凶: e.吉凶 === '凶' };
}

export interface 姓骨架 {
  /** 天格原始值。 */
  readonly 天格: number;
  readonly 姓末笔画: number;
  readonly 姓笔画和: number;
  readonly 单姓: boolean;
}

/** 由姓氏康熙笔画数组（1-2 元素）建骨架，公式与 geju.ts computeWuge 逐式对齐。 */
export function 姓骨架Of(姓笔画: readonly number[]): 姓骨架 {
  const 单姓 = 姓笔画.length === 1;
  return {
    天格: 单姓 ? 姓笔画[0] + 1 : 姓笔画[0] + 姓笔画[1],
    姓末笔画: 姓笔画[姓笔画.length - 1],
    姓笔画和: 姓笔画.reduce((a, b) => a + b, 0),
    单姓,
  };
}

function 三才断(天格: number, 人: number, 地: number): { 分: number; 文: string; 大吉凶: boolean } {
  const combo = `${shuliWuxing(天格)}${shuliWuxing(人)}${shuliWuxing(地)}`;
  const e = SANCAI[combo];
  if (!e) throw new Error(`三才配置表缺 ${combo}（检查 sancai.json）`);
  return { 分: 三才分[e.吉凶] ?? 0, 文: `三才${combo}${e.吉凶}`, 大吉凶: e.吉凶 === '大凶' };
}

/** 剪枝口径：人格/地格/总格任一数理「凶」或三才「大凶」→ 整组剔除（海选硬红线，其余软扣分）。 */
function evalCombo(骨架: 姓骨架, s1: number, s2: number | null): ComboScore | null {
  const 人 = 骨架.姓末笔画 + s1;
  const 地 = s2 == null ? s1 + 1 : s1 + s2;
  const 总 = 骨架.姓笔画和 + s1 + (s2 ?? 0);
  const 外 = 骨架.单姓 && s2 == null ? 2 : 总 - 人 + 1;

  const 人D = 断语('人格', 人);
  const 地D = 断语('地格', 地);
  const 总D = 断语('总格', 总);
  const 外D = 断语('外格', 外);
  if (人D.凶 || 地D.凶 || 总D.凶) return null;
  const 三 = 三才断(骨架.天格, 人, 地);
  if (三.大吉凶) return null;

  return {
    s1,
    s2,
    分: 人D.分 + 地D.分 + 总D.分 + 外D.分 + 三.分,
    依据: [人D.文, 地D.文, 总D.文, 外D.文, 三.文],
  };
}

/**
 * 枚举全部可行 (s1,s2) 组合。strokeSet = 字库实际存在的笔画值集合（预剪：无字笔画不参与）。
 * 双名：对 strokeSet×strokeSet；单名：仅 s2=null 轴。
 */
export function enumerateCombos(
  骨架: 姓骨架,
  strokeSet: readonly number[],
  形式: '单名' | '双名',
): ReadonlyMap<string, ComboScore> {
  const out = new Map<string, ComboScore>();
  if (形式 === '单名') {
    for (const s1 of strokeSet) {
      const c = evalCombo(骨架, s1, null);
      if (c) out.set(`${s1}`, c);
    }
    return out;
  }
  for (const s1 of strokeSet) {
    for (const s2 of strokeSet) {
      const c = evalCombo(骨架, s1, s2);
      if (c) out.set(`${s1},${s2}`, c);
    }
  }
  return out;
}
