/**
 * 名人吉名匹配（契约 v2 §4，v3 §4.1 中档放宽）—— 纯函数、确定性：无 Math.random、无 Date，同输入同序。
 *
 * 库经参数注入（路由负责读 JSON），本模块只做名部匹配与过滤链：
 *   名部长度=名字形式 →（命中名数在此按长度口径统计，契约：「过滤前按名部+长度命中的不同名数」）
 *   → 排除已选剔 → 三硬剔（禁用/避讳剔 → 任一字犯忌神剔 → 含姓谐音剔）
 *   → 表外字/喜用零命中/五格低分**保留**（v3 中档：排序自然下沉 + 契合.说明诚实注记）
 *   → 逐名构建 EvaluatedName（口径同契约 §3 / evaluate.ts 表外降级）
 *   → charStaticScore 总分排序（tie-break 复用 compareDraft：分→笔画和→名码点）→ slice(上限)。
 *
 * 复用 pool 口径（能 import 就 import）：
 *   charStaticScore/buzzOfName/compareDraft/评分常量 ← pool/rank.ts；loadCharDB ← pool/char-db.ts；
 *   checkStandard ← chars/standard-table.ts；buildPingzeResult ← phonology/pingze.ts；
 *   detectXieyin ← phonology/xieyin.ts（1 参直调 = pool 垫片今日生效的运行时行为，见 pool.ts:45 注释）；
 *   computeWuge ← wuge/geju.ts。未复制任何数据源。
 */
import { loadCharDB } from '@/lib/pool/char-db';
import type { CharInfo } from '@/lib/pool/types';
import { buzzOfName, charStaticScore, compareDraft, 评分常量, type DraftCandidate } from '@/lib/pool/rank';
import { checkStandard } from '@/lib/chars/standard-table';
import { buildPingzeResult } from '@/lib/phonology/pingze';
import { detectXieyin } from '@/lib/phonology/xieyin';
import { computeWuge } from '@/lib/wuge/geju';
import type { WuXing } from '@/lib/types';
import type { EvaluatedName, 契合档位, 契合评估 } from '@/lib/evaluate/types';
import type { MingrenCandidate, MingrenEntry, MingrenMatchResult } from './types';
import type { MingrenMatchRequest } from './schema';

/**
 * 五格综合分注记线（契约 v3 §4.1：v2 的「<50 剔」已删，此线只用于生成冻结注记
 * 「五格综合 N，低于 50」——保留候选但如实标注，不再剔除）。
 */
const 五格综合分注记线 = 50;

const cmpChar = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** 排序中间记录：DraftCandidate 负责 compareDraft 对齐，另挂展示载荷。 */
interface 命中草案 {
  readonly draft: DraftCandidate;
  readonly 评估: EvaluatedName;
  readonly 出处: readonly MingrenEntry[];
}

/** 出处确定性序：姓+名 码点升序（库内 姓+名 唯一，无二次 tie-break 需求）。 */
const cmp出处 = (a: MingrenEntry, b: MingrenEntry): number =>
  cmpChar(a.姓 + a.名, b.姓 + b.名) || cmpChar(a.出处, b.出处);

/**
 * 名人库匹配主入口（纯函数：库注入，不读文件；输出确定序）。
 */
export function matchMingren(库: readonly MingrenEntry[], req: MingrenMatchRequest): MingrenMatchResult {
  const db = loadCharDB();
  const 目标长度 = req.名字形式 === '单名' ? 1 : 2;

  const 喜用神 = new Set<WuXing>(req.喜用神);
  const 忌神 = new Set<WuXing>(req.忌神);
  // 次用集（喜用神明细角色=次用）：过滤按 喜用神 全集「主或次皆算」，评分/展示拆主次（同 pool/rank 口径）。
  const 次用 = new Set<WuXing>(
    (req.喜用神明细 ?? []).filter((d) => d.角色 === '次用').map((d) => d.五行),
  );
  const 讳禁 = new Set<string>([...(req.避讳字 ?? []), ...(req.禁用字 ?? [])]);
  const 排除集 = new Set<string>(req.排除已选 ?? []);
  // 喜用命中集 = 主（喜用神全集）∪ 次用（防御性并集：手写请求的明细五行可能不在 喜用神 数组内）。
  const 命中集 = new Set<WuXing>([...喜用神, ...次用]);

  // ① 长度命中（命中名数口径 = 过滤链前、按名部+长度命中的不同名数，含后续被排除/被剔者）。
  const 长度命中 = 库.filter((e) => [...e.名].length === 目标长度);
  const 命中名数 = new Set(长度命中.map((e) => e.名)).size;

  // ② 排除已选 + 按名部 group（Map 插入序=库序，确定性）。
  const 分组 = new Map<string, MingrenEntry[]>();
  for (const e of 长度命中) {
    if (排除集.has(e.名)) continue;
    const bucket = 分组.get(e.名);
    if (bucket) bucket.push(e);
    else 分组.set(e.名, [e]);
  }

  // ③ 逐名部过过滤链并构建候选草案。
  const 草案: 命中草案[] = [];
  for (const [名, 出处列表] of 分组) {
    const 字列表 = [...名];

    // ---- 表外字降级（契约 v3 §4.1：v2「表外剔」→ 保留+注记，口径同 evaluate.ts）----
    // 表外 = CharDB 缺档（无五行/笔画）或不在《通用规范汉字表》：记入 表外字 字段、
    // 该字跳过五行与计分（computeWuge 笔画缺失时自然 null，消费方判空）。
    const 表外字 = 字列表.filter((ch) => !db.字.has(ch) || !db.标准字集.has(ch));
    const infos = 字列表
      .map((ch) => db.字.get(ch))
      .filter((c): c is CharInfo => c !== undefined);
    const 五行: WuXing[] = infos.map((c) => c.五行);

    // ---- 三硬剔（契约 v3 §0-3：中档放宽后仅存的剔除项）----
    // 硬剔① 禁用/避讳。
    if (字列表.some((ch) => 讳禁.has(ch))) continue;
    // 硬剔② 任一字五行∈忌神（比 pool 双字皆忌更严——契约明示；表外字无五行档案无从判犯，由注记兜底）。
    if (五行.some((w) => 忌神.has(w))) continue;
    // 硬剔③ 谐音黑名单（含姓氏全名口径，同 pool 终筛）。
    if (detectXieyin(req.姓氏 + 名) != null) continue;

    // 五格不再剔（v3）：null（笔画不可得）或低分者保留，低分只写注记。
    const 五格 = computeWuge(req.姓氏, 名);

    // ---- EvaluatedName 构建（口径同契约 §3）----
    const 全名 = req.姓氏 + 名;
    const 平仄 = buildPingzeResult(全名, {
      字表校验: checkStandard(全名, db.标准字集 as Set<string>),
    });
    const 命中喜用 = 五行.filter((w) => 喜用神.has(w) && !次用.has(w));
    const 命中次用 = 五行.filter((w) => 次用.has(w));
    const 命中忌神 = 五行.filter((w) => 忌神.has(w));
    // 契合分 = charStaticScore 的 喜+次+忌 三项之和（不含爆款/多音/常用级——展示分口径）。
    const 契合分 = infos.reduce((sum, c) => {
      let s = 0;
      if (次用.has(c.五行)) s += 评分常量.次用字;
      else if (喜用神.has(c.五行)) s += 评分常量.喜用神字;
      if (忌神.has(c.五行)) s += 评分常量.忌神字;
      return sum + s;
    }, 0);
    const 有命中 = 五行.some((w) => 命中集.has(w));
    // 全字命中需有字可判：表外降级可能致 五行 为空（every 空集恒真 → 防御为 false，档位在'中'）。
    const 全命中 = 五行.length > 0 && 五行.every((w) => 命中集.has(w));
    const 档位: 契合档位 =
      命中忌神.length > 0 ? '下' : 全命中 ? '上' : 有命中 ? '中上' : '中';
    // 诚实注记（契约 v3 §4.1 冻结措辞，可并存；档位/分计算不动）。
    const 说明: string[] = [];
    if (!有命中) 说明.push('未中喜用');
    if (五格 != null && 五格.评分.综合分 < 五格综合分注记线) {
      说明.push(`五格综合 ${五格.评分.综合分}，低于 50`);
    }
    for (const ch of new Set(表外字)) 说明.push(`含表外字「${ch}」`);
    const 契合: 契合评估 = {
      命中喜用,
      命中次用,
      命中忌神,
      档位,
      分: 契合分,
      说明,
    };
    const 命中爆款榜 = db.爆款名集.has(名);
    const 爆款度 = buzzOfName(名, (ch) => db.字.get(ch)?.爆款权重 ?? 0, 命中爆款榜);
    const 评估: EvaluatedName = { 名, 表外字, 五行, 平仄, 五格, 爆款度, 契合 };

    // 排序草案：分 = charStaticScore 逐字和（海选全量口径，与 pool cmpPair 同族信号）；
    // 笔画和/码点 tie-break 由 compareDraft 负责。
    const 分 = infos.reduce((sum, c) => sum + charStaticScore(c, 喜用神, 忌神, 次用), 0);
    const draft: DraftCandidate = {
      名,
      分,
      笔画和: infos.reduce((sum, c) => sum + c.康熙笔画, 0),
      五行,
      爆款度,
      依据: [],
    };
    草案.push({ draft, 评估, 出处: [...出处列表].sort(cmp出处) });
  }

  // ④ 确定性排序（分降 → 笔画和升 → 名码点升；名部唯一，比较器天然全序）。
  草案.sort((a, b) => compareDraft(a.draft, b.draft));

  const 候选: MingrenCandidate[] = 草案
    .slice(0, req.上限)
    .map(({ 评估, 出处 }) => ({ ...评估, 出处 }));

  return { 候选, 库规模: 库.length, 命中名数 };
}
