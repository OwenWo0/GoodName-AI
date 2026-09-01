import { describe, expect, it } from 'vitest';
import {
  getLocalCorpusEntries,
  queryLocalCorpus,
  queryCuratedNames,
  scoreCorpusCandidate,
  explainCorpusCandidate,
} from '@/lib/corpora';

describe('名库数据提供器与检索 (Local & Curated Corpora)', () => {
  it('本地名库 entries 数量充沛且包含出处文献', () => {
    const entries = getLocalCorpusEntries();
    expect(entries.length).toBeGreaterThan(300);

    for (const e of entries.slice(0, 50)) {
      expect(e.name.length).toBeGreaterThanOrEqual(1);
      expect(e.sources.length).toBeGreaterThanOrEqual(1);
      expect(e.sources[0].citation).toBeDefined();
    }
  });

  it('按长度、姓氏、喜忌神过滤名库 (queryLocalCorpus)', () => {
    const doubleNames = queryLocalCorpus({
      surname: '王',
      nameLength: 2,
      xiyongWuxing: ['木', '水'],
      jishenWuxing: ['金'],
    });

    expect(doubleNames.length).toBeGreaterThan(20);
    for (const item of doubleNames) {
      expect(item.length).toBe(2);
      expect(item.name.includes('王')).toBe(false);
      // 忌神无金
      expect(item.wuxing.includes('金')).toBe(false);
      // 喜用至少含木或水
      expect(item.wuxing.some((wx) => wx === '木' || wx === '水')).toBe(true);
    }
  });

  it('综合打分与排序 (queryCuratedNames)', () => {
    const results = queryCuratedNames({
      surname: '李',
      nameLength: 2,
      style: 'loud',
      limit: 10,
    });

    expect(results.length).toBe(10);
    for (let i = 0; i < results.length - 1; i++) {
      // 降序排序
      expect(results[i].totalScore).toBeGreaterThanOrEqual(results[i + 1].totalScore);
    }
  });

  it('名字考据与深度解释生成 (explainCorpusCandidate)', () => {
    const entries = getLocalCorpusEntries();
    const target = entries.find((e) => e.name === '修' || e.name === '世民') ?? entries[0];
    const scored = scoreCorpusCandidate(target, { surname: '李' });
    const exp = explainCorpusCandidate(scored);

    expect(exp).toContain('【姓名】');
    expect(exp).toContain('【声韵音律】');
    expect(exp).toContain('【文化考据与出处】');
  });
});
