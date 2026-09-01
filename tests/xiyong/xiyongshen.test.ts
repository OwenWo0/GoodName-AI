/**
 * 喜用神裁决链验收测试（喜用神算法修复 P0）：
 * F 板（F1~F4）逐盘钉死 + 裁定树 ①~④ 分支直测 + 回归护栏（非冲突锚点喜用五行集合不变）。
 * 旧版缺陷复现钉：旧合成把整个调候入喜/整个扶抑入忌——F3 盘旧版会把「水」抬进喜用，
 * 新口径 T-only 并集后 水∈忌 钉死；F4 盘旧断言（冲突口径）按新裁决重钉。
 */
import { describe, expect, it } from 'vitest';
import { computeXiyongshen, 裁定, 调候可见 } from '@/lib/xiyong/xiyongshen';
import { 构造八字, 缺时柱, 锚点 } from './fixtures';
import type { WuXing } from '@/lib/types';

const 角色表 = (明细: { 五行: string; 角色: string }[]): Record<string, string> =>
  Object.fromEntries(明细.map((d) => [d.五行, d.角色]));

describe('F1 真从财：格局胜出，调候不得劫持', () => {
  const x = computeXiyongshen(锚点['F1从财']());
  it('喜[木火] 忌[金水]（从财钉表映射）', () => {
    expect(x.喜用神).toEqual(['木', '火']);
    expect(x.忌神).toEqual(['金', '水']);
  });
  it('从午盘调候[水金]被压制：喜用不含金水，冲突 false', () => {
    expect(x.调候.五行).toEqual(['水', '金']); // 数据本身仍在（展示层双轨）
    expect(x.喜用神).not.toContain('水');
    expect(x.喜用神).not.toContain('金');
    expect(x.冲突).toBe(false);
  });
  it('格局徽标真从财 + 明细角色=主用（食伤/财星）', () => {
    expect(x.格局).toEqual({ 名称: '从财格', 真伪: '真', 依据: expect.any(Array) });
    expect(角色表(x.喜用神明细!)).toEqual({ 木: '主用', 火: '主用' });
    expect(x.喜用神明细!.find((d) => d.五行 === '木')!.十神关系).toBe('食伤');
  });
  it('旺衰分照常展示（−45 偏弱，恰压偏弱下限），不因从格改写', () => {
    expect(x.强弱得分).toBeCloseTo(-45, 10);
    expect(x.强弱等级).toBe('偏弱');
  });
});

describe('F2 专旺曲直：喜⊇{水木火} 忌=[金]，财土中性', () => {
  const x = computeXiyongshen(锚点['F2曲直']());
  it('喜[木火水] 忌[金]，土不入喜不入忌', () => {
    expect(x.喜用神).toEqual(['木', '火', '水']);
    expect(x.忌神).toEqual(['金']);
    expect(x.喜用神).not.toContain('土');
    expect(x.忌神).not.toContain('土');
  });
  it('专旺格·曲直 + 财星中性争议标注', () => {
    expect(x.格局!.名称).toBe('专旺格·曲直');
    expect(x.格局!.真伪).toBe('真');
    expect((x.争议标注 ?? []).join('')).toContain('财星');
  });
});

describe('F3 阈值定钉盘：21.25 偏强，水∈忌（旧缺陷判别钉）', () => {
  const x = computeXiyongshen(锚点['F3盘']());
  it('档 ∈ {偏强,身强}（净分 21.25，任务书草案线 25 被实算否决的钉据）', () => {
    expect(x.强弱得分).toBeCloseTo(21.25, 10);
    expect(['偏强', '身强']).toContain(x.强弱等级);
  });
  it('忌=[木水]——调候[火水]之水不得随调候入喜（T-only 并集 vs 旧版整轨入喜）', () => {
    expect(x.忌神).toEqual(['木', '水']);
    expect(x.喜用神).not.toContain('水');
  });
  it('喜 ⊇ {土金} 且 ⊆ [火土金] → 恰 [火土金]，全主用', () => {
    expect(x.喜用神).toEqual(['火', '土', '金']);
    expect(角色表(x.喜用神明细!)).toEqual({ 火: '主用', 土: '主用', 金: '主用' });
    expect(x.冲突).toBe(false);
  });
});

describe('F4（壬午 辛丑 壬午 甲辰）：无交集不急 → 冲突盘重钉', () => {
  const x = computeXiyongshen(锚点['冬水冲突']());
  it('−18 偏弱；喜[金水]+火次用；忌[木土]（本忌−{T}）', () => {
    expect(x.强弱得分).toBeCloseTo(-18, 10);
    expect(x.强弱等级).toBe('偏弱');
    expect(x.喜用神).toEqual(['火', '金', '水']); // sortWx 规范化（火1金3水4）
    expect(x.忌神).toEqual(['木', '土']);
  });
  it('角色：金水主用（扶抑），火次用（调候主药 T 已见干支不急）', () => {
    expect(角色表(x.喜用神明细!)).toEqual({ 金: '主用', 水: '主用', 火: '次用' });
  });
  it('冲突 true + 全文说明含无交集与丑月可见口径', () => {
    expect(x.冲突).toBe(true);
    expect(x.冲突说明).toContain('两无交集');
    expect(x.冲突说明).toContain('已见于干支');
  });
});

describe('假从与破格/降级路径（computeXiyongshen 级）', () => {
  it('假从财盘：按正格身弱扶抑取用[金水]，格局徽标留痕（假，按正格论）', () => {
    const x = computeXiyongshen(锚点['假从财']());
    expect(x.喜用神).toEqual(['金', '水']);
    expect(x.忌神).toEqual(['木', '火', '土']);
    expect(x.格局!.名称).toBe('从财格');
    expect(x.格局!.真伪).toBe('假');
    expect((x.争议标注 ?? []).join('')).toContain('假从');
  });

  it('破格曲直：静默回正格——无格局字段，偏强克泄耗取用[火土金]', () => {
    const x = computeXiyongshen(锚点['破格曲直']());
    expect(x.格局).toBeUndefined();
    expect(x.强弱等级).toBe('身强');
    expect(x.喜用神).toEqual(['火', '土', '金']);
    expect(x.忌神).toEqual(['木', '水']);
  });

  it('真从盘时辰未知：降假从 → 正格身弱[金水]，冲突 false', () => {
    const b = 锚点['F1从财']();
    const x = computeXiyongshen({ ...b, 四柱: 缺时柱(b.四柱) });
    expect(x.格局!.真伪).toBe('假');
    expect(x.喜用神).toEqual(['金', '水']);
    expect(x.冲突).toBe(false);
  });

  it('纯水：润下胜出——喜[木金水]忌[土]（旧正格口径[木火土]作废，调候[土火]亦被格局压制）', () => {
    const x = computeXiyongshen(锚点['纯水身强']());
    expect(x.格局!.名称).toBe('专旺格·润下');
    expect(x.喜用神).toEqual(['木', '金', '水']); // 食伤木+印金+比劫水，sortWx 序
    expect(x.忌神).toEqual(['土']);
    expect(x.冲突).toBe(false);
  });
});

describe('裁定树分支直测（合成输入，不经 BaziResult）', () => {
  it('① 中和：专以调候定喜用，忌=克喜者，角色=调候', () => {
    const r = 裁定({
      等级: '中和', 扶抑五行: [], 本忌: [], 调候五行: ['火', '木'],
      月支: '卯', 调候主可见: true, 时辰未知: false, 日主五行: '木',
    });
    expect(r.喜用神).toEqual(['木', '火']); // sortWx 规范化（木火土金水序）
    expect(r.忌神).toEqual(['金', '水']); // 金克木、水克火——克喜者入忌，护住调候药
    expect(角色表(r.明细)).toEqual({ 木: '调候', 火: '调候' });
    expect(r.冲突).toBe(false);
  });

  it('③ 急（子月火药不见）：喜=全调候，克T入忌；身弱印比不转忌降次用+争议', () => {
    const r = 裁定({
      等级: '偏弱', 扶抑五行: ['水', '木'], 本忌: ['火', '土', '金'], 调候五行: ['火'],
      月支: '子', 调候主可见: false, 时辰未知: false, 日主五行: '木',
    });
    expect(r.喜用神).toEqual(['火', '水']); // 全调候火 + 印水摘回次用（sortWx：火1水4）
    expect(r.忌神).toEqual(['土', '金']); // 克T(水)并入后又因印比不转忌摘回
    expect(角色表(r.明细)).toEqual({ 火: '调候', 水: '次用' });
    expect(r.冲突).toBe(true);
    expect(r.冲突说明).toContain('气候为急');
    expect(r.争议标注.join('')).toContain('印比（水）不转忌');
  });

  it('③急盘时辰未知 → 降不急走④ + 降级留痕', () => {
    const r = 裁定({
      等级: '偏弱', 扶抑五行: ['水', '木'], 本忌: ['火', '土', '金'], 调候五行: ['火'],
      月支: '子', 调候主可见: false, 时辰未知: true, 日主五行: '木',
    });
    expect(r.喜用神).toEqual(['木', '火', '水']); // ④：扶抑∪{T}（sortWx 规范化）
    expect(r.忌神).toEqual(['土', '金']); // 本忌−{T}
    expect(r.争议标注.join('')).toContain('按不急处理');
  });

  it('② 有交集：T∈扶抑时不产生次用条目（T-only 并集防整轨入喜）', () => {
    const r = 裁定({
      等级: '偏强', 扶抑五行: ['火', '土', '金'], 本忌: ['木', '水'], 调候五行: ['火', '水'],
      月支: '寅', 调候主可见: true, 时辰未知: false, 日主五行: '木',
    });
    expect(r.喜用神).toEqual(['火', '土', '金']);
    expect(r.忌神).toEqual(['木', '水']);
    expect(角色表(r.明细)).toEqual({ 火: '主用', 土: '主用', 金: '主用' });
    expect(r.冲突).toBe(false);
  });
});

describe('回归护栏：非格局非冲突锚点喜用五行集合不变（净分制只动分值/档位）', () => {
  it.each([
    ['冬木', ['火', '土', '金'], ['木', '水']],
    ['夏火', ['土', '金', '水'], ['木', '火']],
    ['弱水身弱', ['金', '水'], ['木', '火', '土']],
  ] as const)('%s：喜%o 忌%o（旧期望集合透传）', (名, 喜, 忌) => {
    const x = computeXiyongshen(锚点[名]());
    expect(x.喜用神).toEqual(喜);
    expect(x.忌神).toEqual(忌);
    expect(x.冲突).toBe(false);
  });

  it('中和木：分值/档位迁移（54中和→48.25偏强，档位线重钉冲突方），喜忌集随扶抑轨 = [火土金]/[木水]', () => {
    const x = computeXiyongshen(锚点['中和木']());
    expect(x.强弱得分).toBeCloseTo(48.25, 10);
    expect(x.强弱等级).toBe('偏强');
    expect(x.喜用神).toEqual(['火', '土', '金']);
    expect(x.忌神).toEqual(['木', '水']);
  });
});

describe('评审一轮：真实盘钉（M3 中和真空 / M2 ③急盘）与调候可见钉', () => {
  it('M3 壬午 辛丑 壬午 壬辰：−5 中和走①，忌=克喜者[金水]，无格局（丑中癸根不从、午藏己破润下）', () => {
    const x = computeXiyongshen(锚点.M3真空());
    expect(x.强弱得分).toBeCloseTo(-5, 10);
    expect(x.强弱等级).toBe('中和');
    expect(x.格局).toBeUndefined();
    expect(x.扶抑.五行).toEqual([]); // 中和 → 扶抑无偏，策略口径为「专以调候定喜用」
    expect(x.喜用神).toEqual(['木', '火']);
    expect(x.忌神).toEqual(['金', '水']); // ①忌=克喜者：金克木、水克火
    expect(角色表(x.喜用神明细!)).toEqual({ 木: '调候', 火: '调候' });
    expect(x.冲突).toBe(false);
  });

  it('M2 真盘 戊戌 庚丑 壬卯 庚辰：丑月急+火药不可见 → ③，−19 偏弱，印比水摘回次用', () => {
    const x = computeXiyongshen(锚点.急盘真());
    expect(x.强弱得分).toBeCloseTo(-19, 10);
    expect(x.强弱等级).toBe('偏弱');
    expect(x.喜用神).toEqual(['木', '火', '水']); // 全调候[火木] + 印比水摘回
    expect(x.忌神).toEqual(['土']); // (水克火并入忌) − 喜 − 印比摘回 = [土]
    expect(角色表(x.喜用神明细!)).toEqual({ 木: '调候', 火: '调候', 水: '次用' });
    expect(x.冲突).toBe(true);
    expect(x.冲突说明).toContain('不见于干支'); // 可见=false 经 computeXiyongshen 到达 ③ 的实证
    expect(x.争议标注).toEqual(['身弱调候急盘：印比（水）不转忌降次用（流派折中留痕）']);
  });

  it('调候可见钉：T 仅现于日干 → 不可见；同字现于它干/支藏本气 → 可见（日干不算药，申报见 xiyongshen.ts 头注②）', () => {
    // 戊戌 甲寅 壬午 庚戌：全盘水仅日干壬（日主自身不为药）；干戊甲庚、支本中气戊辛/甲丙/丁己/戊辛皆无水
    const 仅日干盘 = 构造八字(
      [
        ['戊', '戌'],
        ['甲', '寅'],
        ['壬', '午'],
        ['庚', '戌'],
      ],
      '壬'
    );
    expect(调候可见('水', 仅日干盘)).toBe(false);
    const 时干透壬盘 = 构造八字(
      [
        ['戊', '戌'],
        ['甲', '寅'],
        ['壬', '午'],
        ['癸', '戌'],
      ],
      '壬'
    );
    expect(调候可见('水', 时干透壬盘)).toBe(true);
    expect(调候可见('火', 锚点.M3真空())).toBe(true); // 午本气丁——支藏本气通道
  });

  it('② T∉扶抑但交集由他元素成立（金）：T 入喜记次用（既有②钉为 T∈扶抑形，此补 T∉扶抑形）', () => {
    const r = 裁定({
      等级: '偏弱', 扶抑五行: ['金', '水'], 本忌: ['木', '火', '土'], 调候五行: ['火', '金'],
      月支: '丑', 调候主可见: true, 时辰未知: false, 日主五行: '水',
    });
    expect(r.喜用神).toEqual(['火', '金', '水']); // 扶抑∪{T火}，sortWx 序
    expect(r.忌神).toEqual(['木', '土']); // 本忌−喜（金已入喜出忌）
    expect(角色表(r.明细)).toEqual({ 金: '主用', 水: '主用', 火: '次用' });
    expect(r.冲突).toBe(false);
  });
});

describe('不可变性与输出规范化', () => {
  it('computeXiyongshen 不修改入参八字', () => {
    const b = 构造八字(
      [
        ['甲', '子'],
        ['丙', '子'],
        ['甲', '子'],
        ['丙', '寅'],
      ],
      '甲'
    );
    const 前 = JSON.stringify(b);
    computeXiyongshen(b);
    expect(JSON.stringify(b)).toBe(前);
  });

  it('喜用神/忌神按木火土金水序且互斥', () => {
    for (const 名 of ['冬木', '夏火', 'F1从财', 'F2曲直', 'F3盘', '冬水冲突', '纯水身强'] as const) {
      const x = computeXiyongshen(锚点[名]());
      const 序: WuXing[] = ['木', '火', '土', '金', '水'];
      expect(x.喜用神).toEqual([...x.喜用神].sort((a, b) => 序.indexOf(a) - 序.indexOf(b)));
      expect(x.喜用神.filter((w) => x.忌神.includes(w))).toEqual([]);
    }
  });
});
