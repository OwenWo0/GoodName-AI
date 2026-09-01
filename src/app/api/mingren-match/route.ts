/**
 * POST /api/mingren-match —— 名人吉名匹配端点（契约 v2 §4，零 AI）。
 *
 * 入参：MingrenMatchRequest（mingrenMatchRequestSchema）；出参：MingrenMatchResult JSON
 * （{候选, 库规模, 命中名数}）。库 = src/data/mingren-names.json 模块级静态 import 一次，
 * 请求期经 mingrenLibrarySchema 守卫（权威校验在 mingren/data.test.ts）。
 * 失败路径（均中文 JSON {success:false,error}，同 chart route 壳）：
 *   Content-Type 非 application/json→415；>1MB→413；非法 JSON / schema 不过→400（逐条「字段：原因」）；
 *   库数据畸形 / 其余异常→500 泛化（细节只进 stderr，不外泄）。
 */
import { mingrenMatchRequestSchema, mingrenLibrarySchema } from '@/lib/mingren/schema';
import { matchMingren } from '@/lib/mingren/match';
import type { MingrenEntry } from '@/lib/mingren/types';
import { MAX_BODY_BYTES } from '@/lib/chart/schema';
import mingrenJson from '@/data/mingren-names.json';

function jsonError(status: number, message: string): Response {
  return Response.json({ success: false, error: message }, { status });
}

/** form 编码可被跨站「简单请求」盲发；JSON 端点只认 JSON（同 chart route，sec-m5 MEDIUM-3）。 */
function isJsonRequest(req: Request): boolean {
  return (req.headers.get('content-type') ?? '').toLowerCase().includes('application/json');
}

/** 库守卫缓存：首次请求校验并冻结装配，畸形数据抛错（route 层转 500 泛化）。 */
let cached库: readonly MingrenEntry[] | null = null;
function getLibrary(): readonly MingrenEntry[] {
  if (cached库 === null) {
    const r = mingrenLibrarySchema.safeParse(mingrenJson);
    if (!r.success) {
      const 明细 = r.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join('.') || '条目'}：${i.message}`)
        .join('；');
      process.stderr.write(`名人匹配：库数据畸形——${明细}\n`);
      throw new Error('mingren-names.json 数据畸形');
    }
    cached库 = r.data;
  }
  return cached库;
}

export async function POST(req: Request): Promise<Response> {
  if (!isJsonRequest(req)) {
    return jsonError(415, 'Content-Type 须为 application/json。');
  }
  const declared = Number(req.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return jsonError(413, '请求体过大（上限 1MB）。');
  }

  let bodyText: string;
  try {
    const buffer = await req.arrayBuffer();
    if (buffer.byteLength > MAX_BODY_BYTES) {
      return jsonError(413, '请求体过大（上限 1MB）。');
    }
    bodyText = new TextDecoder().decode(buffer);
  } catch {
    return jsonError(400, '读取请求体失败。');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    return jsonError(400, '请求体不是合法 JSON。');
  }

  const parsedReq = mingrenMatchRequestSchema.safeParse(parsed);
  if (!parsedReq.success) {
    const 明细 = parsedReq.error.issues
      .map((issue) => {
        const 字段 = issue.path.length > 0 ? issue.path.join('.') : '请求体';
        return `${字段}：${issue.message}`;
      })
      .join('；');
    return jsonError(400, `请求参数不合法——${明细}`);
  }

  try {
    return Response.json(matchMingren(getLibrary(), parsedReq.data));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`名人匹配：服务端异常——${message}\n`);
    return jsonError(500, '名人匹配服务异常，请稍后重试。');
  }
}
