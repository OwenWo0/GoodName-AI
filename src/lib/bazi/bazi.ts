/**
 * 八字模块：lunar-typescript 封装，输出 types.ts 的 BaziResult 契约。
 *
 * 流程：①真太阳时校正（solar 模块）→ ②校正后本地时间进 Solar.fromYmdHms
 * → ③EightChar.setSect(2)（晚子时 23:00–23:59 日柱不换日，标注 sect2_日不换）
 * → ④四柱/日主/藏干/十神/纳音 → ⑤五行力量表（加权见 wuXingForceWeights）
 * → ⑥大运（阴阳年男女顺逆交给库的 Yun；起运计算用库默认 sect=1 日辰法）。
 *
 * 十神、藏干、五行映射全部复用 LunarUtil，与 lunar-typescript 输出口径一致。
 *
 * 时辰未知降级：北京时间=null 时以出生日期当日 12:00 排盘（正午近似），
 * 四柱.时 整体缺位、起运按正午近似推算，影响范围写入 时辰未知提示。
 */
import { Solar, LunarUtil } from 'lunar-typescript';
import type { EightChar, Yun } from 'lunar-typescript';
import { applyTrueSolarTime, parseBeiJingDateTime } from '../solar/true-solar-time';
import type { BeiJingParts } from '../solar/true-solar-time';
import type { BaziResult, DaYunBu, WuXing, WuXingForce, Zhu } from '../types';
import { FORCE_WEIGHTS } from '../xiyong/constants';

/** 八字排盘输入。 */
export interface BaziInput {
  /** 北京时间 YYYY-MM-DD HH:mm:ss；null = 时辰未知（需同时提供 出生日期，走正午近似降级） */
  北京时间: string | null;
  /** 出生日期 YYYY-MM-DD；仅 北京时间=null 时必填，其余情况忽略 */
  出生日期?: string;
  /** 出生地东经度（东经为正） */
  出生地经度: number;
  性别: '男' | '女';
  /** false = 用户关闭真太阳时，按北京时间原值排盘（校正分钟恒 0）；默认 true。 */
  使用真太阳时?: boolean;
}

/**
 * 五行力量加权方案（可解释性设计，总分随四柱藏干数浮动，示例满分 800）：
 * - 年/月/时干各 100（日干即日主本身，不计分）；
 * - 月支为令神所在，权重上浮：本气 120 / 中气 48 / 余气 24；
 * - 年/日/时支：本气 100 / 中气 40 / 余气 20。
 * 月令本气 > 非月令本气 > 中气 > 余气，符合「得令为重」的子平常法。
 * 权重表与 xiyong 格局门的力量对比同源（xiyong/constants.FORCE_WEIGHTS），
 * 喜用神算法修复 C.2：两模块各钉一份会漂移，故此处指向单一事实源。
 */
export const wuXingForceWeights = FORCE_WEIGHTS;

/** 五行力量表固定输出顺序。 */
const WU_XING_ORDER: WuXing[] = ['木', '火', '土', '金', '水'];

/** 藏干三位的气名。 */
const QI_NAMES = ['本气', '中气', '余气'] as const;

/** 干之五行（复用 LunarUtil，保证与库输出口径一致）。 */
function wuXingOfGan(gan: string): WuXing {
  return LunarUtil.WU_XING_GAN[gan] as WuXing;
}

/** 日主与他干的十神（LunarUtil 键为「日干+他干」两字串）。 */
function shiShenOfGan(dayGan: string, otherGan: string): string {
  const v = LunarUtil.SHI_SHEN[dayGan + otherGan];
  if (!v) throw new Error(`十神查表失败：日主${dayGan} 见 ${otherGan}`);
  return v;
}

/** 四柱取值器：每柱的干/支/藏干/十神组/纳音 getter 集合。 */
interface PillarGetters {
  gan: string;
  zhi: string;
  hideGan: string[];
  shiShenZhi: string[];
  naYin: string;
}

/** 组装一柱（Zhu）。十神数组与藏干等长（库保证）。 */
function buildZhu(g: PillarGetters): Zhu {
  if (g.shiShenZhi.length !== g.hideGan.length) {
    throw new Error(`库异常：藏干与十神长度不一致 ${g.hideGan}/${g.shiShenZhi}`);
  }
  return {
    天干: g.gan,
    地支: g.zhi,
    干支: g.gan + g.zhi,
    藏干: [...g.hideGan],
    十神: [...g.shiShenZhi],
    纳音: g.naYin,
  };
}

/** 单条五行贡献（内部结构）。 */
interface ForceContribution {
  五行: WuXing;
  得分: number;
  来源: string; // 形如 月支本气癸:120 / 年干丙:100
}

/**
 * 收集四柱全部五行贡献：年/月/时三干（日干即日主，不计分）+ 四支藏干。
 * 时辰未知（时=null）时时柱整体跳过——五行力量只计年月日三柱。
 */
function collectContributions(pillars: BaziResult['四柱']): ForceContribution[] {
  const out: ForceContribution[] = [];
  for (const name of ['年', '月', '时'] as const) {
    const gan = pillars[name]?.天干;
    if (gan === undefined) continue;
    out.push({
      五行: wuXingOfGan(gan),
      得分: wuXingForceWeights.干,
      来源: `${name}干${gan}:${wuXingForceWeights.干}`,
    });
  }
  for (const name of ['年', '月', '日', '时'] as const) {
    const zhi = pillars[name];
    if (!zhi) continue;
    const weights =
      name === '月'
        ? [wuXingForceWeights.月支本气, wuXingForceWeights.月支中气, wuXingForceWeights.月支余气]
        : [wuXingForceWeights.他支本气, wuXingForceWeights.他支中气, wuXingForceWeights.他支余气];
    zhi.藏干.forEach((gan, i) => {
      const w = weights[Math.min(i, 2)];
      out.push({
        五行: wuXingOfGan(gan),
        得分: w,
        来源: `${name}支${QI_NAMES[Math.min(i, 2)]}${gan}:${w}`,
      });
    });
  }
  return out;
}

/** 时辰未知标注：五行力量每项来源追加「时辰未知未计」（时柱贡献整体缺位，可解释性）。 */
function markShichenUnknown(forces: WuXingForce[]): WuXingForce[] {
  return forces.map((f) => ({ ...f, 来源: [...f.来源, '时辰未知未计'] }));
}

/** 按固定 木火土金水 顺序聚合成五行力量表。 */
function aggregateForces(contributions: ForceContribution[]): WuXingForce[] {
  return WU_XING_ORDER.map((element) => {
    const hits = contributions.filter((c) => c.五行 === element);
    return {
      五行: element,
      得分: hits.reduce((s, c) => s + c.得分, 0),
      来源: hits.map((c) => c.来源),
    };
  });
}

/** 周岁 = 起始年 − 出生年，生日未到再减一（纯日期比较，不含时区）。 */
function zhouSui(birth: BeiJingParts, start: { year: number; month: number; day: number }): number {
  let age = start.year - birth.year;
  if (start.month < birth.month || (start.month === birth.month && start.day < birth.day)) {
    age -= 1;
  }
  return age;
}

/** 地支本气藏干（复用 LunarUtil 同一张表，与 Zhu.藏干 首字同口径）。 */
function benqiOfZhi(zhi: string): string {
  const hide = LunarUtil.ZHI_HIDE_GAN[zhi];
  if (!hide || hide.length === 0) throw new Error(`地支藏干查表失败：${zhi}`);
  return hide[0];
}

/** 时辰未知降级提示（影响范围三要点：时柱五行、起运精度、交界存疑）。 */
const SHICHEN_UNKNOWN_HINT =
  '时辰未知：以出生日期当日正午（12:00）正午近似排盘。影响范围：' +
  '① 时柱整体缺位，五行力量与喜用仅计年月日三柱（各项来源已标注「时辰未知未计」）；' +
  '② 起运与大运按正午近似推算（时辰未知近似），实际出生时辰不同则交运日期相应先后；' +
  '③ 若实际出生恰在时辰交界或日交界附近（如 23 点后夜子时），时支归属乃至整盘排法存疑，建议核实出生时辰。';

/** 时辰未知入口：校验出生日期并组装正午近似时刻串。@throws 缺失/格式/日期非法。 */
function noonApproximation(出生日期: string | undefined): string {
  if (typeof 出生日期 !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(出生日期)) {
    throw new Error(`时辰未知（北京时间=null）时必须提供出生日期（YYYY-MM-DD）：${JSON.stringify(出生日期)}`);
  }
  return `${出生日期} 12:00:00`; // 日期合法性由 parseBeiJingDateTime 校验（抛「日期」）
}

/** 校正后本地时间 → EightChar（sect=2 晚子时日柱不换日口径）。 */
function chartEightChar(local: BeiJingParts): EightChar {
  const ec = Solar.fromYmdHms(
    local.year,
    local.month,
    local.day,
    local.hour,
    local.minute,
    local.second,
  ).getLunar().getEightChar();
  ec.setSect(2); // 晚子时（23-24 点）日柱不换日
  return ec;
}

/** 组四柱：includeHour=false（时辰未知）时时柱整体缺位。 */
function buildPillars(ec: EightChar, includeHour: boolean): BaziResult['四柱'] {
  return {
    年: buildZhu({
      gan: ec.getYearGan(),
      zhi: ec.getYearZhi(),
      hideGan: ec.getYearHideGan(),
      shiShenZhi: ec.getYearShiShenZhi(),
      naYin: ec.getYearNaYin(),
    }),
    月: buildZhu({
      gan: ec.getMonthGan(),
      zhi: ec.getMonthZhi(),
      hideGan: ec.getMonthHideGan(),
      shiShenZhi: ec.getMonthShiShenZhi(),
      naYin: ec.getMonthNaYin(),
    }),
    日: buildZhu({
      gan: ec.getDayGan(),
      zhi: ec.getDayZhi(),
      hideGan: ec.getDayHideGan(),
      shiShenZhi: ec.getDayShiShenZhi(),
      naYin: ec.getDayNaYin(),
    }),
    时: includeHour
      ? buildZhu({
          gan: ec.getTimeGan(),
          zhi: ec.getTimeZhi(),
          hideGan: ec.getTimeHideGan(),
          shiShenZhi: ec.getTimeShiShenZhi(),
          naYin: ec.getTimeNaYin(),
        })
      : null,
  };
}

/**
 * 起运精准描述：Yun 的 start{Year,Month,Day,Hour} 即「出生后 X年X个月X天X小时起运」，
 * 交运公历取 getStartSolar（与首步大运起点同源）。
 */
function describeQiYun(yun: Yun, 交运公历: string, shichenUnknown: boolean): BaziResult['起运精准'] {
  const base = {
    出生后时长: `${yun.getStartYear()}年${yun.getStartMonth()}个月${yun.getStartDay()}天${yun.getStartHour()}小时后`,
    交运公历,
  };
  return shichenUnknown ? { ...base, 时辰未知近似: true } : base;
}

/** 十步大运：舍弃第 0 步（出生至起运前，干支为空），每步起运严格 +10 年；十神干取本柱、支取本气。 */
function buildDaYun(yun: Yun, startSolar: Solar, dayGan: string, local: BeiJingParts): DaYunBu[] {
  return yun
    .getDaYun(11)
    .slice(1)
    .map((bu, i) => {
      const start = startSolar.nextYear(i * 10);
      const ganZhi = bu.getGanZhi();
      return {
        起于周岁: zhouSui(local, { year: start.getYear(), month: start.getMonth(), day: start.getDay() }),
        起于公历: start.toYmd(),
        干支: ganZhi,
        天干十神: shiShenOfGan(dayGan, ganZhi.charAt(0)),
        地支十神: shiShenOfGan(dayGan, benqiOfZhi(ganZhi.charAt(1))),
      };
    });
}

/**
 * 计算八字全盘。先做真太阳时校正，再排盘（时柱、晚子时判定均用校正后时间）。
 * 时辰未知（北京时间=null）：以 出生日期 当日 12:00 校正后排三柱，时柱 null，
 * 真太阳时报 正午近似，起运带 时辰未知近似 标志。
 * @throws 时间格式/日期非法或经度越界时抛错（错误信息含「格式/日期/时/分/经度/出生日期」）。
 */
export function computeBazi(input: BaziInput): BaziResult {
  const 北京时间 = input.北京时间;
  const shichenUnknown = 北京时间 === null;
  const raw = shichenUnknown ? noonApproximation(input.出生日期) : 北京时间;
  const noCorrection = input.使用真太阳时 === false;
  const solar = noCorrection
    ? { 输入北京时间: raw, 校正分钟: 0, 校正后本地时间: raw, 地点经度: input.出生地经度 }
    : applyTrueSolarTime(raw, input.出生地经度);
  const local = parseBeiJingDateTime(solar.校正后本地时间);

  const ec = chartEightChar(local);
  const pillars = buildPillars(ec, !shichenUnknown);
  const dayGan = ec.getDayGan();
  const forces0 = aggregateForces(collectContributions(pillars));
  const forces = shichenUnknown ? markShichenUnknown(forces0) : forces0;

  // 大运：男 1 女 0；阴阳年顺逆由库 Yun 决定；起运精度用库默认 sect=1
  const gender = input.性别 === '男' ? 1 : 0;
  const yun = ec.getYun(gender);
  const startSolar = yun.getStartSolar();
  const 大运 = buildDaYun(yun, startSolar, dayGan, local);

  return {
    四柱: pillars,
    日主: dayGan,
    五行力量: forces,
    五行缺失: forces.filter((f) => f.得分 === 0).map((f) => f.五行),
    大运,
    起运精准: describeQiYun(yun, startSolar.toYmd(), shichenUnknown),
    ...(shichenUnknown ? { 时辰未知提示: SHICHEN_UNKNOWN_HINT } : {}),
    真太阳时: shichenUnknown
      ? {
          输入北京时间: null,
          校正分钟: solar.校正分钟,
          校正后本地时间: null,
          地点经度: solar.地点经度,
          正午近似: true,
          ...(noCorrection ? { 未启用: true } : {}),
        }
      : {
          输入北京时间: solar.输入北京时间,
          校正分钟: solar.校正分钟,
          校正后本地时间: solar.校正后本地时间,
          地点经度: solar.地点经度,
          ...(noCorrection ? { 未启用: true } : {}),
        },
    晚子时流派: !shichenUnknown && local.hour >= 23 ? 'sect2_日不换' : '不涉及',
  };
}
