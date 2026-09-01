/**
 * POST /api/analyze-names —— 意向吉名 AI 点评的 SSE 流式端点（契约 v2 §5）。
 *
 * 壳与 /api/analyze 逐字节同构（415/413/400/503、深度检查、空闲超时、abort 组合、
 * SSE_HEADERS、帧格式），差异仅在入参 schema 与 prompt 构造：
 *   入参 { 命盘摘要:{四柱[4], 日主, 喜用神, 忌神}, 评估: EvaluatedName[](1..30) }。
 * 帧格式（每帧一 JSON 行）：
 *   data: {"type":"content","text":"…"}      正文增量
 *   data: {"type":"reasoning","text":"…"}    推演增量
 *   data: {"type":"error","message":"…"}     流中错误（中文摘要）
 *   data: [DONE]                              结束哨兵
 */
import { buildNameEvalMessages, nameEvalRequestSchema, type NameEvalInput } from '@/lib/ai/prompt-names';
import { createChatClient, getLlmEnv, streamAnalyzeEvents } from '@/lib/ai/client';
import type { AnalyzeEvent } from '@/lib/ai/client';

/** 请求体上限：1MB（评估 JSON 远小于此，超限视为异常请求）。 */
const MAX_BODY_BYTES = 1024 * 1024;
/** 嵌套深度上限：同 analyze 壳——深嵌套 JSON 可把 stableStringify 打进栈溢出。 */
const MAX_DEPTH = 64;
/** 上游空闲超时：两帧间隔超此值即中止，防信号传播失效时连接+token 双泄漏。 */
const 空闲超时毫秒 = 90_000;

/** 迭代式深度检查（防构造超深对象炸调用栈）。 */
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
  // 只认 application/json：防 text/plain/x-www-form-urlencoded 跨站简单请求盲打
  if (!(req.headers.get('content-type') ?? '').toLowerCase().includes('application/json')) {
    return jsonError(415, 'Content-Type 须为 application/json。');
  }
  const declared = Number(req.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return jsonError(413, '请求体过大（上限 1MB）。');
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

  const parsedBody = nameEvalRequestSchema.safeParse(parsed);
  if (!parsedBody.success) {
    return jsonError(
      400,
      '请求体不符合要求：需含 命盘摘要（四柱 4 项、日主、喜用神、忌神）与 评估（1-30 条，评估引擎产物）。',
    );
  }
  // 浅校验后按契约类型使用：评估数组由我方算法层产出，字段深校验责任在产出方。
  const input = parsedBody.data as unknown as NameEvalInput;

  let env;
  try {
    env = getLlmEnv();
  } catch {
    return jsonError(503, '服务端未配置大模型端点（缺少 LLM_* 环境变量），暂无法提供 AI 意向名点评。');
  }

  const messages = buildNameEvalMessages(input);
  const encoder = new TextEncoder();
  const doneFrame = encoder.encode('data: [DONE]\n\n');

  // 中止组合：客户端断开 ∥ 空闲超时 → abort 上游（信号传播失效也要能掐断）
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
        if (controller.desiredSize === null) return; // 流已取消：enqueue 会抛 TypeError
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
        // 不外泄底层错误细节，仅记中文摘要（不发 console.error 原始 error）
        process.stderr.write('意向名点评接口：大模型调用失败（客户端中断或上游错误）\n');
        发送(formatSse({ type: 'error', message: '大模型调用失败，请稍后重试。' }));
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
      // 下游（客户端）取消：掐上游，防连接+token 泄漏
      clearTimeout(空闲定时器);
      上游中止.abort(new Error('客户端断开'));
    },
  });

  return new Response(streamBody, { headers: SSE_HEADERS });
}
