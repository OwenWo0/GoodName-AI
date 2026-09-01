/**
 * UI 请求层单测：schema 经 re-export 自服务端权威源（src/lib/chart/schema.ts，
 * 双源已统一，权威口径用例见 tests/chart/schema.test.ts）；本文件守 UI 侧消费面
 * （表单用到的字段形态/辅助函数）。草案语义=名部分不含姓（与引擎 computeWuge 同口径）。
 */
import { describe, expect, it } from 'vitest';
import { CITIES, chartRequestSchema, splitHanChars, type ChartRequest } from '@/utils/chart-request';

const BASE: ChartRequest = {
  姓氏: '林',
  性别: '男',
  历法: '阳历',
  出生日期: '2026-03-15',
  时辰未知: false,
  出生时间: '08:30',
  经度: 121.47,
  使用真太阳时: true,
  名字形式: '双名',
  避讳字: [],
  排除已选: [], // 契约 v1.1：default([]) 后为输出必填字段
};

const errorsOf = (input: unknown): string[] => {
  const r = chartRequestSchema.safeParse(input);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
};

describe('chartRequestSchema', () => {
  it('最小合法集通过', () => {
    expect(errorsOf(BASE)).toEqual([]);
  });

  it('全字段扩展形态通过（农历闰月/母亲姓氏/辈字/禁用字/夏令时）', () => {
    expect(
      errorsOf({
        ...BASE,
        母亲姓氏: '陈',
        名字草案: '知予', // 名部分（不含姓），双名 2 字，首字=辈字「知」
        历法: '农历',
        闰月: true,
        夏令时: false,
        城市: '上海',
        辈字: { 字: '知', 位置: '第一' },
        避讳字: ['伟', '强'],
        禁用字: ['彪'],
      }),
    ).toEqual([]);
  });

  it('未勾时辰未知而缺出生时间 → 出生时间报错', () => {
    const withoutTime: Partial<ChartRequest> = { ...BASE };
    delete withoutTime.出生时间;
    expect(errorsOf(withoutTime).join()).toContain('出生时间');
  });

  it('勾了时辰未知可免出生时间', () => {
    const withoutTime: Partial<ChartRequest> = { ...BASE };
    delete withoutTime.出生时间;
    expect(errorsOf({ ...withoutTime, 时辰未知: true })).toEqual([]);
  });

  it('闰月仅农历可用', () => {
    expect(errorsOf({ ...BASE, 闰月: true }).join()).toContain('闰月');
  });

  it('非法日期/越界年份/未来日期被拒', () => {
    expect(errorsOf({ ...BASE, 出生日期: '2026-02-30' }).join()).toContain('有效日期');
    expect(errorsOf({ ...BASE, 出生日期: '1899-01-01' }).join()).toContain('1900-2100');
    expect(errorsOf({ ...BASE, 出生日期: '2035-01-01' }).join()).toContain('不能晚于今天');
    expect(errorsOf({ ...BASE, 出生日期: '2026-3-5' }).join()).toContain('YYYY-MM-DD');
  });

  it('姓氏 1-2 汉字；出生时间格式；经度边界', () => {
    expect(errorsOf({ ...BASE, 姓氏: '欧阳柯' }).join()).toContain('姓氏');
    expect(errorsOf({ ...BASE, 姓氏: '林林' })).toEqual([]);
    expect(errorsOf({ ...BASE, 出生时间: '8:30' }).join()).toContain('HH:mm');
    expect(errorsOf({ ...BASE, 出生时间: '24:00' }).join()).toContain('HH:mm');
    expect(errorsOf({ ...BASE, 经度: 190 }).join()).toContain('经度');
  });

  it('避讳字须为单字', () => {
    expect(errorsOf({ ...BASE, 避讳字: ['伟大'] }).join()).toContain('避讳字');
  });
});

describe('splitHanChars', () => {
  it('提取汉字、去重保序、丢弃非汉字', () => {
    expect(splitHanChars('伟、强 強a伟')).toEqual(['伟', '强', '強']);
    expect(splitHanChars('abc')).toEqual([]);
  });
  it('上限 30', () => {
    const s = Array.from({ length: 40 }, (_, i) => String.fromCharCode(0x4e00 + i)).join('');
    expect(splitHanChars(s)).toHaveLength(30);
  });
});

describe('CITIES', () => {
  it('预设城市经度合法且含沪', () => {
    expect(CITIES.some((c) => c.名 === '上海' && c.经度 === 121.47)).toBe(true);
    for (const c of CITIES) expect(c.经度).toBeGreaterThanOrEqual(-180);
  });
});
