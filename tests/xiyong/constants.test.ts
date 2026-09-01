/**
 * constants 钉表测试（净分制，喜用神算法修复 C.2）：
 * 分值表/档位线/钳位/力量权重/最小查表逐值钉死——改任何一分都必须连注释里的命理依据一起改。
 */
import { describe, expect, it } from 'vitest';
import {
  DELING_CENG_RATIO,
  DELING_FEN,
  DELING_QUAN,
  DEDI_FEN,
  DEDI_QUAN,
  DESHI_FEN,
  DESHI_FLOOR,
  DESHI_QUAN,
  FENDANG_TIERS,
  FORCE_WEIGHTS,
  GAN_WUXING,
  KE,
  SANHUI_ZHI,
  SANHE_ZHI,
  SHENG,
  WUXING_ORDER,
  YOUXIAN_MONTHS,
  ZHI_CANGGAN,
  fenDang,
} from '@/lib/xiyong/constants';

describe('基础镜像表', () => {
  it('五行序固定为 木火土金水', () => {
    expect([...WUXING_ORDER]).toEqual(['木', '火', '土', '金', '水']);
  });

  it('天干五行十字齐备', () => {
    expect(Object.keys(GAN_WUXING)).toHaveLength(10);
    expect(GAN_WUXING['甲']).toBe('木');
    expect(GAN_WUXING['癸']).toBe('水');
  });

  it('地支藏干：本气在前，午丁己 / 丑己癸辛 / 戌戊辛丁', () => {
    expect(ZHI_CANGGAN['午']).toEqual(['丁', '己']);
    expect(ZHI_CANGGAN['丑']).toEqual(['己', '癸', '辛']);
    expect(ZHI_CANGGAN['戌']).toEqual(['戊', '辛', '丁']);
    expect(ZHI_CANGGAN['子']).toEqual(['癸']);
  });

  it('生克环自洽（同一五行生克各恰一目标）', () => {
    for (const x of WUXING_ORDER) {
      expect(WUXING_ORDER).toContain(SHENG[x]);
      expect(WUXING_ORDER).toContain(KE[x]);
      expect(SHENG[x]).not.toBe(KE[x]);
    }
    expect(SHENG['木']).toBe('火');
    expect(KE['水']).toBe('火');
  });
});

describe('得令净分表（带符号）', () => {
  it('同我+45 生我+35 我生0 我克−15 克我−30', () => {
    expect({ ...DELING_FEN }).toEqual({ 同我: 45, 生我: 35, 我生: 0, 我克: -15, 克我: -30 });
  });

  it('中/余气折减系数仅 0.5/0.25（只作用于负分侧，逻辑在 wangshuai 钉行为）', () => {
    expect({ ...DELING_CENG_RATIO }).toEqual({ 中气: 0.5, 余气: 0.25 });
  });

  it('得令满分基准 = 同我主气 45', () => {
    expect(DELING_QUAN).toBe(DELING_FEN['同我']);
  });
});

describe('得地计分表（旧口径不动）', () => {
  it('日支加重、月支主气 0 分（月令之功归得令）', () => {
    expect(DEDI_FEN['日']).toEqual({ 主气: 12, 中气: 6, 余气: 3 });
    expect(DEDI_FEN['月']).toEqual({ 主气: 0, 中气: 3, 余气: 2 });
    expect(DEDI_FEN['年']).toEqual({ 主气: 8, 中气: 4, 余气: 2 });
    expect(DEDI_FEN['时']).toEqual({ 主气: 8, 中气: 4, 余气: 2 });
    expect(DEDI_QUAN).toBe(30);
  });
});

describe('得势净分表（克泄耗为负 + 钳位）', () => {
  it('十神×贴隔钉值：比劫8/6 印6/5 官杀−8/−6 财−6/−4 食伤−5/−3，无根生扶支+4', () => {
    expect(DESHI_FEN['比劫']).toEqual({ 贴: 8, 隔: 6 });
    expect(DESHI_FEN['印星']).toEqual({ 贴: 6, 隔: 5 });
    expect(DESHI_FEN['官杀']).toEqual({ 贴: -8, 隔: -6 });
    expect(DESHI_FEN['财星']).toEqual({ 贴: -6, 隔: -4 });
    expect(DESHI_FEN['食伤']).toEqual({ 贴: -5, 隔: -3 });
    expect(DESHI_FEN['无根生扶支']).toBe(4);
  });

  it('生扶类为正、克泄耗类为负；净额钳位 [−30,30]', () => {
    for (const 类 of ['比劫', '印星'] as const) {
      expect(DESHI_FEN[类]['贴']).toBeGreaterThan(0);
    }
    for (const 类 of ['官杀', '财星', '食伤'] as const) {
      expect(DESHI_FEN[类]['贴']).toBeLessThan(0);
      expect(DESHI_FEN[类]['隔']).toBeGreaterThan(DESHI_FEN[类]['贴']); // 隔力减
    }
    expect(DESHI_QUAN).toBe(30);
    expect(DESHI_FLOOR).toBe(-30);
  });
});

describe('档位线（净分制重钉）与 fenDang', () => {
  it('五档下限降序：55/20/−15/−45/−60', () => {
    expect(FENDANG_TIERS.map(([, 级]) => 级)).toEqual(['身强', '偏强', '中和', '偏弱', '身弱']);
    expect(FENDANG_TIERS.map(([下]) => 下)).toEqual([55, 20, -15, -45, -60]);
  });

  it.each([
    [105, '身强'],
    [55, '身强'],
    [54.99, '偏强'],
    [21.25, '偏强'], // F3 盘实算值：钉档依据（任务书 F3∈{偏强,身强}）
    [20, '偏强'],
    [19.99, '中和'],
    [-15, '中和'],
    [-15.01, '偏弱'],
    [-45, '偏弱'],
    [-45.01, '身弱'],
    [-60, '身弱'],
    [-1e3, '身弱'], // 末档兜底
  ])('fenDang(%o) = %s', (分, 级) => {
    expect(fenDang(分)).toBe(级);
  });
});

describe('调候优先月支（冬夏六月）', () => {
  it('亥子丑巳午未', () => {
    expect([...YOUXIAN_MONTHS]).toEqual(['亥', '子', '丑', '巳', '午', '未']);
  });
});

describe('力量权重与格局门最小查表', () => {
  it('干100 月支本120/中48/余24 他支本100/中40/余20（bazi.ts 同源）', () => {
    expect({ ...FORCE_WEIGHTS }).toEqual({
      干: 100,
      月支本气: 120,
      月支中气: 48,
      月支余气: 24,
      他支本气: 100,
      他支中气: 40,
      他支余气: 20,
    });
  });

  it('三合局：寅午戌火 亥卯未木 巳酉丑金 申子辰水', () => {
    for (const z of ['寅', '午', '戌']) expect(SANHE_ZHI[z]).toBe('火');
    for (const z of ['亥', '卯', '未']) expect(SANHE_ZHI[z]).toBe('木');
    for (const z of ['巳', '酉', '丑']) expect(SANHE_ZHI[z]).toBe('金');
    for (const z of ['申', '子', '辰']) expect(SANHE_ZHI[z]).toBe('水');
  });

  it('三会方：寅卯辰木 巳午未火 申酉戌金 亥子丑水', () => {
    for (const z of ['寅', '卯', '辰']) expect(SANHUI_ZHI[z]).toBe('木');
    for (const z of ['巳', '午', '未']) expect(SANHUI_ZHI[z]).toBe('火');
    for (const z of ['申', '酉', '戌']) expect(SANHUI_ZHI[z]).toBe('金');
    for (const z of ['亥', '子', '丑']) expect(SANHUI_ZHI[z]).toBe('水');
  });
});
