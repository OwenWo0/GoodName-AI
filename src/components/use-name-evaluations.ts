'use client';

/**
 * 意向吉名批量评估状态机（自卷六上提；卷六独立成 /intent 页后再泛化）。
 *
 * 名单或来源变化即批量 POST /api/evaluate-names（服务端单请求上限 EVALUATE_NAMES_MAX=100
 * ≥ 存储上限 60 → 现恒一程；仍保留切片串行合流防上限再调低，按条目序输出）；
 * 卸载/名单变 abort 在途且静默作废。
 * 语义保真点（与卷六原行为一致）：
 *   · error 不清评估列表——「评估失败但旧列表仍渲染」；
 *   · 来源 null（非结果态/姓氏未填）清态回 idle——防重排盘后首帧闪旧盘的评估。
 * 两种来源（/intent 无盘手动模式的诉求）：
 *   · useNameEvaluations(chart|null, 条目)——旧签名保留兼容，盘字段派生来源（自动带盘）；
 *   · useNameEvaluationsFromSource(评估来源|null, 条目)——显式来源覆写（姓氏 + 手动勾选五行 + 明细）。
 * 来源以内容指纹入依赖：调用方每渲染新建对象不触发重取；五行数组排序去序
 * （键只防抖不改变语义，payload 恒用最新来源原值经 ref 读取）。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { EVALUATE_NAMES_MAX, type EvaluatedName } from '@/lib/evaluate/types';
import type { ChartResult, WuXing, XiyongMingXiItem } from '@/lib/types';
import { requestEvaluateNames } from '@/utils/name-eval';

export type 评估阶段 = 'idle' | 'loading' | 'ready' | 'error';

export interface 评估状态 {
  评估列表: EvaluatedName[];
  阶段: 评估阶段;
  错误: string | null;
  重试: () => void;
}

/** 评估输入来源：POST /api/evaluate-names 所需最小字段集——盘派生或 UI 覆写两途同归此形状。 */
export interface 评估来源 {
  姓氏: string;
  喜用神: WuXing[];
  忌神: WuXing[];
  喜用神明细?: XiyongMingXiItem[];
  避讳字?: string[];
}

/** 盘 → 来源（自动带盘口径；纯函数，调用方可 useMemo 稳引用）。 */
export function 来源自盘(chart: ChartResult): 评估来源 {
  return {
    姓氏: chart.输入.姓氏,
    喜用神: chart.xiyongshen.喜用神,
    忌神: chart.xiyongshen.忌神,
    喜用神明细: chart.xiyongshen.喜用神明细,
    避讳字: chart.输入.避讳字,
  };
}

/** 名单键：名拼接串——effect 只认串不认数组引用，父级重渲染不触发重取。 */
export function 名单键of(条目: readonly { 名: string }[]): string {
  return 条目.map((e) => e.名).join('\n');
}

/**
 * 来源键：内容指纹（引用无关）。五行/避讳字排序——勾选顺序抖动不应触发重取；
 * 明细按序列化原样入键（角色/十神变则语义变）。null → 空串（非评估态）。
 */
export function 来源键of(来源: 评估来源 | null): string {
  if (来源 === null) return '';
  return JSON.stringify({
    姓氏: 来源.姓氏,
    喜用神: [...来源.喜用神].sort(),
    忌神: [...来源.忌神].sort(),
    明细: 来源.喜用神明细 ?? null,
    避讳字: [...(来源.避讳字 ?? [])].sort(),
  });
}

/**
 * 显式来源变体：来源传 null 表示「尚不可评估」（无盘且手动未就绪/姓氏未填/非结果态）——
 * 清态回 idle 不发请求。内部纪律与旧签名完全一致（切片串行/error 不清旧列表/abort 作废）。
 */
export function useNameEvaluationsFromSource(
  来源: 评估来源 | null,
  条目: readonly { 名: string }[],
): 评估状态 {
  const [评估列表, set评估列表] = useState<EvaluatedName[]>([]);
  const [阶段, set阶段] = useState<评估阶段>('idle');
  const [错误, set错误] = useState<string | null>(null);
  const [重试计数, set重试计数] = useState(0);

  // 名单键/来源键皆为串（引用无关）——两依赖皆防无限重取。
  const 名单键 = 名单键of(条目);
  const 来源键 = 来源键of(来源);

  // effect 只认内容指纹；payload 组装经 ref 读最新来源原值。
  // ref 更新 effect 声明在数据 effect 之前 → 同一 commit 内先刷新后取数。
  const 来源Ref = useRef(来源);
  useEffect(() => {
    来源Ref.current = 来源;
  }, [来源]);

  useEffect(() => {
    const 名列表 = 名单键 === '' ? [] : 名单键.split('\n');
    const 现来源 = 来源Ref.current;
    if (现来源 === null || 名列表.length === 0) {
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
              姓氏: 现来源.姓氏,
              名字列表: 名列表.slice(i, i + EVALUATE_NAMES_MAX),
              喜用神: 现来源.喜用神,
              忌神: 现来源.忌神,
              喜用神明细: 现来源.喜用神明细,
              避讳字: 现来源.避讳字,
            },
            ac.signal,
          );
          for (const e of 批) 按名.set(e.名, e);
        }
        const 合流 = 名列表.map((名) => 按名.get(名)).filter((e): e is EvaluatedName => e !== undefined);
        set评估列表(合流);
        set阶段('ready');
      } catch (e) {
        if (ac.signal.aborted) return; // 名单/来源已变或卸载：旧结果作废即可
        set错误(e instanceof Error ? e.message : '未知错误');
        set阶段('error'); // 不清评估列表：旧列表仍渲染（卷六语义）
      }
    })();
    return () => ac.abort();
  }, [名单键, 来源键, 重试计数]);

  const 重试 = useCallback(() => set重试计数((n) => n + 1), []);
  return { 评估列表, 阶段, 错误, 重试 };
}

/** 旧签名（chart|null, 条目）：自动带盘口径的兼容壳——chart 引用稳定时与原行为等价；
 *  chart 变化经内容指纹感知（姓氏/喜用神/忌神/明细/避讳字皆同则结果必同，免重取属改进）。 */
export function useNameEvaluations(
  chart: ChartResult | null,
  条目: readonly { 名: string }[],
): 评估状态 {
  return useNameEvaluationsFromSource(chart === null ? null : 来源自盘(chart), 条目);
}
