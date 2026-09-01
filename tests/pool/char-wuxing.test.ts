/**
 * char-wuxing.json 数据校验（M3 数据缺口子任务验收）。
 * 铁律：表内字必须全部落在《通用规范汉字表》内，五行值合法，
 * 康熙笔画与 kangxiStrokesOf（computeWuge 同管线）逐字一致。
 */
import { describe, expect, it } from 'vitest';
import charWuxing from '@/data/char-wuxing.json';
import standardChars from '@/data/standard-chars.json';
import { kangxiStrokesOf } from '@/lib/wuge/kangxi';
import { flattenStandardCharSet, checkStandard } from '@/lib/chars/standard-table';

const WUXING = new Set(['木', '火', '土', '金', '水']);
const 条目 = Object.entries(charWuxing.字) as Array<[string, [string, string, number, number, 0 | 1]]>;

describe('char-wuxing.json 结构', () => {
  it('_meta 记录来源与生成方式（禁凭模型记忆编表）', () => {
    expect(charWuxing._meta.来源.length).toBeGreaterThanOrEqual(3);
    expect(charWuxing._meta.生成方式).toContain('bun');
    expect(charWuxing._meta.统计.表内字数).toBe(条目.length);
  });

  it('非空且量级合理（通用规范汉字表 8105 字的大部分）', () => {
    expect(条目.length).toBeGreaterThan(7000);
  });

  it('五行值仅木火土金水，笔画正整数，声调 1-5，多音 0/1', () => {
    for (const [ch, [wx, , kx, tone, poly]] of 条目) {
      expect(WUXING.has(wx), `${ch} 五行=${wx}`).toBe(true);
      expect(Number.isInteger(kx) && kx > 0, `${ch} 康熙笔画=${kx}`).toBe(true);
      expect(tone, `${ch} 声调`).toBeGreaterThanOrEqual(1);
      expect(tone, `${ch} 声调`).toBeLessThanOrEqual(5);
      expect([0, 1]).toContain(poly);
    }
  });

  it('来源标注合法：康熙五行库 / 部首X / 笔画尾数法 三态之一', () => {
    for (const [ch, [, src]] of 条目) {
      const ok = src === '康熙五行库' || src === '笔画尾数法' || /^部首.+$/.test(src);
      expect(ok, `${ch} 来源=${src}`).toBe(true);
    }
  });

  it('康熙五行库为主源（>80%），笔画尾数兜底为少数派', () => {
    const counts = { 库: 0, 尾数: 0, 部首: 0 };
    for (const [, [, src]] of 条目) {
      if (src === '康熙五行库') counts.库++;
      else if (src === '笔画尾数法') counts.尾数++;
      else counts.部首++;
    }
    expect(counts.库 / 条目.length).toBeGreaterThan(0.8);
    expect(counts.尾数 / 条目.length).toBeLessThan(0.2);
  });
});

describe('char-wuxing.json 与既有管线一致性', () => {
  it('全部表内字 ∈《通用规范汉字表》（交集校验，逐字全量）', () => {
    const set = flattenStandardCharSet(standardChars);
    const 表外 = 条目.map(([ch]) => ch).filter((ch) => !set.has(ch));
    expect(表外).toEqual([]);
  });

  it('逐字康熙笔画与 kangxiStrokesOf 完全一致（枚举算术与 computeWuge 不打架）', () => {
    const 不一致: string[] = [];
    for (const [ch, [, , kx]] of 条目) {
      const 现算 = kangxiStrokesOf(ch).笔画;
      if (现算 !== kx) 不一致.push(`${ch}:表${kx}/现算${现算}`);
    }
    expect(不一致).toEqual([]);
  });

  it('一级字覆盖率 ≥ 95%（起名主用字库不缺位）', () => {
    const 一级在表 = standardChars.一级.filter((ch) => ch in charWuxing.字).length;
    expect(一级在表 / standardChars.一级.length).toBeGreaterThanOrEqual(0.95);
  });

  it('checkStandard 对随机抽样表内姓名全绿', () => {
    const set = flattenStandardCharSet(standardChars);
    const 抽样 = 条目.filter((_, i) => i % 257 === 0).map(([ch]) => ch).join('');
    expect(checkStandard(抽样, set).全部在通用规范汉字表).toBe(true);
  });
});

describe('char-wuxing.json 姓名学口径抽查（对照通行五行命名表）', () => {
  it.each([
    ['沐', '水'], ['林', '木'], ['炎', '火'], ['垚', '土'], ['鑫', '金'],
    ['江', '水'], ['森', '木'], ['梓', '木'], ['浩', '水'], ['钰', '金'],
  ])('%s 属%s', (ch, wx) => {
    expect(charWuxing.字[ch as keyof typeof charWuxing.字]?.[0]).toBe(wx);
  });
});
