/**
 * 卷四 · 五格（仅在提供了名字草案且有五格结果时渲染实义内容）：
 * 综合评分徽标（排盘期 scoreWuge 算好，此处只消费不重算）、
 * 天人地外总五卡（数理+吉凶+含义折叠）、三才、逐字 简体→繁体→康熙笔画 链路、争议脚注。
 * 契约 v4 §2.2 联动：意向 ≥2 名时头部出下拉（选择 prop，juan5 同款共用），
 * 选中意向名 → 数据源切 评估列表 同名项之 五格（computeWuge(姓氏,名)，与本卷 chart.wuge 同口径）；
 * 选择 缺省（显示下拉=false）→ 逐字节现状。
 */
import type { EvaluatedName } from '@/lib/evaluate/types';
import type { GeItem, WugeResult, WugeTier } from '@/lib/types';
import type { 卷四五选择控制 } from '@/utils/roll45-name-select';
import { GrayNote, Juan, LuckBadge } from './ui';

const GE_ORDER: Array<{ 名: string; key: '天格' | '人格' | '地格' | '外格' | '总格'; 义: string }> = [
  { 名: '天格', key: '天格', 义: '祖荫·先天' },
  { 名: '人格', key: '人格', 义: '主运·核心' },
  { 名: '地格', key: '地格', 义: '前运·基础' },
  { 名: '外格', key: '外格', 义: '副运·外缘' },
  { 名: '总格', key: '总格', 义: '总运·晚成' },
];

/** 档位徽标色：上乘/优良 cinnabar 高亮系、中上金、及格中性、欠佳 dim（对齐 LuckBadge 语义色风格）。 */
const TIER_CLASS: Readonly<Record<WugeTier, string>> = Object.freeze({
  上乘: 'border-cinnabar bg-cinnabar/10 text-cinnabar',
  优良: 'border-cinnabar text-cinnabar',
  中上: 'border-gold text-gold',
  及格: 'border-ink/40 text-ink-soft',
  欠佳: 'border-ink/30 text-ink/40',
});

function ScoreBadge({ 评分 }: { 评分: WugeResult['评分'] }) {
  return (
    <p className="mb-3 flex flex-wrap items-center gap-2 border border-ink/25 bg-paper/50 px-4 py-3">
      <span className="text-sm tracking-widest text-ink-soft">五格评分</span>
      <span className="text-3xl font-bold leading-none">{评分.综合分}</span>
      <span
        className={`inline-block rounded-sm border px-1.5 py-0.5 text-xs font-bold ${TIER_CLASS[评分.档位]}`}
      >
        {评分.档位}
      </span>
      <span className="ml-auto text-[10px] text-ink-soft">天格不计分 · 民俗口径参考</span>
    </p>
  );
}

function GeCard({ 名, 义, item, 不计分 }: { 名: string; 义: string; item: GeItem; 不计分?: boolean }) {
  return (
    <div className="border border-ink/25 bg-paper/50 p-3 text-center">
      <p className="text-xs tracking-widest text-ink-soft">
        {名} <span className="opacity-70">· {义}</span>
        {不计分 ? (
          <span className="ml-1 rounded-sm border border-ink/30 px-1 text-[10px] opacity-70">不计分</span>
        ) : null}
      </p>
      <p className="mt-1 text-3xl font-bold">{item.数理}</p>
      <p className="mt-0.5 text-[10px] text-ink-soft">康熙笔画和 {item.康熙笔画和}</p>
      <p className="mt-1">
        <LuckBadge 吉凶={item.吉凶} />
      </p>
      <details className="mt-1.5 text-left">
        <summary className="text-[11px] text-ink-soft">数理含义</summary>
        <p className="mt-1 text-xs leading-relaxed text-ink-soft">{item.含义}</p>
      </details>
    </div>
  );
}

/** 卷四/卷五同款受控下拉（契约 v4 §2.2）：含「按起盘草案」空值项；选中名右侧回显「（意向）」。 */
export function 卷四五名选({ 选择 }: { 选择: 卷四五选择控制 }) {
  return (
    <p className="mb-3 flex flex-wrap items-center gap-2 border border-ink/25 bg-paper/50 px-4 py-2 text-sm">
      <label className="flex items-center gap-2 text-ink-soft">
        查看名字
        <select
          value={选择.选中 ?? ''}
          onChange={(e) => 选择.onChange(e.target.value === '' ? null : e.target.value)}
          className="w-auto border-ink/25 bg-paper text-ink"
        >
          <option value="">按起盘草案</option>
          {选择.选项.map((名) => (
            <option key={名} value={名}>
              {名}
            </option>
          ))}
        </select>
      </label>
      {选择.选中 !== null ? <span className="text-xs text-cinnabar">（意向）</span> : null}
    </p>
  );
}

export function Juan4Wuge({
  wuge,
  草案名,
  选择,
  评估列表,
}: {
  wuge: WugeResult | null;
  草案名: string | null;
  /** 缺省=显示下拉=false（意向 ≤1）——不渲染下拉、数据源不切换，逐字节现状。 */
  选择?: 卷四五选择控制;
  /** 意向名评估（选中名之五格来源；缺省视为评估未到）。 */
  评估列表?: readonly EvaluatedName[];
}) {
  // 数据源切换（契约 §2.2）：选中 null → chart 盘面原样；非 null → 评估列表同名项
  // （undefined=评估未到→「评估中…」占位；五格 null=表外字→沿用现 null 占位）。
  const 意向选中 = 选择?.选中 ?? null;
  const 选中评估 = 意向选中 !== null ? 评估列表?.find((e) => e.名 === 意向选中) : undefined;
  const 评估中 = 意向选中 !== null && 选中评估 === undefined;
  const 显示五格 = 意向选中 !== null ? 选中评估?.五格 ?? null : wuge;
  const 显示名 = 意向选中 ?? 草案名;
  const body = 评估中 ? (
    <p className="text-sm text-ink-soft">「{意向选中}」评估中…</p>
  ) : 显示五格 ? (
    <>
      <ScoreBadge 评分={显示五格.评分} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {GE_ORDER.map((g) => (
          <GeCard key={g.key} 名={g.名} 义={g.义} item={显示五格[g.key]} 不计分={g.key === '天格'} />
        ))}
      </div>

      <section className="mt-4 border border-ink/25 p-4">
        <h3 className="text-sm font-bold tracking-widest">
          三才配置 <span className="ml-2 font-normal">{显示五格.三才.配置}</span> <LuckBadge 吉凶={显示五格.三才.吉凶} />
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-ink-soft">{显示五格.三才.含义}</p>
      </section>

      <section className="mt-4 border border-ink/25 p-4">
        <h3 className="mb-2 text-sm font-bold tracking-widest">逐字笔画链路（简体 → 繁体 → 康熙笔画）</h3>
        <ul className="flex flex-wrap gap-3">
          {显示五格.明细.map((m, i) => (
            <li key={`${m.简体}-${i}`} className="border border-ink/20 px-3 py-2 text-center">
              <p className="text-lg font-bold">
                {m.简体}
                {m.繁体 !== m.简体 ? <span className="text-ink-soft"> → {m.繁体}</span> : null}
              </p>
              <p className="text-xs text-gold">{m.康熙笔画} 画</p>
            </li>
          ))}
        </ul>
      </section>

      {显示五格.争议标注.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {显示五格.争议标注.map((s, i) => (
            <li key={i}>
              <GrayNote>争议标注：{s}</GrayNote>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-2 border-t border-dashed border-ink/20 pt-2 text-xs leading-relaxed text-ink-soft">
        {显示五格.五格起源争议提示}
      </p>
    </>
  ) : (
    <p className="text-sm text-ink-soft">
      {显示名
        ? '本次未产出五格结果（可能因个别字康熙笔画缺载），故五格部分从略。'
        : '未提供名字草案，五格剖象与平仄两卷从略；填「名字草案」后可校验现有名字。'}
    </p>
  );
  return (
    <Juan
      id="juan4"
      卷="卷四"
      题="五格剖象"
      述="天、人、地、外、总五格数理与三才配置——按康熙笔画计算，逐字链路可核对。"
      尾注={显示五格 ? '五格剖象为近代移植体系（见页内起源说明），与八字子平分属两路，不宜互证；参考即可。' : undefined}
    >
      {选择 ? <卷四五名选 选择={选择} /> : null}
      {body}
    </Juan>
  );
}
