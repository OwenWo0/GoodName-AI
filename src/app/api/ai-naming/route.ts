/**
 * POST /api/ai-naming —— AI 终选起名（匠心五荐）SSE 流式端点
 *
 * 入参：ChartResult JSON + 可选 意向吉名 / 意向评估
 * 出参：text/event-stream，流式输出包含 5 个终选名字与深度解析的 Markdown 内容。
 */
import { z } from 'zod';
import type { ChartResult } from '@/lib/types';
import type { EvaluatedName } from '@/lib/evaluate/types';
import { buildFinalNamingMessages } from '@/lib/ai/prompt-final-naming';
import { createChatClient, getLlmEnv, streamAnalyzeEvents, type AnalyzeEvent } from '@/lib/ai/client';

const MAX_BODY_BYTES = 1024 * 1024;
const MAX_DEPTH = 64;
const MAX_CANDIDATES = 500;
const 空闲超时毫秒 = 90_000;

const namingShallowSchema = z
  .object({
    bazi: z.record(z.string(), z.unknown()),
    xiyongshen: z.record(z.string(), z.unknown()),
    candidates: z.array(z.unknown()).max(MAX_CANDIDATES).optional(),
  })
  .passthrough();

const 起名偏好Schema = z
  .string({ error: '起名偏好须为文本。' })
  .transform((s) => s.trim())
  .refine((s) => s.length <= 500, { error: '起名偏好过长（上限 500 字）。' })
  .optional();

function 深度超限(v: unknown, max: number): boolean {
  const stack: Array<{ node: unknown; depth: number }> = [{ node: v, depth: 0 }];
  while (stack.length > 0) {
    const { node, depth } = stack.pop()!;
    if (depth > max) return true;
    if (Array.isArray(node)) {
      for (const x of node) stack.push({ node: x, depth: depth + 1 });
    } else if (node !== null && typeof node === 'object') {
      for (const x of Object.values(node)) stack.push({ node: x, depth: depth + 1 });
    }
  }
  return false;
}

function jsonError(status: number, message: string): Response {
  return Response.json({ success: false, error: message }, { status });
}

function formatSse(event: AnalyzeEvent | { type: 'error'; message: string }): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
} as const;

export async function POST(req: Request): Promise<Response> {
  if (!(req.headers.get('content-type') ?? '').toLowerCase().includes('application/json')) {
    return jsonError(415, 'Content-Type 须为 application/json。');
  }

  let bodyText: string;
  try {
    const buffer = await req.arrayBuffer();
    if (buffer.byteLength > MAX_BODY_BYTES) {
      return jsonError(413, '请求体过大（上限 1MB）。');
    }
    bodyText = new TextDecoder().decode(buffer);
  } catch {
    return jsonError(400, '读取请求体失败。');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    return jsonError(400, '请求体不是合法 JSON。');
  }

  if (深度超限(parsed, MAX_DEPTH)) {
    return jsonError(400, '请求体嵌套过深。');
  }

  const parsedChart = namingShallowSchema.safeParse(parsed);
  if (!parsedChart.success) {
    return jsonError(400, '请求体缺少必要字段：需包含 bazi 与 xiyongshen。');
  }

  const rawData = parsedChart.data as Record<string, unknown>;
  const 意向吉名 = rawData.意向吉名 as string[] | undefined;
  const 意向评估 = rawData.意向评估 as EvaluatedName[] | undefined;
  const chart = rawData as unknown as ChartResult;

  const 偏好解析 = 起名偏好Schema.safeParse(rawData.起名偏好);
  if (!偏好解析.success) {
    return jsonError(400, 偏好解析.error.issues[0]?.message ?? '起名偏好不合法。');
  }
  const 起名偏好 = 偏好解析.data && 偏好解析.data.length > 0 ? 偏好解析.data : undefined;

  let env;
  try {
    env = getLlmEnv();
  } catch {
    return jsonError(503, '服务端未配置大模型端点（缺少 LLM_* 环境变量），暂无法提供 AI 终选起名。');
  }

  const messages = buildFinalNamingMessages(
    {
      chart,
      意向名单: 意向吉名,
      意向评估,
    },
    起名偏好,
  );

  const encoder = new TextEncoder();
  const doneFrame = encoder.encode('data: [DONE]\n\n');

  const 上游中止 = new AbortController();
  if (req.signal.aborted) 上游中止.abort(req.signal.reason);
  else req.signal.addEventListener('abort', () => 上游中止.abort(req.signal.reason), { once: true });

  let 空闲定时器: ReturnType<typeof setTimeout> | undefined;
  const 重置空闲 = (): void => {
    clearTimeout(空闲定时器);
    空闲定时器 = setTimeout(() => 上游中止.abort(new Error('大模型响应超时')), 空闲超时毫秒);
  };

  const streamBody = new ReadableStream<Uint8Array>({
    async start(controller) {
      const 发送 = (frame: string | Uint8Array): void => {
        if (controller.desiredSize === null) return;
        try {
          controller.enqueue(typeof frame === 'string' ? encoder.encode(frame) : frame);
        } catch {
          /* 取消竞态，静默丢弃 */
        }
      };
      try {
        重置空闲();
        for await (const event of streamAnalyzeEvents(messages, createChatClient(env), env.model, 上游中止.signal)) {
          重置空闲();
          发送(formatSse(event));
        }
      } catch {
        process.stderr.write('AI 终选起名接口：大模型调用失败（客户端中断或上游错误）\n');
        发送(formatSse({ type: 'error', message: '大模型起名推演失败，请稍后重试。' }));
      } finally {
        clearTimeout(空闲定时器);
      }
      发送(doneFrame);
      try {
        controller.close();
      } catch {
        /* 已取消 */
      }
    },
    cancel() {
      clearTimeout(空闲定时器);
      上游中止.abort(new Error('客户端断开'));
    },
  });

  return new Response(streamBody, { headers: SSE_HEADERS });
}
