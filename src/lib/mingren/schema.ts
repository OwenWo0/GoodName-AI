/**
 * /api/mingren-match 请求 schema（契约 v2 §4，docs/契约v2-意向吉名与名人匹配.md；
 * v3 §4.2 中档放宽：上限改 max(500).default(200)，其余字段形状不动）。
 * 只放 schema 与类型，不放编排逻辑（模式约定：schemas 与 controller 分离）。
 *
 * 口径对齐 chart/schema.ts：汉字白名单（拦控制符/RTL 伪装）；五行 z.enum 白名单。
 * mingrenLibrarySchema 为路由侧库健全性守卫（正式全量校验在 mingren/data.test.ts）：
 * 库 JSON 被改坏时路由报 500 泛化，而不是把畸形条目喂进匹配算法。
 */
import { z } from 'zod';
import { 出处类型枚举, 名人类别枚举 } from './types';

const 汉字1_2RE = /^[一-鿿]{1,2}$/;
const 汉字1RE = /^[一-鿿]$/;

/** 五行白名单（与 pool/types 五行全集同集合）。 */
const 五行RE = z.enum(['木', '火', '土', '金', '水']);

/** 避讳/禁用：逐字单个汉字，至多 30（与 chart 单汉字数组同口径）。 */
const 单汉字数组 = z.array(z.string().regex(汉字1RE, '须为单个汉字')).max(30, '至多 30 个字');

export const mingrenMatchRequestSchema = z
  .object({
    姓氏: z.string().regex(汉字1_2RE, '姓氏须为 1-2 个汉字'),
    性别: z.enum(['男', '女']),
    名字形式: z.enum(['单名', '双名']).default('双名'),
    喜用神: z.array(五行RE).min(1, '喜用神至少 1 个五行').max(5, '喜用神至多 5 个五行'),
    忌神: z.array(五行RE).max(5, '忌神至多 5 个五行').default([]),
    喜用神明细: z
      .array(
        z.object({
          五行: 五行RE,
          十神关系: z.enum(['印星', '比劫', '食伤', '财星', '官杀']),
          角色: z.enum(['主用', '次用', '调候']),
        }),
      )
      .max(15, '喜用神明细至多 15 项')
      .optional(),
    避讳字: 单汉字数组.optional(),
    禁用字: 单汉字数组.optional(),
    排除已选: z
      .array(z.string().regex(汉字1_2RE, '排除已选每项须为 1-2 个汉字（名部，不含姓）'))
      .max(300, '排除已选至多 300 个名字')
      .optional(),
    // v3 §4.2 中档放宽：上限 20→全量返回（库 182 条，default 200 即全返；max 500 留库扩容余量）。
    上限: z.number().int('上限须为整数').min(1, '上限至少 1').max(500, '上限至多 500').default(200),
  })
  .superRefine((req, ctx) => {
    const 喜 = new Set(req.喜用神);
    if (喜.size !== req.喜用神.length) {
      ctx.addIssue({ code: 'custom', path: ['喜用神'], message: '喜用神不可含重复五行' });
    }
    const 忌 = new Set(req.忌神);
    if (忌.size !== req.忌神.length) {
      ctx.addIssue({ code: 'custom', path: ['忌神'], message: '忌神不可含重复五行' });
    }
    const 相犯 = req.忌神.filter((w) => 喜.has(w));
    if (相犯.length > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['忌神'],
        message: `忌神与喜用神不可含同一五行（相犯：${相犯.join('、')}）`,
      });
    }
  });

export type MingrenMatchRequest = z.infer<typeof mingrenMatchRequestSchema>;

/**
 * 库条目守卫（路由侧健全性检查，非权威校验——权威在 data.test.ts）。
 * 逐条形状 = MingrenEntry（types.ts 冻结）；宽松长度界仅拦截明显畸形/注入串。
 */
export const mingrenLibrarySchema = z.array(
  z.object({
    姓: z.string().regex(汉字1_2RE, '姓须为 1-2 个汉字'),
    名: z.string().regex(汉字1_2RE, '名须为 1-2 个汉字'),
    时代: z.string().min(1).max(32),
    类别: z.enum(名人类别枚举),
    简介: z.string().max(60),
    出处: z.string().min(1).max(100),
    出处类型: z.enum(出处类型枚举),
  }),
);
