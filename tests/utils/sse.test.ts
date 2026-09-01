/**
 * SSE 帧解析 单测（协议对齐 src/app/api/analyze/route.ts）。
 */
import { describe, expect, it } from 'vitest';
import { createSseParser } from '@/utils/sse';

describe('createSseParser', () => {
  it('单 chunk 多帧顺序解析', () => {
    const parser = createSseParser();
    const events = parser.feed(
      'data: {"type":"reasoning","text":"先"}\n\ndata: {"type":"content","text":"你好"}\n\ndata: [DONE]\n\n',
    );
    expect(events).toEqual([
      { kind: 'reasoning', text: '先' },
      { kind: 'content', text: '你好' },
      { kind: 'done' },
    ]);
  });

  it('帧被截断在任意位置：残留缓冲，下次 feed 续上', () => {
    const parser = createSseParser();
    expect(parser.feed('data: {"type":"content","te')).toEqual([]);
    expect(parser.feed('xt":"冲"}\n')).toEqual([]);
    expect(parser.feed('\ndata: {"type":"content","text":"！"}\n\n')).toEqual([
      { kind: 'content', text: '冲' },
      { kind: 'content', text: '！' },
    ]);
  });

  it('error 帧：message 优先，缺省回落 text 或未知错误', () => {
    const parser = createSseParser();
    expect(parser.feed('data: {"type":"error","message":"上游失败"}\n\n')[0]).toEqual({
      kind: 'error',
      text: '上游失败',
    });
    expect(parser.feed('data: {"type":"error","text":"仅有text"}\n\n')[0]).toEqual({
      kind: 'error',
      text: '仅有text',
    });
    expect(parser.feed('data: {"type":"error"}\n\n')[0]).toEqual({ kind: 'error', text: '未知错误' });
  });

  it('容忍 CRLF 换行', () => {
    const parser = createSseParser();
    expect(parser.feed('data: {"type":"content","text":"ok"}\r\n\r\n')).toEqual([
      { kind: 'content', text: 'ok' },
    ]);
  });

  it('无 data 前缀 / 非法 JSON 帧被忽略；flush 收残帧', () => {
    const parser = createSseParser();
    expect(parser.feed(': comment\n\ndata: {broken\n\n')).toEqual([]);
    const late = createSseParser();
    late.feed('data: {"type":"content","text":"tail"}\n');
    expect(late.flush()).toEqual([{ kind: 'content', text: 'tail' }]);
    expect(late.flush()).toEqual([]);
  });

  it('未知 type 忽略', () => {
    const parser = createSseParser();
    expect(parser.feed('data: {"type":"usage","text":"x"}\n\n')).toEqual([]);
  });
});
