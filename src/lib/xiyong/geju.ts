/**
 * 格局门（从格 / 专旺）——旺衰之前的第一道裁决。
 *
 * 优先级约定（喜用神算法修复 C.1）：真从 / 专旺成立 → 格局喜忌直接胜出，
 * 旺衰扶抑与调候不得改写（调候冲突裁决整个跳过）；旺衰分照常展示。
 * 假从按正格身弱论，本模块只留痕（真伪='假' + 争议标注），不改写喜忌。
 *
 * 判定口径（钉表勿推导，流派争议见各注释）：
 * - 从格：无根（四支藏干**本气+中气**无同我/生我；仅余气见之=微根→假从）
 *   且 无助（年/月/时干无印比）且 所从神 D = 全盘力量最高（五行力量权重见 FORCE_WEIGHTS）
 *   且（D ∈ 月支本气 或 月支 ∈ D 的三合/三会）且 D 透干（年/月/时干）→ 真从；
 *   时辰未知 → 负断言不完整 → 降级假从。从势取近均势启发式（top 与次强差 <10%，P2 再精化，待 #27+ 立项）。
 * - 专旺：W=日主五行，得令（月支本气=W 或 月支∈W 三会方）且 纯粹
 *   （克我五行在全部天干+地支藏干本中气完全不见；我克五行（财）天干不透，支藏不忌）
 *   → 真；克我/财见 → 破格回正格（静默 null，不加噪音）；时辰未知 → 不判 + 争议标注。
 *   喜[印,比劫,食伤] 忌[官杀]，财中性 + 争议标注（稼穑另加特例注）。
 */
import type { BaziResult, ShishenRelation, WuXing } from '../types';
import {
  FORCE_WEIGHTS,
  GAN_WUXING,
  KE,
  SANHUI_ZHI,
  SANHE_ZHI,
  SHENG,
  WUXING_ORDER,
  ZHI_CANGGAN,
} from './constants';
import { shishenOfWx } from './wangshuai';
import type { ShishenCat } from './wangshuai';

type 四柱 = BaziResult['四柱'];
type 有位柱位 = '年' | '月' | '日' | '时';

/** 格局判定结果（喜忌以十神类别表达，由调用方按日主映射为五行）。 */
export interface GejuResult {
  类型: '从格' | '专旺';
  名称: string; // 如「从财格」「专旺格·曲直」
  真伪: '真' | '假';
  喜类别: ShishenCat[];
  忌类别: ShishenCat[];
  中性类别: ShishenCat[]; // 专旺财星中性（从格为空）
  依据: string[];
  争议标注: string[];
}

/** 格局扫描输出：格局 + 模块级争议标注（含未成格但有降级留痕的情形）。 */
export interface GejuScan {
  格局: GejuResult | null;
  争议标注: string[];
}

/** 从格喜忌固定表（钉表勿推导；类别对日主映射为五行后即为喜忌）。 */
export const 从格喜忌表: Readonly<Record<'从财' | '从杀' | '从儿' | '从势', { 喜: readonly ShishenCat[]; 忌: readonly ShishenCat[] }>> =
  Object.freeze({
    从财: { 喜: Object.freeze(['食伤', '财星'] as const), 忌: Object.freeze(['印星', '比劫'] as const) },
    从杀: { 喜: Object.freeze(['财星', '官杀'] as const), 忌: Object.freeze(['印星', '比劫', '食伤'] as const) },
    从儿: { 喜: Object.freeze(['食伤', '财星'] as const), 忌: Object.freeze(['印星', '比劫'] as const) },
    从势: { 喜: Object.freeze(['食伤', '财星', '官杀'] as const), 忌: Object.freeze(['印星', '比劫'] as const) },
  });

/** 专旺格别名（按日主五行）。 */
const ZHUANWANG_NAME: Readonly<Record<WuXing, string>> = Object.freeze({
  木: '曲直', 火: '炎上', 土: '稼穑', 金: '从革', 水: '润下',
});

const ganWx = (干: string): WuXing => {
  const wx = GAN_WUXING[干];
  if (!wx) throw new Error(`未知天干：${干}`);
  return wx;
};

/** 全盘五行力量（日干即日主本身不计分；时柱缺位整体跳过——与 bazi.ts 同源权重）。 */
function forceTotals(四柱: 四柱): Record<WuXing, number> {
  const totals = Object.fromEntries(WUXING_ORDER.map((x) => [x, 0])) as Record<WuXing, number>;
  for (const 位 of ['年', '月', '时'] as const) {
    const 干 = 四柱[位]?.天干;
    if (干 !== undefined) totals[ganWx(干)] += FORCE_WEIGHTS.干;
  }
  for (const 位 of ['年', '月', '日', '时'] as 有位柱位[]) {
    const 柱 = 四柱[位];
    if (!柱) continue;
    const w = 位 === '月'
      ? [FORCE_WEIGHTS.月支本气, FORCE_WEIGHTS.月支中气, FORCE_WEIGHTS.月支余气]
      : [FORCE_WEIGHTS.他支本气, FORCE_WEIGHTS.他支中气, FORCE_WEIGHTS.他支余气];
    (ZHI_CANGGAN[柱.地支] ?? []).forEach((cg, i) => {
      totals[ganWx(cg)] += w[Math.min(i, 2)];
    });
  }
  return totals;
}

/** 该藏干五行对日主是否为同党（同我）或生源（生我）。 */
function 是日主同党(wx: WuXing, 日主五行: WuXing): boolean {
  return wx === 日主五行 || SHENG[wx] === 日主五行;
}

/** 四支藏干本气/中气是否有日主同党根（同我/生我）；仅余气见者单独报出（微根→假从）。 */
function rootScan(日主五行: WuXing, 四柱: 四柱): { 本中根: boolean; 微根: string[] } {
  let 本中根 = false;
  const 微根: string[] = [];
  for (const 位 of ['年', '月', '日', '时'] as 有位柱位[]) {
    const 柱 = 四柱[位];
    if (!柱) continue;
    (ZHI_CANGGAN[柱.地支] ?? []).forEach((cg, i) => {
      if (!是日主同党(ganWx(cg), 日主五行)) return;
      if (i <= 1) 本中根 = true;
      else 微根.push(`${位}支${柱.地支}余气${cg}`);
    });
  }
  return { 本中根, 微根 };
}

/** 力量最高五行（并列取 木火土金水 序前者）。 */
function topForce(totals: Record<WuXing, number>): { 五行: WuXing; 得分: number } {
  let best = WUXING_ORDER[0];
  for (const x of WUXING_ORDER) if (totals[x] > totals[best]) best = x;
  return { 五行: best, 得分: totals[best] };
}

/** 从格判定（含假从降级留痕）；不成从返回 null。 */
function 判从格(日主五行: WuXing, 四柱: 四柱, totals: Record<WuXing, number>): GejuResult | null {
  const { 本中根, 微根 } = rootScan(日主五行, 四柱);
  if (本中根) return null; // 有根不从
  const 依据: string[] = ['日主于四支本气/中气无同我生我之根（不从者不论）'];

  // 无助：年/月/时干无印星（生我）、比劫（同我）
  const 透干: Array<{ 位: '年' | '月' | '时'; 干: string; wx: WuXing }> = [];
  for (const 位 of ['年', '月', '时'] as const) {
    const 干 = 四柱[位]?.天干;
    if (干 === undefined) continue;
    透干.push({ 位, 干, wx: ganWx(干) });
  }
  const 印比 = 透干.filter((t) => shishenOfWx(t.wx, 日主五行) === '印星' || shishenOfWx(t.wx, 日主五行) === '比劫');
  if (印比.length > 0) return null; // 有助不从
  依据.push('年/月/时干无印比之助');

  const top = topForce(totals);
  const D = top.五行;
  const D类 = shishenOfWx(D, 日主五行);
  if (D类 === '印星' || D类 === '比劫') return null; // 从印/从强不在钉表范围（流派争议大，P2 再议，待 #27+ 立项）
  依据.push(`所从神 ${D}（${D类}）全盘力量 ${top.得分} 为最高`);

  // 月支参与：D ∈ 月支本气 或 月支 ∈ D 的三合/三会
  const 月支 = 四柱.月.地支;
  const 本气 = (ZHI_CANGGAN[月支] ?? [])[0];
  const 本气参与 = 本气 !== undefined && ganWx(本气) === D;
  const 参与 = 本气参与 || SANHE_ZHI[月支] === D || SANHUI_ZHI[月支] === D;
  if (!参与) return null;
  依据.push(`月支${月支}参与${D}（${本气参与 ? `本气${本气}` : SANHUI_ZHI[月支] === D ? '三会方' : '三合局'}）`);

  // D 透干
  const 透 = 透干.find((t) => t.wx === D);
  if (!透) return null;
  依据.push(`${D}透干于${透.位}干${透.干}`);

  // 从势启发式：食伤/财星/官杀 三类中次强者 ≥ 0.9×所从神 → 众寡难以一神名状，作从势
  const 类力 = (类: ShishenCat): number =>
    WUXING_ORDER.filter((x) => shishenOfWx(x, 日主五行) === 类).reduce((s, x) => s + totals[x], 0);
  const 儿 = 类力('食伤'), 财 = 类力('财星'), 杀 = 类力('官杀');
  const 次强 = Math.max(
    ...(D类 !== '食伤' ? [儿] : []),
    ...(D类 !== '财星' ? [财] : []),
    ...(D类 !== '官杀' ? [杀] : []),
  );
  let 名称: '从财' | '从杀' | '从儿' | '从势';
  if (次强 >= 0.9 * top.得分) {
    名称 = '从势';
    依据.push(`食伤${儿}/财${财}/官杀${杀} 次强 ≥ 0.9×${top.得分}，近均势作从势（启发式，P2 精化，待 #27+ 立项）`);
  } else if (D类 === '财星') 名称 = '从财';
  else if (D类 === '官杀') 名称 = '从杀';
  else 名称 = '从儿';

  const 争议标注: string[] = [];
  let 真伪: '真' | '假' = '真';
  if (微根.length > 0) {
    真伪 = '假';
    依据.push(`仅余气微根（${微根.join('、')}），按假从`);
  }
  if (!四柱.时) {
    真伪 = '假';
    依据.push('时辰未知，时柱负断言不完整，按假从');
  }
  if (真伪 === '假') 争议标注.push('从格不真（假从），喜忌按正格身弱论');

  const 表 = 从格喜忌表[名称];
  return { 类型: '从格', 名称: `${名称}格`, 真伪, 喜类别: [...表.喜], 忌类别: [...表.忌], 中性类别: [], 依据, 争议标注 };
}

/** 专旺判定；破格/不判返回 null（不判时附争议标注）。 */
function 判专旺(日主五行: WuXing, 四柱: 四柱): { 格局: GejuResult | null; 争议标注: string[] } {
  const 月支 = 四柱.月.地支;
  const 本气 = (ZHI_CANGGAN[月支] ?? [])[0];
  const 得令 = (本气 !== undefined && ganWx(本气) === 日主五行) || SANHUI_ZHI[月支] === 日主五行;
  if (!得令) return { 格局: null, 争议标注: [] };

  // 纯粹：克我（官杀）不见于 年月时干 ∪ 全部支藏本中气；我克（财）天干不透（支藏不忌）
  const 官杀 = (x: WuXing) => shishenOfWx(x, 日主五行) === '官杀';
  const 财 = (x: WuXing) => shishenOfWx(x, 日主五行) === '财星';
  const 依据: string[] = [
    `月支${月支}${本气 !== undefined && ganWx(本气) === 日主五行 ? `本气${本气}` : '属' + 日主五行 + '三会方'}，得令`,
  ];
  for (const 位 of ['年', '月', '时'] as const) {
    const 干 = 四柱[位]?.天干;
    if (干 === undefined) continue;
    const wx = ganWx(干);
    if (官杀(wx)) return { 格局: null, 争议标注: [] }; // 破格回正格（静默）
    if (财(wx)) return { 格局: null, 争议标注: [] }; // 财透破专旺（静默）
  }
  for (const 位 of ['年', '月', '日', '时'] as 有位柱位[]) {
    const 柱 = 四柱[位];
    if (!柱) continue;
    const 藏 = (ZHI_CANGGAN[柱.地支] ?? []).slice(0, 2); // 本气+中气
    for (const cg of 藏) if (官杀(ganWx(cg))) return { 格局: null, 争议标注: [] };
  }

  if (!四柱.时) {
    return { 格局: null, 争议标注: ['时辰未知，专旺格不判（时柱纯粹性负断言不完整）'] };
  }

  依据.push('官杀（克我）于天干与支藏本中气全不见，财星不透干，纯粹');
  // 财星五行 = 我克 = KE[日主五行]，恒存在（原 find(…) ?? '' 为死回退，评审一轮清理）
  const 争议标注 = [`专旺格财星（${KE[日主五行]}）中性，诸家取舍得失不一`];
  if (日主五行 === '土') 争议标注.push('稼穑格土旺亦有不喜水（财）之说，特例留痕');
  return {
    格局: {
      类型: '专旺',
      名称: `专旺格·${ZHUANWANG_NAME[日主五行]}`,
      真伪: '真',
      喜类别: ['印星', '比劫', '食伤'],
      忌类别: ['官杀'],
      中性类别: ['财星'],
      依据,
      争议标注,
    },
    争议标注,
  };
}

/**
 * 格局门扫描入口：先验从格（更苛刻，无根为前提），不成再验专旺；两者互斥
 * （从格要无根、专旺得令即自带同党根）。输入只读；异常仅数据表缺位时抛出。
 */
export function detectGeju(日主: string, 四柱: 四柱): GejuScan {
  const 日主五行 = GAN_WUXING[日主];
  if (!日主五行) throw new Error(`未知日主天干：${日主}`);
  if (!四柱.月) throw new Error('格局判定需要月柱');
  const totals = forceTotals(四柱);
  const 从 = 判从格(日主五行, 四柱, totals);
  if (从 !== null) return { 格局: 从, 争议标注: 从.真伪 === '假' ? 从.争议标注 : [] };
  const 专 = 判专旺(日主五行, 四柱);
  return 专;
}

/** 类别 → 十神关系名（明细字段用，同一套词直接透传）。 */
export const 类别即十神 = (类: ShishenCat): ShishenRelation => 类;
