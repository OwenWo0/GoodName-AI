/**
 * 五芒星雷达几何 单测。
 */
import { describe, expect, it } from 'vitest';
import { pentagonRadar } from '@/utils/radar';

const LABELS = ['木', '火', '土', '金', '水'];

describe('pentagonRadar', () => {
  const geo = pentagonRadar(LABELS, [100, 0, 0, 0, 0], { size: 200, padding: 30 });

  it('轴 0 在正上方：最大值顶点为 (cx, cy-radius)', () => {
    expect(geo.cx).toBe(100);
    expect(geo.cy).toBe(100);
    expect(geo.radius).toBe(70);
    expect(geo.vertices[0].x).toBeCloseTo(100);
    expect(geo.vertices[0].y).toBeCloseTo(30);
  });

  it('0 值顶点落在圆心', () => {
    for (const v of geo.vertices.slice(1)) {
      expect(v.x).toBeCloseTo(100);
      expect(v.y).toBeCloseTo(100);
    }
  });

  it('全等值时按 max 归一化：五顶点填满外环且对称', () => {
    const g = pentagonRadar(LABELS, [50, 50, 50, 50, 50], { size: 200, padding: 30 });
    const dists = g.vertices.map((v) => Math.hypot(v.x - 100, v.y - 100));
    for (const d of dists) expect(d).toBeCloseTo(70);
    // 顶点按顺时针 x 序：top, right-upper, right-lower, left-lower, left-upper
    expect(g.vertices[1].x).toBeGreaterThan(100);
    expect(g.vertices[4].x).toBeLessThan(100);
  });

  it('外环折线点与辐条终点一致', () => {
    const outer = geo.rings[geo.rings.length - 1];
    expect(outer.scale).toBe(1);
    const outerPts = outer.points.split(' ');
    expect(outerPts).toHaveLength(5);
    expect(outerPts[0]).toBe(`${geo.spokes[0].x},${geo.spokes[0].y}`);
  });

  it('标签锚点：顶部 middle，右侧 start，左侧 end', () => {
    expect(geo.vertices.map((v) => v.anchor)).toEqual(['middle', 'start', 'start', 'end', 'end']);
  });

  it('负值钳到 0，超 maxValue 不炸', () => {
    const g = pentagonRadar(LABELS, [-5, 200, 0, 0, 0]);
    expect(g.vertices[0].x).toBeCloseTo(g.cx);
    expect(g.vertices[1].value).toBe(200);
  });

  it('非 5 轴或长度不齐抛错', () => {
    expect(() => pentagonRadar(['木'], [1])).toThrow(/5 轴/);
    expect(() => pentagonRadar(LABELS, [1, 2])).toThrow(/等长/);
  });

  it('maxValue 给定：作共享分母，最大顶点不触外环，半径比=value/maxValue', () => {
    const g = pentagonRadar(LABELS, [100, 50, 0, 0, 0], { size: 200, padding: 30, maxValue: 200 });
    const d0 = Math.hypot(g.vertices[0].x - 100, g.vertices[0].y - 100);
    const d1 = Math.hypot(g.vertices[1].x - 100, g.vertices[1].y - 100);
    expect(d0).toBeCloseTo(70 * (100 / 200)); // 不触外环
    expect(d1).toBeCloseTo(70 * (50 / 200));
    expect(d0 / 70).toBeCloseTo(100 / 200);
  });

  it('maxValue 未给：仍按 max(values,1) 归一（旧行为回归锁，逐值一致）', () => {
    const values = [40, 80, 15, 3, 90];
    const legacy = pentagonRadar(LABELS, values, { size: 200, padding: 30 });
    const explicit = pentagonRadar(LABELS, values, { size: 200, padding: 30, maxValue: Math.max(...values, 1) });
    expect(legacy.polygon).toBe(explicit.polygon); // 显式传 max(values) 与不传逐字节同
    const dMax = Math.hypot(legacy.vertices[4].x - 100, legacy.vertices[4].y - 100);
    expect(dMax).toBeCloseTo(70); // 最大轴触外环——默认路径未被 maxValue 改动
  });
});
