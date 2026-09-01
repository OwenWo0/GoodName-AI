'use client';

/**
 * 意向吉名批量评估状态机（自 juan6-intent 上提，naming-app 持有后下发卷二/卷六）。
 *
 * 名单或盘变化即批量 POST /api/evaluate-names（服务端单请求上限 EVALUATE_NAMES_MAX=100
 * ≥ 存储上限 60 → 现恒一程；仍保留切片串行合流防上限再调低，按条目序输出）；
 * 卸载/名单变 abort 在途且静默作废。
 * 语义保真点（与卷六原行为一致）：
 *   · error 不清评估列表——「评估失败但旧列表仍渲染」；
 *   · chart===null（非结果态）清态回 idle——防重排盘后首帧闪旧盘的评估。
 */
import { useCallback, useEffect, useState } from 'react';
import { EVALUATE_NAMES_MAX, type EvaluatedName } from '@/lib/evaluate/types';
import type { ChartResult } from '@/lib/types';
import { requestEvaluateNames } from '@/utils/name-eval';

export type 评估阶段 = 'idle' | 'loading' | 'ready' | 'error';

export interface 评估状态 {
  评估列表: EvaluatedName[];
  阶段: 评估阶段;
  错误: string | null;
  重试: () => void;
}

/** 名单键：名拼接串——effect 只认串不认数组引用，父级重渲染不触发重取。 */
export function 名单键of(条目: readonly { 名: string }[]): string {
  return 条目.map((e) => e.名).join('\n');
}

/** chart 传 null 表示非结果态（表单/排盘中/排盘失败）：清态回 idle，不发请求。 */
export function useNameEvaluations(
  chart: ChartResult | null,
  条目: readonly { 名: string }[],
): 评估状态 {
  const [评估列表, set评估列表] = useState<EvaluatedName[]>([]);
  const [阶段, set阶段] = useState<评估阶段>('idle');
  const [错误, set错误] = useState<string | null>(null);
  const [重试计数, set重试计数] = useState(0);

  // 名单键为串（引用无关）；chart 引用在 naming-app 状态里稳定——两依赖皆防无限重取。
  const 名单键 = 名单键of(条目);

  useEffect(() => {
    const 名列表 = 名单键 === '' ? [] : 名单键.split('\n');
    if (chart === null || 名列表.length === 0) {
      set评估列表([]);
      set阶段('idle');
      set错误(null);
      return;
    }
    const ac = new AbortController();
    set阶段('loading');
    set错误(null);
    void (async () => {
      try {
        // 切片串行（步长=EVALUATE_NAMES_MAX；100≥60 现恒单程），按条目序合流
        const 按名 = new Map<string, EvaluatedName>();
        for (let i = 0; i < 名列表.length; i += EVALUATE_NAMES_MAX) {
          const 批 = await requestEvaluateNames(
            {
              姓氏: chart.输入.姓氏,
              名字列表: 名列表.slice(i, i + EVALUATE_NAMES_MAX),
              喜用神: chart.xiyongshen.喜用神,
              忌神: chart.xiyongshen.忌神,
              喜用神明细: chart.xiyongshen.喜用神明细,
              避讳字: chart.输入.避讳字,
            },
            ac.signal,
          );
          for (const e of 批) 按名.set(e.名, e);
        }
        const 合流 = 名列表.map((名) => 按名.get(名)).filter((e): e is EvaluatedName => e !== undefined);
        set评估列表(合流);
        set阶段('ready');
      } catch (e) {
        if (ac.signal.aborted) return; // 名单/盘已变或卸载：旧结果作废即可
        set错误(e instanceof Error ? e.message : '未知错误');
        set阶段('error'); // 不清评估列表：旧列表仍渲染（卷六语义）
      }
    })();
    return () => ac.abort();
  }, [名单键, chart, 重试计数]);

  const 重试 = useCallback(() => set重试计数((n) => n + 1), []);
  return { 评估列表, 阶段, 错误, 重试 };
}
