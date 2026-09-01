/**
 * geju.ts 测试：四形态手工核算 + 超81减80 + 三才查表 + 缺失/非法输入。
 * 手工算式全部在注释中留痕，笔画值经 shunshi-kangxi-core 实测核对。
 */
import { describe, it, expect } from 'vitest';

import { computeWuge, reduceShuli, WUGE_ORIGIN_NOTE } from '@/lib/wuge/geju';

describe('四形态手工核算', () => {
  it('单姓单名 王(4)+伟(偉11)：天5 人15 地12 外2 总15，三才 土土木/吉', () => {
    // 天=4+1=5；人=4+11=15；地=11+1=12；外：单姓单名恒2；总=4+11=15
    const r = computeWuge('王', '伟');
    expect(r).not.toBeNull();
    expect(r!.天格).toMatchObject({ 数理: 5, 康熙笔画和: 5, 吉凶: '大吉' });
    expect(r!.人格).toMatchObject({ 数理: 15, 吉凶: '大吉' });
    expect(r!.地格).toMatchObject({ 数理: 12, 吉凶: '凶' });
    expect(r!.外格).toMatchObject({ 数理: 2, 吉凶: '凶' });
    expect(r!.总格).toMatchObject({ 数理: 15, 吉凶: '大吉' });
    expect(r!.三才).toMatchObject({ 配置: '土土木', 吉凶: '吉' });
    expect(r!.三才.含义.length).toBeGreaterThan(5);
    expect(r!.明细).toEqual([
      { 简体: '王', 繁体: '王', 康熙笔画: 4 },
      { 简体: '伟', 繁体: '偉', 康熙笔画: 11 },
    ]);
  });

  it('单姓双名 张(張11)+伟杰(偉11/傑12)：天12 人22 地23 外13 总34，三才 木木火/大吉', () => {
    // 天=11+1=12；人=11+11=22；地=11+12=23；外=34-22+1=13；总=34
    const r = computeWuge('张', '伟杰');
    expect(r!.天格.数理).toBe(12);
    expect(r!.人格.数理).toBe(22);
    expect(r!.地格.数理).toBe(23);
    expect(r!.外格.数理).toBe(13);
    expect(r!.总格.数理).toBe(34);
    expect(r!.总格.吉凶).toBe('凶');
    expect(r!.三才).toMatchObject({ 配置: '木木火', 吉凶: '大吉' });
  });

  it('复姓双名 欧阳(歐15/陽17)+志伟(7/偉11)：天32 人24 地18 外27 总50，三才 木火金/凶', () => {
    // 天=15+17=32；人=17+7=24；地=7+11=18；外=50-24+1=27；总=50
    const r = computeWuge('欧阳', '志伟');
    expect(r!.天格.数理).toBe(32);
    expect(r!.人格.数理).toBe(24);
    expect(r!.地格.数理).toBe(18);
    expect(r!.外格.数理).toBe(27);
    expect(r!.总格).toMatchObject({ 数理: 50, 吉凶: '半吉' });
    expect(r!.三才).toMatchObject({ 配置: '木火金', 吉凶: '凶' });
    // 外格公式与日系「姓首+名末(=26)」流派相差 1，须留流派争议标注
    expect(r!.争议标注.some((s) => s.includes('外格') && s.includes('流派'))).toBe(true);
  });

  it('复姓单名 司马(馬10/司5)+光(6)：天15 人16 地7 外6 总21，三才 土土金/大吉', () => {
    // 天=5+10=15；人=10+6=16；地=6+1=7；外=21-16+1=6；总=21
    const r = computeWuge('司马', '光');
    expect(r!.天格.数理).toBe(15);
    expect(r!.人格.数理).toBe(16);
    expect(r!.地格.数理).toBe(7);
    expect(r!.外格.数理).toBe(6);
    expect(r!.总格).toMatchObject({ 数理: 21, 吉凶: '大吉' });
    expect(r!.三才).toMatchObject({ 配置: '土土金', 吉凶: '大吉' });
    // 复姓单名：总-人+1 = 姓首+1，与日系公式重合，无争议标注
    expect(r!.争议标注).toEqual([]);
  });
});

describe('数理化简：>81 减 80', () => {
  it('reduceShuli 边界', () => {
    expect(reduceShuli(81)).toBe(81);
    expect(reduceShuli(82)).toBe(2);
    expect(reduceShuli(106)).toBe(26);
    expect(reduceShuli(161)).toBe(81);
    expect(reduceShuli(162)).toBe(2);
    expect(reduceShuli(1)).toBe(1);
  });

  it('网格级：龘(48)+龘 人格 康熙笔画和96 → 数理16（大吉）', () => {
    const r = computeWuge('龘', '龘');
    expect(r!.人格).toMatchObject({ 康熙笔画和: 96, 数理: 16, 吉凶: '大吉' });
    expect(r!.总格).toMatchObject({ 康熙笔画和: 96, 数理: 16 });
  });
});

describe('契约与异常路径', () => {
  it('缺失字 → null（不出错误盘）', () => {
    expect(computeWuge('王', '𬀩')).toBeNull();
    expect(computeWuge('𬀩', '明')).toBeNull();
  });

  it('override 留痕进入争议标注：王+万里 → 人格含 7 画里', () => {
    const r = computeWuge('王', '万里');
    expect(r!.明细[1]).toEqual({ 简体: '万', 繁体: '萬', 康熙笔画: 15 });
    expect(r!.明细[2]).toEqual({ 简体: '里', 繁体: '里', 康熙笔画: 7 });
    // 人格 = 姓末(王4) + 名首(万15) = 19
    expect(r!.人格).toMatchObject({ 数理: 19, 康熙笔画和: 19 });
    expect(r!.争议标注.some((s) => s.includes('里'))).toBe(true);
  });

  it('非法输入抛错：姓 0/3 字、名 0/3 字', () => {
    expect(() => computeWuge('', '明')).toThrow();
    expect(() => computeWuge('司马欧', '明')).toThrow();
    expect(() => computeWuge('王', '')).toThrow();
    expect(() => computeWuge('王', '伟杰明')).toThrow();
  });

  it('起源争议提示固定文案', () => {
    const r = computeWuge('王', '伟');
    expect(r!.五格起源争议提示).toBe(WUGE_ORIGIN_NOTE);
    expect(WUGE_ORIGIN_NOTE).toContain('熊崎健翁');
    expect(WUGE_ORIGIN_NOTE).toContain('非中国传统');
  });
});
