/**
 * 平仄模块（M2 模块D）：基于 pinyin-pro 的今音平仄判定。
 *
 * 规则：普通话 1/2 声=平、3/4 声=仄；pinyin-pro 的轻声 num=0，按契约映射为 5 并归仄、备注说明。
 * 多音字：保留全部读音（polyphonic 字段），平仄取第一读音并在 备注 标注「多音：x/y」。
 * 姓氏：mode:'surname' + surname:'head'（仅作用串首姓氏位，避免名中姓氏字被强读姓音）。
 *
 * 扩展：v2 加粤拼/中古音体系只需扩 PingZeSystemId 联合并在 SYSTEMS 注册（types.ts 的
 * PingzeResult.体系 字段由主 agent 同步扩），本模块核心逻辑不改。
 */
import { pinyin } from 'pinyin-pro';
import type { PingzeResult, ZiPingZe } from '@/lib/types';
import { detectRaokou, detectXieyin } from './xieyin';

/** 本模块支持的平仄体系 id。v2 追加 'cantonese' | 'zhonggu-yun'。 */
export type PingZeSystemId = 'putonghua';

/** 平仄体系接口：不同音系（普通话/粤拼/平水韵）各自实现并注册。 */
export interface PingZeSystem {
  readonly id: PingZeSystemId;
  readonly 名称: string;
  /** 判为「平」的声调编号（轻声约定为 5）。 */
  readonly 平声调号: readonly number[];
  /** 判为「仄」的声调编号。 */
  readonly 仄声调号: readonly number[];
  /** 对完整姓名（含姓）逐字判平仄。 */
  analyze(fullName: string): ZiPingZe[];
}

/** pinyin-pro type:'all' 返回项中本模块用到的字段（包未导出该类型，按 .d.ts 镜像声明）。 */
export interface ZiPinyinRead {
  readonly origin: string;
  readonly pinyin: string;
  readonly initial: string;
  readonly final: string;
  readonly num: number;
  readonly isZh: boolean;
  readonly polyphonic: string[];
}

/**
 * 取姓名的逐字拼音读数（姓氏模式，仅首字生效）。
 * @throws 输入为空、含非汉字字符时抛出带定位信息的错误
 */
export function getZiReadings(fullName: string): ZiPinyinRead[] {
  if (fullName.length === 0) {
    throw new Error('姓名为空，无法判定平仄');
  }
  const surnameReads = pinyin(fullName, {
    type: 'all',
    mode: 'surname',
    surname: 'head',
  }) as ZiPinyinRead[];
  // 陷阱：surname 模式会抑制内容字的语境轻声（「石头」头→tóu），但虚词（的/了）轻声仍保留；
  // 故再取 normal 模式读数，仅当 normal 为轻声(num=0)而 surname 读数非轻声时以 normal 覆盖。
  const normalReads = pinyin(fullName, { type: 'all', mode: 'normal' }) as ZiPinyinRead[];
  const readings = surnameReads.map((r, i) => {
    const n = normalReads[i];
    return n && n.num === 0 && r.num !== 0 ? n : r;
  });
  const bad = readings.find((r) => !r.isZh);
  if (bad) {
    throw new Error(`姓名含非汉字字符「${bad.origin}」，无法判定平仄`);
  }
  return readings;
}

/** pinyin-pro 轻声返回 0，按契约映射为 5。 */
function toContractTone(num: number): number {
  return num === 0 ? 5 : num;
}

/** 由单字读音构造 ZiPingZe（多读全保留、第一读音定平仄、轻声/多音写备注）。 */
function toZiPingZe(read: ZiPinyinRead, system: PingZeSystem): ZiPingZe {
  // 语境第一读音（含轻声实现）在前，词典其余读音在后（polyphonic 可能不含轻声变体）
  const 拼音 = [read.pinyin, ...read.polyphonic.filter((p) => p !== read.pinyin)];
  const 声调 = 拼音.map((p, i) => toContractTone(i === 0 ? read.num : getNum(p)));
  const 平仄 = system.平声调号.includes(声调[0]) ? '平' : '仄';
  const 多音 = 拼音.length > 1;
  const 备注片段: string[] = [];
  if (多音) {
    备注片段.push(`多音：${拼音.join('/')}`);
  }
  if (声调.includes(5)) {
    备注片段.push('轻声，按约定归仄');
  }
  return {
    字: read.origin,
    拼音,
    声调,
    平仄,
    多音,
    ...(备注片段.length > 0 ? { 备注: 备注片段.join('；') } : {}),
  };
}

/** 带调韵母字符 → 声调编号（覆盖 a/e/i/o/u/ü 四声）。 */
const TONE_MARKS: Readonly<Record<string, number>> = {
  'ā': 1, 'á': 2, 'ǎ': 3, 'à': 4,
  'ē': 1, 'é': 2, 'ě': 3, 'è': 4,
  'ī': 1, 'í': 2, 'ǐ': 3, 'ì': 4,
  'ō': 1, 'ó': 2, 'ǒ': 3, 'ò': 4,
  'ū': 1, 'ú': 2, 'ǔ': 3, 'ù': 4,
  'ǖ': 1, 'ǘ': 2, 'ǚ': 3, 'ǜ': 4,
};

/** 带调拼音 → 声调数字（无调号视为轻声 0，与 pinyin-pro num 对齐）。 */
function getNum(syllable: string): number {
  for (const ch of syllable) {
    const tone = TONE_MARKS[ch];
    if (tone !== undefined) {
      return tone;
    }
  }
  return 0;
}

/** 普通话今音体系（v1 唯一实现）。 */
export const putonghuaSystem: PingZeSystem = {
  id: 'putonghua',
  名称: '普通话今音',
  平声调号: [1, 2],
  仄声调号: [3, 4, 5],
  analyze(fullName: string): ZiPingZe[] {
    return getZiReadings(fullName).map((r) => toZiPingZe(r, putonghuaSystem));
  },
};

const SYSTEMS: Record<PingZeSystemId, PingZeSystem> = {
  putonghua: putonghuaSystem,
};

/** 取平仄体系实现。 */
export function getPingZeSystem(id: PingZeSystemId = 'putonghua'): PingZeSystem {
  const system = SYSTEMS[id];
  if (!system) {
    throw new Error(`未知平仄体系：${id}`);
  }
  return system;
}

/** 逐字平仄（默认普通话体系）。 */
export function analyzePingze(fullName: string, systemId: PingZeSystemId = 'putonghua'): ZiPingZe[] {
  return getPingZeSystem(systemId).analyze(fullName);
}

/** 姓名的平仄格式串，如「仄仄平」（含姓氏字）。 */
export function pingzeFormatOf(fullName: string, systemId: PingZeSystemId = 'putonghua'): string {
  return analyzePingze(fullName, systemId)
    .map((z) => z.平仄)
    .join('');
}

/**
 * 组装完整 PingzeResult（平仄+谐音+绕口；字表校验由调用方传入——
 * 见 chars/standard-table.ts，字表 JSON 由 M1 产出后在其封装层加载）。
 */
export function buildPingzeResult(
  fullName: string,
  deps: { 字表校验: PingzeResult['字表校验'] },
): PingzeResult {
  return {
    逐字: analyzePingze(fullName),
    平仄格式: pingzeFormatOf(fullName),
    体系: 'putonghua',
    绕口风险: detectRaokou(fullName),
    谐音风险: detectXieyin(fullName),
    字表校验: deps.字表校验,
  };
}
