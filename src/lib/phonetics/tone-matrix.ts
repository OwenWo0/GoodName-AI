/**
 * 64种三字名声调平仄打分矩阵 —— 纯函数
 * 取值 1 ~ 5 分，综合考量音律起伏与抑扬顿挫。
 */
import type { NameStyleInput, Tone } from './types';

export const TONE_SCORE_MAP: Readonly<Record<string, number>> = Object.freeze({
  '111': 2,
  '112': 3,
  '113': 3,
  '114': 3,
  '121': 5,
  '122': 3,
  '123': 4,
  '124': 4,
  '131': 3,
  '132': 3,
  '133': 1,
  '134': 3,
  '141': 4,
  '142': 4,
  '143': 4,
  '144': 2,
  '211': 3,
  '212': 5,
  '213': 4,
  '214': 4,
  '221': 3,
  '222': 2,
  '223': 3,
  '224': 3,
  '231': 3,
  '232': 3,
  '233': 1,
  '234': 3,
  '241': 4,
  '242': 5,
  '243': 4,
  '244': 2,
  '311': 3,
  '312': 4,
  '313': 4,
  '314': 4,
  '321': 4,
  '322': 3,
  '323': 4,
  '324': 4,
  '331': 1,
  '332': 1,
  '333': 1,
  '334': 1,
  '341': 4,
  '342': 4,
  '343': 4,
  '344': 1,
  '411': 3,
  '412': 5,
  '413': 5,
  '414': 5,
  '421': 5,
  '422': 3,
  '423': 5,
  '424': 5,
  '431': 3,
  '432': 3,
  '433': 1,
  '434': 3,
  '441': 2,
  '442': 2,
  '443': 2,
  '444': 1,
});

/** 标准化风格偏好 */
export function normalizeStyle(style: NameStyleInput | undefined): 'any' | 'loud' | 'soft' {
  if (style === '响亮' || style === 'loud') return 'loud';
  if (style === '柔和' || style === 'soft') return 'soft';
  return 'any';
}

/** 评估声调三字组合基础分 (1~5) */
export function evaluateToneScore(tones: readonly Tone[]): number {
  if (tones.length === 3) {
    const key = `${tones[0]}${tones[1]}${tones[2]}`;
    return TONE_SCORE_MAP[key] ?? 3;
  }
  if (tones.length === 2) {
    // 双字名（单姓单名）
    if (tones[0] === tones[1]) return tones[0] === 3 ? 1 : 2;
    return 4;
  }
  return 3;
}

/**
 * 校验性别发音风格
 * - loud (响亮/男宝)：末字倾向 2(阳平) 或 4(去声)
 * - soft (柔和/女宝)：末字倾向 1(阴平) 或 3(上声)
 */
export function isStyleMatched(lastTone: Tone, style: 'any' | 'loud' | 'soft'): boolean {
  if (style === 'any') return true;
  if (style === 'loud') {
    return lastTone === 2 || lastTone === 4;
  }
  if (style === 'soft') {
    return lastTone === 1 || lastTone === 3;
  }
  return true;
}
