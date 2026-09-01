/**
 * prompt-names.ts 测试：System 铁律要点、user 消息（稳定 JSON + 输出要求 + 免责注入）、
 * 犯忌/犯讳名单的「必须明说」注入、请求 schema 边界（空评估/超限/四柱非 4 → 拒）。
 */
import { describe, it, expect } from 'vitest';
import {
  NAME_EVAL_SYSTEM_PROMPT,
  buildNameEvalMessages,
  nameEvalRequestSchema,
  type NameEvalInput,
} from '@/lib/ai/prompt-names';
import { DISCLAIMER_TEXT, stableStringify } from '@/lib/ai/prompt';
import type { EvaluatedName } from '@/lib/evaluate/types';
import type { PingzeResult, WuXing } from '@/lib/types';

const 平仄样本: PingzeResult = {
  逐字: [],
  平仄格式: '平仄',
  体系: 'putonghua',
  绕口风险: null,
  谐音风险: null,
  字表校验: { 全部在通用规范汉字表: true, 表外字: [] },
};

function 评估项(名: string, 选项: { 命中忌神?: WuXing[]; 说明?: string[] } = {}): EvaluatedName {
  return {
    名,
    表外字: [],
    五行: ['木', '火'],
    平仄: 平仄样本,
    五格: null,
    爆款度: 0.2,
    契合: {
      命中喜用: ['木'],
      命中次用: [],
      命中忌神: 选项.命中忌神 ?? [],
      档位: 选项.命中忌神?.length ? '下' : '中上',
      分: 10,
      说明: 选项.说明 ?? [],
    },
  };
}

function 输入(评估: EvaluatedName[]): NameEvalInput {
  return {
    命盘摘要: { 四柱: ['甲子', '癸酉', '壬戌', '辛丑'], 日主: '壬', 喜用神: ['木', '火'], 忌神: ['金'] },
    评估,
  };
}

describe('NAME_EVAL_SYSTEM_PROMPT', () => {
  it('钉死直言不谄媚、不编数、民俗口径，且内嵌固定免责', () => {
    expect(NAME_EVAL_SYSTEM_PROMPT).toContain('直言不足、不谄媚');
    expect(NAME_EVAL_SYSTEM_PROMPT).toContain('严禁自行改写、重算');
    expect(NAME_EVAL_SYSTEM_PROMPT).toContain('民俗');
    expect(NAME_EVAL_SYSTEM_PROMPT).toContain(DISCLAIMER_TEXT);
  });
});

describe('buildNameEvalMessages', () => {
  it('消息对 = system + user；user 以稳定 JSON 开头（round-trip 深等值可还原）', () => {
    const input = 输入([评估项('沐宸'), 评估项('知远')]);
    const messages = buildNameEvalMessages(input);
    expect(messages).toHaveLength(2);
    expect(messages[0]).toEqual({ role: 'system', content: NAME_EVAL_SYSTEM_PROMPT });
    expect(messages[1]!.role).toBe('user');
    const 用户内容 = messages[1]!.content;
    expect(用户内容.startsWith(stableStringify(input))).toBe(true);
    // JSON 段 round-trip 与原数据深等值
    const 截到空行 = 用户内容.slice(0, 用户内容.indexOf('\n\n【输出要求】'));
    expect(JSON.parse(截到空行)).toEqual(input);
  });

  it('输出要求含逐名 ### 分节四块与免责注入', () => {
    const 用户内容 = buildNameEvalMessages(输入([评估项('沐宸')]))[1]!.content;
    expect(用户内容).toContain('### 「名」');
    expect(用户内容).toContain('音律平仄');
    expect(用户内容).toContain('五行契合');
    expect(用户内容).toContain('五格数理');
    expect(用户内容).toContain('总评一句');
    expect(用户内容.trimEnd().endsWith(DISCLAIMER_TEXT)).toBe(true);
  });

  it('含犯忌名 → 指令点名该名字并要求明说，不得粉饰', () => {
    const 用户内容 = buildNameEvalMessages(输入([评估项('鑫磊', { 命中忌神: ['金'] }), 评估项('沐宸')]))[1]!.content;
    expect(用户内容).toContain('「鑫磊」');
    expect(用户内容).toContain('犯忌神或犯避讳');
    expect(用户内容).toContain('不得回避粉饰');
    expect(用户内容).not.toContain('「沐宸」'); // 干净名不进点名清单（「」仅出现于分节模板与点名串）
  });

  it('犯避讳名（说明含避讳注记）同样被点名', () => {
    const 用户内容 = buildNameEvalMessages(输入([评估项('梓轩', { 说明: ['含避讳字 轩'] })]))[1]!.content;
    expect(用户内容).toContain('「梓轩」');
    expect(用户内容).toContain('不得回避粉饰');
  });

  it('无犯忌名 → 保留泛化的「必须明说」要求', () => {
    const 用户内容 = buildNameEvalMessages(输入([评估项('沐宸')]))[1]!.content;
    expect(用户内容).toContain('命中忌神或含避讳字的名字，必须在对应分节中明说');
  });

  it('五格 null 的如实说明要求存在（禁编数理）', () => {
    const 用户内容 = buildNameEvalMessages(输入([评估项('沐宸')]))[1]!.content;
    expect(用户内容).toContain('笔画不可得、五格不予评定');
    expect(用户内容).toContain('严禁编造数理');
  });
});

describe('nameEvalRequestSchema', () => {
  it('合法输入通过', () => {
    expect(nameEvalRequestSchema.safeParse(输入([评估项('沐宸')])).success).toBe(true);
  });

  it('评估为空数组 → 拒（空评估 400 的 schema 依据）', () => {
    expect(nameEvalRequestSchema.safeParse(输入([])).success).toBe(false);
  });

  it('评估 101 条 → 拒（EVALUATE_NAMES_MAX=100）', () => {
    const 多 = Array.from({ length: 101 }, (_, i) => 评估项(`名${i}`));
    expect(nameEvalRequestSchema.safeParse(输入(多)).success).toBe(false);
  });

  it('四柱非 4 项 / 缺字段 / 喜用神空 → 拒', () => {
    expect(nameEvalRequestSchema.safeParse({ ...输入([评估项('沐')]), 命盘摘要: { 四柱: ['甲子'], 日主: '壬', 喜用神: ['木'], 忌神: [] } }).success).toBe(false);
    expect(nameEvalRequestSchema.safeParse({ 评估: [] }).success).toBe(false);
    expect(nameEvalRequestSchema.safeParse({ ...输入([评估项('沐')]), 命盘摘要: { 四柱: ['甲', '乙', '丙', '丁'], 日主: '壬', 喜用神: [], 忌神: [] } }).success).toBe(false);
  });
});
