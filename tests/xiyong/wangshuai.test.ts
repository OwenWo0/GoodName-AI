/**
 * 旺衰净分制单测（喜用神算法修复 C.2）：
 * ① 得令带符号——失令之月真扣分（旧版 0 分起跳把「克我之月」与「无干系之月」混同）；
 * ② 中/余气仅负分侧折减——壬生丑月 丑中癸（中气同我）不加分，仍 −30 失令（判别钉）；
 * ③ 得势净额可为负（克泄耗透干即扣）；
 * ④ 锚点总分/档位按净分制实算重钉（旧 64/74/39/90/54/8 正分制值作废）。
 */
import { describe, expect, it } from 'vitest';
import { analyzeWangshuai, shengKeRelation, shishenOfWx } from '@/lib/xiyong/wangshuai';
import { 构造八字, 构造四柱, 锚点 } from './fixtures';

describe('生克关系与十神类别映射', () => {
  it('shengKeRelation：以壬水为日主', () => {
    expect(shengKeRelation('水', '水')).toBe('同我');
    expect(shengKeRelation('金', '水')).toBe('生我');
    expect(shengKeRelation('木', '水')).toBe('我生');
    expect(shengKeRelation('火', '水')).toBe('我克');
    expect(shengKeRelation('土', '水')).toBe('克我');
  });

  it('shishenOfWx：五类各恰一五行', () => {
    expect(shishenOfWx('金', '水')).toBe('印星');
    expect(shishenOfWx('水', '水')).toBe('比劫');
    expect(shishenOfWx('木', '水')).toBe('食伤');
    expect(shishenOfWx('火', '水')).toBe('财星');
    expect(shishenOfWx('土', '水')).toBe('官杀');
  });
});

describe('得令：带符号净分 + 中余气仅负分侧折减', () => {
  it('甲生寅月：同我主气+45，中气我生(丙)不计，余气我克(戊)−15×0.25 → 41.25', () => {
    const w = analyzeWangshuai('甲', 构造四柱([['庚', '午'], ['戊', '寅'], ['甲', '午'], ['庚', '午']]));
    expect(w.得令.得分).toBeCloseTo(41.25, 10);
    expect(w.得令.支持).toBe(true);
    expect(w.得令.明细.join('')).toContain('余气·我克）-3.75');
    expect(w.得令.明细.join('')).not.toContain('丙'); // 中气正分侧不计入明细
  });

  it('壬生丑月：克我主气−30；中气癸同我、余气辛生我——正分侧不加分，仍 −30 失令（判别钉）', () => {
    const w = analyzeWangshuai('壬', 构造四柱([['壬', '午'], ['辛', '丑'], ['壬', '午'], ['甲', '辰']]));
    expect(w.得令.得分).toBeCloseTo(-30, 10);
    expect(w.得令.支持).toBe(false);
    expect(w.得令.明细.join('')).toContain('克我）-30');
    expect(w.得令.明细.join('')).not.toContain('癸');
    expect(w.得令.明细.join('')).not.toContain('辛'); // 余气生我（辛）同属正分侧，不得加分入明细
  });

  it('壬生午月：我克主气−15 + 克我中气(己)−30×0.5 → −30', () => {
    const w = analyzeWangshuai('壬', 构造四柱([['壬', '午'], ['丙', '午'], ['甲', '戌'], ['甲', '戌']]));
    expect(w.得令.得分).toBeCloseTo(-30, 10);
  });

  it('丙生午月：同我主气+45，中气我生(己)0 不加 → 45', () => {
    const w = analyzeWangshuai('丙', 锚点['夏火']().四柱);
    expect(w.得令.得分).toBeCloseTo(45, 10);
  });
});

describe('得势：净额可负，透干克泄耗即扣', () => {
  it('纯水盘：年壬隔+6 月壬贴+8 时庚印贴+6 → 20；四刃皆通根不重复计生扶', () => {
    const w = analyzeWangshuai('壬', 锚点['纯水身强']().四柱);
    expect(w.得势.得分).toBe(20);
  });

  it('F3 盘：官杀隔−6 财贴−6 官杀贴−8 → −20（克泄耗净负）', () => {
    const w = analyzeWangshuai('甲', 锚点['F3盘']().四柱);
    expect(w.得势.得分).toBe(-20);
    expect(w.得势.支持).toBe(false);
  });

  it('钳位上界：原始净额 34（比劫22+无根生扶支4×3）仍钳 +30 并留痕', () => {
    // 甲日四甲子：干 年比隔6+月比贴8+时比贴8=22；子三（年月时）癸生木而不藏甲=无根之扶 +4×3 → 34
    const 四柱 = 构造四柱([['甲', '子'], ['甲', '子'], ['甲', '子'], ['甲', '子']]);
    const w = analyzeWangshuai('甲', 四柱);
    expect(w.得势.得分).toBe(30);
    expect(w.得势.明细.join('')).toContain('钳位');
  });
});

describe('锚点总分与档位（净分制实算重钉）', () => {
  it.each([
    ['冬木', 47, '偏强'],
    ['夏火', 72, '身强'],
    ['纯水身强', 93, '身强'],
    ['中和木', 48.25, '偏强'], // 原「中和54」锚点：F3 定线 20 的规格冲突方，重钉记录见验收报告 §③
    ['弱水身弱', -35, '偏弱'],
    ['冬水冲突', -18, '偏弱'],
    ['F3盘', 21.25, '偏强'], // 任务书钉：F3 ∈ {偏强,身强}
    ['F1从财', -45, '偏弱'], // 从格盘：旺衰分照常展示（−30−4−5−6，财隔只扣4），喜忌由格局门胜出
  ] as const)('%s：总分 %o → %s', (名, 分, 级) => {
    const b = 锚点[名]();
    const w = analyzeWangshuai(b.日主, b.四柱);
    expect(w.得分).toBeCloseTo(分, 10);
    expect(w.等级).toBe(级);
  });

  it('三维相加 = 总分（冬木 35+8+4=47）', () => {
    const w = analyzeWangshuai('甲', 锚点['冬木']().四柱);
    expect(w.得令.得分).toBeCloseTo(35, 10);
    expect(w.得地.得分).toBe(8);
    expect(w.得势.得分).toBe(4);
    expect(w.得分).toBeCloseTo(w.得令.得分 + w.得地.得分 + w.得势.得分, 10);
  });

  it('纯水得地 28：日支主气12 + 年月时主气8×3（月主气0）', () => {
    const w = analyzeWangshuai('壬', 锚点['纯水身强']().四柱);
    expect(w.得地.得分).toBe(28);
  });

  it('弱水不得地：戌藏戊辛丁无水 → 0（辛生我属印非根，根只认同我五行）', () => {
    const w = analyzeWangshuai('壬', 锚点['弱水身弱']().四柱);
    expect(w.得地.得分).toBe(0);
    expect(w.得地.支持).toBe(false);
  });
});

describe('不可变性', () => {
  it('analyzeWangshuai 不修改入参四柱', () => {
    const b = 构造八字(
      [
        ['甲', '子'],
        ['丙', '子'],
        ['甲', '子'],
        ['丙', '寅'],
      ],
      '甲'
    );
    const 前 = JSON.stringify(b.四柱);
    analyzeWangshuai(b.日主, b.四柱);
    expect(JSON.stringify(b.四柱)).toBe(前);
  });
});
