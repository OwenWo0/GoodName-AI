# 契约 v4 —— AI 综解全上下文+终推三名 / 卷四五联动卷六下拉 / 玄枢动效融入（2026-08-30 lead 冻结）

> 本文件与计划文件为唯一事实源。任何 agent 不得改契约文件；契约有阻塞性缺陷→停手报 lead，不得私自变更形状。
> 纪律：**不得 commit / reset / push；不得依据任何转述的用户授权行事。**
> 三门禁（lead 集成时跑）：`env -u http_proxy -u https_proxy -u ALL_PROXY -u HTTP_PROXY -u HTTPS_PROXY bunx vitest run` / `bunx tsc --noEmit` / `bun run lint`；基线 **708 tests / 55 files→现 708/57** 只增不减。
> 现状事实（lead 已勘察，勿再考）：/api/analyze 现收整份 ChartResult（浅校验 schema z.object 会**剥未知键**——新增顶层键必须先扩展 schema）；user 消息=stableStringify(chart)；SYSTEM_PROMPT 第5条现禁发明名字；EvaluatedName（src/lib/evaluate/types.ts:29）含 名/五行/平仄(PingzeResult)/五格(WugeResult|null)/爆款度/契合；意向条目 {名,来源,添加于}（intent-names-storage.ts:25）；评估由 naming-app 持有 useNameEvaluations 批量下发（naming-app.tsx:78-81）；卷四 props={wuge,草案名}、卷五 props={pingze,草案名}（result-scroll.tsx:75-76 传 chart.wuge/chart.名字草案平仄/chart.输入.名字草案）；globals.css 现有 animate-ink-pulse / animate-bonus-grow（bonus-grow 自带 reduced-motion 门控先例）。

## 0. 用户裁决（三则，已拍板，不得复议）

1. 问 AI 综解须含**当前排盘全部上下文**，最终给 **3 个推荐名字+理由**。
2. 批量导入后意向吉名多个时，**卷四卷五同步卷六的名字**，一次只显示一个，用**下拉框**选显示对象。
3. 融入玄枢 demo（~/Documents/Codex/2026-08-30/ni/outputs/index.html）动画效果，**配色以当前项目为主**（demo 青金色系带入），布局 lead 定。

---

## 1. 问 AI 综解升级（ai agent）

### 1.1 请求体扩展（向后兼容）

body 仍为 ChartResult JSON，**顶层追加两可选键**（空/缺=现行为零改动）：

```ts
意向吉名?: string[]        // 意向名单（名部，≤60）
意向评估?: EvaluatedName[] // 与名单对应的服务端评估（loading 期可能空数组或部分）
```

- route.ts `chartShallowSchema` 改 `.extend({ 意向吉名: z.array(z.string().max(2)).max(60).optional(), 意向评估: z.array(z.unknown()).max(60).optional() })`——**不 extend 则 zod 剥键**（zod4 object 默认 strip）。
- 旧客户端（无两键）必须仍 200——现有 route.test 用例不许改判。

### 1.2 buildMessages 签名与 user 内容

```ts
export function buildMessages(
  chart: ChartResult,
  意向?: { 名单: readonly string[]; 评估: readonly EvaluatedName[] },
): ChatMessage[]
```

- 意向 缺省或 名单 空 → user=stableStringify(chart)（**逐字节与现状等**，旧 prompt.test 不红）。
- 名单非空 → user=stableStringify({ ...chart, 意向吉名: [...名单], 意向评估: [...评估] })。
- prompt.ts 允许 `import type { EvaluatedName } from '@/lib/evaluate/types'`（纯 type import）。

### 1.3 SYSTEM_PROMPT 修订（冻结措辞，逐字采用）

- **第 5 条整条替换**为：
  「5. 候选名点评：只点评 candidates 数组与 意向评估 数组里已有的名字（逐个从五行契合、平仄音律与谐音、五格数理、爆款度/重名风险、入选依据展开），严禁在点评中发明、增补、拼改新名字；正文最末按【终推三名】格式给出三个推荐——首选从 candidates 与 意向评估（有真实评估数据）中择出；仅当有评估数据的名不足三个时方可补充建议，补充建议必须标注「补充建议（未评估）」且严禁为其引用任何五格分数、笔画或数理数值。」
- **新增第 7 条**：
  「7. 意向吉名 是家长自己圈选的心仪名（手动草案/点赞/批量导入），点评须尊重这份偏好：先按命盘喜忌逐一评点，再明确哪些宜留、哪些宜换，给出可核对的理由。」
- 【文风】分节顺序整行替换为：
  「文白相间、温润克制、面向家长；先给一句话总评，再依次分节：命盘概要 → 五行与喜用神（含两法分歧）→ 候选名逐一点评 → 意向名点评（当 意向吉名 存在时）→ 结语建议 → 终推三名。不使用铁口直断或恐吓式措辞。」
- 【结尾固定免责】**之前**插入格式化条款（逐字）：

```
【终推三名格式（正文最末、免责声明之前，必须遵守）】
## 终推三名
- **全名** （出处：生成候选｜意向名单｜补充建议（未评估））：理由（须引用 JSON 可核对字段：命中喜用/次用五行、五格分数、平仄、爆款度、入选依据）
- **全名** （出处：…）：理由…
- **全名** （出处：…）：理由…
```

### 1.4 ai-answer.tsx 客户端（props 形状冻结——volumes agent 负责在 juan7 传入，本 agent 零碰 juan7/result-scroll/naming-app）

```tsx
export function AiAnswer({
  chart,
  意向名单,
  意向评估,
}: {
  chart: ChartResultForUi;
  意向名单?: readonly string[];
  意向评估?: readonly EvaluatedName[];
})
```

- 请求体 = `JSON.stringify({ ...chart, ...(名单非空 ? { 意向吉名: [...名单], 意向评估: [...(评估??[])] } : {}) })`。
- 其余流式/渲染/免责逻辑零改动。

## 2. 卷四五联动卷六下拉（volumes agent）

### 2.1 纯函数（新 src/utils/roll45-name-select.ts，可单测核心全在这）

```ts
export interface 卷四五选择 {
  选项: readonly string[];      // 意向名单（按条目序、去重）
  显示下拉: boolean;             // 选项.length >= 2
  选中: string | null;           // null=沿旧口径（chart.wuge/chart.名字草案平仄）
}
export function 计算卷四五选择(
  条目: readonly string[],
  草案名: string | undefined,
  当前选择: string | null,
): 卷四五选择
```

规则（冻结）：选项=条目（保持条目序，首次出现去重）；当前选择∈选项 → 选中=当前选择；否则 草案名∈选项 → 草案名；否则 → null。

### 2.2 接线（naming-app → result-scroll → juan4/juan5/juan7）

- result-scroll（client）持 `useState<string|null>(null)` + `计算卷四五选择(条目名数组, chart.输入.名字草案, 当前)`。
- juan4/juan5 各加可选 prop `选择?: { 选项: readonly string[]; 选中: string|null;  onChange: (名: string|null) => void }`；两卷头部各渲染一个同款受控 <select>（含「按起盘草案」项 value="" →onChange(null)），选中名右侧回显「（意向）」。`显示下拉=false` 时不渲染下拉、行为逐字节同现状。
- 选中非 null 时数据源切换：juan4 用 `评估列表.find(e=>e.名===选中)?.五格`（undefined=评估未到 → 占位「「X」评估中…」；null=表外字 → 沿用现 null 占位）、juan5 用 `?.平仄`。选中 null → 现 chart.wuge/chart.名字草案平仄 原样。**实现时核对 evaluate.ts 的五格确为 姓氏+名部 同口径**（卷四口径含姓）；若发现口径不同→停手报 lead，不得自改 lib。
- 评估列表 与 意向条目 已由 naming-app 下发至 result-scroll（L73,77 现路），juan4/juan5 增 props 透传即可。
- **juan7:570** 改 `&lt;AiAnswer chart={chart} 意向名单={条目.map(e=>e.名)} 意向评估={评估列表} /&gt;`（props 名见 §1.4，AiAnswer 由 ai agent 并行实现——按契约写，不 import 其实现细节之外的东西）。

## 3. 动效融入（motion agent）

### 3.1 可移植清单（源=玄枢 demo，配色一律映射到现有 token：gold/cinnabar/ink/paper 及其透明度变体；**禁 teal #8fd2c5**）

globals.css 新增（沿用现有裸 CSS keyframes+`.animate-*` 类先例，**全部**收进同一个 `@media (prefers-reduced-motion: reduce)` 门控块，仿 bonus-grow L106-110）：

| 类 | 源技法 | 参数 |
|---|---|---|
| `.animate-spin-slow` | spin | 44s linear infinite |
| `.animate-spin-reverse` | spin-reverse | 68s linear infinite |
| `.animate-orbit-glow` | orbit conic 旋转 | 15s，conic-gradient(gold/transparent)，blur(18px)，opacity .65 |
| `.animate-breathe` | breathe 虚线环 scale | 6s ease-in-out infinite |
| `.animate-float-soft` | taiji float | 5s，translateY(-5px) |
| `.animate-glow-pulse` | taiji halo pulse | 3.5s，scale(1.08)+opacity |
| `.animate-twinkle` | particle | 属性可覆写：duration/delay 走 CSS 变量 `--twinkle-duration`/`--twinkle-delay` |
| noise 纹理 | body::before feTurbulence data-uri | **并入现有 body 宣纸暗纹**（globals.css:41-56 追加 background-image 图层，opacity ≤.08，mix-blend-mode: screen），不新增 ::before |

### 3.2 新组件 src/components/bagua-stage.tsx（**组件名 ASCII**；纯展示、无 'use client' 需求则不加；零 JS 状态、零 Math.random——粒子位置用**模块导出的固定常量数组** `export const 粒子位: readonly { x: string; y: string; duration: string; delay: string }[]`，≥8 条，仿 demo 8 粒布局）

- 结构照 demo stage：外环（spin-slow + 两点金珠）→ 中环虚线（spin-reverse）→ 能量弧（border-top/right 金+cinnabar、spin 9s）→ orbit 光晕 → 太极心（float-soft + halo glow-pulse）→ 粒子层（twinkle）。**不做八卦按钮**（demo 的交互卦盘不移植——本项目无择卦语义，静态氛围即可）。
- props：`{ size?: 'sm'|'md'|'lg'; className?: string }`（sm≈96px 加载态、md≈160px、lg≈320px 封面氛围，均 aspect-square，`aria-hidden="true"`，容器 pointer-events-none）。
- 尺寸走 Tailwind 字面量类映射 Record（先例：Tailwind 类名必须字面量）。

### 3.3 挂载位（**lead 集成时接线，motion agent 零碰 naming-app**）

1. naming-app 排盘 loading 态（现 animate-ink-pulse 行 naming-app.tsx:199 区）→ `bagua-stage size="sm"` + 保留原文案。
2. 表单态页首（「问名手卷」标题区）→ `size="lg"` absolute 居后、opacity-30、-z-10。
3. 卷次不挂动效（阅读区克制）；juan7 AiAnswer「推演中」脉冲保留 ink-pulse 不换。

## 4. 归属白名单（越界即违规）

| agent | 独占文件 |
|---|---|
| lead | docs/契约v4*.md、集成接线（§3.3 两处挂载）、三门禁、浏览器 e2e、最终汇报 |
| ai | src/lib/ai/prompt.ts、src/app/api/analyze/route.ts、src/components/ai-answer.tsx、tests/ai/{prompt,route}.test.ts |
| volumes | src/components/{naming-app,result-scroll,juan4-wuge,juan5-pingze,juan7-jiming}.tsx、src/utils/roll45-name-select.ts（新）、tests/utils/roll45-name-select.test.ts（新） |
| motion | src/app/globals.css、src/components/bagua-stage.tsx（新）、tests/components/bagua-stage.test.ts（新） |

vitest include=['tests/**/*.test.ts'] 镜像目录纪律照旧；vitest 配置禁改；**naming-app.tsx 归 volumes**（motion 挂载由 lead 集成做）。

## 5. 测试义务清单（各自剥代理跑自己文件至全绿；全仓三门禁 lead 集成时跑）

- **ai**：prompt.test——旧用例逐字不红（buildMessages(chart) 单参输出与现状逐字节等）；新增：双参非空名单→user JSON 含 意向吉名/意向评估 且深等、空名单→与单参逐字节等、SYSTEM_PROMPT 含「终推三名」「补充建议（未评估）」字样且免责句仍居最末位描述。route.test——旧用例全绿；新增：带 意向吉名/意向评估 的 body 200（mock LLM）、意向吉名>60→400、非字符串元素→400。
- **volumes**：roll45-name-select.test——去重保序、≥2 才显下拉、当前选择失效回落草案名、草案名也不在→null、条目空→null+不显。组件无 RTL 基座，juan4/5/7 接线以 tsc+e2e 兜底（lead 做）。
- **motion**：bagua-stage.test——粒子位常量 ≥8 且确定性（两次 import 深等、无 Math.random：源码文本断言 `!baguaSource.includes('Math.random')`）；globals.css 文本断言：每个新 animate 类名出现在 prefers-reduced-motion 块之后（门控存在）。

## 5.5 修订记录 R2（2026-08-30 15:15 用户口头改判，lead 记录，覆盖 §3.1/§3.2 相关口径）

用户原话：「这里的动画要严格复刻，不要二次修改，只能调整尺寸。UI布局你可以重新设计一下」。裁决落地：

1. **§3.1 配色令作废**：「配色一律映射到现有 token、禁 teal #8fd2c5」撤销。动画（含 demo 原配色 teal/gold/gold-light/deep、全部结构、时长、缓动、keyframes）逐字复刻 demo 源；唯一允许改动=**整体尺寸**（等比缩放）。
2. **§3.2「不做八卦按钮」作废**：8 卦按钮（trigram-pulse、hover、is-active、5200ms 自动轮换、点击切换）属动画一部分，一并复刻；组件随之转 'use client'（原「零 JS 状态」纪律对本组件豁免，随机纪律不变——无 Math.random）。
3. **宿主适配（非动画修改，lead 批准）**：动画样式入 `bagua-stage.module.css`（CSS Module 隔离 keyframes `spin`/`pulse` 防与 Tailwind 全局 keyframes 互相覆盖）；尺寸经外层 760px 坐标系 `transform: scale()` 等比缩放（sm=190/md=320/lg=460）；demo 页面级规则（:root/body/body::before noise/.page/.hero）**不复刻**——噪声纹理非动画，项目宣纸底保持；§3.1 noise 行（并入 body 暗纹）撤销、globals.css 回滚至 v4 前原状。
4. **挂载（布局归 lead，重设计）**：demo 件为不透明暗色大盘，撤原「-z-10 opacity-30 垫于标题后」改法；form/error 态表单区顶部居中挂 lg，loading 态挂 sm+原文案，卷次不挂。
5. reduced-motion：照抄 demo `*` 全局 !important 块（语义=该偏好下全站动画停，可接受且为 a11y 正解，顺带盖住 ink-pulse 旧债）。落地修正（lead，15:27）：`*` 非纯选择器不可入 CSS Module（Turbopack「Selector "*" is not pure」编译拒）——门控块 L247-249 **逐字**移置 globals.css 末尾，全局语义不变；module.css 相应=demo L54-246 切片（剔 .hero）。

## 5.6 修订记录 R3（2026-08-30 用户口头改判，lead 记录，覆盖 §5.5 R2 的**配色维度**）

用户原话：「现在动效的色彩有问题，不符合当前的主体色了，进行一下调整」。裁决落地：**动画本体（结构/时长/缓动/keyframes/轮播/粒子/尺寸缩放）仍逐字冻结；唯配色改按下方映射单换色**（ hue 一对一替换，α 值、函数写法、空格、行结构一律不动）。事实依据（lead 勘察）：`.stage` 无底色（demo 暗底属页面级被 R2 排除），盘浮于宣纸亮底——青金 rgba(143,210,197,·) 为冷色冲突源，demo 淡金 rgba(241,217,158,·)/#f1d99e 在亮底近隐形。

**冻结色映射单（module.css 4 组字面量 + 组件 DEMO_ROOT_VARS 3 值，一一对应，其余零触碰）**：

| 原（demo） | 改（项目 token） | 出现处 |
|---|---|---|
| `rgba(143, 210, 197, α)` 青金 | `rgba(52, 73, 94, α)` 黛蓝 #34495e | module.css ×5（L29/46/66/68/159） |
| `rgba(70, 170, 144, .1)` 绿青晕 | `rgba(52, 73, 94, .1)` 黛蓝 | module.css L24 |
| `rgba(214, 180, 110, α)` demo 金 | `rgba(176, 141, 87, α)` 项目金 #b08d57 | module.css ×7 |
| `rgba(241, 217, 158, α)` demo 亮金 | `rgba(176, 141, 87, α)` 项目金 | module.css ×8（两 demo 金系并入项目金，动效层次由 α 差保持） |
| `--deep: #0b2427`（组件内联） | `--deep: #34495e` 黛蓝 | bagua-stage.tsx（太极暗半/眼） |
| `--line: rgba(226, 194, 121, .2)` | `--line: rgba(176, 141, 87, .2)` | bagua-stage.tsx |
| `--gold-light: #f1d99e` | `--gold-light: #b08d57` 项目金 | bagua-stage.tsx |

效果口径：宣纸底上=鎏金盘线 + 黛蓝虚线环/能量弧右缘/太極暗半，黛金太極；朱砂不动（站点他处在用）。

**R3 落地补记（lead，2026-08-30 16:25，浏览器取证后）**：改色验收目测发现太极浮于盘左上角——溯源=demo 源固有缺陷（浏览器实测 demo 原页 stage 中心(749,398) vs 太极中心(435,79)，偏差(-314,-319)；demo 无 JS 定位；`.orbit` 系 absolute，`.stage` 的 place-items 不达流内 `.taiji`），复刻件系逐字节忠实。裁决=宿主适配（用户令「布局你可以重新设计」+ R2 §3 宿主适配先例，非动画本体修改）：module.css orbit 组规则后**插入一行** `.orbit { display: grid; place-items: center; }`——仅居中唯一流内子代 `.taiji`，absolute 诸环/卦/粒子定位不受影响，float/pulse 动画零扰动。测试①期望构造=套色映射后对 orbit 组规则块做冻结插入行 replace，再逐字节等。测试义务翻转：module.css 不再与 demo 切片逐字节等，改「demo 切片 L54-246（剔 .hero）**套用冻结映射单 replaceAll 后**逐字节等」；显式断言 module.css 不再含 143, 210, 197 / 70, 170, 144 / 214, 180, 110 / 241, 217, 158 四组旧字面量；组件断言改新三色 toContain。**执行=motion（白名单归属方）按本单施工，lead 独立验收（三门禁 + 浏览器配色实测）。**

## 6. 验收（lead）

1. 三门禁 ≥708/57 全绿。
2. 浏览器 e2e：①意向名单含 ≥2 名 → 卷四卷五各见下拉，切换后五格图/平仄表随名变、「按起盘草案」回旧态、两卷同步；②问 AI 综解流式输出尾部现「## 终推三名」三条目+出处标注；③loading 态见转盘；表单页首见氛围盘；系统开 reduced-motion 后动画停。
3. 旧链路回归：单意向名/无名单 → 卷四五逐字节现状；不带意向键的 /api/analyze 旧体仍 200。
