/**
 * 客户端IP 提取单测：cf-connecting-ip 优先（Cloudflare 边缘写入、不可伪造）> XFF 首段 > 'unknown'。
 */
import { describe, expect, it } from 'vitest';
import { 客户端IP } from '@/middleware';

const 头 = (init: Record<string, string>) => new Headers(init);

describe('客户端IP', () => {
  it('cf-connecting-ip 存在时优先于 XFF（伪造 XFF 无效）', () => {
    const h = 头({ 'cf-connecting-ip': '1.2.3.4', 'x-forwarded-for': '9.9.9.9, 10.0.0.1' });
    expect(客户端IP(h)).toBe('1.2.3.4');
  });

  it('无 cf 头时回退 XFF 首段并去空白', () => {
    expect(客户端IP(头({ 'x-forwarded-for': ' 5.6.7.8 , 10.0.0.1 ' }))).toBe('5.6.7.8');
  });

  it('两者皆无归 unknown（本地直连形态）', () => {
    expect(客户端IP(头({}))).toBe('unknown');
  });

  it('空白 cf 值视同缺失，继续走 XFF', () => {
    expect(客户端IP(头({ 'cf-connecting-ip': '   ', 'x-forwarded-for': '7.7.7.7' }))).toBe('7.7.7.7');
  });
});
