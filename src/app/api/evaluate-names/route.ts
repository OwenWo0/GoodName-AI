/**
 * POST /api/evaluate-names —— 任意名批量评估端点（八字契合/平仄/五格/爆款度，零 AI）。
 *
 * 入参：EvaluateNamesRequest（evaluateNamesRequestSchema 校验，含去重/喜忌交集 refine）；
 * 出参：{ 评估: EvaluatedName[] }（形状见 src/lib/evaluate/types.ts，契约 v2 §3 冻结）。
 * 失败路径（均中文 JSON {success:false,error}，文案风格对齐 /api/chart）：
 *   Content-Type 非 application/json→415；>1MB→413；非法 JSON / schema 不过→400（逐条「字段：原因」）；
 *   其余异常→500 泛化（细节只进 stderr，不外泄）。
 */
import { MAX_BODY_BYTES } from '@/lib/chart/schema';
import { evaluateNamesRequestSchema } from '@/lib/evaluate/schema';
import { evaluateNames } from '@/lib/evaluate/evaluate';

function jsonError(status: number, message: string): Response {
  return Response.json({ success: false, error: message }, { status });
}

/** form 编码（text/plain / x-www-form-urlencoded）可被跨站「简单请求」盲发；JSON 端点只认 JSON（sec-m5 MEDIUM-3）。 */
function isJsonRequest(req: Request): boolean {
  return (req.headers.get('content-type') ?? '').toLowerCase().includes('application/json');
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

  const parsedReq = evaluateNamesRequestSchema.safeParse(parsed);
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
    const req0 = parsedReq.data;
    const 评估 = evaluateNames(req0.姓氏, req0.名字列表, {
      喜用神: req0.喜用神,
      忌神: req0.忌神,
      ...(req0.喜用神明细 !== undefined ? { 喜用神明细: req0.喜用神明细 } : {}),
      ...(req0.避讳字 !== undefined ? { 避讳字: req0.避讳字 } : {}),
    });
    return Response.json({ 评估 });
  } catch (err) {
    // 评估内核缺陷（非用户输入问题——名部已过 schema）：泛化文案，细节只进 stderr（sec-m5 MEDIUM-2）
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`评估接口：服务端异常——${message}\n`);
    return jsonError(500, '评估服务异常，请稍后重试。');
  }
}
