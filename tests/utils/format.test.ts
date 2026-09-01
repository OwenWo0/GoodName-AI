/**
 * 展示文案格式化 单测（校正三行 / 起运措辞 / 藏干权重 / 晚子时 / 爆款度）。
 */
import { describe, expect, it } from 'vitest';
import {
  buzzLabel,
  cangGanWeightLabel,
  lateZiShiNote,
  qiYunText,
  trueSolarLines,
} from '@/utils/format';

describe('trueSolarLines（校正三行拆解）', () => {
  it('正常态三行：输入 / 经线对照 / 修正量与校正后', () => {
    const lines = trueSolarLines({
      输入北京时间: '2026-08-08 07:45:00',
      校正分钟: -13.68,
      校正后本地时间: '2026-08-08 07:31:19',
      地点经度: 121.47,
    });
    expect(lines).toHaveLength(3);
    expect(lines[1].value).toContain('120°');
    expect(lines[1].value).toContain('121.47');
    expect(lines[2].value).toBe('-13.68 分钟 → 校正后 2026-08-08 07:31:19');
    expect(lines[2].note).toBeUndefined();
  });

  it('正修正带 + 号', () => {
    const lines = trueSolarLines({
      输入北京时间: '2026-01-01 12:00:00',
      校正分钟: 8.5,
      校正后本地时间: '2026-01-01 12:08:30',
      地点经度: 113.26,
    });
    expect(lines[2].value.startsWith('+8.50')).toBe(true);
  });

  it('时辰未知：输入行给降级说明，校正行带正午近似注', () => {
    const lines = trueSolarLines({
      输入北京时间: null,
      校正分钟: -2.1,
      校正后本地时间: null,
      地点经度: 116.4,
      正午近似: true,
    });
    expect(lines[0].value).toContain('时辰未知');
    expect(lines[2].value).toContain('—');
    expect(lines[2].note).toContain('正午近似');
  });
});

describe('qiYunText', () => {
  it('拼接为「出生…后，于 … 交运」', () => {
    const d = qiYunText({ 出生后时长: '3年2个月3天12小时后', 交运公历: '2029-06-01' });
    expect(d.text).toBe('出生3年2个月3天12小时后，于 2029-06-01 交运');
    expect(d.approx).toBe(false);
  });
  it('时辰未知近似标记透传', () => {
    expect(qiYunText({ 出生后时长: 'X后', 交运公历: '2030-01-01', 时辰未知近似: true }).approx).toBe(true);
  });
});

describe('cangGanWeightLabel（本气/中气/余气）', () => {
  it('三藏干：本/中/余', () => {
    expect(cangGanWeightLabel(0, 3)).toBe('本气 100%');
    expect(cangGanWeightLabel(1, 3)).toBe('中气 70%');
    expect(cangGanWeightLabel(2, 3)).toBe('余气 50%');
  });
  it('单藏干为本气；双藏干为本/余', () => {
    expect(cangGanWeightLabel(0, 1)).toBe('本气 100%');
    expect(cangGanWeightLabel(0, 2)).toBe('本气 100%');
    expect(cangGanWeightLabel(1, 2)).toBe('余气 50%');
  });
});

describe('lateZiShiNote / buzzLabel', () => {
  it('不涉及→null；两口径各出不同文案', () => {
    expect(lateZiShiNote('不涉及')).toBeNull();
    expect(lateZiShiNote('sect2_日不换')).toContain('sect=2');
    expect(lateZiShiNote('sect1_换日')).toContain('sect=1');
  });
  it('爆款度百分比与 0.6 警示线（含越界钳制）', () => {
    expect(buzzLabel(0.08)).toEqual({ percent: '8%', warn: false });
    expect(buzzLabel(0.91)).toEqual({ percent: '91%', warn: true });
    expect(buzzLabel(1.5).percent).toBe('100%');
    expect(buzzLabel(-1).percent).toBe('0%');
  });
});
