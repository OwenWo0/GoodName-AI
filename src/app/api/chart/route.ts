/**
 * POST /api/chart —— 固定算法排盘端点（八字/喜用神/五格/候选池，零 AI）。
 *
 * 入参：ChartRequest（chartRequestSchema 全树校验，含跨字段 refine）；出参：ChartResult JSON。
 * 失败路径（均中文 JSON {success:false,error}）：
 *   Content-Type 非 application/json→415（防 text/plain 跨站盲打，sec-m5 MEDIUM-3）；
 *   >1MB→413；非法 JSON / schema 不过→400（逐条「字段：原因」）；
 *   ChartUserError（农历非法日/无闰月）→400；其余异常→500 泛化（细节只进 stderr，不外泄）。
 */
import { chartRequestSchema, MAX_BODY_BYTES } from '@/lib/chart/schema';
import { buildChart, ChartUserError } from '@/lib/chart/orchestrate';

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

  const parsedReq = chartRequestSchema.safeParse(parsed);
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
    return Response.json(buildChart(parsedReq.data));
  } catch (err) {
    if (err instanceof ChartUserError) {
      return jsonError(400, err.message);
    }
    // 引擎时间串解析失败等落在此处：仅按类别报固定文案，不回显引擎原文（可能含库名/内部格式，sec-m5 MEDIUM-2）
    const message = err instanceof Error ? err.message : String(err);
    if (/日期|时间|经度|出生日期/.test(message)) {
      process.stderr.write(`排盘接口：出生信息解析失败——${message}\n`);
      return jsonError(400, '出生信息不合法，请核对出生日期与时间。');
    }
    process.stderr.write(`排盘接口：服务端异常——${message}\n`);
    return jsonError(500, '排盘服务异常，请稍后重试。');
  }
}
