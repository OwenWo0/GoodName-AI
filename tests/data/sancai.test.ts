import { describe, it, expect } from 'vitest'
import sancai from '@/data/sancai.json'

// 三才配置 125 条验收测试（数据层口径）
// 来源与抽查对表见 JSON _meta；五行三才 = 5^3 全组合

const WX = ['木', '火', '土', '金', '水'] as const
const JI_XIONG = ['大吉', '吉', '半吉', '凶', '大凶'] as const
const 配置 = sancai.配置

describe('sancai.json 结构', () => {
  it('恰好 125 条，键为全部 5^3 三才组合，无缺失无重复', () => {
    const keys = Object.keys(配置)
    expect(keys).toHaveLength(125)
    expect(new Set(keys).size).toBe(125)
    for (const a of WX) for (const b of WX) for (const c of WX)
      expect(keys, `${a}${b}${c}`).toContain(`${a}${b}${c}`)
  })

  it('每条目：吉凶合法、含义非空', () => {
    for (const [k, v] of Object.entries(配置)) {
      expect(JI_XIONG, k).toContain(v.吉凶)
      expect(v.含义.length, k).toBeGreaterThan(0)
    }
  })

  it('吉凶分布与 _meta.吉凶分布 完全一致', () => {
    const actual: Record<string, number> = {}
    for (const v of Object.values(配置)) actual[v.吉凶] = (actual[v.吉凶] ?? 0) + 1
    expect(actual).toEqual(sancai._meta.吉凶分布)
  })
})

describe('sancai.json 抽样值（排盘抽查锚点）', () => {
  const at = (k: string) => 配置[k as keyof typeof 配置].吉凶

  it.each([
    ['木木木', '大吉'],
    ['木木火', '大吉'],
    ['木木土', '大吉'],
    ['土土土', '大吉'],
    ['木木金', '凶'],
    ['木金木', '大凶'],
    ['火水水', '大凶'],
  ] as const)('%s = %s', (k, v) => expect(at(k)).toBe(v))
})
