/**
 * /api/chart 编排层：请求 → 引擎调用 → ChartResult 组装。
 *
 * 流程：①农历→公历（闰月=负数月，Lunar.fromYmd；回环校验防非法农历日期）
 * → ②北京时间拼装（时辰未知=null；夏令时=墙钟回拨 1 小时，Date.UTC 纯算术）
 * → ③computeBazi（含真太阳时开关透传）→ ④computeXiyongshen
 * → ⑤草案五格 + 草案逐字平仄（顶层 wuge/名字草案平仄，与候选双轨独立）→ ⑥buildPool（辈字 位置 '第一'|'第二' → 1|2）
 * → ⑦组装 ChartResult（固定算法输出，零 AI）。
 *
 * 错误契约：ChartUserError = 用户可修正的输入问题（route 层报 400 中文）；
 * 其余异常视为服务端缺陷（route 层报 500 泛化文案）。
 */
import { Lunar } from 'lunar-typescript';
import { computeBazi } from '../bazi/bazi';
import { computeXiyongshen } from '../xiyong/xiyongshen';
import { computeWuge } from '../wuge/geju';
import { buildPool } from '../pool/pool';
import { buildPingzeResult } from '../phonology/pingze';
import { checkStandard } from '../chars/standard-table';
import { loadCharDB } from '../pool/char-db';
import type { ChartResult, PingzeResult } from '../types';
import type { ChartRequest } from './schema';

/** 用户可修正的输入错误（农历非法日、无闰月年份等）；route 层据此报 400。 */
export class ChartUserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChartUserError';
  }
}

/** 农历（闰月=负数月）→ 公历 YYYY-MM-DD；回环校验：三源分歧/非法日（如该年无闰X月、三十小建）在此拦截。 */
export function 农历转公历(年: number, 月: number, 日: number, 闰月: boolean): string {
  const 农历月 = 闰月 ? -月 : 月;
  let solar;
  try {
    solar = Lunar.fromYmd(年, 农历月, 日).getSolar();
  } catch (err) {
    // 库对无闰月年份传负月等直接抛错（wrong lunar …），统一转为用户可修正的 400；
    // 库原文只进 stderr，不回显（sec-m5 MEDIUM-2：错误信息不泄库细节）
    process.stderr.write(`农历转换失败：${年}-${月}-${日} 闰月=${闰月}——${err instanceof Error ? err.message : String(err)}\n`);
    throw new ChartUserError(
      `农历日期不合法：${年}年${闰月 ? '闰' : ''}${月}月${日}日（该年无闰${月}月或日期超出历法表覆盖范围，请核对农历出生日期）`,
    );
  }
  const back = solar.getLunar();
  if (back.getYear() !== 年 || back.getMonth() !== 农历月 || back.getDay() !== 日) {
    throw new ChartUserError(
      `农历日期不合法：${年}年${闰月 ? '闰' : ''}${月}月${日}日（该年无闰${月}月或该月无${日}日，请核对农历出生日期）`,
    );
  }
  return solar.toYmd();
}

/** 出生日期（按历法归一为公历）。阳历透传（日期格式已由 schema 校验，非法日交引擎 parse 层报「日期」）。 */
function normalizeBirthDate(req: ChartRequest): string {
  if (req.历法 === '阳历') return req.出生日期;
  const [y, m, d] = req.出生日期.split('-').map(Number);
  return 农历转公历(y, m, d, req.闰月 === true);
}

/**
 * 北京时间拼装：`公历日期 HH:mm:00`；时辰未知 → null（引擎走正午近似降级）。
 * 夏令时（1986–1991 大陆）：勾选则墙钟回拨 1 小时（00:30 → 前一日 23:30），Date.UTC 纯算术无时区陷阱。
 */
export function buildBeiJingTime(
  公历出生日期: string,
  出生时间: string | undefined,
  时辰未知: boolean,
  夏令时: boolean | undefined,
): string | null {
  if (时辰未知) return null;
  const [y, m, d] = 公历出生日期.split('-').map(Number);
  const [hh, mm] = (出生时间 ?? '12:00').split(':').map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d, hh, mm) - (夏令时 === true ? 60 * 60 * 1000 : 0));
  const p = (n: number) => String(n).padStart(2, '0');
  return `${shifted.getUTCFullYear()}-${p(shifted.getUTCMonth() + 1)}-${p(shifted.getUTCDate())} ${p(shifted.getUTCHours())}:${p(shifted.getUTCMinutes())}:00`;
}

/**
 * 草案名逐字平仄（含姓氏字），字表与候选海选同源（char-db 标准字集）。
 * 口径=默认：phonology「谐音上下文音」尚在途（pool.ts:45 垫片转发的参数当前被运行时忽略），此直调同行为。
 */
export function buildDraftPingze(姓氏: string, 草案: string): PingzeResult {
  const 全名 = 姓氏 + 草案;
  return buildPingzeResult(全名, {
    字表校验: checkStandard(全名, loadCharDB().标准字集 as Set<string>),
  });
}

/** 公历日历合法性（Date.UTC 会静默归一 2025-13-01→2026-01-01，必须回环比对拦截）。 */
function 校验公历日期(日期: string): void {
  const [y, m, d] = 日期.split('-').map(Number);
  const chk = new Date(Date.UTC(y, m - 1, d));
  if (chk.getUTCFullYear() !== y || chk.getUTCMonth() !== m - 1 || chk.getUTCDate() !== d) {
    throw new ChartUserError(`出生日期不是有效公历日期：${日期}`);
  }
}

/** 编排主体：合法请求 → ChartResult（引擎同步调用，无 IO；异常透传由 route 层分类）。 */
export function buildChart(req: ChartRequest): ChartResult {
  const 出生日期 = normalizeBirthDate(req);
  校验公历日期(出生日期); // 阳历透传路径兜底；农历路径库已保证合法
  const 北京时间 = buildBeiJingTime(出生日期, req.出生时间, req.时辰未知, req.夏令时);

  const bazi = computeBazi({
    北京时间,
    ...(北京时间 === null ? { 出生日期 } : {}),
    出生地经度: req.经度,
    性别: req.性别,
    使用真太阳时: req.使用真太阳时,
  });
  const xiyongshen = computeXiyongshen(bazi);

  // 双轨：草案五格/平仄（顶层）与候选五格/平仄（pool 内逐候选）独立计算，互不覆写
  const wuge = req.名字草案 !== undefined ? computeWuge(req.姓氏, req.名字草案) : null;
  const 草案平仄 = req.名字草案 !== undefined ? buildDraftPingze(req.姓氏, req.名字草案) : null;

  // pool 的 validate/db 装载抛（表外字/讳禁/姓重字/草案矛盾，契约 v3 §1.3）皆为用户可修正的
  // 输入矛盾，文案本就是给人看的——归 ChartUserError 走 route 400，不落 500 泛化吞掉人话。
  let pool: ReturnType<typeof buildPool>;
  try {
    pool = buildPool({
    姓氏: req.姓氏,
    性别: req.性别,
    喜用神: xiyongshen.喜用神,
    忌神: xiyongshen.忌神,
    // 明细透传：pool 按 角色 差异化评分（次用 +7），缺省时旧口径 +14。
    ...(xiyongshen.喜用神明细 !== undefined ? { 喜用神明细: xiyongshen.喜用神明细 } : {}),
    名字形式: req.名字形式,
    ...(req.辈字
      ? { 辈字: { 字: req.辈字.字, 位置: req.辈字.位置 === '第一' ? (1 as const) : (2 as const) } }
      : {}),
    // 指定字（契约 v3 §1.5）：位置枚举两侧同形（任一|第一|第二），原样透传。
    ...(req.指定字 ? { 指定字: { 字: req.指定字.字, 位置: req.指定字.位置 } } : {}),
    ...(req.避讳字.length > 0 ? { 避讳字: req.避讳字 } : {}),
    ...(req.禁用字 ? { 禁用字: req.禁用字 } : {}),
      // 「重新生成」排重（契约 v1.1）：default 后恒为数组；空数组=不排除，不传。
      ...(req.排除已选.length > 0 ? { 排除已选: req.排除已选 } : {}),
    });
  } catch (err) {
    if (err instanceof Error) throw new ChartUserError(err.message);
    throw err;
  }

  return {
    输入: {
      姓氏: req.姓氏,
      ...(req.母亲姓氏 !== undefined ? { 母亲姓氏: req.母亲姓氏 } : {}),
      ...(req.名字草案 !== undefined ? { 名字草案: req.名字草案 } : {}),
      性别: req.性别,
      出生地经度: req.经度,
      北京时间,
      出生日期, // 公历归一后恒提供（时区/夏令时/农历换算后口径，展示与降级引擎共用）
      ...(req.辈字 ? { 辈字: req.辈字.字 } : {}),
      ...(req.指定字 ? { 指定字: { 字: req.指定字.字, 位置: req.指定字.位置 } } : {}),
      避讳字: [...req.避讳字],
    },
    bazi,
    wuge,
    名字草案平仄: 草案平仄,
    xiyongshen,
    candidates: [...pool.候选], // PoolResult 是 readonly 视图，契约为可变数组
  };
}
