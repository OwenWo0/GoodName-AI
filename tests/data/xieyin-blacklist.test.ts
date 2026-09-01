import { describe, it, expect } from 'vitest'
import blacklist from '@/data/xieyin-blacklist.json'

// 普通话谐音黑名单验收测试（数据层口径）
// 收录原则与维护口径见 JSON _meta

const { patterns, charCombos } = blacklist

describe('xieyin-blacklist.json 结构', () => {
  it('patterns 31 条、charCombos 58 条，键均无重复', () => {
    // 注：_meta.条目统计.charCombos 写作 57，与实际条数 58 不符（已报团队 lead，以实数为准）
    expect(patterns).toHaveLength(31)
    expect(charCombos).toHaveLength(58)
    expect(new Set(patterns.map((p) => p.pattern)).size).toBe(31)
    expect(new Set(charCombos.map((c) => c.chars)).size).toBe(58)
  })

  it('patterns 为 2–4 字音近串；charCombos 均为 2 字组合', () => {
    for (const p of patterns) {
      expect(p.pattern.length, p.pattern).toBeGreaterThanOrEqual(2)
      expect(p.pattern.length, p.pattern).toBeLessThanOrEqual(4)
    }
    for (const c of charCombos) expect(c.chars.length, c.chars).toBe(2)
  })

  it('每条 reason 非空', () => {
    for (const p of patterns) expect(p.reason.length, p.pattern).toBeGreaterThan(0)
    for (const c of charCombos) expect(c.reason.length, c.chars).toBeGreaterThan(0)
  })
})

describe('xieyin-blacklist.json 抽样值（经典梗锚点）', () => {
  it('杜子腾 → 肚子疼', () =>
    expect(patterns.find((p) => p.pattern === '杜子腾')?.reason).toBe('肚子疼'))
  it('范统 → 饭桶', () =>
    expect(charCombos.find((c) => c.chars === '范统')?.reason).toBe('饭桶'))
  it('费才 → 废柴/废材', () =>
    expect(charCombos.find((c) => c.chars === '费才')?.reason).toBe('废柴/废材'))
})
