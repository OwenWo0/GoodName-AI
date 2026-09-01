/**
 * 名字考据与深度解释生成器
 */
import type { ScoredCorpusCandidate } from './types';

export function explainCorpusCandidate(candidate: ScoredCorpusCandidate): string {
  const parts: string[] = [];

  parts.push(`【姓名】${candidate.fullName}（${candidate.pinyin}）`);
  parts.push(`【五行】${candidate.wuxing.join('、')}`);
  parts.push(`【综合评分】${candidate.totalScore}分（声韵 ${candidate.phonetic.score}/35 | 语义 ${candidate.semantic.score}/30 | 典故来源 ${candidate.sourceScore}/35）`);

  // 声韵细节
  parts.push(
    `【声韵音律】声调结构为「${candidate.phonetic.tonePattern}」，音律评级 ${candidate.phonetic.toneScore}/5 分。` +
      (candidate.phonetic.details.styleMatched ? '发音响亮清爽，与起名风格契合。' : '')
  );

  // 典故与来源
  if (candidate.sources.length > 0) {
    parts.push('【文化考据与出处】');
    for (const [idx, s] of candidate.sources.entries()) {
      const srcName =
        s.corpusType === 'ancient'
          ? '古人名号解诂'
          : s.corpusType === 'imperial_exam'
            ? '登科进士录'
            : s.corpusType === 'academic'
              ? '科学与学者录'
              : s.corpusType === 'wealth'
                ? '商业美意录'
                : '时代名典';
      parts.push(`  ${idx + 1}. [${srcName}] ${s.personName}${s.dynasty ? `（${s.dynasty}）` : ''}：${s.description}（见于《${s.citation}》）`);
    }
  }

  return parts.join('\n');
}
