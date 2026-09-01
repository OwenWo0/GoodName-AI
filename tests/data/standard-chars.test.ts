import { describe, it, expect } from 'vitest'
import standardChars from '@/data/standard-chars.json'

// 官方口径：《通用规范汉字表》（国发〔2013〕23号）总 8105 字 = 一级 3500 + 二级 3000 + 三级 1605
// 锚点字来自多来源交叉核验（见 docs/research/05-字表数据核验.md），顺序为官方笔画序编号 1..8105
const LEVELS = ['一级', '二级', '三级'] as const
const EXPECTED_COUNTS: Record<(typeof LEVELS)[number], number> = { 一级: 3500, 二级: 3000, 三级: 1605 }

const all = [...standardChars['一级'], ...standardChars['二级'], ...standardChars['三级']]

const take = (level: (typeof LEVELS)[number], start: number, count: number) =>
  standardChars[level].slice(start, start + count)

describe('standard-chars.json 结构', () => {
  it('JSON 可 import 且只有三级键', () => {
    expect(Object.keys(standardChars).sort()).toEqual([...LEVELS].sort())
  })

  it('每级都是字符串数组', () => {
    for (const level of LEVELS) {
      expect(Array.isArray(standardChars[level])).toBe(true)
      expect(standardChars[level].every((c) => typeof c === 'string')).toBe(true)
    }
  })
})

describe('各级条目数 = 官方数', () => {
  for (const level of LEVELS) {
    it(`${level} ${EXPECTED_COUNTS[level]} 字`, () => {
      expect(standardChars[level]).toHaveLength(EXPECTED_COUNTS[level])
    })
  }

  it('总数 8105', () => {
    expect(all).toHaveLength(8105)
  })
})

describe('单字符与无重复', () => {
  it('全部为单一 Unicode 码位（含辅助平面扩展字，用 Array.from 判）', () => {
    const bad = all.filter((c) => Array.from(c).length !== 1)
    expect(bad).toEqual([])
  })

  it('全表无重复字', () => {
    expect(new Set(all).size).toBe(8105)
  })
})

describe('锚点字抽样（笔画序首/中/尾三元组）', () => {
  it('一级：首 一乙二 / 中 柔垒绑 / 尾 瓤罐矗', () => {
    expect(take('一级', 0, 3)).toEqual(['一', '乙', '二'])
    expect(take('一级', 1749, 3)).toEqual(['柔', '垒', '绑'])
    expect(take('一级', 3497, 3)).toEqual(['瓤', '罐', '矗'])
  })

  it('二级：首 乂乜兀 / 中 袷裉谒 / 尾 戆爨齉', () => {
    expect(take('二级', 0, 3)).toEqual(['乂', '乜', '兀'])
    expect(take('二级', 1499, 3)).toEqual(['袷', '裉', '谒'])
    expect(take('二级', 2997, 3)).toEqual(['戆', '爨', '齉'])
  })

  it('三级：首 亍尢彳 / 中 惎萳葙 / 尾 齇觿蠼', () => {
    expect(take('三级', 0, 3)).toEqual(['亍', '尢', '彳'])
    expect(take('三级', 801, 3)).toEqual(['惎', '萳', '葙'])
    expect(take('三级', 1602, 3)).toEqual(['齇', '觿', '蠼'])
  })

  it('全表末字为 蠼（总编号 8105）', () => {
    expect(all[8104]).toBe('蠼')
  })
})

describe('已知归属字', () => {
  it('鑫 在二级（官方编号 6490，常见误解为三级）', () => {
    expect(standardChars['二级']).toContain('鑫')
    expect(standardChars['一级']).not.toContain('鑫')
    expect(standardChars['三级']).not.toContain('鑫')
    expect(standardChars['二级'].indexOf('鑫')).toBe(2989) // 3501+2989 = 6490
  })

  it('珲 在二级（恢复规范传承字）', () => {
    expect(standardChars['二级']).toContain('珲')
    expect(standardChars['二级'].indexOf('珲')).toBe(909) // 3501+909 = 4410
  })
})
