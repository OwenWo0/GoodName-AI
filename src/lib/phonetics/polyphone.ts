/**
 * 起名多音字定音表 —— 对真多音字在人名语境下的惯用读音做本地固定
 * 取音为本仓库依人名用例独立整理（如「都」取 dū、「处」取 chǔ、「乐」人名多取 yuè）
 */

export const NAME_POLYPHONE_MAP: Readonly<Record<string, { pinyin: string; tone: 1 | 2 | 3 | 4 }>> = Object.freeze({
  中: { pinyin: 'zhōng', tone: 1 },
  华: { pinyin: 'huá', tone: 2 },
  重: { pinyin: 'zhòng', tone: 4 },
  朝: { pinyin: 'zhāo', tone: 1 },
  行: { pinyin: 'xíng', tone: 2 },
  长: { pinyin: 'cháng', tone: 2 },
  乐: { pinyin: 'yuè', tone: 4 }, // 或 lè，作为美意通常取 lè / yuè
  和: { pinyin: 'hé', tone: 2 },
  强: { pinyin: 'qiáng', tone: 2 },
  正: { pinyin: 'zhèng', tone: 4 },
  盛: { pinyin: 'shèng', tone: 4 },
  传: { pinyin: 'chuán', tone: 2 },
  冠: { pinyin: 'guān', tone: 1 },
  兴: { pinyin: 'xīng', tone: 1 },
  奇: { pinyin: 'qí', tone: 2 },
  好: { pinyin: 'hǎo', tone: 3 },
  少: { pinyin: 'shào', tone: 4 },
  相: { pinyin: 'xiāng', tone: 1 },
  省: { pinyin: 'xǐng', tone: 3 },
  参: { pinyin: 'cān', tone: 1 },
  处: { pinyin: 'chǔ', tone: 3 }, // 处士/处子之音，人名取上声
  应: { pinyin: 'yìng', tone: 4 },
  度: { pinyin: 'dù', tone: 4 },
  量: { pinyin: 'liàng', tone: 4 },
  泊: { pinyin: 'bó', tone: 2 },
  澄: { pinyin: 'chéng', tone: 2 },
  济: { pinyin: 'jì', tone: 4 },
  识: { pinyin: 'shí', tone: 2 },
  觉: { pinyin: 'jué', tone: 2 },
  解: { pinyin: 'jiě', tone: 3 },
  载: { pinyin: 'zǎi', tone: 3 },
  都: { pinyin: 'dū', tone: 1 }, // 人名/姓取 dū，不作副词 dōu
});
