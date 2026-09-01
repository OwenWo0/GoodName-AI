import { describe, it, expect } from 'vitest'
import buzz from '@/data/buzz-names.json'
import standardChars from '@/data/standard-chars.json'

const allChars = new Set([...standardChars['一级'], ...standardChars['二级'], ...standardChars['三级']])

describe('buzz-names.json 结构', () => {
  it('JSON 可 import 且含 _meta/names/chars', () => {
    expect(buzz).toHaveProperty('_meta')
    expect(Array.isArray(buzz.names)).toBe(true)
    expect(typeof buzz.chars).toBe('object')
  })

  it('_meta 记录来源与年份', () => {
    const meta = buzz._meta as { 来源: { url: string }[]; 年份: string[] }
    expect(meta.来源.length).toBeGreaterThanOrEqual(2)
    expect(meta.来源.every((s) => s.url.startsWith('http'))).toBe(true)
    expect(meta.年份).toContain('2020')
  })
})

describe('names 爆款名', () => {
  it('非空、无重复、均为 1 字及以上（报告含单字爆款名如“涛”）', () => {
    expect(buzz.names.length).toBeGreaterThan(0)
    expect(new Set(buzz.names).size).toBe(buzz.names.length)
    expect(buzz.names.every((n) => Array.from(n).length >= 1)).toBe(true)
  })

  it('收录报告依据中的代表作（2020 男女 TOP10、2021 榜首、2024 临沂榜首）', () => {
    for (const n of ['梓涵', '欣怡', '奕辰', '宇轩', '浩宇', '沐宸', '若汐', '瑞泽', '一诺']) {
      expect(buzz.names).toContain(n)
    }
  })
})

describe('chars 热度权重', () => {
  it('权重均在 (0, 1] 区间', () => {
    for (const [ch, w] of Object.entries(buzz.chars)) {
      expect(w, ch).toBeGreaterThan(0)
      expect(w, ch).toBeLessThanOrEqual(1)
    }
  })

  it('键均为单码位汉字', () => {
    for (const ch of Object.keys(buzz.chars)) {
      expect(Array.from(ch), ch).toHaveLength(1)
      expect(allChars.has(ch), ch).toBe(true) // 爆款用字必须都是规范表内字
    }
  })

  it('每个 names 的构成字都在 chars 中有热度依据', () => {
    for (const name of buzz.names) {
      for (const ch of Array.from(name)) {
        expect(buzz.chars, `${name} 的 ${ch}`).toHaveProperty(ch)
      }
    }
  })

  it('2021 榜首用字权重高于仅地方榜首用字', () => {
    expect(buzz.chars['宸']).toBeGreaterThan(buzz.chars['瑞'])
  })
})
