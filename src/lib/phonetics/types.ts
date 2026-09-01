/**
 * 声韵学类型定义
 */

export type Tone = 1 | 2 | 3 | 4;

/** 名字风格（规范值） */
export type NameStyle = 'any' | 'loud' | 'soft';

/** 表单/API 可透传的中文别名，经 normalizeStyle 归一到 NameStyle */
export type NameStyleInput = NameStyle | '不限' | '响亮' | '柔和';

/** 必含字位置（规范值） */
export type MustPosition = 'any' | 'second' | 'third';

/** 表单/API 可透传的中文别名，由消费方归一到 MustPosition */
export type MustPositionInput = MustPosition | '不限制' | '第二位' | '第三位';

/** 声母发音部位分类 */
export type InitialPlace =
  | '双唇音' // b, p, m
  | '唇齿音' // f
  | '舌尖中音' // d, t, n, l
  | '舌根音' // g, k, h
  | '舌面前音' // j, q, x
  | '舌尖前音' // z, c, s
  | '舌尖后音' // zh, ch, sh, r
  | '零声母'; // a, o, e, etc.

/** 声母发音方法分类 */
export type InitialMethod =
  | '塞音' // b, p, d, t, g, k
  | '塞擦音' // z, c, zh, ch, j, q
  | '擦音' // f, s, sh, r, x, h
  | '鼻音' // m, n
  | '边音' // l
  | '零声母';

/** 字符声韵信息 */
export interface CharPhoneticInfo {
  readonly char: string;
  readonly pinyin: string;
  readonly tone: Tone;
  readonly pinyinWithoutTone: string;
  readonly initial: string;
  readonly initialMethod: InitialMethod;
  readonly initialPlace: InitialPlace;
  readonly vowel: string;
  readonly vowelType: string;
  readonly count?: number;
  readonly isPolyphone?: boolean;
}

export type CharPhoneticDb = Readonly<Record<string, CharPhoneticInfo>>;

/** 拼音声韵诊断条目 */
export interface PhoneticIssue {
  readonly level: 'hard' | 'soft';
  readonly code:
    | 'same_pinyin'
    | 'same_initial_place'
    | 'same_vowel_type'
    | 'tone_unpleasant'
    | 'tone_style_mismatch'
    | 'avoid_pinyin_hit'
    | 'avoid_initial_hit'
    | 'avoid_vowel_hit';
  readonly message: string;
}

/** 声韵评估结果 */
export interface PhoneticResult {
  readonly score: number; // 0 ~ 35 分
  readonly tonePattern: string; // 如 "1-2-4"
  readonly toneScore: number; // 1 ~ 5 分
  readonly isPassed: boolean;
  readonly issues: readonly PhoneticIssue[];
  readonly details: {
    readonly tonePattern: string;
    readonly toneScore: number;
    readonly alliterationPlace?: InitialPlace; // 叠双声发音部位
    readonly rhymeType?: string; // 叠韵韵母分类
    readonly styleMatched: boolean;
  };
}
