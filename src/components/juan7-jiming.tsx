'use client';

/**
 * 卷七 · 吉名呈览（契约 v2：自原卷六 juan6-jiming.tsx 整体迁移，卷次顺延；
 * 原「重新生成」批次控制/分页范式一字不动，新增两件事）：
 * ① 候选卡 like 按钮：♡ 入卷六 → 点按即入意向吉名（点赞）；已在意向集 → ♥ 已入卷六 置灰禁点；
 * ② 头部模式切换「生成候选 | 名人匹配」：名人模式组件内自 fetch requestMingrenMatch
 *   （useEffect + AbortController，盘/名字形式/模式变化重取，切盘重置分页；失败朱字可重试），
 *   结果卡同 CandidateCard 骨架 + 出处区（逐人 姓+名/时代/类别/简介 + 出处类型徽标——
 *   出处诚实铁律：库内只收真实可考来源，UI 原样转呈不添油加醋）。like 对两种卡同样生效。
 * AI 综解（AiAnswer）仍在卷尾，不受模式影响。
 */
import { useEffect, useRef, useState } from 'react';
import type { EvaluatedName, 契合档位, 契合评估 } from '@/lib/evaluate/types';
import type { MingrenCandidate, 出处类型 } from '@/lib/mingren/types';
import type { ChartResult, GeItem, WugeResult } from '@/lib/types';
import type { Intent来源, IntentEntry, 批量加入结果 } from '@/utils/intent-names-storage';
import { buzzLabel } from '@/utils/format';
import { requestMingrenMatch } from '@/utils/name-eval';
import { WUXING_TEXT_CLASS } from '@/utils/wuxing';
import { AiAnswer } from './ai-answer';
import { AiNaming } from './ai-naming';
import { PingzeDetail } from './pingze-detail';
import { Bar, Juan, LuckBadge, WuxingChip } from './ui';

type Candidate = ChartResult['candidates'][number];

/** 每页候选卡数（任务 #28 定值，名人模式同用）。 */
const PAGE_SIZE = 5;

/** 批次控制（naming-app 状态机注入；缺省=无批次上下文，如单测/静态展示）。 */
export interface 批次控制 {
  /** 当前批 1 基序号。 */
  批序号: number;
  批总数: number;
  /** 「重新生成」请求在途：按钮禁用显示「生成中…」。 */
  生成中: boolean;
  /** 灰字中性提示（候选池用尽等）。 */
  提示: string | null;
  /** 朱字失败提示（重新生成请求出错）。 */
  失败: string | null;
  重新生成: () => void;
  /** 切到目标批（0 基索引）。 */
  切批: (索引: number) => void;
}

/** 意向吉名控制（naming-app 状态机注入；卷七 like 写入、卷六列表/移除共用）。 */
export interface 意向控制 {
  /** 有序条目（存储层顺序=加入顺序，最旧在前）。 */
  条目: IntentEntry[];
  /** 名集合速查（O(1) 判定「已入卷六」）。 */
  集合: ReadonlySet<string>;
  加入: (名: string, 来源: Intent来源) => void;
  /** 批量导入（v2.1）：透传存储层 addIntentEntries（只填容量、不裁旧）；计数供导入面板反馈。 */
  批量加入: (名列表: readonly string[], 来源: Intent来源) => 批量加入结果;
  移除: (名: string) => void;
}

const 翻页钮 =
  'border border-ink/40 px-3 py-1 text-sm font-bold text-ink transition-colors hover:border-cinnabar hover:text-cinnabar disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-ink/40 disabled:hover:text-ink';

const GE_KEYS: Array<{ 名: string; key: '天格' | '人格' | '地格' | '外格' | '总格' }> = [
  { 名: '天', key: '天格' },
  { 名: '人', key: '人格' },
  { 名: '地', key: '地格' },
  { 名: '外', key: '外格' },
  { 名: '总', key: '总格' },
];

/** 五格简分：EvaluatedName.五格 可 null（表外字致笔画不可得）——消费方判空提示。 */
export function WugeMini({ wuge }: { wuge: WugeResult | null }) {
  if (wuge === null) {
    return <p className="text-xs text-cinnabar">表外字致康熙笔画不可得，五格暂缺。</p>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {GE_KEYS.map((g) => {
        const item: GeItem = wuge[g.key];
        return (
          <span key={g.key} className="flex items-center gap-1 border border-ink/20 px-1.5 py-0.5 text-xs">
            <span className="text-ink-soft">{g.名}</span>
            <span className="font-bold">{item.数理}</span>
            <LuckBadge 吉凶={item.吉凶} />
          </span>
        );
      })}
    </div>
  );
}

/** 契合档位徽标配色（卷六卡 / 卷七卡 / 卷二名字 chip 共用，色值冻结勿改）。 */
export const 档位Class: Readonly<Record<契合档位, string>> = {
  上: 'border-wuxing-mu text-wuxing-mu',
  中上: 'border-dai text-dai',
  中: 'border-ink/40 text-ink-soft',
  下: 'border-cinnabar text-cinnabar',
};

function 契合Chip({ 标签, 五行, cls }: { 标签: string; 五行: string; cls: string }) {
  return <span className={`border px-1 text-xs ${cls}`}>{标签}·{五行}</span>;
}

/** 契合评估区（卷六/名人卡通用）：档位徽标 + 逐字命中/犯忌 chip + 人话说明。 */
export function 契合区({ 契合 }: { 契合: 契合评估 }) {
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-ink-soft">八字契合</span>
        <span className={`inline-block rounded-sm border px-1 text-xs font-bold ${档位Class[契合.档位]}`}>
          {契合.档位}
        </span>
        <span className="text-xs text-ink-soft">分 {契合.分}</span>
        {契合.命中喜用.map((e, i) => (
          <契合Chip key={`喜${i}`} 标签="喜" 五行={e} cls="border-wuxing-mu text-wuxing-mu" />
        ))}
        {契合.命中次用.map((e, i) => (
          <契合Chip key={`次${i}`} 标签="次" 五行={e} cls="border-gold text-gold" />
        ))}
        {契合.命中忌神.map((e, i) => (
          <契合Chip key={`忌${i}`} 标签="忌" 五行={e} cls="border-cinnabar text-cinnabar" />
        ))}
      </div>
      {契合.说明.length > 0 ? (
        <ul className="space-y-0.5 text-xs leading-relaxed text-ink-soft">
          {契合.说明.map((s, i) => (
            <li key={i}>· {s}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** like 按钮：已在意向集 → ♥ 已入卷六 置灰禁点；否则 ♡ 入卷六。 */
function LikeButton({ 名, 已在意向, onLike }: { 名: string; 已在意向: boolean; onLike: (名: string) => void }) {
  return (
    <button
      type="button"
      disabled={已在意向}
      onClick={() => onLike(名)}
      aria-label={已在意向 ? `「${名}」已在意向吉名` : `将「${名}」加入意向吉名`}
      className={`ml-auto shrink-0 border px-2 py-0.5 text-sm transition-colors ${
        已在意向
          ? 'cursor-not-allowed border-ink/20 text-ink-soft'
          : 'border-cinnabar/60 text-cinnabar hover:bg-cinnabar hover:text-paper'
      }`}
    >
      {已在意向 ? '♥ 已入卷六' : '♡ 入卷六'}
    </button>
  );
}

/** 生成模式候选卡：原卷六卡 + like（内部逻辑与折叠区不动）。 */
function CandidateCard({ c, 已在意向, onLike }: { c: Candidate; 已在意向: boolean; onLike: (名: string) => void }) {
  const buzz = buzzLabel(c.爆款度);
  return (
    <li className="border border-ink/25 bg-paper/50 p-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-2xl font-bold tracking-widest">{c.名}</h3>
        <span className="flex gap-1">
          {c.五行.map((e, i) => (
            <WuxingChip key={`${e}-${i}`} 五行={e} textClass={WUXING_TEXT_CLASS[e]} />
          ))}
        </span>
        <span className="text-sm text-ink-soft">
          平仄 <span className="font-bold text-ink">{c.平仄.平仄格式}</span>
        </span>
        <LikeButton 名={c.名} 已在意向={已在意向} onLike={onLike} />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div>
          <p className="mb-1 text-xs text-ink-soft">五格简分</p>
          <WugeMini wuge={c.五格} />
        </div>
        <div>
          <p className="mb-1 flex items-baseline justify-between text-xs text-ink-soft">
            <span>爆款度（近五年重名热度）</span>
            <span className={buzz.warn ? 'font-bold text-cinnabar' : 'font-medium'}>
              {buzz.percent}
              {buzz.warn ? ' · 烂大街预警' : ''}
            </span>
          </p>
          <Bar percent={Number.parseFloat(buzz.percent)} barClass={buzz.warn ? 'bg-cinnabar' : 'bg-dai'} />
        </div>
      </div>

      {!c.平仄.字表校验.全部在通用规范汉字表 ? (
        <p className="mt-2 text-sm text-cinnabar">
          ⚠ 表外字「{c.平仄.字表校验.表外字.join('、')}」：落户登记可能受限。
        </p>
      ) : null}

      <details className="mt-3">
        <summary className="text-xs text-ink-soft">入选依据（{c.入选依据.length} 条）</summary>
        <ul className="mt-1 space-y-0.5 pl-4 text-xs leading-relaxed text-ink-soft">
          {c.入选依据.map((s, i) => (
            <li key={i}>· {s}</li>
          ))}
        </ul>
      </details>
      <details className="mt-1.5">
        <summary className="text-xs text-ink-soft">平仄谐音明细</summary>
        <div className="mt-1.5">
          <PingzeDetail pingze={c.平仄} compact />
        </div>
      </details>
    </li>
  );
}

const 出处类型Class: Readonly<Record<出处类型, string>> = {
  史传: 'border-dai text-dai',
  科第录: 'border-dai text-dai',
  方志: 'border-ink/40 text-ink-soft',
  公开资料: 'border-gold text-gold',
};

/** 名人候选卡：EvaluatedName 同款骨架（名/五行/平仄/五格Mini/爆款/契合/表外警告）+ 出处区。 */
function MingrenCandidateCard({
  c,
  已在意向,
  onLike,
}: {
  c: MingrenCandidate;
  已在意向: boolean;
  onLike: (名: string) => void;
}) {
  const buzz = buzzLabel(c.爆款度);
  return (
    <li className="border border-ink/25 bg-paper/50 p-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-2xl font-bold tracking-widest">{c.名}</h3>
        <span className="flex gap-1">
          {c.五行.map((e, i) => (
            <WuxingChip key={`${e}-${i}`} 五行={e} textClass={WUXING_TEXT_CLASS[e]} />
          ))}
        </span>
        <span className="text-sm text-ink-soft">
          平仄 <span className="font-bold text-ink">{c.平仄.平仄格式}</span>
        </span>
        <LikeButton 名={c.名} 已在意向={已在意向} onLike={onLike} />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div>
          <p className="mb-1 text-xs text-ink-soft">五格简分</p>
          <WugeMini wuge={c.五格} />
        </div>
        <div>
          <p className="mb-1 flex items-baseline justify-between text-xs text-ink-soft">
            <span>爆款度（近五年重名热度）</span>
            <span className={buzz.warn ? 'font-bold text-cinnabar' : 'font-medium'}>
              {buzz.percent}
              {buzz.warn ? ' · 烂大街预警' : ''}
            </span>
          </p>
          <Bar percent={Number.parseFloat(buzz.percent)} barClass={buzz.warn ? 'bg-cinnabar' : 'bg-dai'} />
        </div>
      </div>

      <div className="mt-3">
        <契合区 契合={c.契合} />
      </div>

      {c.表外字.length > 0 ? (
        <p className="mt-2 text-sm text-cinnabar">
          ⚠ 表外字「{c.表外字.join('、')}」：落户登记可能受限。
        </p>
      ) : null}

      <div className="mt-3 border-t border-dashed border-ink/20 pt-2">
        <p className="mb-1 text-xs text-ink-soft">
          原名出处（同名部 {c.出处.length} 人，来源真实可考）
        </p>
        <ul className="space-y-1.5">
          {c.出处.map((p, i) => (
            <li key={`${p.姓}${p.名}-${i}`} className="text-xs leading-relaxed">
              <span className="font-bold text-ink">
                {p.姓}
                {p.名}
              </span>
              <span className="ml-1.5 text-ink-soft">
                {p.时代} · {p.类别}
              </span>
              <p className="text-ink-soft">{p.简介}</p>
              <p className="mt-0.5">
                <span className={`mr-1 inline-block rounded-sm border px-1 ${出处类型Class[p.出处类型]}`}>
                  {p.出处类型}
                </span>
                <span className="text-ink-soft">{p.出处}</span>
              </p>
            </li>
          ))}
        </ul>
      </div>

      <details className="mt-1.5">
        <summary className="text-xs text-ink-soft">平仄谐音明细</summary>
        <div className="mt-1.5">
          <PingzeDetail pingze={c.平仄} compact />
        </div>
      </details>
    </li>
  );
}

/** 批次头部控制区：重新生成 + 批间导航（M>1 才显示）+ 提示/失败文案。 */
function BatchBar({ 批次 }: { 批次: 批次控制 }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
      <button
        type="button"
        disabled={批次.生成中}
        onClick={批次.重新生成}
        className="border border-ink/40 px-4 py-1 text-sm font-bold tracking-widest text-ink transition-colors hover:border-cinnabar hover:text-cinnabar disabled:cursor-not-allowed disabled:opacity-50"
      >
        {批次.生成中 ? '生成中…' : '重新生成'}
      </button>
      {批次.批总数 > 1 ? (
        <span className="flex items-center gap-2 text-sm text-ink-soft">
          第 {批次.批序号} 批·共 {批次.批总数} 批
          <button
            type="button"
            aria-label="上一批"
            disabled={批次.生成中 || 批次.批序号 <= 1}
            onClick={() => 批次.切批(批次.批序号 - 2)}
            className={翻页钮}
          >
            ◀
          </button>
          <button
            type="button"
            aria-label="下一批"
            disabled={批次.生成中 || 批次.批序号 >= 批次.批总数}
            onClick={() => 批次.切批(批次.批序号)}
            className={翻页钮}
          >
            ▶
          </button>
        </span>
      ) : null}
      {批次.失败 ? <p className="text-sm font-bold text-cinnabar">{批次.失败}</p> : null}
      {批次.提示 ? <p className="text-xs text-ink-soft">{批次.提示}</p> : null}
    </div>
  );
}

/** 分页区（两种模式共用，PAGE_SIZE=5 范式）。 */
function Pager({
  当前页,
  总页数,
  onJump,
}: {
  当前页: number;
  总页数: number;
  onJump: (页: number) => void;
}) {
  if (总页数 <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-center gap-3">
      <button type="button" disabled={当前页 <= 1} onClick={() => onJump(当前页 - 1)} className={翻页钮}>
        上一页
      </button>
      <span aria-live="polite" className="text-sm text-ink-soft">
        第 {当前页} / {总页数} 页
      </span>
      <button type="button" disabled={当前页 >= 总页数} onClick={() => onJump(当前页 + 1)} className={翻页钮}>
        下一页
      </button>
    </div>
  );
}

type 模式 = '生成候选' | '名人匹配';

interface 名人状态 {
  phase: 'loading' | 'ok' | 'error';
  候选: readonly MingrenCandidate[];
  错误: string | null;
  诊断: { 库规模: number; 命中名数: number } | null;
}

const 名人初始: 名人状态 = { phase: 'loading', 候选: [], 错误: null, 诊断: null };

export function Juan7Jiming({
  chart,
  批次,
  意向,
  评估列表,
}: {
  chart: ChartResult;
  批次?: 批次控制;
  意向: 意向控制;
  /** 意向名服务端评估（契约 v4 §2.2：透传给 AiAnswer 作 意向评估；缺省=不传）。 */
  评估列表?: readonly EvaluatedName[];
}) {
  const [页码, set页码] = useState(1); // 1 基（两种模式共用）
  const [模式, set模式] = useState<模式>('生成候选');
  const [名字形式, set名字形式] = useState<'单名' | '双名'>('双名');
  const [名人, set名人] = useState<名人状态>(名人初始);
  const [重试, set重试] = useState(0);
  // 排除已选快照：like 不触发重取（重取依赖=盘/名字形式/模式，契约 §6），经 ref 读最新意向名
  const 意向名Ref = useRef<string[]>([]);
  useEffect(() => {
    意向名Ref.current = 意向.条目.map((e) => e.名);
  }, [意向.条目]);

  // 批次/盘/模式切换回第 1 页（chart 引用与批序号双保险：mock 模式下各批同引用）；
  // 防御性钳制在渲染处（页码越界钳回末页而非渲染空页）。
  useEffect(() => {
    set页码(1);
  }, [chart, 批次?.批序号, 模式]);

  // 名人匹配：仅模式/名字形式/盘变化时重取；卸载/依赖变化 abort 在途请求；失败朱字可重试。
  useEffect(() => {
    if (模式 !== '名人匹配') return;
    const ac = new AbortController();
    set名人({ ...名人初始, phase: 'loading' });
    requestMingrenMatch(
      {
        姓氏: chart.输入.姓氏,
        性别: chart.输入.性别,
        名字形式,
        喜用神: chart.xiyongshen.喜用神,
        忌神: chart.xiyongshen.忌神,
        喜用神明细: chart.xiyongshen.喜用神明细,
        避讳字: chart.输入.避讳字,
        排除已选: 意向名Ref.current,
      },
      ac.signal,
    )
      .then((r) => {
        if (ac.signal.aborted) return;
        set名人({
          phase: 'ok',
          候选: [...r.候选],
          错误: null,
          诊断: { 库规模: r.库规模, 命中名数: r.命中名数 },
        });
      })
      .catch((error: unknown) => {
        if (ac.signal.aborted) return;
        set名人({
          phase: 'error',
          候选: [],
          错误: error instanceof Error ? error.message : '名人匹配失败，请重试。',
          诊断: null,
        });
      });
    return () => ac.abort();
  }, [模式, 名字形式, chart, 重试]);

  const onLike = (名: string) => 意向.加入(名, '点赞');

  const 生成列表 = chart.candidates;
  const 列表: Array<Candidate | MingrenCandidate> = 模式 === '生成候选' ? 生成列表 : [...名人.候选];
  const 总页数 = Math.max(1, Math.ceil(列表.length / PAGE_SIZE));
  const 当前页 = Math.min(页码, 总页数);
  const 本页 = 列表.slice((当前页 - 1) * PAGE_SIZE, 当前页 * PAGE_SIZE);
  const tab钮 = (激活: boolean) =>
    `border px-4 py-1 text-sm font-bold tracking-widest transition-colors ${
      激活 ? 'border-cinnabar bg-cinnabar/10 text-cinnabar' : 'border-ink/40 text-ink hover:border-cinnabar hover:text-cinnabar'
    }`;

  return (
    <Juan
      id="juan7"
      卷="卷七"
      题="吉名呈览"
      述="候选名由固定算法按喜用神、五格、平仄、爆款度海选而出——每一名的入选依据俱在，可查可驳；♡ 一点即入卷六意向吉名。"
      尾注="候选仅供参考，名字的吉凶不在笔画音韵，而在唤它之人的心意；民俗口径，非科学结论。"
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => set模式('生成候选')} className={tab钮(模式 === '生成候选')}>
          生成候选
        </button>
        <button type="button" onClick={() => set模式('名人匹配')} className={tab钮(模式 === '名人匹配')}>
          名人匹配
        </button>
        {模式 === '名人匹配' ? (
          <span className="ml-auto flex items-center gap-1 text-xs text-ink-soft">
            名部形式：
            <button
              type="button"
              onClick={() => set名字形式('单名')}
              className={`border px-2 py-0.5 ${名字形式 === '单名' ? 'border-cinnabar text-cinnabar' : 'border-ink/30 text-ink-soft hover:border-cinnabar hover:text-cinnabar'}`}
            >
              单名
            </button>
            <button
              type="button"
              onClick={() => set名字形式('双名')}
              className={`border px-2 py-0.5 ${名字形式 === '双名' ? 'border-cinnabar text-cinnabar' : 'border-ink/30 text-ink-soft hover:border-cinnabar hover:text-cinnabar'}`}
            >
              双名
            </button>
          </span>
        ) : null}
      </div>

      {模式 === '生成候选' ? (
        <>
          {批次 ? <BatchBar 批次={批次} /> : null}
          {生成列表.length === 0 ? (
            // 契约 v3 §1.6 冻结文案：指定字存在时空态如实报「无一生还」，绝不暗示偷偷放宽。
            chart.输入.指定字 ? (
              <p className="text-sm text-cinnabar">
                指定字「{chart.输入.指定字.字}」于本盘姓氏骨架/喜用/谐音诸关无一生还——可换字或去指定字重排。
              </p>
            ) : (
              <p className="text-sm text-ink-soft">本次未产出候选名（候选池为空）。</p>
            )
          ) : (
            <>
              <ul className="space-y-4">
                {本页.map((c) => {
                  const cand = c as Candidate;
                  return (
                    <CandidateCard key={cand.名} c={cand} 已在意向={意向.集合.has(cand.名)} onLike={onLike} />
                  );
                })}
              </ul>
              <Pager 当前页={当前页} 总页数={总页数} onJump={set页码} />
            </>
          )}
        </>
      ) : (
        <>
          <p className="mb-3 text-xs leading-relaxed text-ink-soft">
            从历代名人库按名部（不含姓）匹配当前盘：犯讳禁/任一字犯忌神/含姓谐音者剔，其余全数呈出，
            以喜用契合与五格排序下沉并如实注记（未中喜用/五格低分/表外字）；
            出处逐人标注真实文献类型——史传/科第录/方志为古籍可考，当代人物一律「公开资料」，不作伪造引文。
          </p>
          {名人.phase === 'loading' ? (
            <p className="py-8 text-center text-sm text-ink-soft">
              <span className="animate-ink-pulse">☰</span> 正在按当前盘检索名人库……
            </p>
          ) : 名人.phase === 'error' ? (
            <div className="border-l-4 border-cinnabar bg-cinnabar/5 px-4 py-3">
              <p className="text-sm font-bold text-cinnabar">名人匹配未成：{名人.错误}</p>
              <button
                type="button"
                onClick={() => set重试((n) => n + 1)}
                className="mt-2 border border-cinnabar px-4 py-1 text-xs font-bold text-cinnabar hover:bg-cinnabar hover:text-paper"
              >
                重试
              </button>
            </div>
          ) : 名人.候选.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-soft">
              当前盘下无名部可入选（犯讳禁/任一字犯忌神/含姓谐音者已剔——余者皆呈，不再以喜用/五格/表外为筛）。
              切换名部形式或重新排盘可再试。
            </p>
          ) : (
            <>
              <p className="mb-2 text-xs text-ink-soft">
                {名人.诊断 ? `库 ${名人.诊断.库规模} 人 · 名部命中 ${名人.诊断.命中名数} 名，经讳禁/忌神/谐音终筛呈 ` : ''}
                {名人.候选.length} 名
              </p>
              <ul className="space-y-4">
                {本页.map((c) => {
                  const cand = c as MingrenCandidate;
                  return (
                    <MingrenCandidateCard key={cand.名} c={cand} 已在意向={意向.集合.has(cand.名)} onLike={onLike} />
                  );
                })}
              </ul>
              <Pager 当前页={当前页} 总页数={总页数} onJump={set页码} />
            </>
          )}
        </>
      )}
      {/* 契约 v4 §1.4/§2.2：意向名单+评估随请求上送（AiAnswer props 由 ai agent 并行实现） */}
      <AiAnswer chart={chart} 意向名单={意向.条目.map((e) => e.名)} 意向评估={评估列表} />
      {/* AI 终选起名 · 匠心五荐 */}
      <AiNaming
        chart={chart}
        意向名单={意向.条目.map((e) => e.名)}
        意向评估={评估列表}
        onLike={onLike}
        已在意向集合={意向.集合}
      />
    </Juan>
  );
}
