/**
 * 日主旺衰评分卡（净分制，可负）：得令 45（带符号）/ 得地 30（只加）/ 得势 ±30（净额），
 * 三维相加后 fenDang 五分档（阈值见 constants.FENDANG_TIERS）。
 *
 * 输入仅 BaziResult.四柱 与 日主；藏干取本模块 constants.ZHI_CANGGAN，
 * 不依赖 Zhu.藏干 字段、不依赖 lunar-typescript（纯函数层约定）。
 * 每一维输出 支持/得分/说明/明细，供 AI 层引用依据链。
 * 不可变：只读入参，从不修改四柱。
 */
import type { BaziResult, WuXing, Zhu } from '../types';
import {
  DELING_CENG_RATIO,
  DELING_FEN,
  DEDI_FEN,
  DEDI_QUAN,
  DESHI_FEN,
  DESHI_FLOOR,
  DESHI_QUAN,
  GAN_WUXING,
  KE,
  SHENG,
  WUXING_ORDER,
  ZHI_CANGGAN,
  fenDang,
} from './constants';
import type { CangCeng, QiangRuoLevel, ShengKeRelation } from './constants';

type 四柱 = BaziResult['四柱'];
type 位次 = keyof 四柱;

/** 单维分析结果（可解释性：明细逐条列出分值来源）。 */
export interface WeiduFenxi {
  支持: boolean;
  得分: number;
  说明: string;
  明细: string[];
}

/** 旺衰分析结果。 */
export interface WangshuaiFenxi {
  得分: number;
  等级: QiangRuoLevel;
  得令: WeiduFenxi;
  得地: WeiduFenxi;
  得势: WeiduFenxi;
}

const 位次序: readonly 位次[] = ['年', '月', '日', '时'];

/** 藏干在藏干数组中的档位：首=主气，第三字起=余气，其余=中气。 */
function cangCeng(index: number): CangCeng {
  if (index === 0) return '主气';
  if (index >= 2) return '余气';
  return '中气';
}

/** 该五行对日主而言是否生扶（同我或生我）。 */
function isShengFu(wx: WuXing, 日主五行: WuXing): boolean {
  return wx === 日主五行 || SHENG[wx] === 日主五行;
}

function ganWx(干: string): WuXing {
  const wx = GAN_WUXING[干];
  if (!wx) throw new Error(`未知天干：${干}`);
  return wx;
}

/** 藏干五行 对 日主五行 的生克关系名。 */
export function shengKeRelation(wx: WuXing, 日主五行: WuXing): ShengKeRelation {
  if (wx === 日主五行) return '同我';
  if (SHENG[wx] === 日主五行) return '生我';
  if (SHENG[日主五行] === wx) return '我生';
  if (KE[日主五行] === wx) return '我克';
  if (KE[wx] === 日主五行) return '克我';
  throw new Error(`五行关系异常：${wx} 对 ${日主五行}`);
}

/**
 * 得令（月令定格，净分制）：月支藏干逐层按生克关系取 DELING_FEN 带符号分值——
 * 主气全额；中/余气仅负分侧按 0.5/0.25 折减计入，正分侧中余气一律不计。
 *
 * ⚠ 对规格文本的显式偏离（team-lead 2026-08-29 裁决接受，评审须复核波及面）：
 * 规格原文可读出「中余气按系数计入」的双向语义，本实现只在负分侧计，理由有二：
 * ① 正向生扶之力已由得地通根（同五行根气）与得势无根生扶支覆盖，得令再计即三重计分；
 *    负向克泄则不然——月令克我是「气候压身」，他维（通根/透干）无法表达，必须保留。
 * ② 保 F4（壬午 辛丑 壬午 甲辰）：丑藏己癸辛——主气己克我 −30，中气癸同我、余气辛生我
 *    若正向计入，得令由 −30 抬正，F4 档被伪造翻强，③/④ 急不急判定与冲突裁决全部失真。
 * 判别锚点：壬生丑月仍 −30 失令（wangshuai.test 判别钉 + 明细不含癸辛）。
 */
function 分析得令(月柱: Zhu, 日主五行: WuXing): WeiduFenxi {
  const 明细: string[] = [];
  let 得分 = 0;
  const 藏干 = ZHI_CANGGAN[月柱.地支] ?? [];
  藏干.forEach((cg, i) => {
    const 层 = cangCeng(i);
    const 关系 = shengKeRelation(ganWx(cg), 日主五行);
    const 基准 = DELING_FEN[关系];
    let 分 = 基准;
    if (层 !== '主气') {
      if (基准 <= 0) 分 = 基准 * DELING_CENG_RATIO[层]; // 负分侧折减
      else 分 = 0; // 正分侧中余气不计（见函数头注释）
    }
    if (分 === 0) return;
    得分 += 分;
    明细.push(`月支${月柱.地支}藏${cg}（${层}·${关系}）${分 > 0 ? '+' : ''}${分}`);
  });
  if (藏干.length === 0) 明细.push(`月支${月柱.地支}无藏干？（数据表缺位）`);
  const 支持 = 得分 > 0;
  const 说明 = 支持
    ? `月支${月柱.地支}得令（净分 ${得分}）`
    : `月支${月柱.地支}失令（净分 ${得分}）`;
  return { 支持, 得分, 说明, 明细 };
}

/** 时辰未知（时=null）时在说明尾注中声明缺柱；缺柱不缩放（缺失贡献生克双向不确定，放大伪造精度）。 */
const 缺时柱注 = '（时辰未知，时柱未计）';

/** 得地：四柱地支藏干中与日主同五行者按位次×档位计根气，封顶 30；时柱缺位则跳过。 */
function 分析得地(四柱: 四柱, 日主五行: WuXing): WeiduFenxi {
  const 明细: string[] = [];
  let 合计 = 0;
  for (const 位 of 位次序) {
    const 柱 = 四柱[位];
    if (!柱) continue; // 时辰未知：时柱整体缺位
    const 支 = 柱.地支;
    const 藏干 = ZHI_CANGGAN[支] ?? [];
    藏干.forEach((cg, i) => {
      const 层 = cangCeng(i);
      if (ganWx(cg) === 日主五行) {
        const 分 = DEDI_FEN[位][层];
        合计 += 分;
        if (分 > 0) 明细.push(`${位}支${支}藏${cg}（${层}）通根 +${分}`);
      }
    });
  }
  if (合计 === 0) 明细.push('四柱地支无与日主同五行之藏干，无根');
  if (合计 > DEDI_QUAN) {
    明细.push(`原始根气 ${合计} 超上限，按 ${DEDI_QUAN} 封顶`);
    合计 = DEDI_QUAN;
  }
  if (!四柱.时) 明细.push('时辰未知，时柱未计');
  const 说明 =
    (合计 > 0 ? `通根得地（${合计}分，含月支中余气、日支加重）` : '地支无通根，不得地（0分）') +
    (四柱.时 ? '' : 缺时柱注);
  return { 支持: 合计 > 0, 得分: 合计, 说明, 明细 };
}

/** 十神五大类（日主视角；与得势计分键、喜用神明细的 十神关系 同一套词）。 */
export type ShishenCat = '印星' | '比劫' | '食伤' | '财星' | '官杀';

/** 五行（或天干五行）对日主的十神类别（生我→印星、同我→比劫、我生→食伤、我克→财星、克我→官杀）。 */
export function shishenOfWx(wx: WuXing, 日主五行: WuXing): ShishenCat {
  const 关系 = shengKeRelation(wx, 日主五行);
  switch (关系) {
    case '同我': return '比劫';
    case '生我': return '印星';
    case '克我': return '官杀';
    case '我克': return '财星';
    case '我生': return '食伤';
  }
}

/**
 * 得势（净分制）：年/月/时透干按十神×贴隔计分（贴=月干/时干，隔=年干；克泄耗为负），
 * 加「无根生扶支」+4（维持旧口径：主气生扶而不藏日主本气者；通根者归得地不重复计），
 * 合计 clamp [−30, 30]；时柱缺位则跳过。
 */
function 分析得势(四柱: 四柱, 日主五行: WuXing): WeiduFenxi {
  const 明细: string[] = [];
  let 合计 = 0;
  for (const 位 of ['年', '月', '时'] as const) {
    const 干 = 四柱[位]?.天干;
    if (干 === undefined) continue; // 时辰未知：时干缺位
    const 类 = shishenOfWx(ganWx(干), 日主五行);
    const 贴隔 = 位 === '年' ? ('隔' as const) : ('贴' as const);
    const 分 = DESHI_FEN[类][贴隔];
    合计 += 分;
    明细.push(`${位}干${干}（${类}·${贴隔}）${分 > 0 ? '+' : ''}${分}`);
  }
  for (const 位 of ['年', '日', '时'] as const) {
    const 支 = 四柱[位]?.地支;
    if (支 === undefined) continue; // 时辰未知：时支缺位
    const 藏干 = ZHI_CANGGAN[支] ?? [];
    const 主气 = 藏干[0] ? ganWx(藏干[0]) : undefined;
    if (主气 === undefined || !isShengFu(主气, 日主五行)) continue;
    const 有根 = 藏干.some((cg) => ganWx(cg) === 日主五行);
    if (有根) {
      明细.push(`${位}支${支}已藏日主之气（通根，归得地），不另计生扶`);
      continue;
    }
    合计 += DESHI_FEN.无根生扶支;
    明细.push(`${位}支${支}主气${藏干[0]}生扶而不藏日主，无根之扶 +${DESHI_FEN.无根生扶支}`);
  }
  if (合计 > DESHI_QUAN) {
    明细.push(`原始净额 ${合计} 超上限，按 ${DESHI_QUAN} 钳位`);
    合计 = DESHI_QUAN;
  }
  if (合计 < DESHI_FLOOR) {
    明细.push(`原始净额 ${合计} 超下限，按 ${DESHI_FLOOR} 钳位`);
    合计 = DESHI_FLOOR;
  }
  if (!四柱.时) 明细.push('时辰未知，时柱未计');
  const 说明 =
    (合计 > 0 ? `生扶党众得势（净分 ${合计}）` : `生扶不及克泄耗，不得势（净分 ${合计}）`) +
    (四柱.时 ? '' : 缺时柱注);
  return { 支持: 合计 > 0, 得分: 合计, 说明, 明细 };
}

/**
 * 旺衰总分：三维相加（净分制，可为负），fenDang 五分档。
 * @param 日主 日主天干单字
 * @param 四柱 BaziResult.四柱（只读，不修改）
 */
export function analyzeWangshuai(日主: string, 四柱: 四柱): WangshuaiFenxi {
  const 日主五行 = ganWx(日主);
  if (!WUXING_ORDER.includes(日主五行)) throw new Error(`日主五行异常：${日主}`);
  const 得令 = 分析得令(四柱.月, 日主五行);
  const 得地 = 分析得地(四柱, 日主五行);
  const 得势 = 分析得势(四柱, 日主五行);
  const 得分 = 得令.得分 + 得地.得分 + 得势.得分;
  return { 得分, 等级: fenDang(得分), 得令, 得地, 得势 };
}
