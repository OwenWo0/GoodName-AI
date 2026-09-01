/**
 * M3 候选名海选 —— 算法海选产出候选池，供后续 AI 精选。
 *
 * 流水线：初筛字库（剔 避讳/禁用 + 内置不宜入名黑名单 NAME_TABOO）→ 笔画格数算术枚举（不调 computeWuge）
 *  → 组合评分排序 → TopK 谐音安检（detectXieyin，含后字声母脱落式上下文口径）
 *  → 终筛才 computeWuge + buildPingzeResult 组装 PoolCandidate（可直填 ChartResult.candidates）。
 *
 * 确定性：无 Math.random、无 Date；排序 tie-break 用笔画和 + Unicode 码点。
 * 「缺≠补」：过滤与评分以喜用神为准，不看五行缺失。
 * 黑名单仅剔字池；辈字（用户强制约束，走 locked 侧池）不受限——口径见 chars/name-taboo.ts。
 */
import { kangxiStrokesOf } from '@/lib/wuge/kangxi';
import { NAME_TABOO } from '@/lib/chars/name-taboo';
import { computeWuge } from '@/lib/wuge/geju';
import { buildPingzeResult } from '@/lib/phonology/pingze';
import { detectXieyin } from '@/lib/phonology/xieyin';
import { checkStandard } from '@/lib/chars/standard-table';
import type { WuXing } from '@/lib/types';
import { loadCharDB, type CharDB } from './char-db';
import { enumerateCombos, 姓骨架Of, type ComboScore } from './enumerate';
import { buzzOfName, charStaticScore, pingzeBonusOf, 评分常量 } from './rank';
import { 五行全集, type CharInfo, type PoolCandidate, type PoolInput, type PoolResult } from './types';

export type { PoolInput, PoolResult, PoolCandidate } from './types';

/** 每个笔画桶每侧最多取前 SIDE_CAP 字参与组合枚举（海选截断，按静态分+码点定序）。 */
const SIDE_CAP = 12;
const DEFAULT_N = 40;
const MAX_N = 100;
/** 谐音安检冗余系数：短名单取 5N+40，剔除后仍能凑满 N。 */
const SHORTLIST_FACTOR = 5;
const SHORTLIST_PAD = 40;

/** 每笔画组合最多入短名单的对数——跨笔画区多样化，防低笔画 tie 霸榜挤占名额。 */
const PAIRS_PER_COMBO = 6;

/** 谐音安检口径（fatemaster 对齐契约：后字声母脱落式上下文）。 */
const 谐音安检选项 = { 谐音上下文音: '后字声母脱落式' } as const;

/**
 * 契约垫片：主控 M4 增补要求两 callsite 传「谐音上下文音」（声母脱落式）， phonology 侧
 * 尚在途（当前 detectXieyin 仍 1 参、deps 无此字段，运行时多余参数被 JS 忽略，行为=默认口径）。
 * 经显式类型放宽转发：今日编译绿、D 落地后**零改动自动生效**（届时可删本垫片回归直调）。
 */
type Ctx选项 = { 谐音上下文音?: '后字声母脱落式' };
const detectXieyinCtx = detectXieyin as unknown as (fullName: string, opts?: Ctx选项) => string | null;
const buildPingzeResultCtx = buildPingzeResult as unknown as (
  fullName: string,
  deps: { 字表校验: PoolCandidate['平仄']['字表校验'] } & Ctx选项,
) => PoolCandidate['平仄'];

/**
 * 锁定侧池工厂（契约 v3 §1.4）——辈字/指定字共用，替换原辈字内联字面量。
 * 命中归属（新口径，修辈字旧路径的静默放宽）：锁定字计入命中 → 自由侧取全量
 * （「至少一字中喜用」由锁定字本身满足）；计入未命中 → 自由侧强制只取命中表。
 * lockPool(c, true) 与原辈字字面量逐字段等，旧路径行为不变。
 */
const lockPool = (c: CharInfo, 计入命中: boolean): SidePools => ({
  命中: new Map([[c.康熙笔画, 计入命中 ? [c] : []]]),
  未命中: new Map([[c.康熙笔画, 计入命中 ? [] : [c]]]),
  全量: new Map([[c.康熙笔画, [c]]]),
  字数: 1,
});

/** 一遍枚举输入：笔画组合子集 + 两侧池。指定字=任一走两遍 union；
 * 无需显式去重——p1∩p2 只可能是 (X,X) 重字对，enumeratePairs 同字 guard 已双遍各自剔除。 */
interface EnumPass {
  readonly 组合: readonly ComboScore[];
  readonly side1: SidePools;
  readonly side2: SidePools;
}

/**
 * 枚举分派（契约 v3 §1.4）：无指定字=现状路径（零改动）；单名=一遍 s1===K；
 * 第一/第二=单遍锁位；任一（无辈字）=两遍 union；辈字共存——同字整体 no-op、
 * 异字（任一或异位）单遍双锁、同位异字 schema 已拒（池层防线=空通道空态）。
 */
function planPasses(
  input: PoolInput,
  db: CharDB,
  combos: readonly ComboScore[],
  sideAll: SidePools,
  喜用神: ReadonlySet<WuXing>,
): EnumPass[] {
  const 全部 = [...combos];
  const { 辈字, 指定字 } = input;
  const bz = 辈字 ? db.字.get(辈字.字) : undefined;

  const 辈锁Pass = (b: CharInfo, 位置: 1 | 2): EnumPass => {
    const locked = lockPool(b, true);
    return {
      组合: 全部.filter((c) => (位置 === 1 ? c.s1 === b.康熙笔画 : c.s2 === b.康熙笔画)),
      side1: 位置 === 1 ? locked : sideAll,
      side2: 位置 === 1 ? sideAll : locked,
    };
  };

  if (!指定字) {
    if (辈字 && bz) return [辈锁Pass(bz, 辈字.位置)];
    return [{ 组合: 全部, side1: sideAll, side2: sideAll }];
  }

  const zd = db.字.get(指定字.字) as CharInfo; // 存在性由 buildPool 装载后校验先行抛错
  const K = zd.康熙笔画;

  if (input.名字形式 === '单名') {
    // 单名分支只读 side1.命中 → 计入命中恒 true（契约）；「第二」schema 已拒，走到这也自然空。
    return [{ 组合: 全部.filter((c) => c.s1 === K), side1: lockPool(zd, true), side2: sideAll }];
  }

  if (辈字 && bz) {
    if (bz.字 === zd.字) return [辈锁Pass(bz, 辈字.位置)]; // 同字=整体 no-op（与仅辈字逐字节等）
    // 任一落辈字异位；第一/第二撞辈位=同位异字（schema 拒），池层防线→空通道。
    const zd位: 1 | 2 =
      指定字.位置 === '第一' ? 1 : 指定字.位置 === '第二' ? 2 : 辈字.位置 === 1 ? 2 : 1;
    if (zd位 === 辈字.位置) return [];
    // 双锁陷阱（契约 §1.4）：两侧 lock 必须皆 计入命中=true——enumeratePairs 中自由侧
    // （l1=未命中遍）取对侧 命中 表，空表会明明可行却零候选。
    const lockZ = lockPool(zd, true);
    const lockB = lockPool(bz, true);
    const 组合 = 全部.filter((c) =>
      辈字.位置 === 1 ? c.s1 === bz.康熙笔画 && c.s2 === K : c.s1 === K && c.s2 === bz.康熙笔画,
    );
    return [
      辈字.位置 === 1 ? { 组合, side1: lockB, side2: lockZ } : { 组合, side1: lockZ, side2: lockB },
    ];
  }

  // 命中归属新口径：单名/无喜用要求/锁定字自身中喜用 → 计入命中；否则落未命中，自由侧保命中。
  const 计入命中 = 喜用神.size === 0 || 喜用神.has(zd.五行);
  if (指定字.位置 === '第一') {
    return [{ 组合: 全部.filter((c) => c.s1 === K), side1: lockPool(zd, 计入命中), side2: sideAll }];
  }
  if (指定字.位置 === '第二') {
    return [{ 组合: 全部.filter((c) => c.s2 === K), side1: sideAll, side2: lockPool(zd, 计入命中) }];
  }
  return [
    { 组合: 全部.filter((c) => c.s1 === K), side1: lockPool(zd, 计入命中), side2: sideAll },
    { 组合: 全部.filter((c) => c.s2 === K), side1: sideAll, side2: lockPool(zd, 计入命中) },
  ];
}

interface PairDraft {
  readonly c1: CharInfo;
  readonly c2: CharInfo | null;
  readonly combo: ComboScore;
  readonly 分: number;
  readonly 笔画和: number;
  readonly 爆款度: number;
  readonly 命中爆款榜: boolean;
  readonly 皆中喜用神: boolean;
}

function validate(input: PoolInput): void {
  const 姓字 = [...input.姓氏];
  if (姓字.length < 1 || 姓字.length > 2) throw new Error(`姓氏须为 1-2 字，收到「${input.姓氏}」`);
  const 校验五行组 = (ws: readonly string[], 标签: string): void => {
    for (const w of ws) {
      if (!(五行全集 as readonly string[]).includes(w)) throw new Error(`${标签}含非法五行值「${w}」`);
    }
  };
  校验五行组(input.喜用神, '喜用神');
  if (input.忌神) 校验五行组(input.忌神, '忌神');
  if (input.辈字) {
    if (input.名字形式 !== '双名') throw new Error('辈字仅在双名下可用（名第一或第二字强制）');
  }
  if (input.指定字 && !/^[一-鿿]$/.test(input.指定字.字)) throw new Error('指定字须为单个汉字');
}

const cmpChar = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** 桶内取 top N（静态分降序，tie 码点升序）——确定性截断。 */
function topByScore(
  list: readonly CharInfo[],
  score: (c: CharInfo) => number,
  cap: number,
): CharInfo[] {
  return [...list].sort((a, b) => score(b) - score(a) || cmpChar(a.字, b.字)).slice(0, cap);
}

interface SidePools {
  /** 笔画 → 命中喜用神 top（无喜用神要求时=全量 top）。 */
  readonly 命中: ReadonlyMap<number, readonly CharInfo[]>;
  /** 笔画 → 未命中 top（喜用神为空时无此表）。 */
  readonly 未命中: ReadonlyMap<number, readonly CharInfo[]>;
  readonly 全量: ReadonlyMap<number, readonly CharInfo[]>;
  readonly 字数: number;
}

function buildSidePools(
  db: CharDB,
  excluded: ReadonlySet<string>,
  喜用神: ReadonlySet<WuXing>,
  忌神: ReadonlySet<WuXing>,
  score: (c: CharInfo) => number,
  形式: '单名' | '双名',
): SidePools {
  const 命中 = new Map<number, CharInfo[]>();
  const 未命中 = new Map<number, CharInfo[]>();
  const 全量 = new Map<number, CharInfo[]>();
  let 字数 = 0;
  for (const [s, bucket] of db.按笔画) {
    const avail = bucket.filter((c) => !excluded.has(c.字));
    字数 += avail.length;
    if (avail.length === 0) continue;
    全量.set(s, topByScore(avail, score, SIDE_CAP));
    if (形式 === '双名' || 喜用神.size > 0) {
      const hits = avail.filter((c) => 喜用神.size === 0 || 喜用神.has(c.五行));
      命中.set(s, topByScore(hits, score, SIDE_CAP));
      if (形式 === '双名' && 喜用神.size > 0) {
        未命中.set(s, topByScore(avail.filter((c) => !喜用神.has(c.五行)), score, SIDE_CAP));
      }
    }
  }
  return { 命中, 未命中, 全量, 字数 };
}

function enumeratePairs(
  combos: Iterable<ComboScore>,
  side1: SidePools,
  side2: SidePools,
  喜用神: ReadonlySet<WuXing>,
  忌神: ReadonlySet<WuXing>,
  score: (c: CharInfo) => number,
  db: CharDB,
  姓Tone: number | null,
  形式: '单名' | '双名',
): PairDraft[] {
  const pairs: PairDraft[] = [];
  const scoreOf = (c: CharInfo): number => score(c);
  const 忌 = (c: CharInfo): boolean => 忌神.size > 0 && 忌神.has(c.五行);

  const makePair = (c1: CharInfo, c2: CharInfo | null, combo: ComboScore): PairDraft => {
    const 名 = c2 == null ? c1.字 : c1.字 + c2.字;
    const 命中榜 = db.爆款名集.has(名);
    const 爆款度 = buzzOfName(名, (ch) => db.字.get(ch)?.爆款权重 ?? 0, 命中榜);
    const bothHit = c2 != null && 喜用神.size > 0 && 喜用神.has(c1.五行) && 喜用神.has(c2.五行);
    const bothGoodIntent = db.良名字集.has(c1.字) && (c2 == null || db.良名字集.has(c2.字));
    const tones = c2 == null ? [c1.声调] : [c1.声调, c2.声调];
    const 分 =
      Math.round(combo.分 * 0.6) +
      scoreOf(c1) +
      (c2 == null ? 0 : scoreOf(c2)) +
      (bothHit ? 评分常量.双字皆中喜用神 : 0) +
      (bothGoodIntent ? 评分常量.双字皆良名吉意 : 0) +
      (命中榜 ? 评分常量.名字命中爆款榜 : 0) +
      评分常量.爆款度扣分系数 * -爆款度 +
      pingzeBonusOf(tones, 姓Tone);
    return {
      c1,
      c2,
      combo,
      分,
      笔画和: c1.康熙笔画 + (c2?.康熙笔画 ?? 0),
      爆款度,
      命中爆款榜: 命中榜,
      皆中喜用神: bothHit,
    };
  };

  for (const combo of combos) {
    const group: PairDraft[] = [];
    if (形式 === '单名') {
      for (const c1 of side1.命中.get(combo.s1) ?? []) {
        if (忌(c1)) continue;
        group.push(makePair(c1, null, combo));
      }
    } else {
      const s2 = combo.s2 as number;
      if (!c1Empty(side1, combo.s1, 喜用神)) {
        // 覆盖「至少一字中喜用神」：(命中×全量) ∪ (未命中×命中)，两集无交，天然去重。
        const side1Lists: readonly (readonly CharInfo[])[] =
          喜用神.size === 0
            ? [side1.全量.get(combo.s1) ?? []]
            : [side1.命中.get(combo.s1) ?? [], side1.未命中.get(combo.s1) ?? []];
        for (const l1 of side1Lists) {
          const l2 = side1Lists[0] === l1 && 喜用神.size > 0 ? side2.全量.get(s2) ?? [] : side2.命中.get(s2) ?? [];
          for (const c1 of l1) {
            for (const c2 of l2) {
              if (c1.字 === c2.字) continue;
              if (忌(c1) && 忌(c2)) continue;
              group.push(makePair(c1, c2, combo));
            }
          }
        }
      }
    }
    // 组内截断：本组合最多贡献 PAIRS_PER_COMBO 对（组内按最终序截，跨组合保多样）。
    if (group.length > PAIRS_PER_COMBO) {
      group.sort(cmpPair);
      pairs.push(...group.slice(0, PAIRS_PER_COMBO));
    } else {
      pairs.push(...group);
    }
  }
  return pairs;
}

function c1Empty(side1: SidePools, s1: number, 喜用神: ReadonlySet<WuXing>): boolean {
  if (喜用神.size === 0) return (side1.全量.get(s1) ?? []).length === 0;
  return (side1.命中.get(s1) ?? []).length === 0 && (side1.未命中.get(s1) ?? []).length === 0;
}

const cmpPair = (a: PairDraft, b: PairDraft): number =>
  b.分 - a.分 ||
  a.笔画和 - b.笔画和 ||
  cmpChar(a.c1.字, b.c1.字) ||
  cmpChar(a.c2?.字 ?? '', b.c2?.字 ?? '');

function assemble(
  input: PoolInput,
  db: CharDB,
  draft: PairDraft,
  喜用神: ReadonlySet<WuXing>,
  忌神: ReadonlySet<WuXing>,
): PoolCandidate | null {
  const 名 = draft.c2 == null ? draft.c1.字 : draft.c1.字 + draft.c2.字;
  const 全名 = input.姓氏 + 名;
  const 五格 = computeWuge(input.姓氏, 名);
  if (!五格) return null;
  const 平仄 = buildPingzeResultCtx(全名, {
    字表校验: checkStandard(全名, db.标准字集 as Set<string>),
    谐音上下文音: 谐音安检选项.谐音上下文音,
  });
  const 依据: string[] = [...draft.combo.依据];
  for (const c of [draft.c1, draft.c2]) {
    if (!c) continue;
    const 段 = [`字'${c.字}'${c.来源}属${c.五行}`];
    if (喜用神.size > 0 && 喜用神.has(c.五行)) 段.push('中喜用神');
    if (忌神.size > 0 && 忌神.has(c.五行)) 段.push('忌神已降权');
    if (c.多音) 段.push('多音字已扣分');
    if (c.常用级 === 1) 段.push('一级常用字');
    if (c.常用级 === 0) 段.push('通用规范汉字表外（生僻已重罚）');
    if (c.名字频率 >= 100) 段.push(`名字语料频次${c.名字频率}`);
    if (db.良名字集.has(c.字)) 段.push('良名美意字');
    依据.push(段.join('，'));
  }
  依据.push(`爆款度${draft.爆款度.toFixed(2)}${draft.命中爆款榜 ? '（名在爆款榜，已重罚）' : ''}`);
  依据.push(`平仄${平仄.平仄格式}`);
  if (input.辈字) 依据.push(`辈字'${input.辈字.字}'固定第${input.辈字.位置}位`);
  // 契约 v3 §1.4 坍缩：X===Y 时整体 no-op（与仅辈字逐字节等）→ 不再注记指定字行，否则依据破坏 byte-equal。
  if (input.指定字 && input.辈字?.字 !== input.指定字.字) {
    const 位词 =
      input.指定字.位置 === '第一' ? '居首' : input.指定字.位置 === '第二' ? '居末' : '任一';
    依据.push(`指定字'${input.指定字.字}'含于名（${位词}）`);
  }
  if (draft.皆中喜用神) 依据.push('双字皆中喜用神');
  const 五行: WuXing[] = draft.c2 == null ? [draft.c1.五行] : [draft.c1.五行, draft.c2.五行];
  return { 名, 五行, 平仄, 五格, 爆款度: draft.爆款度, 入选依据: 依据 };
}

/** 建候选池（主入口，纯同步确定性）。 */
export function buildPool(input: PoolInput): PoolResult {
  validate(input);
  const db = loadCharDB();
  const N = Math.min(MAX_N, Math.max(1, Math.round(input.期望候选数 ?? DEFAULT_N)));

  const 姓笔画 = [...input.姓氏].map((ch) => kangxiStrokesOf(ch).笔画);
  if (姓笔画.some((b) => b == null)) {
    throw new Error(`姓氏「${input.姓氏}」康熙笔画缺失，无法排格海选`);
  }
  const 骨架 = 姓骨架Of(姓笔画 as number[]);
  const 姓Tone = db.字.get([...input.姓氏].pop() as string)?.声调 ?? null;

  const 喜用神 = new Set(input.喜用神);
  const 忌神 = new Set(input.忌神 ?? []);
  // 明细角色=次用的五行评分减半（+7 替代 +14）；过滤不动，仍在 喜用神 全集内。
  const 次用 = new Set(
    (input.喜用神明细 ?? []).filter((d) => d.角色 === '次用').map((d) => d.五行),
  );
  if (input.辈字 && !db.字.has(input.辈字.字)) {
    throw new Error(`辈字「${input.辈字.字}」不在五行字表内，笔画/五行无从计算`);
  }
  if (input.指定字 && !db.字.has(input.指定字.字)) {
    throw new Error('指定字不在五行字表内，笔画/五行无从计算');
  }
  const 讳禁 = new Set([...(input.避讳字 ?? []), ...(input.禁用字 ?? [])]);
  if (input.辈字 && 讳禁.has(input.辈字.字)) throw new Error(`辈字「${input.辈字.字}」同时出现在避讳/禁用表中，约束矛盾`);
  if (input.指定字 && 讳禁.has(input.指定字.字)) throw new Error('指定字同时出现在避讳/禁用表中，约束矛盾');
  for (const ch of [...input.姓氏]) 讳禁.add(ch); // 名内不与姓重字
  const 姓用字 = new Set([...input.姓氏]);
  if (input.指定字 && 姓用字.has(input.指定字.字)) throw new Error('指定字与姓氏重字，约束矛盾');
  // 补辈字旧洞（契约 v3 §1.3）：旧口径仅靠姓重字入 讳禁 后走「避讳/禁用表」文案，语义误导；此处独立先抛。
  if (input.辈字 && 姓用字.has(input.辈字.字)) throw new Error('辈字与姓氏重字，约束矛盾');

  const scoreMemo = new Map<string, number>();
  const score = (c: CharInfo): number => {
    let v = scoreMemo.get(c.字);
    if (v == null) {
      v = charStaticScore(c, 喜用神, 忌神, 次用, input.性别, db.良名字集);
      scoreMemo.set(c.字, v);
    }
    return v;
  };

  // 初筛剔除集 = 用户约束（避讳/禁用/姓重字）+ 内置不宜入名黑名单；辈字/指定字走 locked 侧池不经此过滤，天然豁免。
  const 初筛剔除 = new Set([...讳禁, ...NAME_TABOO]);
  const sideAll = buildSidePools(db, 初筛剔除, 喜用神, 忌神, score, input.名字形式);

  const combos = enumerateCombos(骨架, db.笔画值, input.名字形式);
  const passes = planPasses(input, db, [...combos.values()], sideAll, 喜用神);
  const pairs = passes
    .flatMap((p) => enumeratePairs(p.组合, p.side1, p.side2, 喜用神, 忌神, score, db, 姓Tone, input.名字形式))
    .sort(cmpPair);

  const shortlist = pairs.slice(0, N * SHORTLIST_FACTOR + SHORTLIST_PAD);
  // 「重新生成」排重（任务 #28）：仅在终筛组装期剔除已呈名部——初筛/海选/排序不受影响，
  // 其余候选相对次序与不带排除集时完全一致；shortlist 耗尽时自然返回更少/为空，不抛错。
  const 排除集 = new Set(input.排除已选 ?? []);
  const 候选: PoolCandidate[] = [];
  let 谐音剔除数 = 0;
  let 排除剔除数 = 0;
  for (const draft of shortlist) {
    if (候选.length >= N) break;
    const 名 = draft.c2 == null ? draft.c1.字 : draft.c1.字 + draft.c2.字;
    if (排除集.has(名)) {
      排除剔除数++;
      continue;
    }
    if (detectXieyinCtx(input.姓氏 + 名, 谐音安检选项) != null) {
      谐音剔除数++;
      continue;
    }
    const c = assemble(input, db, draft, 喜用神, 忌神);
    if (c) 候选.push(c);
  }

  return {
    候选,
    统计: {
      初筛字数: sideAll.字数,
      // 多遍（指定字=任一）下逐通道求和：(K,K) 组合双计——契约 §1.4 已注明的可接受副作用。
      可行笔画组合: passes.reduce((n, p) => n + p.组合.length, 0),
      海选对数: pairs.length,
      谐音剔除数,
      排除剔除数,
    },
  };
}
