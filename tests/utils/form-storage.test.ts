/**
 * 表单本机记忆（任务 #29）单测：注入假 storage，不依赖浏览器全局。
 * 契约：KEY 前缀含项目名；损坏/形状不符 → null（宁丢记忆不喂脏数据）；
 * SSR/无 storage 环境 load→null、save/clear 静默不抛。
 */
import { describe, expect, it } from 'vitest';
import {
  FORM_STORAGE_KEY,
  clearFormSnapshot,
  loadFormSnapshot,
  saveFormSnapshot,
  type FormSnapshot,
} from '@/utils/form-storage';

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

const 快照: FormSnapshot = {
  姓氏: '林',
  母亲姓氏: '陈',
  名字草案: '知予',
  性别: '女',
  历法: '农历',
  闰月: true,
  出生日期: '2025-02-12',
  时辰未知: false,
  出生时间: '08:30',
  城市: '上海',
  经度: '121.47',
  使用真太阳时: true,
  夏令时: false,
  名字形式: '双名',
  启用辈字: true,
  辈字: '知',
  辈字位置: '第一',
  指定字文本: '晶',
  指定字位置: '第二',
  避讳字文本: '伟强',
  禁用字文本: '梓',
};

describe('form-storage roundtrip', () => {
  it('save → load 深相等，且写在项目前缀键下', () => {
    const { store, 桶 } = 假存储();
    saveFormSnapshot(快照, store);
    expect(FORM_STORAGE_KEY.startsWith('问名手卷.')).toBe(true);
    expect(桶.has(FORM_STORAGE_KEY)).toBe(true);
    expect(loadFormSnapshot(store)).toEqual(快照);
  });

  it('覆写生效（后一次提交覆盖前一次）', () => {
    const { store } = 假存储();
    saveFormSnapshot(快照, store);
    saveFormSnapshot({ ...快照, 姓氏: '王' }, store);
    expect(loadFormSnapshot(store)?.姓氏).toBe('王');
  });

  it('clear 后 load 为 null；clear 幂等（无值/连清不抛）', () => {
    const { store } = 假存储();
    saveFormSnapshot(快照, store);
    clearFormSnapshot(store);
    expect(loadFormSnapshot(store)).toBeNull();
    expect(() => clearFormSnapshot(store)).not.toThrow();
  });

  it('未存过时 load 为 null', () => {
    expect(loadFormSnapshot(假存储().store)).toBeNull();
  });

  it('旧快照（v1 时期缺 指定字 两键）load 成功且取 schema default（契约 v3 §1.5：default 必须进 schema）', () => {
    const { store, 桶 } = 假存储();
    // v1 时代存量：无这两键（filter 剔除，避免 destructure-and-ignore 触发 no-unused-vars）
    const 旧快照 = Object.fromEntries(
      Object.entries(快照).filter(([键]) => 键 !== '指定字文本' && 键 !== '指定字位置'),
    );
    桶.set(FORM_STORAGE_KEY, JSON.stringify(旧快照));
    const back = loadFormSnapshot(store);
    expect(back).not.toBeNull(); // 缺键无 default = 整份作废 → 这里必须非 null
    expect(back).toEqual({ ...快照, 指定字文本: '', 指定字位置: '任一' }); // 其余字段照常恢复
  });
});

describe('脏数据防御（损坏/形状不符 → null）', () => {
  it('JSON 损坏静默忽略', () => {
    const { store, 桶 } = 假存储();
    桶.set(FORM_STORAGE_KEY, '{姓氏:林,坏掉的JSON');
    expect(loadFormSnapshot(store)).toBeNull();
  });

  it('形状不符（缺字段/类型错/枚举外）→ null', () => {
    const { store, 桶 } = 假存储();
    桶.set(FORM_STORAGE_KEY, JSON.stringify({ 姓氏: '林' })); // 缺其余字段
    expect(loadFormSnapshot(store)).toBeNull();
    桶.set(FORM_STORAGE_KEY, JSON.stringify({ ...快照, 性别: '未知' })); // 枚举外
    expect(loadFormSnapshot(store)).toBeNull();
    桶.set(FORM_STORAGE_KEY, JSON.stringify({ ...快照, 闰月: 'true' })); // 类型错
    expect(loadFormSnapshot(store)).toBeNull();
    桶.set(FORM_STORAGE_KEY, '"不是对象"');
    expect(loadFormSnapshot(store)).toBeNull();
  });

  it('多余字段被浅校验剥除（只认 schema 字段清单）', () => {
    const { store, 桶 } = 假存储();
    桶.set(FORM_STORAGE_KEY, JSON.stringify({ ...快照, 野字段: 1 }));
    const back = loadFormSnapshot(store);
    expect(back).toEqual(快照);
    expect(back && '野字段' in back).toBe(false);
  });
});

describe('SSR / 受限存储环境（不抛错，静默降级）', () => {
  it('node 环境无 globalThis.localStorage：load→null，save/clear 不抛', () => {
    expect(globalThis.localStorage).toBeUndefined();
    expect(loadFormSnapshot()).toBeNull();
    expect(() => saveFormSnapshot(快照)).not.toThrow();
    expect(() => clearFormSnapshot()).not.toThrow();
  });

  it('storage 访问即抛：load→null，save/clear 静默', () => {
    expect(loadFormSnapshot(抛错存储)).toBeNull();
    expect(() => saveFormSnapshot(快照, 抛错存储)).not.toThrow();
    expect(() => clearFormSnapshot(抛错存储)).not.toThrow();
  });
});
