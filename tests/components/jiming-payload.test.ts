/**
 * /jiming 载荷组装行为级单测：静态直载 jiming-workbench（oxc jsx=automatic 配置就位后
 * 含 JSX 的 .tsx 可真 import——同 draw-payload.test.ts 载法；旧「源码抠体 + new Function
 * 注入」技法连同其对重构的脆弱性已随本次收敛摘净）。断言组：
 * ① 自动带盘：喜忌取盘值、明细在场随带、缺省省键；
 * ② 手动勾选：即使盘有明细也不随带（契约「手动模式不传明细」）、喜忌取手动值；
 * ③ 无盘回退：自动带盘模式下盘 null → 落回手动值且无明细；
 * ④ 拆字口径：姓氏 trim、禁用空数组省键、避讳恒传（splitHanChars 去重限 30）；
 * ⑤ 产出物过服务端同源 schema（mingrenMatchRequestSchema）——客户端预校验双保险闭环；
 * ⑥ 不可变：入参深冻结后调用无异常（零 mutate）。
 */
import { describe, expect, it } from 'vitest';
import { mingrenMatchRequestSchema } from '@/lib/mingren/schema';
import type { ChartResult } from '@/lib/types';
import { 组名人匹配载荷 } from '@/components/jiming-workbench';

type 表单入参 = {
  姓氏: string;
  性别: '男' | '女';
  名字形式: '单名' | '双名';
  避讳字文本: string;
  禁用字文本: string;
};

type 选择入参 = {
  模式: '自动带盘' | '手动勾选';
  手动: { 喜用神: readonly string[]; 忌神: readonly string[] };
};

/** 薄壳：直调被测导出（依赖注入旧壳已随静态直载退役——模块作用域自持真依赖）。 */
const 组载荷 = (
  表单: 表单入参,
  chart: ChartResult | null,
  选择: 选择入参,
): Record<string, unknown> =>
  组名人匹配载荷(表单, chart, 选择 as never) as Record<string, unknown>;

function 组载荷实跑(
  表单: Partial<表单入参> = {},
  chart: ChartResult | null = null,
  选择: 选择入参 = { 模式: '手动勾选', 手动: { 喜用神: ['水'], 忌神: [] } },
): Record<string, unknown> {
  return 组载荷(
    { 姓氏: '王', 性别: '男', 名字形式: '双名', 避讳字文本: '', 禁用字文本: '', ...表单 },
    chart,
    选择,
  );
}

/** 测试盘：只喂 xiyongshen 切片（盘之喜忌仅消费此片），余字段与本测无关故双断言窄化。 */
const 有盘 = {
  xiyongshen: {
    喜用神: ['水', '木'],
    忌神: ['火'],
    喜用神明细: [{ 五行: '水', 十神关系: '印星', 角色: '主用' }],
  },
} as unknown as ChartResult;
const 无明细盘 = {
  xiyongshen: { 喜用神: ['金'], 忌神: [], 喜用神明细: undefined },
} as unknown as ChartResult;
const 自动 = { 模式: '自动带盘', 手动: { 喜用神: ['土'], 忌神: [] } } as const;
const 手动 = { 模式: '手动勾选', 手动: { 喜用神: ['木'], 忌神: ['金'] } } as const;

describe('组名人匹配载荷：喜忌来源三态', () => {
  it('自动带盘 + 有明细 → 取盘值并随带 喜用神明细', () => {
    const p = 组载荷实跑({}, 有盘, 自动);
    expect(p.喜用神).toEqual(['水', '木']);
    expect(p.忌神).toEqual(['火']);
    expect(p.喜用神明细).toEqual(有盘.xiyongshen.喜用神明细);
  });
  it('自动带盘 + 盘无明细 → 省 喜用神明细 键', () => {
    const p = 组载荷实跑({}, 无明细盘, 自动);
    expect('喜用神明细' in p).toBe(false);
    expect(p.喜用神).toEqual(['金']);
  });
  it('手动勾选 → 即使盘有明细也不随带；喜忌取手动值', () => {
    const p = 组载荷实跑({}, 有盘, 手动);
    expect('喜用神明细' in p).toBe(false);
    expect(p.喜用神).toEqual(['木']);
    expect(p.忌神).toEqual(['金']);
  });
  it('自动带盘但盘 null → 解析五行来源回退手动值，无明细', () => {
    const p = 组载荷实跑({}, null, 自动);
    expect(p.喜用神).toEqual(['土']);
    expect('喜用神明细' in p).toBe(false);
  });
});

describe('组名人匹配载荷：表单字段口径', () => {
  it('姓氏 trim；性别/名字形式直传', () => {
    const p = 组载荷实跑({ 姓氏: ' 欧阳 ', 性别: '女', 名字形式: '单名' });
    expect(p.姓氏).toBe('欧阳');
    expect(p.性别).toBe('女');
    expect(p.名字形式).toBe('单名');
  });
  it('避讳字恒传数组（splitHanChars 去重）；禁用字空则省键、非空随带', () => {
    expect(组载荷实跑().避讳字).toEqual([]);
    const p = 组载荷实跑({ 避讳字文本: '伟强伟', 禁用字文本: '梓' });
    expect(p.避讳字).toEqual(['伟', '强']);
    expect(p.禁用字).toEqual(['梓']);
    expect('禁用字' in 组载荷实跑()).toBe(false);
  });
});

describe('组名人匹配载荷：与 schema 闭环 + 不可变', () => {
  it('三态产出均过 mingrenMatchRequestSchema（预校验双保险不误杀）', () => {
    for (const p of [
      组载荷实跑({ 姓氏: '王' }, 有盘, 自动),
      组载荷实跑({ 姓氏: '王', 禁用字文本: '梓' }, 无明细盘, 自动),
      组载荷实跑({ 姓氏: '王' }, 有盘, 手动),
    ]) {
      const r = mingrenMatchRequestSchema.safeParse(p);
      expect(r.success ? true : JSON.stringify(r.error.issues)).toBe(true);
    }
  });
  it('不 mutate 入参（表单/盘/选择深冻结后调用无异常）', () => {
    const 表单 = Object.freeze({ 姓氏: '王', 性别: '男', 名字形式: '双名', 避讳字文本: '伟', 禁用字文本: '' });
    const 选择 = Object.freeze({ 模式: '自动带盘', 手动: Object.freeze({ 喜用神: Object.freeze(['土']), 忌神: Object.freeze([]) }) });
    const 盘 = Object.freeze({ xiyongshen: Object.freeze({ 喜用神: Object.freeze(['水']), 忌神: Object.freeze([]), 喜用神明细: undefined }) });
    expect(() => 组载荷(表单 as never, 盘 as never, 选择 as never)).not.toThrow();
    expect(表单.姓氏).toBe('王');
  });
});
