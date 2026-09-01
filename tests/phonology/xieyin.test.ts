import { describe, it, expect } from 'vitest';
import { detectXieyin, detectRaokou } from '@/lib/phonology/xieyin';
import blacklist from '@/data/xieyin-blacklist.json';

describe('黑名单数据完备性', () => {
  it('patterns+charCombos 合计 ≥80 条', () => {
    expect(blacklist.patterns.length + blacklist.charCombos.length).toBeGreaterThanOrEqual(80);
  });

  it('每条均有 reason 且字符均为汉字', () => {
    for (const e of [...blacklist.patterns, ...blacklist.charCombos]) {
      expect(e.reason.length).toBeGreaterThan(0);
      const chars = 'pattern' in e ? e.pattern : e.chars;
      expect([...chars].every((c) => /[一-鿿]/.test(c))).toBe(true);
    }
  });
});

describe('谐音黑名单匹配（拼音级，同音不同字可命中）', () => {
  it('「杜子腾」字面命中「肚子疼」', () => {
    expect(detectXieyin('杜子腾')).toMatch(/肚子疼/);
  });

  it('「杨威」拼音级命中（同音不同字）→ 阳痿', () => {
    const r = detectXieyin('杨威');
    expect(r).toMatch(/阳痿/);
    expect(r).toContain('杨威');
  });

  it('「石进」拼音级命中「使劲」', () => {
    expect(detectXieyin('石进')).toMatch(/使劲/);
  });

  it('跨姓名字边界组合命中：「吴德海」中的「吴德」', () => {
    expect(detectXieyin('吴德海')).toMatch(/无德/);
  });

  it('正常名「张三丰」不误报', () => {
    expect(detectXieyin('张三丰')).toBeNull();
  });

  it('品牌梗名「支付宝」命中', () => {
    expect(detectXieyin('支付宝')).toMatch(/品牌/);
  });
});

describe('绕口检测（双声叠韵/同音节连读/叠字）', () => {
  it('「刘牛妞」叠韵三连命中', () => {
    const r = detectRaokou('刘牛妞');
    expect(r).not.toBeNull();
    expect(r).toMatch(/韵母|同音/);
  });

  it('「施史」同音节连读命中', () => {
    expect(detectRaokou('施史')).toMatch(/同音/);
  });

  it('「李想方」叠字命中', () => {
    expect(detectRaokou('李强强')).toMatch(/叠字/);
  });

  it('正常名「张伟杰」不误报', () => {
    expect(detectRaokou('张伟杰')).toBeNull();
  });
});
