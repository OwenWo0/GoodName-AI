/**
 * 名字用字频率表（CNC 派生）：数据完整性 + 池排序正面信号生效。
 * 动因：常用级=识字频率≠名字频率，无正面信号时码点 tie-break 把 literacy
 * 中性字（亭吕/东冀类）推上榜——本表是候选池唯一正面宜用度证据。
 */
import { describe, expect, it } from 'vitest';
import freqJson from '@/data/name-char-freq.json';
import { buildPool } from '@/lib/pool/pool';
import { loadCharDB } from '@/lib/pool/char-db';

const 频率 = freqJson.频率 as Record<string, number>;
const 条目 = Object.entries(频率);

describe('name-char-freq 数据完整性', () => {
  it('全部单字、计数为正整数', () => {
    for (const [ch, n] of 条目) {
      expect([...ch]).toHaveLength(1);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThan(0);
    }
  });

  it('vendored 文件定序锚点：按频次降序，首三为 文/华/明', () => {
    expect(Object.keys(频率).slice(0, 3)).toEqual(['文', '华', '明']);
    for (let i = 1; i < 条目.length; i++) expect(条目[i]![1]).toBeLessThanOrEqual(条目[i - 1]![1]);
  });

  it('规模与覆盖面（_meta.统计 口径）：高频字足够铺满各笔画桶', () => {
    const 百频 = 条目.filter(([, n]) => n >= 100);
    expect(百频.length).toBeGreaterThanOrEqual(900);
    const db = loadCharDB();
    for (const [ch] of 百频) expect(db.字.has(ch), `字表应含高频名字字${ch}`).toBe(true);
  });

  it('识字常用但非名字宜用字不在正面表（与黑名单互补而非混同）', () => {
    for (const ch of '僻噩卵刁') expect(频率[ch] ?? 0).toBe(0);
  });
});

describe('buildPool 正面频率生效', () => {
  it('火金双名 top-20 候选逐字几乎全部为名字语料实收字（freq≥30）', () => {
    const db = loadCharDB();
    const r = buildPool({ 姓氏: '李', 性别: '男', 喜用神: ['火', '金'], 忌神: ['土'], 名字形式: '双名' });
    let 字总数 = 0;
    let 覆盖 = 0;
    for (const c of r.候选.slice(0, 20)) {
      for (const ch of c.名) {
        字总数++;
        if ((db.字.get(ch)?.名字频率 ?? 0) >= 30) 覆盖++;
      }
    }
    expect(覆盖 / 字总数).toBeGreaterThanOrEqual(0.9);
  });

  it('入选依据含名字语料频次标注（可核对口径）', () => {
    const db = loadCharDB();
    const r = buildPool({ 姓氏: '李', 性别: '男', 喜用神: ['火', '金'], 忌神: ['土'], 名字形式: '双名' });
    const 高频字名 = r.候选.find((c) => [...c.名].some((ch) => (db.字.get(ch)?.名字频率 ?? 0) >= 100));
    expect(高频字名, 'top 候选应出现频次≥100 的字').toBeTruthy();
    expect(高频字名!.入选依据.join('|')).toContain('名字语料频次');
  });
});
