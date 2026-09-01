/**
 * 跨页草稿记忆（契约 C1）——sessionStorage 版，纯函数模块，零 React、零顶层副作用。
 *
 * 范式对齐 form-storage.ts：KEY 含项目名前缀（v1=形状版本）；storage 参数注入
 * （单测喂内存 Map 假 storage），缺省 globalThis.sessionStorage——SSR/隐私模式
 * 访问抛错时 load→null、save 静默，全部 throw-free（记忆是锦上添花，绝不打断主流程）。
 * 用途：/paipan 排盘成功后暂存最近一盘与最近输入，供 /jiming（吉名匹配）等页回读，
 * 会话级生命周期（关标签页即弃），不落 localStorage、不上传服务器。
 */
import { z } from 'zod';
import type { ChartResult } from '@/lib/types';
import type { SnapshotStorage } from './form-storage';

/** 最近一盘键（前缀含项目名，v1=形状版本）。 */
export const LAST_CHART_STORAGE_KEY = '问名手卷.LastChart.v1';

/** 最近输入键。 */
export const LAST_INPUT_STORAGE_KEY = '问名手卷.LastInput.v1';

/** 最近输入形状（契约 C1：三键浅形状，zod 浅校验非法→null）。 */
export const lastInputSchema = z.object({
  姓氏: z.string(),
  性别: z.enum(['男', '女']),
  名字形式: z.enum(['单名', '双名']),
});

export type LastInput = z.infer<typeof lastInputSchema>;

/** 缺省解析：undefined → globalThis.sessionStorage；SSR/禁用存储访问抛错 → null（调用侧静默降级）。 */
function 定位会话存储(storage: SnapshotStorage | undefined): SnapshotStorage | null {
  if (storage !== undefined) return storage;
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null; // 部分环境访问 sessionStorage 直接 SecurityError（如禁 Cookie 的 iframe）
  }
}

/**
 * 盘浅守卫（纯函数，写读共用）：只认「输入.姓氏:string 且 candidates:array」两键——
 * ChartResult 形状庞大由服务端契约保证，本机回读只做防脏兜底，不做全量 zod 深校验。
 */
function 是合法盘形状(c: unknown): c is ChartResult {
  if (typeof c !== 'object' || c === null) return false;
  const 盘 = c as { 输入?: unknown; candidates?: unknown };
  const 输入 = 盘.输入;
  return (
    typeof 输入 === 'object' &&
    输入 !== null &&
    typeof (输入 as { 姓氏?: unknown }).姓氏 === 'string' &&
    Array.isArray(盘.candidates)
  );
}

/** 写最近一盘：先浅守卫（形状不符即弃不写），存储不可用/配额满静默。 */
export function saveLastChart(c: unknown, storage?: SnapshotStorage): void {
  if (!是合法盘形状(c)) return;
  const store = 定位会话存储(storage);
  if (store === null) return;
  try {
    store.setItem(LAST_CHART_STORAGE_KEY, JSON.stringify(c));
  } catch {
    // 静默：隐私模式配额为 0 / 容量满等，均不影响排盘主流程
  }
}

/** 读最近一盘：无值 / JSON 损坏 / 浅守卫不符一律 null（损坏即弃——宁丢记忆不喂脏数据）。 */
export function loadLastChart(storage?: SnapshotStorage): ChartResult | null {
  const store = 定位会话存储(storage);
  if (store === null) return null;
  let raw: string | null;
  try {
    raw = store.getItem(LAST_CHART_STORAGE_KEY);
  } catch {
    return null;
  }
  if (raw === null || raw === '') return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  return 是合法盘形状(data) ? data : null;
}

/** 写最近输入（浅三键），存储不可用静默。 */
export function saveLastInput(i: LastInput, storage?: SnapshotStorage): void {
  const store = 定位会话存储(storage);
  if (store === null) return;
  try {
    store.setItem(LAST_INPUT_STORAGE_KEY, JSON.stringify(i));
  } catch {
    // 静默，同上
  }
}

/** 读最近输入：无值 / JSON 损坏 / zod 浅校验不符 → null。 */
export function loadLastInput(storage?: SnapshotStorage): LastInput | null {
  const store = 定位会话存储(storage);
  if (store === null) return null;
  let raw: string | null;
  try {
    raw = store.getItem(LAST_INPUT_STORAGE_KEY);
  } catch {
    return null;
  }
  if (raw === null || raw === '') return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  const parsed = lastInputSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}
