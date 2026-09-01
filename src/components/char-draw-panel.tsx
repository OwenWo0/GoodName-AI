'use client';

/**
 * 单字抽卡面板（契约 v3 §3.2）：展开式就地面板——「没灵感？抽一个」钮展开，
 * 出 字（大字）+ 五行 Chip + 意向标签 + 寓意，「再抽」「用它」两钮，
 * 用它 = onPick(字) 并收起。随机只在 UI 层（lib 禁 Math.random 纪律不破）：
 * rng 适配 crypto.getRandomValues/2**32。挂载接线归 lead（§3.3）。
 * 组件名 ASCII——react-hooks 插件不认 CJK 组件名（先例 ImportPanel/RadarSvg）。
 */
import { useCallback, useState } from 'react';
import 库Json from '@/data/good-intent-chars.json';
import { WUXING_TEXT_CLASS } from '@/utils/wuxing';
import { 抽卡, type 五行筛选, type 好意向字 } from '@/utils/char-draw';
import { WuxingChip } from './ui';

/** 五行筛选钮顺序（契约 C6：随机/金/木/水/火/土，default 随机）。 */
const 筛选钮: readonly 五行筛选[] = ['随机', '金', '木', '水', '火', '土'];

/**
 * 编译期 json 导入 → 运行时形状防线：char-data 产出的库若非数组（或空文件），
 * 按空库处理——面板退化为「无字可抽」提示，不得崩。
 */
const 库: readonly 好意向字[] = Array.isArray(库Json) ? (库Json as readonly 好意向字[]) : [];

/** UI 层随机源：Uint32 均匀映射到 [0,1)（2**32 个等概率格）。 */
function 随机小数(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
}

/**
 * 空态文案：抽卡→null 有三成因（空库／排除字滤空／五行硬滤滤空，char-draw.ts），
 * 按当前筛选如实归因——硬滤不回退语义不动，只是文案不指错方向。
 */
function 空态文案(库空: boolean, 五行: 五行筛选): string {
  if (库空) return '字库暂未就绪，稍后再试。';
  if (五行 === '随机') return '无字可抽（诸字皆在排除之列）。';
  return `无字可抽（「${五行}」属之字俱已排除，或字库本无此属）。`;
}

export interface CharDrawPanelProps {
  /** 空数组=无偏好全库等概率（结果态时传 chart.xiyongshen.喜用神，否则 []）。 */
  喜用神: readonly string[];
  /** 当前表单：姓氏用字+避讳字（抽卡硬剔，喜用回退也不放宽）。 */
  排除字?: readonly string[];
  /** 「用它」回填。 */
  onPick: (字: string) => void;
}

/** 抽卡结果展示 + 五行筛选 + 再抽/用它；null=未抽或空态。 */
export function CharDrawPanel({ 喜用神, 排除字, onPick }: CharDrawPanelProps) {
  const [展开, set展开] = useState(false);
  const [当前, set当前] = useState<好意向字 | null>(null);
  const [五行, set五行] = useState<五行筛选>('随机');

  // 显式传 五行（切换钮时新值即抽，不等 state 落地——闭包读旧值会差一拍）。
  const 抽给定 = useCallback(
    (筛选: 五行筛选) => {
      set当前(抽卡(库, { 五行: 筛选, 喜用神, 排除字, rng: 随机小数 }));
    },
    [喜用神, 排除字],
  );

  const 抽一次 = useCallback(() => 抽给定(五行), [抽给定, 五行]);

  const 换筛选 = (筛选: 五行筛选) => {
    set五行(筛选);
    抽给定(筛选); // 契约 C6：切换即自动抽一次
  };

  const 收起 = () => {
    set展开(false);
    set当前(null);
  };

  const 用它 = () => {
    if (当前 === null) return;
    onPick(当前.字);
    收起();
  };

  return (
    <span className="inline-flex flex-wrap items-center gap-2 align-middle">
      <button
        type="button"
        aria-expanded={展开}
        onClick={() => {
          if (展开) 收起();
          else {
            set展开(true);
            抽一次();
          }
        }}
        className="border border-ink/40 px-2 py-0.5 text-xs font-bold text-ink-soft transition-colors hover:border-cinnabar hover:text-cinnabar"
      >
        {展开 ? '收起抽卡' : '没灵感？抽一个'}
      </button>
      {展开 ? (
        <span className="flex w-full flex-wrap items-center gap-x-3 gap-y-2 border border-ink/25 bg-paper/50 px-3 py-2">
          <span role="group" aria-label="五行筛选" className="flex gap-1">
            {筛选钮.map((选项) => (
              <button
                key={选项}
                type="button"
                aria-pressed={五行 === 选项}
                onClick={() => 换筛选(选项)}
                className={
                  五行 === 选项
                    ? 'border border-cinnabar bg-cinnabar/10 px-1.5 py-0.5 text-xs font-bold text-cinnabar'
                    : 'border border-ink/30 px-1.5 py-0.5 text-xs text-ink-soft transition-colors hover:border-cinnabar hover:text-cinnabar'
                }
              >
                {选项}
              </button>
            ))}
          </span>
          {当前 !== null ? (
            <>
              <span key={当前.字} className="animate-ink-pulse text-3xl font-bold text-ink">
                {当前.字}
              </span>
              <WuxingChip 五行={当前.五行} textClass={WUXING_TEXT_CLASS[当前.五行]} />
              <span className="flex gap-1">
                {当前.意向标签.map((标签) => (
                  <span key={标签} className="rounded-sm border border-gold px-1 text-xs text-gold">
                    {标签}
                  </span>
                ))}
              </span>
              <span className="text-sm text-ink-soft">{当前.寓意}</span>
            </>
          ) : (
            <span className="text-sm text-ink-soft">{空态文案(库.length === 0, 五行)}</span>
          )}
          <span className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={抽一次}
              className="border border-ink/40 px-3 py-0.5 text-sm text-ink transition-colors hover:border-cinnabar hover:text-cinnabar"
            >
              再抽
            </button>
            <button
              type="button"
              onClick={用它}
              disabled={当前 === null}
              className="border border-cinnabar px-3 py-0.5 text-sm font-bold text-cinnabar transition-colors hover:bg-cinnabar hover:text-paper disabled:cursor-not-allowed disabled:opacity-40"
            >
              用它
            </button>
          </span>
        </span>
      ) : null}
    </span>
  );
}
