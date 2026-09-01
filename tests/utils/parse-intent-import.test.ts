/**
 * 批量导入解析（契约 v2.1）单测：分隔符切「名」（顿号/全半角逗号/任意空白含 \r\n、U+3000）、
 * 有效=1-2 CJK 汉字（>2 字整项非法，与 splitHanChars 按字拆分语义相反）、
 * 三桶去重保序、已有分流、不做 60 截断（容量策略属存储层）。
 */
import { describe, expect, it } from 'vitest';
import { parseIntentImport } from '@/utils/parse-intent-import';

describe('parseIntentImport', () => {
  it('混分隔：顿号/全角逗号/半角逗号/空格 → 5 有效保序', () => {
    const r = parseIntentImport('知予、明轩,雨桐 沐宸，梓萱');
    expect(r).toEqual({ 有效名: ['知予', '明轩', '雨桐', '沐宸', '梓萱'], 已在名单: [], 非法项: [] });
  });

  it('空串 / 纯分隔符（含换行）→ 三桶全空', () => {
    expect(parseIntentImport('')).toEqual({ 有效名: [], 已在名单: [], 非法项: [] });
    expect(parseIntentImport('、、、 ，, \n\t ')).toEqual({ 有效名: [], 已在名单: [], 非法项: [] });
  });

  it('非法项原样回显：ASCII、3 字项、半角数字、混排串', () => {
    const r = parseIntentImport('abc 三个字 2字 zhi雨');
    expect(r.有效名).toEqual([]);
    expect(r.非法项).toEqual(['abc', '三个字', '2字', 'zhi雨']);
  });

  it('>2 汉字整项非法（不按字拆），繁体/生僻汉字段内有效', () => {
    const r = parseIntentImport('欧阳修 龍 張懿');
    expect(r.有效名).toEqual(['龍', '張懿']);
    expect(r.非法项).toEqual(['欧阳修']);
  });

  it('批内去重保序：有效/已在/非法各至多计一次', () => {
    const r = parseIntentImport('知予 白 知予 abc abc 白', new Set(['白']));
    expect(r).toEqual({ 有效名: ['知予'], 已在名单: ['白'], 非法项: ['abc'] });
  });

  it('已有分流：给定时命中集合入已在名单；缺省不分流全部入有效', () => {
    const r = parseIntentImport('白 知予', new Set(['白']));
    expect(r.有效名).toEqual(['知予']);
    expect(r.已在名单).toEqual(['白']);
    expect(parseIntentImport('白').有效名).toEqual(['白']);
  });

  it('61 名不截断（60 上限属存储层 addIntentEntries）', () => {
    const 名列表 = Array.from({ length: 61 }, (_, i) => String.fromCodePoint(0x4e00 + i));
    const r = parseIntentImport(名列表.join('、'));
    expect(r.有效名).toHaveLength(61);
    expect(r.有效名[0]).toBe(名列表[0]);
    expect(r.有效名.at(-1)).toBe(名列表[60]);
  });

  it('\\r\\n 与 U+3000 全角空格均被切', () => {
    const r = parseIntentImport('知予\r\n白　沐宸');
    expect(r.有效名).toEqual(['知予', '白', '沐宸']);
  });
});
