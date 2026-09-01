/**
 * 单字抽卡（契约 v3 §3.1/§6 draw 段）单测：注入 rng 确定性、喜用优先、
 * 喜用滤空回退全集（回退不越过排除字）、排除全灭→null、空库→null、
 * rng=0 / rng→1⁻ 边界=首/尾元素。纯 util，node 环境。
 */
import { describe, expect, it, vi } from 'vitest';
import { 抽卡, type 好意向字 } from '@/utils/char-draw';

function 字(字: string, 五行: 好意向字['五行']): 好意向字 {
  return { 字, 五行, 意向标签: ['测试'], 寓意: `${字}的寓意` };
}

const 库: 好意向字[] = [
  字('明', '水'),
  字('沐', '水'),
  字('林', '木'),
  字('炎', '火'),
];

const rng固定 = (值: number) => () => 值;

describe('抽卡 基本语义', () => {
  it('注入 rng 确定性：同库同 ctx 两次抽结果逐字段相等', () => {
    const ctx = { 喜用神: [], 排除字: [], rng: () => 0.42 };
    const 甲 = 抽卡(库, ctx);
    const 乙 = 抽卡(库, ctx);
    expect(甲).not.toBeNull();
    expect(甲).toEqual(乙);
  });

  it('rng 恰调用一次、且用候选数缩放：rng=0 → 首元素', () => {
    const rng = vi.fn(() => 0);
    const 结果 = 抽卡(库, { rng });
    expect(rng).toHaveBeenCalledTimes(1);
    expect(结果).toEqual(库[0]);
  });

  it('rng→1⁻ 边界 → 尾元素', () => {
    expect(抽卡(库, { rng: () => 1 - Number.EPSILON })).toEqual(库.at(-1));
  });

  it('无喜用神（undefined 与 [] 同等）→ 全库等概率，floor 正确落位', () => {
    // 0.5 × 4 = 2 → 库[2]
    expect(抽卡(库, { rng: rng固定(0.5) })).toEqual(字('林', '木'));
    expect(抽卡(库, { 喜用神: [], rng: rng固定(0.5) })).toEqual(字('林', '木'));
    expect(抽卡(库, { 喜用神: undefined, rng: rng固定(0.5) })).toEqual(字('林', '木'));
  });
});

describe('抽卡 喜用优先', () => {
  it('喜用池非空 → 必出自喜用池（rng 打满也不碰非喜用字）', () => {
    // 喜用=水 → 候选=[明,沐]；rng→1⁻ 也只能落在 沐（若未滤则落 炎）
    const 结果 = 抽卡(库, { 喜用神: ['水'], rng: () => 1 - Number.EPSILON });
    expect(结果).toEqual(字('沐', '水'));
    expect(库.filter((c) => c.五行 === '水')).toContainEqual(结果);
  });

  it('多喜用神并集过滤', () => {
    // 喜用={水,火} → 候选=[明,沐,炎]；rng=0 → 首=明
    expect(抽卡(库, { 喜用神: ['水', '火'], rng: rng固定(0) })).toEqual(字('明', '水'));
  });

  it('喜用滤空 → 回退全集（排除后的全集），照常抽中', () => {
    const 结果 = 抽卡(库, { 喜用神: ['土'], rng: rng固定(0) });
    expect(结果).toEqual(字('明', '水')); // 库无土 → 回退全集，rng=0 落首
  });

  it('回退不越过排除字：喜用滤空 + 排除吃掉部分全集 → 只在余集内抽', () => {
    const 结果 = 抽卡(库, { 喜用神: ['土'], 排除字: ['明', '沐'], rng: rng固定(0.99) });
    expect(结果).toEqual(字('炎', '火')); // 余集=[林,炎]，rng→1⁻ 落尾
  });
});

describe('抽卡 空态与排除', () => {
  it('空库 → null', () => {
    expect(抽卡([], { rng: rng固定(0) })).toBeNull();
    expect(抽卡([], { 喜用神: ['水'], rng: rng固定(0) })).toBeNull();
  });

  it('排除字全灭 → null（含喜用池字被逐一排除的极端）', () => {
    const 排除全部 = { 排除字: 库.map((c) => c.字), rng: rng固定(0) };
    expect(抽卡(库, 排除全部)).toBeNull();
    expect(抽卡(库, { 喜用神: ['水'], 排除字: ['明', '沐'], rng: rng固定(0) })).toEqual(字('林', '木'));
    expect(抽卡(库, { 喜用神: ['水'], 排除字: ['明', '沐', '林', '炎'], rng: rng固定(0) })).toBeNull();
  });

  it('排除字优先于喜用：排除掉的喜用字永不回炉', () => {
    for (const r of [0, 0.25, 0.5, 0.75, 1 - Number.EPSILON]) {
      const 结果 = 抽卡(库, { 喜用神: ['水'], 排除字: ['沐'], rng: rng固定(r) });
      expect(结果).toEqual(字('明', '水')); // 喜用池仅剩 明
    }
  });
});

describe('抽卡 入参纪律', () => {
  it('不 mutate 入参（库/排除字/喜用神引用与内容原样）', () => {
    const 本地库 = [...库];
    const 排除 = ['明'];
    const 喜用 = ['水'];
    抽卡(本地库, { 喜用神: 喜用, 排除字: 排除, rng: rng固定(0.5) });
    expect(本地库).toEqual(库);
    expect(排除).toEqual(['明']);
    expect(喜用).toEqual(['水']);
  });
});
