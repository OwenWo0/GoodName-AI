/**
 * 组抽卡载荷（/draw 工作台导出纯函数）单测（A6 转交登记项②补位）：
 * 契约口径——空约束省键（性别/名字形式恒带，五行偏好/指定字/避讳/禁用/排除已选
 * 空则不带键，走服务端 default）；姓氏/指定字 trim；避讳/禁用经 splitHanChars 只留汉字；
 * 数组出参拷贝且不改入参（不可变纪律）。
 * 载法：oxc jsx=automatic 配置就位后 .tsx 可静态直载（同 xiyong-source.test.ts 现况）。
 */
import { describe, expect, it } from 'vitest';
import { 组抽卡载荷 } from '@/components/draw-workbench';
import type { WuXing } from '@/lib/types';

type 表单 = Parameters<typeof 组抽卡载荷>[0];

const 底: 表单 = {
  姓氏: '李',
  性别: '男',
  名字形式: '双名',
  指定字文本: '',
  指定字位置: '任一',
  避讳字文本: '',
  禁用字文本: '',
  五行偏好: [],
};

describe('组抽卡载荷', () => {
  it('空约束 → 仅三键（性别/名字形式恒带，余省键走服务端 default）', () => {
    expect(组抽卡载荷(底, [])).toEqual({ 姓氏: '李', 性别: '男', 名字形式: '双名' });
  });

  it('姓氏 trim；指定字空白文本省键、非空则带 字+位置', () => {
    expect(组抽卡载荷({ ...底, 姓氏: '  欧阳 ' }, []).姓氏).toBe('欧阳');
    expect(组抽卡载荷({ ...底, 指定字文本: '   ' }, [])).not.toHaveProperty('指定字');
    expect(组抽卡载荷({ ...底, 指定字文本: ' 晶 ', 指定字位置: '第一' }, []).指定字).toEqual({
      字: '晶',
      位置: '第一',
    });
  });

  it('避讳/禁用只留汉字拆字；全非汉字 → 省键', () => {
    const 载荷 = 组抽卡载荷({ ...底, 避讳字文本: 'a伟b明', 禁用字文本: '屎,' }, []);
    expect(载荷.避讳字).toEqual(['伟', '明']);
    expect(载荷.禁用字).toEqual(['屎']);
    expect(组抽卡载荷({ ...底, 避讳字文本: 'ab123' }, [])).not.toHaveProperty('避讳字');
  });

  it('五行偏好不勾省键（=不限）；勾选则透传数组', () => {
    expect(组抽卡载荷(底, [])).not.toHaveProperty('五行偏好');
    expect(组抽卡载荷({ ...底, 五行偏好: ['水', '木'] }, []).五行偏好).toEqual(['水', '木']);
  });

  it('排除已选：空省键；非空原样入键（历批并集由调用方累积）', () => {
    expect(组抽卡载荷(底, [])).not.toHaveProperty('排除已选');
    expect(组抽卡载荷(底, ['武鸿', '明月'])).toMatchObject({ 排除已选: ['武鸿', '明月'] });
  });

  it('不改入参且数组出参为拷贝（不可变）', () => {
    const 偏好: WuXing[] = ['水'];
    const 输入: 表单 = { ...底, 五行偏好: 偏好 };
    const 排除: string[] = ['鸿'];
    const 载荷 = 组抽卡载荷(输入, 排除);
    载荷.五行偏好?.push('火');
    载荷.排除已选?.push('武');
    expect(偏好).toEqual(['水']);
    expect(排除).toEqual(['鸿']);
  });
});
