'use client';

/**
 * AI 综解流式消费：POST /api/analyze（体=ChartResult），SSE 帧经 createSseParser：
 * reasoning 帧 → 「推演中…」脉冲 + 可折叠推演原文（保持 pre-wrap 纯文本，
 * 防模型思路被 Markdown 变形）；content 帧 → 流式增量交 MarkdownBodyAsync
 * （streamdown 异步 chunk，见 markdown-body-async 体积门禁注记）实时渲染；
 * error 帧 → 红字；[DONE] → 收尾。卸载/重问时 AbortController 取消在途请求。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { MarkdownBodyAsync } from '@/components/markdown-body-async';
import type { ChartResultForUi } from '@/utils/mock-chart';
import type { EvaluatedName } from '@/lib/evaluate/types';
import { createSseParser, type SseEvent } from '@/utils/sse';

type Phase = 'idle' | 'streaming' | 'done' | 'error';

export function AiAnswer({
  chart,
  意向名单,
  意向评估,
}: {
  chart: ChartResultForUi;
  意向名单?: readonly string[];
  意向评估?: readonly EvaluatedName[];
}) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [reasoning, setReasoning] = useState('');
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const applyEvent = useCallback((ev: SseEvent) => {
    if (ev.kind === 'content') setContent((prev) => prev + ev.text);
    else if (ev.kind === 'reasoning') setReasoning((prev) => prev + ev.text);
    else if (ev.kind === 'error') {
      setError(ev.text);
      setPhase('error');
    } else if (ev.kind === 'done') setPhase((p) => (p === 'error' ? p : 'done')); // [DONE] 帧不覆盖错误态（cr-m5 L1）
  }, []);

  const ask = useCallback(async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setPhase('streaming');
    setReasoning('');
    setContent('');
    setError(null);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // 契约 v4 §1.4：名单非空才追加意向两键；空/缺省 → 体与现状逐字节等
        body: JSON.stringify({
          ...chart,
          ...(意向名单 !== undefined && 意向名单.length > 0
            ? { 意向吉名: [...意向名单], 意向评估: [...(意向评估 ?? [])] }
            : {}),
        }),
        signal: ac.signal,
      });
      if (!res.ok) {
        let message = `分析请求失败（HTTP ${res.status}）`;
        try {
          const body = (await res.json()) as { error?: unknown };
          if (typeof body.error === 'string') message = body.error;
        } catch {
          /* 错误体非 JSON：保留状态码文案 */
        }
        setError(message);
        setPhase('error');
        return;
      }
      if (!res.body) {
        setError('响应无数据流，无法呈现分析。');
        setPhase('error');
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
      setPhase((p) => (p === 'streaming' ? 'done' : p));
    } catch (e) {
      if (ac.signal.aborted) return;
      setError(e instanceof Error ? e.message : '未知错误');
      setPhase('error');
    }
  }, [chart, 意向名单, 意向评估, applyEvent]);

  return (
    <div className="mt-4 border border-ink/25 bg-paper/60 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={ask}
          disabled={phase === 'streaming'}
          className="border border-cinnabar px-5 py-1.5 text-sm font-bold tracking-[0.25em] text-cinnabar transition-colors hover:bg-cinnabar hover:text-paper disabled:opacity-50"
        >
          {phase === 'streaming' ? '推演中…' : phase === 'idle' ? '问 AI 综解' : '再问一次'}
        </button>
        {phase === 'streaming' && content === '' ? (
          <span className="text-sm text-ink-soft">
            <span className="animate-ink-pulse">☰ 推演中</span>
            <span className="animate-ink-pulse [animation-delay:0.2s]">☰</span>
            <span className="animate-ink-pulse [animation-delay:0.4s]">☰</span>
          </span>
        ) : null}
        {phase === 'done' ? <span className="text-xs text-ink-soft">—— 推演毕。</span> : null}
      </div>

      {reasoning ? (
        <details className="mt-3">
          <summary className="text-xs text-gold">推演过程（模型思路，非命书原文）</summary>
          <p className="mt-1 whitespace-pre-wrap border-l-2 border-gold/40 pl-3 text-xs leading-relaxed text-ink-soft">
            {reasoning}
          </p>
        </details>
      ) : null}

      {error ? <p className="mt-3 text-sm font-medium text-cinnabar">AI 分析出错：{error}</p> : null}

      {content ? (
        <article className="mt-3">
          <MarkdownBodyAsync text={content} streaming={phase === 'streaming'} />
        </article>
      ) : null}

      {phase !== 'idle' && !error && !content && phase !== 'streaming' ? (
        <p className="mt-3 text-xs text-ink-soft">模型未返回正文。</p>
      ) : null}

      <p className="mt-3 border-t border-dashed border-ink/20 pt-2 text-[11px] leading-relaxed text-ink-soft">
        AI 解读由大模型基于左侧固定算法结果生成，可能出错；命理措辞属民俗文化表述，不构成任何科学或决策依据。
      </p>
    </div>
  );
}
