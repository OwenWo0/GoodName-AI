import { pinyin as getPinyin } from 'pinyin-pro';
import { parsePinyin } from './initial-vowel';
import { NAME_POLYPHONE_MAP } from './polyphone';
import { evaluateToneScore, isStyleMatched, normalizeStyle } from './tone-matrix';
import type { CharPhoneticInfo, InitialPlace, NameStyleInput, PhoneticIssue, PhoneticResult } from './types';

/**
 * 获取汉字标准声韵信息（结合人名多音字修正）
 */
export function getCharPhonetic(char: string, customPinyin?: string): CharPhoneticInfo {
  let pinyin = customPinyin;
  if (!pinyin) {
    if (NAME_POLYPHONE_MAP[char]) {
      pinyin = NAME_POLYPHONE_MAP[char].pinyin;
    } else {
      try {
        pinyin = getPinyin(char, { toneType: 'symbol' });
      } catch {
        pinyin = char;
      }
    }
  }

  // 解析拼音
  const parsed = parsePinyin(pinyin ?? char);
  return {
    char,
    pinyin: parsed.pinyin,
    tone: parsed.tone,
    pinyinWithoutTone: parsed.pinyinWithoutTone,
    initial: parsed.initial,
    initialPlace: parsed.initialPlace,
    initialMethod: parsed.initialMethod,
    vowel: parsed.vowel,
    vowelType: parsed.vowelType,
    isPolyphone: Boolean(NAME_POLYPHONE_MAP[char]),
  };
}

/**
 * 检查相邻两个字的声韵问题（叠双声、叠韵、同音）
 */
export function checkPhoneticPair(left: CharPhoneticInfo, right: CharPhoneticInfo, label: string): PhoneticIssue[] {
  const issues: PhoneticIssue[] = [];

  // 1. 同音字拦截
  if (left.pinyinWithoutTone === right.pinyinWithoutTone) {
    issues.push({
      level: 'hard',
      code: 'same_pinyin',
      message: `${label}「${left.char}」与「${right.char}」发音相同（${left.pinyinWithoutTone}），容易产生单调感`,
    });
  }

  // 2. 叠双声拦截（发音部位相同，且非零声母）
  if (left.initialPlace !== '零声母' && left.initialPlace === right.initialPlace) {
    issues.push({
      level: 'soft',
      code: 'same_initial_place',
      message: `${label}「${left.char}」与「${right.char}」声母发音部位同属【${left.initialPlace}】，可能略有拗口`,
    });
  }

  // 3. 叠韵拦截（韵母分类同组）
  if (left.vowelType === right.vowelType) {
    issues.push({
      level: 'soft',
      code: 'same_vowel_type',
      message: `${label}「${left.char}」与「${right.char}」韵母同属【${left.vowelType}】，存在叠韵绕口倾向`,
    });
  }

  return issues;
}

/**
 * 避讳字声韵检查（与长辈/亲属名字字符避音）
 */
export function checkAvoidPhonetics(
  nameChars: readonly CharPhoneticInfo[],
  avoidChars: readonly CharPhoneticInfo[],
): PhoneticIssue[] {
  const issues: PhoneticIssue[] = [];

  for (const nc of nameChars) {
    for (const ac of avoidChars) {
      if (nc.pinyinWithoutTone === ac.pinyinWithoutTone) {
        issues.push({
          level: 'hard',
          code: 'avoid_pinyin_hit',
          message: `名中「${nc.char}」与避讳字「${ac.char}」同音（${nc.pinyinWithoutTone}）`,
        });
      }
    }
  }

  return issues;
}

export interface PhoneticEvalOptions {
  readonly surname: string;
  readonly name: string;
  readonly style?: NameStyleInput;
  readonly avoidChars?: readonly string[];
  readonly charDbGetter?: (char: string) => CharPhoneticInfo | undefined;
}

/**
 * 全名声韵综合评估
 */
export function evaluatePhonetics(options: PhoneticEvalOptions): PhoneticResult {
  const { surname, name, style = 'any', avoidChars = [], charDbGetter } = options;
  const styleNorm = normalizeStyle(style);

  const getInfo = (ch: string): CharPhoneticInfo => {
    return charDbGetter?.(ch) ?? getCharPhonetic(ch);
  };

  const surnameInfos = [...surname].map(getInfo);
  const nameInfos = [...name].map(getInfo);
  const allInfos = [...surnameInfos, ...nameInfos];
  const allTones = allInfos.map((i) => i.tone);

  const issues: PhoneticIssue[] = [];

  // 1. 检查名内部相邻字
  if (nameInfos.length >= 2) {
    issues.push(...checkPhoneticPair(nameInfos[0], nameInfos[1], '名内部'));
  }

  // 2. 检查姓末字与名首字
  if (surnameInfos.length > 0 && nameInfos.length > 0) {
    const lastSurname = surnameInfos[surnameInfos.length - 1];
    const firstName = nameInfos[0];
    issues.push(...checkPhoneticPair(lastSurname, firstName, '姓与名衔接'));
  }

  // 3. 避讳字符声韵检查
  if (avoidChars.length > 0) {
    const avoidInfos = avoidChars.map(getInfo);
    issues.push(...checkAvoidPhonetics(nameInfos, avoidInfos));
  }

  // 4. 评估平仄声调分数
  // 若为三字名（单姓双名/复姓单名），取 3 调；双字名取 2 调
  const toneScore = evaluateToneScore(allTones.slice(-3));
  const tonePattern = allTones.join('-');

  if (toneScore <= 2) {
    issues.push({
      level: 'soft',
      code: 'tone_unpleasant',
      message: `声调组合（${tonePattern}）起伏平淡或过于平缓（评分 ${toneScore}/5）`,
    });
  }

  // 5. 性别发音风格偏好检查
  const lastTone = allTones[allTones.length - 1] ?? 1;
  const styleMatched = isStyleMatched(lastTone, styleNorm);
  if (!styleMatched) {
    issues.push({
      level: 'soft',
      code: 'tone_style_mismatch',
      message: `末字声调为${lastTone}声，与「${style}」风格偏好不太契合`,
    });
  }

  // 6. 声韵学总分计算（满分 35 分，基线 25 分）
  let score = 25;
  // 声调加减分：1分 -> -8, 2分 -> -4, 3分 -> 0, 4分 -> +4, 5分 -> +8
  score += (toneScore - 3) * 4;

  // 风格偏好加减分
  if (styleNorm !== 'any') {
    score += styleMatched ? 3 : -4;
  }

  // 扣除硬伤与软伤
  let hasHard = false;
  let allitPlace: InitialPlace | undefined = undefined;
  let rhymeType: string | undefined = undefined;

  for (const issue of issues) {
    if (issue.level === 'hard') {
      hasHard = true;
      score -= 15;
    } else {
      score -= 4;
    }
    if (issue.code === 'same_initial_place') {
      allitPlace = nameInfos[0]?.initialPlace;
    }
    if (issue.code === 'same_vowel_type') {
      rhymeType = nameInfos[0]?.vowelType;
    }
  }

  const finalScore = Math.max(0, Math.min(35, Math.round(score)));

  return {
    score: finalScore,
    tonePattern,
    toneScore,
    isPassed: !hasHard && finalScore >= 18,
    issues,
    details: {
      tonePattern,
      toneScore,
      alliterationPlace: allitPlace,
      rhymeType: rhymeType,
      styleMatched,
    },
  };
}
