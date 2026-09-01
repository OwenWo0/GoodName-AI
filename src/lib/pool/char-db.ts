/**
 * 逐字档案库（char-wuxing.json + 爆款权重 + 通用规范汉字表）——建一次、只读、全局共享。
 *
 * 表由 vendored 生成脚本产出（出处/核验记录于 JSON _meta），本模块只做装配：
 * 五行合法化、爆款权重注入、按笔画分桶（桶内保持 JSON 插入序 = 字表序，确定性）。
 */
import charWuxingJson from '@/data/char-wuxing.json';
import buzzJson from '@/data/buzz-names.json';
import nameFreqJson from '@/data/name-char-freq.json';
import goodIntentJson from '@/data/good-intent-chars.json';
import standardJson from '@/data/standard-chars.json';
import { flattenStandardCharSet } from '@/lib/chars/standard-table';
import type { WuXing } from '@/lib/types';
import type { CharInfo } from './types';
import { 五行全集 } from './types';

const WX = new Set<string>(五行全集);

export interface CharDB {
  readonly 字: ReadonlyMap<string, CharInfo>;
  /** 康熙笔画 → 字桶（桶内顺序确定：字表序）。 */
  readonly 按笔画: ReadonlyMap<number, readonly CharInfo[]>;
  readonly 笔画值: readonly number[];
  readonly 标准字集: ReadonlySet<string>;
  readonly 爆款名集: ReadonlySet<string>;
  readonly 全部字: readonly CharInfo[];
  /** 良名吉意字库（good-intent-chars.json，高洁/涵养/仁德等经典名用字）。 */
  readonly 良名字集: ReadonlySet<string>;
}

/** 通用规范汉字表常用级查找表（一级=最常用；表外=0 生僻）。 */
function build常用级(): Map<string, 0 | 1 | 2 | 3> {
  const m = new Map<string, 0 | 1 | 2 | 3>();
  const tiers: [0 | 1 | 2 | 3, readonly string[]][] = [
    [1, standardJson.一级],
    [2, standardJson.二级],
    [3, standardJson.三级],
  ];
  for (const [tier, list] of tiers) for (const ch of list) m.set(ch, tier);
  return m;
}

function build(): CharDB {
  const buzzChars = buzzJson.chars as unknown as Record<string, number>;
  const 名字频率表 = new Map<string, number>(Object.entries(nameFreqJson.频率));
  const 常用级表 = build常用级();
  const 字 = new Map<string, CharInfo>();
  const 按笔画 = new Map<number, CharInfo[]>();

  for (const [ch, row] of Object.entries(charWuxingJson.字)) {
    const [wx, 来源, kx, tone, poly] = row as [string, string, number, number, number];
    if (!WX.has(wx)) throw new Error(`char-wuxing.json 非法五行：「${ch}」→${wx}`);
    const info: CharInfo = Object.freeze({
      字: ch,
      五行: wx as WuXing,
      来源,
      康熙笔画: kx,
      声调: tone,
      多音: poly === 1,
      爆款权重: buzzChars[ch] ?? 0,
      常用级: 常用级表.get(ch) ?? 0,
      名字频率: 名字频率表.get(ch) ?? 0,
    });
    字.set(ch, info);
    const bucket = 按笔画.get(kx);
    if (bucket) bucket.push(info);
    else 按笔画.set(kx, [info]);
  }

  return Object.freeze({
    字,
    按笔画,
    笔画值: [...按笔画.keys()].sort((a, b) => a - b),
    标准字集: flattenStandardCharSet(standardJson) as ReadonlySet<string>,
    爆款名集: new Set<string>(buzzJson.names),
    全部字: Object.freeze([...字.values()]),
    良名字集: new Set<string>(goodIntentJson.map((e) => e.字)),
  });
}

let cached: CharDB | null = null;

/** 取全局字库（首次调用装配，后续 O(1)；返回值为冻结只读结构）。 */
export function loadCharDB(): CharDB {
  if (!cached) cached = build();
  return cached;
}
