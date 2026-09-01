/**
 * 八字模块（lunar-typescript 封装）单测。
 *
 * 锚点选取原则：四柱锚点为公历→干支的确定映射，与流派无关（正午前后出生，
 * 不涉子时争议）；晚子时行为单独用「sect2 日柱不换日」的判别性质锁定。
 * - 2000-01-01 12:00 → 己卯 丙子 戊午 戊午（日主戊）
 * - 2008-08-08 12:00（北京 116.4°E，校正后仍在午时）→ 戊子 庚申 庚辰 壬午
 * - 1990-06-15 10:30（东经 120）男：阳年男顺行，起运 1997-11-25，首运癸未
 */
import { describe, expect, it } from 'vitest';
import { computeBazi, wuXingForceWeights } from '@/lib/bazi/bazi';
import { applyTrueSolarTime } from '@/lib/solar/true-solar-time';

const GAN = [...'甲乙丙丁戊己庚辛壬癸'];

/** 干之五行：甲乙木 丙丁火 戊己土 庚辛金 壬癸水。 */
function wuxingOf(gan: string): number {
  return Math.floor(GAN.indexOf(gan) / 2);
}

/** 独立实现的十神参考表（不经 LunarUtil），用于交叉校验模块输出。 */
function shiShen(dayGan: string, otherGan: string): string {
  const sameYinYang = GAN.indexOf(dayGan) % 2 === GAN.indexOf(otherGan) % 2;
  const rel = (wuxingOf(otherGan) - wuxingOf(dayGan) + 5) % 5; // 0同 1我生 2我克 3克我 4生我
  const names: Record<number, [string, string]> = {
    0: ['比肩', '劫财'],
    1: ['食神', '伤官'],
    2: ['偏财', '正财'],
    3: ['七杀', '正官'],
    4: ['偏印', '正印'],
  };
  return names[rel][sameYinYang ? 0 : 1];
}

describe('computeBazi 四柱锚点', () => {
  it('2000-01-01 12:00 东经120 → 己卯 丙子 戊午 戊午，日主戊', () => {
    const r = computeBazi({ 北京时间: '2000-01-01 12:00:00', 出生地经度: 120, 性别: '男' });
    expect(r.四柱.年.干支).toBe('己卯');
    expect(r.四柱.月.干支).toBe('丙子');
    expect(r.四柱.日.干支).toBe('戊午');
    expect(r.四柱.时!.干支).toBe('戊午');
    expect(r.日主).toBe('戊');
  });

  it('2008-08-08 12:00 北京116.4°E → 戊子 庚申 庚辰 壬午（校正后仍午时）', () => {
    const r = computeBazi({ 北京时间: '2008-08-08 12:00:00', 出生地经度: 116.4, 性别: '男' });
    expect(r.四柱.年.干支).toBe('戊子');
    expect(r.四柱.月.干支).toBe('庚申');
    expect(r.四柱.日.干支).toBe('庚辰');
    expect(r.四柱.时!.干支).toBe('壬午');
  });

  it('每柱输出完整：天干/地支/藏干/十神等长/纳音', () => {
    const r = computeBazi({ 北京时间: '2000-01-01 12:00:00', 出生地经度: 120, 性别: '女' });
    for (const which of ['年', '月', '日', '时'] as const) {
      const z = r.四柱[which]!;
      expect(z.天干.length).toBe(1);
      expect(z.地支.length).toBe(1);
      expect(z.干支).toBe(z.天干 + z.地支);
      expect(z.藏干.length).toBeGreaterThan(0);
      expect(z.十神.length).toBe(z.藏干.length);
      expect(z.纳音.length).toBeGreaterThan(0);
    }
    // 子藏癸、午藏丁己、卯藏乙
    expect(r.四柱.月.藏干).toEqual(['癸']);
    expect(r.四柱.日.藏干).toEqual(['丁', '己']);
    expect(r.四柱.年.藏干).toEqual(['乙']);
    // 日主戊见藏干十神：戊见丁=正印、戊见己=劫财、戊见癸=正财、戊见乙=正官
    expect(r.四柱.日.十神).toEqual(['正印', '劫财']);
    expect(r.四柱.月.十神).toEqual(['正财']);
    expect(r.四柱.年.十神).toEqual(['正官']);
  });

  it('纳音与干支对应：己卯→城头土', () => {
    const r = computeBazi({ 北京时间: '2000-01-01 12:00:00', 出生地经度: 120, 性别: '男' });
    expect(r.四柱.年.纳音).toBe('城头土');
  });
});

describe('computeBazi 真太阳时贯穿', () => {
  it('真太阳时字段 = solar 模块输出（原样透传）', () => {
    const input = { 北京时间: '2026-08-29 12:00:00', 出生地经度: 87.6, 性别: '男' } as const;
    const r = computeBazi(input);
    const s = applyTrueSolarTime(input.北京时间, input.出生地经度);
    expect(r.真太阳时.校正后本地时间).toBe(s.校正后本地时间);
    expect(r.真太阳时.校正分钟).toBe(s.校正分钟);
    expect(r.真太阳时.输入北京时间).toBe('2026-08-29 12:00:00');
    expect(r.真太阳时.地点经度).toBe(87.6);
  });

  it('时辰边界：乌鲁木齐出生按校正后时间定时辰，不按北京时间', () => {
    // 北京 12:00 在乌市校正后 ≈ 09:49 → 巳时（非午时）
    const r = computeBazi({ 北京时间: '2026-08-29 12:00:00', 出生地经度: 87.6, 性别: '男' });
    expect(r.四柱.时!.地支).toBe('巳');
  });

  it('时辰边界：11:00 东经120 校正后回拨出午时 → 巳时；11:12 校正后仍越过 11:00 → 午时', () => {
    const a = computeBazi({ 北京时间: '2026-08-29 11:00:00', 出生地经度: 120, 性别: '男' });
    const b = computeBazi({ 北京时间: '2026-08-29 11:12:00', 出生地经度: 120, 性别: '男' });
    expect(a.四柱.时!.地支).toBe('巳');
    expect(b.四柱.时!.地支).toBe('午');
  });

  it('使用真太阳时=false：校正分钟恒 0 + 未启用 标注，时柱按北京时间原值（乌市 12:00 → 午时非巳时）', () => {
    const r = computeBazi({
      北京时间: '2026-08-29 12:00:00',
      出生地经度: 87.6,
      性别: '男',
      使用真太阳时: false,
    });
    expect(r.真太阳时.校正分钟).toBe(0);
    expect(r.真太阳时.未启用).toBe(true);
    expect(r.真太阳时.校正后本地时间).toBe('2026-08-29 12:00:00');
    expect(r.四柱.时!.地支).toBe('午');
    // 默认（开）对照：同输入校正生效 → 巳时、无 未启用 键
    const on = computeBazi({ 北京时间: '2026-08-29 12:00:00', 出生地经度: 87.6, 性别: '男' });
    expect(on.真太阳时.未启用).toBeUndefined();
    expect(on.四柱.时!.地支).toBe('巳');
  });
});

describe('computeBazi 晚子时 sect2', () => {
  const base = { 出生地经度: 120, 性别: '男' } as const;

  it('23:30 出生标注 sect2_日不换；22:00 标注不涉及', () => {
    const late = computeBazi({ ...base, 北京时间: '2026-08-29 23:30:00' });
    const normal = computeBazi({ ...base, 北京时间: '2026-08-29 22:00:00' });
    expect(late.晚子时流派).toBe('sect2_日不换');
    expect(normal.晚子时流派).toBe('不涉及');
  });

  it('sect2 判别性质：23:30 日柱 = 当日 22:00 日柱（不换日）且 ≠ 次日 00:30 日柱', () => {
    const late = computeBazi({ ...base, 北京时间: '2026-08-29 23:30:00' });
    const sameDay = computeBazi({ ...base, 北京时间: '2026-08-29 22:00:00' });
    const earlyNext = computeBazi({ ...base, 北京时间: '2026-08-30 00:30:00' });
    expect(late.四柱.日.干支).toBe(sameDay.四柱.日.干支); // sect1 会换日 → 失败
    expect(late.四柱.日.干支).not.toBe(earlyNext.四柱.日.干支); // 次日早子时已进位
    // 夜子时仍排子时时柱
    expect(late.四柱.时!.地支).toBe('子');
    expect(sameDay.四柱.时!.地支).toBe('亥');
  });

  it('晚子时判定用校正后本地时间：北京 23:00 乌市校正后 ≈20:49 → 不涉及', () => {
    const r = computeBazi({ 北京时间: '2026-08-29 23:00:00', 出生地经度: 87.6, 性别: '男' });
    expect(r.晚子时流派).toBe('不涉及');
  });

  it('校正后落入 23 点同样判 sect2：北京 22:00 哈尔滨(128°E) → +32min−0.7 ≈ 22:31 不涉及（对照），北京 22:35 → 23:06 判 sect2', () => {
    const no = computeBazi({ 北京时间: '2026-08-29 22:00:00', 出生地经度: 128, 性别: '男' });
    const yes = computeBazi({ 北京时间: '2026-08-29 22:35:00', 出生地经度: 128, 性别: '男' });
    expect(no.晚子时流派).toBe('不涉及');
    expect(yes.晚子时流派).toBe('sect2_日不换');
  });
});

describe('computeBazi 五行力量', () => {
  // 己卯 丙子 戊午 戊午：干(除日主) 己土丙火戊戊土=100×3；
  // 月支子癸=120；年支卯乙=100；日/时支午(丁100 己40)×2
  // 木100 火300 土280 金0 水120，总分 800
  const r = computeBazi({ 北京时间: '2000-01-01 12:00:00', 出生地经度: 120, 性别: '男' });

  it('固定顺序 木火土金水，得分符合加权方案，总和 800', () => {
    expect(r.五行力量.map((f) => f.五行)).toEqual(['木', '火', '土', '金', '水']);
    const score = Object.fromEntries(r.五行力量.map((f) => [f.五行, f.得分]));
    expect(score).toEqual({ 木: 100, 火: 300, 土: 280, 金: 0, 水: 120 });
    expect(r.五行力量.reduce((s, f) => s + f.得分, 0)).toBe(800);
  });

  it('来源可解释：标签:权重 格式，含月支加权 120', () => {
    const water = r.五行力量.find((f) => f.五行 === '水')!;
    expect(water.来源).toContain('月支本气癸:120');
    for (const f of r.五行力量) {
      for (const s of f.来源) expect(s).toMatch(/^(年|月|日|时)(干|支(本气|中气|余气))[甲乙丙丁戊己庚辛壬癸]:\d+$/);
    }
  });

  it('五行缺失 = 得分为 0 者', () => {
    expect(r.五行缺失).toEqual(['金']);
  });

  it('权重常量对外可见（月支本气 120 > 年支本气 100 > 中气 > 余气）', () => {
    expect(wuXingForceWeights.月支本气).toBe(120);
    expect(wuXingForceWeights.他支本气).toBe(100);
    expect(wuXingForceWeights.月支中气).toBe(48);
    expect(wuXingForceWeights.月支余气).toBe(24);
    expect(wuXingForceWeights.月支中气).toBeGreaterThan(wuXingForceWeights.月支余气);
  });
});

describe('computeBazi 大运', () => {
  const male = computeBazi({ 北京时间: '1990-06-15 10:30:00', 出生地经度: 120, 性别: '男' });
  const female = computeBazi({ 北京时间: '1990-06-15 10:30:00', 出生地经度: 120, 性别: '女' });

  it('10 步大运，首运癸未（锚点），起运公历 1997-11-25，周岁 7', () => {
    expect(male.大运.length).toBe(10);
    expect(male.大运[0].干支).toBe('癸未');
    expect(male.大运[0].起于公历).toBe('1997-11-25');
    expect(male.大运[0].起于周岁).toBe(7);
    expect(male.大运[0].天干十神).toBe(shiShen(male.日主, '癸'));
  });

  /** 标准六十甲子表（干支同序步进，非 120 组合）。 */
  const jiaZi = Array.from({ length: 60 }, (_, i) => GAN[i % 10] + [...'子丑寅卯辰巳午未申酉戌亥'][i % 12]);

  it('每步起运公历严格 +10 年，干支在六十甲子上连续步进', () => {
    for (let i = 1; i < male.大运.length; i++) {
      expect(male.大运[i].起于周岁 - male.大运[i - 1].起于周岁).toBe(10);
      const prevYear = Number(male.大运[i - 1].起于公历.slice(0, 4));
      expect(male.大运[i].起于公历.slice(0, 4)).toBe(String(prevYear + 10));
      expect(male.大运[i].起于公历.slice(4)).toBe(male.大运[i - 1].起于公历.slice(4));
      const d = jiaZi.indexOf(male.大运[i].干支) - jiaZi.indexOf(male.大运[i - 1].干支);
      expect(((d % 60) + 60) % 60 === 1 || ((d % 60) + 60) % 60 === 59).toBe(true);
    }
  });

  it('男顺女逆（阳年男 forward、阳年女 backward）：首运不同且步进方向相反', () => {
    // 庚午年（阳年）男顺：月柱壬午 → 首运癸未（+1）
    expect(male.大运[0].干支).toBe('癸未');
    expect(jiaZi.indexOf(male.大运[0].干支) - jiaZi.indexOf('壬午')).toBe(1);
    // 女逆：首运辛巳（−1）
    expect(jiaZi.indexOf(female.大运[0].干支) - jiaZi.indexOf('壬午')).toBe(-1);
  });

  it('天干十神与独立参考表逐步一致（男顺女逆全部 20 步）', () => {
    for (const bu of [...male.大运, ...female.大运]) {
      expect(bu.干支.length).toBe(2);
      expect(bu.天干十神).toBe(shiShen(male.日主, bu.干支.charAt(0)));
    }
  });
});

describe('computeBazi 输入校验与不变量', () => {
  it('非法时间/经度抛错', () => {
    expect(() => computeBazi({ 北京时间: '1990-6-15 10:30:00', 出生地经度: 120, 性别: '男' })).toThrow();
    expect(() => computeBazi({ 北京时间: '1990-06-15 10:30:00', 出生地经度: 190, 性别: '男' })).toThrow(/经度/);
  });

  it('生产输出不带 双引擎一致性 字段', () => {
    const r = computeBazi({ 北京时间: '2000-01-01 12:00:00', 出生地经度: 120, 性别: '男' });
    expect(r.双引擎一致性).toBeUndefined();
  });

  it('纯函数：两次调用深相等', () => {
    const input = { 北京时间: '1990-06-15 10:30:00', 出生地经度: 116.4, 性别: '女' } as const;
    expect(computeBazi(input)).toEqual(computeBazi(input));
  });
});
