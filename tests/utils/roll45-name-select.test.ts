/**
 * 卷四五联动下拉纯函数（契约 v4 §2.1）单测：
 * 选项=条目序去重；显示下拉=选项≥2；选中回落链 当前选择→草案名→null。
 */
import { describe, expect, it } from 'vitest';
import { 计算卷四五选择 } from '@/utils/roll45-name-select';

describe('计算卷四五选择（契约 v4 §2.1 冻结规则）', () => {
  it('选项保持条目序并按首次出现去重', () => {
    const r = 计算卷四五选择(['乙', '甲', '乙', '丙', '甲'], undefined, null);
    expect(r.选项).toEqual(['乙', '甲', '丙']);
  });

  it('条目空 → 选项空、选中 null、不显下拉', () => {
    const r = 计算卷四五选择([], '知白', null);
    expect(r).toEqual({ 选项: [], 显示下拉: false, 选中: null });
  });

  it('显示下拉=选项≥2（1 个不显、2 个显、去重后按去重数计）', () => {
    expect(计算卷四五选择(['甲'], undefined, null).显示下拉).toBe(false);
    expect(计算卷四五选择(['甲', '乙'], undefined, null).显示下拉).toBe(true);
    // 去重后仅剩 1 项 → 不显
    expect(计算卷四五选择(['甲', '甲'], undefined, null).显示下拉).toBe(false);
  });

  it('当前选择仍在选项中 → 选中=当前选择（优先于草案名）', () => {
    const r = 计算卷四五选择(['甲', '乙'], '甲', '乙');
    expect(r.选中).toBe('乙');
  });

  it('当前选择失效（不在选项/为 null）→ 回落草案名（草案名∈选项时）', () => {
    expect(计算卷四五选择(['甲', '乙'], '甲', '丙').选中).toBe('甲');
    expect(计算卷四五选择(['甲', '乙'], '甲', null).选中).toBe('甲');
  });

  it('草案名也不在选项（含 undefined）→ 选中 null', () => {
    expect(计算卷四五选择(['甲', '乙'], '丙', null).选中).toBeNull();
    expect(计算卷四五选择(['甲', '乙'], undefined, null).选中).toBeNull();
    expect(计算卷四五选择(['甲', '乙'], undefined, '丁').选中).toBeNull();
  });

  it('输入数组不被改动（不可变）', () => {
    const 条目 = ['甲', '甲', '乙'];
    计算卷四五选择(条目, '甲', null);
    expect(条目).toEqual(['甲', '甲', '乙']);
  });
});
