/**
 * 表单输入的本机记忆（任务 #29）——纯函数模块，零 React、零顶层副作用。
 *
 * 契约：KEY 含项目名前缀（问名手卷.表单.v1），换结构升版本号即可无痛废弃旧档；
 * storage 参数注入（单测喂假 storage），缺省走 globalThis.localStorage——
 * SSR 下 localStorage 不存在/访问抛错（隐私模式），load 返回 null、save/clear 静默。
 * 读取三道防线：无值→null；JSON 损坏→静默 null；形状不符 zod 浅校验→null。
 * 字段清单=表单 FormState（input-form.tsx 直接以此类型别名为 FormState，单一事实源）。
 * 隐私口径：数据仅存本机浏览器，不上传服务器；提交时写入，「清除记忆输入」一键删除。
 */
import { z } from 'zod';

/** localStorage 键（前缀含项目名，v1=形状版本）。 */
export const FORM_STORAGE_KEY = '问名手卷.表单.v1';

/** 快照形状：与表单字段一一对应（原始控件值形态，日期/时间均为字符串，提交时才组装 payload）。 */
export const formSnapshotSchema = z.object({
  姓氏: z.string(),
  母亲姓氏: z.string(),
  名字草案: z.string(),
  性别: z.enum(['男', '女']),
  历法: z.enum(['阳历', '农历']),
  闰月: z.boolean(),
  出生日期: z.string(),
  时辰未知: z.boolean(),
  出生时间: z.string(),
  城市: z.string(),
  经度: z.string(),
  使用真太阳时: z.boolean(),
  夏令时: z.boolean(),
  名字形式: z.enum(['单名', '双名']),
  启用辈字: z.boolean(),
  辈字: z.string(),
  辈字位置: z.enum(['第一', '第二']),
  // 指定字（契约 v3 §1.5）：default 必须写进 schema——无 default 则旧快照（v1 时期）缺这两键
  // = 必填键缺失，safeParse 整份作废丢光旧记忆；带 default 才「旧记忆照常 load、新键取默认」。KEY 不 bump。
  指定字文本: z.string().default(''),
  指定字位置: z.enum(['任一', '第一', '第二']).default('任一'),
  避讳字文本: z.string(),
  禁用字文本: z.string(),
});

export type FormSnapshot = z.infer<typeof formSnapshotSchema>;

/** 注入点形状：只取用到的三方法，假 storage 无须实现 Storage 全集。 */
export interface SnapshotStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

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
export function loadFormSnapshot(storage?: SnapshotStorage): FormSnapshot | null {
  const store = 定位存储(storage);
  if (store === null) return null;
  let raw: string | null;
  try {
    raw = store.getItem(FORM_STORAGE_KEY);
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
  const parsed = formSnapshotSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

/** 写快照：存储不可用/配额满静默（记忆是锦上添花，绝不打断排盘主流程）。 */
export function saveFormSnapshot(snapshot: FormSnapshot, storage?: SnapshotStorage): void {
  const store = 定位存储(storage);
  if (store === null) return;
  try {
    store.setItem(FORM_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // 静默：隐私模式配额为 0 / 磁盘满等，均不影响本次排盘
  }
}

/** 清快照（「清除记忆输入」按钮语义）：幂等，无值/不可用均静默。 */
export function clearFormSnapshot(storage?: SnapshotStorage): void {
  const store = 定位存储(storage);
  if (store === null) return;
  try {
    store.removeItem(FORM_STORAGE_KEY);
  } catch {
    // 静默，同上
  }
}
