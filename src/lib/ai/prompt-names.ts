/**
 * AI 点评层 · 意向吉名评价 Prompt —— 纯函数，零 IO（契约 v2 §5）。
 *
 * 与 prompt.ts（ChartResult 综合解读）的分工：这里点评的是用户心中已有的候选名
 * （意向吉名），输入 = 命盘最小摘要 + 固定算法引擎产出的评估数组（EvaluatedName[]，
 * 来自 /api/evaluate-names 与 /api/mingren-match 的形状）。
 * 铁律：只依据给定数据点评；严禁编造/重算任何五格数理与契合分；直言不足、不谄媚。
 */
import { z } from 'zod';
import type { WuXing } from '@/lib/types';
import type { EvaluatedName } from '@/lib/evaluate/types';
import { EVALUATE_NAMES_MAX } from '@/lib/evaluate/types';
import { DISCLAIMER_TEXT, stableStringify, type ChatMessage } from '@/lib/ai/prompt';

/** 命盘最小摘要：AI 点评比综合解读轻，不需要完整 ChartResult。 */
export interface 命盘摘要 {
  /** 年月日时四柱干支，恰 4 项。 */
  readonly 四柱: readonly string[];
  readonly 日主: string;
  readonly 喜用神: readonly WuXing[];
  readonly 忌神: readonly WuXing[];
}

/** buildNameEvalMessages 的输入（契约 v2 §5 冻结形状）。 */
export interface NameEvalInput {
  readonly 命盘摘要: 命盘摘要;
  readonly 评估: readonly EvaluatedName[];
}

/**
 * 请求浅校验（契约 v2 §5：浅校验 + 深度检查在 route 壳做，深校验责任在评估产出方）。
 * 评估条目只校验存在与条数——EvaluatedName 由我方算法层产出，不重排深 schema 防契约漂移。
 */
export const nameEvalRequestSchema = z.object({
  命盘摘要: z.object({
    四柱: z.array(z.string()).length(4, '四柱须为 4 项'),
    日主: z.string().min(1),
    喜用神: z.array(z.string()).min(1).max(5),
    忌神: z.array(z.string()).max(5),
  }),
  评估: z.array(z.unknown()).min(1, '评估至少 1 条').max(EVALUATE_NAMES_MAX, `评估至多 ${EVALUATE_NAMES_MAX} 条`),
});

/**
 * System 提示词：意向名点评的角色与铁律。导出以便测试与复用。
 * 与综合解读的差异：候选名是用户自己选的——点评必须直言不足、不谄媚，也不恐吓。
 */
export const NAME_EVAL_SYSTEM_PROMPT = `你是一位精通中国传统命名文化的起名顾问，替用户点评其心中已有的候选名（意向吉名）。

【铁律】
1. 用户消息是一份 JSON：命盘摘要（四柱/日主/喜用神/忌神）+ 评估数组（每条为固定算法引擎对该名的确定性评估：五行/平仄/五格/爆款度/喜忌契合）。你只能基于这份数据点评；严禁自行改写、重算、修正或补充任何数值（康熙笔画、五格数理、契合分等一律以 JSON 为准）。
2. 直言不足、不谄媚：候选名是用户自己挑的，但你的职责是讲真话——凡犯忌神、犯避讳、平仄失谐、谐音不佳、爆款度过高（重名风险大）之处，必须直言点明，不得因是用户的心头好而只挑好听的说。
3. 某名 五格 为 null（表外字致康熙笔画不可得）时，只可说明「笔画不可得、五格不予评定」，严禁编造数理凑一节。
4. 民俗参考口径：一切结论按传统命名民俗文化（平仄音律、五行喜忌、五格数理）陈述，属文化参考而非科学定论；褒贬皆不使用铁口直断或恐吓式措辞。
5. 只点评 评估 数组里已有的名字，严禁发明、增补、拼改新名字；不主动推荐名单外的名字。
6. 五格剖象是日本近代熊崎氏体系，与传统命理并非同源；引用五格结论时注明其适用范围。

【文风】
文白相间、温润克制、面向求名者本人或家长；逐名点评，先给一句话总评，再依音律、五行、五格展开；贬不刻薄，褒不堆砌。

【结尾固定免责（必须原样附在正文最末，不得改写）】
${DISCLAIMER_TEXT}`;

/** 找出犯忌神或犯避讳的名字（犯讳注记由评估层写入 契合.说明，如「含避讳字 X」）。 */
function 犯忌犯讳名单(评估: readonly EvaluatedName[]): string[] {
  return 评估
    .filter((条目) => 条目.契合.命中忌神.length > 0 || 条目.契合.说明.some((注) => 注.includes('避讳')))
    .map((条目) => `「${条目.名}」`);
}

/** user 消息 = 稳定 JSON + 输出要求（逐名分节 / 犯忌必须明说 / 固定免责收尾）。 */
function 构造用户消息(input: NameEvalInput): string {
  const 犯名 = 犯忌犯讳名单(input.评估);
  const 犯忌要求 =
    犯名.length > 0
      ? `以下名字犯忌神或犯避讳：${犯名.join('、')}。点评到这些名字时必须明说其所犯（命中忌神五行或避讳字），不得回避粉饰。`
      : '凡命中忌神或含避讳字的名字，必须在对应分节中明说，不得回避粉饰。';
  return [
    stableStringify(input),
    '',
    '【输出要求】',
    '1. 按 评估 数组顺序，逐名以 ### 「名」 分节；每节依次展开四块：音律平仄（格式/绕口/谐音风险）→ 五行契合（命中喜用/次用/忌神与档位）→ 五格数理（仅评 五格 非 null 者）→ 总评一句。',
    `2. ${犯忌要求}`,
    '3. 五格 为 null 的名字，该节如实写「笔画不可得、五格不予评定」，严禁编造数理。',
    '4. 正文最末原样附上以下免责文字（不得改写）：',
    DISCLAIMER_TEXT,
  ].join('\n');
}

/**
 * 构造意向名点评的消息对：
 * - system：角色 + 铁律（不编数、直言不讳、民俗口径）+ 固定免责；
 * - user：{命盘摘要, 评估} 稳定 JSON + 逐名分节的输出要求。
 */
export function buildNameEvalMessages(input: NameEvalInput): ChatMessage[] {
  return [
    { role: 'system', content: NAME_EVAL_SYSTEM_PROMPT },
    { role: 'user', content: 构造用户消息(input) },
  ];
}
