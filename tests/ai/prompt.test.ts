/**
 * prompt.ts 测试：System 关键约束齐全、user 为稳定 JSON 且 round-trip 等值。
 */
import { describe, it, expect } from 'vitest';
import { buildMessages, stableStringify, SYSTEM_PROMPT, DISCLAIMER_TEXT } from '@/lib/ai/prompt';
import type { EvaluatedName } from '@/lib/evaluate/types';
import { fixtureChart, shuffledCopy } from './fixtures';

describe('buildMessages', () => {
  const messages = buildMessages(fixtureChart);

  it('返回 system + user 两条消息，顺序与角色正确', () => {
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('system');
    expect(messages[1].role).toBe('user');
  });

  it('System 钉死「只解读不改算排盘数字」约束', () => {
    expect(SYSTEM_PROMPT).toContain('严禁自行改写、重算');
    expect(SYSTEM_PROMPT).toContain('以 JSON 为准');
  });

  it('System 要求引用来源链字段', () => {
    expect(SYSTEM_PROMPT).toContain('来源链');
    expect(SYSTEM_PROMPT).toContain('入选依据');
  });

  it('System 要求冲突如实转述、不硬调和', () => {
    expect(SYSTEM_PROMPT).toContain('冲突说明');
    expect(SYSTEM_PROMPT).toContain('不得强行调和');
  });

  it('System 禁止发明新名字（v4 §1.3 第5条冻结措辞：点评限 candidates 与 意向评估）', () => {
    expect(SYSTEM_PROMPT).toContain('严禁在点评中发明');
    expect(SYSTEM_PROMPT).toContain('candidates');
  });

  it('System 末尾固定免责且用「民俗文化参考」基调', () => {
    expect(SYSTEM_PROMPT).toContain('民俗文化参考');
    expect(SYSTEM_PROMPT).not.toContain('仅供娱乐');
    expect(messages[0].content.trimEnd().endsWith(DISCLAIMER_TEXT)).toBe(true);
  });

  it('System 含终推三名格式与补充建议标注，且免责句仍居最末（v4 §1.3）', () => {
    expect(SYSTEM_PROMPT).toContain('终推三名');
    expect(SYSTEM_PROMPT).toContain('## 终推三名');
    expect(SYSTEM_PROMPT).toContain('补充建议（未评估）');
    expect(SYSTEM_PROMPT).toContain('意向吉名');
    expect(SYSTEM_PROMPT).toContain('意向名点评');
    // 格式化条款在免责之前插入 → 免责仍是全文最后一段
    expect(SYSTEM_PROMPT.indexOf('【终推三名格式')).toBeLessThan(SYSTEM_PROMPT.indexOf('【结尾固定免责'));
    expect(messages[0].content.trimEnd().endsWith(DISCLAIMER_TEXT)).toBe(true);
  });

  it('System 要求主动说明不确定性边界', () => {
    expect(SYSTEM_PROMPT).toContain('时辰未知提示');
    expect(SYSTEM_PROMPT).toContain('争议标注');
  });

  it('User 是合法 JSON，round-trip 与排盘深等值', () => {
    const parsed = JSON.parse(messages[1].content);
    expect(parsed).toEqual(fixtureChart);
  });

  it('User 含候选名与喜用神数据（AI 点评的原材料齐备）', () => {
    expect(messages[1].content).toContain('知予');
    expect(messages[1].content).toContain('沐宸');
    expect(messages[1].content).toContain('调候');
  });

  it('同一数据两次构造输出恒等（可缓存）', () => {
    expect(buildMessages(fixtureChart)[1].content).toBe(messages[1].content);
  });

  it('stableStringify 键序无关：插入顺序不同的等值对象输出相同', () => {
    expect(stableStringify(shuffledCopy(fixtureChart))).toBe(stableStringify(fixtureChart));
  });

  it('stableStringify 不变更入参（不可变约定）', () => {
    const before = JSON.stringify(fixtureChart);
    stableStringify(fixtureChart);
    expect(JSON.stringify(fixtureChart)).toBe(before);
  });
});

describe('buildMessages 意向扩展（契约 v4 §1.2）', () => {
  // 深等断言只消费 JSON 结构，不触评估字段语义——最小假评估（fixtures.ts 只读，不外扩）
  const 假评估 = [
    { 名: '知予', 爆款度: 0.31 },
    { 名: '一诺', 爆款度: 0.55 },
  ] as unknown as readonly EvaluatedName[];

  it('双参且名单非空 → user JSON 追加 意向吉名/意向评估 两键且深等，chart 原样在内', () => {
    const 名单 = ['知予', '一诺'];
    const user = buildMessages(fixtureChart, { 名单, 评估: 假评估 })[1].content;
    const parsed = JSON.parse(user) as Record<string, unknown>;
    expect(parsed.意向吉名).toEqual(名单);
    expect(parsed.意向评估).toEqual(假评估);
    const 其余 = { ...parsed };
    delete 其余.意向吉名;
    delete 其余.意向评估;
    expect(其余).toEqual(fixtureChart);
  });

  it('名单保序（stableStringify 排序只动对象键、不动数组序）', () => {
    const user = buildMessages(fixtureChart, { 名单: ['沐宸', '知予'], 评估: [] })[1].content;
    expect((JSON.parse(user) as { 意向吉名: string[] }).意向吉名).toEqual(['沐宸', '知予']);
  });

  it('空名单 → user 与单参逐字节等（评估一并忽略）', () => {
    const 单参 = buildMessages(fixtureChart)[1].content;
    expect(buildMessages(fixtureChart, { 名单: [], 评估: 假评估 })[1].content).toBe(单参);
  });

  it('意向键存在但名单空 → 与单参逐字节等（向后兼容硬约束）', () => {
    const 单参 = buildMessages(fixtureChart)[1].content;
    expect(buildMessages(fixtureChart, { 名单: [], 评估: [] })[1].content).toBe(单参);
    expect(buildMessages(fixtureChart, undefined)[1].content).toBe(单参);
  });

  it('双参不变更入参 chart（不可变约定）', () => {
    const before = JSON.stringify(fixtureChart);
    buildMessages(fixtureChart, { 名单: ['知予'], 评估: 假评估 });
    expect(JSON.stringify(fixtureChart)).toBe(before);
  });
});
