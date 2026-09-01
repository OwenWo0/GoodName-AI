'use client';

/**
 * MarkdownBody 的异步装载层（体积门禁产物）：
 * streamdown 全量静态引入使 / 路由 First Load JS 由 221 kB 涨至 367 kB（+146 kB
 * 远超 40 kB 门禁），故用 next/dynamic({ssr:false}) 拆为按需异步 chunk——
 * 仅当用户点「问 AI 综解」且首段 content 到达时才拉取渲染器。
 * chunk 在途期间以「展卷中…」占位（首帧后本地毫秒级即到）。
 */
import dynamic from 'next/dynamic';

const MarkdownBodyImpl = dynamic(() => import('@/components/markdown-body'), {
  ssr: false,
  loading: () => (
    <p className="text-sm leading-relaxed text-ink-soft">
      <span className="animate-ink-pulse">☰ 展卷中…</span>
    </p>
  ),
});

export function MarkdownBodyAsync({
  text,
  streaming,
}: {
  text: string;
  streaming: boolean;
}) {
  return <MarkdownBodyImpl text={text} streaming={streaming} />;
}
