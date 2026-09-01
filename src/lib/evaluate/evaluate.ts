/**
 * 任意名评估纯函数（契约 v2 §3）：意向吉名与名人匹配共用的评估内核。
 *
 * 无 IO、无随机：loadCharDB 首次装配后只读；同输入同输出。
 * 表外字（CharDB.字 查不到 → 五行/笔画不可得）只警告不过滤——意向是用户的名字，如实呈报：
 * 记入 表外字、五行数组跳过该字、契合分跳过该项计分、computeWuge 自然 null。
 */
import { buildDraftPingze } from '@/lib/chart/orchestrate';
import { loadCharDB } from '@/lib/pool/char-db';
import { buzzOfName, 评分常量 } from '@/lib/pool/rank';
import { computeWuge } from '@/lib/wuge/geju';
import type { WuXing, XiyongMingXiItem } from '@/lib/types';
import type { EvaluatedName, 契合档位, 契合评估 } from './types';

/** 评估上下文 = 请求中的命理侧输入（喜忌来自当前盘，非逐名输入）。 */
export interface EvaluateCtx {
  readonly 喜用神: readonly WuXing[];
  readonly 忌神: readonly WuXing[];
  /** 十神明细：角色='次用' 的五行按次用计分（+7 替代 +14，对齐 charStaticScore 口径）。 */
  readonly 喜用神明细?: readonly XiyongMingXiItem[];
  readonly 避讳字?: readonly string[];
}

/** 契合分 = charStaticScore 的 喜/次/忌 三项之和（爆款/多音/常用级是海选信号，不进展示分）。 */
function 契合分of(
  wx: WuXing,
  喜用神: ReadonlySet<WuXing>,
  忌神: ReadonlySet<WuXing>,
  次用: ReadonlySet<WuXing> | null,
): number {
  let s = 0;
  if (次用?.has(wx)) s += 评分常量.次用字;
  else if (喜用神.has(wx)) s += 评分常量.喜用神字;
  if (忌神.has(wx)) s += 评分常量.忌神字;
  return s;
}

/** 档位（契约 §3）：犯忌一票否决 →'下'；全部字命中（含次用）→'上'；有命中→'中上'；否则'中'。 */
function 档位of(命中数: number, 总字数: number, 犯忌: boolean): 契合档位 {
  if (犯忌) return '下';
  if (命中数 > 0 && 命中数 === 总字数) return '上';
  return 命中数 > 0 ? '中上' : '中';
}

function evaluateOne(姓氏: string, 名: string, ctx: EvaluateCtx): EvaluatedName {
  const db = loadCharDB();
  const 喜用神 = new Set<WuXing>(ctx.喜用神);
  const 忌神 = new Set<WuXing>(ctx.忌神);
  const 次用集 = ctx.喜用神明细
    ? new Set<WuXing>(ctx.喜用神明细.filter((i) => i.角色 === '次用').map((i) => i.五行))
    : null;

  const 表外字: string[] = [];
  const 五行: WuXing[] = [];
  const 命中喜用: WuXing[] = [];
  const 命中次用: WuXing[] = [];
  const 命中忌神: WuXing[] = [];
  let 分 = 0;

  for (const ch of [...名]) {
    const info = db.字.get(ch);
    if (!info) {
      表外字.push(ch); // 五行不可得 → 记表外、跳过该项计分（computeWuge 自然 null）
      continue;
    }
    const wx = info.五行;
    五行.push(wx);
    // 命中归类与 charStaticScore 同优先级：次用先判，否则主用（忌神独立并列计）
    if (次用集?.has(wx)) 命中次用.push(wx);
    else if (喜用神.has(wx)) 命中喜用.push(wx);
    if (忌神.has(wx)) 命中忌神.push(wx);
    分 += 契合分of(wx, 喜用神, 忌神, 次用集);
  }

  const 说明: string[] = [];
  if (表外字.length > 0) 说明.push(`「${表外字.join('、')}」无五行档案（表外字），五行与契合分未计入`);
  const 犯讳 = [...名].filter((ch) => ctx.避讳字?.includes(ch));
  if (犯讳.length > 0) 说明.push(`含避讳字「${[...new Set(犯讳)].join('、')}」`); // 不隐藏不降档

  const 契合: 契合评估 = {
    命中喜用,
    命中次用,
    命中忌神,
    档位: 档位of(命中喜用.length + 命中次用.length, [...名].length, 命中忌神.length > 0),
    分,
    说明,
  };

  return {
    名,
    表外字,
    五行,
    平仄: buildDraftPingze(姓氏, 名),
    五格: computeWuge(姓氏, 名),
    爆款度: buzzOfName(名, (ch) => db.字.get(ch)?.爆款权重 ?? 0, db.爆款名集.has(名)),
    契合,
  };
}

/**
 * 名单 → 逐项完整评估（平仄/五格/爆款度/喜忌契合）。
 * 名部已经 schema 校验（1-2 汉字、去重），此处不再防御畸形输入；表外字按上注口径优雅降级。
 */
export function evaluateNames(姓氏: string, 名字列表: readonly string[], ctx: EvaluateCtx): EvaluatedName[] {
  return 名字列表.map((名) => evaluateOne(姓氏, 名, ctx));
}
