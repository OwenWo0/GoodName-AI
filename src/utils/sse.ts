/**
 * SSE 帧解析 —— 纯逻辑（不依赖 DOM），供 AI 综解流式消费。
 *
 * 帧协议（与 src/app/api/analyze/route.ts 对齐）：每帧 `data: {...}\n\n`，
 * type=content|reasoning 带 text；type=error 带 message（兼容 text）；`data: [DONE]` 收尾。
 */

export type SseEvent =
  | { kind: 'content'; text: string }
  | { kind: 'reasoning'; text: string }
  | { kind: 'error'; text: string }
  | { kind: 'done' };

interface SseFrameJson {
  type?: unknown;
  text?: unknown;
  message?: unknown;
}

function parseFrame(rawFrame: string): SseEvent | null {
  const dataLine = rawFrame
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith('data:'));
  if (!dataLine) return null;
  const payload = dataLine.slice('data:'.length).trim();
  if (payload === '[DONE]') return { kind: 'done' };
  let json: SseFrameJson;
  try {
    json = JSON.parse(payload) as SseFrameJson;
  } catch {
    return null;
  }
  if (json.type === 'content' || json.type === 'reasoning') {
    return { kind: json.type, text: typeof json.text === 'string' ? json.text : '' };
  }
  if (json.type === 'error') {
    const text = typeof json.message === 'string' ? json.message : typeof json.text === 'string' ? json.text : '未知错误';
    return { kind: 'error', text };
  }
  return null;
}

export interface SseParser {
  /** 投喂一段文本（可能截断于任意位置），返回已完整的帧事件。 */
  feed(chunk: string): SseEvent[];
  /** 流结束后调用：解析残留缓冲中无尾空行的最后一帧。 */
  flush(): SseEvent[];
}

/** 创建有状态增量解析器：跨 chunk 缓冲，按空行分帧。 */
export function createSseParser(): SseParser {
  let buffer = '';
  const drain = (): SseEvent[] => {
    const events: SseEvent[] = [];
    let index = buffer.indexOf('\n\n');
    while (index !== -1) {
      const raw = buffer.slice(0, index);
      buffer = buffer.slice(index + 2);
      const event = parseFrame(raw);
      if (event) events.push(event);
      index = buffer.indexOf('\n\n');
    }
    return events;
  };
  return {
    feed(chunk: string): SseEvent[] {
      buffer += chunk.replace(/\r\n/g, '\n');
      return drain();
    },
    flush(): SseEvent[] {
      const rest = buffer.trim();
      buffer = '';
      if (!rest) return [];
      const event = parseFrame(rest);
      return event ? [event] : [];
    },
  };
}
