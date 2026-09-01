/**
 * 契约 C3 前端请求层 —— 无命盘抽卡（纯 TS，不含 React）。
 * 风格对齐 utils/name-eval.ts：POST JSON、AbortSignal 透传、
 * 非 2xx 读 body.error 抛人话 Error（错误体非 JSON 时回退状态码文案）。
 * 响应形状权威源：src/lib/types.ts（ChartResult.candidates）与
 * src/lib/pool/types.ts（PoolStats）；「再抽」由调用方带 排除已选=历批并集 重发
 * （确定性算法，禁前端随机伪装）。
 */
import type { ChartResult, WuXing } from '@/lib/types';
import type { PoolStats } from '@/lib/pool/types';

/** POST /api/draw-names 请求体（契约 C3 zod 形状；缺省字段由服务端 default 兜底）。 */
export interface DrawNamesPayload {
  姓氏: string;
  性别?: '男' | '女';
  名字形式?: '单名' | '双名';
  /** 空/缺=不限五行。 */
  五行偏好?: WuXing[];
  指定字?: { 字: string; 位置?: '任一' | '第一' | '第二' };
  避讳字?: string[];
  禁用字?: string[];
  排除已选?: string[];
  期望候选数?: number;
}

/** 响应 { 候选, 统计 }；池空=空候选（200，非错误）。 */
export interface DrawNamesResult {
  候选: ChartResult['candidates'];
  统计: PoolStats;
}

async function postJson<T>(
  url: string,
  payload: unknown,
  signal: AbortSignal | undefined,
  失败文案: string,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error; // 主动取消原样上抛
    throw new Error(`无法连接${失败文案}服务，请稍后重试。`);
  }
  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null);
    const message =
      body !== null && typeof body === 'object' && 'error' in body && typeof (body as { error: unknown }).error === 'string'
        ? (body as { error: string }).error
        : `${失败文案}失败（HTTP ${res.status}）。`;
    throw new Error(message);
  }
  return (await res.json()) as T;
}

/** 抽一批候选名（确定性：同 payload 同结果；再抽=排除已选增长的新一批）。 */
export async function requestDrawNames(
  payload: DrawNamesPayload,
  signal?: AbortSignal,
): Promise<DrawNamesResult> {
  return postJson<DrawNamesResult>('/api/draw-names', payload, signal, '抽卡');
}
