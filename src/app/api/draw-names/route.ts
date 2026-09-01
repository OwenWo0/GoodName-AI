/**
 * POST /api/draw-names —— 无命盘抽卡端点（契约 C3：姓氏+偏好 → buildPool 候选，零 AI 零生辰）。
 *
 * 入参：DrawNamesRequest（drawNamesRequestSchema 校验，五行偏好拒重复/单名+指定字第二拒）；
 * 出参：{ 候选: ChartResult['candidates'], 统计: PoolStats }（池空→200 空候选，非错误）。
 * 失败路径逐行镜像 /api/evaluate-names（均中文 JSON {success:false,error}）：
 *   Content-Type 非 application/json→415；>1MB→413；非法 JSON / schema 不过→400（逐条「字段：原因」）；
 *   DrawUserError（姓氏笔画缺失/指定字不在表/约束矛盾）→400；其余异常→500 泛化
 *   （细节只进 stderr，不外泄）。
 */
import { MAX_BODY_BYTES } from '@/lib/chart/schema';
import { drawNamesRequestSchema } from '@/lib/draw/schema';
import { drawNames, DrawUserError } from '@/lib/draw/draw';

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

  const parsedReq = drawNamesRequestSchema.safeParse(parsed);
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
    return Response.json(drawNames(parsedReq.data));
  } catch (err) {
    if (err instanceof DrawUserError) {
      return jsonError(400, err.message);
    }
    // 海选内核缺陷（非用户输入问题——姓氏笔画/指定字表内外均已前置拦截）：
    // 泛化文案，细节只进 stderr（sec-m5 MEDIUM-2）
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`抽卡接口：服务端异常——${message}\n`);
    return jsonError(500, '抽卡服务异常，请稍后重试。');
  }
}
