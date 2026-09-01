/**
 * 抽卡赛道表单本机记忆（赛道拆分 /draw）单测：注入假 storage，不依赖浏览器全局。
 * 契约：KEY 前缀含项目名且与主表单分键；损坏/形状不符 → null（宁丢记忆不喂脏数据）；
 * SSR/无 storage 环境 load→null、save/clear 静默不抛（镜像 form-storage 范式）。
 */
import { describe, expect, it } from 'vitest';
import {
  DRAW_FORM_STORAGE_KEY,
  clearDrawFormSnapshot,
  loadDrawFormSnapshot,
  saveDrawFormSnapshot,
  type DrawFormSnapshot,
} from '@/utils/draw-form-storage';
import { FORM_STORAGE_KEY } from '@/utils/form-storage';

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

const 快照: DrawFormSnapshot = {
  姓氏: '林',
  性别: '女',
  名字形式: '双名',
  指定字文本: '晶',
  指定字位置: '第一',
  避讳字文本: '伟强',
  禁用字文本: '梓',
};

describe('draw-form-storage roundtrip', () => {
  it('save → load 深相等，且写在项目前缀键下（与主表单分键）', () => {
    const { store, 桶 } = 假存储();
    saveDrawFormSnapshot(快照, store);
    expect(DRAW_FORM_STORAGE_KEY.startsWith('问名手卷.')).toBe(true);
    expect(DRAW_FORM_STORAGE_KEY).not.toBe(FORM_STORAGE_KEY);
    expect(桶.has(DRAW_FORM_STORAGE_KEY)).toBe(true);
    expect(loadDrawFormSnapshot(store)).toEqual(快照);
  });

  it('覆写生效（后一次提交覆盖前一次）', () => {
    const { store } = 假存储();
    saveDrawFormSnapshot(快照, store);
    saveDrawFormSnapshot({ ...快照, 姓氏: '王' }, store);
    expect(loadDrawFormSnapshot(store)?.姓氏).toBe('王');
  });

  it('clear 后 load 为 null；clear 幂等（无值/连清不抛）', () => {
    const { store } = 假存储();
    saveDrawFormSnapshot(快照, store);
    clearDrawFormSnapshot(store);
    expect(loadDrawFormSnapshot(store)).toBeNull();
    expect(() => clearDrawFormSnapshot(store)).not.toThrow();
  });

  it('未存过时 load 为 null', () => {
    expect(loadDrawFormSnapshot(假存储().store)).toBeNull();
  });

  it('与主表单互不串档（存本键不扰主表单键，反之亦然）', () => {
    const { store, 桶 } = 假存储();
    saveDrawFormSnapshot(快照, store);
    桶.set(FORM_STORAGE_KEY, '主表单的字节');
    expect(loadDrawFormSnapshot(store)).toEqual(快照); // 主表单键内容不影响本档
    clearDrawFormSnapshot(store);
    expect(桶.has(FORM_STORAGE_KEY)).toBe(true); // 清本档不碰主表单键
  });
});

describe('脏数据防御（损坏/形状不符 → null）', () => {
  it('JSON 损坏静默忽略', () => {
    const { store, 桶 } = 假存储();
    桶.set(DRAW_FORM_STORAGE_KEY, '{姓氏:林,坏掉的JSON');
    expect(loadDrawFormSnapshot(store)).toBeNull();
  });

  it('形状不符（缺字段/类型错/枚举外）→ null', () => {
    const { store, 桶 } = 假存储();
    桶.set(DRAW_FORM_STORAGE_KEY, JSON.stringify({ 姓氏: '林' })); // 缺其余字段
    expect(loadDrawFormSnapshot(store)).toBeNull();
    桶.set(DRAW_FORM_STORAGE_KEY, JSON.stringify({ ...快照, 性别: '未知' })); // 枚举外
    expect(loadDrawFormSnapshot(store)).toBeNull();
    桶.set(DRAW_FORM_STORAGE_KEY, JSON.stringify({ ...快照, 指定字位置: '第三' })); // 枚举外
    expect(loadDrawFormSnapshot(store)).toBeNull();
    桶.set(DRAW_FORM_STORAGE_KEY, JSON.stringify({ ...快照, 姓氏: 3 })); // 类型错
    expect(loadDrawFormSnapshot(store)).toBeNull();
    桶.set(DRAW_FORM_STORAGE_KEY, '"不是对象"');
    expect(loadDrawFormSnapshot(store)).toBeNull();
  });

  it('多余字段被浅校验剥除（只认 schema 字段清单）', () => {
    const { store, 桶 } = 假存储();
    桶.set(DRAW_FORM_STORAGE_KEY, JSON.stringify({ ...快照, 野字段: 1 }));
    const back = loadDrawFormSnapshot(store);
    expect(back).toEqual(快照);
    expect(back && '野字段' in back).toBe(false);
  });
});

describe('SSR / 受限存储环境（不抛错，静默降级）', () => {
  it('node 环境无 globalThis.localStorage：load→null，save/clear 不抛', () => {
    expect(globalThis.localStorage).toBeUndefined();
    expect(loadDrawFormSnapshot()).toBeNull();
    expect(() => saveDrawFormSnapshot(快照)).not.toThrow();
    expect(() => clearDrawFormSnapshot()).not.toThrow();
  });

  it('storage 访问即抛：load→null，save/clear 静默', () => {
    expect(loadDrawFormSnapshot(抛错存储)).toBeNull();
    expect(() => saveDrawFormSnapshot(快照, 抛错存储)).not.toThrow();
    expect(() => clearDrawFormSnapshot(抛错存储)).not.toThrow();
  });
});
