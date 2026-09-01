'use client';

/**
 * 玄枢 demo 八卦转盘**逐字严格复刻**件（用户裁决 2026-08-30 15:15，覆盖契约 v4 §3.1/§3.2
 * 的「配色以项目为主/技法移植」口径：禁止任何二次修改——配色、参数、结构、时序原样，
 * 仅整体等比缩放可调；布局/挂载归 lead）。
 *
 * CSS = bagua-stage.module.css（demo <style> L54-249 逐字复制，CSS Module 隔离防
 * keyframes 与 Tailwind 全局撞名——宿主适配，非改动画）。demo 依赖 :root 的自定义属性
 * （:root 属页面级被排除未随复制），此处在外层 wrapper 以等值内联变量注入
 * （--deep/--line/--gold-light，值抄 demo :root 原样，同为宿主适配；
 *  2026-08-30 R3 改色令：配色按契约 §5.6 冻结映射单换为项目黛蓝/项目金，
 *  α 值/rgba 写法/行结构零动，动画本体仍逐字冻结）。
 *
 * 缩放实现：demo 版式在 760px 坐标系内逐像素保真，外层 width/height=W、内层
 * transform: scale(W/760)（纯等比缩放不算修改；transformOrigin=top left）。
 * demo 的 is-active 自动轮播（matchMedia 门控 + setInterval 5200ms）是动画一部分，
 * 以 useState/useEffect 等价复刻；随机数禁用（无任何随机源）。
 */
import { useEffect, useState, type CSSProperties } from 'react';
import styles from './bagua-stage.module.css';

/** demo trigrams 数据数组逐字复制（index.html L271-280）。 */
const TRIGRAMS: readonly { name: string; lines: number[] }[] = [
  { name: '乾', lines: [1, 1, 1] },
  { name: '坤', lines: [0, 0, 0] },
  { name: '震', lines: [1, 0, 0] },
  { name: '巽', lines: [0, 1, 1] },
  { name: '坎', lines: [0, 1, 0] },
  { name: '离', lines: [1, 0, 1] },
  { name: '艮', lines: [0, 0, 1] },
  { name: '兑', lines: [1, 1, 0] },
];

/** demo 粒子元组数组逐字复制（index.html L298-302，含 "-.8s" 原写法；导出供测试对真）。 */
export const 粒子位: readonly (readonly string[])[] = [
  ['19%', '31%', '2.8s', '-1.4s'],
  ['77%', '24%', '3.4s', '-.8s'],
  ['15%', '72%', '4.1s', '-2.7s'],
  ['83%', '67%', '2.6s', '-1.9s'],
  ['35%', '13%', '3.7s', '-2.1s'],
  ['65%', '86%', '3.1s', '-1.1s'],
  ['8%', '49%', '4.5s', '-3.2s'],
  ['92%', '46%', '3.9s', '-2.4s'],
];

/** 唯一可调维度=整体尺寸（px）。demo 原坐标系宽 760。 */
const SIZE_PX: Record<'sm' | 'md' | 'lg', number> = { sm: 190, md: 320, lg: 460 };
const DEMO_WIDTH = 760;

/** demo :root 中被复制段引用到的自定义属性（原值抄 demo :root L8-16；
 *  R3 改色令（用户 2026-08-30 口头改判）按契约 §5.6 冻结映射单换 hue：
 *  黛蓝 #34495e / 项目金 rgba(176, 141, 87, .2) / 项目金 #b08d57，α 与写法不动）。 */
const DEMO_ROOT_VARS = {
  '--deep': '#34495e',
  '--line': 'rgba(176, 141, 87, .2)',
  '--gold-light': '#b08d57',
} as unknown as CSSProperties;

/** demo L325 自检逐字保留（console.assert，非日志）。 */
console.assert(
  TRIGRAMS.length === 8 && TRIGRAMS.every(({ lines }) => lines.length === 3),
  '八卦数据应包含 8 组、每组 3 爻',
);

export function BaguaStage({
  size = 'md',
  className = '',
}: {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  // demo activeIndex + selectTrigram 的 React 等价（初值 0=首卦 is-active，同 demo HTML）
  const [activeIndex, setActiveIndex] = useState(0);

  // demo L318-322：非 reduced-motion 时 5200ms 轮播下一卦；卸载即清理
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => {
      setActiveIndex((i) => (i + 1) % TRIGRAMS.length);
    }, 5200);
    return () => window.clearInterval(timer);
  }, []);

  const width = SIZE_PX[size];

  return (
    <div
      className={className || undefined}
      style={{ width, height: width, overflow: 'hidden', ...DEMO_ROOT_VARS }}
    >
      <div
        className={styles.stage}
        style={{
          width: DEMO_WIDTH,
          transform: `scale(${width / DEMO_WIDTH})`,
          transformOrigin: 'top left',
        }}
        aria-label="八卦盘动画"
      >
        <div
          className={styles.orbit}
          style={{ '--radius': 'clamp(128px, 27vw, 205px)' } as CSSProperties}
        >
          <div className={`${styles.ring} ${styles['ring--outer']}`} />
          <div className={`${styles.ring} ${styles['ring--middle']}`} />
          <div className={`${styles.ring} ${styles['ring--inner']}`} />
          <div className={`${styles.ring} ${styles['ring--energy']}`} />
          <div className={styles.particles} aria-hidden="true">
            {粒子位.map(([x, y, duration, delay]) => (
              <i
                key={`${x}-${y}`}
                className={styles.particle}
                style={
                  {
                    '--x': x,
                    '--y': y,
                    '--duration': duration,
                    '--delay': delay,
                  } as CSSProperties
                }
              />
            ))}
          </div>
          <div className={styles.trigrams} aria-label="八卦选择">
            {TRIGRAMS.map((trigram, index) => (
              <button
                key={trigram.name}
                type="button"
                className={
                  index === activeIndex
                    ? `${styles.trigram} ${styles['is-active']}`
                    : styles.trigram
                }
                style={
                  {
                    '--i': index,
                    '--angle': `${index * 45 - 90}deg`,
                    '--counter-angle': `${90 - index * 45}deg`,
                  } as CSSProperties
                }
                aria-label={`选择${trigram.name}卦`}
                onClick={() => setActiveIndex(index)}
              >
                <span className={styles.trigram__body}>
                  <span className={styles.trigram__lines}>
                    {trigram.lines.map((line, lineIndex) => (
                      <i
                        key={lineIndex}
                        className={
                          line === 1 ? styles.line : `${styles.line} ${styles['is-broken']}`
                        }
                      />
                    ))}
                  </span>
                  <span className={styles.trigram__name}>{trigram.name}</span>
                </span>
              </button>
            ))}
          </div>
          <div className={styles.taiji} aria-label="太极">
            <span className={styles['taiji__halo']} />
          </div>
        </div>
      </div>
    </div>
  );
}
