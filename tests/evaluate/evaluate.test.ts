/**
 * evaluateNames 纯函数单测（契约 v2 §3 档位/计分口径）。
 * 字值锚点（char-wuxing.json 实查）：伟/宇=土 昊/煜=火 杰=木 轩/瑞/悦=金 涵/豪=水；欣怡在爆款榜。
 */
import { describe, it, expect } from 'vitest';
import { evaluateNames, type EvaluateCtx } from '@/lib/evaluate/evaluate';

const ctx = (over: Partial<EvaluateCtx> & Pick<EvaluateCtx, '喜用神'>): EvaluateCtx => ({ 忌神: [], ...over });

describe('evaluateNames 档位判定', () => {
  it('全部字命中喜用（主药）→ 上；分=+14×命中字数', () => {
    const [r] = evaluateNames('王', ['伟宇'], ctx({ 喜用神: ['土'] }));
    expect(r.契合.档位).toBe('上');
    expect(r.契合.命中喜用).toEqual(['土', '土']);
    expect(r.契合.分).toBe(28);
  });

  it('犯忌 → 下（即使同时命中喜用）；命中忌神逐字记录', () => {
    const [r] = evaluateNames('王', ['伟涵'], ctx({ 喜用神: ['土'], 忌神: ['水'] }));
    expect(r.契合.档位).toBe('下');
    expect(r.契合.命中喜用).toEqual(['土']);
    expect(r.契合.命中忌神).toEqual(['水']);
    expect(r.契合.分).toBe(14 - 12);
  });

  it('纯犯忌名单字 → 下，分=-12', () => {
    const [r] = evaluateNames('王', ['涵'], ctx({ 喜用神: ['火'], 忌神: ['水'] }));
    expect(r.契合.档位).toBe('下');
    expect(r.契合.分).toBe(-12);
  });

  it('无命中无犯忌 → 中，分=0', () => {
    const [r] = evaluateNames('王', ['伟宇'], ctx({ 喜用神: ['火'], 忌神: ['水'] }));
    expect(r.契合.档位).toBe('中');
    expect(r.契合.分).toBe(0);
  });

  it('部分命中且无犯忌 → 中上', () => {
    const [r] = evaluateNames('王', ['伟昊'], ctx({ 喜用神: ['火'] }));
    expect(r.契合.档位).toBe('中上');
    expect(r.契合.分).toBe(14);
  });
});

describe('evaluateNames 次用口径', () => {
  const 明细 = [
    { 五行: '火' as const, 十神关系: '食伤' as const, 角色: '主用' as const },
    { 五行: '土' as const, 十神关系: '印星' as const, 角色: '次用' as const },
  ];

  it('次用角色单独列入 命中次用（不进 命中喜用），+7 替代 +14，全中仍 → 上', () => {
    const [r] = evaluateNames('王', ['伟宇'], ctx({ 喜用神: ['火'], 喜用神明细: 明细 }));
    expect(r.契合.命中次用).toEqual(['土', '土']);
    expect(r.契合.命中喜用).toEqual([]);
    expect(r.契合.档位).toBe('上');
    expect(r.契合.分).toBe(14);
  });

  it('明细则主药字仍 +14；无明细时全部按主用 +14（旧口径）', () => {
    const 带明细 = evaluateNames('王', ['昊'], ctx({ 喜用神: ['火'], 喜用神明细: 明细 }))[0];
    expect(带明细.契合.命中喜用).toEqual(['火']);
    expect(带明细.契合.分).toBe(14);
    const 无明细 = evaluateNames('王', ['伟'], ctx({ 喜用神: ['土'] }))[0];
    expect(无明细.契合.分).toBe(14);
  });
});

describe('evaluateNames 表外字（不 throw、如实呈报）', () => {
  it('表外字 → 记入 表外字、五行跳过、契合分跳过、说明注记；整名皆表外 → 中', () => {
    const [r] = evaluateNames('王', ['龘'], ctx({ 喜用神: ['土'] }));
    expect(r.表外字).toEqual(['龘']);
    expect(r.五行).toEqual([]);
    expect(r.契合.分).toBe(0);
    expect(r.契合.档位).toBe('中');
    expect(r.契合.说明.join('')).toContain('表外字');
  });

  it('表内+表外混合：命中的字照常计分，但「全部字命中」不成立 → 中上', () => {
    const [r] = evaluateNames('王', ['伟龘'], ctx({ 喜用神: ['土'] }));
    expect(r.五行).toEqual(['土']);
    expect(r.契合.分).toBe(14);
    expect(r.契合.档位).toBe('中上');
  });
});

describe('evaluateNames 避讳与展示字段', () => {
  it('犯避讳 → 说明「含避讳字「X」」，不降档不隐藏', () => {
    const [r] = evaluateNames('王', ['伟'], ctx({ 喜用神: ['土'], 避讳字: ['伟', '杰'] }));
    expect(r.契合.档位).toBe('上');
    expect(r.契合.说明).toContain('含避讳字「伟」');
  });

  it('平仄含姓氏（全名口径）、五格与爆款度齐备；爆款榜名 → 爆款度=1', () => {
    const [r] = evaluateNames('王', ['伟'], ctx({ 喜用神: ['土'] }));
    expect(r.平仄.逐字).toHaveLength(2); // 王+伟
    expect(r.平仄.平仄格式).toHaveLength(2);
    expect(r.五格).not.toBeNull();
    const [欣怡] = evaluateNames('王', ['欣怡'], ctx({ 喜用神: ['木'] }));
    expect(欣怡.爆款度).toBe(1);
  });

  it('多名逐名评估、顺序保持；同输入同输出（纯函数）', () => {
    const 名单 = ['伟', '昊涵', '龘'];
    const a = evaluateNames('王', 名单, ctx({ 喜用神: ['火'] }));
    const b = evaluateNames('王', 名单, ctx({ 喜用神: ['火'] }));
    expect(a.map((x) => x.名)).toEqual(名单);
    expect(a).toEqual(b);
  });
});
