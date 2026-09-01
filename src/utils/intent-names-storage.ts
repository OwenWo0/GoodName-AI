/**
 * 意向吉名本机记忆（契约 v2 §2）——纯函数模块，零 React、零顶层副作用。
 *
 * 范式对齐 form-storage.ts：KEY 含项目名前缀（问名手卷.意向吉名.v1）；
 * storage 参数注入（单测喂内存 Map 假 storage），缺省 globalThis.localStorage——
 * SSR/隐私模式访问抛错时 load→[]、写/删静默。读取三道防线：无值→[]；
 * JSON 损坏→[]；形状不符 zod 浅校验→[]（损坏即弃，宁丢记忆不喂脏数据）。
 * 不可变纪律：add/remove 一律返回新数组新对象，绝不原地改。
 * 列表规整（load/add 共用）：按名去重（保留最早「添加于」）、上限 60 裁最旧。
 * 隐私口径：意向名仅存本机浏览器，不上传服务器。
 */
import { z } from 'zod';
import type { SnapshotStorage } from './form-storage';

/** localStorage 键（前缀含项目名，v1=形状版本）。 */
export const INTENT_NAMES_STORAGE_KEY = '问名手卷.意向吉名.v1';

/** 列表上限（契约 §2：前端 UI 上限 60；服务端名单上限 100 另见 EVALUATE_NAMES_MAX，满编 60 可一程送评）。 */
export const INTENT_NAMES_MAX = 60;

/** 名部合法性单一来源（schema 与批量导入解析共用）：1-2 个 CJK 基本区汉字。 */
export const HAN_NAME_PATTERN = /^[一-鿿]{1,2}$/;

/** 单条意向名（名=名部不含姓，与候选/草案口径一致）。 */
export const intentEntrySchema = z.object({
  名: z.string().regex(HAN_NAME_PATTERN, '名须为 1-2 个汉字'),
  来源: z.enum(['草案', '点赞', '导入']),
  添加于: z.string(),
});

export type IntentEntry = z.infer<typeof intentEntrySchema>;
export type Intent来源 = IntentEntry['来源'];

/** 缺省解析：undefined → globalThis.localStorage；SSR/禁用存储访问抛错 → null（调用侧静默降级）。 */
function 定位存储(storage: SnapshotStorage | undefined): SnapshotStorage | null {
  if (storage !== undefined) return storage;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // 禁 Cookie 的 iframe 等环境访问即 SecurityError
  }
}

/** 列表规整（纯函数）：按名去重保最早添加于（同刻保先入者）→ 超上限裁最旧（同刻先入先裁）。 */
function 规整(条目: readonly IntentEntry[]): IntentEntry[] {
  const 按名 = new Map<string, IntentEntry>();
  for (const e of 条目) {
    const 已有 = 按名.get(e.名);
    // ISO（UTC Z 后缀）字典序即时间序；仅在严格更早时替换 → 同刻保留先入者
    if (已有 === undefined || e.添加于 < 已有.添加于) 按名.set(e.名, e);
  }
  const 去重后 = [...按名.values()];
  if (去重后.length <= INTENT_NAMES_MAX) return 去重后;
  const 多余 = 去重后.length - INTENT_NAMES_MAX;
  // 稳定排序升序取前「多余」个为最旧（Array.sort 稳定 → 同刻按插入序裁头）
  const 待删 = new Set(
    [...去重后].sort((a, b) => (a.添加于 < b.添加于 ? -1 : a.添加于 > b.添加于 ? 1 : 0)).slice(0, 多余),
  );
  return 去重后.filter((e) => !待删.has(e));
}

/** 静默写盘：存储不可用/配额满不影响内存返回值（记忆是锦上添花，不打断主流程）。 */
function 写盘(条目: readonly IntentEntry[], storage: SnapshotStorage | null): void {
  if (storage === null) return;
  try {
    storage.setItem(INTENT_NAMES_STORAGE_KEY, JSON.stringify(条目));
  } catch {
    // 静默：隐私模式配额 0 / 磁盘满等
  }
}

/**
 * 读意向列表：无值 / JSON 损坏 / 形状不符一律 []（三道防线，永不 throw）；
 * 合法数据再经规整（去重保最早 + 上限裁最旧）。只读不写盘。
 */
export function loadIntentEntries(storage?: SnapshotStorage): IntentEntry[] {
  const store = 定位存储(storage);
  if (store === null) return [];
  let raw: string | null;
  try {
    raw = store.getItem(INTENT_NAMES_STORAGE_KEY);
  } catch {
    return [];
  }
  if (raw === null || raw === '') return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  const parsed = z.array(intentEntrySchema).safeParse(data);
  return parsed.success ? 规整(parsed.data) : [];
}

/** addIntentEntry 返回：是否已存在（重名不重复入列）+ 规整后的最新列表（内存镜像，供 setState）。 */
export interface 加入结果 {
  已存在: boolean;
  条目: IntentEntry[];
}

/**
 * 追加意向名（不可变）：非法名（非 1-2 汉字）静默忽略——防御 UI 误传，
 * 返回现列表；已存在 → 原列表原样返回（不刷新「添加于」）；
 * 否则追加新对象并规整（可能裁掉最旧者）后写盘。
 */
export function addIntentEntry(
  名: string,
  来源: Intent来源,
  storage?: SnapshotStorage,
): 加入结果 {
  const store = 定位存储(storage);
  const 现列表 = loadIntentEntries(storage);
  const 校验 = intentEntrySchema.safeParse({ 名, 来源, 添加于: '' });
  if (!校验.success) return { 已存在: false, 条目: 现列表 };
  if (现列表.some((e) => e.名 === 名)) return { 已存在: true, 条目: 现列表 };
  const 新条目: IntentEntry = { 名, 来源, 添加于: new Date().toISOString() };
  const 结果 = 规整([...现列表, 新条目]);
  写盘(结果, store);
  return { 已存在: false, 条目: 结果 };
}

/** addIntentEntries 返回：三类分流计数 + 最新列表（内存镜像，供 setState；无效名静默跳过）。 */
export interface 批量加入结果 {
  条目: IntentEntry[];
  新增: number;
  已存在: number;
  /** 超上限被丢弃的尾部新名数（只填剩余容量，绝不裁最旧既有名——静默淘汰既有点赞名比丢新尾巴恶劣）。 */
  满编丢弃: number;
}

/**
 * 批量追加意向名（导入面板入口，不可变、单次写盘）：批内去重保序 →
 * 批外（现列表）重名计「已存在」→ 只填剩余容量、丢尾部（既有 ≤60 条永不动，
 * 与 addIntentEntry 的「规整裁最旧」刻意不同：导入是突发批量，裁旧=毁用户记忆）。
 */
export function addIntentEntries(
  名列表: readonly string[],
  来源: Intent来源,
  storage?: SnapshotStorage,
): 批量加入结果 {
  const store = 定位存储(storage);
  const 现列表 = loadIntentEntries(storage);
  const 已在 = new Set(现列表.map((e) => e.名));
  const 批内 = new Set<string>();
  const 可加: IntentEntry[] = [];
  let 已存在 = 0;
  const 添加于 = new Date().toISOString();
  for (const 名 of 名列表) {
    if (!intentEntrySchema.safeParse({ 名, 来源, 添加于 }).success) continue; // 非法名静默跳过，同 addIntentEntry
    if (批内.has(名)) continue; // 批内重名去重保先（先判再分流 → 每唯一名至多计一类一次）
    批内.add(名);
    if (已在.has(名)) {
      已存在 += 1;
      continue;
    }
    可加.push({ 名, 来源, 添加于 });
  }
  const 剩余额度 = Math.max(INTENT_NAMES_MAX - 现列表.length, 0);
  const 收下 = 可加.slice(0, 剩余额度);
  const 满编丢弃 = 可加.length - 收下.length;
  if (收下.length === 0) return { 条目: 现列表, 新增: 0, 已存在, 满编丢弃 };
  const 条目 = [...现列表, ...收下];
  写盘(条目, store);
  return { 条目, 新增: 收下.length, 已存在, 满编丢弃 };
}

/** 移除意向名（不可变）：不存在则原样返回；写盘静默。返回最新列表。 */
export function removeIntentEntry(名: string, storage?: SnapshotStorage): IntentEntry[] {
  const store = 定位存储(storage);
  const 结果 = loadIntentEntries(storage).filter((e) => e.名 !== 名);
  写盘(结果, store);
  return 结果;
}

/** 清空意向（幂等）：无值/存储不可用均静默。 */
export function clearIntentEntries(storage?: SnapshotStorage): void {
  const store = 定位存储(storage);
  if (store === null) return;
  try {
    store.removeItem(INTENT_NAMES_STORAGE_KEY);
  } catch {
    // 静默，同 form-storage
  }
}
