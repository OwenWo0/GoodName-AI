/**
 * 契约 v2 §6 前端请求层 —— 任意名评估 / 名人匹配（纯 TS，不含 React）。
 * 风格对齐 chart-source.requestChart：POST JSON、AbortSignal 透传、
 * 非 2xx 读 body.error 抛人话 Error（错误体非 JSON 时回退状态码文案）。
 * 响应形状权威源：src/lib/evaluate/types.ts、src/lib/mingren/types.ts（lead 冻结）。
 */
import type { EvaluatedName } from '@/lib/evaluate/types';
import type { MingrenMatchResult } from '@/lib/mingren/types';
import type { WuXing, XiyongMingXiItem } from '@/lib/types';

/** POST /api/evaluate-names 请求体（契约 §3 zod 形状）。 */
export interface EvaluateNamesPayload {
  姓氏: string;
  /** 名部（不含姓）列表，1..30 项。 */
  名字列表: string[];
  喜用神: WuXing[];
  忌神: WuXing[];
  喜用神明细?: XiyongMingXiItem[];
  避讳字?: string[];
}

/** POST /api/mingren-match 请求体（契约 v3 §4.2 zod 形状；上限默认 200，max 500；前端不传=全量）。 */
export interface MingrenMatchPayload {
  姓氏: string;
  性别: '男' | '女';
  名字形式: '单名' | '双名';
  喜用神: WuXing[];
  忌神: WuXing[];
  喜用神明细?: XiyongMingXiItem[];
  避讳字?: string[];
  禁用字?: string[];
  排除已选?: string[];
  上限?: number;
}

async function postJson<T>(url: string, payload: unknown, signal: AbortSignal | undefined, 失败文案: string): Promise<T> {
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

/** 评估任意意向名。响应 { 评估 }（契约 v2，route 直接 Response.json({ 评估 })）——只取 评估。 */
export async function requestEvaluateNames(
  payload: EvaluateNamesPayload,
  signal?: AbortSignal,
): Promise<EvaluatedName[]> {
  const body = await postJson<{ 评估: EvaluatedName[] }>('/api/evaluate-names', payload, signal, '名字评估');
  return body.评估;
}

/** 名人吉名匹配（按名部），返回候选 + 库规模/命中名数诊断。 */
export async function requestMingrenMatch(
  payload: MingrenMatchPayload,
  signal?: AbortSignal,
): Promise<MingrenMatchResult> {
  return postJson<MingrenMatchResult>('/api/mingren-match', payload, signal, '名人匹配');
}
