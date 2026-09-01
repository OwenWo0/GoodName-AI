/**
 * 谐音垫片 tripwire（cr-m5 MEDIUM-3）：pool.ts 以双 cast 向 detectXieyin / buildPingzeResult
 * 转发「谐音上下文音」增补参数，phonology 侧当前**未实现**该参数——多余实参被 JS 静默忽略，
 * 「后字声母脱落式」安检永不生效且零报错。
 * 本测试钉死两侧当前签名（源码不含该字段名，可选参数 arity 测不出故查 toString）：
 * phonology 落地 → 此测试变红 → 提醒删除 pool.ts 垫片、回归直调。
 * 切勿在 phonology 未实现时改大本断言。
 */
import { describe, it, expect } from 'vitest';
import { detectXieyin } from '@/lib/phonology/xieyin';
import { buildPingzeResult } from '@/lib/phonology/pingze';

const 字段 = '谐音上下文音';

describe('pool.ts 契约垫片 tripwire', () => {
  it('detectXieyin 当前 1 参且源码不含「谐音上下文音」：落地时须删垫片回归直调', () => {
    expect(detectXieyin.length).toBe(1);
    expect(Function.prototype.toString.call(detectXieyin)).not.toContain(字段);
  });

  it('buildPingzeResult 源码不含「谐音上下文音」：落地时须删垫片回归直调', () => {
    expect(buildPingzeResult.length).toBe(2);
    expect(Function.prototype.toString.call(buildPingzeResult)).not.toContain(字段);
  });
});
