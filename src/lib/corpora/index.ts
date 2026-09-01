/**
 * 名库核心模块导出与纯内存查询入口
 */
import { queryLocalCorpus } from './local-provider';
import { scoreCorpusCandidate } from './score-candidate';
import type { CorpusQueryOptions, ScoredCorpusCandidate } from './types';

export * from './types';
export * from './score-candidate';
export * from './explain-name';
export * from './local-provider';

/**
 * 纯内存名库查询主入口
 */
export function queryCuratedNames(options: CorpusQueryOptions): ScoredCorpusCandidate[] {
  const rawCandidates = queryLocalCorpus(options);

  // 综合打分与排序
  const scored = rawCandidates
    .map((entry) => scoreCorpusCandidate(entry, options))
    .sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      if (b.sourceScore !== a.sourceScore) return b.sourceScore - a.sourceScore;
      return a.name.localeCompare(b.name, 'zh-Hans-CN');
    });

  const limit = options.limit ?? 30;
  return scored.slice(0, limit);
}
