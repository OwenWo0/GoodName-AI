<div align="center">

<img src="docs/assets/readme/bagua.svg" alt="八卦盘动画" width="360" />

# 问名手卷 · GoodName-AI

**给名字一场可查可驳的考据 —— 固定算法排盘 × 古风手卷 UI × AI 综合解读**

[![license: MIT](https://img.shields.io/badge/license-MIT-8B2E2E)](LICENSE)
![tests](https://img.shields.io/badge/tests-766%20passed-brightgreen)
![Next.js 15](https://img.shields.io/badge/Next.js-15-black)
![bun](https://img.shields.io/badge/bun-1.x-f9f1e1?logo=bun&logoColor=000)
![zero-LLM-in-chart](https://img.shields.io/badge/%E6%8E%92%E7%9B%98%E9%9B%B6%E5%A4%A7%E6%A8%A1%E5%9E%8B-%E7%BA%AF%E5%87%BD%E6%95%B0-yellowgreen)

</div>

![问名手卷首屏 · 八卦盘动画](docs/assets/readme/hero.png)

输入姓氏与出生信息，输出**一卷可翻检的手卷**：①八字排盘 ②五行 ③喜用神（扶抑×调候透明双轨）④五格 ⑤平仄谐音 ⑥意向吉名卷 ⑦可选的 AI 综合解读。

**铁律：命盘数字永远出自本地固定算法**——纯函数、零 IO、全单测、一步一校可查可驳；大模型只消费算法输出的结构化 JSON 做文案，绝不碰盘。

![排盘手卷结果页](docs/assets/readme/result.png)

## ✨ 为什么不一样

- **确定性候选池**：3500×3500 枚举 + 音韵/语义/黑名单逐层筛，同名同输入必得同结果（民俗口径也有据可查）。
- **喜用神双轨透明**：扶抑与调候分开呈现、各给权重，不糊成一团「吉/凶」。
- **真太阳时**：经度校正、夏令时窗口、晚子时流派分歧——边界情形如实标注松动，而非假装精确。
- **五大名库出处**：诗经/楚辞/论语/周易/唐诗宋词考据，禁止伪造古籍引文（契约级约束，单测锁死）。
- **AI 只做解读**：`/api/*` 限流 + Content-Type 守门 + 错误脱敏；意向名单只存本机 localStorage，不上传。

## 🚀 快速开始

工具链统一使用 [bun](https://bun.sh)（`bun.lock` 为唯一锁文件）：

```bash
bun install
cp .env.example .env      # 填入 OpenAI 兼容端点密钥（.env 已 gitignore，严禁提交）
bun run dev               # http://localhost:3000
```

```bash
bun run test              # vitest 全量单测（766 tests）
bun run test:coverage     # 覆盖率（目标 80%+）
bunx tsc --noEmit         # 类型检查
```

## 🗺️ 结构速览

- `src/lib/` 算法引擎：`solar/`真太阳时 `bazi/`八字 `wuge/`五格+康熙笔画 `xiyong/`喜用神 `phonology/`平仄谐音 `phonetics/`声韵 `semantics/`语义过滤 `corpora/`五大名库
- `src/data/` vendored 静态表（字表/81数理/三才/调候/谐音黑名单/爆款字/名人吉名）
- `src/app/api/` 后端路由（chart/names/ai/ai-naming，全局限流）
- `docs/` 尽调报告与《架构与实施计划》；`docs/research/06` 为竞品输出对标

## 🛡️ 部署（必读）

`/api/*` 限流（`src/middleware.ts`）按 **x-forwarded-for 首段** 归桶，而 XFF 首段是客户端自报值，
因此上线须满足其一，否则伪造 XFF 即可绕过限流烧 LLM 额度：

1. **置于归一化 XFF 的反代之后**（必须）：Caddy / Nginx 默认会剥离客户端自带 XFF 并覆盖式写入真实对端 IP；
   确认反代未被配置成「追加模式透传客户端首段」。
2. 多实例 / Serverless：进程内存限流不跨实例，须换共享存储（Redis）或网关层限流
   （`FixedWindowLimiter.check` 接口已保持最小面，替换实现调用方零改动）。
3. 部署期加固项（已排期）：请求 HMAC 签名（sec-m5 HIGH-1b），落地后限流退居第二道防线。

限流额度可经 `RATE_LIMIT_ANALYZE_PER_MIN`（默认 6）/ `RATE_LIMIT_API_PER_MIN`（默认 30）调整，非法值自动回默认。
⚠️ 生产构建勿用 turbopack 产物直接 `next start`（dataRoutes 缺失会崩），用 `bun run build:prod`。

## ⚖️ 开源与署名

代码以 [MIT](LICENSE) 发布。随仓库分发的第三方数据：

- `src/data/name-char-freq.json`：派生自 [wainshine/Chinese-Names-Corpus](https://github.com/wainshine/Chinese-Names-Corpus)（120W 华人姓名语料，Apache-2.0），
  署名与 pinned commit 记录于该文件 `_meta` 字段；派生方法亦在 `_meta.派生法` 中可复现。
- `src/data/standard-chars.json`：《通用规范汉字表》8105 字（国家公文，不受版权保护）。
- `src/data/tiaohou.json`：调候表经 Wikisource 古籍原文复核（古籍为公有领域）。
- 声韵学/语义过滤/评分模块的**设计思路**参考了 [YaoZeyuan/name-generator（好名有据）](https://github.com/YaoZeyuan/name-generator)
  公开的规则描述：本仓库为完全独立的 TypeScript 实现——代码自行编写，黑名单/定音表等数据皆依公开语言学常识
  与自身语料独立整理，未复制上游任何数据文件；致谢其产品设计启发。

---

<div align="center">

> 本站所呈现之八字、五格、喜用神、平仄诸说，皆为传统民俗文化之参考，非科学结论，
> 不构成婚配、取名、医疗或其他任何决策依据。名字之美，终在人心所寄。

</div>
