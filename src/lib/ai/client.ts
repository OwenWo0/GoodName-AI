/**
 * AI 解读层 · LLM 客户端 —— OpenAI 兼容端点（Qwen），流式增量。
 *
 * env 命名沿用 .env.example：LLM_API_BASE_URL / LLM_API_KEY / LLM_MODEL。
 * 真实密钥只从环境变量读取，绝不写死；缺配置时抛中文 Error（不打印）。
 *
 * 可注入点：streamAnalyzeEvents / createChatClient 接受显式配置与 client，
 * 测试注入假 client，不发真实网络请求；streamAnalyze 是「读 env + 只吐正文增量」的薄封装。
 */
import OpenAI from 'openai';
import type { ChatMessage } from '@/lib/ai/prompt';

/** 双流事件：content=正文，reasoning=推演过程（Qwen 思考通道，供 UI 显示「推演中」）。 */
export interface AnalyzeEvent {
  type: 'content' | 'reasoning';
  text: string;
}

/** LLM 端点配置（全部来自 env）。 */
export interface LlmEnv {
  baseURL: string;
  apiKey: string;
  model: string;
}

/**
 * 最小结构化 client 接口：只声明用到的 chat.completions.create。
 * openai 的 OpenAI 实例结构上可赋值（方法参数双变性），测试可注入假实现。
 */
export interface ChatClientLike {
  chat: {
    completions: {
      create(
        body: unknown,
        options?: { signal?: AbortSignal | null },
      ): Promise<AsyncIterable<unknown>>;
    };
  };
}

/** 流式 chunk 中我们关心的部分（reasoning_content 为 Qwen 兼容端点扩展字段，SDK 类型未含）。 */
interface StreamChunkShape {
  choices?: Array<{
    delta?: { content?: string | null; reasoning_content?: string | null };
  }>;
}

/** 读取并校验 LLM 环境变量；缺失时抛中文 Error。env 可注入以便测试。 */
export function getLlmEnv(env: Record<string, string | undefined> = process.env): LlmEnv {
  const baseURL = env.LLM_API_BASE_URL?.trim() ?? '';
  const apiKey = env.LLM_API_KEY?.trim() ?? '';
  const model = env.LLM_MODEL?.trim() ?? '';
  const missing: string[] = [];
  if (!baseURL) missing.push('LLM_API_BASE_URL');
  if (!apiKey) missing.push('LLM_API_KEY');
  if (!model) missing.push('LLM_MODEL');
  if (missing.length > 0) {
    throw new Error(`缺少环境变量：${missing.join('、')}。请在 .env 中配置 OpenAI 兼容端点（参考 .env.example）。`);
  }
  return { baseURL, apiKey, model };
}

/** 用给定配置创建 OpenAI 兼容客户端。 */
export function createChatClient(env: LlmEnv): OpenAI {
  return new OpenAI({
    apiKey: env.apiKey,
    baseURL: env.baseURL,
    maxRetries: 1,
  });
}

/** 把底层错误包装为中文 Error；不携带密钥等敏感细节，只保留有界摘要。 */
function wrapLlmError(error: unknown): Error {
  if (error instanceof Error && error.name === 'AbortError') {
    return new Error('大模型请求已被取消。');
  }
  const raw = error instanceof Error ? error.message : String(error);
  const brief = raw.slice(0, 200);
  return new Error(`调用大模型失败：${brief}`);
}

/**
 * 双流流式解读：逐块 yield 正文/推演增量。
 * client 与 model 显式传入（依赖注入点）；signal 透传给 SDK 以支持中断。
 */
export async function* streamAnalyzeEvents(
  messages: readonly ChatMessage[],
  client: ChatClientLike,
  model: string,
  signal?: AbortSignal,
): AsyncGenerator<AnalyzeEvent> {
  let stream: AsyncIterable<unknown>;
  try {
    stream = await client.chat.completions.create(
      {
        model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        stream: true,
        // 解读场景不需要深推理：effort 降 low，省思考 token、加快首字（用户拍板 2026-08-29）。
        reasoning_effort: 'low',
      },
      { signal: signal ?? null },
    );
  } catch (error) {
    throw wrapLlmError(error);
  }
  try {
    for await (const raw of stream) {
      const delta = (raw as StreamChunkShape).choices?.[0]?.delta;
      if (!delta) continue;
      if (delta.reasoning_content) {
        yield { type: 'reasoning', text: delta.reasoning_content };
      }
      if (delta.content) {
        yield { type: 'content', text: delta.content };
      }
    }
  } catch (error) {
    throw wrapLlmError(error);
  }
}

/**
 * 任务契约 API：streamAnalyze(messages, signal?) → AsyncIterable<string>。
 * 读 env 建 client，只 yield 正文（content）增量；推演通道由 streamAnalyzeEvents 提供。
 */
export async function* streamAnalyze(
  messages: readonly ChatMessage[],
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const env = getLlmEnv();
  const client = createChatClient(env);
  for await (const event of streamAnalyzeEvents(messages, client, env.model, signal)) {
    if (event.type === 'content') {
      yield event.text;
    }
  }
}
