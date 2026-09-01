/**
 * 语义安全与去词汇化过滤模块
 * 黑名单为本仓库依民俗取名常识与互联网非人名词汇独立整理
 */

/** 负面字库：疾病、贫穷、灾祸、凶煞等不宜入名字 */
export const NEGATIVE_CHARS: ReadonlySet<string> = new Set([
  '病', '痛', '贫', '穷', '丧', '死', '鬼', '凶', '恶', '丑',
  '残', '废', '毒', '赌', '骗', '贱', '祸', '灾', '盗', '贼',
  '衰', '苦', '奴', '乞', '毙', '哀', '疯', '傻', '蠢',
]);

/** 占位式与明显风险名组合 */
export const HARD_RISK_NAMES: ReadonlySet<string> = new Set([
  '赵钱孙',
  '钱孙',
  '待删',
  '删除',
  '无名',
  '匿名',
  '测试',
  '占位',
]);

/**
 * 非人名词汇库：工业原料、财经法务术语、企业后缀等误入候选池的现代词
 */
export const NON_NAME_WORDS: ReadonlySet<string> = new Set([
  '水泥',
  '塑料',
  '发票',
  '合同',
  '项目',
  '系统',
  '软件',
  '芯片',
  '电池',
  '资本',
  '管理',
  '投资',
  '证券',
  '控股',
  '集团',
  '科技',
  '发展',
  '实业',
]);

/** 不宜作为人名单字的化学元素/工业概念字 */
export const NON_NAME_CHARS: ReadonlySet<string> = new Set([
  '氯', '钛', '氨', '钠', '铀',
]);

/** 过于陈旧俗套的名字（适度降权） */
export const CLICHE_NAMES: ReadonlySet<string> = new Set([
  '建国', '建军', '建华', '建民', '建平', '国庆', '国强', '伟强', '志强', '富贵', '发财', '发达', '旺财',
]);

export interface SemanticResult {
  readonly score: number; // 0 ~ 30 分
  readonly isSafe: boolean;
  readonly isCliche: boolean;
  readonly issues: readonly string[];
}

/**
 * 评估名字的语义安全性与去词汇化合规度
 */
export function evaluateSemanticSafety(fullName: string, name: string): SemanticResult {
  const issues: string[] = [];
  let score = 30;
  let isCliche = false;

  // 1. 检查明显占位符或风险名
  if (HARD_RISK_NAMES.has(fullName) || HARD_RISK_NAMES.has(name)) {
    issues.push('命中明显风险名或占位式测试字符');
    score = 0;
  }

  // 2. 检查非人名概念词汇（产品名、企业概念词）
  if (NON_NAME_WORDS.has(name)) {
    issues.push(`「${name}」更偏向产品名、企业概念词或现代词语，缺乏人名自然感`);
    score = Math.min(score, 5);
  }

  // 3. 检查单字是否含负面字或工业/概念偏字
  for (const ch of name) {
    if (NEGATIVE_CHARS.has(ch)) {
      issues.push(`含贬义负面字「${ch}」`);
      score = 0;
    }
    if (NON_NAME_CHARS.has(ch)) {
      issues.push(`含非传统人名用字「${ch}」`);
      score = Math.min(score, 12);
    }
  }

  // 4. 检查是否为俗套名
  if (CLICHE_NAMES.has(name)) {
    issues.push(`「${name}」属于年代感较强或过于通俗的组合，重名率较高`);
    isCliche = true;
    score -= 10;
  }

  const finalScore = Math.max(0, Math.min(30, score));

  return {
    score: finalScore,
    isSafe: finalScore >= 20 && issues.length === 0,
    isCliche,
    issues,
  };
}
