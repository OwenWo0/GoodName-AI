/**
 * 抽卡赛道（/draw）表单的本机记忆——纯函数模块，零 React、零顶层副作用。
 * 范式镜像 form-storage.ts（任务 #29）：KEY 含项目名前缀 + 版本号；
 * storage 参数注入（单测喂假 storage），缺省走 globalThis.localStorage——
 * SSR 下 localStorage 不存在/访问抛错（隐私模式），load 返回 null、save/clear 静默。
 * 读取三道防线：无值→null；JSON 损坏→静默 null；形状不符 zod 浅校验→null。
 * 与主表单（问名手卷.表单.v1）分键分形状：赛道二字段独立演进，互不污染。
 * 隐私口径：数据仅存本机浏览器，不上传服务器；提交成功时写入，「清除记忆输入」一键删除。
 */
import { z } from 'zod';
import type { SnapshotStorage } from './form-storage';

/** localStorage 键（前缀含项目名，v1=形状版本）。 */
export const DRAW_FORM_STORAGE_KEY = '问名手卷.抽卡表单.v1';

/** 快照形状：与抽卡表单字段一一对应（原始控件值形态，提交时才组装 payload）。 */
export const drawFormSnapshotSchema = z.object({
  姓氏: z.string(),
  性别: z.enum(['男', '女']),
  名字形式: z.enum(['单名', '双名']),
  指定字文本: z.string(),
  指定字位置: z.enum(['任一', '第一', '第二']),
  避讳字文本: z.string(),
  禁用字文本: z.string(),
});

export type DrawFormSnapshot = z.infer<typeof drawFormSnapshotSchema>;

/** 缺省解析：undefined → globalThis.localStorage；SSR/禁用存储访问抛错 → null（调用侧静默降级）。 */
function 定位存储(storage: SnapshotStorage | undefined): SnapshotStorage | null {
  if (storage !== undefined) return storage;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // 部分环境访问 localStorage 直接 SecurityError（如禁 Cookie 的 iframe）
  }
}

/** 读快照：无值 / JSON 损坏 / 形状不符一律 null（损坏即弃——宁丢记忆不喂脏数据）。 */
export function loadDrawFormSnapshot(storage?: SnapshotStorage): DrawFormSnapshot | null {
  const store = 定位存储(storage);
  if (store === null) return null;
  let raw: string | null;
  try {
    raw = store.getItem(DRAW_FORM_STORAGE_KEY);
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
  const parsed = drawFormSnapshotSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

/** 写快照：存储不可用/配额满静默（记忆是锦上添花，绝不打断抽卡主流程）。 */
export function saveDrawFormSnapshot(snapshot: DrawFormSnapshot, storage?: SnapshotStorage): void {
  const store = 定位存储(storage);
  if (store === null) return;
  try {
    store.setItem(DRAW_FORM_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // 静默：隐私模式配额为 0 / 磁盘满等，均不影响本次抽卡
  }
}

/** 清快照（「清除记忆输入」按钮语义）：幂等，无值/不可用均静默。 */
export function clearDrawFormSnapshot(storage?: SnapshotStorage): void {
  const store = 定位存储(storage);
  if (store === null) return;
  try {
    store.removeItem(DRAW_FORM_STORAGE_KEY);
  } catch {
    // 静默，同上
  }
}
