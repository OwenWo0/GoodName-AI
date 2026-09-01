/**
 * 对拍单测：kangxi-data 本地等价层 vs 包版 charDetail（node 环境，包可正常读 fs）。
 *
 * 语料 = 全表 chars 键 ∪ alias 键 ∪ tradIndex 繁体镜像键，逐字比 繁体/康熙笔画 两字段
 * （kangxi.ts 的全部消费面）。本测同时锁两件事：
 *  ① 提取脚本 tradIndex 算法与包 store.js 严格一致（镜像归简、不等笔画对不并、表序优先）；
 *  ② 提交的 kangxi-chars.json 与已安装 shunshi-kangxi-core 版本不漂移——
 *     升级包后若变红，重跑 `bun run gen:kangxi-data` 再生成数据。
 */
import { describe, expect, it } from 'vitest';
import { charDetail } from 'shunshi-kangxi-core';
import { kangxiCharDetail } from '@/lib/wuge/kangxi-data';
import data from '@/data/kangxi-chars.json';

const 表 = data as unknown as {
  chars: Record<string, { t?: string }>;
  alias: Record<string, string>;
  tradIndex: Record<string, string>;
};

const 语料 = [
  ...Object.keys(表.chars),
  ...Object.keys(表.alias),
  ...Object.keys(表.tradIndex),
];

const 投影 = (r: { 繁体: string; 康熙笔画: number | null } | null) =>
  r === null ? null : `${r.繁体}|${r.康熙笔画}`;

describe('kangxiCharDetail 与包 charDetail 全表对拍', () => {
  it('语料覆盖 Sanity：三表皆非空', () => {
    expect(语料.length).toBeGreaterThan(20000);
  });

  it('全部语料的 繁体/康熙笔画 与包逐字一致', () => {
    const 差异: string[] = [];
    for (const 字 of 语料) {
      const mine = 投影(kangxiCharDetail(字));
      const pkg = 投影(charDetail(字));
      if (mine !== pkg) 差异.push(`${字}: 本地=${mine} 包=${pkg}`);
    }
    expect(差异).toEqual([]);
  });

  it('已知语义锚点：简体直查 / 繁体镜像归简 / 库外字 null', () => {
    // 简体主键直查
    expect(kangxiCharDetail('一')).toEqual({ 繁体: '一', 康熙笔画: 1 });
    // 繁体输入经 tradIndex 归简体主条目（顧→顾，笔画从简体侧 kx 计）
    expect(kangxiCharDetail('顧')).toEqual(kangxiCharDetail('顾'));
    // 库外私用区字 → null（kangxi.ts 走「缺失」标注路径）
    expect(kangxiCharDetail('〿')).toBeNull();
  });
});
