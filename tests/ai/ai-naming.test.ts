import { describe, expect, it } from 'vitest';
import {
  FINAL_NAMING_SYSTEM_PROMPT,
  buildFinalNamingMessages,
  起名偏好指引句,
} from '@/lib/ai/prompt-final-naming';
import { DISCLAIMER_TEXT } from '@/lib/ai/prompt';
import type { ChartResult } from '@/lib/types';
import type { EvaluatedName } from '@/lib/evaluate/types';

const zhu = (天干: string, 地支: string, 干支: string, 藏干: string[], 十神: string[], 纳音: string) => ({
  天干, 地支, 干支, 藏干, 十神, 纳音,
});

const mockChart: ChartResult = {
  输入: {
    姓氏: '林',
    性别: '男',
    出生地经度: 116.4,
    北京时间: '2026-08-30 12:00:00',
    避讳字: [],
  },
  bazi: {
    四柱: {
      年: zhu('丙', '午', '丙午', ['丁', '己'], ['偏财', '正官'], '天河水'),
      月: zhu('丙', '申', '丙申', ['庚', '壬', '戊'], ['偏印', '比肩', '七杀'], '山下火'),
      日: zhu('壬', '戌', '壬戌', ['戊', '辛', '丁'], ['七杀', '正印', '正财'], '大海水'),
      时: zhu('丙', '午', '丙午', ['丁', '己'], ['偏财', '正官'], '天河水'),
    },
    日主: '壬',
    五行力量: [
      { 五行: '火', 得分: 55, 来源: ['年干丙:25', '月干丙:15', '年支午本气丁:15'] },
      { 五行: '水', 得分: 20, 来源: ['日主壬:15', '月支申中壬:5'] },
      { 五行: '木', 得分: 0, 来源: [] },
      { 五行: '金', 得分: 10, 来源: ['月支申本气庚:7', '日支戌中辛:3'] },
      { 五行: '土', 得分: 5, 来源: ['日支戌本气戊:5'] },
    ],
    五行缺失: ['木'],
    大运: [],
    真太阳时: {
      输入北京时间: '2026-08-30 12:00:00',
      校正分钟: -14.4,
      校正后本地时间: '2026-08-30 11:45:36',
      地点经度: 116.4,
    },
    晚子时流派: '不涉及',
  },
  wuge: null,
  xiyongshen: {
    日主: '壬',
    强弱得分: -10,
    强弱等级: '偏弱',
    得令: { 支持: false, 说明: '申月金旺水相，然火炎土燥失令' },
    得地: { 支持: true, 说明: '日支戌中辛金暗生' },
    得势: { 支持: false, 说明: '天干三火夹克，比劫孤立' },
    扶抑: { 五行: ['水', '金'], 策略: '扶抑日主壬水，补水金' },
    调候: { 五行: ['水'], 依据: '夏秋之交火炎燥热，取水调候润泽' },
    喜用神: ['水', '金'],
    忌神: ['火', '土'],
    冲突: false,
  },
  candidates: [],
};

const mockEvaluated: EvaluatedName = {
  名: '景行',
  表外字: [],
  五行: ['木', '水'],
  平仄: {
    逐字: [],
    平仄格式: '平仄',
    体系: 'putonghua',
    绕口风险: null,
    谐音风险: null,
    字表校验: { 全部在通用规范汉字表: true, 表外字: [] },
  },
  五格: null,
  爆款度: 0.1,
  契合: {
    命中喜用: ['水'],
    命中次用: ['木'],
    命中忌神: [],
    档位: '上',
    分: 95,
    说明: ['命中喜用神 水', '命中次用神 木'],
  },
};

describe('AI 终选起名 Prompt 构造器 (prompt-final-naming.ts)', () => {
  it('System Prompt 明确审美第一、严格契合性别风貌、杜绝男女误用与免责声明', () => {
    expect(FINAL_NAMING_SYSTEM_PROMPT).toContain('【文学审美与意境为王】');
    expect(FINAL_NAMING_SYSTEM_PROMPT).toContain('【严格契合性别风貌（重中之重）】');
    expect(FINAL_NAMING_SYSTEM_PROMPT).toContain('坚决禁止男生女名');
    expect(FINAL_NAMING_SYSTEM_PROMPT).toContain('坚决禁止女生男名');
    expect(FINAL_NAMING_SYSTEM_PROMPT).toContain('【男宝命名风骨】');
    expect(FINAL_NAMING_SYSTEM_PROMPT).toContain('【女宝命名风骨】');
    expect(FINAL_NAMING_SYSTEM_PROMPT).toContain('【意蕴深厚有据】');
    expect(FINAL_NAMING_SYSTEM_PROMPT).toContain(DISCLAIMER_TEXT);
  });

  it('buildFinalNamingMessages 注入性别风貌要求与全盘数据', () => {
    const messages = buildFinalNamingMessages({
      chart: mockChart,
      意向名单: ['景行', '知远'],
      意向评估: [mockEvaluated],
    });

    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toBe(FINAL_NAMING_SYSTEM_PROMPT);
    expect(messages[1].role).toBe('user');
    expect(messages[1].content).toContain('男宝宝专属气质');
    expect(messages[1].content).toContain('家长心仪意向名单');
    expect(messages[1].content).toContain('景行');
    expect(messages[1].content).toContain('【终选起名核心指令】');
  });

  it('意向名单为空时同样合法构造并注入性别指令', () => {
    const messages = buildFinalNamingMessages({
      chart: mockChart,
    });

    expect(messages).toHaveLength(2);
    expect(messages[1].content).toContain('宝宝性别为【男】');
    expect(messages[1].content).not.toContain('家长心仪意向名单');
    expect(messages[1].content).toContain('【终选起名核心指令】');
    expect(messages[1].content).not.toContain('【家长起名偏好】');
  });

  it('起名偏好非空 → user 消息含【家长起名偏好】段、原文与指引句', () => {
    const messages = buildFinalNamingMessages(
      { chart: mockChart },
      '偏好三字名；想要有水汽意象；避开网红爆款感；忌多音字',
    );

    const 用户消息 = messages[1].content;
    expect(用户消息).toContain('【家长起名偏好】');
    expect(用户消息).toContain('偏好三字名；想要有水汽意象；避开网红爆款感；忌多音字');
    expect(用户消息).toContain(起名偏好指引句);
    expect(用户消息).toContain('红线优先');
  });

  it('起名偏好缺省 / 空串 / 纯空白 → 不注入偏好段（向后兼容）', () => {
    const 缺省 = buildFinalNamingMessages({ chart: mockChart });
    const 空串 = buildFinalNamingMessages({ chart: mockChart }, '');
    const 空白 = buildFinalNamingMessages({ chart: mockChart }, '   \n  ');

    for (const messages of [缺省, 空串, 空白]) {
      expect(messages[1].content).not.toContain('【家长起名偏好】');
    }
    expect(缺省[1].content).toBe(空串[1].content);
  });

  it('起名偏好 500 字边界 → 原文完整注入不截断；501 字仍注入（截断由 route zod 把关）', () => {
    const 五百字 = '水'.repeat(500);
    const 五百零一字 = '水'.repeat(501);

    expect(buildFinalNamingMessages({ chart: mockChart }, 五百字)[1].content).toContain(五百字);
    expect(buildFinalNamingMessages({ chart: mockChart }, 五百零一字)[1].content).toContain(
      五百零一字,
    );
  });

  it('偏好段与意向名单共存时互不干扰，均注入', () => {
    const messages = buildFinalNamingMessages(
      { chart: mockChart, 意向名单: ['景行'] },
      '忌多音字',
    );

    const 用户消息 = messages[1].content;
    expect(用户消息).toContain('家长心仪意向名单');
    expect(用户消息).toContain('【家长起名偏好】');
    expect(用户消息).toContain('忌多音字');
  });
});
