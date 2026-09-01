/**
 * kangxi-chars.json 的 ambient 类型声明（精确模块名短路文件解析）。
 *
 * 为什么：该文件 1.6MB / 2 万+ 键，resolveJsonModule 会让 tsc 对字面量做全量结构推断，
 * `bunx tsc --noEmit` 直接挂死（>300s）。此精确 ambient 声明优先于文件解析，
 * tsc 不再读该 JSON；webpack/turbopack 打包不受 TS 影响，照常内联真实 JSON。
 *
 * 形状变更时同步本文件 + scripts/extract-kangxi-data.ts（提取格式的唯一真相源）。
 */
declare module '@/data/kangxi-chars.json' {
  interface 字形条目 {
    readonly bs: number;
    readonly kx: number;
    readonly py: string;
    readonly rad: string;
    readonly src: string;
    readonly ts: number;
    readonly wx: string | null;
    readonly t?: string;
  }
  const data: {
    readonly chars: Readonly<Record<string, 字形条目>>;
    readonly alias: Readonly<Record<string, string>>;
    readonly tradIndex: Readonly<Record<string, string>>;
  };
  export default data;
}
