/**
 * 数据表验收测试：shuli-81.json / sancai.json / kangxi-overrides.json。
 * 断言条目数、枚举合规、边界抽样与跨源对表结论——数据即契约，先于实现钉死。
 */
import { describe, it, expect } from 'vitest';

import shuli from '@/data/shuli-81.json';
import sancai from '@/data/sancai.json';
import overrides from '@/data/kangxi-overrides.json';

const GE_ENUM = ['大吉', '吉', '半吉', '凶', '末定'] as const;
const SANCAI_ENUM = ['大吉', '吉', '半吉', '凶', '大凶'];

describe('shuli-81.json 数理表', () => {
  const table = shuli.数理 as Record<string, { 吉凶: string; 诗号: string; 含义: string; 关键词: string; 原始吉凶?: string }>;

  it('恰好 81 条，键为字符串 1..81', () => {
    expect(Object.keys(table)).toHaveLength(81);
    for (let n = 1; n <= 81; n++) {
      expect(table[String(n)], `缺数理 ${n}`).toBeDefined();
    }
    expect(table['82']).toBeUndefined();
  });

  it('吉凶全部落在 types.ts GeItem 枚举内（不含大凶）', () => {
    for (const [n, e] of Object.entries(table)) {
      expect(GE_ENUM, `数理 ${n} 吉凶=${e.吉凶}`).toContain(e.吉凶 as (typeof GE_ENUM)[number]);
      expect(e.吉凶).not.toBe('大凶');
    }
  });

  it('边界抽样 1-5 与 81：吉/凶/大吉/凶/大吉/大吉（对照 ja.wikipedia 熊崎吉数表）', () => {
    expect(table['1'].吉凶).toBe('吉');
    expect(table['2'].吉凶).toBe('凶');
    expect(table['3'].吉凶).toBe('大吉');
    expect(table['4'].吉凶).toBe('凶');
    expect(table['5'].吉凶).toBe('大吉');
    expect(table['81'].吉凶).toBe('大吉');
    expect(table['3'].诗号).toContain('三才之数');
  });

  it('每条都有非空 含义/诗号/关键词', () => {
    for (const [n, e] of Object.entries(table)) {
      expect(e.含义.length, `数理 ${n} 含义为空`).toBeGreaterThan(5);
      expect(e.诗号.length).toBeGreaterThan(1);
      expect(e.关键词.length).toBeGreaterThan(1);
    }
  });

  it('吉凶分布 = 大吉22/吉16/半吉12/凶31（源 大凶22 并入凶），_meta 记录来源', () => {
    const dist: Record<string, number> = {};
    for (const e of Object.values(table)) dist[e.吉凶] = (dist[e.吉凶] ?? 0) + 1;
    expect(dist).toEqual({ 大吉: 22, 吉: 16, 半吉: 12, 凶: 31 });
    expect(shuli._meta.来源).toContain('shunshi-ai/naming-mcp');
    expect(shuli._meta.吉凶分布).toEqual({ 大吉: 22, 吉: 16, 半吉: 12, 凶: 31 });
  });
});

describe('sancai.json 三才配置表', () => {
  const table = sancai.配置 as Record<string, { 吉凶: string; 含义: string }>;

  it('恰好 125 条，覆盖 五行³ 全部组合', () => {
    expect(Object.keys(table)).toHaveLength(125);
    for (const a of ['木', '火', '土', '金', '水']) {
      for (const b of ['木', '火', '土', '金', '水']) {
        for (const c of ['木', '火', '土', '金', '水']) {
          expect(table[a + b + c], `缺三才 ${a}${b}${c}`).toBeDefined();
        }
      }
    }
  });

  it('吉凶五档合法且含义非空', () => {
    for (const [k, e] of Object.entries(table)) {
      expect(SANCAI_ENUM, `三才 ${k}`).toContain(e.吉凶);
      expect(e.含义.length).toBeGreaterThan(5);
    }
  });

  it('对表抽样：顺生大吉、双克大凶、单克凶', () => {
    expect(table['木木木'].吉凶).toBe('大吉');
    expect(table['木木火'].吉凶).toBe('大吉');
    expect(table['木火土'].吉凶).toBe('大吉');
    expect(table['金木金'].吉凶).toBe('大凶');
    expect(table['火水金'].吉凶).toBe('大凶');
    expect(table['木木金'].吉凶).toBe('凶');
  });
});

describe('kangxi-overrides.json override 补丁表', () => {
  const table = overrides as Record<string, unknown>;

  it('萬=15（字库繁体直查 13 为误），里=7（字库默认映射 裏/13）', () => {
    expect(table['萬']).toBe(15);
    expect(table['里']).toBe(7);
  });

  it('_meta 说明存在，其余键均为 单汉字→正整数', () => {
    expect(typeof table['_meta']).toBe('object');
    for (const [k, v] of Object.entries(table)) {
      if (k === '_meta') continue;
      expect(k.length).toBe(1);
      expect(typeof v).toBe('number');
      expect(Number.isInteger(v)).toBe(true);
      expect(v as number).toBeGreaterThan(0);
    }
  });
});
