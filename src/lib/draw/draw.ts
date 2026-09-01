/**
 * 无命盘抽卡引擎（契约 C3）：校验过的请求 → buildPool → {候选, 统计}。
 *
 * 纯同步确定性内核，零随机源：「再抽」= 上层带 排除已选=历批名部并集 重发
 * （同输入必同输出，禁前端随机伪装）。忌神固定 []；五行偏好空/缺 → 透传五行全集
 * （=不限，pool「至少一字中喜用」恒真）。
 *
 * 错误契约（仿 chart/orchestrate 的 ChartUserError）：DrawUserError = 用户可修正的
 * 输入问题（姓氏康熙笔画缺失/指定字不在五行字表/约束矛盾），route 层报 400 中文；
 * 其余异常 = 服务端缺陷，route 层报 500 泛化，细节只进 stderr。
 */
import { kangxiStrokesOf } from '@/lib/wuge/kangxi';
import { loadCharDB } from '@/lib/pool/char-db';
import { buildPool, type PoolResult } from '@/lib/pool/pool';
import { 五行全集, type PoolInput } from '@/lib/pool/types';
import type { DrawNamesRequest } from './schema';

/** 用户可修正的输入错误；route 层据此报 400（对齐 ChartUserError 先例）。 */
export class DrawUserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DrawUserError';
  }
}

/** buildPool 会抛的三类用户可修正输入问题，前置为 DrawUserError（400）拦截。 */
function 前置校验(req: DrawNamesRequest): void {
  for (const ch of [...req.姓氏]) {
    if (kangxiStrokesOf(ch).笔画 == null) {
      throw new DrawUserError(`姓氏「${req.姓氏}」康熙笔画缺失，无法排格海选。`);
    }
  }
  if (!req.指定字) return;
  const 字 = req.指定字.字;
  if (!loadCharDB().字.has(字)) {
    throw new DrawUserError(`指定字「${字}」不在五行字表内，笔画/五行无从计算，请换一个或留空。`);
  }
  const 讳禁 = new Set([...(req.避讳字 ?? []), ...(req.禁用字 ?? [])]);
  if (讳禁.has(字)) {
    throw new DrawUserError(`指定字「${字}」同时出现在避讳/禁用表中，约束矛盾。`);
  }
  if ([...req.姓氏].includes(字)) {
    throw new DrawUserError(`指定字「${字}」与姓氏重字，约束矛盾。`);
  }
}

/** 建抽卡候选池（主入口，纯同步确定性；池空返回空候选不抛错）。 */
export function drawNames(req: DrawNamesRequest): PoolResult {
  前置校验(req);
  const input: PoolInput = {
    姓氏: req.姓氏,
    性别: req.性别,
    名字形式: req.名字形式,
    喜用神: req.五行偏好 && req.五行偏好.length > 0 ? [...req.五行偏好] : [...五行全集],
    忌神: [],
    ...(req.指定字 !== undefined ? { 指定字: req.指定字 } : {}),
    ...(req.避讳字 !== undefined ? { 避讳字: req.避讳字 } : {}),
    ...(req.禁用字 !== undefined ? { 禁用字: req.禁用字 } : {}),
    ...(req.排除已选 !== undefined ? { 排除已选: req.排除已选 } : {}),
    期望候选数: req.期望候选数,
  };
  return buildPool(input);
}
