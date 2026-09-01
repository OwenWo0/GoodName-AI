/**
 * POST /api/draw-names 请求 schema（契约 C3，无命盘抽卡赛道）—— 只放 schema 与类型，
 * 不放编排逻辑（模式约定：schemas 与 controller 分离）。
 *
 * 口径对齐 chart/schema.ts 与 mingren/schema.ts：汉字白名单 RE（拦控制符/RTL 伪装）、
 * 五行 z.enum 白名单、单汉字数组 ≤30、排除已选 ≤300（每项 1-4 汉字名部）。
 * 与 chart 的差异（C3 冻结）：无生辰字段；性别 default'男'、名字形式 default'双名'；
 * 五行偏好可选（空/缺=不限），重复经 superRefine 拒；指定字位置 default'任一'，
 * 单名+「第二」拒（文案逐字对齐 chart schema）。
 */
import { z } from 'zod';

const 汉字1_2RE = /^[一-鿿]{1,2}$/;
const 汉字1RE = /^[一-鿿]$/;
const 汉字1_4RE = /^[一-鿿]{1,4}$/;

/** 五行白名单（与 pool/types 五行全集同集合）。 */
const 五行RE = z.enum(['木', '火', '土', '金', '水']);

/** 避讳/禁用：逐字单个汉字，至多 30（与 chart 单汉字数组同口径）。 */
const 单汉字数组 = z.array(z.string().regex(汉字1RE, '须为单个汉字')).max(30, '至多 30 个字');

export const drawNamesRequestSchema = z
  .object({
    姓氏: z.string().regex(汉字1_2RE, '姓氏须为 1-2 个汉字'),
    性别: z.enum(['男', '女']).default('男'),
    名字形式: z.enum(['单名', '双名']).default('双名'),
    /** 五行属性偏好：空/缺=不限（draw.ts 映射为全集透传 buildPool 喜用神）。 */
    五行偏好: z.array(五行RE).max(5, '五行偏好至多 5 个五行').optional(),
    指定字: z
      .object({
        字: z.string().regex(汉字1RE, '指定字须为一个汉字'),
        位置: z.enum(['任一', '第一', '第二']).default('任一'),
      })
      .optional(),
    避讳字: 单汉字数组.optional(),
    禁用字: 单汉字数组.optional(),
    排除已选: z
      .array(z.string().regex(汉字1_4RE, '排除已选每项须为 1-4 个汉字（名部，不含姓）'))
      .max(300, '排除已选至多 300 个名字')
      .optional(),
    期望候选数: z
      .number()
      .int('期望候选数须为整数')
      .min(1, '期望候选数至少 1')
      .max(100, '期望候选数至多 100')
      .default(40),
  })
  .superRefine((req, ctx) => {
    if (req.五行偏好) {
      const 集 = new Set(req.五行偏好);
      if (集.size !== req.五行偏好.length) {
        ctx.addIssue({ code: 'custom', path: ['五行偏好'], message: '五行偏好不可含重复五行' });
      }
    }
    if (req.指定字 && req.名字形式 === '单名' && req.指定字.位置 === '第二') {
      ctx.addIssue({ code: 'custom', path: ['指定字'], message: '单名仅一位名部，指定字位置不能为「第二」' });
    }
  });

export type DrawNamesRequest = z.infer<typeof drawNamesRequestSchema>;
