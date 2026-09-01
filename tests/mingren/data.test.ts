/**
 * 名人库数据校验（契约 v2 §4）——src/data/mingren-names.json = MingrenEntry[]。
 * 出处诚实铁律的机器侧防线：形状（zod）、唯一性、规模、类别多样性、
 * 以及 CharDB 字覆盖——名部每字须在 loadCharDB().字 可查且有五行，
 * 否则该条目在匹配端恒被表外剔（死条目）。
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import mingrenJson from '@/data/mingren-names.json';
import { loadCharDB } from '@/lib/pool/char-db';
import { 出处类型枚举, 名人类别枚举, type MingrenEntry } from '@/lib/mingren/types';

const 条目模式 = z.object({
  姓: z.string().regex(/^[一-鿿]{1,2}$/, '姓须为 1-2 汉字'),
  名: z.string().regex(/^[一-鿿]{1,2}$/, '名部须为 1-2 汉字'),
  时代: z.string().min(1),
  类别: z.enum(名人类别枚举),
  简介: z.string().min(1).max(30),
  出处: z.string().min(1),
  出处类型: z.enum(出处类型枚举),
});
const 库模式 = z.array(条目模式);

describe('mingren-names.json 名人库数据', () => {
  const 库 = mingrenJson as MingrenEntry[];

  it('顶层是数组且全量通过 zod 校验', () => {
    expect(Array.isArray(mingrenJson)).toBe(true);
    const r = 库模式.safeParse(mingrenJson);
    if (!r.success) {
      const 首错 = r.error.issues
        .slice(0, 5)
        .map((i) => `#${i.path.join('.')}: ${i.message}`)
        .join('; ');
      expect.fail(`zod 校验失败（前5条）: ${首错}`);
    }
    expect(r.success).toBe(true);
  });

  it('总条数 ≥150', () => {
    expect(库.length).toBeGreaterThanOrEqual(150);
  });

  it('(姓+名) 组合唯一', () => {
    const 键 = 库.map((e) => e.姓 + e.名);
    expect(new Set(键).size).toBe(键.length);
  });

  it('类别覆盖 ≥7 种且全部在枚举内', () => {
    const 类别集 = new Set(库.map((e) => e.类别));
    expect(类别集.size).toBeGreaterThanOrEqual(7);
    for (const c of 类别集) expect(名人类别枚举).toContain(c);
  });

  it('出处类型全部在枚举内', () => {
    for (const e of 库) expect(出处类型枚举).toContain(e.出处类型);
  });

  it('名部两字条目 ≥80（双名请求是默认模式）', () => {
    const 双名数 = 库.filter((e) => [...e.名].length === 2).length;
    expect(双名数).toBeGreaterThanOrEqual(80);
  });

  it('名部一字条目足量（单名请求也要可匹配）', () => {
    const 单名数 = 库.filter((e) => [...e.名].length === 1).length;
    expect(单名数).toBeGreaterThanOrEqual(30);
  });

  it('简介 ≤30 字（按码位计）', () => {
    const 超长 = 库.filter((e) => [...e.简介].length > 30).map((e) => e.姓 + e.名);
    expect(超长).toEqual([]);
  });

  it('每类 ≥5 条（类别不能空转）', () => {
    for (const 类别 of 名人类别枚举) {
      const n = 库.filter((e) => e.类别 === 类别).length;
      expect(n, `类别「${类别}」仅 ${n} 条`).toBeGreaterThanOrEqual(5);
    }
  });

  it('当代人物一律 出处类型=公开资料', () => {
    const 违例 = 库
      .filter((e) => e.时代 === '当代' && e.出处类型 !== '公开资料')
      .map((e) => e.姓 + e.名);
    expect(违例).toEqual([]);
  });

  it('CharDB 字覆盖：名部每字在 loadCharDB().字 可查且有五行（防死条目）', () => {
    const db = loadCharDB();
    const 缺档 = new Set<string>();
    for (const e of 库) {
      for (const ch of e.名) {
        const c = db.字.get(ch);
        if (c == null || !c.五行) 缺档.add(`${e.姓}${e.名}→${ch}`);
      }
    }
    expect([...缺档]).toEqual([]);
  });
});
