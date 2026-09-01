/**
 * 时辰未知降级用例：北京时间=null + 出生日期 入口。
 *
 * 锚点与 bazi.test.ts 同源：2000-01-01（东经120）→ 己卯 丙子 戊午（时柱缺位）。
 * 正午近似约定：以出生日期当日 12:00 校正后排年月日三柱，时柱整体 null。
 */
import { describe, expect, it } from 'vitest';
import { computeBazi } from '@/lib/bazi/bazi';
import { applyTrueSolarTime } from '@/lib/solar/true-solar-time';

const GAN = [...'甲乙丙丁戊己庚辛壬癸'];

/** 地支本气表（独立参考，锁死大运地支十神）。 */
const BENQI: Record<string, string> = {
  子: '癸', 丑: '己', 寅: '甲', 卯: '乙', 辰: '戊', 巳: '丙',
  午: '丁', 未: '己', 申: '庚', 酉: '辛', 戌: '戊', 亥: '壬',
};

function wuxingOf(gan: string): number {
  return Math.floor(GAN.indexOf(gan) / 2);
}

/** 独立实现的十神参考表（与 bazi.test.ts 同口径）。 */
function shiShen(dayGan: string, otherGan: string): string {
  const sameYinYang = GAN.indexOf(dayGan) % 2 === GAN.indexOf(otherGan) % 2;
  const rel = (wuxingOf(otherGan) - wuxingOf(dayGan) + 5) % 5;
  const names: Record<number, [string, string]> = {
    0: ['比肩', '劫财'],
    1: ['食神', '伤官'],
    2: ['偏财', '正财'],
    3: ['七杀', '正官'],
    4: ['偏印', '正印'],
  };
  return names[rel][sameYinYang ? 0 : 1];
}

const 未知输入 = { 北京时间: null, 出生日期: '2000-01-01', 出生地经度: 120, 性别: '男' } as const;

describe('时辰未知 三柱与时柱缺位', () => {
  const r = computeBazi(未知输入);
  const noon = computeBazi({ 北京时间: '2000-01-01 12:00:00', 出生地经度: 120, 性别: '男' });

  it('年月日三柱与当日正午已知时刻一致，时柱为 null', () => {
    expect(r.四柱.年.干支).toBe('己卯');
    expect(r.四柱.月.干支).toBe('丙子');
    expect(r.四柱.日.干支).toBe('戊午');
    expect(r.四柱.时).toBeNull();
    expect(r.四柱.年.干支).toBe(noon.四柱.年.干支);
    expect(r.四柱.月.干支).toBe(noon.四柱.月.干支);
    expect(r.四柱.日.干支).toBe(noon.四柱.日.干支);
  });

  it('日主仍取日干；晚子时流派为不涉及；时辰未知提示存在且写明三大影响', () => {
    expect(r.日主).toBe('戊');
    expect(r.晚子时流派).toBe('不涉及');
    expect(r.时辰未知提示).toBeDefined();
    expect(r.时辰未知提示).toMatch(/时柱/);
    expect(r.时辰未知提示).toMatch(/起运|大运/);
    expect(r.时辰未知提示).toMatch(/交界/);
  });

  it('已知时刻时无降级字段污染（提示 undefined、正午近似 undefined）', () => {
    expect(noon.时辰未知提示).toBeUndefined();
    expect(noon.真太阳时.正午近似).toBeUndefined();
    expect(noon.起运精准?.时辰未知近似).toBeUndefined();
  });

  it('时辰未知时必须提供合法出生日期，否则抛错', () => {
    expect(() =>
      computeBazi({ 北京时间: null, 出生地经度: 120, 性别: '男' }),
    ).toThrow(/出生日期/);
    expect(() =>
      computeBazi({ 北京时间: null, 出生日期: '2000-1-1', 出生地经度: 120, 性别: '男' }),
    ).toThrow(/出生日期|格式/);
    expect(() =>
      computeBazi({ 北京时间: null, 出生日期: '2000-02-30', 出生地经度: 120, 性别: '男' }),
    ).toThrow(/日期/);
  });
});

describe('时辰未知 真太阳时正午近似', () => {
  it('两时间字段 null、正午近似 true、校正分钟 = 当日 12:00 校正值', () => {
    const r = computeBazi(未知输入);
    const s = applyTrueSolarTime('2000-01-01 12:00:00', 120);
    expect(r.真太阳时.输入北京时间).toBeNull();
    expect(r.真太阳时.校正后本地时间).toBeNull();
    expect(r.真太阳时.正午近似).toBe(true);
    expect(r.真太阳时.校正分钟).toBe(s.校正分钟);
    expect(r.真太阳时.地点经度).toBe(120);
  });
});

describe('时辰未知 五行力量不含时柱', () => {
  const r = computeBazi(未知输入);

  it('只计年月日三柱：无时干/时支来源，总分 = 全盘 800 − 时柱戊午 240 = 560', () => {
    for (const f of r.五行力量) {
      for (const s of f.来源) expect(s).not.toMatch(/^时(干|支)/);
    }
    const score = Object.fromEntries(r.五行力量.map((f) => [f.五行, f.得分]));
    // 已知全盘：木100 火300 土280 金0 水120；时柱戊午贡献 戊100 + 丁100 + 己40
    expect(score).toEqual({ 木: 100, 火: 200, 土: 140, 金: 0, 水: 120 });
    expect(r.五行力量.reduce((s, f) => s + f.得分, 0)).toBe(560);
  });

  it('每一项来源带「时辰未知未计」标注（可解释性）', () => {
    for (const f of r.五行力量) {
      expect(f.来源).toContain('时辰未知未计');
    }
  });
});

describe('时辰未知 起运与起运精准', () => {
  const 已知 = computeBazi({ 北京时间: '1990-06-15 10:30:00', 出生地经度: 120, 性别: '男' });
  const 未知 = computeBazi({
    北京时间: null,
    出生日期: '1990-06-15',
    出生地经度: 120,
    性别: '男',
  });

  it('时间已知：起运精准输出「X年X个月X天X小时后」+ 交运公历 = 首运起于公历（锚点 1997-11-25）', () => {
    expect(已知.起运精准).toBeDefined();
    expect(已知.起运精准!.出生后时长).toMatch(/^\d+年\d+个月\d+天\d+小时后$/);
    expect(已知.起运精准!.交运公历).toBe('1997-11-25');
    expect(已知.起运精准!.交运公历).toBe(已知.大运[0].起于公历);
  });

  it('时辰未知：同样输出时长与交运，但 时辰未知近似 true，交运 = 首运起于公历', () => {
    expect(未知.起运精准!.出生后时长).toMatch(/^\d+年\d+个月\d+天\d+小时后$/);
    expect(未知.起运精准!.时辰未知近似).toBe(true);
    expect(未知.起运精准!.交运公历).toBe(未知.大运[0].起于公历);
  });

  it('大运每步补地支十神 = 地支本气对日主十神（男顺女逆+时辰未知全部步，独立表交叉）', () => {
    const 女 = computeBazi({ 北京时间: '1990-06-15 10:30:00', 出生地经度: 120, 性别: '女' });
    // 三组输入同日（1990-06-15），日主相同
    expect(女.日主).toBe(已知.日主);
    expect(未知.日主).toBe(已知.日主);
    for (const bu of [...已知.大运, ...女.大运, ...未知.大运]) {
      const zhi = bu.干支.charAt(1);
      expect(bu.地支十神).toBe(shiShen(已知.日主, BENQI[zhi]));
    }
    // 锚点：1990-06-15 日主辛，见首运癸未（未本气己，己土生辛金、阴阳同）→ 偏印
    expect(已知.日主).toBe('辛');
    expect(已知.大运[0].干支).toBe('癸未');
    expect(已知.大运[0].地支十神).toBe('偏印');
  });
});

describe('时辰未知 纯函数性', () => {
  it('两次调用深相等（含未知与已知两种入口）', () => {
    expect(computeBazi(未知输入)).toEqual(computeBazi(未知输入));
    const known = { 北京时间: '2000-01-01 12:00:00', 出生地经度: 120, 性别: '男' } as const;
    expect(computeBazi(known)).toEqual(computeBazi(known));
  });
});
