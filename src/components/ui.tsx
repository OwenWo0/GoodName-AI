/**
 * 展示原语：卷段卡片（标题+一句总述+明细+免责尾注，06 §2C #5 节奏）、
 * 朱印、黄批提示卡、色条、吉凶徽标。无状态、无副作用。
 */
import type { ReactNode } from 'react';
import type { GeItem } from '@/lib/types';

export const JUAN_NAMES = ['卷一', '卷二', '卷三', '卷四', '卷五', '卷六', '卷七'] as const;

/** 卷段外壳：朱印卷次竖排 + 题名 + 一句总述 + 明细 + 尾注。 */
export function Juan({
  卷,
  题,
  述,
  children,
  尾注,
  id,
}: {
  卷: (typeof JUAN_NAMES)[number];
  题: string;
  述: string;
  children: ReactNode;
  尾注?: string;
  id?: string;
}) {
  return (
    <section id={id} className="scroll-mt-6 border border-ink/25 bg-paper-deep/40 shadow-[2px_3px_0_rgb(43_43_43/0.06)]">
      <header className="flex items-stretch gap-3 border-b border-ink/20 px-4 py-3 sm:px-6">
        <span className="flex items-center justify-center bg-cinnabar px-1.5 py-2 text-sm font-bold tracking-[0.35em] text-paper [writing-mode:vertical-rl]">
          {卷}
        </span>
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-[0.2em]">{题}</h2>
          <p className="mt-1 text-sm text-ink-soft">{述}</p>
        </div>
      </header>
      <div className="px-4 py-4 sm:px-6">{children}</div>
      {尾注 ? (
        <p className="border-t border-dashed border-ink/20 px-4 py-2 text-xs leading-relaxed text-ink-soft sm:px-6">
          {尾注}
        </p>
      ) : null}
    </section>
  );
}

/** 朱印（印章风徽标）。 */
export function RedStamp({ text, className = '' }: { text: string; className?: string }) {
  return (
    <span
      className={`inline-block rounded-sm border-2 border-cinnabar px-1.5 py-0.5 text-xs font-bold tracking-widest text-cinnabar ${className}`}
    >
      {text}
    </span>
  );
}

/** 黄批提示卡（排盘根基/流派争议等，朱批黄底风）。 */
export function HintCard({ 题, children }: { 题: string; children: ReactNode }) {
  return (
    <div className="border-l-4 border-gold bg-gold/10 px-4 py-3">
      <p className="mb-1 text-sm font-bold text-ink">{题}</p>
      <div className="space-y-1 text-sm leading-relaxed text-ink-soft">{children}</div>
    </div>
  );
}

/** 横向色条（力量/爆款/强弱通用）。 */
export function Bar({
  percent,
  barClass = 'bg-dai',
  trackClass = 'bg-ink/10',
  markerPercent,
  叠加段,
}: {
  percent: number;
  barClass?: string;
  trackClass?: string;
  /** 参考线位置（如强弱 50 中和线）。 */
  markerPercent?: number;
  /**
   * 名字加成独立色段（卷二）：自基准段末端（left=percent%）起画，不改动基准
   * 得分本身；动画键变化即重挂载重播伸缩动画（换名重播、同名不动不重播）。
   */
  叠加段?: { 宽度百分比: number; 类名: string; 动画键?: string | null };
}) {
  const clamped = Math.min(100, Math.max(0, percent));
  const 段宽 = 叠加段 ? Math.min(Math.max(叠加段.宽度百分比, 0), 100 - clamped) : 0;
  return (
    <div className="relative h-2.5 w-full overflow-hidden rounded-sm border border-ink/15 " data-track>
      <div className={`absolute inset-0 ${trackClass}`} />
      <div className={`absolute inset-y-0 left-0 ${barClass}`} style={{ width: `${clamped}%` }} />
      {叠加段 && 段宽 > 0 ? (
        <div
          key={叠加段.动画键 ?? undefined}
          className={`animate-bonus-grow absolute inset-y-0 ${叠加段.类名}`}
          style={{ left: `${clamped}%`, width: `${段宽}%` }}
          aria-hidden
        />
      ) : null}
      {markerPercent !== undefined ? (
        <div
          className="absolute inset-y-0 w-px border-l border-dashed border-ink/60"
          style={{ left: `${markerPercent}%` }}
          aria-hidden
        />
      ) : null}
    </div>
  );
}

const LUCK_CLASS: Readonly<Record<GeItem['吉凶'], string>> = {
  大吉: 'border-wuxing-mu text-wuxing-mu',
  吉: 'border-wuxing-mu text-wuxing-mu',
  半吉: 'border-gold text-gold',
  凶: 'border-cinnabar text-cinnabar',
  末定: 'border-ink/40 text-ink-soft',
};

/** 吉凶徽标。 */
export function LuckBadge({ 吉凶 }: { 吉凶: GeItem['吉凶'] | string }) {
  const cls = 吉凶 in LUCK_CLASS ? LUCK_CLASS[吉凶 as GeItem['吉凶']] : 'border-ink/40 text-ink-soft';
  return (
    <span className={`inline-block rounded-sm border px-1 text-xs font-bold ${cls}`}>{吉凶}</span>
  );
}

/** 灰字尾注行。 */
export function GrayNote({ children }: { children: ReactNode }) {
  return <p className="text-xs leading-relaxed text-ink-soft">{children}</p>;
}

/** 五行小圆牌。 */
export function WuxingChip({ 五行, textClass }: { 五行: string; textClass: string }) {
  return (
    <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full border border-current text-xs font-bold ${textClass}`}>
      {五行}
    </span>
  );
}
