/**
 * 拼音声母发音部位、发音方法与韵母类别解析器
 */
import type { InitialMethod, InitialPlace, Tone } from './types';

export const INITIAL_PLACE_MAP: Readonly<Record<string, InitialPlace>> = Object.freeze({
  b: '双唇音',
  p: '双唇音',
  m: '双唇音',
  f: '唇齿音',
  d: '舌尖中音',
  t: '舌尖中音',
  n: '舌尖中音',
  l: '舌尖中音',
  g: '舌根音',
  k: '舌根音',
  h: '舌根音',
  j: '舌面前音',
  q: '舌面前音',
  x: '舌面前音',
  z: '舌尖前音',
  c: '舌尖前音',
  s: '舌尖前音',
  zh: '舌尖后音',
  ch: '舌尖后音',
  sh: '舌尖后音',
  r: '舌尖后音',
  '': '零声母',
});

export const INITIAL_METHOD_MAP: Readonly<Record<string, InitialMethod>> = Object.freeze({
  b: '塞音',
  p: '塞音',
  d: '塞音',
  t: '塞音',
  g: '塞音',
  k: '塞音',
  z: '塞擦音',
  c: '塞擦音',
  zh: '塞擦音',
  ch: '塞擦音',
  j: '塞擦音',
  q: '塞擦音',
  f: '擦音',
  s: '擦音',
  sh: '擦音',
  r: '擦音',
  x: '擦音',
  h: '擦音',
  m: '鼻音',
  n: '鼻音',
  l: '边音',
  '': '零声母',
});

const INITIAL_LIST = ['zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'z', 'c', 's', 'r', 'y', 'w'];

/**
 * 韵母分类（按主要元音和韵尾归纳类别，用于叠韵/绕口检测）
 */
export function classifyVowel(vowel: string): string {
  const v = vowel.toLowerCase();
  if (v.endsWith('ang')) return 'ang组';
  if (v.endsWith('eng') || v.endsWith('ing')) return 'eng组';
  if (v.endsWith('ong') || v.endsWith('iong')) return 'ong组';
  if (v.endsWith('an') || v.endsWith('ian') || v.endsWith('uan') || v.endsWith('üan')) return 'an组';
  if (v.endsWith('en') || v.endsWith('in') || v.endsWith('un') || v.endsWith('ün')) return 'en组';
  if (v.endsWith('ai') || v.endsWith('uai')) return 'ai组';
  if (v.endsWith('ei') || v.endsWith('ui')) return 'ei组';
  if (v.endsWith('ao') || v.endsWith('iao')) return 'ao组';
  if (v.endsWith('ou') || v.endsWith('iu')) return 'ou组';
  if (v.endsWith('a') || v.endsWith('ia') || v.endsWith('ua')) return 'a组';
  if (v.endsWith('o') || v.endsWith('uo')) return 'o组';
  if (v.endsWith('e') || v.endsWith('ie') || v.endsWith('üe')) return 'e组';
  if (v.endsWith('i') || v === 'er') return 'i组';
  if (v.endsWith('u')) return 'u组';
  if (v.endsWith('v') || v.endsWith('ü')) return 'ü组';
  return v;
}

/**
 * 分解拼音为声母、韵母、声调与发音分类
 * @param pinyin 带调拼音或数字调拼音，如 "zhōng", "hán", "mǎ", "lè" 或 "zhong1"
 */
export function parsePinyin(pinyinStr: string): {
  pinyin: string;
  tone: Tone;
  pinyinWithoutTone: string;
  initial: string;
  initialPlace: InitialPlace;
  initialMethod: InitialMethod;
  vowel: string;
  vowelType: string;
} {
  const raw = pinyinStr.trim().toLowerCase();
  let tone: Tone = 1;

  // 1. 检测声调与去声调
  const toneMap: Record<string, { char: string; tone: Tone }> = {
    ā: { char: 'a', tone: 1 },
    á: { char: 'a', tone: 2 },
    ǎ: { char: 'a', tone: 3 },
    à: { char: 'a', tone: 4 },
    ō: { char: 'o', tone: 1 },
    ó: { char: 'o', tone: 2 },
    ǒ: { char: 'o', tone: 3 },
    ò: { char: 'o', tone: 4 },
    ē: { char: 'e', tone: 1 },
    é: { char: 'e', tone: 2 },
    ě: { char: 'e', tone: 3 },
    è: { char: 'e', tone: 4 },
    ī: { char: 'i', tone: 1 },
    í: { char: 'i', tone: 2 },
    ǐ: { char: 'i', tone: 3 },
    ì: { char: 'i', tone: 4 },
    ū: { char: 'u', tone: 1 },
    ú: { char: 'u', tone: 2 },
    ǔ: { char: 'u', tone: 3 },
    ù: { char: 'u', tone: 4 },
    ǖ: { char: 'v', tone: 1 },
    ǘ: { char: 'v', tone: 2 },
    ǚ: { char: 'v', tone: 3 },
    ǜ: { char: 'v', tone: 4 },
    ü: { char: 'v', tone: 1 },
  };

  let cleanPinyin = '';
  for (const ch of raw) {
    if (toneMap[ch]) {
      cleanPinyin += toneMap[ch].char;
      tone = toneMap[ch].tone;
    } else if (/[1-4]/.test(ch)) {
      tone = Number.parseInt(ch, 10) as Tone;
    } else {
      cleanPinyin += ch;
    }
  }

  // 2. 提取声母
  let initial = '';
  let vowel = cleanPinyin;

  for (const init of INITIAL_LIST) {
    if (cleanPinyin.startsWith(init)) {
      initial = init === 'y' || init === 'w' ? '' : init;
      vowel = cleanPinyin.slice(init.length);
      break;
    }
  }

  if (vowel === '') vowel = cleanPinyin;

  const initialPlace = INITIAL_PLACE_MAP[initial] ?? '零声母';
  const initialMethod = INITIAL_METHOD_MAP[initial] ?? '零声母';
  const vowelType = classifyVowel(vowel);

  return {
    pinyin: pinyinStr,
    tone,
    pinyinWithoutTone: cleanPinyin,
    initial,
    initialPlace,
    initialMethod,
    vowel,
    vowelType,
  };
}
