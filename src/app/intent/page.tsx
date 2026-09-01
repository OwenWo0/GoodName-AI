'use client';

/**
 * /intent · 意向吉名独立页（赛道拆分 C7；原手卷卷六独立成页）。
 *
 * 本机意向清单（localStorage，loadIntentEntries）+ 姓氏输入 + 五行来源二途：
 *   · 自动带盘——取 loadLastChart()（排盘成功时由 naming-app 写入 sessionStorage）；
 *   · 手动勾选——无盘亦可评（XiYongSourcePanel，C2）。
 * 姓氏经 zod 前置校验（1-2 汉字）：未填/非法 → 来源置 null（评估静默 idle）、
 * 「批量导入」钮灰置不点亮（导入即评估，缺姓氏无从谈起契合）。
 * 清单按契合分降序、移除即写回存储（组件见 intent-panel.tsx）。
 * AI 点评仅在有盘时渲染（四柱为服务端硬要求），无盘显示一行灰字说明。
 * 本机记忆全部挂载后经 useEffect 读取——SSR 渲染与首帧一致，无 hydration 错。
 * 空态文案指向两赛道来源（排盘 ♡ 入意向 / 抽卡与旧藏走批量导入）。
 */
import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { AiIntentAnswer, ImportPanel, IntentNameList } from '@/components/intent-panel';
import {
  XiYongSourcePanel,
  默认来源选择,
  解析五行来源,
  type 来源选择,
} from '@/components/xiyong-source';
import {
  useNameEvaluationsFromSource,
  type 评估来源,
} from '@/components/use-name-evaluations';
import type { ChartResult } from '@/lib/types';
import { loadLastChart, loadLastInput } from '@/utils/draft-memory';
import {
  addIntentEntries,
  addIntentEntry,
  loadIntentEntries,
  removeIntentEntry,
  type Intent来源,
  type IntentEntry,
} from '@/utils/intent-names-storage';

/** 姓氏前置校验（口径对齐 chart schema：1-2 个汉字）；非法即断源，不发无谓请求。 */
const 姓氏schema = z.string().trim().regex(/^[一-鿿]{1,2}$/, '姓氏须为 1-2 个汉字');

export default function IntentPage() {
  const [姓氏文本, set姓氏文本] = useState('');
  const [盘, set盘] = useState<ChartResult | null>(null);
  const [选择, set选择] = useState<来源选择>(() => 默认来源选择(false));
  const [意向条目, set意向条目] = useState<IntentEntry[]>([]);

  // 本机记忆挂载后统一读取（sessionStorage/localStorage SSR 不可得 → 静默降级）
  useEffect(() => {
    set意向条目(loadIntentEntries());
    set姓氏文本(loadLastInput()?.姓氏 ?? '');
    const 带盘 = loadLastChart();
    set盘(带盘);
    set选择(默认来源选择(带盘 !== null));
  }, []);

  const 姓氏校验 = 姓氏schema.safeParse(姓氏文本);
  const 姓氏就绪 = 姓氏校验.success;

  const 盘摘要 = useMemo(
    () =>
      盘 === null
        ? null
        : { 喜用神: 盘.xiyongshen.喜用神, 忌神: 盘.xiyongshen.忌神, 明细: 盘.xiyongshen.喜用神明细 },
    [盘],
  );

  // 来源 = 姓氏 + 五行来源（自动带盘/手动勾选两途，C2 解析器统一裁决；无盘自动模式回退手动值）
  const 来源: 评估来源 | null = useMemo(() => {
    const r = 姓氏schema.safeParse(姓氏文本);
    if (!r.success) return null;
    const 五行 = 解析五行来源(盘摘要, 选择);
    return {
      姓氏: r.data,
      喜用神: 五行.喜用神,
      忌神: 五行.忌神,
      喜用神明细: 五行.明细,
    };
  }, [姓氏文本, 盘摘要, 选择]);

  const 评估 = useNameEvaluationsFromSource(来源, 意向条目);

  // 意向控制（与 naming-app 同款内存镜像范式：写经存储 util，不可变返回新数组）
  const 意向 = useMemo(
    () => ({
      条目: 意向条目,
      集合: new Set(意向条目.map((e) => e.名)),
      加入: (名: string, 来源: Intent来源) => set意向条目(addIntentEntry(名, 来源).条目),
      批量加入: (名列表: readonly string[], 来源: Intent来源) => {
        const 结果 = addIntentEntries(名列表, 来源);
        set意向条目(结果.条目);
        return 结果;
      },
      移除: (名: string) => set意向条目(removeIntentEntry(名)),
    }),
    [意向条目],
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-6 text-center">
        <p className="text-xs tracking-[0.4em] text-ink-soft">问 名 手 卷</p>
        <h1 className="mt-2 text-3xl font-bold tracking-[0.3em]">意向吉名</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          汇集心仪吉名逐名评估契合：姓氏与五行来源在此定夺，名单本机留存不上传，可随时移除。
        </p>
      </header>

      <section className="border border-ink/25 bg-paper-deep/40 shadow-[2px_3px_0_rgb(43_43_43/0.06)]">
        <div className="px-4 py-4 sm:px-6">
          {/* 姓氏输入：评估与导入共用的第一道闸 */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <label htmlFor="intent-surname" className="text-sm font-bold tracking-widest">
              姓氏
            </label>
            <input
              id="intent-surname"
              value={姓氏文本}
              onChange={(ev) => set姓氏文本(ev.target.value)}
              maxLength={2}
              placeholder="1-2 个汉字"
              aria-invalid={!姓氏就绪 && 姓氏文本.trim() !== ''}
              className="w-32 border border-ink/30 bg-paper/60 px-2 py-1 text-lg tracking-widest"
            />
            {!姓氏就绪 ? (
              <span className={姓氏文本.trim() === '' ? 'text-xs text-ink-soft' : 'text-xs text-cinnabar'}>
                {姓氏文本.trim() === '' ? '请先填写姓氏（1-2 个汉字）——五格契合依姓氏而断。' : '姓氏须为 1-2 个汉字。'}
              </span>
            ) : null}
          </div>

          {/* 五行来源：自动带盘（有盘才可选）/ 手动勾选（与喜用神互斥） */}
          <XiYongSourcePanel 盘就绪={盘 !== null} value={选择} onChange={set选择} />

          <div className="mt-5">
            <ImportPanel 意向={意向} 解禁={姓氏就绪} />
          </div>

          {意向条目.length === 0 ? (
            <p className="py-6 text-center text-sm leading-relaxed text-ink-soft">
              此处尚无吉名。去「传统排盘」排一次盘，在卷七候选卡点「♡ 入意向」；抽卡灵感（/draw）或他处旧藏之名，
              也可用上方「批量导入」一次贴入，吉名即汇入此处逐名评估。
            </p>
          ) : (
            <>
              {!姓氏就绪 ? (
                <p className="mb-3 border border-ink/25 bg-paper/50 px-3 py-2 text-sm text-ink-soft">
                  姓氏未填或非法，评估暂缓——上方填入姓氏后自动续评。
                </p>
              ) : null}
              <IntentNameList 意向={意向} 评估={评估} />
            </>
          )}

          {盘 !== null ? (
            <AiIntentAnswer chart={盘} 评估={评估.评估列表} />
          ) : (
            <p className="mt-4 text-xs leading-relaxed text-ink-soft">
              AI 点评需命盘四柱为据——请先至「传统排盘」排一次盘再回此页；手动勾选之五行仅用于本机契合评估。
            </p>
          )}
        </div>
        <p className="border-t border-dashed border-ink/20 px-4 py-2 text-xs leading-relaxed text-ink-soft sm:px-6">
          意向吉名仅存于本机浏览器（localStorage），换设备/清缓存即失；评估与 AI 点评按需请求服务端，名单本身不上传。
        </p>
      </section>

      <footer className="mt-10 border-t border-ink/20 pt-4 text-center text-xs leading-relaxed text-ink-soft">
        <p>
          本站所呈现之八字、五格、喜用神、平仄诸说，皆为传统民俗文化之参考，非科学结论，
          不构成婚配、取名、医疗或其他任何决策依据。名字之美，终在人心所寄。
        </p>
      </footer>
    </div>
  );
}
