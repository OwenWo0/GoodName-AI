import { describe, expect, it } from 'vitest';
import {
  TONE_SCORE_MAP,
  evaluateToneScore,
  isStyleMatched,
  normalizeStyle,
} from '@/lib/phonetics/tone-matrix';

describe('64 种声调平仄打分矩阵 (TONE_SCORE_MAP)', () => {
  it('覆盖全部 64 种三字声调组合，分值在 1 ~ 5 之间', () => {
    let count = 0;
    for (let t1 = 1; t1 <= 4; t1++) {
      for (let t2 = 1; t2 <= 4; t2++) {
        for (let t3 = 1; t3 <= 4; t3++) {
          const key = `${t1}${t2}${t3}`;
          expect(TONE_SCORE_MAP[key], `声调组合 ${key} 缺失`).toBeDefined();
          expect(TONE_SCORE_MAP[key]).toBeGreaterThanOrEqual(1);
          expect(TONE_SCORE_MAP[key]).toBeLessThanOrEqual(5);
          count++;
        }
      }
    }
    expect(count).toBe(64);
  });

  it('典型高分声调组合为 5 分（如 1-2-1, 2-1-2, 2-4-2, 4-1-2, 4-2-1 等）', () => {
    expect(evaluateToneScore([1, 2, 1])).toBe(5);
    expect(evaluateToneScore([2, 1, 2])).toBe(5);
    expect(evaluateToneScore([2, 4, 2])).toBe(5);
    expect(evaluateToneScore([4, 1, 2])).toBe(5);
  });

  it('全同声调或沉闷声调（如 3-3-3, 4-4-4, 3-3-1）为 1 分', () => {
    expect(evaluateToneScore([3, 3, 3])).toBe(1);
    expect(evaluateToneScore([4, 4, 4])).toBe(1);
    expect(evaluateToneScore([3, 3, 1])).toBe(1);
  });

  it('双字名平调评分合理', () => {
    expect(evaluateToneScore([1, 4])).toBe(4);
    expect(evaluateToneScore([3, 3])).toBe(1);
  });
});

describe('发音风格偏好 (normalizeStyle & isStyleMatched)', () => {
  it('normalizeStyle 支持中英文参数', () => {
    expect(normalizeStyle('响亮')).toBe('loud');
    expect(normalizeStyle('loud')).toBe('loud');
    expect(normalizeStyle('柔和')).toBe('soft');
    expect(normalizeStyle('soft')).toBe('soft');
    expect(normalizeStyle('不限')).toBe('any');
    expect(normalizeStyle(undefined)).toBe('any');
  });

  it('男宝响亮偏好末字 2声(阳平) 或 4声(去声)', () => {
    expect(isStyleMatched(2, 'loud')).toBe(true);
    expect(isStyleMatched(4, 'loud')).toBe(true);
    expect(isStyleMatched(1, 'loud')).toBe(false);
    expect(isStyleMatched(3, 'loud')).toBe(false);
  });

  it('女宝柔和偏好末字 1声(阴平) 或 3声(上声)', () => {
    expect(isStyleMatched(1, 'soft')).toBe(true);
    expect(isStyleMatched(3, 'soft')).toBe(true);
    expect(isStyleMatched(2, 'soft')).toBe(false);
    expect(isStyleMatched(4, 'soft')).toBe(false);
  });

  it('any 风格全部放行', () => {
    expect(isStyleMatched(1, 'any')).toBe(true);
    expect(isStyleMatched(2, 'any')).toBe(true);
    expect(isStyleMatched(3, 'any')).toBe(true);
    expect(isStyleMatched(4, 'any')).toBe(true);
  });
});
