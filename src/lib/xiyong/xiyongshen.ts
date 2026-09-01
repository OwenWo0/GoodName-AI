/**
 * 喜用神裁决链：格局门（从格/专旺）→ 旺衰 → 扶抑 × 调候两级裁决。
 *
 * 优先规则（喜用神算法修复 C.1/C.3，缺陷根源=旧合成把整个调候当喜/整个扶抑入忌）：
 *   ⓪ 真从 / 专旺成立 → 格局喜忌直接胜出，扶抑与调候不得改写（本文件裁决跳过）；
 *   ① 中和 → 专以调候定喜用（沿用旧口径）；
 *   ② 扶抑与调候有交集 → 喜 = 扶抑 ∪ {调候主五行T}，T 不在扶抑内记次用；忌 = 本忌 − 喜；不冲突；
 *   ③ 无交集且急（月支∈冬夏优先月 且 T 不可见）→ 喜 = 全调候（角色调候）；忌 = 克T ∪ 本忌 − 喜；
 *      身弱盘的印比不转忌，降为次用并立 + 争议标注；冲突；
 *   ④ 无交集不急（含调候已可见的优先月）→ 喜 = 扶抑 ∪ {T}（T 记次用）；忌 = 本忌 − {T}；冲突。
 *   时辰未知时 ③ 的「不可见」负断言不完整 → 按不急处理 + 争议标注。
 *
 * ⚠ 对规格文本的显式偏离（评审一轮申报 2026-08-29，team-lead 裁决维持实现、要求补申报，评审须复核）：
 * ① ④ 支忌 = 本忌 − {T}，仅摘主药 T，不随整条调候药出忌——规格散文可读出「忌随调候整体摘除」，
 *    但 F 板 F4（壬午 辛丑 壬午 甲辰）钉忌 [木,土]：其调候 [火,木] 中，木为甲木辅药须留忌、
 *    不得随丁火主药一并出忌。F 板钉优先于规格散文，④ 维持「仅摘主药」。判别钉：F4 断言 忌=[木,土]。
 * ② 调候可见性 = 年/月/时干 ∪ 支藏本气/中气，日干不算药（日主自身不为己药）。
 *    规格文本未明言日干是否计入，本实现钉负断言：T 仅现于日干 → 不可见，仍可入 ③「急」
 *    （判别钉：调候可见 单测）。注：「T 仅现于日干」在 computeXiyongshen 层无真实盘可落——
 *    穷通表 T=日主本气五行 的行仅 壬巳/壬午（皆急月、药水），该组合下强水盘分值不可达（得令 −30 起），
 *    弱档则 扶抑∩调候≠∅ 走 ②；规格例（丙子月药火）与数据表不符（表中丙子=[水,土]）。
 *    按铁律上报不擅改：以 调候可见 单测钉住日干排除语义 + ③ 真盘（戊戌 庚丑 壬卯 庚辰）钉住急月不可见路径。
 *
 * 缺≠补（AI 层/文案必须遵守的语义）：喜用神是按「格局 + 旺衰功能 + 气候」择优的结果，
 * 不是「八字缺什么就补什么」——缺的五行可能是忌神（如冬水身旺缺火？火为调候喜；
 * 夏火身强缺水？水恰为喜；反之身弱火旺缺木时木为印可用，身强火旺缺木时木反为忌）。
 * 输出顺序：喜用神/忌神均按 WUXING_ORDER（木火土金水）规范化；调候.五行 保留原文次第。
 * 不可变：只读 BaziResult，从不修改入参。
 */
import type { BaziResult, ShishenRelation, WuXing, XiyongMingXiItem, XiyongshenResult } from '../types';
import { GAN_WUXING, KE, SHENG, WUXING_ORDER, YOUXIAN_MONTHS, ZHI_CANGGAN } from './constants';
import type { QiangRuoLevel } from './constants';
import { analyzeWangshuai, shishenOfWx } from './wangshuai';
import type { ShishenCat } from './wangshuai';
import { detectGeju } from './geju';
import { findTiaohou } from './tiaohou';

/** 日主五行的生克关系集合。 */
interface ShengKe {
  生我: WuXing;
  同我: WuXing;
  我生: WuXing;
  我克: WuXing;
  克我: WuXing;
}

function 关系(日主五行: WuXing): ShengKe {
  const 生我 = WUXING_ORDER.find((x) => SHENG[x] === 日主五行);
  const 克我 = WUXING_ORDER.find((x) => KE[x] === 日主五行);
  if (!生我 || !克我) throw new Error(`五行表异常：${日主五行} 的生克关系不完整`);
  return { 生我, 同我: 日主五行, 我生: SHENG[日主五行], 我克: KE[日主五行], 克我 };
}

/** 按 木火土金水 序去重排序。 */
function sortWx(list: readonly WuXing[]): WuXing[] {
  return [...new Set(list)].sort((a, b) => WUXING_ORDER.indexOf(a) - WUXING_ORDER.indexOf(b));
}

/** 十神类别 → 该类别对日主的五行（五类各恰一五行）。 */
function 类五行(类: ShishenCat, 日主五行: WuXing): WuXing {
  const x = WUXING_ORDER.find((w) => shishenOfWx(w, 日主五行) === 类);
  if (!x) throw new Error(`十神类别映射失败：${类} 对 ${日主五行}`);
  return x;
}

/** 裁定的入参/出参（导出供单测直接喂合成盘验证裁决树，不必造完整 BaziResult）。 */
export interface 裁定Input {
  等级: QiangRuoLevel;
  扶抑五行: WuXing[];
  本忌: WuXing[];
  调候五行: WuXing[];
  月支: string;
  /** 调候主五行 T 是否见于 年/月/时干 ∪ 支藏本中气（日主自身不算药，不计入）。 */
  调候主可见: boolean;
  时辰未知: boolean;
  日主五行: WuXing;
}

export interface 裁定Result {
  喜用神: WuXing[];
  忌神: WuXing[];
  明细: XiyongMingXiItem[];
  冲突: boolean;
  冲突说明?: string;
  争议标注: string[];
}

/** 明细条目构造。 */
function 明细项(五行: WuXing, 日主五行: WuXing, 角色: XiyongMingXiItem['角色']): XiyongMingXiItem {
  return { 五行, 十神关系: shishenOfWx(五行, 日主五行) as ShishenRelation, 角色 };
}

/**
 * 扶抑 × 调候 两级裁决（规则见文件头 ①~④；格局真成立时调用方跳过本函数）。
 * T = 调候五行[0]（《穷通宝鉴》原文次第首字为主药）。
 */
export function 裁定(输入: 裁定Input): 裁定Result {
  const { 等级, 扶抑五行, 本忌, 调候五行, 月支, 调候主可见, 时辰未知, 日主五行 } = 输入;
  const T = 调候五行[0];
  const 争议标注: string[] = [];
  const 明 = (list: readonly WuXing[], 角色: XiyongMingXiItem['角色']) =>
    list.map((x) => 明细项(x, 日主五行, 角色));

  // ① 中和：专以调候定喜用（忌=克喜者−喜，护住调候用神）
  if (等级 === '中和') {
    const 喜用神 = sortWx(调候五行);
    const 忌神 = sortWx(WUXING_ORDER.filter((x) => 喜用神.includes(KE[x]) && !喜用神.includes(x)));
    return { 喜用神, 忌神, 明细: 明(喜用神, '调候'), 冲突: false, 争议标注 };
  }

  // ② 有交集：并集为喜（T-only 并入——旧版整个调候入喜会把克日主者一并抬进，F3 盘判别钉死）
  if (T !== undefined && 扶抑五行.some((w) => 调候五行.includes(w))) {
    const 喜用神 = sortWx([...扶抑五行, T]);
    const 明细 = [...明(扶抑五行, '主用'), ...(T !== undefined && !扶抑五行.includes(T) ? 明([T], '次用') : [])];
    return { 喜用神, 忌神: sortWx(本忌.filter((w) => !喜用神.includes(w))), 明细, 冲突: false, 争议标注 };
  }

  if (T === undefined) {
    // 调候表无主药（理论不可达：tiaohou.json 满表）——退化为纯扶抑
    return { 喜用神: sortWx(扶抑五行), 忌神: sortWx(本忌), 明细: 明(扶抑五行, '主用'), 冲突: false, 争议标注 };
  }

  const 无交集文案 = `扶抑取${扶抑五行.join('')}而调候主取${T}（全调候 ${调候五行.join('')}），两无交集。`;
  const 身弱级 = 等级 === '偏弱' || 等级 === '身弱';

  // ③ 急：冬夏优先月且调候主药不可见（时辰未知→负断言不完整，降级不急）
  const 急月 = YOUXIAN_MONTHS.includes(月支);
  let 急 = 急月 && !调候主可见;
  if (急 && 时辰未知) {
    急 = false;
    争议标注.push('时辰未知，调候可见性缺时柱负断言，按不急处理（冲突裁决降级）');
  }
  if (急) {
    let 喜用神 = sortWx(调候五行);
    const 克T = WUXING_ORDER.filter((x) => KE[x] === T);
    let 忌神 = sortWx([...克T, ...本忌].filter((w) => !喜用神.includes(w)));
    const 明细 = 明(喜用神, '调候');
    let 取舍说明 = `${克T.join('')}克调候${T}，并入忌神。`;
    if (身弱级) {
      // 身弱盘印比不转忌：从格未成而身弱，扶抑五行（印比）从忌中摘回、降次用并立
      const 摘回 = 忌神.filter((w) => 扶抑五行.includes(w));
      if (摘回.length > 0) {
        忌神 = 忌神.filter((w) => !摘回.includes(w));
        喜用神 = sortWx([...喜用神, ...摘回]);
        明细.push(...明(摘回, '次用'));
        取舍说明 += `身弱（${等级}）盘印比（${摘回.join('')}）不转忌，降为次用并立——调候与扶抑并立之折中，诸家有异，留痕。`;
        争议标注.push(`身弱调候急盘：印比（${摘回.join('')}）不转忌降次用（流派折中留痕）`);
      }
    }
    return {
      喜用神,
      忌神,
      明细,
      冲突: true,
      冲突说明:
        无交集文案 +
        `${月支}月属冬夏极寒极热之月且调候主药${T}不见于干支，气候为急，喜用随调候。` +
        取舍说明,
      争议标注,
    };
  }

  // ④ 不急（非优先月，或调候已可见）：扶抑主用，T 并立次用；忌仅摘除 T
  const 喜用神 = sortWx([...扶抑五行, T]);
  const 明细 = [...明(扶抑五行, '主用'), ...明([T], '次用')];
  const 原因 = 急月
    ? `${月支}月虽属调候优先月，但调候主药${T}已见于干支（不为急），扶抑主用、调候次用并立。`
    : `${月支}月非调候优先月（气候平），扶抑主用，调候${T}并立次用。`;
  return {
    喜用神,
    // 仅摘主药 T（文件头偏离申报①：F4 钉忌[木,土]，调候辅药不得随主药出忌）
    忌神: sortWx(本忌.filter((w) => w !== T)),
    明细,
    冲突: true,
    冲突说明: 无交集文案 + 原因 + `忌神仍按扶抑口径，仅摘除${T}。`,
    争议标注,
  };
}

/**
 * 调候主五行可见性：∈ 年/月/时干 ∪ 各支藏干本气/中气。
 * 钉（申报见文件头偏离②）：日干不计——日主自身不为己药，T 仅现于日干仍算不可见；
 * 余气不计——支藏余气药力太弱，不作「见」论（本/中气口径）。判别钉：调候可见 单测。
 */
export function 调候可见(T: WuXing, bazi: BaziResult): boolean {
  for (const 位 of ['年', '月', '时'] as const) {
    const 干 = bazi.四柱[位]?.天干;
    if (干 !== undefined && GAN_WUXING[干] === T) return true;
  }
  for (const 位 of ['年', '月', '日', '时'] as const) {
    const 支 = bazi.四柱[位]?.地支;
    if (支 === undefined) continue;
    if ((ZHI_CANGGAN[支] ?? []).slice(0, 2).some((cg) => GAN_WUXING[cg] === T)) return true;
  }
  return false;
}

/**
 * 计算喜用神/忌神：格局门 → 旺衰 → 扶抑×调候两级裁决。
 * @param bazi 仅需 四柱 与 日主；其余字段不参与运算、不被修改。
 */
export function computeXiyongshen(bazi: BaziResult): XiyongshenResult {
  const 旺衰 = analyzeWangshuai(bazi.日主, bazi.四柱);
  const 日主五行 = GAN_WUXING[bazi.日主];
  if (!日主五行) throw new Error(`未知日主天干：${bazi.日主}`);
  const 月支 = bazi.四柱.月.地支;
  const r = 关系(日主五行);

  // —— 扶抑：旺衰取向 → 喜忌五行 ——
  let 扶抑五行: WuXing[];
  let 扶抑策略: string;
  let 本忌: WuXing[]; // 扶抑口径的忌神（不含调候取舍）
  if (旺衰.等级 === '身强' || 旺衰.等级 === '偏强') {
    扶抑五行 = sortWx([r.我生, r.我克, r.克我]);
    扶抑策略 = '身强宜克泄耗：取我生（食伤泄秀）、我克（财星耗身）、克我（官杀制身）为喜。';
    本忌 = sortWx([r.生我, r.同我]);
  } else if (旺衰.等级 === '偏弱' || 旺衰.等级 === '身弱') {
    扶抑五行 = sortWx([r.生我, r.同我]);
    扶抑策略 = '身弱宜生扶：取生我（印星）、同我（比劫）为喜。';
    本忌 = sortWx([r.克我, r.我生, r.我克]);
  } else {
    扶抑五行 = [];
    扶抑策略 = '强弱中和，扶抑无偏，专以调候定喜用。';
    本忌 = [];
  }

  // —— 格局门（第一裁决）：真从/专旺 → 格局喜忌胜出，跳过扶抑×调候 ——
  const scan = detectGeju(bazi.日主, bazi.四柱);
  const 调候 = findTiaohou(bazi.日主, 月支);
  const 真格局 = scan.格局 !== null && scan.格局.真伪 === '真' ? scan.格局 : null;

  let 喜用神: WuXing[];
  let 忌神: WuXing[];
  let 明细: XiyongMingXiItem[];
  let 冲突: boolean;
  let 冲突说明: string | undefined;
  let 争议标注 = [...scan.争议标注];
  if (真格局 !== null) {
    喜用神 = sortWx(真格局.喜类别.map((类) => 类五行(类, 日主五行)));
    忌神 = sortWx(真格局.忌类别.map((类) => 类五行(类, 日主五行)));
    // 财中性（专旺）不入喜不入忌；明细角色=主用（格局直取）
    明细 = 喜用神.map((x) => 明细项(x, 日主五行, '主用'));
    冲突 = false;
  } else {
    const 裁 = 裁定({
      等级: 旺衰.等级,
      扶抑五行,
      本忌,
      调候五行: 调候.五行,
      月支,
      调候主可见: 调候可见(调候.五行[0], bazi),
      时辰未知: bazi.四柱.时 === null,
      日主五行,
    });
    喜用神 = 裁.喜用神;
    忌神 = 裁.忌神;
    明细 = 裁.明细;
    冲突 = 裁.冲突;
    冲突说明 = 裁.冲突说明;
    争议标注 = [...争议标注, ...裁.争议标注];
  }

  return {
    日主: bazi.日主,
    强弱得分: 旺衰.得分,
    强弱等级: 旺衰.等级,
    得令: { 支持: 旺衰.得令.支持, 说明: 旺衰.得令.说明 },
    得地: { 支持: 旺衰.得地.支持, 说明: 旺衰.得地.说明 },
    得势: { 支持: 旺衰.得势.支持, 说明: 旺衰.得势.说明 },
    扶抑: { 五行: 扶抑五行, 策略: 扶抑策略 },
    调候,
    喜用神,
    忌神,
    冲突,
    ...(冲突说明 !== undefined ? { 冲突说明 } : {}),
    喜用神明细: 明细,
    ...(scan.格局 !== null
      ? { 格局: { 名称: scan.格局.名称, 真伪: scan.格局.真伪, 依据: [...scan.格局.依据] } }
      : {}),
    ...(争议标注.length > 0 ? { 争议标注 } : {}),
  };
}
