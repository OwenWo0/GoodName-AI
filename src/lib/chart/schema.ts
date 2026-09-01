/**
 * /api/chart 请求 schema —— **全仓唯一权威源**（服务端校验 + UI 表单共用，
 * UI 侧经 src/utils/chart-request.ts re-export；杜绝双源漂移，sec-m5 MEDIUM-1）。
 * 只放 schema 与类型，不放编排逻辑（模式约定：schemas 与 controller 分离）。
 *
 * 口径：汉字白名单（拦控制符/RTL 伪装，bidi 面）；日历合法性+1900-2100+非未来
 * （防畸形年份直撞 lunar 库，原「引擎兜底」口径废弃——route 测试同步改）；
 * 名字草案=名部分不含姓，字数随名字形式 1/2，须与辈字锁定一致。
 *
 * 契约 changelog：
 *   v1   初版冻结（M5 契约审查收口后）。
 *   v1.1 （2026-08-29，主控放行）新增可选字段 排除已选?: string[]（「重新生成」排重，
 *        default 空数组、无随机）；冻结守卫键集同步；旧客户端不带此字段照常合法。
 *   v1.2 （2026-08-30，契约 v3 §1.2）新增可选字段 指定字?: {字, 位置∈任一|第一|第二}（硬约束，
 *        位置 default 任一）+ superRefine 三规则（草案含字 / 单名第二拒 / 与辈字同位异字拒）；
 *        冻结守卫键集同步；旧客户端不带此字段照常合法。
 */
import { z } from 'zod';

/** 请求体上限：1MB（与 /api/analyze 同口径）。 */
export const MAX_BODY_BYTES = 1024 * 1024;

const 汉字1_2RE = /^[一-鿿]{1,2}$/;
const 汉字1RE = /^[一-鿿]$/;
const 汉字1_4RE = /^[一-鿿]{1,4}$/;
const 日期RE = /^\d{4}-\d{2}-\d{2}$/;
const 时间RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const 单汉字数组 = z.array(z.string().regex(汉字1RE, '须为单个汉字')).max(30, '至多 30 个字');

export const chartRequestSchema = z
  .object({
    姓氏: z.string().regex(汉字1_2RE, '姓氏须为 1-2 个汉字'),
    母亲姓氏: z.string().regex(汉字1_2RE, '母亲姓氏须为 1-2 个汉字').optional(),
    名字草案: z.string().regex(汉字1_2RE, '名字草案须为 1-2 个汉字（名部分，不含姓）').optional(), // 名部分（不含姓）
    性别: z.enum(['男', '女']),
    历法: z.enum(['阳历', '农历']),
    闰月: z.boolean().optional(), // 仅历法=农历时有意义
    出生日期: z.string().regex(日期RE, '出生日期须为 YYYY-MM-DD'),
    时辰未知: z.boolean(),
    出生时间: z.string().regex(时间RE, '出生时间须为 HH:mm（24 小时制）').optional(),
    经度: z.number().min(-180, '经度须在 -180~180').max(180, '经度须在 -180~180'),
    城市: z.string().max(32).optional(),
    使用真太阳时: z.boolean().default(true),
    夏令时: z.boolean().optional(), // 1986–1991 大陆夏令时出生者勾选，北京时间回拨 1 小时
    名字形式: z.enum(['单名', '双名']),
    辈字: z
      .object({
        字: z.string().regex(汉字1RE, '辈字须为一个汉字'),
        位置: z.enum(['第一', '第二']),
      })
      .optional(),
    // 指定字（契约 v3 §1.2）：名部硬约束含该字；位置三选，default 任一；单名+第二 由 superRefine 拒。
    指定字: z
      .object({
        字: z.string().regex(汉字1RE, '指定字须为一个汉字'),
        位置: z.enum(['任一', '第一', '第二']).default('任一'),
      })
      .optional(),
    避讳字: 单汉字数组.default([]),
    禁用字: 单汉字数组.optional(),
    // 「重新生成」排重复用（契约 v1.1）：已呈候选的名部串（不含姓，1-4 字），pool 终筛组装期
    // 剔除命中组合，池可排空不报错；default([]) —— 不带即不排除，无随机，同输入必同输出。
    排除已选: z
      .array(z.string().regex(汉字1_4RE, '排除已选每项须为 1-4 个汉字（名部，不含姓）'))
      .max(300, '排除已选至多 300 个名字')
      .default([]),
  })
  .superRefine((req, ctx) => {
    if (!req.时辰未知 && req.出生时间 === undefined) {
      ctx.addIssue({ code: 'custom', path: ['出生时间'], message: '未勾选「时辰未知」时必须提供出生时间（HH:mm）' });
    }
    // —— 指定字三规则（契约 v3 §1.2，冻结文案逐字）——
    if (req.指定字 && req.名字草案 !== undefined && ![...req.名字草案].includes(req.指定字.字)) {
      ctx.addIssue({ code: 'custom', path: ['名字草案'], message: `名字草案须含指定字「${req.指定字.字}」` });
    }
    if (req.指定字 && req.名字形式 === '单名' && req.指定字.位置 === '第二') {
      ctx.addIssue({ code: 'custom', path: ['指定字'], message: '单名仅一位名部，指定字位置不能为「第二」' });
    }
    if (
      req.指定字 &&
      req.辈字 &&
      req.指定字.位置 !== '任一' &&
      req.指定字.位置 === req.辈字.位置 &&
      req.指定字.字 !== req.辈字.字
    ) {
      ctx.addIssue({ code: 'custom', path: ['指定字'], message: '指定字与辈字同位且不同字，约束冲突' });
    }
    if (req.闰月 && req.历法 !== '农历') {
      ctx.addIssue({ code: 'custom', path: ['闰月'], message: '仅历法为农历时可勾选闰月' });
    }
    if (req.辈字 && req.名字形式 === '单名') {
      ctx.addIssue({ code: 'custom', path: ['辈字'], message: '辈字锁定仅双名可用' });
    }
    if (req.名字草案 !== undefined && [...req.名字草案].length !== (req.名字形式 === '单名' ? 1 : 2)) {
      ctx.addIssue({
        code: 'custom',
        path: ['名字草案'],
        message: `名字草案须为 ${req.名字形式 === '单名' ? 1 : 2} 字（名部分，不含姓）`,
      });
    }
    if (req.名字草案 !== undefined && req.辈字 && [...req.名字草案].length === 2) {
      const idx = req.辈字.位置 === '第一' ? 0 : 1;
      if ([...req.名字草案][idx] !== req.辈字.字) {
        ctx.addIssue({
          code: 'custom',
          path: ['名字草案'],
          message: `名字草案第${idx + 1}字应为辈字「${req.辈字.字}」`,
        });
      }
    }
    if (日期RE.test(req.出生日期)) {
      const [y, m, d] = req.出生日期.split('-').map(Number);
      if (y < 1900 || y > 2100) {
        // 年份界两历法共用（lunar 历法表覆盖范围）；农历日合法性由编排层回环校验（库口径）
        ctx.addIssue({ code: 'custom', path: ['出生日期'], message: '年份须在 1900-2100（历法表覆盖范围）' });
      } else if (req.历法 === '阳历') {
        const date = new Date(Date.UTC(y, m - 1, d)); // UTC 归一（2025-13-01→2026-01-01）靠回环比对拦截
        const real = date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
        if (!real) {
          ctx.addIssue({ code: 'custom', path: ['出生日期'], message: '出生日期不是有效日期' });
        } else if (date.getTime() > Date.now()) {
          ctx.addIssue({ code: 'custom', path: ['出生日期'], message: '出生日期不能晚于今天' });
        }
      }
    }
  });

export type ChartRequest = z.infer<typeof chartRequestSchema>;
