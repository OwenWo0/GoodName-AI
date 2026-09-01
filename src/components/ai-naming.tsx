'use client';

/**
 * AI 终选起名（匠心五荐）交互组件：
 * 统揽命盘八字喜忌、五格数理、声韵平仄、家长心仪意向与典故文献，
 * 请求 POST /api/ai-naming，流式输出 5 个最适合、最吉美的终选好名。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { MarkdownBodyAsync } from '@/components/markdown-body-async';
import type { ChartResultForUi } from '@/utils/mock-chart';
import type { EvaluatedName } from '@/lib/evaluate/types';
import { createSseParser, type SseEvent } from '@/utils/sse';

type Phase = 'idle' | 'streaming' | 'done' | 'error';

export interface AiNamingProps {
  readonly chart: ChartResultForUi;
  readonly 意向名单?: readonly string[];
  readonly 意向评估?: readonly EvaluatedName[];
  readonly onLike?: (名: string) => void;
  readonly 已在意向集合?: ReadonlySet<string>;
}

export function AiNaming({
  chart,
  意向名单,
  意向评估,
}: AiNamingProps) {
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
    } else if (ev.kind === 'done') {
      setPhase((p) => (p === 'error' ? p : 'done'));
    }
  }, []);

  const startNaming = useCallback(async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setPhase('streaming');
    setReasoning('');
    setContent('');
    setError(null);

    try {
      const res = await fetch('/api/ai-naming', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...chart,
          ...(意向名单 !== undefined && 意向名单.length > 0
            ? { 意向吉名: [...意向名单], 意向评估: [...(意向评估 ?? [])] }
            : {}),
        }),
        signal: ac.signal,
      });

      if (!res.ok) {
        let message = `AI 终选起名请求失败（HTTP ${res.status}）`;
        try {
          const body = (await res.json()) as { error?: unknown };
          if (typeof body.error === 'string') message = body.error;
        } catch {
          /* 忽略非 JSON 响应体 */
        }
        setError(message);
        setPhase('error');
        return;
      }

      if (!res.body) {
        setError('响应无数据流，无法呈现终选名字。');
        setPhase('error');
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const parser = createSseParser();

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const ev of parser.feed(decoder.decode(value, { stream: true }))) {
          applyEvent(ev);
        }
      }
      for (const ev of parser.flush()) {
        applyEvent(ev);
      }
      setPhase((p) => (p === 'streaming' ? 'done' : p));
    } catch (e) {
      if (ac.signal.aborted) return;
      setError(e instanceof Error ? e.message : '未知错误');
      setPhase('error');
    }
  }, [chart, 意向名单, 意向评估, applyEvent]);

  return (
    <div className="mt-6 border-2 border-cinnabar/40 bg-paper/80 p-5 shadow-sm">
      {/* 头部标题与导言 */}
      <div className="border-b border-cinnabar/20 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-cinnabar">✦ AI 终选起名 · 匠心五荐</span>
            <span className="rounded bg-cinnabar/10 px-2 py-0.5 text-xs font-medium text-cinnabar">
              终极定案
            </span>
          </div>
          {意向名单 && 意向名单.length > 0 ? (
            <span className="text-xs text-ink-soft">
              已结合家长心仪的 {意向名单.length} 个意向吉名
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-xs leading-relaxed text-ink-soft">
          融汇四柱喜忌、五格数理、平仄声韵、名库典故与家长心仪偏好，由 AI 宗师为您定制精选 5 个最契合宝宝的终选吉名。
        </p>
      </div>

      {/* 操作按钮区 */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={startNaming}
          disabled={phase === 'streaming'}
          className="border-2 border-cinnabar bg-cinnabar px-6 py-2 text-sm font-bold tracking-[0.2em] text-paper shadow-sm transition-all hover:bg-cinnabar/90 disabled:opacity-50"
        >
          {phase === 'streaming'
            ? '推演中…'
            : phase === 'idle'
              ? '✨ 生成 AI 终选五名'
              : '重新推演终选五名'}
        </button>
        {phase === 'streaming' && content === '' ? (
          <span className="text-sm text-ink-soft">
            <span className="animate-ink-pulse">☰ 正在深研八字喜忌与家长心意</span>
            <span className="animate-ink-pulse [animation-delay:0.2s]">☰</span>
            <span className="animate-ink-pulse [animation-delay:0.4s]">☰</span>
          </span>
        ) : null}
        {phase === 'done' ? (
          <span className="text-xs font-medium text-wuxing-mu">✓ 五名甄选推演完毕</span>
        ) : null}
      </div>

      {/* 推演过程折叠区 */}
      {reasoning ? (
        <details className="mt-4 border border-gold/30 bg-gold/5 p-3">
          <summary className="cursor-pointer text-xs font-bold text-gold">
            推演过程（AI 宗师选名考量）
          </summary>
          <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-ink-soft">
            {reasoning}
          </p>
        </details>
      ) : null}

      {/* 错误提示 */}
      {error ? (
        <p className="mt-4 border border-cinnabar/30 bg-cinnabar/5 p-3 text-sm font-medium text-cinnabar">
          起名推演遇到问题：{error}
        </p>
      ) : null}

      {/* Markdown 正文 */}
      {content ? (
        <article className="mt-4 rounded border border-ink/10 bg-paper p-4">
          <MarkdownBodyAsync text={content} streaming={phase === 'streaming'} />
        </article>
      ) : null}

      {phase !== 'idle' && !error && !content && phase !== 'streaming' ? (
        <p className="mt-4 text-xs text-ink-soft">模型未返回内容，请稍后重试。</p>
      ) : null}

      {/* 底部免责声明 */}
      <p className="mt-4 border-t border-dashed border-ink/20 pt-2 text-[11px] leading-relaxed text-ink-soft">
        AI 起名建议由大模型结合全盘命理算法综合生成；传统命理属民俗文化范畴，最终命名请结合家庭意愿、美好寓意自行裁量。
      </p>
    </div>
  );
}
