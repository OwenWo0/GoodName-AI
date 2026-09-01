/**
 * 展示层文案格式化 —— 纯函数（对齐 06 §2C：校正三行拆解、起运精确措辞、藏干权重内联）。
 */
import type { BaziResult } from '@/lib/types';

export interface SolarLine {
  label: string;
  value: string;
  note?: string;
}

/**
 * 真太阳时三行拆解：输入时间 / 标准经线对照 / 修正量→校正后。
 * 时辰未知（输入为 null）时给降级说明行。
 */
export function trueSolarLines(t: BaziResult['真太阳时']): SolarLine[] {
  const sign = t.校正分钟 >= 0 ? '+' : '-';
  const correction = `${sign}${Math.abs(t.校正分钟).toFixed(2)} 分钟`;
  return [
    {
      label: '输入时间（东八区）',
      value: t.输入北京时间 ?? '时辰未知（按当日正午近似推盘）',
    },
    {
      label: '标准经线 / 出生地经度',
      value: `东经 120° ↔ 东经 ${t.地点经度.toFixed(2)}°`,
    },
    {
      label: '真太阳时修正',
      value: `${correction} → 校正后 ${t.校正后本地时间 ?? '—'}`,
      note: t.正午近似 ? '时辰未知：校正量按正午近似（误差 <±2 分钟），仅可能影响时辰界表述。' : undefined,
    },
  ];
}

export interface QiYunDisplay {
  /** 如「出生3年2个月3天12小时后，于 2029-06-01 交运」。 */
  text: string;
  /** true = 时辰未知近似，精度降级。 */
  approx: boolean;
}

/** 起运精确措辞（06 §2C #1：比裸「起于周岁」直观）。 */
export function qiYunText(q: NonNullable<BaziResult['起运精准']>): QiYunDisplay {
  return {
    text: `出生${q.出生后时长}，于 ${q.交运公历} 交运`,
    approx: q.时辰未知近似 === true,
  };
}

/**
 * 藏干权重内联标注（06 §2C #4）：藏干数组按 本气→中气→余气 排列。
 * 返回如「本气 100%」；单藏干视为本气。
 */
export function cangGanWeightLabel(index: number, total: number): string {
  if (total <= 1 || index === 0) return '本气 100%';
  if (index === total - 1) return '余气 50%';
  return '中气 70%';
}

/** 晚子时流派标注 → 展示文案。 */
export function lateZiShiNote(sect: BaziResult['晚子时流派']): string | null {
  if (sect === '不涉及') return null;
  return sect === 'sect2_日不换'
    ? '晚子时（23-24 点）出生：本盘取「sect=2 日柱不换日」口径；若按 sect=1 换日口径，日柱及十神将整体不同。'
    : '晚子时（23-24 点）出生：本盘取「sect=1 日柱换日」口径；若按 sect=2 不换日口径，日柱及十神将整体不同。';
}

/** 爆款度 0-1 → 展示文案与提醒标记。 */
export function buzzLabel(score: number): { percent: string; warn: boolean } {
  const clamped = Math.min(1, Math.max(0, score));
  return { percent: `${Math.round(clamped * 100)}%`, warn: clamped >= 0.6 };
}
