import { describe, it, expect } from 'vitest';
import { chartRequestSchema } from '@/lib/chart/schema';
import { chartRequestSchema as uiSchema } from '@/utils/chart-request';

// /api/chart 请求 schema：全仓唯一权威源单测 + 冻结守卫。
// src/utils/chart-request.ts 现仅 re-export 本 schema（sec-m5 MEDIUM-1 统一双源）——
// 守卫升级为「同一对象」强断言：若有人再分叉出第二份 schema，此处立即红。

const 合法请求 = {
  姓氏: '李',
  母亲姓氏: '王',
  名字草案: '明晶', // lead 定稿：同含辈字「明」与指定字「晶」，双锁不撞字（任务 #45 协调）
  性别: '男',
  历法: '阳历',
  出生日期: '2025-01-01',
  时辰未知: false,
  出生时间: '12:00',
  经度: 116.4,
  城市: '北京',
  使用真太阳时: true,
  名字形式: '双名',
  辈字: { 字: '明', 位置: '第一' },
  指定字: { 字: '晶', 位置: '任一' }, // 契约 v3 双改：lead 定稿晶@任一（≠辈字明，防撞字）——fixture 与下方冻结键集必须同步
  避讳字: ['伟'],
  禁用字: ['屎'],
} as const;

describe('chartRequestSchema（服务端权威版）', () => {
  it('完整合法请求通过，default 生效', () => {
    const r = chartRequestSchema.parse(合法请求);
    expect(r.使用真太阳时).toBe(true);
    expect(r.避讳字).toEqual(['伟']);
  });

  it('最小请求（时辰未知）通过：出生时间可缺省，避讳字 default 空', () => {
    const r = chartRequestSchema.parse({
      姓氏: '李',
      性别: '女',
      历法: '阳历',
      出生日期: '2025-01-01',
      时辰未知: true,
      经度: 116.4,
      名字形式: '单名',
    });
    expect(r.出生时间).toBeUndefined();
    expect(r.避讳字).toEqual([]);
    expect(r.使用真太阳时).toBe(true);
  });

  it('refine：未勾选时辰未知必须给出生时间', () => {
    const rest = { ...合法请求 } as Record<string, unknown>;
    delete rest.出生时间;
    const r = chartRequestSchema.safeParse(rest);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.join('.') === '出生时间')).toBe(true);
    }
  });

  it('refine：辈字仅双名可用；草案第 N 字必须等于辈字', () => {
    expect(
      chartRequestSchema.safeParse({ ...合法请求, 名字形式: '单名', 名字草案: '明' }).success,
    ).toBe(false); // 单名 + 辈字
    const bad = chartRequestSchema.safeParse({ ...合法请求, 名字草案: '远明' });
    expect(bad.success).toBe(false);
    if (!bad.success) {
      // fixture 现为「明晶」双锁：远明 同时触 辈字+指定字 两issue，按 some 取辈字条（不锁 issue 次序）。
      expect(bad.error.issues.some((i) => i.message.includes('辈字「明」'))).toBe(true);
    }
  });

  it('refine：草案字数须与名字形式一致（单名 1 / 双名 2）', () => {
    expect(chartRequestSchema.safeParse({ ...合法请求, 名字形式: '单名', 名字草案: '明远', 辈字: undefined }).success).toBe(false);
    expect(chartRequestSchema.safeParse({ ...合法请求, 名字形式: '双名', 名字草案: '明', 辈字: undefined }).success).toBe(false);
  });

  it('枚举与范围：性别/历法/名字形式/经度/时间格式', () => {
    expect(chartRequestSchema.safeParse({ ...合法请求, 性别: '未知' }).success).toBe(false);
    expect(chartRequestSchema.safeParse({ ...合法请求, 历法: '儒略历' }).success).toBe(false);
    expect(chartRequestSchema.safeParse({ ...合法请求, 经度: 181 }).success).toBe(false);
    expect(chartRequestSchema.safeParse({ ...合法请求, 出生时间: '24:00' }).success).toBe(false);
    expect(chartRequestSchema.safeParse({ ...合法请求, 出生时间: '09:60' }).success).toBe(false);
    expect(chartRequestSchema.safeParse({ ...合法请求, 出生日期: '2025-1-1' }).success).toBe(false);
  });
});

describe('指定字 superRefine（契约 v3 §1.2 三规则，正反双向）', () => {
  it('规则1：草案不含指定字拒（路径=名字草案，消息含字）；含则过', () => {
    const bad = chartRequestSchema.safeParse({ ...合法请求, 指定字: { 字: '汐', 位置: '任一' } }); // 草案「明晶」无汐
    expect(bad.success).toBe(false);
    if (!bad.success) {
      const 项 = bad.error.issues.find((i) => i.path.join('.') === '名字草案');
      expect(项?.message).toContain('指定字「汐」');
    }
    expect(chartRequestSchema.safeParse(合法请求).success).toBe(true); // fixture：草案含晶
  });

  it('规则2：单名+第二拒；单名+任一/第一合法', () => {
    const 单名底 = { ...合法请求, 名字形式: '单名', 名字草案: '明', 辈字: undefined } as const;
    const bad = chartRequestSchema.safeParse({ ...单名底, 指定字: { 字: '明', 位置: '第二' } });
    expect(bad.success).toBe(false);
    if (!bad.success) {
      const 项 = bad.error.issues.find((i) => i.path.join('.') === '指定字');
      expect(项?.message).toContain('第二');
    }
    expect(chartRequestSchema.safeParse({ ...单名底, 指定字: { 字: '明', 位置: '任一' } }).success).toBe(true);
    expect(chartRequestSchema.safeParse({ ...单名底, 指定字: { 字: '明', 位置: '第一' } }).success).toBe(true);
  });

  it('规则3：与辈字同位异字拒；同字或异位过', () => {
    // 辈字明@第一 + 晶@第一（草案「明晶」同含两字，只触规则3不触规则1）
    const bad = chartRequestSchema.safeParse({ ...合法请求, 名字草案: '明晶', 指定字: { 字: '晶', 位置: '第一' } });
    expect(bad.success).toBe(false);
    if (!bad.success) {
      const 项 = bad.error.issues.find((i) => i.path.join('.') === '指定字');
      expect(项?.message).toContain('同位');
    }
    expect(chartRequestSchema.safeParse({ ...合法请求, 指定字: { 字: '明', 位置: '第一' } }).success).toBe(true); // 同字同位
    expect(chartRequestSchema.safeParse({ ...合法请求, 名字草案: '明晶', 指定字: { 字: '晶', 位置: '第二' } }).success).toBe(true); // 异位
  });

  it('位置缺省 default「任一」（契约 v3：default 进 schema 单点化）', () => {
    const r = chartRequestSchema.safeParse({ ...合法请求, 指定字: { 字: '明' } });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.指定字?.位置).toBe('任一');
  });
});

describe('排除已选（「重新生成」排重契约，任务 #28）', () => {
  it('合法名部串（1-4 汉字）通过；缺省时 default 为空数组（契约 v1.1）', () => {
    const ok = chartRequestSchema.safeParse({ ...合法请求, 排除已选: ['明远', '之', '欧阳婉兮'] });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.排除已选).toEqual(['明远', '之', '欧阳婉兮']);
    const 缺省 = chartRequestSchema.safeParse(合法请求);
    expect(缺省.success).toBe(true);
    if (缺省.success) expect(缺省.data.排除已选).toEqual([]);
  });

  it('非法项拒绝：非汉字 / 5 字 / 空串', () => {
    expect(chartRequestSchema.safeParse({ ...合法请求, 排除已选: ['明a'] }).success).toBe(false);
    expect(chartRequestSchema.safeParse({ ...合法请求, 排除已选: ['明远明远明'] }).success).toBe(false);
    expect(chartRequestSchema.safeParse({ ...合法请求, 排除已选: [''] }).success).toBe(false);
  });

  it('条数上限：300 合法 / 301 报「至多 300」', () => {
    const 汉字名 = (i: number): string => String.fromCharCode(0x4e00 + i); // 一-鿿 内互不相同单字
    const 满 = Array.from({ length: 300 }, (_, i) => 汉字名(i));
    expect(chartRequestSchema.safeParse({ ...合法请求, 排除已选: 满 }).success).toBe(true);
    const 超 = chartRequestSchema.safeParse({ ...合法请求, 排除已选: [...满, 汉字名(300)] });
    expect(超.success).toBe(false);
    if (!超.success) {
      expect(超.error.issues.some((i) => i.path.join('.') === '排除已选' && i.message.includes('300'))).toBe(true);
    }
  });
});

describe('UI 侧 re-export 冻结守卫（src/utils/chart-request.ts）', () => {
  it('UI 导出即服务端权威 schema 本体（杜绝再分叉双源）', () => {
    expect(uiSchema).toBe(chartRequestSchema);
  });

  it('冻结字段名全集（新增/改名字段须显式更新本用例）', () => {
    const keys = Object.keys(chartRequestSchema.parse(合法请求)).sort();
    expect(keys).toEqual(
      [
        '使用真太阳时', '出生时间', '出生日期', '名字草案', '名字形式', '姓氏', '城市',
        '母亲姓氏', '排除已选', '指定字', '历法', '时辰未知', '辈字', '避讳字', '禁用字', '经度', '性别',
      ].sort(),
    );
  });

  it('汉字白名单：非汉字姓氏/草案/避讳在 schema 层即拒（服务端不再有裸 string 面）', () => {
    expect(chartRequestSchema.safeParse({ ...合法请求, 姓氏: 'Smith' }).success).toBe(false);
    expect(chartRequestSchema.safeParse({ ...合法请求, 姓氏: '李‮' }).success).toBe(false); // RLO 伪装
    expect(chartRequestSchema.safeParse({ ...合法请求, 名字草案: 'a', 辈字: undefined }).success).toBe(false);
    expect(chartRequestSchema.safeParse({ ...合法请求, 避讳字: ['a'] }).success).toBe(false);
  });

  it('日历合法性/年份界/非未来在 schema 层拒（原「引擎兜底」口径废弃，两侧同锁）', () => {
    expect(chartRequestSchema.safeParse({ ...合法请求, 出生日期: '2025-13-01' }).success).toBe(false);
    expect(chartRequestSchema.safeParse({ ...合法请求, 出生日期: '2025-02-30' }).success).toBe(false);
    expect(chartRequestSchema.safeParse({ ...合法请求, 出生日期: '1899-01-01' }).success).toBe(false);
    expect(chartRequestSchema.safeParse({ ...合法请求, 出生日期: '2101-01-01' }).success).toBe(false);
    const future = new Date(Date.now() + 48 * 3600 * 1000).toISOString().slice(0, 10);
    expect(chartRequestSchema.safeParse({ ...合法请求, 出生日期: future }).success).toBe(false);
    // 农历的原始日期是农历串，公历回环不适用（由编排层库口径校验）——30 日不得误拒
    expect(
      chartRequestSchema.safeParse({ ...合法请求, 历法: '农历', 出生日期: '2025-02-30' }).success,
    ).toBe(true);
  });
});
