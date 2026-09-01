/**
 * 候选名综合评分引擎（评分维度与权重为本仓库自定口径）
 * 满分 100 分：声韵学 35分 + 来源与频次 35分 + 语义安全 30分
 */
import { evaluatePhonetics } from '@/lib/phonetics/phonetic-rules';
import { evaluateSemanticSafety } from '@/lib/semantics/filters';
import type { CorpusCandidateEntry, CorpusQueryOptions, ScoredCorpusCandidate } from './types';

export const CORPUS_WEIGHTS = Object.freeze({
  ancient: 32, // 古人名字解诂：文化典故最高
  imperial_exam: 30, // 登科进士：历代科第
  academic: 28, // 科学与社科学者
  wealth: 22, // 商业与基金精选
  modern: 20, // 现代实名落户
});

/** 计算名库来源与频次分 (0 ~ 35 分) */
export function calculateSourceScore(
  entry: CorpusCandidateEntry,
  preference?: CorpusQueryOptions['corpusPreference'],
): number {
  let baseScore = 20;

  if (entry.sources && entry.sources.length > 0) {
    const scores = entry.sources.map((s) => CORPUS_WEIGHTS[s.corpusType] ?? 20);
    baseScore = Math.max(...scores);

    // 多源出处加分（多重文献佐证 +2~5 分）
    if (entry.sources.length >= 2) baseScore += 3;
    if (entry.sources.length >= 4) baseScore += 2;
  }

  // 语料频次加分（对数级加分）
  if (entry.totalFrequency >= 100) baseScore += 2;
  if (entry.totalFrequency >= 1000) baseScore += 2;

  // 偏好加分
  if (preference && preference !== 'all') {
    const matchPref = entry.sources.some((s) => s.corpusType === preference);
    if (matchPref) baseScore += 4;
  }

  return Math.min(35, Math.max(0, Math.round(baseScore)));
}

/** 评估单个候选名并生成综合得分 */
export function scoreCorpusCandidate(
  entry: CorpusCandidateEntry,
  options: CorpusQueryOptions,
): ScoredCorpusCandidate {
  const { surname, style, avoidChars } = options;
  const fullName = surname + entry.name;

  // 1. 声韵学评分 (0 ~ 35)
  const phonetic = evaluatePhonetics({
    surname,
    name: entry.name,
    style,
    avoidChars,
  });

  // 2. 语义安全评分 (0 ~ 30)
  const semantic = evaluateSemanticSafety(fullName, entry.name);

  // 3. 来源与频次评分 (0 ~ 35)
  const sourceScore = calculateSourceScore(entry, options.corpusPreference);

  // 4. 总分
  const totalScore = Math.min(100, Math.max(0, phonetic.score + semantic.score + sourceScore));

  // 5. 组装说明文案
  const expLines: string[] = [];
  expLines.push(`【声韵评估 ${phonetic.score}/35】声调${phonetic.tonePattern}（评分${phonetic.toneScore}/5）`);
  if (phonetic.issues.length > 0) {
    expLines.push(`声韵提示：${phonetic.issues.map((i) => i.message).join('；')}`);
  }
  if (entry.sources && entry.sources.length > 0) {
    const s = entry.sources[0];
    expLines.push(`【名库出处】${s.personName}${s.dynasty ? `（${s.dynasty}）` : ''} - ${s.description}（出处：${s.citation}）`);
  }

  return {
    name: entry.name,
    fullName,
    length: entry.length,
    pinyin: entry.pinyin,
    wuxing: entry.wuxing,
    totalScore,
    phonetic,
    semantic,
    sourceScore,
    sources: entry.sources,
    explanation: expLines.join('\n'),
  };
}
