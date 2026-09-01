'use client';

/**
 * 名字卡原语（C4）：自 juan7-jiming.tsx 抽出的共享渲染件——
 * CandidateCard（生成候选卡）、MingrenCandidateCard（名人结果卡：EvaluatedName
 * 同款骨架 + 出处区 + 出处类型徽标）、WugeMini、契合区、档位Class、
 * Pager（翻页钮）、PAGE_SIZE。渲染逻辑逐字迁移不改样（卷六/卷七/名人模式共用）。
 * 名人匹配的 fetch 编排不在本层（卷七已摘名人模式，检索归 /jiming 工作台自持）。
 * 出处诚实铁律：库内只收真实可考来源，UI 原样转呈不添油加醋。
 */
import type { 契合档位, 契合评估 } from '@/lib/evaluate/types';
import type { MingrenCandidate, 出处类型 } from '@/lib/mingren/types';
import type { ChartResult, GeItem, WugeResult } from '@/lib/types';
import { buzzLabel } from '@/utils/format';
import { WUXING_TEXT_CLASS } from '@/utils/wuxing';
import { PingzeDetail } from './pingze-detail';
import { Bar, LuckBadge, WuxingChip } from './ui';

type Candidate = ChartResult['candidates'][number];

/** 每页候选卡数（任务 #28 定值，名人模式同用）。 */
export const PAGE_SIZE = 5;

/** 翻页/批导航共用钮样式（C4：原 juan7 模块常量一并抽出）。 */
export const 翻页钮 =
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

/** like 按钮：已在意向集 → ♥ 已入意向 置灰禁点；否则 ♡ 入意向（意向独立成页后改口）。 */
export function LikeButton({ 名, 已在意向, onLike }: { 名: string; 已在意向: boolean; onLike: (名: string) => void }) {
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
      {已在意向 ? '♥ 已入意向' : '♡ 入意向'}
    </button>
  );
}

/** 生成模式候选卡：原卷六卡 + like（内部逻辑与折叠区不动）。 */
export function CandidateCard({
  候选,
  已在意向,
  onLike,
}: {
  候选: Candidate;
  已在意向: boolean;
  onLike: (名: string) => void;
}) {
  const buzz = buzzLabel(候选.爆款度);
  return (
    <li className="border border-ink/25 bg-paper/50 p-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-2xl font-bold tracking-widest">{候选.名}</h3>
        <span className="flex gap-1">
          {候选.五行.map((e, i) => (
            <WuxingChip key={`${e}-${i}`} 五行={e} textClass={WUXING_TEXT_CLASS[e]} />
          ))}
        </span>
        <span className="text-sm text-ink-soft">
          平仄 <span className="font-bold text-ink">{候选.平仄.平仄格式}</span>
        </span>
        <LikeButton 名={候选.名} 已在意向={已在意向} onLike={onLike} />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div>
          <p className="mb-1 text-xs text-ink-soft">五格简分</p>
          <WugeMini wuge={候选.五格} />
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

      {!候选.平仄.字表校验.全部在通用规范汉字表 ? (
        <p className="mt-2 text-sm text-cinnabar">
          ⚠ 表外字「{候选.平仄.字表校验.表外字.join('、')}」：落户登记可能受限。
        </p>
      ) : null}

      <details className="mt-3">
        <summary className="text-xs text-ink-soft">入选依据（{候选.入选依据.length} 条）</summary>
        <ul className="mt-1 space-y-0.5 pl-4 text-xs leading-relaxed text-ink-soft">
          {候选.入选依据.map((s, i) => (
            <li key={i}>· {s}</li>
          ))}
        </ul>
      </details>
      <details className="mt-1.5">
        <summary className="text-xs text-ink-soft">平仄谐音明细</summary>
        <div className="mt-1.5">
          <PingzeDetail pingze={候选.平仄} compact />
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
export function MingrenCandidateCard({
  候选,
  已在意向,
  onLike,
}: {
  候选: MingrenCandidate;
  已在意向: boolean;
  onLike: (名: string) => void;
}) {
  const buzz = buzzLabel(候选.爆款度);
  return (
    <li className="border border-ink/25 bg-paper/50 p-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-2xl font-bold tracking-widest">{候选.名}</h3>
        <span className="flex gap-1">
          {候选.五行.map((e, i) => (
            <WuxingChip key={`${e}-${i}`} 五行={e} textClass={WUXING_TEXT_CLASS[e]} />
          ))}
        </span>
        <span className="text-sm text-ink-soft">
          平仄 <span className="font-bold text-ink">{候选.平仄.平仄格式}</span>
        </span>
        <LikeButton 名={候选.名} 已在意向={已在意向} onLike={onLike} />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div>
          <p className="mb-1 text-xs text-ink-soft">五格简分</p>
          <WugeMini wuge={候选.五格} />
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
        <契合区 契合={候选.契合} />
      </div>

      {候选.表外字.length > 0 ? (
        <p className="mt-2 text-sm text-cinnabar">
          ⚠ 表外字「{候选.表外字.join('、')}」：落户登记可能受限。
        </p>
      ) : null}

      <div className="mt-3 border-t border-dashed border-ink/20 pt-2">
        <p className="mb-1 text-xs text-ink-soft">
          原名出处（同名部 {候选.出处.length} 人，来源真实可考）
        </p>
        <ul className="space-y-1.5">
          {候选.出处.map((p, i) => (
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
          <PingzeDetail pingze={候选.平仄} compact />
        </div>
      </details>
    </li>
  );
}

/** 分页区（生成候选 / 名人模式共用，PAGE_SIZE=5 范式）。 */
export function Pager({
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
