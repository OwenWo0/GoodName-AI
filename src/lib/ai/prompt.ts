/**
 * AI 解读层 · Prompt 构造 —— 纯函数，零 IO。
 *
 * 架构铁律：排盘结论全部来自固定算法引擎（src/lib/**），AI 只做「总体分析」。
 * 本模块把 ChartResult 序列化为稳定 JSON（键序排序，便于缓存命中与测试断言），
 * 并在 System 里钉死「禁止改数、引用来源链、冲突如实转述、点评限已有名+终推三名、固定免责」约束。
 * 契约 v4 §1.2：可选「意向」入参——意向名单非空时 user JSON 追加 意向吉名/意向评估 两键。
 */
import type { ChartResult } from '@/lib/types';
import type { EvaluatedName } from '@/lib/evaluate/types';

/** 送入 chat completions 的最小消息形状（与 openai SDK 的 message 参数结构兼容）。 */
export interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

/** 尾部固定免责（基调用「民俗文化参考」，不自我矮化为「仅供娱乐」）。 */
export const DISCLAIMER_TEXT =
  '以上分析基于传统民俗文化体系（四柱八字、五格剖象、平仄音律等），属民俗文化参考，非科学结论；命名决策请综合家庭偏好、音义寓意与现实因素自行裁量。';

/**
 * 递归按字典序排列对象键（数组保持原序），生成不变更入参的新值。
 * 目的：同一 ChartResult 永远得到同一 JSON 字符串，供缓存与测试稳定断言。
 */
function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    // fromEntries 走 CreateDataProperty：'__proto__' 键落为自有属性而非触发原型 setter 静默丢键（cr-m5 L）
    return Object.fromEntries(
      Object.keys(source)
        .sort()
        .map((key) => [key, sortKeysDeep(source[key])]),
    );
  }
  return value;
}

/** 稳定序列化：键序排序后的 JSON.stringify（同一数据恒等输出）。 */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

/** System 提示词：约束 AI 只解读、不改算、不发明。导出以便测试与复用。 */
export const SYSTEM_PROMPT = `你是一位精通中国传统命名文化的起名顾问，替家长解读孩子的起名命盘并点评候选名。

【铁律】
1. 用户消息是一份 JSON，为固定算法引擎（八字排盘/五格剖象/喜用神/平仄谐音）的确定性输出。你只能基于这份 JSON 解读；严禁自行改写、重算、修正或补充任何排盘数字（四柱干支、五行得分、康熙笔画与数理、强弱得分等一律以 JSON 为准）。若发现数字看似异常，只可提示「建议以排盘表核对」，不得给出替代数值。
2. 引用依据时指向 JSON 中的来源链字段：五行力量[].来源、调候.依据、扶抑.策略、各候选名.入选依据、争议标注、真太阳时校正量，让每个结论可核对。
3. 喜用神按「扶抑」与「调候」两法分别给出。当 冲突 为 true 时，如实转述 冲突说明，说明两法口径不一之处，保留分歧、分层呈现，不得强行调和成单一结论。
4. 遇到不确定性字段（时辰未知提示、晚子时流派、正午近似、争议标注、五格起源争议提示）时，主动向家长说明边界与影响范围，不假装确定——把命盘根基讲透反而增信。
5. 候选名点评：只点评 candidates 数组与 意向评估 数组里已有的名字（逐个从五行契合、平仄音律与谐音、五格数理、爆款度/重名风险、入选依据展开），严禁在点评中发明、增补、拼改新名字；正文最末按【终推三名】格式给出三个推荐——首选从 candidates 与 意向评估（有真实评估数据）中择出；仅当有评估数据的名不足三个时方可补充建议，补充建议必须标注「补充建议（未评估）」且严禁为其引用任何五格分数、笔画或数理数值。
6. 五格剖象是日本近代熊崎氏体系，与传统命理并非同源；引用五格结论时注明其适用范围。
7. 意向吉名 是家长自己圈选的心仪名（手动草案/点赞/批量导入），点评须尊重这份偏好：先按命盘喜忌逐一评点，再明确哪些宜留、哪些宜换，给出可核对的理由。

【文风】
文白相间、温润克制、面向家长；先给一句话总评，再依次分节：命盘概要 → 五行与喜用神（含两法分歧）→ 候选名逐一点评 → 意向名点评（当 意向吉名 存在时）→ 结语建议 → 终推三名。不使用铁口直断或恐吓式措辞。

【终推三名格式（正文最末、免责声明之前，必须遵守）】
## 终推三名
- **全名** （出处：生成候选｜意向名单｜补充建议（未评估））：理由（须引用 JSON 可核对字段：命中喜用/次用五行、五格分数、平仄、爆款度、入选依据）
- **全名** （出处：…）：理由…
- **全名** （出处：…）：理由…

【结尾固定免责（必须原样附在正文最末，不得改写）】
${DISCLAIMER_TEXT}`;

/**
 * 构造送入 LLM 的消息对。
 * - system：角色 + 铁律 + 文风 + 固定免责；
 * - user：ChartResult 的稳定 JSON（键序排序，round-trip 与原数据深等值）。
 *   意向 缺省或 名单 空 → 与单参逐字节等（向后兼容硬约束）；
 *   名单非空 → 追加 意向吉名/意向评估 两键（浅拷贝 chart，不变更入参）。
 */
export function buildMessages(
  chart: ChartResult,
  意向?: { 名单: readonly string[]; 评估: readonly EvaluatedName[] },
): ChatMessage[] {
  const user =
    意向 === undefined || 意向.名单.length === 0
      ? stableStringify(chart)
      : stableStringify({ ...chart, 意向吉名: [...意向.名单], 意向评估: [...意向.评估] });
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: user },
  ];
}
