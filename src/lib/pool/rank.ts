/**
 * 海选评分纯函数 —— 爆款度、平仄加分、字符静态分、确定性排序。
 * 全部无 IO、无随机；同输入同序（tie-break：分 → 笔画和 → Unicode 码点）。
 */
import type { WuXing } from '@/lib/types';
import type { CharInfo } from './types';

/** 排序用的海选草案（终筛 TopK 才升级为 PoolCandidate）。 */
export interface DraftCandidate {
  readonly 名: string;
  readonly 分: number;
  readonly 笔画和: number;
  readonly 五行: WuXing[];
  readonly 爆款度: number;
  readonly 依据: string[];
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/**
 * 名字级爆款度：整体命中爆款榜 → 1；否则 0.65×max(逐字权重) + 0.25×mean(逐字权重)。
 * 权重来自 buzz-names.json（公安部年度姓名报告口径，表外字=0 不降权）。
 */
export function buzzOfName(名: string, charWeight: (ch: string) => number, inNames: boolean): number {
  if (inNames) return 1;
  const ws = [...名].map(charWeight);
  if (ws.length === 0) return 0;
  const max = Math.max(...ws);
  const mean = ws.reduce((a, b) => a + b, 0) / ws.length;
  return clamp01(0.65 * max + 0.25 * mean);
}

const isPing = (tone: number): boolean => tone === 1 || tone === 2;

/**
 * 平仄加分（海选期用字表第一读音近似；终稿平仄以 buildPingzeResult 为准）：
 * 双名名内平仄交替 +6；全名（含姓）清一色平或仄 -6（姓氏声调未知则免评全名项）。
 */
export function pingzeBonusOf(nameTones: readonly number[], 姓Tone: number | null): number {
  let bonus = 0;
  if (nameTones.length === 2 && isPing(nameTones[0]) !== isPing(nameTones[1])) bonus += 6;
  if (姓Tone != null) {
    const 调 = [姓Tone, ...nameTones];
    const 全平 = 调.every(isPing);
    const 全仄 = 调.every((t) => !isPing(t));
    if (全平 || 全仄) bonus -= 6;
  }
  return bonus;
}

/**
 * 名字宜用度加分（name-char-freq.json = CNC 120W 剥姓名部计数，对数感分档）。
 * 背景：常用级=识字频率≠名字频率（僻/噩皆一级常用字），静态分并列时码点 tie-break
 * 会把 literacy 中性字推上榜；本项是唯一的「正面」名字信号，与爆款惩罚对冲。
 * 0=表外无据不加分（宁缺毋滥：低频不等于坏，只是无正面证据）。
 */
export function 名字宜用加分(名字频率: number): number {
  if (名字频率 >= 1000) return 10;
  if (名字频率 >= 300) return 7;
  if (名字频率 >= 100) return 5;
  if (名字频率 >= 30) return 2.5;
  if (名字频率 >= 5) return 1;
  return 0;
}

/** 常见强女性特征字（男童起名重罚，女童起名契合加分）。 */
export const 强女性用字: ReadonlySet<string> = new Set([
  '婷', '娜', '娟', '娴', '娥', '娆', '妍', '姝', '妃', '娣', '婵', '媚', '娅', '嫣', '婕',
  '婉', '芳', '芝', '蓉', '萍', '莲', '菊', '茜', '蕾', '莉', '荷', '菲', '萱', '萌', '芸',
  '芷', '菁', '蓓', '绣', '珊', '琼', '玲', '瑶', '翠', '凤', '倩', '黛', '娇', '缨', '嫒',
  '媛', '滢', '淑', '妙', '姿', '曼', '晴', '雯', '颖', '怡', '绮', '汐', '芹', '茹', '嫦',
  '俪', '宓', '妮', '蝶', '莺', '玫', '姬', '妤', '姣', '蕊',
]);

/** 常见强男性特征字（女童起名重罚，男童起名契合加分）。 */
export const 强男性用字: ReadonlySet<string> = new Set([
  '刚', '勇', '猛', '雄', '霸', '魁', '豪', '彪', '毅', '坚', '峰', '壮', '磊', '兵', '军',
  '胜', '强', '伟', '武', '勃', '焘', '震', '霆', '凯', '韬', '栋', '柱', '楠', '坤', '钧',
  '铎', '锋', '钊', '鹏', '浩', '瀚', '航', '朗', '琛', '峻', '渊', '旭', '翔', '鸿', '冠',
  '策', '崇', '勋', '驰', '岳', '标', '炎', '昊', '乾', '罡', '鼎', '烈', '挺', '豹',
]);

/**
 * 逐字静态分：喜用神命中 +14，次用 +7（喜用神明细角色=次用，力度减半——并立但非主药），
 * 忌神 -12，爆款乘性降权（-15×w），多音 -4，常用级加/罚分，名字宜用度 +0~10，
 * 良名吉意字 +8，性别契合 +6 / 错位 -25。
 * 次用集/性别/良名字集缺省时向后兼容保持一致。
 */
export function charStaticScore(
  info: CharInfo,
  喜用神: ReadonlySet<WuXing>,
  忌神: ReadonlySet<WuXing>,
  次用?: ReadonlySet<WuXing>,
  gender?: '男' | '女',
  良名字集?: ReadonlySet<string>,
): number {
  let s = 0;
  if (次用?.has(info.五行)) s += 7;
  else if (喜用神.size > 0 && 喜用神.has(info.五行)) s += 14;
  if (忌神.size > 0 && 忌神.has(info.五行)) s -= 12;
  s -= 15 * info.爆款权重;
  if (info.多音) s -= 4;
  s += 常用级加分[info.常用级] ?? 0;
  s += 名字宜用加分(info.名字频率);
  if (良名字集?.has(info.字)) s += 8;
  if (gender === '男') {
    if (强女性用字.has(info.字)) s -= 25;
    else if (强男性用字.has(info.字)) s += 6;
  } else if (gender === '女') {
    if (强男性用字.has(info.字)) s -= 25;
    else if (强女性用字.has(info.字)) s += 6;
  }
  return s;
}

/** 确定性比较器：分高在前 → 笔画和少在前 → 名 Unicode 码点小在前。 */
export function compareDraft(a: DraftCandidate, b: DraftCandidate): number {
  if (a.分 !== b.分) return b.分 - a.分;
  if (a.笔画和 !== b.笔画和) return a.笔画和 - b.笔画和;
  return a.名 < b.名 ? -1 : a.名 > b.名 ? 1 : 0;
}

/** 评分常量（写入 依据 供人核对口径）。 */
export const 评分常量 = Object.freeze({
  双字皆中喜用神: 10,
  双字皆良名吉意: 8,
  名字命中爆款榜: -40,
  爆款度扣分系数: 30,
  单字爆款降权: 15,
  喜用神字: 14,
  次用字: 7,
  忌神字: -12,
  多音字: -4,
  良名吉意字: 8,
  性别契合字: 6,
  性别错位字: -25,
});

/** 汉字表常用级 → 静态加分（表外生僻重罚；一级常用优先）。 */
export const 常用级加分: Readonly<Record<0 | 1 | 2 | 3, number>> = Object.freeze({
  0: -6,
  1: 5,
  2: 1,
  3: -2,
});
