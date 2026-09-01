/**
 * 康熙字形详情本地等价层 —— Workers 安全（零 fs）。
 *
 * 包版 shunshi-kangxi-core charDetail 运行时 readFileSync 懒加载磁盘 gz（还拖 3MB
 * 康熙原文），workerd 无 fs 直接 500。本模块改用构建期提取的静态数据
 * （scripts/extract-kangxi-data.ts → src/data/kangxi-chars.json），镜像 charDetail
 * 解析链，只回 kangxi.ts 消费的两字段：
 *   主键直查 → alias 异体映射 → 落在繁体镜像条目（无 t）时经 tradIndex 归简体主键
 *   （仅并「康熙笔画一致」的简繁对；于/於、余/餘 等 143 对不等者视为独立字不并）。
 *
 * 与包行为由 tests/wuge/kangxi-data-parity.test.ts 全表对拍锁定（node 环境下跑包）。
 * 不 import fs/network/next/react；纯函数可测。
 */

// 形状由 src/types/kangxi-chars.d.ts 的 ambient 声明给出（大 JSON 不走 tsc 结构推断）。
import data from '@/data/kangxi-chars.json';

const 表 = data;

/** charDetail 两字段子集；字段名与包返回一致，消费方零改写。 */
export interface 字形详情 {
  readonly 繁体: string;
  readonly 康熙笔画: number;
}

/**
 * 单字查询，等价于包 charDetail(字) 的 {繁体, 康熙笔画} 投影；
 * 库外字返回 null（与包同路径，调用方 kangxi.ts 走「缺失」标注）。
 */
export function kangxiCharDetail(字: string): 字形详情 | null {
  const table = 表.chars;
  let key = 字 in table ? 字 : 表.alias[字] ?? 字;
  let e = table[key];
  if (e === undefined) return null;
  // 繁体镜像条目（无 t）→ 归简体主条目，取简体侧数据（与包注释同理）。
  if (e.t === undefined) {
    const simp = 表.tradIndex[key];
    if (simp !== undefined) {
      key = simp;
      e = table[simp];
    }
  }
  return { 繁体: e.t ?? key, 康熙笔画: e.kx };
}
