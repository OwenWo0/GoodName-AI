// @opennextjs/cloudflare 编译配置（CLI v1.20+ 必需文件）。
// 本仓无 ISR / on-demand revalidation：静态页在 build 时预渲染进 Assets，
// API 全动态——默认 dummy incremental cache 即可，无需 R2/KV 绑定。
// 将来若引入 ISR，再按需换 r2IncrementalCache + tagCache/queue 配套。
import { defineCloudflareConfig } from '@opennextjs/cloudflare';

export default defineCloudflareConfig({});
