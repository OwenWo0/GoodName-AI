/**
 * kangxi.ts 测试：直查 / cn2t 一简多繁 / override 补丁 / 缺失 四来源链路。
 * 库行为（charDetail 实测值）与 opencc-js 实测转换结果钉在此处。
 */
import { describe, it, expect } from 'vitest';

import { kangxiStrokesOf, kangxiStrokes } from '@/lib/wuge/kangxi';

describe('kangxiStrokesOf 库直查', () => {
  it('常用字直查：王4 李7 明8 龘48', () => {
    expect(kangxiStrokesOf('王')).toMatchObject({ 简体: '王', 繁体: '王', 笔画: 4, 来源: '库直查' });
    expect(kangxiStrokesOf('李')).toMatchObject({ 繁体: '李', 笔画: 7, 来源: '库直查' });
    expect(kangxiStrokesOf('明')).toMatchObject({ 笔画: 8 });
    expect(kangxiStrokesOf('龘')).toMatchObject({ 笔画: 48 });
  });

  it('简体自动映射繁体：杰→傑12；繁体直入亦可：張→11', () => {
    expect(kangxiStrokesOf('杰')).toMatchObject({ 繁体: '傑', 笔画: 12, 来源: '库直查' });
    expect(kangxiStrokesOf('張')).toMatchObject({ 繁体: '張', 笔画: 11, 来源: '库直查' });
  });
});

describe('kangxiStrokesOf override 补丁', () => {
  it('萬：字库直查 13 为误，补丁 15，来源 override 且争议留痕', () => {
    const r = kangxiStrokesOf('萬');
    expect(r).toMatchObject({ 笔画: 15, 来源: 'override' });
    expect(r.争议).toContain('13');
    expect(r.争议).toContain('15');
  });

  it('里：字库默认映射 裏/13，补丁 7（姓名学惯例）', () => {
    const r = kangxiStrokesOf('里');
    expect(r).toMatchObject({ 笔画: 7, 来源: 'override' });
    expect(r.争议).toContain('裏');
  });
});

describe('kangxiStrokesOf 一简多繁（cn2t）', () => {
  it('发：单字取 發/12，争议标注 髮/15 备选', () => {
    const r = kangxiStrokesOf('发');
    expect(r).toMatchObject({ 繁体: '發', 笔画: 12, 来源: 'cn2t' });
    expect(r.争议).toContain('髮');
  });

  it('愿：字库直查願/14 为误，cn2t 重查得 願/19', () => {
    const r = kangxiStrokesOf('愿');
    expect(r).toMatchObject({ 繁体: '願', 笔画: 19, 来源: 'cn2t' });
  });

  it('台：不在歧义集（cn2t 单字→臺14 过甚），直查 5', () => {
    expect(kangxiStrokesOf('台')).toMatchObject({ 笔画: 5, 来源: '库直查' });
  });
});

describe('kangxiStrokes 文本级语境', () => {
  it('理发：语境判定为 理髮，发→髮/15', () => {
    const r = kangxiStrokes('理发');
    expect(r.明细[1]).toMatchObject({ 简体: '发', 繁体: '髮', 笔画: 15, 来源: 'cn2t' });
  });

  it('头发：同样得 髮/15', () => {
    expect(kangxiStrokes('头发').明细[1]).toMatchObject({ 繁体: '髮', 笔画: 15 });
  });

  it('关系：系→係/9', () => {
    expect(kangxiStrokes('关系').明细[1]).toMatchObject({ 繁体: '係', 笔画: 9 });
  });

  it('正常名聚合：王(4)小(3)明(8) 总15，全库直查，无争议', () => {
    const r = kangxiStrokes('王小明');
    expect(r.明细).toHaveLength(3);
    expect(r.总笔画).toBe(15);
    expect(r.明细.every((h) => h.来源 === '库直查')).toBe(true);
    expect(r.争议标注).toEqual([]);
  });

  it('汇总争议标注：含 override 与 cn2t 两类留痕', () => {
    const r = kangxiStrokes('万里');
    expect(r.总笔画).toBe(22);
    expect(r.明细[0]).toMatchObject({ 简体: '万', 笔画: 15 });
    expect(r.明细[1]).toMatchObject({ 简体: '里', 笔画: 7, 来源: 'override' });
    expect(r.争议标注.some((s) => s.includes('里'))).toBe(true);
  });
});

describe('kangxiStrokesOf 缺失字', () => {
  it('库外字：笔画 null、来源 缺失、有争议说明', () => {
    const r = kangxiStrokesOf('𬀩');
    expect(r.笔画).toBeNull();
    expect(r.来源).toBe('缺失');
    expect(r.争议).toContain('缺失');
  });

  it('文本含缺失字：总笔画 null（宁可无解不可错解）', () => {
    const r = kangxiStrokes('王𬀩');
    expect(r.总笔画).toBeNull();
    expect(r.明细[0].笔画).toBe(4);
    expect(r.争议标注.length).toBeGreaterThan(0);
  });
});
