/**
 * 内置不宜入名黑名单：数据口径（宁缺毋滥）+ 池生效 + 辈字豁免。
 * 验收动因：候选池曾产出 亭僻/亭厉/东噩/亭哮/亮刁（僻厉叹噩哮刁皆一级 literacy 常用字）。
 */
import { describe, expect, it } from 'vitest';
import { NAME_TABOO, NAME_TABOO_类别 } from '@/lib/chars/name-taboo';
import { buildPool } from '@/lib/pool/pool';
import { loadCharDB } from '@/lib/pool/char-db';

describe('name-taboo 数据口径', () => {
  it('全部为单字且规模合理', () => {
    expect(NAME_TABOO.size).toBeGreaterThan(100);
    for (const ch of NAME_TABOO) expect([...ch]).toHaveLength(1);
  });

  it('验收肇事字必在列', () => {
    for (const ch of '僻厉叹噩哮刁惧屎死鬼骂但奖剂') expect(NAME_TABOO.has(ch)).toBe(true);
  });

  it('审美争议/文学字与常用好字一律不收（宁缺毋滥）', () => {
    for (const ch of '明远知白若汐翊珵婷涵轩梓欣悦雨雪孤尘落惊优伶流剑虎斗啸兔')
      expect(NAME_TABOO.has(ch)).toBe(false);
  });

  it('类别映射覆盖全字集', () => {
    for (const ch of NAME_TABOO) expect(NAME_TABOO_类别.get(ch)).toBeTruthy();
  });
});

describe('buildPool 黑名单生效', () => {
  it('火金双名候选逐字零命中黑名单（40 候选全查）', () => {
    const r = buildPool({ 姓氏: '李', 性别: '男', 喜用神: ['火', '金'], 忌神: ['土'], 名字形式: '双名' });
    expect(r.候选.length).toBeGreaterThan(0);
    for (const c of r.候选) {
      for (const ch of [...c.名]) expect(NAME_TABOO.has(ch), `${c.名} 含黑名单字${ch}`).toBe(false);
    }
  });

  it('单名同样过滤', () => {
    const r = buildPool({ 姓氏: '林', 性别: '女', 喜用神: ['水'], 名字形式: '单名' });
    for (const c of r.候选) expect(NAME_TABOO.has(c.名)).toBe(false);
  });
});

describe('辈字豁免（用户强制约束 > 产品黑名单）', () => {
  it('黑名单字作辈字：不报矛盾错、候选锁定该字', () => {
    const db = loadCharDB();
    const 禁字候选 = [...NAME_TABOO].find((ch) => db.字.has(ch));
    expect(禁字候选, '五行字表应至少含一个黑名单字，否则本用例失效').toBeTruthy();
    const r = buildPool({
      姓氏: '李',
      性别: '男',
      喜用神: ['火', '金'],
      名字形式: '双名',
      辈字: { 字: 禁字候选 as string, 位置: 1 },
    });
    expect(r.候选.length).toBeGreaterThan(0);
    for (const c of r.候选) expect([...c.名][0]).toBe(禁字候选);
  });
});
