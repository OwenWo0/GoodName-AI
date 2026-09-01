import { describe, expect, it } from 'vitest';
import { parsePinyin } from '@/lib/phonetics/initial-vowel';
import {
  evaluatePhonetics,
  getCharPhonetic,
  checkPhoneticPair,
} from '@/lib/phonetics/phonetic-rules';

describe('拼音与发音部位解析 (parsePinyin & getCharPhonetic)', () => {
  it('正确解析声母、韵母、发音部位与发音方法', () => {
    const p1 = parsePinyin('zhōng');
    expect(p1.initial).toBe('zh');
    expect(p1.initialPlace).toBe('舌尖后音');
    expect(p1.initialMethod).toBe('塞擦音');
    expect(p1.vowel).toBe('ong');
    expect(p1.vowelType).toBe('ong组');
    expect(p1.tone).toBe(1);

    const p2 = parsePinyin('bó');
    expect(p2.initial).toBe('b');
    expect(p2.initialPlace).toBe('双唇音');
    expect(p2.vowel).toBe('o');
    expect(p2.tone).toBe(2);
  });

  it('多音字人名常音标准置换生效（如 华 取 huá，中 取 zhōng）', () => {
    const hua = getCharPhonetic('华');
    expect(hua.tone).toBe(2);
    expect(hua.pinyinWithoutTone).toBe('hua');

    const zhong = getCharPhonetic('中');
    expect(zhong.tone).toBe(1);
    expect(zhong.pinyinWithoutTone).toBe('zhong');
  });
});

describe('声韵学规则与发音冲突检测 (checkPhoneticPair & evaluatePhonetics)', () => {
  it('检测叠双声（相邻字发音部位相同）', () => {
    // 两个双唇音 b/p
    const c1 = getCharPhonetic('博', 'bó');
    const c2 = getCharPhonetic('朋', 'péng');
    const issues = checkPhoneticPair(c1, c2, '测试');
    expect(issues.some((i) => i.code === 'same_initial_place')).toBe(true);
  });

  it('检测叠韵（相邻字韵母同类）', () => {
    // 两个 ang 组
    const c1 = getCharPhonetic('章', 'zhāng');
    const c2 = getCharPhonetic('康', 'kāng');
    const issues = checkPhoneticPair(c1, c2, '测试');
    expect(issues.some((i) => i.code === 'same_vowel_type')).toBe(true);
  });

  it('全名声韵综合评分 (evaluatePhonetics)', () => {
    const resGood = evaluatePhonetics({
      surname: '王',
      name: '德民', // 王(2) 德(2) 民(2) 或 王(2) 绍(4) 华(2)
      style: 'loud',
    });
    expect(resGood.score).toBeGreaterThanOrEqual(15);
    expect(resGood.tonePattern).toBeDefined();

    // 避讳同音字扣分
    const resAvoid = evaluatePhonetics({
      surname: '李',
      name: '德民',
      avoidChars: ['敏'], // mǐn 同音民 mín (min)
    });
    expect(resAvoid.issues.some((i) => i.code === 'avoid_pinyin_hit')).toBe(true);
  });
});
