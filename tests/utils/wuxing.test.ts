/**
 * 五行关系/干支五行派生 单测。
 */
import { describe, expect, it } from 'vitest';
import {
  ganToWuxing,
  zhiToWuxing,
  wuxingRelation,
  WUXING_BAR_CLASS,
  WUXING_ORDER,
  type WuxingRelation,
} from '@/utils/wuxing';

describe('wuxingRelation（以日主甲木为基准的全矩阵）', () => {
  const 日主 = '木' as const;
  const expected: Record<string, WuxingRelation> = {
    木: '同我',
    火: '我生',
    土: '我克',
    金: '克我',
    水: '生我',
  };
  for (const [target, relation] of Object.entries(expected)) {
    it(`木日主见${target}→${relation}`, () => {
      expect(wuxingRelation(日主, target as '木')).toBe(relation);
    });
  }

  it('火日主：火同我、土我生、水克我、木生我、金我克', () => {
    expect(wuxingRelation('火', '火')).toBe('同我');
    expect(wuxingRelation('火', '土')).toBe('我生');
    expect(wuxingRelation('火', '水')).toBe('克我');
    expect(wuxingRelation('火', '木')).toBe('生我');
    expect(wuxingRelation('火', '金')).toBe('我克');
  });

  it('水日主：火为我克（水克火）', () => {
    expect(wuxingRelation('水', '火')).toBe('我克');
    expect(wuxingRelation('水', '木')).toBe('我生');
    expect(wuxingRelation('水', '土')).toBe('克我');
    expect(wuxingRelation('水', '金')).toBe('生我');
  });

  it('五组日主×五行共 25 组合全部落在五类关系内', () => {
    const 全部 = new Set<WuxingRelation>();
    for (const a of WUXING_ORDER) {
      for (const b of WUXING_ORDER) {
        全部.add(wuxingRelation(a, b));
      }
    }
    expect(全部.size).toBe(5);
  });
});

describe('ganToWuxing / zhiToWuxing', () => {
  it('十干五行', () => {
    expect([...'甲乙丙丁戊己庚辛壬癸'].map(ganToWuxing)).toEqual([
      '木', '木', '火', '火', '土', '土', '金', '金', '水', '水',
    ]);
  });
  it('十二支五行（本气）', () => {
    expect(zhiToWuxing('子')).toBe('水');
    expect(zhiToWuxing('寅')).toBe('木');
    expect(zhiToWuxing('申')).toBe('金');
    expect(zhiToWuxing('戌')).toBe('土');
    expect(zhiToWuxing('巳')).toBe('火');
  });
  it('非干支字符返回 null', () => {
    expect(ganToWuxing('张')).toBeNull();
    expect(zhiToWuxing('甲')).toBeNull();
  });
});

describe('展示映射表完整性', () => {
  it('每个五行都有色条与文字类', () => {
    for (const w of WUXING_ORDER) {
      expect(WUXING_BAR_CLASS[w]).toMatch(/^bg-wuxing-/);
    }
  });
});
