/**
 * /api/* 限流中间件（sec-m5 HIGH-1a：/api/analyze 无鉴权 LLM 端点，须防白嫖刷量）。
 *
 * 口径：固定窗口、进程内存、按客户端 IP；analyze 端点消耗真金白银的 LLM token，
 * 限额独立收紧（默认 6 次/分），其余 API 默认 30 次/分。部署在多实例/Serverless 前
 * 须换共享存储或网关限流——见 src/lib/http/rate-limit.ts 头注释。
 * IP 优先取 cf-connecting-ip（Cloudflare 边缘强制写入、客户端伪造不了）；
 * 无该头时退回 x-forwarded-for 首段；直连两者皆无时归 'unknown' 共享额度（本地开发形态）。
 * ⚠️ XFF 首段是客户端自报值：仅当置于会剥离自带 XFF、覆盖式写首段的可信反代
 * （Caddy/Nginx/Cloudflare Workers 边缘）之后时本口径才成立；裸直连部署下伪造 XFF 可逐请求换桶绕过
 * 限流（cr-m5 复评 MEDIUM——经 Cloudflare 部署后由 cf-connecting-ip 优先口径闭合）。部署前提见 README「部署（必读）」。
 */
import { NextResponse, type NextRequest } from 'next/server';
import { FixedWindowLimiter } from '@/lib/http/rate-limit';

/** env 限额解析：手误（NaN/非正数）回默认值，防 fail-open 静默不限流（cr-m5 复评 LOW）。export 供单测直用。 */
export function 正整数限额(原始值: string | undefined, 默认值: number): number {
  const n = Number(原始值);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 默认值;
}

/** 客户端 IP 提取：cf-connecting-ip（可信边缘写入）> x-forwarded-for 首段 > 'unknown'。export 供单测直用。 */
export function 客户端IP(头: Pick<Request, 'headers'>['headers']): string {
  const cf = 头.get('cf-connecting-ip')?.trim();
  if (cf) return cf;
  return 头.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

const 每分钟 = 60_000;
const 分析限流 = new FixedWindowLimiter(每分钟);
const 通用限流 = new FixedWindowLimiter(每分钟);
const 分析限额 = 正整数限额(process.env.RATE_LIMIT_ANALYZE_PER_MIN, 6);
const 通用限额 = 正整数限额(process.env.RATE_LIMIT_API_PER_MIN, 30);

export function middleware(req: NextRequest): NextResponse {
  const 是分析 = req.nextUrl.pathname.startsWith('/api/analyze');
  const ip = 客户端IP(req.headers);
  const 裁决 = (是分析 ? 分析限流 : 通用限流).check(ip, 是分析 ? 分析限额 : 通用限额, Date.now());
  if (!裁决.允许) {
    return NextResponse.json(
      { success: false, error: '请求过于频繁，请稍后再试。' },
      { status: 429, headers: { 'Retry-After': String(裁决.重试秒) } },
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
