/**
 * 意向吉名本机记忆（契约 v2 §2）单测：注入内存 Map 假 storage，不依赖浏览器全局。
 * 契约：KEY 前缀含项目名；无值/损坏/形状不符 → []（三道防线）；按名去重保最早添加于；
 * 上限 60 裁最旧；add/remove 不可变；SSR/抛错 storage 静默降级、永不 throw。
 * v2.1 追加：来源 enum 含「导入」；addIntentEntries 只填剩余容量丢尾部、绝不裁最旧。
 */
import { describe, expect, it } from 'vitest';
import {
  INTENT_NAMES_MAX,
  INTENT_NAMES_STORAGE_KEY,
  addIntentEntries,
  addIntentEntry,
  clearIntentEntries,
  loadIntentEntries,
  removeIntentEntry,
  type IntentEntry,
} from '@/utils/intent-names-storage';

/** 假 storage：Map 底座，另暴露原始桶以核对写入键名/内容。 */
function 假存储(): { store: { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }; 桶: Map<string, string> } {
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
const 抛错存储 = {
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

function 条目(名: string, 添加于: string, 来源: IntentEntry['来源'] = '点赞'): IntentEntry {
  return { 名, 来源, 添加于 };
}

function 塞入(桶: Map<string, string>, 数据: unknown): void {
  桶.set(INTENT_NAMES_STORAGE_KEY, JSON.stringify(数据));
}

describe('loadIntentEntries 三道防线', () => {
  it('无值 → []', () => {
    const { store } = 假存储();
    expect(loadIntentEntries(store)).toEqual([]);
  });

  it('空串 → []', () => {
    const { store, 桶 } = 假存储();
    桶.set(INTENT_NAMES_STORAGE_KEY, '');
    expect(loadIntentEntries(store)).toEqual([]);
  });

  it('JSON 损坏 → []', () => {
    const { store, 桶 } = 假存储();
    桶.set(INTENT_NAMES_STORAGE_KEY, '{不是JSON[');
    expect(loadIntentEntries(store)).toEqual([]);
  });

  it('形状不符 → []（非数组 / 元素缺字段 / 名非 1-2 汉字 / 来源非法 / 添加于非串）', () => {
    const 坏数据: unknown[] = [
      { 名: '知予' },
      [{ 名: '知予', 来源: '点赞' }],
      [{ 名: '知予abc', 来源: '点赞', 添加于: '2026-01-01T00:00:00.000Z' }],
      [{ 名: '三个字', 来源: '点赞', 添加于: '2026-01-01T00:00:00.000Z' }],
      [{ 名: '知予', 来源: '收藏', 添加于: '2026-01-01T00:00:00.000Z' }],
      [{ 名: '知予', 来源: '点赞', 添加于: 123 }],
    ];
    for (const 数据 of 坏数据) {
      const { store, 桶 } = 假存储();
      塞入(桶, 数据);
      expect(loadIntentEntries(store)).toEqual([]);
    }
  });

  it('合法数据 → 原序返回；且只读不写盘', () => {
    const { 桶 } = 假存储();
    const 原 = [条目('知予', '2026-01-02T00:00:00.000Z', '草案'), 条目('白', '2026-01-01T00:00:00.000Z')];
    塞入(桶, 原);
    const 写入次数 = { n: 0 };
    const 只读 = {
      getItem: (k: string) => 桶.get(k) ?? null,
      setItem: () => {
        写入次数.n += 1;
      },
      removeItem: () => {},
    };
    expect(loadIntentEntries(只读)).toEqual(原);
    expect(写入次数.n).toBe(0);
  });

  it('按名去重保留最早添加于（乱序入库同样取最早）', () => {
    const { store, 桶 } = 假存储();
    塞入(桶, [
      条目('知予', '2026-03-01T00:00:00.000Z', '点赞'),
      条目('知予', '2026-01-01T00:00:00.000Z', '草案'),
      条目('白', '2026-02-01T00:00:00.000Z'),
    ]);
    const 结果 = loadIntentEntries(store);
    expect(结果).toHaveLength(2);
    expect(结果[0]).toEqual(条目('知予', '2026-01-01T00:00:00.000Z', '草案'));
  });

  // 合成名须为 1-2 汉字（zod 白名单）——用 CJK 基本区码点造互异单字名
  const 造名 = (i: number) => String.fromCodePoint(0x4e00 + i);

  it('超上限 60 → 裁最旧，保 60 条且余者原序', () => {
    const { store, 桶 } = 假存储();
    const 基准 = Date.UTC(2026, 0, 1);
    const 造 = (i: number): IntentEntry => 条目(造名(i), new Date(基准 + i * 1000).toISOString());
    // 61 条：最旧（i=0）须被裁掉
    塞入(桶, Array.from({ length: INTENT_NAMES_MAX + 1 }, (_, i) => 造(i)));
    const 结果 = loadIntentEntries(store);
    expect(结果).toHaveLength(INTENT_NAMES_MAX);
    expect(结果.some((e) => e.名 === 造名(0))).toBe(false);
    expect(结果[0].名).toBe(造名(1));
    expect(结果.at(-1)?.名).toBe(造名(INTENT_NAMES_MAX));
  });

  it('抛错 storage → []（永不 throw）', () => {
    expect(loadIntentEntries(抛错存储)).toEqual([]);
  });

  it('缺省 storage 且环境无 localStorage（SSR/node）→ []', () => {
    // vitest node 环境无 globalThis.localStorage，走 globalThis ?? null 分支
    expect(globalThis.localStorage).toBeUndefined();
    expect(loadIntentEntries()).toEqual([]);
  });
});

describe('addIntentEntry', () => {
  it('追加新对象并写盘（键名与内容可核）', () => {
    const { store, 桶 } = 假存储();
    const 结果 = addIntentEntry('知予', '草案', store);
    expect(结果.已存在).toBe(false);
    expect(结果.条目).toHaveLength(1);
    expect(结果.条目[0].名).toBe('知予');
    expect(结果.条目[0].来源).toBe('草案');
    expect(() => new Date(结果.条目[0].添加于).toISOString()).not.toThrow();
    expect(桶.get(INTENT_NAMES_STORAGE_KEY)).toBe(JSON.stringify(结果.条目));
  });

  it('重名不重复入列、不刷新添加于、原列表返回', () => {
    const { store, 桶 } = 假存储();
    const 原 = 条目('知予', '2026-01-01T00:00:00.000Z', '草案');
    塞入(桶, [原]);
    const 结果 = addIntentEntry('知予', '点赞', store);
    expect(结果.已存在).toBe(true);
    expect(结果.条目).toEqual([原]);
  });

  it('不可变：不改动既有引用', () => {
    const { store, 桶 } = 假存储();
    塞入(桶, [条目('白', '2026-01-01T00:00:00.000Z')]);
    const 先 = loadIntentEntries(store);
    const 后 = addIntentEntry('知予', '点赞', store).条目;
    expect(先).not.toBe(后);
    expect(先).toHaveLength(1);
    expect(后).toHaveLength(2);
  });

  it('超上限追加 → 裁最旧保 60', () => {
    const { store, 桶 } = 假存储();
    const 基准 = Date.UTC(2026, 0, 1);
    const 造名 = (i: number) => String.fromCodePoint(0x4e00 + i);
    塞入(
      桶,
      Array.from({ length: INTENT_NAMES_MAX }, (_, i) => 条目(造名(i), new Date(基准 + i * 1000).toISOString())),
    );
    const 结果 = addIntentEntry('新', '点赞', store);
    expect(结果.条目).toHaveLength(INTENT_NAMES_MAX);
    expect(结果.条目.some((e) => e.名 === 造名(0))).toBe(false);
    expect(结果.条目.at(-1)?.名).toBe('新');
  });

  it('非法名静默忽略：不写盘，返回现列表', () => {
    const { store, 桶 } = 假存储();
    塞入(桶, [条目('白', '2026-01-01T00:00:00.000Z')]);
    const 结果 = addIntentEntry('abc', '点赞', store);
    expect(结果.已存在).toBe(false);
    expect(结果.条目).toHaveLength(1);
    expect(桶.get(INTENT_NAMES_STORAGE_KEY)).toBe(JSON.stringify([条目('白', '2026-01-01T00:00:00.000Z')]));
  });

  it('抛错 storage → 内存结果照常返回，静默不 throw', () => {
    const 结果 = addIntentEntry('知予', '点赞', 抛错存储);
    expect(结果.已存在).toBe(false);
    expect(结果.条目).toHaveLength(1);
  });
});

describe('addIntentEntries（批量导入，v2.1）', () => {
  it('「导入」来源读写往返（enum 扩宽后旧名照常读取）', () => {
    const { store, 桶 } = 假存储();
    塞入(桶, [条目('白', '2026-01-01T00:00:00.000Z', '点赞'), 条目('知予', '2026-01-02T00:00:00.000Z', '导入')]);
    expect(loadIntentEntries(store)).toEqual([
      条目('白', '2026-01-01T00:00:00.000Z', '点赞'),
      条目('知予', '2026-01-02T00:00:00.000Z', '导入'),
    ]);
    const 结果 = addIntentEntries(['沐宸'], '导入', store);
    expect(结果.新增).toBe(1);
    expect(结果.条目.at(-1)).toMatchObject({ 名: '沐宸', 来源: '导入' });
    expect(loadIntentEntries(store)).toEqual(结果.条目); // 写盘→回读一致
  });

  it('批内去重保序 + 批外重名计已存在 + 非法名静默跳过 + 单次写盘', () => {
    const { 桶 } = 假存储();
    塞入(桶, [条目('白', '2026-01-01T00:00:00.000Z')]);
    let 写次数 = 0;
    const 计次 = {
      getItem: (k: string) => 桶.get(k) ?? null,
      setItem: (k: string, v: string) => {
        写次数 += 1;
        桶.set(k, v);
      },
      removeItem: () => {},
    };
    const 结果 = addIntentEntries(['知予', '知予', '白', 'abc', '沐宸'], '导入', 计次);
    expect(结果.新增).toBe(2);
    expect(结果.已存在).toBe(1);
    expect(结果.满编丢弃).toBe(0);
    expect(结果.条目.map((e) => e.名)).toEqual(['白', '知予', '沐宸']);
    expect(写次数).toBe(1);
  });

  it('满编只填剩余容量、丢尾部、绝不裁最旧既有名', () => {
    const { store, 桶 } = 假存储();
    const 基准 = Date.UTC(2026, 0, 1);
    const 造名 = (i: number) => String.fromCodePoint(0x4e00 + i);
    塞入(
      桶,
      Array.from({ length: INTENT_NAMES_MAX - 2 }, (_, i) =>
        条目(造名(i), new Date(基准 + i * 1000).toISOString()),
      ),
    );
    const 结果 = addIntentEntries([造名(100), 造名(101), 造名(102), 造名(103)], '导入', store);
    expect(结果.条目).toHaveLength(INTENT_NAMES_MAX);
    expect(结果.新增).toBe(2);
    expect(结果.满编丢弃).toBe(2); // 尾部两名字被丢
    expect(结果.条目[0].名).toBe(造名(0)); // 最旧健在——addIntentEntry 的裁旧路径未被走
    expect(结果.条目.at(-1)?.名).toBe(造名(101));
  });

  it('既有已满 60 → 全丢不写盘；同批重导幂等（新增 0、计数分流不变）', () => {
    const { store, 桶 } = 假存储();
    const 造名 = (i: number) => String.fromCodePoint(0x4e00 + i);
    const 满 = Array.from({ length: INTENT_NAMES_MAX }, (_, i) =>
      条目(造名(i), `2026-01-01T00:00:${String(i).padStart(2, '0')}.000Z`),
    );
    塞入(桶, 满);
    const 前快照 = 桶.get(INTENT_NAMES_STORAGE_KEY);
    const 结果 = addIntentEntries(['知予', '沐宸'], '导入', store);
    expect(结果).toEqual({ 条目: 满, 新增: 0, 已存在: 0, 满编丢弃: 2 });
    expect(桶.get(INTENT_NAMES_STORAGE_KEY)).toBe(前快照);
    const 幂等 = addIntentEntries([造名(0), '知予'], '导入', store); // 批外重名 → 已存在 1
    expect(幂等).toEqual({ 条目: 满, 新增: 0, 已存在: 1, 满编丢弃: 1 });
    expect(桶.get(INTENT_NAMES_STORAGE_KEY)).toBe(前快照);
  });

  it('空批 / 全非法 → 不写盘；抛错 storage 内存结果照常返回', () => {
    const { store, 桶 } = 假存储();
    expect(addIntentEntries([], '导入', store).条目).toEqual([]);
    expect(桶.has(INTENT_NAMES_STORAGE_KEY)).toBe(false);
    expect(addIntentEntries(['abc'], '导入', 抛错存储).条目).toEqual([]);
    const 结果 = addIntentEntries(['知予'], '导入', 抛错存储);
    expect(结果.新增).toBe(1);
    expect(结果.条目.map((e) => e.名)).toEqual(['知予']);
  });

  it('不可变：不改动既有列表引用', () => {
    const { store, 桶 } = 假存储();
    塞入(桶, [条目('白', '2026-01-01T00:00:00.000Z')]);
    const 先 = loadIntentEntries(store);
    const 后 = addIntentEntries(['知予'], '导入', store).条目;
    expect(先).not.toBe(后);
    expect(先).toHaveLength(1);
    expect(后).toHaveLength(2);
  });
});

describe('removeIntentEntry / clearIntentEntries', () => {
  it('移除命中 → 新数组写盘；其余保序', () => {
    const { store, 桶 } = 假存储();
    塞入(桶, [条目('白', '2026-01-01T00:00:00.000Z'), 条目('知予', '2026-01-02T00:00:00.000Z')]);
    const 结果 = removeIntentEntry('白', store);
    expect(结果).toEqual([条目('知予', '2026-01-02T00:00:00.000Z')]);
    expect(桶.get(INTENT_NAMES_STORAGE_KEY)).toBe(JSON.stringify(结果));
  });

  it('移除不存在 → 原样返回（仍写盘，幂等无害）', () => {
    const { store, 桶 } = 假存储();
    const 原 = [条目('知予', '2026-01-02T00:00:00.000Z')];
    塞入(桶, 原);
    expect(removeIntentEntry('不存在', store)).toEqual(原);
  });

  it('clear → 键删除；无值/抛错均静默', () => {
    const { store, 桶 } = 假存储();
    塞入(桶, [条目('知予', '2026-01-02T00:00:00.000Z')]);
    clearIntentEntries(store);
    expect(桶.has(INTENT_NAMES_STORAGE_KEY)).toBe(false);
    expect(() => clearIntentEntries(假存储().store)).not.toThrow();
    expect(() => clearIntentEntries(抛错存储)).not.toThrow();
  });

  it('remove 在抛错 storage 下静默返回内存结果', () => {
    expect(() => removeIntentEntry('知予', 抛错存储)).not.toThrow();
  });
});
