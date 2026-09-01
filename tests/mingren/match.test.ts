/**
 * 名人匹配单测（契约 v2 §4，v3 §4.1 中档放宽）——用内置小夹具库，不依赖 src/data/mingren-names.json 内容。
 * v3 语义翻转：三硬剔（讳禁/任一字犯忌神/含姓谐音）之外**全保留**——
 * 喜用零命中、五格<50、表外字均降为「排序下沉 + 契合.说明 冻结注记」，不再剔除。
 * 夹具名部的五行/五格分以真实字库探针预校准（2026-08-30 复测）：
 * 德彰=火火(77) 昌黎=金火(93) 文煜=水火(53) 克柔=木金(87) 怀瑾=水火(49,低分注记) 守仁=金金(45,低分注记)
 * 轼=金(76) 白=水(75) 杍之=之火(杍表外,综合 66)（综合分对姓氏「林」而言）。
 */
import { describe, expect, it } from 'vitest';
import { charStaticScore, compareDraft } from '@/lib/pool/rank';
import { loadCharDB } from '@/lib/pool/char-db';
import type { WuXing } from '@/lib/types';
import { matchMingren } from '@/lib/mingren/match';
import { mingrenMatchRequestSchema } from '@/lib/mingren/schema';
import type { MingrenEntry } from '@/lib/mingren/types';

const e = (姓: string, 名: string): MingrenEntry => ({
  姓,
  名,
  时代: '测试',
  类别: '文人',
  简介: '测试夹具条目',
  出处: '《测试夹具录·人名卷》',
  出处类型: '史传',
});

/** 夹具库：含同名多人、低分五格（v3 保留+注记）、表外（字库缺档，v3 保留+警告）、单名/双名混合。 */
const 库: readonly MingrenEntry[] = [
  e('张', '德彰'),
  e('李', '德彰'), // 同名多人 → 并出处
  e('周', '昌黎'),
  e('陈', '怀瑾'), // 五格 49 → v3 保留 + 「五格综合 49，低于 50」注记
  e('孙', '文煜'),
  e('赵', '克柔'),
  e('王', '守仁'), // 五格 45 → v3 保留 + 低分注记
  e('钱', '轼'), // 单名
  e('李', '白'), // 单名（水）
  e('吴', '杍之'), // 杍=字库/标准表均无 → v3 保留 + 表外字段/注记
];

const db = loadCharDB();
const 五行Of = (名: string): WuXing[] =>
  [...名].map((ch) => db.字.get(ch)?.五行).filter((w): w is WuXing => w !== undefined);

/** 基线请求：双名（默认）、喜用全覆盖（除土）。v3：三硬剔无一触发 → 双名 7 名部全保留。 */
const baseReq = mingrenMatchRequestSchema.parse({
  姓氏: '林',
  性别: '男',
  喜用神: ['火', '水', '木', '金'],
});

const 名列表 = (r: ReturnType<typeof matchMingren>): string[] => r.候选.map((c) => c.名);
const 找 = (r: ReturnType<typeof matchMingren>, 名: string) => r.候选.find((c) => c.名 === 名);

describe('matchMingren 长度匹配与统计', () => {
  it('双名（默认形式）只出 2 字名部；v3 三硬剔不触发 → 7 名部全保留，命中名数=长度口径过滤前值', () => {
    const r = matchMingren(库, baseReq);
    expect(名列表(r).every((n) => [...n].length === 2)).toBe(true);
    expect(名列表(r).sort()).toEqual(['克柔', '守仁', '德彰', '怀瑾', '文煜', '昌黎', '杍之']);
    expect(r.库规模).toBe(库.length);
    expect(r.命中名数).toBe(7); // 德彰/昌黎/怀瑾/文煜/克柔/守仁/杍之
  });

  it('单名形式：喜用零命中保留（白=水，喜用仅金）且排在中喜用（轼）之后', () => {
    const req = mingrenMatchRequestSchema.parse({
      姓氏: '林',
      性别: '男',
      名字形式: '单名',
      喜用神: ['金'],
    });
    const r = matchMingren(库, req);
    expect(名列表(r)).toEqual(['轼', '白']); // 中喜用(+14) 恒排在 零命中(0分) 前
    const 白 = 找(r, '白');
    expect(白?.契合.档位).toBe('中');
    expect(白?.契合.说明).toContain('未中喜用');
    expect(找(r, '轼')?.契合.说明 ?? []).not.toContain('未中喜用');
    expect(r.命中名数).toBe(2); // 轼/白
  });
});

describe('matchMingren 三硬剔（v3 中档放宽后仅存的剔除项）', () => {
  it('硬剔① 避讳字剔 + 禁用字剔（即便其余全保留，犯讳仍剔）', () => {
    const req = mingrenMatchRequestSchema.parse({
      姓氏: '林',
      性别: '男',
      喜用神: ['火', '水', '木', '金'],
      避讳字: ['彰'],
      禁用字: ['黎'],
    });
    expect(名列表(matchMingren(库, req)).sort()).toEqual([
      '克柔',
      '守仁',
      '怀瑾',
      '文煜',
      '杍之',
    ]);
  });

  it('硬剔② 任一字五行∈忌神剔（克柔/昌黎/守仁含金 → 剔；低分/表外者不因此获免亦不因此受连坐）', () => {
    const req = mingrenMatchRequestSchema.parse({
      姓氏: '林',
      性别: '男',
      喜用神: ['火', '木'],
      忌神: ['金'],
    });
    // 怀瑾(水火)/杍之(之火) 不犯金 → 保留；德彰(火火)/文煜(水火) 保留。
    expect(名列表(matchMingren(库, req)).sort()).toEqual(['德彰', '怀瑾', '文煜', '杍之']);
  });

  it('硬剔③ 谐音黑名单剔（杜+子腾 字面命中），换姓对照可通过', () => {
    const 谐音库: readonly MingrenEntry[] = [e('郑', '子腾')];
    const 喜用 = [...new Set(五行Of('子腾'))];
    expect(喜用.length).toBeGreaterThan(0);
    const req杜 = mingrenMatchRequestSchema.parse({ 姓氏: '杜', 性别: '男', 喜用神: 喜用 });
    expect(matchMingren(谐音库, req杜).候选).toHaveLength(0);
    const req林 = mingrenMatchRequestSchema.parse({ 姓氏: '林', 性别: '男', 喜用神: 喜用 });
    expect(名列表(matchMingren(谐音库, req林))).toEqual(['子腾']);
  });

  it('排除已选剔（硬剔之外的展示级剔除），但命中名数（过滤前口径）不变', () => {
    const req = mingrenMatchRequestSchema.parse({
      姓氏: '林',
      性别: '男',
      喜用神: ['火', '水', '木', '金'],
      排除已选: ['德彰'],
    });
    const r = matchMingren(库, req);
    expect(名列表(r)).not.toContain('德彰');
    expect(r.命中名数).toBe(7);
  });
});

describe('matchMingren v3 降级保留 + 冻结注记', () => {
  it('喜用零命中保留：夹具双名无一含土 → 不剔，全员带「未中喜用」，命中名数照记', () => {
    const req = mingrenMatchRequestSchema.parse({
      姓氏: '林',
      性别: '男',
      喜用神: ['土'],
    });
    const r = matchMingren(库, req);
    expect(名列表(r).sort()).toEqual(['克柔', '守仁', '德彰', '怀瑾', '文煜', '昌黎', '杍之']);
    expect(r.候选.every((c) => c.契合.说明.includes('未中喜用'))).toBe(true);
    expect(r.候选.every((c) => c.契合.档位 === '中')).toBe(true);
    expect(r.命中名数).toBe(7);
  });

  it('五格低分保留带注记（怀瑾 49 剔→留：说明含「五格综合 49，低于 50」；文煜 53 无此注记）', () => {
    const req = mingrenMatchRequestSchema.parse({
      姓氏: '林',
      性别: '男',
      喜用神: ['水', '火'],
    });
    const r = matchMingren(库, req);
    const 怀瑾 = 找(r, '怀瑾');
    expect(怀瑾).toBeDefined();
    expect(怀瑾?.契合.说明).toContain('五格综合 49，低于 50');
    expect(找(r, '文煜')?.契合.说明.join('')).not.toContain('低于 50');
  });

  it('表外字保留且字段填充：杍之 留，表外字=「杍」，说明含「含表外字「杍」」，之(火)照常计分', () => {
    const r = matchMingren(库, baseReq);
    const 杍之 = 找(r, '杍之');
    expect(杍之).toBeDefined();
    expect(杍之?.表外字).toEqual(['杍']);
    expect(杍之?.契合.说明).toContain('含表外字「杍」');
    expect(杍之?.五行).toEqual(['火']); // 表外字跳过五行（evaluate.ts 同口径）
    expect(杍之?.契合.命中喜用).toEqual(['火']);
  });

  it('注记可并存：喜用=土时 杍之 同时带「未中喜用」与「含表外字「杍」」', () => {
    const req = mingrenMatchRequestSchema.parse({ 姓氏: '林', 性别: '男', 喜用神: ['土'] });
    const 杍之 = 找(matchMingren(库, req), '杍之');
    expect(杍之?.契合.说明).toContain('未中喜用');
    expect(杍之?.契合.说明).toContain('含表外字「杍」');
  });
});

describe('matchMingren 出处与旧语义回归', () => {
  it('同名多人并一个候选，出处按 姓+名 码点确定序', () => {
    const r = matchMingren(库, baseReq);
    const 德彰 = 找(r, '德彰');
    expect(德彰?.出处.map((p) => p.姓)).toEqual(['张', '李']); // 张(U+5F20) < 李(U+674E)
    expect(r.候选.filter((c) => c.名 === '德彰')).toHaveLength(1);
  });

  it('EvaluatedName 形状：契合=喜+次+忌和、档位规则（全中上/部分中上）、表外恒空（标准内名）', () => {
    const req = mingrenMatchRequestSchema.parse({ 姓氏: '林', 性别: '男', 喜用神: ['火'] });
    const r = matchMingren(库, req);
    const 德彰 = 找(r, '德彰');
    const 文煜 = 找(r, '文煜');
    expect(德彰?.表外字).toEqual([]);
    expect(德彰?.五行).toEqual(['火', '火']);
    expect(德彰?.契合.档位).toBe('上'); // 双字皆中
    expect(德彰?.契合.分).toBe(28); // 14×2
    expect(德彰?.契合.命中喜用).toEqual(['火', '火']);
    expect(文煜?.契合.档位).toBe('中上'); // 火中水不中（水非忌）
    expect(文煜?.契合.分).toBe(14);
    expect(文煜?.五格?.评分.综合分).toBeGreaterThanOrEqual(50);
    expect(文煜?.平仄.平仄格式.length).toBe(3); // 姓+双名
  });

  it('喜用神明细角色=次用：拆入 命中次用，分按 +7 计（同 rank 口径）', () => {
    const req = mingrenMatchRequestSchema.parse({
      姓氏: '林',
      性别: '男',
      喜用神: ['火', '水'],
      喜用神明细: [{ 五行: '水', 十神关系: '印星', 角色: '次用' }],
    });
    const 文煜 = 找(matchMingren(库, req), '文煜');
    expect(文煜?.契合.命中次用).toEqual(['水']);
    expect(文煜?.契合.命中喜用).toEqual(['火']);
    expect(文煜?.契合.分).toBe(21); // 14+7
  });
});

describe('matchMingren 排序与确定性', () => {
  it('排序 = charStaticScore 总分 + compareDraft tie-break（测试侧独立复算比对；表外字 0 分下沉）', () => {
    const r = matchMingren(库, baseReq);
    const 喜 = new Set<WuXing>(baseReq.喜用神);
    const 忌 = new Set<WuXing>(baseReq.忌神);
    const 期望 = r.候选
      .map((c) => ({
        名: c.名,
        分: [...c.名].reduce((s, ch) => {
          const info = db.字.get(ch);
          return info === undefined ? s : s + charStaticScore(info, 喜, 忌); // 表外字跳过计分
        }, 0),
        笔画和: [...c.名].reduce((s, ch) => s + (db.字.get(ch)?.康熙笔画 ?? 0), 0),
        五行: 五行Of(c.名),
        爆款度: c.爆款度,
        依据: [],
      }))
      .sort(compareDraft)
      .map((d) => d.名);
    expect(名列表(r)).toEqual(期望);
  });

  it('确定性：乱序库（固定置换，无随机）产出与正序库完全一致', () => {
    const 乱序库 = [...库].reverse();
    const a = matchMingren(库, baseReq);
    const b = matchMingren(乱序库, baseReq);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it('上限：默认 200 ≥ 夹具规模全返；显式上限截断且保留排序前缀', () => {
    expect(baseReq.上限).toBe(200);
    const 全量 = 名列表(matchMingren(库, baseReq));
    expect(全量).toHaveLength(7); // 库内全部存活名部（默认=全返语义）
    const req = mingrenMatchRequestSchema.parse({
      姓氏: '林',
      性别: '男',
      喜用神: ['火', '水', '木', '金'],
      上限: 1,
    });
    expect(名列表(matchMingren(库, req))).toEqual(全量.slice(0, 1));
  });
});

describe('mingrenMatchRequestSchema', () => {
  const ok = { 姓氏: '林', 性别: '男' as const, 喜用神: ['木'] };

  it('默认值：名字形式=双名、忌神=[]、上限=200（v3 §4.2）', () => {
    const r = mingrenMatchRequestSchema.parse(ok);
    expect(r.名字形式).toBe('双名');
    expect(r.忌神).toEqual([]);
    expect(r.上限).toBe(200);
  });

  it('refine：忌神与喜用神相犯 → 拒绝', () => {
    const r = mingrenMatchRequestSchema.safeParse({ ...ok, 喜用神: ['木', '火'], 忌神: ['火'] });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(['忌神']);
  });

  it('refine：喜用神重复五行 → 拒绝', () => {
    expect(mingrenMatchRequestSchema.safeParse({ ...ok, 喜用神: ['木', '木'] }).success).toBe(false);
  });

  it('边界：姓氏含非汉字 / 上限 0、501、小数 / 排除已选 3 字 / 喜用神空 → 均拒绝；上限 500（v3 新界）通过', () => {
    expect(mingrenMatchRequestSchema.safeParse({ ...ok, 姓氏: '林a' }).success).toBe(false);
    expect(mingrenMatchRequestSchema.safeParse({ ...ok, 上限: 0 }).success).toBe(false);
    expect(mingrenMatchRequestSchema.safeParse({ ...ok, 上限: 501 }).success).toBe(false);
    expect(mingrenMatchRequestSchema.safeParse({ ...ok, 上限: 500 }).success).toBe(true);
    expect(mingrenMatchRequestSchema.safeParse({ ...ok, 上限: 1.5 }).success).toBe(false);
    expect(mingrenMatchRequestSchema.safeParse({ ...ok, 排除已选: ['张三丰'] }).success).toBe(false);
    expect(mingrenMatchRequestSchema.safeParse({ ...ok, 喜用神: [] }).success).toBe(false);
  });

  it('合法全集解析通过（含明细/避讳/禁用/排除/v3 上限 500）', () => {
    const r = mingrenMatchRequestSchema.safeParse({
      姓氏: '欧阳',
      性别: '女',
      名字形式: '单名',
      喜用神: ['木', '火'],
      忌神: ['金'],
      喜用神明细: [{ 五行: '火', 十神关系: '比劫', 角色: '次用' }],
      避讳字: ['德'],
      禁用字: ['彰'],
      排除已选: ['德彰', '昌黎'],
      上限: 500,
    });
    expect(r.success).toBe(true);
  });
});
