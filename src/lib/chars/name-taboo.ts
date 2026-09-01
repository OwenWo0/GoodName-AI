/**
 * 内置「不宜入名字」黑名单（产品级底线，非用户约束）。
 *
 * 根因留档：常用级=《通用规范汉字表》识字层级（僻/厉/叹/噩 皆为一级 literacy 常用字），
 * **不是**名字使用频率；v1 无名字字频数据（pool-builder 交接明示「字频 vendor 归 v2」），
 * 故以否决式黑名单拦「确定坏」字，审美争议字不收（宁缺毋滥，见 name-taboo.json _meta.口径）。
 *
 * 作用域：仅候选池自动海选（pool.ts 初筛剔除）；名字草案照常评估、辈字（用户强制约束）让位于黑名单之外。
 */
import tabooJson from '@/data/name-taboo.json';

interface TabooCategory {
  readonly 类: string;
  readonly 字: string;
}

const categories = tabooJson.categories as readonly TabooCategory[];

/** 黑名单字集（模块加载时一次性展平；构建期即完成，无运行期 IO）。 */
export const NAME_TABOO: ReadonlySet<string> = new Set(
  categories.flatMap((c) => [...c.字]),
);

/** 字 → 类别（供调试/依据文案；跨类重复归首个类别）。 */
export const NAME_TABOO_类别: ReadonlyMap<string, string> = new Map(
  categories.flatMap((c) => [...c.字].map((ch) => [ch, c.类] as const)),
);
