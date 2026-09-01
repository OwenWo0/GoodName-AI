'use client';

/**
 * 手卷结果页：卷首题签（命主概要）+ 七卷正文。数据=ChartResult（+UI 扩展字段）。
 * 卷序（契约 v2）：卷六=意向吉名（本机清单评估），卷七=吉名呈览（原卷六顺延）。
 * 卷四五联动（契约 v4 §2.2）：卷四/卷五共享的意向名选择态持于本层（纯函数见 utils/roll45-name-select）；
 * 选项 <2（显示下拉=false）时不传 选择 → 卷四五逐字节现状。
 */
import { useState } from 'react';
import type { ChartResultForUi } from '@/utils/mock-chart';
import { 计算卷四五选择 } from '@/utils/roll45-name-select';
import { Juan1Paipan } from './juan1-paipan';
import { Juan2Wuxing } from './juan2-wuxing';
import { Juan3Xiyongshen } from './juan3-xiyongshen';
import { Juan4Wuge } from './juan4-wuge';
import { Juan5Pingze } from './juan5-pingze';
import { Juan6Intent } from './juan6-intent';
import type { 批次控制, 意向控制 } from './juan7-jiming';
import { Juan7Jiming } from './juan7-jiming';
import type { 评估状态 } from './use-name-evaluations';
import { RedStamp } from './ui';

const NAV: Array<{ href: string; 题: string }> = [
  { href: '#juan1', 题: '排盘' },
  { href: '#juan2', 题: '五行' },
  { href: '#juan3', 题: '喜用神' },
  { href: '#juan4', 题: '五格' },
  { href: '#juan5', 题: '平仄' },
  { href: '#juan6', 题: '意向' },
  { href: '#juan7', 题: '吉名' },
];

/** 批次/意向/评估控制透传（任务 #28/#35/评估上提）：状态机在 naming-app，此处仅单向下发，本层零状态。 */
export function ResultScroll({
  chart,
  批次控制,
  意向,
  评估,
}: {
  chart: ChartResultForUi;
  批次控制?: 批次控制;
  意向: 意向控制;
  评估: 评估状态;
}) {
  const { 输入 } = chart;
  const birth = 输入.北京时间 ?? `${输入.出生日期 ?? '日期未载'}（时辰未知）`;
  const 草案名 = 输入.名字草案 ?? null;
  // 卷四五联动（契约 v4 §2.2）：两卷共享一个受控选择；null=沿旧口径（chart 盘面）。
  // 显示下拉=false（意向 ≤1）时整条 选择 不下发——卷四五渲染路径与现状逐字节同。
  const [当前选择, set当前选择] = useState<string | null>(null);
  const 卷四五 = 计算卷四五选择(意向.条目.map((e) => e.名), 输入.名字草案, 当前选择);
  const 选择 = 卷四五.显示下拉
    ? { 选项: 卷四五.选项, 选中: 卷四五.选中, onChange: set当前选择 }
    : undefined;
  return (
    <div className="space-y-6">
      <header className="border border-ink/25 bg-paper-deep/50 px-5 py-5 text-center">
        <p className="text-xs tracking-[0.4em] text-ink-soft">问 名 手 卷</p>
        <h2 className="mt-2 text-3xl font-bold tracking-[0.3em]">
          {输入.姓氏}氏{输入.性别}命 · 排盘手卷
        </h2>
        <p className="mt-2 text-sm text-ink-soft">
          公历 {birth} · 出生地东经 {输入.出生地经度.toFixed(2)}°
          {草案名 ? ` · 草案「${草案名}」` : ''}
          {输入.指定字 ? ` · 指定字 ${输入.指定字.字}` : ''}
          {输入.避讳字.length > 0 ? ` · 避讳 ${输入.避讳字.join('、')}` : ''}
        </p>
        <div className="mt-3 flex justify-center">
          <RedStamp text="固定算法排盘" />
        </div>
      </header>

      <nav aria-label="卷次导航" className="sticky top-0 z-10 -mx-1 border-y border-ink/20 bg-paper/95 px-1 py-2 backdrop-blur-sm">
        <ul className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-sm">
          {NAV.map((n) => (
            <li key={n.href}>
              <a href={n.href} className="tracking-widest text-ink-soft underline-offset-4 hover:text-cinnabar hover:underline">
                {n.题}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <Juan1Paipan bazi={chart.bazi} />
      <Juan2Wuxing bazi={chart.bazi} 评估={评估} />
      <Juan3Xiyongshen x={chart.xiyongshen} />
      <Juan4Wuge wuge={chart.wuge} 草案名={草案名} 选择={选择} 评估列表={评估.评估列表} />
      <Juan5Pingze pingze={chart.名字草案平仄} 草案名={草案名} 选择={选择} 评估列表={评估.评估列表} />
      <Juan6Intent chart={chart} 意向={意向} 评估={评估} />
      <Juan7Jiming chart={chart} 批次={批次控制} 意向={意向} 评估列表={评估.评估列表} />
    </div>
  );
}
