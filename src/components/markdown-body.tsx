'use client';

/**
 * AI 综解正文的流式 Markdown 渲染器（任务 #27）。
 *
 * 选型注记：用户口中的「markstream」是 Vue 专属包 markstream-vue，本项目为
 * React，等价替代即 Vercel 的 streamdown（peer 支持 react 18/19）。
 *
 * 安全默认：流式 MD → hast → JSX 运行时（不经 dangerouslySetInnerHTML），
 * 内置 rehype-harden + rehype-sanitize 净化，故 raw HTML 默认不渲染、外链走
 * linkSafety 确认弹窗；html/allowedTags 等放开选项一律不开。
 *
 * 样式接线（README 要求，Tailwind 4）：globals.css 加 @source 扫描其预编译
 * 类，并在 @theme 把其 shadcn 风格语义色令牌映射到古风板；
 * 标题/加粗/列表/代码块等版面覆写在 globals.css 的 .md-body 段。
 * 流式中 mode="streaming"（未闭合语法由 remend 补全、块级 memo 防倒退闪烁），
 * done 后切 mode="static" 走纯静态渲染；reasoning 推演区不走本组件。
 * 本模块仅经 markdown-body-async 的动态 import 抵达（体积门禁：静态引入会使
 * / 路由 First Load +146 kB），default export 供 next/dynamic 装载。
 */
import { Streamdown } from 'streamdown';

export default function MarkdownBody({ text, streaming }: { text: string; streaming: boolean }) {
  return (
    <Streamdown
      className="md-body overflow-x-auto" /* overflow-x-auto：README 接线要求，宽表格窄屏不溢出容器 */
      mode={streaming ? 'streaming' : 'static'}
      isAnimating={streaming}
      controls={false} /* 关闭代码/表格复制下载按钮：正文以叙事为主，古风版面从简 */
    >
      {text}
    </Streamdown>
  );
}
