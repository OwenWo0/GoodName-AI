/**
 * 五格格局计算 —— 熊崎派五格剖象，全表查、可复算，无模型参与。
 *
 * 公式（主 agent 定稿）：天格=单姓+1/复姓两字和；人格=姓末+名首；地格=单名+1/名双字和；
 * 总格=全和；外格=总格−人格+1，**单姓单名恒 2**（公式退化，按惯例处理并留痕）。
 * 复姓双名时本式与日系「姓首+名末」流派相差 1，查表结果不同 —— 在 争议标注 留痕。
 * 三才按 天人地 数理尾数五行（1,2木 3,4火 5,6土 7,8金 9,0水）查 sancai.json，
 * 该表为历代断语汇编，**不可**由生克规则推导（厂商同结论）。
 */

import type { GeItem, WugeResult } from '../types';
import { kangxiStrokes, type KangxiTextResult } from './kangxi';
import { scoreWuge } from './score';
import shuliJson from '../../data/shuli-81.json';
import sancaiJson from '../../data/sancai.json';

interface ShuliEntry {
  吉凶: GeItem['吉凶'];
  诗号: string;
  含义: string;
  关键词: string;
}
interface SancaiEntry {
  吉凶: string;
  含义: string;
}

const SHULI = shuliJson.数理 as unknown as Record<string, ShuliEntry>;
const SANCAI = sancaiJson.配置 as unknown as Record<string, SancaiEntry>;

/** 固定起源提示（契约字段，文案勿改）。 */
export const WUGE_ORIGIN_NOTE =
  '五格剖象法源自近代日本熊崎健翁（1928 年创制），非中国传统，仅供参考。';

/** 数理 >81 逐次减 80（熊崎惯例：超过 81 复归本数）。 */
export function reduceShuli(n: number): number {
  let v = n;
  while (v > 81) v -= 80;
  return v;
}

/** 数理五行按尾数：1,2 木 · 3,4 火 · 5,6 土 · 7,8 金 · 9,0 水。 */
export function shuliWuxing(n: number): '木' | '火' | '土' | '金' | '水' {
  const map: Record<number, '木' | '火' | '土' | '金' | '水'> = {
    1: '木', 2: '木', 3: '火', 4: '火', 5: '土', 6: '土', 7: '金', 8: '金', 9: '水', 0: '水',
  };
  return map[n % 10];
}

function geItem(raw: number): GeItem {
  const n = reduceShuli(raw);
  const e = SHULI[String(n)];
  if (!e) throw new Error(`数理表缺 ${n}（应有 1-81，检查 shuli-81.json）`);
  return { 数理: n, 康熙笔画和: raw, 吉凶: e.吉凶, 含义: `${e.诗号}——${e.含义}` };
}

/** 合并姓/名两段查询结果。 */
function mergeQuery(姓: KangxiTextResult, 名: KangxiTextResult): KangxiTextResult {
  return {
    明细: [...姓.明细, ...名.明细],
    总笔画: 姓.总笔画 == null || 名.总笔画 == null ? null : 姓.总笔画 + 名.总笔画,
    争议标注: [...new Set([...姓.争议标注, ...名.争议标注])],
  };
}

/**
 * 计算五格。任一字库缺失 → null（调用方按契约渲染「字缺失」），
 * 姓氏 1-2 字、名字 1-2 字之外抛错。
 */
export function computeWuge(姓: string, 名: string): WugeResult | null {
  const sChars = [...姓];
  const gChars = [...名];
  if (sChars.length < 1 || sChars.length > 2) throw new Error(`姓氏须为 1-2 字，收到「${姓}」`);
  if (gChars.length < 1 || gChars.length > 2) throw new Error(`名字须为 1-2 字，收到「${名}」`);

  const 姓查 = kangxiStrokes(姓);
  const 名查 = kangxiStrokes(名);
  const 合并 = mergeQuery(姓查, 名查);
  if (合并.总笔画 == null) return null;

  const s = 姓查.明细.map((h) => h.笔画 as number);
  const g = 名查.明细.map((h) => h.笔画 as number);
  const 单姓 = s.length === 1;
  const 单名 = g.length === 1;

  const tian = 单姓 ? s[0] + 1 : s[0] + s[1];
  const ren = s[s.length - 1] + g[0];
  const di = 单名 ? g[0] + 1 : g[0] + g[1];
  const zong = s.reduce((a, b) => a + b, 0) + g.reduce((a, b) => a + b, 0);

  const 争议标注 = [...合并.争议标注];
  let wai: number;
  if (单姓 && 单名) {
    wai = 2;
    争议标注.push('外格按惯例恒为 2（单姓单名公式退化），部分流派视此格为无意义');
  } else {
    wai = zong - ren + 1;
    if (!单姓 && !单名) {
      const alt = s[0] + g[g.length - 1];
      争议标注.push(`外格按「总格−人格+1」取 ${wai}；日系流派（熊崎原表）作「姓首+名末」取 ${alt}，两式差 1，属流派分歧，本表取前者`);
    }
  }

  const combo = `${shuliWuxing(tian)}${shuliWuxing(ren)}${shuliWuxing(di)}`;
  const sc = SANCAI[combo];
  if (!sc) throw new Error(`三才配置表缺 ${combo}（应有 125 条，检查 sancai.json）`);

  const 盘面 = {
    天格: geItem(tian),
    人格: geItem(ren),
    地格: geItem(di),
    外格: geItem(wai),
    总格: geItem(zong),
    三才: { 配置: combo, 吉凶: sc.吉凶, 含义: sc.含义 },
    明细: 合并.明细.map((h) => ({ 简体: h.简体, 繁体: h.繁体, 康熙笔画: h.笔画 as number })),
    争议标注,
    五格起源争议提示: WUGE_ORIGIN_NOTE,
  };
  // 综合评分排盘期一次算好（口径与权重见 wuge/score.ts），下游直接消费。
  return { ...盘面, 评分: scoreWuge(盘面) };
}
