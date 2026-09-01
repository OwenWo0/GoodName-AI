/**
 * POST /api/evaluate-names 请求 schema 单测（契约 v2 §3）：
 * 形状校验 + 两条 refine（名字列表项内去重、喜用神∩忌神=∅）。
 */
import { describe, it, expect } from 'vitest';
import { evaluateNamesRequestSchema } from '@/lib/evaluate/schema';

const 合法请求 = {
  姓氏: '王',
  名字列表: ['伟', '欣怡'],
  喜用神: ['土', '火'],
  忌神: ['水'],
};

describe('evaluateNamesRequestSchema', () => {
  it('合法请求通过；忌神 default 空数组', () => {
    const r = evaluateNamesRequestSchema.parse(合法请求);
    expect(r.名字列表).toEqual(['伟', '欣怡']);
    const 最小 = evaluateNamesRequestSchema.parse({
      姓氏: '王',
      名字列表: ['伟'],
      喜用神: ['土'],
    });
    expect(最小.忌神).toEqual([]);
    expect(最小.避讳字).toBeUndefined();
  });

  it('可选字段齐备时通过（明细+避讳字）', () => {
    const r = evaluateNamesRequestSchema.parse({
      ...合法请求,
      喜用神明细: [{ 五行: '土', 十神关系: '印星', 角色: '次用' }],
      避讳字: ['伟'],
    });
    expect(r.喜用神明细).toHaveLength(1);
  });

  it('姓氏/名部越界拒绝：3 字、非汉字、空串', () => {
    expect(evaluateNamesRequestSchema.safeParse({ ...合法请求, 姓氏: '欧阳大' }).success).toBe(false);
    expect(evaluateNamesRequestSchema.safeParse({ ...合法请求, 姓氏: 'Wang' }).success).toBe(false);
    expect(evaluateNamesRequestSchema.safeParse({ ...合法请求, 名字列表: ['伟明远'] }).success).toBe(false);
    expect(evaluateNamesRequestSchema.safeParse({ ...合法请求, 名字列表: ['ab'] }).success).toBe(false);
    expect(evaluateNamesRequestSchema.safeParse({ ...合法请求, 名字列表: [''] }).success).toBe(false);
  });

  it('名字列表规模界：空 → 拒；101 项 → 拒；100 项 → 过（互异 1 字名，绕开去重 refine）', () => {
    expect(evaluateNamesRequestSchema.safeParse({ ...合法请求, 名字列表: [] }).success).toBe(false);
    const 互异名单 = Array.from({ length: 101 }, (_, i) => String.fromCodePoint(0x4e00 + i));
    expect(互异名单.every((n) => /^[一-鿿]$/.test(n))).toBe(true);
    expect(evaluateNamesRequestSchema.safeParse({ ...合法请求, 名字列表: 互异名单 }).success).toBe(false);
    expect(evaluateNamesRequestSchema.safeParse({ ...合法请求, 名字列表: 互异名单.slice(0, 100) }).success).toBe(true);
  });

  it('refine：名字列表项内去重，报错文案点名重复项', () => {
    const r = evaluateNamesRequestSchema.safeParse({ ...合法请求, 名字列表: ['伟', '欣怡', '伟'] });
    expect(r.success).toBe(false);
    if (!r.success) {
      const 问题 = r.error.issues.find((i) => i.path.join('.') === '名字列表');
      expect(问题?.message).toContain('重复');
      expect(问题?.message).toContain('「伟」');
    }
  });

  it('refine：喜用神与忌神交集非空 → 拒，path 落在忌神', () => {
    const r = evaluateNamesRequestSchema.safeParse({ ...合法请求, 喜用神: ['土', '水'], 忌神: ['水'] });
    expect(r.success).toBe(false);
    if (!r.success) {
      const 问题 = r.error.issues.find((i) => i.path.join('.') === '忌神');
      expect(问题?.message).toContain('交集');
      expect(问题?.message).toContain('水');
    }
  });

  it('五行/十神/角色枚举与避讳字界', () => {
    expect(evaluateNamesRequestSchema.safeParse({ ...合法请求, 喜用神: ['风'] }).success).toBe(false);
    expect(evaluateNamesRequestSchema.safeParse({ ...合法请求, 忌神: [] }).success).toBe(true);
    expect(
      evaluateNamesRequestSchema.safeParse({
        ...合法请求,
        喜用神明细: [{ 五行: '土', 十神关系: '比肩', 角色: '次用' }],
      }).success,
    ).toBe(false);
    expect(
      evaluateNamesRequestSchema.safeParse({
        ...合法请求,
        喜用神明细: [{ 五行: '土', 十神关系: '印星', 角色: '大用' }],
      }).success,
    ).toBe(false);
    expect(evaluateNamesRequestSchema.safeParse({ ...合法请求, 避讳字: ['伟明'] }).success).toBe(false);
    expect(evaluateNamesRequestSchema.safeParse({ ...合法请求, 避讳字: ['A'] }).success).toBe(false);
  });
});
