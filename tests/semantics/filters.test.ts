import { describe, expect, it } from 'vitest';
import {
  evaluateSemanticSafety,
  NEGATIVE_CHARS,
  HARD_RISK_NAMES,
  NON_NAME_WORDS,
  CLICHE_NAMES,
} from '@/lib/semantics/filters';

describe('语义安全与去词汇化过滤 (evaluateSemanticSafety)', () => {
  it('正常文化人名评分为高分且安全', () => {
    const r1 = evaluateSemanticSafety('欧阳修', '修');
    expect(r1.score).toBe(30);
    expect(r1.isSafe).toBe(true);
    expect(r1.issues.length).toBe(0);

    const r2 = evaluateSemanticSafety('王文煜', '文煜');
    expect(r2.score).toBe(30);
    expect(r2.isSafe).toBe(true);
  });

  it('命中贬义负面字（NEGATIVE_CHARS）得分为0', () => {
    const r = evaluateSemanticSafety('张病残', '病残');
    expect(r.score).toBe(0);
    expect(r.isSafe).toBe(false);
    expect(r.issues.some((i) => i.includes('贬义负面字'))).toBe(true);
  });

  it('命中明显占位符或风险名（HARD_RISK_NAMES）得分为0', () => {
    const r = evaluateSemanticSafety('赵钱孙', '钱孙');
    expect(r.score).toBe(0);
    expect(r.isSafe).toBe(false);
  });

  it('命中非人名概念/产品词（NON_NAME_WORDS）受到严重降分', () => {
    const r1 = evaluateSemanticSafety('李水泥', '水泥');
    expect(r1.score).toBeLessThanOrEqual(5);
    expect(r1.isSafe).toBe(false);

    const r2 = evaluateSemanticSafety('张发票', '发票');
    expect(r2.score).toBeLessThanOrEqual(5);
  });

  it('俗套名字（CLICHE_NAMES）适度降权', () => {
    const r = evaluateSemanticSafety('李建国', '建国');
    expect(r.isCliche).toBe(true);
    expect(r.score).toBeLessThan(30);
  });
});
