'use client';

/**
 * 卷六 · 意向吉名（契约 v2 §1/§2/§6 + v2.1）：本机意向名清单（草案/点赞/导入三来源），
 * 顶部「批量导入」面板（粘贴文本切名 → 预览计数 → 确认走 意向.批量加入），
 * 评估状态已上提 naming-app（use-name-evaluations）由 props 注入——卷二名字
 * 加成对比共用同一份评估，请求时机与上提前一致（result 树挂载即取）；
 * 每卡转呈 五行/平仄/五格Mini/契合档/表外字警告，移除即写回存储。
 * 清单按 契合.分 降序渲染（并列保添加序）——纯展示层排序，存储仍按添加序不动。
 * 评估失败→朱字可重试（此处为唯一重试入口，卷二错误文案指回本页）。
 * 底部「AI 点评意向名」→ POST /api/analyze-names SSE（镜像 ai-answer.tsx：
 * 帧协议/错误帧不覆盖/[DONE] 不覆盖错误/卸载与重问 abort 清理同款纪律）。
 * 隐私口径：名单仅存本机浏览器，此处只把评估结果交服务端点评，不存服务器。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MarkdownBodyAsync } from '@/components/markdown-body-async';
import { EVALUATE_NAMES_MAX, type EvaluatedName } from '@/lib/evaluate/types';
import type { ChartResult } from '@/lib/types';
import { INTENT_NAMES_MAX, type Intent来源 } from '@/utils/intent-names-storage';
import { parseIntentImport } from '@/utils/parse-intent-import';
import { WUXING_TEXT_CLASS } from '@/utils/wuxing';
import { createSseParser, type SseEvent } from '@/utils/sse';
import type { 评估状态 } from './use-name-evaluations';
import { WugeMini, 契合区, type 意向控制 } from './juan7-jiming';
import { Juan, WuxingChip } from './ui';

/** 来源徽配色（字面量映射——Tailwind v4 不做动态类名拼接）：草案/点赞金徽一像素不动，导入黛蓝区分。 */
const 来源Class: Readonly<Record<Intent来源, string>> = {
  草案: 'border-gold text-gold',
  点赞: 'border-gold text-gold',
  导入: 'border-dai text-dai',
};

/** 意向卡：名 + 来源徽 + 五行/平仄 + 移除 + 五格Mini + 契合区 + 表外字警告。 */
function IntentCard({
  评估: e,
  来源,
  onRemove,
}: {
  评估: EvaluatedName;
  来源: Intent来源;
  onRemove: (名: string) => void;
}) {
  return (
    <li className="border border-ink/25 bg-paper/50 p-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-2xl font-bold tracking-widest">{e.名}</h3>
        <span className={`rounded-sm border px-1 text-xs ${来源Class[来源]}`}>{来源}</span>
        <span className="flex gap-1">
          {e.五行.map((wx, i) => (
            <WuxingChip key={`${wx}-${i}`} 五行={wx} textClass={WUXING_TEXT_CLASS[wx]} />
          ))}
        </span>
        <span className="text-sm text-ink-soft">
          平仄 <span className="font-bold text-ink">{e.平仄.平仄格式}</span>
        </span>
        <button
          type="button"
          onClick={() => onRemove(e.名)}
          aria-label={`将「${e.名}」移出意向吉名`}
          className="ml-auto shrink-0 border border-ink/30 px-2 py-0.5 text-sm text-ink-soft transition-colors hover:border-cinnabar hover:text-cinnabar"
        >
          ✕ 移除
        </button>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div>
          <p className="mb-1 text-xs text-ink-soft">五格简分</p>
          <WugeMini wuge={e.五格} />
        </div>
        <契合区 契合={e.契合} />
      </div>

      {e.表外字.length > 0 ? (
        <p className="mt-2 text-sm text-cinnabar">
          ⚠ 表外字「{e.表外字.join('、')}」：落户登记可能受限。
        </p>
      ) : null}
    </li>
  );
}

type AI阶段 = 'idle' | 'streaming' | 'done' | 'error';

/** AI 点评意向名：请求体=契约 §5（命盘摘要 + 评估≤30）；流式纪律同 ai-answer.tsx。 */
function AiIntentAnswer({ chart, 评估 }: { chart: ChartResult; 评估: readonly EvaluatedName[] }) {
  const [阶段, set阶段] = useState<AI阶段>('idle');
  const [推演, set推演] = useState('');
  const [正文, set正文] = useState('');
  const [错误, set错误] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const applyEvent = useCallback((ev: SseEvent) => {
    if (ev.kind === 'content') set正文((prev) => prev + ev.text);
    else if (ev.kind === 'reasoning') set推演((prev) => prev + ev.text);
    else if (ev.kind === 'error') {
      set错误(ev.text);
      set阶段('error');
    } else if (ev.kind === 'done') set阶段((p) => (p === 'error' ? p : 'done')); // [DONE] 不覆盖错误态
  }, []);

  const ask = useCallback(async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    set阶段('streaming');
    set推演('');
    set正文('');
    set错误(null);
    // 时柱 null（时辰未知降级）→ 占位串，保持 四柱 恒 4 项（服务端 zod 要求）
    const 四柱 = [
      chart.bazi.四柱.年.干支,
      chart.bazi.四柱.月.干支,
      chart.bazi.四柱.日.干支,
      chart.bazi.四柱.时?.干支 ?? '时辰未知',
    ];
    try {
      const res = await fetch('/api/analyze-names', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          命盘摘要: {
            四柱,
            日主: chart.xiyongshen.日主,
            喜用神: chart.xiyongshen.喜用神,
            忌神: chart.xiyongshen.忌神,
          },
          评估: 评估.slice(0, EVALUATE_NAMES_MAX),
        }),
        signal: ac.signal,
      });
      if (!res.ok) {
        let message = `点评请求失败（HTTP ${res.status}）`;
        try {
          const body = (await res.json()) as { error?: unknown };
          if (typeof body.error === 'string') message = body.error;
        } catch {
          /* 错误体非 JSON：保留状态码文案 */
        }
        set错误(message);
        set阶段('error');
        return;
      }
      if (!res.body) {
        set错误('响应无数据流，无法呈现点评。');
        set阶段('error');
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const parser = createSseParser();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const ev of parser.feed(decoder.decode(value, { stream: true }))) applyEvent(ev);
      }
      for (const ev of parser.flush()) applyEvent(ev);
      set阶段((p) => (p === 'streaming' ? 'done' : p));
    } catch (e) {
      if (ac.signal.aborted) return;
      set错误(e instanceof Error ? e.message : '未知错误');
      set阶段('error');
    }
  }, [chart, 评估, applyEvent]);

  return (
    <div className="mt-4 border border-ink/25 bg-paper/60 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={ask}
          disabled={阶段 === 'streaming' || 评估.length === 0}
          className="border border-cinnabar px-5 py-1.5 text-sm font-bold tracking-[0.25em] text-cinnabar transition-colors hover:bg-cinnabar hover:text-paper disabled:opacity-50"
        >
          {阶段 === 'streaming' ? '推演中…' : 阶段 === 'idle' ? 'AI 点评意向名' : '再评一次'}
        </button>
        {评估.length > EVALUATE_NAMES_MAX ? (
          <span className="text-xs text-ink-soft">名单较长，仅送评前 {EVALUATE_NAMES_MAX} 个。</span>
        ) : null}
        {阶段 === 'streaming' && 正文 === '' ? (
          <span className="text-sm text-ink-soft">
            <span className="animate-ink-pulse">☰ 推演中</span>
            <span className="animate-ink-pulse [animation-delay:0.2s]">☰</span>
            <span className="animate-ink-pulse [animation-delay:0.4s]">☰</span>
          </span>
        ) : null}
        {阶段 === 'done' ? <span className="text-xs text-ink-soft">—— 推演毕。</span> : null}
      </div>

      {推演 ? (
        <details className="mt-3">
          <summary className="text-xs text-gold">推演过程（模型思路，非命书原文）</summary>
          <p className="mt-1 whitespace-pre-wrap border-l-2 border-gold/40 pl-3 text-xs leading-relaxed text-ink-soft">
            {推演}
          </p>
        </details>
      ) : null}

      {错误 ? <p className="mt-3 text-sm font-medium text-cinnabar">AI 点评出错：{错误}</p> : null}

      {正文 ? (
        <article className="mt-3">
          <MarkdownBodyAsync text={正文} streaming={阶段 === 'streaming'} />
        </article>
      ) : null}

      {阶段 !== 'idle' && !错误 && !正文 && 阶段 !== 'streaming' ? (
        <p className="mt-3 text-xs text-ink-soft">模型未返回正文。</p>
      ) : null}

      <p className="mt-3 border-t border-dashed border-ink/20 pt-2 text-[11px] leading-relaxed text-ink-soft">
        AI 点评由大模型基于固定算法评估生成，可能出错；命理措辞属民俗文化表述，不构成任何科学或决策依据。
      </p>
    </div>
  );
}

/** 非法项折显：前 5 项 + 「等 N 项」（粘贴整段脏文本不刷屏）。 */
function 折显(非法项: readonly string[]): string {
  return 非法项.length > 5
    ? `${非法项.slice(0, 5).join('、')} 等 ${非法项.length} 项`
    : 非法项.join('、');
}

/**
 * 批量导入面板（契约 v2.1）：钮恒置于 Juan 体最顶、空态早退之前——名单为空
 * 正是要导入的时刻。展开才挂 textarea；预览 useMemo 三桶计数；确认走
 * 意向.批量加入（存储层只填容量丢尾部），反馈文案含满编补救指引。
 * 组件名用 ASCII——react-hooks 插件不认 CJK 组件名（先例 AiIntentAnswer/RadarSvg）。
 */
function ImportPanel({ 意向 }: { 意向: 意向控制 }) {
  const [展开, set展开] = useState(false);
  const [文本, set文本] = useState('');
  const [反馈, set反馈] = useState<string | null>(null);
  const 解析 = useMemo(() => parseIntentImport(文本, 意向.集合), [文本, 意向.集合]);

  const 收起 = () => {
    set展开(false);
    set文本('');
    set反馈(null);
  };
  const 确认 = () => {
    const { 新增, 已存在, 满编丢弃 } = 意向.批量加入(解析.有效名, '导入');
    const 段 = [`新增 ${新增}`, `已在名单 ${已存在}`];
    if (满编丢弃 > 0) 段.push(`名单已满（${INTENT_NAMES_MAX}），丢弃 ${满编丢弃} 个——先移除再导可补位`);
    set反馈(`导入完成：${段.join(' · ')}。`);
    set文本('');
  };

  return (
    <div className="mb-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          aria-expanded={展开}
          onClick={() => (展开 ? 收起() : set展开(true))}
          className="border border-ink/40 px-3 py-1 text-sm font-bold text-ink transition-colors hover:border-cinnabar hover:text-cinnabar"
        >
          {展开 ? '收起导入' : '批量导入'}
        </button>
        {反馈 ? <p className="text-xs text-ink-soft">{反馈}</p> : null}
      </div>
      {展开 ? (
        <div className="mt-2 border border-ink/25 bg-paper/50 p-3">
          <p className="mb-1 text-xs text-ink-soft">
            粘贴吉名，以换行／逗号／顿号／空格分隔；每项须 1-2 个汉字（只填名部，不含姓氏）。
          </p>
          <textarea
            value={文本}
            onChange={(ev) => set文本(ev.target.value)}
            rows={4}
            aria-label="批量导入意向吉名文本"
            placeholder={'知予、明轩\n雨桐 沐宸'}
            className="w-full border border-ink/30 bg-paper/60 p-2 text-sm"
          />
          {文本.trim() !== '' ? (
            <p className="mt-1 text-xs">
              <span className="text-ink-soft">
                可导入 {解析.有效名.length} · 已在名单 {解析.已在名单.length}
              </span>
              {解析.非法项.length > 0 ? (
                <span className="text-cinnabar">
                  {' '}
                  · 无效 {解析.非法项.length}（{折显(解析.非法项)}）
                </span>
              ) : null}
            </p>
          ) : null}
          <button
            type="button"
            onClick={确认}
            disabled={解析.有效名.length === 0}
            className="mt-2 border border-cinnabar px-4 py-1 text-sm font-bold text-cinnabar transition-colors hover:bg-cinnabar hover:text-paper disabled:cursor-not-allowed disabled:opacity-40"
          >
            加入 {解析.有效名.length} 名
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** 卷六主体：清单评估 + AI 点评。意向与评估状态全部由 naming-app 注入（单向数据流）。 */
export function Juan6Intent({
  chart,
  意向,
  评估: { 评估列表, 阶段, 错误, 重试 },
}: {
  chart: ChartResult;
  意向: 意向控制;
  评估: 评估状态;
}) {
  // 契合分降序（Array.sort 稳定→并列保添加序）；存储序=添加序不受影响
  const 有序评估 = useMemo(() => [...评估列表].sort((a, b) => b.契合.分 - a.契合.分), [评估列表]);
  return (
    <Juan
      id="juan6"
      卷="卷六"
      题="意向吉名"
      述="草案与点赞吉名尽汇于此：逐名评估八字契合，本机留存不上传，可随时移除。"
      尾注="意向吉名仅存于本机浏览器（localStorage），换设备/清缓存即失；评估与 AI 点评按需请求服务端，名单本身不上传。"
    >
      <ImportPanel 意向={意向} />
      {意向.条目.length === 0 ? (
        <p className="py-6 text-center text-sm leading-relaxed text-ink-soft">
          卷中尚无吉名。在上方表单填入名字草案再排盘、于卷七候选卡点「♡ 入卷六」，或用上方「批量导入」一次贴入多名，吉名即汇入此处逐名评估。
        </p>
      ) : (
        <>
          <p className="mb-3 text-xs text-ink-soft">
            共 {意向.条目.length} 名 · 按契合分高到低排列
            {阶段 === 'loading' ? ' · 评估中…' : ''}
          </p>
          {阶段 === 'error' ? (
            <div className="mb-3 border border-cinnabar/40 bg-cinnabar/5 px-3 py-2">
              <p className="text-sm font-medium text-cinnabar">意向评估失败：{错误}</p>
              <button
                type="button"
                onClick={重试}
                className="mt-2 border border-cinnabar px-3 py-1 text-xs font-bold text-cinnabar transition-colors hover:bg-cinnabar hover:text-paper"
              >
                重试
              </button>
            </div>
          ) : null}
          {阶段 !== 'error' || 评估列表.length > 0 ? (
            <ul className="space-y-3">
              {有序评估.map((e) => (
                <IntentCard
                  key={e.名}
                  评估={e}
                  来源={意向.条目.find((入) => 入.名 === e.名)?.来源 ?? '点赞'}
                  onRemove={意向.移除}
                />
              ))}
            </ul>
          ) : null}
          <AiIntentAnswer chart={chart} 评估={有序评估} />
        </>
      )}
    </Juan>
  );
}
