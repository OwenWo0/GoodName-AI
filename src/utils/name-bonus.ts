/**
 * 卷二「名字五行加成」叠加建模 —— 纯函数，零 React / 零引擎改动。
 *
 * 口径（lead 拍板）：选中名字逐字五行以「每字等权 +1 单位」作独立色段
 * 叠在力量条上；基准得分（0~800 藏干加权）不动、不引入新计分算法。
 * 每单位固定占轨道 4%（常量，勿按 maxScore 比例——时辰未知三柱盘
 * maxScore 小会把色段炸宽）。条宽超 100% 截断显示，但换算得分保真值。
 */
import type { WuXing, WuXingForce } from '@/lib/types';
import type { EvaluatedName } from '@/lib/evaluate/types';
import { WUXING_ORDER } from '@/utils/wuxing';

/** 单行命局对该名某字的契合分类（元素级，非逐字级）。 */
export type 命中分类 = '喜' | '次' | '忌' | '无';

export interface 加成行 {
  五行: WuXing;
  /** 基准段宽 %（与卷二力量条同刻度：得分/maxScore×100，供色段 left 对齐）。 */
  基准百分比: number;
  /** 该行五行在选中名逐字五行中出现的次数（表外字被 evaluate 天然跳过→0）。 */
  加成单位数: number;
  /** 色段宽 % = 单位数 × 单位刻度（未截断的保真值）。 */
  加成百分比: number;
  分类: 命中分类;
}

export interface 加成视图 {
  名: string;
  /** 恒 5 行，固定 木火土金水 序（与入参顺序无关）。 */
  行: 加成行[];
  /** 换算得分（保真值，未截断）：基准 + 单位数×maxScore×单位刻度%。按 WUXING_ORDER 序。 */
  加成后得分: number[];
  /** 雷达共享分母 = max(基准max, 加成后max)，两多边形同用它，否则对比说谎。 */
  雷达刻度: number;
  /** 任一力量条触顶截断（仅显示层；数字仍保真）。 */
  有截断: boolean;
}

/** 每个加成单位占力量条轨道的百分比。 */
export const 单位刻度 = 4;

type 选中名 = Pick<EvaluatedName, '名' | '五行' | '契合'>;

/**
 * 由五行力量与选中名计算叠加视图；未选中（null）返回 null（调用方走无叠加路径）。
 * maxScore 与卷二力量条同口径 = max(得分…, 1)。
 */
export function 计算名字加成(
  五行力量: readonly WuXingForce[],
  选中: 选中名 | null,
): 加成视图 | null {
  if (选中 === null) return null;

  const maxScore = Math.max(...五行力量.map((f) => f.得分), 1);
  const 得分of = new Map(五行力量.map((f) => [f.五行, f.得分]));
  const { 命中喜用, 命中次用, 命中忌神 } = 选中.契合;

  const 行: 加成行[] = WUXING_ORDER.map((五行) => {
    const 单位数 = 选中.五行.filter((e) => e === 五行).length;
    const 分类: 命中分类 = 命中喜用.includes(五行)
      ? '喜'
      : 命中次用.includes(五行)
        ? '次'
        : 命中忌神.includes(五行)
          ? '忌'
          : '无';
    return {
      五行,
      基准百分比: ((得分of.get(五行) ?? 0) / maxScore) * 100,
      加成单位数: 单位数,
      加成百分比: 单位数 * 单位刻度,
      分类,
    };
  });

  const 加成后得分 = 行.map(
    (r) => (得分of.get(r.五行) ?? 0) + r.加成单位数 * maxScore * (单位刻度 / 100),
  );
  const 基准得分 = 行.map((r) => 得分of.get(r.五行) ?? 0);

  return {
    名: 选中.名,
    行,
    加成后得分,
    雷达刻度: Math.max(Math.max(...基准得分), Math.max(...加成后得分)),
    有截断: 行.some((r) => r.基准百分比 + r.加成百分比 > 100),
  };
}
