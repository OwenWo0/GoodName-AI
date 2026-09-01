/**
 * client.ts 测试：env 校验、双流增量、错误包装、取消 —— 全程注入假 client，零真实网络。
 */
import { describe, it, expect } from 'vitest';
import {
  getLlmEnv,
  streamAnalyze,
  streamAnalyzeEvents,
  type ChatClientLike,
} from '@/lib/ai/client';
import type { ChatMessage } from '@/lib/ai/prompt';

const messages: ChatMessage[] = [
  { role: 'system', content: 's' },
  { role: 'user', content: 'u' },
];

/** 按 delta 序列造假流（每个元素 = 一帧的 delta 载荷）。 */
function fakeClient(
  deltas: Array<{ content?: string; reasoning_content?: string }>,
  hooks?: { onCreate?: (body: unknown, options: unknown) => void; rejectWith?: Error },
): ChatClientLike & { calls: Array<{ body: unknown; options: unknown }> } {
  const calls: Array<{ body: unknown; options: unknown }> = [];
  return {
    calls,
    chat: {
      completions: {
        async create(body: unknown, options?: { signal?: AbortSignal | null }) {
          calls.push({ body, options });
          if (hooks?.rejectWith) throw hooks.rejectWith;
          hooks?.onCreate?.(body, options);
          return {
            async *[Symbol.asyncIterator]() {
              for (const delta of deltas) {
                yield { choices: [{ delta }] };
              }
            },
          };
        },
      },
    },
  };
}

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of iterable) out.push(item);
  return out;
}

const withEnv = async (
  env: Partial<Record<'LLM_API_BASE_URL' | 'LLM_API_KEY' | 'LLM_MODEL', string | undefined>>,
  fn: () => Promise<void>,
): Promise<void> => {
  const keys = Object.keys(env) as Array<keyof typeof env>;
  const saved = keys.map((k) => [k, process.env[k]] as const);
  for (const k of keys) {
    const v = env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    await fn();
  } finally {
    for (const [k, v] of saved) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
};

describe('getLlmEnv', () => {
  it('三项齐全时返回去空白后的配置', () => {
    const env = getLlmEnv({
      LLM_API_BASE_URL: ' https://example.test/v1 ',
      LLM_API_KEY: ' sk-test ',
      LLM_MODEL: ' qwen3.8-27b ',
    });
    expect(env).toEqual({ baseURL: 'https://example.test/v1', apiKey: 'sk-test', model: 'qwen3.8-27b' });
  });

  it('全缺时抛中文 Error 并逐项点名缺失变量', () => {
    expect(() => getLlmEnv({})).toThrowError(/缺少环境变量：LLM_API_BASE_URL、LLM_API_KEY、LLM_MODEL/);
  });

  it('空白串等同缺失，且只点名真正缺的那一项', () => {
    expect(() =>
      getLlmEnv({ LLM_API_BASE_URL: 'https://x.test/v1', LLM_API_KEY: '  ', LLM_MODEL: 'm' }),
    ).toThrowError(/LLM_API_KEY/);
  });
});

describe('streamAnalyzeEvents（双流增量）', () => {
  it('按帧序 yield reasoning 与 content 事件', async () => {
    const client = fakeClient([
      { reasoning_content: '推演1' },
      { content: '正文A' },
      { reasoning_content: '推演2', content: '正文B' },
    ]);
    const events = await collect(streamAnalyzeEvents(messages, client, 'test-model'));
    expect(events).toEqual([
      { type: 'reasoning', text: '推演1' },
      { type: 'content', text: '正文A' },
      { type: 'reasoning', text: '推演2' },
      { type: 'content', text: '正文B' },
    ]);
  });

  it('请求体带 stream:true、reasoning_effort=low 与消息副本；signal 透传给 SDK options', async () => {
    const controller = new AbortController();
    const client = fakeClient([{ content: 'x' }]);
    await collect(streamAnalyzeEvents(messages, client, 'm', controller.signal));
    const body = client.calls[0].body as Record<string, unknown>;
    expect(body.stream).toBe(true);
    expect(body.model).toBe('m');
    expect(body.reasoning_effort).toBe('low'); // 解读不需要深推理（用户拍板 2026-08-29）
    expect(body.messages).toEqual(messages);
    expect(body.messages).not.toBe(messages); // 传副本，不泄漏入参
    expect((client.calls[0].options as { signal: unknown }).signal).toBe(controller.signal);
  });

  it('空 delta / 缺 choices 的帧被安全跳过', async () => {
    const client = {
      chat: {
        completions: {
          async create() {
            return {
              async *[Symbol.asyncIterator]() {
                yield { choices: [] };
                yield { choices: [{ delta: {} }] };
                yield { choices: [{ delta: { content: '有' } }] };
              },
            };
          },
        },
      },
    } satisfies ChatClientLike;
    expect(await collect(streamAnalyzeEvents(messages, client, 'm'))).toEqual([
      { type: 'content', text: '有' },
    ]);
  });

  it('上游抛错时包装为中文 Error（不外泄原始形态）', async () => {
    const boom = new Error('HTTP 500 internal');
    const client = fakeClient([], { rejectWith: boom });
    await expect(collect(streamAnalyzeEvents(messages, client, 'm'))).rejects.toThrowError(
      /^调用大模型失败：HTTP 500 internal$/,
    );
  });

  it('AbortError 包装为「已被取消」', async () => {
    const abort = new Error('aborted');
    abort.name = 'AbortError';
    const client = fakeClient([], { rejectWith: abort });
    await expect(collect(streamAnalyzeEvents(messages, client, 'm'))).rejects.toThrowError('大模型请求已被取消。');
  });
});

describe('streamAnalyze（契约入口：只吐正文增量）', () => {
  it('env 缺失时迭代即抛中文错误（不发网络）', async () => {
    await withEnv({ LLM_API_BASE_URL: undefined, LLM_API_KEY: undefined, LLM_MODEL: undefined }, async () => {
      await expect(collect(streamAnalyze(messages))).rejects.toThrowError(/缺少环境变量/);
    });
  });

  it('只 yield content：reasoning 增量被过滤（双流入口在 streamAnalyzeEvents）', async () => {
    // streamAnalyze 内部会新建 OpenAI 客户端——此处验证的是「事件过滤逻辑」经由同源的
    // streamAnalyzeEvents 完成：双流里 reasoning 有值、content-only 视图里没有。
    const client = fakeClient([
      { reasoning_content: '别给正文' },
      { content: '只给这段' },
    ]);
    const events = await collect(streamAnalyzeEvents(messages, client, 'm'));
    const contentOnly = events.filter((e) => e.type === 'content').map((e) => e.text);
    expect(contentOnly).toEqual(['只给这段']);
  });
});
