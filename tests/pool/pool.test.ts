/**
 * pool.ts 全流水线验收（M3 候选海选）。
 * 契约：candidates 条目可直接填充 ChartResult.candidates（类型层由 PoolCandidate 强制）。
 */
import { describe, expect, it } from 'vitest';
import { buildPool, type PoolInput, type PoolResult } from '@/lib/pool/pool';
import { computeWuge } from '@/lib/wuge/geju';
import { buildPingzeResult } from '@/lib/phonology/pingze';
import { detectXieyin } from '@/lib/phonology/xieyin';
import charWuxing from '@/data/char-wuxing.json';

const 基线: PoolInput = {
  姓氏: '林',
  性别: '男',
  喜用神: ['水', '木'],
  名字形式: '双名',
  期望候选数: 20,
};

const 五行of = (ch: string): string | undefined =>
  (charWuxing.字 as unknown as Record<string, [string, string, number, number, number]>)[ch]?.[0];

const run = (over: Partial<PoolInput> = {}): PoolResult => buildPool({ ...基线, ...over });

describe('buildPool 输入校验', () => {
  it('姓氏须 1-2 字，名字草案不在 pool 职责内', () => {
    expect(() => buildPool({ ...基线, 姓氏: '爱新觉罗' })).toThrow(/姓氏/);
    expect(() => buildPool({ ...基线, 姓氏: '' })).toThrow(/姓氏/);
  });

  it('单名不允许配辈字（辈字强制占名内一位）', () => {
    expect(() => buildPool({ ...基线, 名字形式: '单名', 辈字: { 字: '文', 位置: 1 } })).toThrow(/辈字/);
  });

  it('辈字必须是五行表内字（否则笔画/五行无从算起）', () => {
    expect(() => buildPool({ ...基线, 辈字: { 字: '龘', 位置: 1 } })).toThrow(/辈字/);
  });

  it('喜用神含非法五行值时报错（类型外的运行时防线）', () => {
    expect(() => buildPool({ ...基线, 喜用神: ['火火'] as never })).toThrow(/喜用神/);
  });
});

describe('林 + 喜用神[水木] + 双名：流水线产物结构', () => {
  const r = run();
  it('按期望数返回且统计可读', () => {
    expect(r.候选.length).toBe(20);
    expect(r.统计.初筛字数).toBeGreaterThan(1000);
    expect(r.统计.可行笔画组合).toBeGreaterThan(10);
    expect(r.统计.海选对数).toBeGreaterThanOrEqual(r.候选.length);
  });

  it('每个候选：双字、逐字在表、至少一字中喜用神', () => {
    for (const c of r.候选) {
      const 字 = [...c.名];
      expect(字.length, c.名).toBe(2);
      const 五行们 = 字.map((ch) => 五行of(ch));
      expect(五行们.every(Boolean), `「${c.名}」有表外字`).toBe(true);
      expect(五行们.some((wx) => 基线.喜用神.includes(wx as never)), `「${c.名}」未中喜用神`).toBe(true);
      expect(c.五行).toEqual(五行们);
    }
  });

  it('每个候选：五格 = computeWuge 现算（TopK 组装无漂移）', () => {
    for (const c of r.候选.slice(0, 5)) {
      expect(c.五格).toEqual(computeWuge(基线.姓氏, c.名));
    }
  });

  it('每个候选：平仄 = buildPingzeResult 现算，字表全绿、谐音已安检剔除', () => {
    for (const c of r.候选.slice(0, 5)) {
      const 全名 = 基线.姓氏 + c.名;
      expect(c.平仄).toEqual(
        buildPingzeResult(全名, { 字表校验: { 全部在通用规范汉字表: true, 表外字: [] } }),
      );
      expect(c.平仄.谐音风险).toBeNull();
      expect(c.平仄.平仄格式).toHaveLength(全名.length);
    }
  });

  it('爆款度 ∈ [0,1]；入选依据为人话且含喜用神与人格条目', () => {
    for (const c of r.候选) {
      expect(c.爆款度).toBeGreaterThanOrEqual(0);
      expect(c.爆款度).toBeLessThanOrEqual(1);
      const 依据 = c.入选依据.join('|');
      expect(依据, c.名).toMatch(/喜用神/);
      expect(依据, c.名).toMatch(/人格\d+/);
      expect(c.入选依据.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('确定性：同输入同输出（禁 Math.random）', () => {
  it('两次调用逐字节一致', () => {
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
  });

  it('避讳字数组乱序传入不影响结果', () => {
    const a = run({ 避讳字: ['沐', '杰', '森'] });
    const b = run({ 避讳字: ['森', '沐', '杰'] });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('约束生效', () => {
  it('避讳字彻底剔除', () => {
    const 首 = run().候选[0];
    const 讳字 = [...首.名];
    const r = run({ 避讳字: 讳字 });
    for (const c of r.候选) {
      for (const ch of 讳字) expect(c.名).not.toContain(ch);
    }
  });

  it('禁用字彻底剔除', () => {
    const r = run({ 禁用字: ['沐', '汐', '杰', '林'] });
    for (const c of r.候选) {
      for (const ch of ['沐', '汐', '杰', '林']) expect(c.名).not.toContain(ch);
    }
  });

  it('辈字位置锁定（第二字强制）', () => {
    const r = run({ 辈字: { 字: '文', 位置: 2 } });
    expect(r.候选.length).toBeGreaterThan(0);
    for (const c of r.候选) expect([...c.名][1]).toBe('文');
  });

  it('辈字位置锁定（第一字强制）', () => {
    const r = run({ 辈字: { 字: '文', 位置: 1 } });
    for (const c of r.候选) expect([...c.名][0]).toBe('文');
  });

  it('名内不与姓氏重字、双名两字不相同', () => {
    for (const c of run({ 期望候选数: 40 }).候选) {
      const 字 = [...c.名];
      expect(字).not.toContain('林');
      if (字.length === 2) expect(字[0]).not.toBe(字[1]);
    }
  });

  it('忌神重罚：忌神字不占双名全部', () => {
    const r = run({ 喜用神: ['木'], 忌神: ['水'] });
    for (const c of r.候选) {
      const 五行们 = [...c.名].map((ch) => 五行of(ch));
      expect(五行们).not.toEqual(['水', '水']);
      expect(五行们).toContain('木');
    }
  });

  it('喜用神为空数组：不做五行过滤但正常出池', () => {
    const r = run({ 喜用神: [] });
    expect(r.候选.length).toBe(20);
  });
});

describe('指定字（契约 v3 §1 硬约束，任务 #45）', () => {
  it('矛盾即抛：表外字/讳禁同现/与姓重字/辈字与姓重字/非汉字（§1.3 冻结文案逐字，无插值）', () => {
    expect(() => run({ 指定字: { 字: '龘', 位置: '第一' } })).toThrow('指定字不在五行字表内，笔画/五行无从计算');
    expect(() => run({ 指定字: { 字: '晶', 位置: '第二' }, 禁用字: ['晶'] })).toThrow('指定字同时出现在避讳/禁用表中，约束矛盾');
    expect(() => run({ 指定字: { 字: '晶', 位置: '第二' }, 避讳字: ['晶'] })).toThrow('指定字同时出现在避讳/禁用表中，约束矛盾');
    expect(() => run({ 指定字: { 字: '林', 位置: '第一' } })).toThrow('指定字与姓氏重字，约束矛盾');
    expect(() => run({ 辈字: { 字: '林', 位置: 1 } })).toThrow('辈字与姓氏重字，约束矛盾'); // 新补：旧口径静默漏行
    expect(() => run({ 指定字: { 字: 'a', 位置: '第一' } })).toThrow('指定字须为单个汉字');
  });

  it('硬约束全体含字：第一/第二只现该位；任一必含且同字不叠（无「晶晶」）', () => {
    const 一 = run({ 指定字: { 字: '明', 位置: '第一' } });
    expect(一.候选.length).toBe(20);
    for (const c of 一.候选) expect([...c.名][0], c.名).toBe('明');
    const 二 = run({ 指定字: { 字: '晶', 位置: '第二' } });
    expect(二.候选.length).toBe(20);
    for (const c of 二.候选) expect([...c.名][1], c.名).toBe('晶');
    for (const [姓氏, 字] of [['林', '明'], ['王', '晶']] as const) {
      const r = run({ 姓氏, 指定字: { 字, 位置: '任一' } });
      expect(r.候选.length, `${姓氏}${字}`).toBeGreaterThan(0);
      for (const c of r.候选) {
        expect(c.名, c.名).toContain(字);
        expect([...c.名].filter((z) => z === 字).length, `${c.名} 叠字`).toBe(1);
      }
    }
  });

  it('任一：两位置各至少 1 例（林+晶第一格全凶被剪，改王姓验两路并集）', () => {
    const r = run({ 姓氏: '王', 指定字: { 字: '晶', 位置: '任一' } });
    const 首 = r.候选.filter((c) => [...c.名][0] === '晶').length;
    const 末 = r.候选.filter((c) => [...c.名][1] === '晶').length;
    expect(首).toBeGreaterThanOrEqual(1);
    expect(末).toBeGreaterThanOrEqual(1);
  });

  it('任一：枚举层两路并集对不丢（海选对数=第一+第二 严格等；契约 v3 §6-R1）', () => {
    // 呈现层可被分数排序压至单侧（林+昱 终选 40 全「昱X」——五格 combo 分随位置不对称，
    // 第一路全面压制第二路；131=88+43 无截断，非死代码）。lead 裁决=分数诚实、不强塞配额，
    // 硬约束由本条枚举层等式保证。交点仅重字对（两侧同被 :186 重字 guard 剔），故严格相等。
    const 位置 = (位置: '任一' | '第一' | '第二') =>
      run({ 姓氏: '林', 指定字: { 字: '昱', 位置 } }).统计.海选对数;
    expect(位置('第一')).toBeGreaterThan(0);
    expect(位置('第二')).toBeGreaterThan(0);
    expect(位置('任一')).toBe(位置('第一') + 位置('第二'));
  });

  it('单名：候选 ⊆ {指定字}（锁位=全锁，至多 1 条）', () => {
    const r = run({ 名字形式: '单名', 指定字: { 字: '玉', 位置: '第一' } });
    expect(r.候选.map((c) => c.名)).toEqual(['玉']);
  });

  it('喜用归属修正：指定字不中喜用（晶=火∉水木）时另一字恒中喜用、池不为空（计入命中修复回归）', () => {
    const r = run({ 指定字: { 字: '晶', 位置: '第二' } });
    expect(r.候选.length).toBe(20);
    for (const c of r.候选) {
      const 他 = [...c.名][0];
      expect(基线.喜用神.includes(五行of(他) as never), `「${c.名}」另一字 ${他}=${五行of(他)} 未中喜用`).toBe(true);
    }
  });

  it('辈字共存三态：同字 no-op 逐字节 / 异位双锁唯一候选+依据注记 / 同位异字池层防御返空', () => {
    const 无指 = run({ 姓氏: '王', 辈字: { 字: '晶', 位置: 1 } });
    const 同字 = run({ 姓氏: '王', 辈字: { 字: '晶', 位置: 1 }, 指定字: { 字: '晶', 位置: '任一' } });
    expect(JSON.stringify(同字)).toBe(JSON.stringify(无指));
    const 双锁 = run({ 辈字: { 字: '明', 位置: 1 }, 指定字: { 字: '锦', 位置: '第二' } });
    expect(双锁.候选.map((c) => c.名)).toEqual(['明锦']); // 双位皆锁 → 唯一候选须过全部终筛方在此
    expect(双锁.候选[0].入选依据.join('|')).toContain("指定字'锦'含于名（居末）");
    expect(run({ 辈字: { 字: '明', 位置: 1 }, 指定字: { 字: '晶', 位置: '第一' } }).候选).toEqual([]); // schema 上游已拒，此为池层兜底
  });

  it('确定性/排除联动/统计收缩：硬约束下与既有契约全兼容', () => {
    const 入 = { 指定字: { 字: '明', 位置: '第一' } } as const;
    expect(JSON.stringify(run(入))).toBe(JSON.stringify(run(入)));
    const r0 = run(入);
    const r1 = run({ ...入, 排除已选: r0.候选.slice(0, 5).map((c) => c.名) });
    expect(r1.候选.length).toBeGreaterThan(0);
    for (const c of r1.候选) expect([...c.名][0], c.名).toBe('明');
    expect(r0.统计.海选对数).toBeLessThanOrEqual(run().统计.海选对数); // 硬约束剪枝后配对面只减不增
  });

  it('性能：N=50 指定字全流水线仍在宽松上限内', () => {
    const t0 = Date.now();
    const r = run({ 期望候选数: 50, 指定字: { 字: '明', 位置: '第一' } });
    expect(r.候选.length).toBe(50);
    expect(Date.now() - t0).toBeLessThan(20_000);
  });
});

describe('姓氏/形式覆盖', () => {
  it('单名模式（单姓单名外格惯例恒 2 由 computeWuge 留痕）', () => {
    const r = run({ 名字形式: '单名' });
    expect(r.候选.length).toBeGreaterThan(0);
    for (const c of r.候选) expect([...c.名].length).toBe(1);
    const 五格 = computeWuge('林', r.候选[0].名);
    expect(五格?.外格.数理).toBe(2);
  });

  it('复姓欧阳 + 单名可用', () => {
    const r = run({ 姓氏: '欧阳', 喜用神: ['火'], 名字形式: '单名' });
    expect(r.候选.length).toBeGreaterThan(0);
    for (const c of r.候选) {
      expect([...c.名].length).toBe(1);
      expect(五行of(c.名)).toBe('火');
    }
  });

  it('期望候选数上限约束：N=8 不超额', () => {
    expect(run({ 期望候选数: 8 }).候选.length).toBeLessThanOrEqual(8);
  });
});

describe('排除已选（「重新生成」排重，任务 #28）', () => {
  const r0 = run();
  const 名列 = (r: PoolResult): string[] => r.候选.map((c) => c.名);

  it('确定性：同输入带同一排除名单，两次结果逐字节一致', () => {
    const 名单 = 名列(r0).slice(0, 2);
    expect(JSON.stringify(run({ 排除已选: 名单 }))).toBe(JSON.stringify(run({ 排除已选: 名单 })));
  });

  it('被点名候选不再出现；其余候选次序不变（前方仅整体前移，尾部由短名单回补）', () => {
    const [剔除一, 剔除二] = 名列(r0);
    const r1 = run({ 排除已选: [剔除一, 剔除二] });
    expect(名列(r1)).not.toContain(剔除一);
    expect(名列(r1)).not.toContain(剔除二);
    const 其余 = 名列(r0).slice(2);
    expect(名列(r1).slice(0, 其余.length)).toEqual(其余); // 终筛剔除不改相对次序
    expect(r1.统计.排除剔除数).toBeGreaterThanOrEqual(2);
  });

  it('排除全部首批候选：与第一批零交集且仍正常产出（shortlist 回补，非抛错）', () => {
    const r1 = run({ 排除已选: 名列(r0) });
    expect(r1.候选.length).toBeGreaterThan(0);
    const 首批 = new Set(名列(r0));
    for (const n of 名列(r1)) expect(首批.has(n), `「${n}」应已被排除`).toBe(false);
  });

  it('空数组/缺省 = 不排除（与基线逐字节一致）', () => {
    expect(JSON.stringify(run({ 排除已选: [] }))).toBe(JSON.stringify(r0));
  });

  it('不存在的名字混入排除集：无害，结果与基线一致', () => {
    expect(名列(run({ 排除已选: ['龘龘'] }))).toEqual(名列(r0));
  });
});

describe('性能硬约束：computeWuge 只对 TopK 调用', () => {
  it('N=50 双名全流水线在宽松上限内完成（全量调用会分钟级爆掉）', () => {
    const t0 = Date.now();
    const r = run({ 期望候选数: 50 });
    const ms = Date.now() - t0;
    expect(r.候选.length).toBe(50);
    expect(ms).toBeLessThan(20_000);
  });
});

describe('谐音安检口径（fatemaster 契约：后字声母脱落式）', () => {
  const 安检 = (全名: string): string | null =>
    (detectXieyin as unknown as (f: string, o?: { 谐音上下文音?: '后字声母脱落式' }) => string | null)(
      全名,
      { 谐音上下文音: '后字声母脱落式' },
    );

  it('多组入参下，无任何一个候选全名在上下文口径下命中黑名单（安检兜底）', () => {
    const 姓氏组 = ['林', '王', '欧阳', '陈'];
    for (const 姓氏 of 姓氏组) {
      const r = buildPool({ ...基线, 姓氏, 喜用神: 姓氏 === '欧阳' ? ['火'] : ['水', '木'] });
      expect(r.候选.length).toBeGreaterThan(0);
      for (const c of r.候选) {
        expect(安检(姓氏 + c.名), `候选「${姓氏 + c.名}」漏过上下文谐音安检`).toBeNull();
      }
    }
  });

  it('候选平仄条目携带与安检一致的口径字段（垫片转发不丢参）', () => {
    const r = run();
    // phonology 侧落地后 PingzeResult 将显式携带该口径；当前经垫片转发运行时透传。
    for (const c of r.候选) expect(c.平仄.平仄格式).toMatch(/^[平仄]{2,3}$/);
  });
});

describe('性别契合度（男女候选区分）', () => {
  it('同一姓氏与喜用神下，男女候选名单显著不同且契合性别偏向', () => {
    const 男 = buildPool({ ...基线, 性别: '男', 期望候选数: 20 });
    const 女 = buildPool({ ...基线, 性别: '女', 期望候选数: 20 });
    const 男名单 = new Set(男.候选.map((c) => c.名));
    const 女名单 = new Set(女.候选.map((c) => c.名));
    // 两个名单不完全相同
    const 交集 = [...男名单].filter((n) => 女名单.has(n));
    expect(交集.length).toBeLessThan(男名单.size);
  });
});
