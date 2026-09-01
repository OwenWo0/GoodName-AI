/**
 * 好意向字库数据校验（契约 v3 §2）——src/data/good-intent-chars.json = 好意向字[]。
 * 防线：形状（zod）、字唯一、规模 ≥300、每五行类 ≥30、标签/寓意长度界、
 * 溢美禁词剔除，以及 CharDB 交叉核验（字在表 / 五行一致 / 非多音 / 常用级≥1）
 * ——违者在指定字/抽卡链上是死条目，整测红。
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import goodIntentJson from '@/data/good-intent-chars.json';
import { loadCharDB } from '@/lib/pool/char-db';

interface 好意向字 {
  字: string;
  五行: '木' | '火' | '土' | '金' | '水';
  意向标签: string[];
  寓意: string;
}

const 五行枚举 = ['木', '火', '土', '金', '水'] as const;

const 条目模式 = z.object({
  字: z.string().regex(/^[一-鿿]$/, '字须为单个汉字'),
  五行: z.enum(五行枚举),
  意向标签: z.array(z.string().min(1).max(6)).min(1).max(3),
  寓意: z
    .string()
    .refine((s) => [...s].length >= 4 && [...s].length <= 20, '寓意须为 4-20 字（按码位计）'),
});
const 库模式 = z.array(条目模式);

describe('good-intent-chars.json 好意向字库数据', () => {
  const 库 = goodIntentJson as 好意向字[];

  it('顶层是数组且全量通过 zod 校验', () => {
    expect(Array.isArray(goodIntentJson)).toBe(true);
    const r = 库模式.safeParse(goodIntentJson);
    if (!r.success) {
      const 首错 = r.error.issues
        .slice(0, 5)
        .map((i) => `#${i.path.join('.')}: ${i.message}`)
        .join('; ');
      expect.fail(`zod 校验失败（前5条）: ${首错}`);
    }
    expect(r.success).toBe(true);
  });

  it('总条数 ≥300', () => {
    expect(库.length).toBeGreaterThanOrEqual(300);
  });

  it('字全局唯一', () => {
    const 键 = 库.map((e) => e.字);
    expect(new Set(键).size).toBe(键.length);
  });

  it('每五行类 ≥30 条（覆盖均衡）', () => {
    for (const wx of 五行枚举) {
      const n = 库.filter((e) => e.五行 === wx).length;
      expect(n, `五行「${wx}」仅 ${n} 条`).toBeGreaterThanOrEqual(30);
    }
  });

  it('意向标签与寓意长度界（标签 1-3 个各≤6 字；寓意 4-20 字）', () => {
    const 违例: string[] = [];
    for (const e of 库) {
      if (e.意向标签.length < 1 || e.意向标签.length > 3) 违例.push(`${e.字}:标签数=${e.意向标签.length}`);
      for (const t of e.意向标签) if ([...t].length > 6) 违例.push(`${e.字}:标签超6字=${t}`);
      const n = [...e.寓意].length;
      if (n < 4 || n > 20) 违例.push(`${e.字}:寓意长度=${n}`);
    }
    expect(违例).toEqual([]);
  });

  it('不含「皇家专用」「帝王」类不可考证溢美', () => {
    const 禁词 = ['皇家专用', '帝王', '皇帝'];
    const 违例 = 库
      .filter((e) => 禁词.some((w) => e.寓意.includes(w) || e.意向标签.some((t) => t.includes(w))))
      .map((e) => e.字);
    expect(违例).toEqual([]);
  });

  it('爆款权重高的顶流字占比 ≤1/4（拒爆款堆量）', () => {
    const db = loadCharDB();
    const 爆款数 = 库.filter((e) => (db.字.get(e.字)?.爆款权重 ?? 0) > 0).length;
    expect(爆款数 / 库.length).toBeLessThanOrEqual(0.25);
  });

  it('CharDB 交叉核验：字在表 / 五行一致 / 非多音 / 常用级≥1（防死条目）', () => {
    const db = loadCharDB();
    const 违例: string[] = [];
    for (const e of 库) {
      const c = db.字.get(e.字);
      if (c == null) {
        违例.push(`${e.字}: 不在 CharDB`);
        continue;
      }
      if (c.五行 !== e.五行) 违例.push(`${e.字}: 库里=${e.五行} CharDB=${c.五行}`);
      if (c.多音) 违例.push(`${e.字}: 多音字`);
      if (c.常用级 < 1) 违例.push(`${e.字}: 常用级=${c.常用级}（生僻）`);
    }
    expect(违例).toEqual([]);
  });
});
