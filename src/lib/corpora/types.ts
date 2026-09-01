/**
 * 五大名库数据类型定义
 */
import type { NameStyleInput, MustPositionInput, PhoneticResult } from '@/lib/phonetics/types';
import type { SemanticResult } from '@/lib/semantics/filters';
import type { WuXing } from '@/lib/types';

/** 五大名库类别 */
export type CorpusCategory =
  | 'imperial_exam' // 登科录（CBDB 历代进士科第）
  | 'ancient' // 古人云（《古人名字解诂》古代文人学者名与字）
  | 'academic' // 五道口（国家科学与社科基金/两院院士/学者）
  | 'wealth' // 财富论（21W私募基金与2W企业精选词）
  | 'modern'; // 他山石（16W现代积分落户实名人名）

/** 名库出处条目 */
export interface CorpusSourceCitation {
  readonly corpusType: CorpusCategory;
  readonly personName: string;
  readonly dynasty?: string;
  readonly category?: string;
  readonly description: string;
  readonly citation: string;
  readonly citationType: '史传' | '科第录' | '方志' | '公开资料';
}

/** 候选名条目 */
export interface CorpusCandidateEntry {
  readonly name: string;
  readonly length: 1 | 2;
  readonly pinyin: string;
  readonly wuxing: WuXing[];
  readonly sources: readonly CorpusSourceCitation[];
  readonly totalFrequency: number;
}

/** 综合评分打分结果 */
export interface ScoredCorpusCandidate {
  readonly name: string;
  readonly fullName: string;
  readonly length: 1 | 2;
  readonly pinyin: string;
  readonly wuxing: WuXing[];
  readonly totalScore: number; // 0 ~ 100 分
  readonly phonetic: PhoneticResult; // 声韵 0 ~ 35 分
  readonly semantic: SemanticResult; // 语义安全 0 ~ 30 分
  readonly sourceScore: number; // 来源与频次 0 ~ 35 分
  readonly sources: readonly CorpusSourceCitation[];
  readonly explanation: string;
}

/** 查询过滤选项 */
export interface CorpusQueryOptions {
  readonly surname: string;
  readonly nameLength?: 1 | 2;
  readonly mustChar?: string;
  readonly mustPosition?: MustPositionInput;
  readonly avoidChars?: readonly string[];
  readonly style?: NameStyleInput;
  readonly corpusPreference?: 'all' | 'ancient' | 'academic' | 'wealth' | 'modern';
  readonly preferredCorpora?: readonly CorpusCategory[];
  readonly xiyongWuxing?: readonly WuXing[];
  readonly jishenWuxing?: readonly WuXing[];
  readonly limit?: number;
}
