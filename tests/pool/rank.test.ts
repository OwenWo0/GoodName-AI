/**
 * rank.ts 纯函数单测：爆款度公式、平仄加分、排序 tie-break 确定性。
 */
import { describe, expect, it } from 'vitest';
import {
  buzzOfName, pingzeBonusOf, compareDraft, charStaticScore, 常用级加分, 名字宜用加分, type DraftCandidate,
} from '@/lib/pool/rank';
import type { CharInfo } from '@/lib/pool/types';

const 权重: Record<string, number> = { 宇: 0.9, 宸: 0.85, 汐: 0.85, 沐: 0.75, 怀: 0, 之: 0 };
const w = (ch: string): number => 权重[ch] ?? 0;

describe('buzzOfName 爆款度', () => {
  it('双爆款字 > 单爆款字 > 无爆款字', () => {
    const hi = buzzOfName('宇宸', w, false);
    const mid = buzzOfName('宇怀', w, false);
    const lo = buzzOfName('怀之', w, false);
    expect(hi).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(lo);
    expect(lo).toBe(0);
  });

  it('名字整体命中爆款榜 → 满分 1', () => {
    expect(buzzOfName('宇宸', w, true)).toBe(1);
  });

  it('值域恒在 0-1', () => {
    expect(buzzOfName('宇宸', w, true)).toBeLessThanOrEqual(1);
    expect(buzzOfName('宇宸', w, false)).toBeGreaterThanOrEqual(0);
  });
});

describe('pingzeBonusOf 平仄加分', () => {
  it('名内平仄交替加分，全平全仄无加分', () => {
    expect(pingzeBonusOf([4, 2], 1)).toBeGreaterThan(pingzeBonusOf([1, 2], 1));
    expect(pingzeBonusOf([4, 2], 1)).toBeGreaterThan(pingzeBonusOf([4, 3], 1));
  });

  it('全名（含姓）同调一锅端要扣分', () => {
    expect(pingzeBonusOf([1, 2], 2)).toBeLessThan(pingzeBonusOf([1, 2], 4));
    expect(pingzeBonusOf([3, 4], 1)).toBeGreaterThan(pingzeBonusOf([3, 4], 3));
  });

  it('姓氏声调未知时不做全名惩罚，仅看名内交替', () => {
    expect(pingzeBonusOf([4, 2], null)).toBe(pingzeBonusOf([4, 2], 1));
    expect(pingzeBonusOf([1, 2], null)).toBeGreaterThanOrEqual(0);
  });
});

describe('charStaticScore 常用级与喜忌', () => {
  const zi = (over: Partial<CharInfo> = {}): CharInfo => ({
    字: '沐', 五行: '水', 来源: '康熙五行库', 康熙笔画: 8, 声调: 4, 多音: false, 爆款权重: 0, 常用级: 1, 名字频率: 0, ...over,
  });
  const 空 = new Set<string>() as ReadonlySet<CharInfo['五行']>;

  it('名字宜用度是正面信号：高频>表外，且分档单调不减', () => {
    expect(charStaticScore(zi({ 名字频率: 5000 }), 空, 空)).toBeGreaterThan(charStaticScore(zi(), 空, 空));
    expect(charStaticScore(zi({ 名字频率: 0 }), 空, 空)).toBe(charStaticScore(zi(), 空, 空));
    const 档 = [0, 5, 30, 100, 300, 1000, 4000].map(名字宜用加分);
    for (let i = 1; i < 档.length; i++) expect(档[i]).toBeGreaterThanOrEqual(档[i - 1]!);
  });

  it('常用级严格定序：一级 > 二级 > 三级 > 表外（防生僻字与冷僻字同酬）', () => {
    const s = (级: 0 | 1 | 2 | 3): number => charStaticScore(zi({ 常用级: 级 }), 空, 空);
    expect(s(1)).toBeGreaterThan(s(2));
    expect(s(2)).toBeGreaterThan(s(3));
    expect(s(3)).toBeGreaterThan(s(0));
    expect(常用级加分[0]).toBeLessThan(0);
  });

  it('喜用神命中加分、忌神减分、多音减分', () => {
    const 水 = new Set<CharInfo['五行']>(['水']);
    expect(charStaticScore(zi(), 水, 空)).toBeGreaterThan(charStaticScore(zi(), 空, 空));
    expect(charStaticScore(zi(), 空, 水)).toBeLessThan(charStaticScore(zi(), 空, 空));
    expect(charStaticScore(zi({ 多音: true }), 空, 空)).toBeLessThan(charStaticScore(zi(), 空, 空));
  });

  it('次用+7 恰为主用+14 之半；忌−12（喜用神算法修复 C.4 钉值）', () => {
    const 水 = new Set<CharInfo['五行']>(['水']);
    const 基 = charStaticScore(zi(), 空, 空);
    expect(charStaticScore(zi(), 水, 空) - 基).toBe(14); // 主用（喜用神集）
    expect(charStaticScore(zi(), 空, 空, 水) - 基).toBe(7); // 次用（明细角色=次用）
    expect(charStaticScore(zi(), 空, 水) - 基).toBe(-12); // 忌神
  });

  it('次用集缺省 = 旧口径（旧调用方零改动）；次用优先于喜用（并立盘角色互斥的防御钉）', () => {
    const 水 = new Set<CharInfo['五行']>(['水']);
    expect(charStaticScore(zi(), 空, 空, undefined)).toBe(charStaticScore(zi(), 空, 空));
    expect(charStaticScore(zi(), 水, 空, 水)).toBe(charStaticScore(zi(), 空, 空, 水)); // 同字双列 → 按次用 7
  });

  it('良名字集加分与性别加减分', () => {
    const 婷 = zi({ 字: '婷', 名字频率: 5000 });
    const 刚 = zi({ 字: '刚', 名字频率: 5000 });
    const 泽 = zi({ 字: '泽', 名字频率: 5000 });
    const 良名集 = new Set(['泽']);

    // 良名集加分
    expect(charStaticScore(泽, 空, 空, undefined, undefined, 良名集) - charStaticScore(泽, 空, 空)).toBe(8);

    // 女孩起名：婷(女+6) > 刚(女-25)
    expect(charStaticScore(婷, 空, 空, undefined, '女')).toBeGreaterThan(charStaticScore(刚, 空, 空, undefined, '女'));
    // 男孩起名：刚(男+6) > 婷(男-25)
    expect(charStaticScore(刚, 空, 空, undefined, '男')).toBeGreaterThan(charStaticScore(婷, 空, 空, undefined, '男'));
  });
});

const draft = (名: string, 分: number, 笔画和 = 10): DraftCandidate => ({
  名, 分, 笔画和, 五行: ['木'], 爆款度: 0, 依据: [],
});

describe('compareDraft 确定性排序', () => {
  it('高分在前', () => {
    expect(compareDraft(draft('乙', 9), draft('甲', 8))).toBeLessThan(0);
  });

  it('同分先比笔画和（少在前）', () => {
    expect(compareDraft(draft('乙', 9, 8), draft('甲', 9, 20))).toBeLessThan(0);
  });

  it('同分同笔画按 Unicode 码点定序（无 Math.random，全稳定）', () => {
    // 乙 U+4E59 < 甲 U+7532 → 「乙甲」码点序在前。
    const a = draft('乙甲', 9, 10);
    const b = draft('甲乙', 9, 10);
    expect(compareDraft(a, b)).toBeLessThan(0);
    expect(compareDraft(b, a)).toBeGreaterThan(0);
    expect(compareDraft(a, a)).toBe(0);
  });
});
