'use client';

/**
 * 卷二 · 五行：加权力量条（含来源明细折叠）+ 纯 SVG 五芒星雷达 + 十神关系标签。
 *
 * 名字加成对比（lead 拍板：每字等权叠加段）：选中卷六意向名后，逐字五行以
 * 独立色段叠在力量条末端（基准得分不动，建模纯函数见 utils/name-bonus），
 * 雷达同步叠「加成后」虚线多边形——两多边形共享 maxValue=雷达刻度，否则对比说谎。
 * 本组件在生产中恒处 client 结果树下（从不单独 SSR），纯逻辑已外置 util，
 * 故直接标 'use client' 持本地选中名，不拆假边界。
 */
import { useState } from 'react';
import type { BaziResult } from '@/lib/types';
import { pentagonRadar } from '@/utils/radar';
import {
  ganToWuxing,
  RELATION_BADGE_CLASS,
  WUXING_BAR_CLASS,
  WUXING_ORDER,
  WUXING_TEXT_CLASS,
  wuxingRelation,
} from '@/utils/wuxing';
import { 计算名字加成, 单位刻度, type 命中分类 } from '@/utils/name-bonus';
import type { 评估状态 } from './use-name-evaluations';
import { 档位Class } from './juan7-jiming';
import { Bar, Juan } from './ui';

/** 叠加色段配色（元素级分类定色，字面量映射——Tailwind v4 不做动态类名拼接）。 */
const 叠加段Class: Readonly<Record<命中分类, string>> = {
  喜: 'bg-wuxing-mu',
  次: 'bg-dai',
  忌: 'bg-cinnabar',
  无: 'bg-ink/40',
};

function RadarSvg({
  labels,
  values,
  叠加值,
  刻度,
}: {
  labels: readonly string[];
  values: readonly number[];
  /** 名字加成后得分（WUXING_ORDER 序）；给定时叠第二虚线多边形。 */
  叠加值?: readonly number[] | null;
  /** 两多边形共享归一分母（缺省各自 max——仅无叠加路径）。 */
  刻度?: number;
}) {
  const opts = 刻度 !== undefined ? { size: 260, maxValue: 刻度 } : { size: 260 };
  const g = pentagonRadar(labels, values, opts);
  const 叠 = 叠加值 ? pentagonRadar(labels, 叠加值, opts) : null;
  return (
    <svg
      viewBox={`0 0 ${g.size} ${g.size}`}
      role="img"
      aria-label="五行力量雷达图"
      className="mx-auto h-auto w-full max-w-[300px]"
    >
      {g.rings.map((ring) => (
        <polygon
          key={ring.scale}
          points={ring.points}
          fill="none"
          className="stroke-ink/20"
          strokeWidth={ring.scale === 1 ? 1.2 : 0.6}
        />
      ))}
      {g.spokes.map((s, i) => (
        <line key={i} x1={g.cx} y1={g.cy} x2={s.x} y2={s.y} className="stroke-ink/20" strokeWidth={0.6} />
      ))}
      <polygon points={g.polygon} className="fill-cinnabar/25 stroke-cinnabar" strokeWidth={1.6} />
      {叠 ? (
        <polygon
          points={叠.polygon}
          fill="none"
          className="stroke-cinnabar"
          strokeDasharray="4 3"
          strokeWidth={1.4}
        />
      ) : null}
      {g.vertices.map((v) => (
        <text
          key={v.label}
          x={v.x}
          y={v.y}
          dy="0.35em"
          textAnchor={v.anchor}
          dx={v.anchor === 'start' ? 8 : v.anchor === 'end' ? -8 : 0}
          className="fill-ink text-[13px] font-bold"
        >
          {v.label} {v.value}
        </text>
      ))}
    </svg>
  );
}

export function Juan2Wuxing({ bazi, 评估 }: { bazi: BaziResult; 评估: 评估状态 }) {
  const [选中名, set选中名] = useState<string | null>(null);
  const 日主五行 = ganToWuxing(bazi.日主);
  const maxScore = Math.max(...bazi.五行力量.map((f) => f.得分), 1);

  const { 评估列表, 阶段 } = 评估;
  // 名单移除/换盘后选中名可能已不在评估列表——find 落空自然回退无叠加路径
  const 选中 = 评估列表.find((e) => e.名 === 选中名) ?? null;
  const 加成 = 计算名字加成(bazi.五行力量, 选中);
  const 行of = 加成 ? new Map(加成.行.map((r) => [r.五行, r])) : null;

  return (
    <Juan
      id="juan2"
      卷="卷二"
      题="五行力量"
      述={`日主 ${bazi.日主}（${日主五行 ?? '—'}）坐下，全局五行以藏干加权计分，强弱一览。`}
      尾注={`数量为加权计分（本气 100%／中气 70%／余气 50%，并计位置），非简单字数；民俗体系口径，非科学结论。${
        加成
          ? `名字加成段为选中名逐字五行等权示意（每字 +1 单位 = 轨道 ${单位刻度}%），不改动基准得分；忌字红段非扣分，义为「此名正在加强命里最怕的力量」。`
          : ''
      }`}
    >
      {/* 名字试选 chip 区：色段/虚线雷达的数据开关。重试唯一入口在卷六，此处只指路。 */}
      <div className="mb-4">
        {阶段 === 'error' ? (
          <p className="text-xs text-cinnabar">契合评估未成——重试请移步卷六。</p>
        ) : 评估列表.length === 0 ? (
          <p className="text-xs text-ink-soft">
            于卷六汇入意向吉名后，可在此试选一名，预览其对五行力量的加成走向
            {阶段 === 'loading' ? '（意向评估进行中…）' : ''}。
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-ink-soft">试选名字：</span>
            {评估列表.map((e) => (
              <button
                key={e.名}
                type="button"
                aria-pressed={选中名 === e.名}
                disabled={阶段 !== 'ready'}
                onClick={() => set选中名((p) => (p === e.名 ? null : e.名))}
                className={`border px-2 py-0.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  档位Class[e.契合.档位]
                } ${选中名 === e.名 ? 'bg-ink/10 font-bold' : ''}`}
              >
                {e.名}
                {e.表外字.length > 0 ? <span title={`表外字：${e.表外字.join('、')}`}> ⚠</span> : null}
              </button>
            ))}
            {选中名 ? (
              <button
                type="button"
                onClick={() => set选中名(null)}
                className="text-xs text-ink-soft underline underline-offset-2 hover:text-cinnabar"
              >
                清除
              </button>
            ) : null}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1fr_auto]">
        <ul className="space-y-3">
          {bazi.五行力量.map((f) => {
            const relation = 日主五行 ? wuxingRelation(日主五行, f.五行) : null;
            const r = 行of?.get(f.五行) ?? null;
            const 截断 = r !== null && r.基准百分比 + r.加成百分比 > 100;
            return (
              <li key={f.五行}>
                <div className="mb-1 flex items-baseline gap-2">
                  <span className={`text-base font-bold ${WUXING_TEXT_CLASS[f.五行]}`}>{f.五行}</span>
                  {r && r.加成单位数 > 0 ? (
                    <span className="text-xs font-bold text-ink-soft" title={`名字补${f.五行} ${r.加成单位数} 字（每字 +${单位刻度}% 轨道）`}>
                      +{r.加成单位数}
                    </span>
                  ) : null}
                  {relation ? (
                    <span className={`rounded-sm border px-1 text-[10px] font-bold ${RELATION_BADGE_CLASS[relation]}`}>
                      {relation}
                    </span>
                  ) : null}
                  <span className="ml-auto text-sm font-medium">{f.得分} 分</span>
                  <span
                    className="w-14 text-right text-xs text-ink-soft"
                    title={截断 ? '叠加色段已触轨道末端（加成数值未截断）' : undefined}
                  >
                    {Math.round((f.得分 / maxScore) * 100)}%
                    {截断 ? ' ▸' : ''}
                  </span>
                </div>
                <Bar
                  percent={(f.得分 / maxScore) * 100}
                  barClass={WUXING_BAR_CLASS[f.五行]}
                  叠加段={
                    r && r.加成单位数 > 0
                      ? { 宽度百分比: r.加成百分比, 类名: 叠加段Class[r.分类], 动画键: 选中?.名 ?? null }
                      : undefined
                  }
                />
                <details className="mt-1">
                  <summary className="text-xs text-ink-soft">来源明细（{f.来源.length} 条）</summary>
                  <ul className="mt-1 space-y-0.5 pl-4 text-xs leading-relaxed text-ink-soft">
                    {f.来源.map((s, i) => (
                      <li key={`${f.五行}-${i}`}>· {s}</li>
                    ))}
                  </ul>
                </details>
              </li>
            );
          })}
        </ul>
        <div className="shrink-0">
          <RadarSvg
            labels={WUXING_ORDER}
            values={bazi.五行力量.map((f) => f.得分)}
            叠加值={加成?.加成后得分 ?? null}
            刻度={加成?.雷达刻度}
          />
          {加成 ? (
            <p className="mx-auto max-w-[300px] text-center text-[11px] text-ink-soft">
              虚线 = 「{加成.名}」加成后（共享刻度，红段/虚线外扩=加强所忌）。
            </p>
          ) : null}
        </div>
      </div>
      {bazi.五行缺失.length > 0 ? (
        <p className="mt-3 text-sm text-cinnabar">
          表面缺失五行：{bazi.五行缺失.join('、')}——但「缺≠必补」，补益与否以卷三喜用神为准。
          {bazi.四柱.时 === null ? '（时辰未知，此据年月日三柱而论，非命局定论。）' : ''}
        </p>
      ) : (
        <p className="mt-3 text-xs text-ink-soft">
          五行明面俱全（缺否仍以力量与喜用论，见卷三）。
          {bazi.四柱.时 === null ? '时辰未知，仅据年月日三柱。' : ''}
        </p>
      )}
    </Juan>
  );
}
