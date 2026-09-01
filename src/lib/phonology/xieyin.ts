/**
 * 谐音 + 绕口检测（M2 模块D）。
 *
 * 谐音：黑名单（src/data/xieyin-blacklist.json）按「无声调拼音音节序列」在姓名上做滑动窗口
 * 比对——同音不同字（史伟≈屎伟、杨威≈杨伟→阳痿）可命中；多音字取全部读音为候选音节，
 * 避免姓氏异读（曾 zēng/céng）漏检。字面完全相同亦命中。粤语库 v2 另接。
 *
 * 绕口：三条确定性规则——①叠字（相邻同字）②相邻两字声母+韵母均相同（同音节连读，如 施史）
 * ③连续三字声母全同（双声）或韵母全同（叠韵，如 刘牛妞 iu 三连）。
 */
import { pinyin } from 'pinyin-pro';
import blacklistData from '@/data/xieyin-blacklist.json';
import { getZiReadings, type ZiPinyinRead } from './pingze';

interface BlacklistEntry {
  readonly 词条: string;
  readonly reason: string;
  readonly syllables: readonly string[];
  readonly tones: readonly number[];
}

/** 声调符号字符集合（NFD 分解后剥离组合符即得无声调拼音）。 */
function stripTone(syllable: string): string {
  return syllable.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function buildEntries(): BlacklistEntry[] {
  const raw = [
    ...blacklistData.patterns.map((p) => ({ 词条: p.pattern, reason: p.reason })),
    ...blacklistData.charCombos.map((c) => ({ 词条: c.chars, reason: c.reason })),
  ];
  return raw.map(({ 词条, reason }) => {
    const reads = pinyin(词条, { type: 'all', mode: 'normal' }) as ZiPinyinRead[];
    return {
      词条,
      reason,
      syllables: reads.map((r) => stripTone(r.pinyin)),
      tones: reads.map((r) => r.num),
    };
  });
}

const ENTRIES: readonly BlacklistEntry[] = buildEntries();

/** 姓名逐字的全部无声调候选音节（含全部多读音）。 */
function candidateSyllables(readings: readonly ZiPinyinRead[]): ReadonlyArray<ReadonlySet<string>> {
  return readings.map((r) => {
    const all = r.polyphonic.length > 0 ? [r.pinyin, ...r.polyphonic] : [r.pinyin];
    return new Set(all.map(stripTone));
  });
}

/**
 * 谐音黑名单检测：命中返回风险文案，未命中返回 null。
 * 多重命中时优先：字面相同 > 声调全同 > 窗口靠前。
 */
export function detectXieyin(fullName: string): string | null {
  if (fullName.length === 0) {
    return null;
  }
  const readings = getZiReadings(fullName);
  const candidates = candidateSyllables(readings);
  let best: { rank: number; order: number; 窗口: string; entry: BlacklistEntry } | null = null;

  for (const entry of ENTRIES) {
    const n = entry.syllables.length;
    for (let i = 0; i + n <= candidates.length; i++) {
      const 窗口 = fullName.slice(i, i + n);
      const literal = 窗口 === entry.词条;
      const pinyinHit = entry.syllables.every((s, j) => candidates[i + j].has(s));
      if (!literal && !pinyinHit) {
        continue;
      }
      const toneSame =
        pinyinHit && entry.tones.every((t, j) => t === (readings[i + j].num === 0 ? 5 : readings[i + j].num));
      const rank = (literal ? 2 : 0) + (toneSame ? 1 : 0);
      if (!best || rank > best.rank || (rank === best.rank && i < best.order)) {
        best = { rank, order: i, 窗口, entry };
      }
    }
  }
  if (!best) {
    return null;
  }
  const toneNote = best.rank >= 2 ? '同音' : '近音（声调不同）';
  return `谐音风险：「${best.窗口}」${toneNote}谐「${best.entry.reason}」`;
}

/**
 * 绕口检测：命中返回风险文案，未命中返回 null。
 */
export function detectRaokou(fullName: string): string | null {
  const readings = getZiReadings(fullName);
  const chars = readings.map((r) => r.origin);
  const initials = readings.map((r) => r.initial);
  const finals = readings.map((r) => stripTone(r.final));
  const problems: string[] = [];

  for (let i = 0; i + 1 < chars.length; i++) {
    if (chars[i] === chars[i + 1]) {
      problems.push(`叠字「${chars[i]}${chars[i + 1]}」连读`);
    } else if (initials[i] === initials[i + 1] && finals[i] === finals[i + 1]) {
      problems.push(`「${chars[i]}${chars[i + 1]}」同音节连读（${stripTone(readings[i].pinyin)}）`);
    }
  }
  for (let i = 0; i + 3 <= chars.length; i++) {
    const ini = new Set(initials.slice(i, i + 3));
    const fin = new Set(finals.slice(i, i + 3));
    const span = chars.slice(i, i + 3).join('');
    if (ini.size === 1) {
      problems.push(`双声三连「${span}」（声母 ${[...ini][0]}）`);
    }
    if (fin.size === 1) {
      problems.push(`叠韵三连「${span}」（韵母 ${[...fin][0]}）`);
    }
  }
  return problems.length > 0 ? `绕口风险：${problems.join('；')}` : null;
}
