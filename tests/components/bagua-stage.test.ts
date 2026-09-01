/**
 * 玄枢复刻件单测（用户裁决 2026-08-30 15:15：逐字严格复刻，禁二次修改，仅整体缩放可调；
 * 旧「禁 teal/项目 token 动画类」断言随改扮版方案一并作废）。
 *
 * 断言组：
 * ① 保真（R3 改色后口径，用户 2026-08-30 改判「色彩不符合主体色」+ 契约 §5.6
 *    冻结映射单）——bagua-stage.module.css 与 demo index.html L54-246（.stage 起、
 *    520px media 块止）剔 .hero 行后**套用 4 组冻结色映射 replaceAll、再于
 *    .orbit::before 前插入 R3 落地补记冻结宿主适配块（太极 grid 居中一行）后逐字节等**
 *    （hue 一对一、α/rgba 写法/行结构零动，动画本体仍逐字冻结；插入块=契约 §5.6 补记）；
 *    reduced-motion 门控块（L247-249）因 `*` 非纯选择器逐字移置 globals.css；
 *    另显式点名 7 条 @keyframes 整行 / ring--energy 行 / taiji background 行 /
 *    particle animation 行（行文本取自 demo、含旧色者套映射，零转写误差）；
 *    并显式断言旧色四组清零、新色两组在场；组件源码含 5200 轮播。
 * ② 粒子位——8 条、与 demo 元组数组（从 HTML 抠出求值）逐值等（含 '-.8s' 原写法）、
 *    两次独立求值深等；组件源码零 Math.random。
 *    技法沿用 lead 已裁的源码抠取（tsconfig jsx=preserve + vitest 无 react 插件禁改，
 *    含 JSX 的 .tsx 任何 import 均 transform 失败，真实 import 不可行）。
 * ③ 尺寸 Record 字面量 190/320/460 在场。
 * ④ globals.css 回滚守卫——v4 改扮版增补全部撤净（无 bagua 系 keyframes、
 *    animate-spin-slow、feTurbulence），且 ink-pulse/bonus-grow/md-body 原样健在。
 */
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const DEMO_PATH =
  '/Users/owenwu/Documents/Codex/2026-08-30/ni/outputs/index.html';
const hasDemo = existsSync(DEMO_PATH);
let demo = '';
try {
  demo = hasDemo ? readFileSync(DEMO_PATH, 'utf8') : '';
} catch {
  demo = '';
}
const demoLines = demo ? demo.split('\n') : [];
const moduleCss = readFileSync(
  new URL('../../src/components/bagua-stage.module.css', import.meta.url),
  'utf8',
);
const 组件源码 = readFileSync(
  new URL('../../src/components/bagua-stage.tsx', import.meta.url),
  'utf8',
);
const css = readFileSync(
  new URL('../../src/app/globals.css', import.meta.url),
  'utf8',
);

/** R3 冻结色映射单（契约 §5.6）：4 组 hue 前缀串替换，α/写法/空格/行结构零动。 */
const 色映射: readonly (readonly [string, string])[] = [
  ['rgba(143, 210, 197, ', 'rgba(52, 73, 94, '],
  ['rgba(70, 170, 144, ', 'rgba(52, 73, 94, '],
  ['rgba(214, 180, 110, ', 'rgba(176, 141, 87, '],
  ['rgba(241, 217, 158, ', 'rgba(176, 141, 87, '],
];
/** 对 demo 原文套冻结映射（期望值构造器；逐字节比较与点名行共用同一单源）。 */
const 换色 = (文本: string): string =>
  色映射.reduce((acc, [旧, 新]) => acc.replaceAll(旧, 新), 文本);

/** R3 落地补记冻结插入块（契约 §5.6）：demo 源太极偏位 (-314,-319) 系其 .orbit
 *  absolute 致 place-items 不达流内 .taiji——宿主适配一行居中（非动画本体修改），
 *  插于 `.orbit::before` 规则前；测试在期望侧做同一插入再逐字节等。 */
const 宿主插入 = [
  '    /* 宿主适配（R3 落地补记，非动画本体修改）：demo 源 .orbit 系 absolute，',
  '       .stage 的 place-items 不达流内 .taiji（demo 原页实测太极偏位 (-314,-319)）——',
  '       grid 居中唯一流内子代；absolute 诸环/卦/粒子定位与全部动画零影响。 */',
  '    .orbit { display: grid; place-items: center; }',
  '',
  '    .orbit::before {',
].join('\n');

describe('① 逐字保真（demo → module.css / 组件）', () => {
  it('module.css = demo L54-246 复制 + R3 冻结映射套色（剔 .hero；门控块 L247-249 移 globals.css）', () => {
    if (!demo) return;
    expect(demoLines[53], '锚点：L54 应为 .stage {').toMatch(/^(\s*)\.stage \{/);
    expect(demoLines[244], '锚点：L245 应为 520px media 块收尾 }').toMatch(/^\s*\}\s*$/);
    expect(demoLines[246], '锚点：L247 应为 reduced-motion @media 起始').toContain(
      '@media (prefers-reduced-motion: reduce)',
    );
    const 套色 = 换色(
      demoLines
        .slice(53, 246)
        .filter((行) => !/^\s+\.hero \{ min-height: 100svh; \}$/.test(行))
        .join('\n'),
    );
    // 宿主插入锚点唯一性守卫（demo 段内 .orbit::before 仅一处，replace 命中即消费）
    expect(套色.match(/\.orbit::before \{/g)).toHaveLength(1);
    const 期望 = 套色.replace('    .orbit::before {', 宿主插入);
    expect(期望).not.toBe(套色);
    expect(moduleCss).toBe(`${期望}\n`);
  });

  it('R3 落地补记：太极居中宿主适配行在场（demo 源太极偏位缺陷之居中，动画本体零动）', () => {
    expect(moduleCss).toContain('.orbit { display: grid; place-items: center; }');
  });

  it('R3 换色彻底：旧色四组字面量清零，新色两组在场（α 与写法不参与比较，此处只验 hue 无残留）', () => {
    for (const 旧 of ['143, 210, 197', '70, 170, 144', '214, 180, 110', '241, 217, 158']) {
      expect(moduleCss, `旧色残留: ${旧}`).not.toContain(旧);
    }
    for (const 新 of ['52, 73, 94', '176, 141, 87']) {
      expect(moduleCss, `新色缺失: ${新}`).toContain(新);
    }
  });

  it('7 条 @keyframes 整行在场（demo L229-235 行文本套 R3 映射；L231 trigram-pulse 含旧金已换项目金）', () => {
    if (!demo) return;
    for (let i = 228; i <= 234; i += 1) {
      const 行 = demoLines[i];
      expect(行, `demo L${i + 1} 应为 @keyframes`).toContain('@keyframes');
      const 期望行 = 换色(行);
      expect(moduleCss, `keyframes 行缺失: ${期望行}`).toContain(期望行);
    }
  });

  it('ring--energy / taiji background / particle animation 三行在场（含旧色者套 R3 映射）', () => {
    if (!demo) return;
    const 能量弧 = demoLines[120];
    const 太极底 = demoLines[178];
    const 粒子动画 = demoLines[225];
    expect(能量弧).toContain('.ring--energy');
    expect(太极底).toContain('linear-gradient(90deg, var(--gold-light) 50%, var(--deep) 50%)');
    expect(粒子动画).toContain('animation: twinkle var(--duration)');
    for (const 行 of [能量弧, 太极底, 粒子动画]) {
      const 期望行 = 换色(行);
      expect(moduleCss, `整行缺失: ${期望行}`).toContain(期望行);
    }
  });

  it('--teal 在 demo 即死变量（仅 :root 定义、全篇零引用）；被引 :root 变量组件已等值注入', () => {
    if (demo) {
      expect((demo.match(/teal/g) ?? []).length).toBe(1); // 仅 --teal: #8fd2c5 一处
      expect(demoLines[14]).toContain('--teal: #8fd2c5');
    }
    expect(moduleCss).not.toContain('var(--teal');
    // 复制段实际引用的三个 :root 变量由组件内联注入；R3 改色令（契约 §5.6）后
    // 注入值=项目黛蓝/项目金（demo 原值 #0b2427/rgba(226,194,121,.2)/#f1d99e 已按映射单替换）。
    expect(组件源码).toContain("'--deep': '#34495e'");
    expect(组件源码).toContain("'--line': 'rgba(176, 141, 87, .2)'");
    expect(组件源码).toContain("'--gold-light': '#b08d57'");
    expect(组件源码, '组件旧色残留').not.toContain('#0b2427');
    expect(组件源码, '组件旧色残留').not.toContain('226, 194, 121');
    expect(组件源码, '组件旧色残留').not.toContain('#f1d99e');
  });

  it('reduced-motion 门控块逐字在 globals.css（* 非纯选择器不可入 CSS Module，宿主移置；module 无）', () => {
    if (demo) {
      for (const 行 of [demoLines[246], demoLines[247], demoLines[248]]) {
        expect(行).not.toContain('.hero');
        expect(css, `globals.css 缺逐字行: ${行}`).toContain(行);
      }
    }
    expect(moduleCss).not.toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('组件复刻 5200ms 轮播与 matchMedia 门控；orbit --radius 内联逐字', () => {
    expect(组件源码).toContain('5200');
    expect(组件源码).toContain("matchMedia('(prefers-reduced-motion: reduce)')");
    expect(组件源码).toContain("'--radius': 'clamp(128px, 27vw, 205px)'");
  });
});

describe('② 粒子位常量（demo 元组逐值保真、零随机）', () => {
  /** 从 demo HTML 抠出粒子元组数组并求值（L298-311 的字面量部分）。 */
  function 抠出demo粒子(): readonly (readonly string[])[] {
    if (!demo) {
      return [
        ['19%', '31%', '2.8s', '-1.4s'],
        ['77%', '24%', '3.4s', '-.8s'],
        ['15%', '72%', '4.1s', '-2.7s'],
        ['83%', '67%', '2.6s', '-1.9s'],
        ['35%', '13%', '3.7s', '-2.1s'],
        ['65%', '86%', '3.1s', '-1.1s'],
        ['8%', '49%', '4.5s', '-3.2s'],
        ['92%', '46%', '3.9s', '-2.4s'],
      ];
    }
    const 匹配 = demo.match(
      /(\[\s*\[[\s\S]*?\]\s*\])\s*\.forEach\(\(\[x, y, duration, delay\]\)/,
    );
    expect(匹配, 'demo 粒子数组抠取失败').not.toBeNull();
    return new Function(`return ${匹配![1]}`)() as readonly (readonly string[])[];
  }

  /** 从组件源码抠出 粒子位 字面量并独立求值（真实 import 不可行的已裁等价手段）。 */
  function 抠出组件粒子(): readonly (readonly string[])[] {
    const 声明 = 组件源码.match(/export const 粒子位[^=]+=\s*(\[[\s\S]*?\n\]);/);
    expect(声明, '找不到 export const 粒子位 字面量声明').not.toBeNull();
    return new Function(`return ${声明![1]}`)() as readonly (readonly string[])[];
  }

  it('8 条且与 demo 元组逐值等（含 "-.8s" 原写法）', () => {
    const demo粒子 = 抠出demo粒子();
    const 组件粒子 = 抠出组件粒子();
    expect(组件粒子.length).toBe(8);
    expect(组件粒子).toEqual(demo粒子);
    expect(组件粒子.flat()).toContain('-.8s');
  });

  it('确定性：两次独立求值深等', () => {
    expect(抠出组件粒子()).toEqual(抠出组件粒子());
  });

  it('组件源码零 Math.random', () => {
    expect(组件源码).not.toContain('Math.random');
  });
});

describe('③ 尺寸 Record 字面量（唯一可调维度）', () => {
  it('sm=190 / md=320 / lg=460 字面量在场', () => {
    expect(组件源码).toMatch(/sm:\s*190/);
    expect(组件源码).toMatch(/md:\s*320/);
    expect(组件源码).toMatch(/lg:\s*460/);
    expect(组件源码).toContain('scale(${width / DEMO_WIDTH})');
  });
});

describe('④ globals.css 回滚守卫（改扮版增补撤净、旧样式健在）', () => {
  it('v4 增补无残留：bagua-* keyframes / .animate-* 新类 / feTurbulence noise 全无', () => {
    for (const 残渣 of [
      'bagua-spin',
      'animate-spin-slow',
      'animate-orbit-glow',
      'animate-twinkle',
      'feTurbulence',
      'background-blend-mode',
    ]) {
      expect(css, `回滚不净: ${残渣}`).not.toContain(残渣);
    }
  });

  it('ink-pulse / bonus-grow(+门控) / md-body / 表单控件段原样健在', () => {
    for (const 旧 of [
      'animate-ink-pulse',
      'animate-bonus-grow',
      'md-body',
      '表单控件统一墨线风格',
    ]) {
      expect(css, `旧样式丢失: ${旧}`).toContain(旧);
    }
  });
});
