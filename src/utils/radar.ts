/**
 * 五芒星雷达几何 —— 纯函数：由五行数值计算 SVG 折线坐标。
 * 约定：index 0 在正上方，顺时针每 72° 一轴（与 木火土金水 固定顺序配合使用）。
 */

export interface RadarVertex {
  x: number;
  y: number;
  label: string;
  value: number;
  /** 文字锚点：顶部居中，右侧 start，左侧 end。 */
  anchor: 'start' | 'middle' | 'end';
}

export interface RadarGeometry {
  size: number;
  cx: number;
  cy: number;
  radius: number;
  /** 参考环（自内向外）。points 为五边形折线。 */
  rings: Array<{ scale: number; points: string }>;
  /** 五轴辐条终点（外环顶点）。 */
  spokes: Array<{ x: number; y: number }>;
  /** 数据多边形折线点串。 */
  polygon: string;
  vertices: RadarVertex[];
}

export interface RadarOptions {
  /** SVG 视口边长，默认 260。 */
  size?: number;
  /** 四周留白（容纳标签），默认 44。 */
  padding?: number;
  /** 参考环比例，默认 [0.25, 0.5, 0.75, 1]。 */
  ringScales?: readonly number[];
  /**
   * 归一化分母（>0）。给定时替代 max(values,1)——用于同图叠加多个多边形
   * （如卷二「基准 + 名字加成后」两形状）时锁定共享刻度，防止视觉说谎；
   * 未给定时行为与旧版逐字节一致。
   */
  maxValue?: number;
}

const r2 = (n: number): number => Math.round(n * 100) / 100;

/** 轴角度：index 0 为正上方（-90°），顺时针递增。 */
function axisAngleDeg(index: number): number {
  return -90 + index * 72;
}

function anchorFor(index: number): RadarVertex['anchor'] {
  if (index === 0) return 'middle';
  return index === 1 || index === 2 ? 'start' : 'end';
}

/**
 * 计算五轴雷达几何。labels 与 values 须等长（5 轴）；
 * 各轴按 max(values, 1)（或 opts.maxValue，若给定）归一化，0 值落在圆心。
 */
export function pentagonRadar(
  labels: readonly string[],
  values: readonly number[],
  opts: RadarOptions = {},
): RadarGeometry {
  if (labels.length !== values.length) {
    throw new Error(`雷达标签与数值须等长：${labels.length} vs ${values.length}`);
  }
  if (labels.length !== 5) {
    throw new Error(`五芒星雷达固定 5 轴，收到 ${labels.length}`);
  }
  const size = opts.size ?? 260;
  const padding = opts.padding ?? 44;
  const ringScales = opts.ringScales ?? [0.25, 0.5, 0.75, 1];
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - padding;
  const max = opts.maxValue !== undefined ? Math.max(opts.maxValue, 1) : Math.max(...values, 1);

  const pointAt = (index: number, r: number): { x: number; y: number } => {
    const rad = (axisAngleDeg(index) * Math.PI) / 180;
    return { x: r2(cx + r * Math.cos(rad)), y: r2(cy + r * Math.sin(rad)) };
  };

  const spokes = labels.map((_, i) => pointAt(i, radius));
  const rings = ringScales.map((scale) => ({
    scale,
    points: labels.map((_, i) => { const p = pointAt(i, radius * scale); return `${p.x},${p.y}`; }).join(' '),
  }));

  const vertices: RadarVertex[] = labels.map((label, i) => {
    const clamped = Math.max(0, values[i]);
    const p = pointAt(i, radius * (clamped / max));
    return { ...p, label, value: values[i], anchor: anchorFor(i) };
  });

  return {
    size,
    cx: r2(cx),
    cy: r2(cy),
    radius: r2(radius),
    rings,
    spokes,
    polygon: vertices.map((v) => `${v.x},${v.y}`).join(' '),
    vertices,
  };
}
