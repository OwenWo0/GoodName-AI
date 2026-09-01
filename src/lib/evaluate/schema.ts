/**
 * POST /api/evaluate-names 请求 zod（契约 v2 §3，形状冻结见 types.ts）。
 * 只放 schema 与类型，不放编排逻辑（模式约定：schemas 与 controller 分离）。
 * 中文错误消息，风格对齐 chart/schema.ts。
 */
import { z } from 'zod';
import type { XiyongMingXiItem } from '@/lib/types';
import { EVALUATE_NAMES_MAX } from './types';

const 汉字1_2RE = /^[一-鿿]{1,2}$/;
const 汉字1RE = /^[一-鿿]$/;

/** 五行全集（顺序与 pool/types 五行全集一致；zod 枚举用字面量元组保类型收窄）。 */
const 五行枚举 = z.enum(['木', '火', '土', '金', '水']);

/** 与 XiyongMingXiItem（src/lib/types.ts）同构；显式标注保证形状漂移在编译期即被拦住。 */
const 喜用神明细项Schema: z.ZodType<XiyongMingXiItem> = z.object({
  五行: 五行枚举,
  十神关系: z.enum(['印星', '比劫', '食伤', '财星', '官杀']),
  角色: z.enum(['主用', '次用', '调候']),
});

export const evaluateNamesRequestSchema = z
  .object({
    姓氏: z.string().regex(汉字1_2RE, '姓氏须为 1-2 个汉字'),
    名字列表: z
      .array(z.string().regex(汉字1_2RE, '名字列表每项须为 1-2 个汉字（名部分，不含姓）'))
      .min(1, '名字列表至少 1 个名字')
      .max(EVALUATE_NAMES_MAX, `名字列表至多 ${EVALUATE_NAMES_MAX} 个名字`),
    喜用神: z.array(五行枚举).min(1, '喜用神至少 1 个五行').max(5, '喜用神至多 5 个五行'),
    忌神: z.array(五行枚举).max(5, '忌神至多 5 个五行').default([]),
    喜用神明细: z.array(喜用神明细项Schema).optional(),
    避讳字: z.array(z.string().regex(汉字1RE, '避讳字须为单个汉字')).max(30, '避讳字至多 30 个字').optional(),
  })
  .superRefine((req, ctx) => {
    const 已见 = new Set<string>();
    const 重复 = new Set<string>();
    for (const 名 of req.名字列表) {
      if (已见.has(名)) 重复.add(名);
      已见.add(名);
    }
    if (重复.size > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['名字列表'],
        message: `名字列表存在重复项：${[...重复].map((n) => `「${n}」`).join('、')}`,
      });
    }
    const 犯忌 = req.喜用神.filter((wx) => req.忌神.includes(wx));
    if (犯忌.length > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['忌神'],
        message: `喜用神与忌神不能有交集，重复五行：${犯忌.join('、')}`,
      });
    }
  });

export type EvaluateNamesRequest = z.infer<typeof evaluateNamesRequestSchema>;
