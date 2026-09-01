'use client';

/**
 * 喜用神来源面板（契约 C2）：「自动带盘」（取命盘 喜用神/忌神/明细）与「手动勾选」两模式。
 * 纯函数（默认来源选择/解析五行来源/点选*）与展示分离，纯函数供单测直用（tests/utils/xiyong-source.test.ts）。
 * 五行 chip 复用 ui.tsx 的 WuxingChip 与 utils/wuxing.ts 的 WUXING_TEXT_CLASS。
 * 不可变纪律：一切切换皆产出新对象新数组，绝不 mutate 入参。
 */
import type { WuXing, XiyongMingXiItem } from '@/lib/types';
import { WUXING_ORDER, WUXING_TEXT_CLASS } from '@/utils/wuxing';
import { WuxingChip } from './ui';

/** 五行全集（顺序与 WUXING_ORDER 一致）。 */
const 五行全集: readonly WuXing[] = WUXING_ORDER;

/** 一组五行择选：喜用 + 忌（两数组互斥由点选函数保证）。 */
export interface 五行选择 {
  喜用神: WuXing[];
  忌神: WuXing[];
}

/** 来源模式：自动带盘=消费命盘；手动勾选=本机自选（无盘/不信任盘面时用）。 */
export interface 来源选择 {
  模式: '自动带盘' | '手动勾选';
  手动: 五行选择;
}

/** 手动默认值：喜用神全选、忌神空（= 不额外设忌，与「不限」语义等价）。 */
function 默认手动(): 五行选择 {
  return { 喜用神: [...五行全集], 忌神: [] };
}

/** 初始来源选择：有盘默认自动带盘，无盘只能手动勾选（手动值同默认全选）。 */
export function 默认来源选择(有盘: boolean): 来源选择 {
  return { 模式: 有盘 ? '自动带盘' : '手动勾选', 手动: 默认手动() };
}

/** 盘的形状：/api/chart 输出的喜用神切片（明细可缺省）。 */
export interface 盘的喜用神 {
  喜用神: WuXing[];
  忌神: WuXing[];
  明细?: XiyongMingXiItem[];
}

/**
 * 解析实际生效的五行择选：模式=自动带盘且盘在场 → 取盘值（含明细透传）；
 * 盘 null（未排盘/失败）→ 回退手动值。返回新对象，不改入参。
 */
export function 解析五行来源(
  盘: 盘的喜用神 | null,
  选择: 来源选择,
): 五行选择 & { 明细?: XiyongMingXiItem[] } {
  if (选择.模式 === '自动带盘' && 盘 !== null) {
    const { 喜用神, 忌神, 明细 } = 盘;
    return 明细 === undefined
      ? { 喜用神: [...喜用神], 忌神: [...忌神] }
      : { 喜用神: [...喜用神], 忌神: [...忌神], 明细: [...明细] };
  }
  return { 喜用神: [...选择.手动.喜用神], 忌神: [...选择.手动.忌神] };
}

/**
 * 点选喜用神 chip（纯函数，供 UI 与单测共用）：
 * 未选中 → 入喜用神并从忌神摘除（互斥）；已选中 → 摘除，摘空则恢复全选
 * （剔除仍被忌者以维互斥；忌神占满五行之极端下回退全选取「至少 1 个」不变量）。
 */
export function 点选喜用神(现值: 五行选择, 行: WuXing): 五行选择 {
  if (!现值.喜用神.includes(行)) {
    return { 喜用神: [...现值.喜用神, 行], 忌神: 现值.忌神.filter((x) => x !== 行) };
  }
  const 摘后 = 现值.喜用神.filter((x) => x !== 行);
  if (摘后.length === 0) {
    const 恢复 = 五行全集.filter((x) => !现值.忌神.includes(x));
    return { 喜用神: 恢复.length > 0 ? 恢复 : [...五行全集], 忌神: [...现值.忌神] };
  }
  return { 喜用神: 摘后, 忌神: [...现值.忌神] };
}

/**
 * 点选忌神 chip（纯函数）：
 * 已选中 → 摘除（忌神可空）；未选中 → 入忌神并从喜用神摘除（互斥）；
 * 摘后喜用神为空时以「全集−新忌」兜底保「喜用神至少 1 个」；
 * 忌神将占满五行（喜用神无从保底）→ 该次点选不生效。
 */
export function 点选忌神(现值: 五行选择, 行: WuXing): 五行选择 {
  if (现值.忌神.includes(行)) {
    return { 喜用神: [...现值.喜用神], 忌神: 现值.忌神.filter((x) => x !== 行) };
  }
  const 新忌 = [...现值.忌神, 行];
  if (新忌.length >= 五行全集.length) return 现值; // 忌满五行则喜用无存，拒此步
  const 摘后 = 现值.喜用神.filter((x) => x !== 行);
  const 喜用 =
    摘后.length > 0 ? 摘后 : 五行全集.filter((x) => !新忌.includes(x));
  return { 喜用神: 喜用, 忌神: 新忌 };
}

const 模式清单 = ['自动带盘', '手动勾选'] as const;

/**
 * 喜用神来源面板：模式两钮（盘未就绪时「自动带盘」禁用并提示先去排盘）+
 * 手动态五行 chip 双行（喜用神至少 1 个、清空恢复全选；忌神可选、两行互斥）。
 */
export function XiYongSourcePanel({
  盘就绪,
  value,
  onChange,
}: {
  盘就绪: boolean;
  value: 来源选择;
  onChange: (下一值: 来源选择) => void;
}) {
  function 切模式(模式: 来源选择['模式']) {
    if (模式 === '自动带盘' && !盘就绪) return; // 禁用钮兜底防 keyboard 绕过
    if (模式 !== value.模式) onChange({ ...value, 模式 });
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {模式清单.map((模式) => {
          const 选中 = value.模式 === 模式;
          const 禁用 = 模式 === '自动带盘' && !盘就绪;
          return (
            <button
              key={模式}
              type="button"
              disabled={禁用}
              aria-pressed={选中}
              onClick={() => 切模式(模式)}
              className={`border px-3 py-1 text-sm tracking-widest ${
                选中
                  ? 'border-cinnabar bg-cinnabar/10 font-bold text-cinnabar'
                  : 'border-ink/40 text-ink hover:border-cinnabar hover:text-cinnabar'
              } ${禁用 ? 'cursor-not-allowed opacity-40 hover:border-ink/40 hover:text-ink' : ''}`}
            >
              {模式}
            </button>
          );
        })}
        {!盘就绪 ? <span className="text-xs text-ink-soft">盘面未就绪，请先去排盘后自动带盘。</span> : null}
      </div>

      {value.模式 === '手动勾选' ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-14 text-sm font-bold text-ink">喜用神</span>
            {五行全集.map((行) => {
              const 选中 = value.手动.喜用神.includes(行);
              return (
                <button
                  key={行}
                  type="button"
                  aria-pressed={选中}
                  onClick={() => onChange({ ...value, 手动: 点选喜用神(value.手动, 行) })}
                  className={`rounded-full border px-1 py-1 ${
                    选中 ? 'border-cinnabar/70 bg-cinnabar/10' : 'border-ink/15 opacity-45'
                  }`}
                >
                  <WuxingChip 五行={行} textClass={WUXING_TEXT_CLASS[行]} />
                </button>
              );
            })}
            <span className="text-xs text-ink-soft">至少保留一个；清空即恢复全选</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-14 text-sm font-bold text-ink">忌神</span>
            {五行全集.map((行) => {
              const 选中 = value.手动.忌神.includes(行);
              return (
                <button
                  key={行}
                  type="button"
                  aria-pressed={选中}
                  onClick={() => onChange({ ...value, 手动: 点选忌神(value.手动, 行) })}
                  className={`rounded-full border px-1 py-1 ${
                    选中 ? 'border-cinnabar bg-cinnabar/15' : 'border-ink/15 opacity-45'
                  }`}
                >
                  <WuxingChip 五行={行} textClass={WUXING_TEXT_CLASS[行]} />
                </button>
              );
            })}
            <span className="text-xs text-ink-soft">可不设；与喜用神互斥</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
