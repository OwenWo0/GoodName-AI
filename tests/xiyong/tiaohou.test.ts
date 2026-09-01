/**
 * 调候表数据测试：10 干 × 12 支 = 120 条全覆盖、五行枚举规范化、
 * 抽样锚点（每干至少 1 月）与原文核对结论锁定。
 */
import { describe, it, expect } from 'vitest';
import 调候表 from '../../src/data/tiaohou.json';
import { findTiaohou } from '../../src/lib/xiyong/tiaohou';
import { WUXING_ORDER } from '../../src/lib/xiyong/constants';

const 十天干 = '甲乙丙丁戊己庚辛壬癸'.split('');
const 十二支 = '子丑寅卯辰巳午未申酉戌亥'.split('');

describe('调候表结构与覆盖', () => {
  it('_meta 记录来源与校勘记', () => {
    expect(调候表._meta.来源.length).toBeGreaterThan(0);
    expect(Array.isArray(调候表._meta.校勘记)).toBe(true);
  });

  it('恰好 120 条，10 干 × 12 支无重复无缺漏', () => {
    const 表 = 调候表.表;
    expect(表.length).toBe(120);
    const 键 = new Set(表.map((e) => `${e.日主}-${e.月支}`));
    expect(键.size).toBe(120);
    for (const 干 of 十天干) {
      for (const 支 of 十二支) expect(键.has(`${干}-${支}`)).toBe(true);
    }
  });

  it('每条：五行非空、全部在五行枚举内、依据非空、去重', () => {
    for (const e of 调候表.表) {
      expect(e.调候五行.length).toBeGreaterThan(0);
      for (const wx of e.调候五行) expect(WUXING_ORDER).toContain(wx);
      expect(new Set(e.调候五行).size).toBe(e.调候五行.length);
      expect(e.依据.length).toBeGreaterThan(0);
      expect(十天干).toContain(e.日主);
      expect(十二支).toContain(e.月支);
    }
  });

  it('调候五行只用五行枚举，不混入天干原文（干→干、支→支 无泄漏）', () => {
    for (const e of 调候表.表) {
      expect('甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥'.includes(e.调候五行.join(''))).toBe(false);
    }
  });
});

describe('findTiaohou 查询', () => {
  it('命中返回 五行+依据；未知日主/月支抛错', () => {
    const r = findTiaohou('甲', '子');
    expect(r.五行.length).toBeGreaterThan(0);
    expect(r.依据.length).toBeGreaterThan(0);
    expect(() => findTiaohou('甲', '不')).toThrow();
    expect(() => findTiaohou('龘', '子')).toThrow();
  });
});

/**
 * 抽样核对（每干至少 1 月）——预期与 Wikisource《穷通宝鉴》原文逐条核对：
 * 见 src/data/tiaohou.json 的 _meta.校勘记。
 */
describe('抽样锚点（原文核对）', () => {
  it.each([
    ['甲', '子', ['火', '金']], // 十一月甲木：丁先庚后，丙火佐之
    ['乙', '寅', ['火', '水']], // 正月乙木：丙火为先，癸水次之
    ['丙', '午', ['水']],       // 五月丙火：专用壬水
    ['丁', '未', ['木', '水']], // 六月丁火：专取甲木，壬水次之
    ['戊', '午', ['水', '木', '火']], // 五月戊土：先看壬水，次取甲木，丙火酌用
    ['己', '巳', ['水', '火', '金']], // 三夏己土：取癸为要，次用丙火，加辛生癸
    ['庚', '辰', ['木', '火']], // 三月庚金：先甲后丁
    ['辛', '亥', ['水', '火']], // 十月辛金：先用壬水，次取丙火（金白水清）
    ['壬', '申', ['土', '火']], // 七月壬水：专用戊土，次丁火佐戊
    ['癸', '酉', ['金', '火']], // 八月癸水：取辛为用，丙火佐之（水暖金温）
  ] as const)('%s 生 %s 月查表', (干, 支, 五行) => {
    const r = findTiaohou(干, 支);
    expect(r.五行).toEqual([...五行]);
  });

  it('冬木调候必含火（任务锚点①）', () => {
    expect(findTiaohou('甲', '子').五行).toContain('火');
  });

  it('壬生丑月调候为火木（冲突案例基础）', () => {
    expect(findTiaohou('壬', '丑').五行).toEqual(['火', '木']);
  });
});
