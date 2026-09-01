/**
 * 跨页草稿记忆（契约 C1）单测：注入内存 Map 假 storage，范式对齐 form-storage.test.ts。
 * 契约：sessionStorage 键前缀含项目名；盘写入前浅守卫（输入.姓氏:string 且 candidates:array）；
 * 输入 zod 浅校验非法→null；损坏→null；SSR/受限环境 load→null、save 静默不抛。
 */
import { describe, expect, it } from 'vitest';
import {
  LAST_CHART_STORAGE_KEY,
  LAST_INPUT_STORAGE_KEY,
  loadLastChart,
  loadLastInput,
  saveLastChart,
  saveLastInput,
  type LastInput,
} from '@/utils/draft-memory';
import type { ChartResult } from '@/lib/types';

/** 假 storage：Map 底座，另暴露原始桶以核对写入键名/内容。 */
function 假存储(): { store: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>; 桶: Map<string, string> } {
  const 桶 = new Map<string, string>();
  return {
    桶,
    store: {
      getItem: (k: string) => 桶.get(k) ?? null,
      setItem: (k: string, v: string) => void 桶.set(k, v),
      removeItem: (k: string) => void 桶.delete(k),
    },
  };
}

/** 访问即抛的 storage（隐私模式/禁用 Cookie 的 iframe 实况）。 */
const 抛错存储: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
  removeItem: () => {
    throw new Error('SecurityError');
  },
};

/** 最小合法盘形状：浅守卫只认 输入.姓氏 与 candidates，其余键透传不校验。 */
function 假盘(overrides: Record<string, unknown> = {}): ChartResult {
  return {
    输入: { 姓氏: '林', 性别: '男', 出生地经度: 121.47, 北京时间: null, 避讳字: [] },
    candidates: [{ 名: '知远' }],
    ...overrides,
  } as unknown as ChartResult;
}

const 输入: LastInput = { 姓氏: '林', 性别: '女', 名字形式: '双名' };

describe('draft-memory LastChart（浅守卫 + roundtrip）', () => {
  it('键前缀含项目名', () => {
    expect(LAST_CHART_STORAGE_KEY.startsWith('问名手卷.')).toBe(true);
    expect(LAST_INPUT_STORAGE_KEY.startsWith('问名手卷.')).toBe(true);
  });

  it('合法盘 save → load 深相等，且写在项目前缀键下', () => {
    const { store, 桶 } = 假存储();
    const 盘 = 假盘();
    saveLastChart(盘, store);
    expect(桶.has(LAST_CHART_STORAGE_KEY)).toBe(true);
    expect(loadLastChart(store)).toEqual(盘);
  });

  it('覆写生效（后一次排盘覆盖前一次）', () => {
    const { store } = 假存储();
    saveLastChart(假盘(), store);
    saveLastChart(假盘({ 输入: { ...假盘().输入, 姓氏: '王' } }), store);
    expect(loadLastChart(store)?.输入.姓氏).toBe('王');
  });

  it('浅守卫拒写：非对象/null/缺输入/输入.姓氏非string/candidates非array 均不写不抛', () => {
    const { store, 桶 } = 假存储();
    for (const 脏 of [
      undefined,
      null,
      '字符串',
      42,
      {},
      { 输入: { 姓氏: '林' } }, // 缺 candidates
      { candidates: [] }, // 缺 输入
      { 输入: { 姓氏: 123 }, candidates: [] }, // 姓氏非 string
      { 输入: { 姓氏: '林' }, candidates: {} }, // candidates 非 array
    ]) {
      expect(() => saveLastChart(脏, store)).not.toThrow();
    }
    expect(桶.size).toBe(0); // 一个都没写进去
    expect(loadLastChart(store)).toBeNull();
  });

  it('未存过时 load 为 null', () => {
    expect(loadLastChart(假存储().store)).toBeNull();
  });

  it('桶内 JSON 损坏 / 浅守卫不符 → null（损坏即弃）', () => {
    const { store, 桶 } = 假存储();
    桶.set(LAST_CHART_STORAGE_KEY, '{输入:林,坏掉的JSON');
    expect(loadLastChart(store)).toBeNull();
    桶.set(LAST_CHART_STORAGE_KEY, JSON.stringify({ 输入: { 姓氏: '林' } })); // 缺 candidates
    expect(loadLastChart(store)).toBeNull();
    桶.set(LAST_CHART_STORAGE_KEY, '"不是对象"');
    expect(loadLastChart(store)).toBeNull();
  });
});

describe('draft-memory LastInput（zod 浅校验）', () => {
  it('save → load 深相等', () => {
    const { store, 桶 } = 假存储();
    saveLastInput(输入, store);
    expect(桶.has(LAST_INPUT_STORAGE_KEY)).toBe(true);
    expect(loadLastInput(store)).toEqual(输入);
  });

  it('未存过时 load 为 null', () => {
    expect(loadLastInput(假存储().store)).toBeNull();
  });

  it('非法形状 → null（枚举外/类型错/缺键/非对象/损坏）', () => {
    const { store, 桶 } = 假存储();
    桶.set(LAST_INPUT_STORAGE_KEY, JSON.stringify({ ...输入, 性别: '未知' }));
    expect(loadLastInput(store)).toBeNull();
    桶.set(LAST_INPUT_STORAGE_KEY, JSON.stringify({ ...输入, 名字形式: '三名' }));
    expect(loadLastInput(store)).toBeNull();
    桶.set(LAST_INPUT_STORAGE_KEY, JSON.stringify({ 姓氏: 123, 性别: '男', 名字形式: '双名' }));
    expect(loadLastInput(store)).toBeNull();
    桶.set(LAST_INPUT_STORAGE_KEY, JSON.stringify({ 姓氏: '林', 性别: '男' })); // 缺 名字形式
    expect(loadLastInput(store)).toBeNull();
    桶.set(LAST_INPUT_STORAGE_KEY, '损坏的{JSON');
    expect(loadLastInput(store)).toBeNull();
  });

  it('多余字段被浅校验剥除（只认 schema 三键）', () => {
    const { store, 桶 } = 假存储();
    桶.set(LAST_INPUT_STORAGE_KEY, JSON.stringify({ ...输入, 野字段: 1 }));
    const back = loadLastInput(store);
    expect(back).toEqual(输入);
    expect(back && '野字段' in back).toBe(false);
  });
});

describe('SSR / 受限存储环境（不抛错，静默降级）', () => {
  it('缺省走 globalThis.sessionStorage：无机则 null+写静默；有机则 roundtrip（宿主差异自适应）', () => {
    // SSR（浏览器无 sessionStorage）与本机 Node 版本差异并存：不锁死宿主，两条路径都必须 throw-free
    if (typeof globalThis.sessionStorage === 'undefined') {
      expect(loadLastChart()).toBeNull();
      expect(loadLastInput()).toBeNull();
      expect(() => saveLastChart(假盘())).not.toThrow();
      expect(() => saveLastInput(输入)).not.toThrow();
    } else {
      expect(() => saveLastChart(假盘())).not.toThrow();
      expect(() => saveLastInput(输入)).not.toThrow();
      expect(loadLastChart()?.输入.姓氏).toBe('林');
      expect(loadLastInput()?.姓氏).toBe('林');
      // 清场防串其他用例（宿主 storage 若只读也不抛）
      expect(() => sessionStorage.removeItem(LAST_CHART_STORAGE_KEY)).not.toThrow();
      expect(() => sessionStorage.removeItem(LAST_INPUT_STORAGE_KEY)).not.toThrow();
    }
  });

  it('storage 访问即抛：load→null，save 静默', () => {
    expect(loadLastChart(抛错存储)).toBeNull();
    expect(loadLastInput(抛错存储)).toBeNull();
    expect(() => saveLastChart(假盘(), 抛错存储)).not.toThrow();
    expect(() => saveLastInput(输入, 抛错存储)).not.toThrow();
  });
});
