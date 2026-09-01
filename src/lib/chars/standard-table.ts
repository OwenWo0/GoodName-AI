/**
 * 《通用规范汉字表》校验（M2 模块D，硬性落户约束）。
 *
 * 纯函数层：flattenStandardCharSet / checkStandard 零 IO，字集可注入（供 pool 复用与单测）。
 * checkStandardTable 为薄封装：未注入字集时动态加载 src/data/standard-chars.json——
 * 该文件由 M1 数据层并行产出，缺失时抛出明确的「字表未就绪」错误（vitest 下动态 import
 * 为运行期解析，文件到位后无需改码即自然生效；生产环境建议上层静态 import 后注入）。
 */
import type { PingzeResult } from '@/lib/types';

/** standard-chars.json 的三层结构（国发〔2013〕23 号：一级 8105 / 二级 3000 / 三级 1000）。 */
export interface StandardTableJson {
  readonly 一级: readonly string[];
  readonly 二级: readonly string[];
  readonly 三级: readonly string[];
}

/** 三层字表展平为查询集。 */
export function flattenStandardCharSet(table: StandardTableJson): Set<string> {
  return new Set([...table.一级, ...table.二级, ...table.三级]);
}

/**
 * 校验字符串逐字是否均在字表内（纯函数，字集注入）。
 * @param chars 待校验字符串（逐字拆分，支持增补平面字符）
 * @param charSet 展平字集
 */
export function checkStandard(chars: string, charSet: Set<string>): PingzeResult['字表校验'] {
  const 表外字: string[] = [];
  for (const ch of new Set([...chars])) {
    if (!charSet.has(ch)) {
      表外字.push(ch);
    }
  }
  return { 全部在通用规范汉字表: 表外字.length === 0, 表外字 };
}

/** 动态加载标准字表 JSON；文件缺失/格式异常时抛出可辨识错误。 */
export async function loadStandardCharSet(): Promise<Set<string>> {
  // 非字面量 specifier：文件暂不存在也不阻塞 tsc/vite 构建，仅运行期报错
  const spec = '../../data/standard-chars.json';
  let mod: unknown;
  try {
    mod = await import(/* @vite-ignore */ spec);
  } catch {
    try {
      mod = await import(/* @vite-ignore */ spec, { with: { type: 'json' } });
    } catch {
      throw new Error(
        '字表未就绪：缺少 src/data/standard-chars.json（M1 数据层产出后本模块自动可用）',
      );
    }
  }
  const table = ((mod as { default?: unknown }).default ?? mod) as StandardTableJson;
  if (!Array.isArray(table.一级) || !Array.isArray(table.二级) || !Array.isArray(table.三级)) {
    throw new Error('字表格式异常：standard-chars.json 需含 一级/二级/三级 三个数组字段');
  }
  return flattenStandardCharSet(table);
}

/**
 * 姓名逐字校验《通用规范汉字表》。
 * @param name 待校验姓名（含姓）
 * @param charSet 可选注入字集（pool 应加载一次后注入，避免重复 IO）
 */
export async function checkStandardTable(
  name: string,
  charSet?: Set<string>,
): Promise<PingzeResult['字表校验']> {
  const set = charSet ?? (await loadStandardCharSet());
  return checkStandard(name, set);
}
