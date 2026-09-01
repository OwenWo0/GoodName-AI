/**
 * 批量导入意向吉名的文本解析（契约 v2.1）——纯函数，零 React、零副作用。
 *
 * 分隔口径：顿号 / 全半角逗号 / 任意空白（含 \r\n、U+3000 全角空格）切「名」。
 * 有效判定引用 intent-names-storage 的 HAN_NAME_PATTERN（单一来源）：
 * 1-2 个 CJK 基本区汉字；**>2 汉字整项判非法**——注意这与 lib/hanzi 的
 * splitHanChars「按字拆分」语义相反：导入以分隔符切「名」，用户写「欧阳修」
 * 是要导入一个三字名，不是拆成「欧」「阳」「修」三个意向，宁可退回让用户改。
 * 批内去重保序；本 util 不做 60 上限截断（容量策略属存储层 addIntentEntries）。
 */
import { HAN_NAME_PATTERN } from '@/utils/intent-names-storage';

/** 三类分流（各桶桶内去重保序；非法项保留原始文本供 UI 朱字回显定位）。 */
export interface 导入解析结果 {
  有效名: string[];
  已在名单: string[];
  非法项: string[];
}

/**
 * 解析粘贴文本 → 有效/已在/非法 三桶。
 * @param 已有 现意向名单名集合（给定时有效名分流至已在名单；缺省不分流）。
 */
export function parseIntentImport(raw: string, 已有?: ReadonlySet<string>): 导入解析结果 {
  const 有效名: string[] = [];
  const 已在名单: string[] = [];
  const 非法项: string[] = [];
  const 见过 = new Set<string>();
  for (const 项 of raw.split(/[、，,\s]+/u)) {
    if (项 === '') continue;
    if (见过.has(项)) continue; // 批内去重：三桶共用一个「见过」，一个项只落一桶一次
    见过.add(项);
    if (!HAN_NAME_PATTERN.test(项)) {
      非法项.push(项);
    } else if (已有?.has(项)) {
      已在名单.push(项);
    } else {
      有效名.push(项);
    }
  }
  return { 有效名, 已在名单, 非法项 };
}
