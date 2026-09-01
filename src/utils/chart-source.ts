/**
 * 排盘数据来源切换点 —— 集成唯一开关。
 *
 * 现状：/api/chart 已上线（81c0fc9），USE_MOCK_CHART=false 走真端点。
 * fixture（mock-chart.ts）保留作单测素材；调试离线 UI 可临时翻 true。
 */
import type { ChartRequest } from './chart-request';
import { mockChart, type ChartResultForUi } from './mock-chart';

/** 集成开关：true = 返回 fixture（离线开发/单测），false = POST /api/chart。 */
export const USE_MOCK_CHART = false;

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('已取消排盘请求', 'AbortError'));
      },
      { once: true },
    );
  });
}

/**
 * 提交排盘请求，返回排盘结果。网络失败/非 2xx 抛中文可读 Error。
 */
export async function requestChart(req: ChartRequest, signal?: AbortSignal): Promise<ChartResultForUi> {
  if (USE_MOCK_CHART) {
    await delay(400, signal);
    return mockChart;
  }
  let res: Response;
  try {
    res = await fetch('/api/chart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new Error('无法连接排盘服务，请稍后重试。');
  }
  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null);
    const message =
      body !== null && typeof body === 'object' && 'error' in body && typeof (body as { error: unknown }).error === 'string'
        ? (body as { error: string }).error
        : `排盘失败（HTTP ${res.status}）。`;
    throw new Error(message);
  }
  return (await res.json()) as ChartResultForUi;
}
