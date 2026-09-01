/**
 * C4 卡原语抽取守卫 + A4 迁移守卫（技法沿用 bagua-stage.test.ts 的源码抠取——
 * vitest 无 react 插件、含 JSX 的 .tsx 不可 import，行为级验证见 jiming-payload.test.ts）：
 * ① name-cards.tsx 冻结导出面（CandidateCard/名人卡/WugeMini/契合区/档位Class/Pager/翻页钮/PAGE_SIZE）；
 * ② juan7 瘦身：改 import name-cards、摘净名人模式（requestMingrenMatch/模式切换/名人 fetch 态）、
 *    兼容转发三原语（juan2/juan6 迁移前不断链）、like 文案改口、卷次改「卷六」且 id="juan7" 锚点健在、
 *    批次/意向/AI综解/AI终选外壳不动；
 * ③ 意向文案改口：「入卷六」绝迹，「入意向」在卡层落地。
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { mingrenMatchRequestSchema } from '@/lib/mingren/schema';

const SRC = path.resolve(__dirname, '../../src/components');
const cards = readFileSync(path.join(SRC, 'name-cards.tsx'), 'utf8');
const juan7 = readFileSync(path.join(SRC, 'juan7-jiming.tsx'), 'utf8');
const workbench = readFileSync(path.join(SRC, 'jiming-workbench.tsx'), 'utf8');

describe('name-cards.tsx 导出面（C4 冻结）', () => {
  it.each([
    'export const PAGE_SIZE',
    'export function CandidateCard',
    'export function MingrenCandidateCard',
    'export function WugeMini',
    'export function 契合区',
    'export const 档位Class',
    'export function Pager',
    'export function LikeButton',
    'export const 翻页钮',
  ])('含 %s', (needle) => {
    expect(cards).toContain(needle);
  });
  it('PAGE_SIZE=5（任务 #28 定值不漂移）', () => {
    expect(cards).toMatch(/export const PAGE_SIZE = 5;/);
  });
  it('like 文案改口「入意向」，旧「入卷六」绝迹', () => {
    expect(cards).toContain("'♥ 已入意向'");
    expect(cards).toContain("'♡ 入意向'");
    expect(cards).not.toContain('入卷六');
  });
});

describe('juan7-jiming.tsx 瘦身（名人模式摘除）', () => {
  it('卡原语改从 name-cards import', () => {
    expect(juan7).toContain("from './name-cards'");
    expect(juan7).toContain('CandidateCard');
    expect(juan7).toContain('PAGE_SIZE');
    expect(juan7).toContain('Pager');
  });
  it('名人匹配职责迁出：零 requestMingrenMatch / 模式切换 / AbortController', () => {
    expect(juan7).not.toContain('requestMingrenMatch');
    expect(juan7).not.toContain('名人匹配');
    expect(juan7).not.toContain('AbortController');
    expect(juan7).not.toContain('MingrenCandidateCard');
  });
  it('兼容转发：WugeMini/契合区/档位Class 仍自本文件可得（juan2/juan6 迁移前不断链）', () => {
    expect(juan7).toContain("export { WugeMini, 契合区, 档位Class } from './name-cards';");
  });
  it('卷次改「卷六」且 id="juan7" 锚点保留防死链', () => {
    expect(juan7).toContain('卷="卷六"');
    expect(juan7).toContain('id="juan7"');
    expect(juan7).not.toContain('卷="卷七"');
    expect(juan7).not.toContain('入卷六');
  });
  it('批次/意向控制与 AI 综解/终选外壳健在', () => {
    for (const needle of [
      'export interface 批次控制',
      'export interface 意向控制',
      '<AiAnswer',
      '<AiNaming',
      'BatchBar',
      '无一生还',
    ]) {
      expect(juan7).toContain(needle);
    }
  });
});

describe('/jiming 工作台接线（C7/C2/C1 契约）', () => {
  it('经 draft-memory 回填 + XiYongSourcePanel 组盘 + name-cards 渲染', () => {
    expect(workbench).toContain("from '@/utils/draft-memory'");
    expect(workbench).toContain('loadLastChart');
    expect(workbench).toContain('loadLastInput');
    expect(workbench).toContain('XiYongSourcePanel');
    expect(workbench).toContain('解析五行来源');
    expect(workbench).toContain('MingrenCandidateCard');
  });
  it('zod 客户端预校验（与服务端同源 schema）+ 服务端调用', () => {
    expect(workbench).toContain('mingrenMatchRequestSchema.safeParse');
    expect(workbench).toContain('requestMingrenMatch');
  });
  it('like→addIntentEntry 点赞；不传排除已选（已点赞者留驻高亮）', () => {
    expect(workbench).toContain("addIntentEntry(名, '点赞')");
    expect(workbench).not.toContain('排除已选');
  });
});

describe('mingrenMatchRequestSchema 双保险口径（客户端预校验复用服务端 schema）', () => {
  it('合法最小载荷过闸且默认值生效', () => {
    const r = mingrenMatchRequestSchema.safeParse({
      姓氏: '王',
      性别: '男',
      喜用神: ['水'],
    });
    expect(r.success).toBe(true);
  });
  it('喜忌同五行相犯拒（超 refine）', () => {
    const r = mingrenMatchRequestSchema.safeParse({
      姓氏: '王',
      性别: '男',
      名字形式: '双名',
      喜用神: ['水'],
      忌神: ['水'],
    });
    expect(r.success).toBe(false);
  });
});
