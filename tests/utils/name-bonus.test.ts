/**
 * 卷二名字加成叠加建模 单测（纯 util，node 环境）。
 */
import { describe, expect, it } from 'vitest';
import type { WuXing, WuXingForce } from '@/lib/types';
import type { 契合评估 } from '@/lib/evaluate/types';
import { 单位刻度, 计算名字加成 } from '@/utils/name-bonus';

const force = (五行: WuXing, 得分: number): WuXingForce => ({ 五行, 得分, 来源: [] });
const 标准力量 = (): WuXingForce[] => [
  force('木', 200), force('火', 400), force('土', 50), force('金', 0), force('水', 100),
];

const 契合 = (过: Partial<契合评估> = {}): 契合评估 => ({
  命中喜用: [], 命中次用: [], 命中忌神: [], 档位: '中', 分: 0, 说明: [], ...过,
});
const 选中 = (名: string, 五行: WuXing[], 过: Partial<契合评估> = {}) => ({
  名, 五行, 契合: 契合(过),
});

describe('计算名字加成', () => {
  it('① 未选中 → null', () => {
    expect(计算名字加成(标准力量(), null)).toBeNull();
  });

  it('② 双字同元素：单位数 2、加成百分比=2×单位刻度、分类喜', () => {
    const v = 计算名字加成(标准力量(), 选中('炎炎', ['火', '火'], { 命中喜用: ['火'] }))!;
    const 火 = v.行.find((r) => r.五行 === '火')!;
    expect(火.加成单位数).toBe(2);
    expect(火.加成百分比).toBe(2 * 单位刻度);
    expect(火.分类).toBe('喜');
  });

  it('③ 喜次忌无四态：元素级查命中表', () => {
    const v = 计算名字加成(标准力量(), 选中('木火土金', ['木', '火', '土', '金'], {
      命中喜用: ['木'], 命中次用: ['火'], 命中忌神: ['土'],
    }))!;
    expect(v.行.map((r) => r.分类)).toEqual(['喜', '次', '忌', '无', '无']);
  });

  it('④ 乱序入参：恒 5 行、固定木火土金水序', () => {
    const 乱序 = [force('水', 100), force('金', 0), force('火', 400), force('木', 200), force('土', 50)];
    const v = 计算名字加成(乱序, 选中('明', ['水']))!;
    expect(v.行.map((r) => r.五行)).toEqual(['木', '火', '土', '金', '水']);
    expect(v.行.map((r) => r.基准百分比)).toEqual([50, 100, 12.5, 0, 25]); // 对 max=400
  });

  it('⑤ 0 分行：基准 0% 但加成仍可见', () => {
    const v = 计算名字加成(标准力量(), 选中('锐', ['金'], { 命中喜用: ['金'] }))!;
    const 金 = v.行.find((r) => r.五行 === '金')!;
    expect(金.基准百分比).toBe(0);
    expect(金.加成百分比).toBe(单位刻度);
  });

  it('⑥ 触顶截断：有截断=true，加成百分比与得分仍保真', () => {
    const v = 计算名字加成(标准力量(), 选中('炎炎', ['火', '火']))!;
    const 火 = v.行.find((r) => r.五行 === '火')!;
    expect(火.基准百分比).toBe(100);
    expect(v.有截断).toBe(true);
    expect(火.加成百分比).toBe(2 * 单位刻度); // 未截断的保真值
    expect(v.加成后得分[1]).toBe(400 + 2 * 400 * 0.04); // 432
  });

  it('⑦ Σ单位数 === 选中.五行.length（表外字被跳过不多计）', () => {
    const v = 计算名字加成(标准力量(), 选中('明炎', ['火', '水']))!; // 2 行五行（1 表外字）
    const Σ = v.行.reduce((s, r) => s + r.加成单位数, 0);
    expect(Σ).toBe(2);
  });

  it('⑧ 雷达刻度 = max(基准max, 加成后max)', () => {
    const 无加成 = 计算名字加成(标准力量(), 选中('锐', ['金']))!;
    expect(无加成.雷达刻度).toBe(400); // 加成落金行，基准火仍最大
    const 有加 = 计算名字加成(标准力量(), 选中('炎炎', ['火', '火']))!;
    expect(有加.雷达刻度).toBe(432); // 400 + 2×400×4% 反超
  });

  it('⑨ 名透传；力量表缺行按 0 兜底', () => {
    const v = 计算名字加成([force('火', 100)], 选中('明远', ['水']))!;
    expect(v.名).toBe('明远');
    expect(v.行).toHaveLength(5);
    expect(v.行[4].基准百分比).toBe(0);
    expect(v.行[4].加成单位数).toBe(1);
  });
});
