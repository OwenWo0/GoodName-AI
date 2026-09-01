/**
 * 构建期数据提取：shunshi-kangxi-core chars.json.gz → src/data/kangxi-chars.json
 *
 * 为什么：Workers/workerd 无 fs。包 store.js 运行时 readFileSync+gunzipSync 懒加载磁盘
 * gz（且 charDetail 路径还会拖 3MB kangxi-text），workerd 下 [unenv] fs.readFileSync
 * is not implemented yet! → 排盘/评估/名人匹配全 500。
 * src/lib/wuge/kangxi.ts 只消费 charDetail 的 繁体/康熙笔画 两字段，故此处把
 * chars+alias 原样提取、tradIndex 预计算成静态 JSON，Workers bundle 直接 import。
 *
 * tradIndex 算法逐字镜像 dist/lib/store.js tradIndex()：
 *  - 仅收「简→繁对 康熙笔画一致」的对（~143 对笔画不等的简繁本是不同字，日系口径才折叠，此处不折）；
 *  - 同繁多简时表序首个胜出（Object.entries 插入序 → JSON 序列化/解析保序，确定性一致）。
 *
 * 行为保险：tests/wuge/kangxi-data-parity.test.ts 在 node 下与包 charDetail 全表对拍；
 * 升级 shunshi-kangxi-core 后该测试变红 = 数据漂移，重跑 `bun run gen:kangxi-data` 再生成。
 *
 * 用法：bun scripts/extract-kangxi-data.ts
 */
import { gunzipSync } from 'node:zlib';
import { readFileSync, writeFileSync, statSync } from 'node:fs';

interface 条目 {
  bs: number;
  kx: number;
  py: string;
  rad: string;
  src: string;
  ts: number;
  wx: string | null;
  t?: string;
}

const 源文件 = 'node_modules/shunshi-kangxi-core/data/chars.json.gz';
const 目标文件 = 'src/data/kangxi-chars.json';

const raw = JSON.parse(gunzipSync(readFileSync(源文件)).toString('utf8')) as {
  chars: Record<string, 条目>;
  alias: Record<string, string>;
};

// —— tradIndex：逐字镜像包 store.js tradIndex()（含 mirror 笔画一致判据与表序优先）——
const tradIndex: Record<string, string> = {};
for (const [k, e] of Object.entries(raw.chars)) {
  const t = e.t;
  if (!t || t === k || t in tradIndex) continue;
  const mirror = raw.chars[t];
  if (mirror !== undefined && mirror.kx !== e.kx) continue;
  tradIndex[t] = k;
}

writeFileSync(目标文件, JSON.stringify({ chars: raw.chars, alias: raw.alias, tradIndex }));

const kb = (f: string) => Math.round(statSync(f).size / 1024);
console.log(
  `已写 ${目标文件}：chars=${Object.keys(raw.chars).length} alias=${Object.keys(raw.alias).length} tradIndex=${Object.keys(tradIndex).length} 体积=${kb(目标文件)}KB（源 gz=${kb(源文件)}KB）`,
);
