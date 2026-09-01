import { describe, it, expect } from 'vitest'
import shuli from '@/data/shuli-81.json'

// 姓名学 81 数理吉凶表验收测试（数据层口径）
// 来源与交叉校验见 JSON _meta

const 数理 = shuli.数理
// 大凶统一并入凶档（映射规则见 _meta.吉凶映射），故合法档位仅四种
const JI_XIONG = ['大吉', '吉', '半吉', '凶'] as const

describe('shuli-81.json 结构', () => {
  it('恰好 81 条，键为 1..81', () => {
    const keys = Object.keys(数理)
    expect(keys).toHaveLength(81)
    for (let n = 1; n <= 81; n++) expect(keys, String(n)).toContain(String(n))
  })

  it('每条目：吉凶档位合法、诗号/含义/关键词非空', () => {
    for (const [n, v] of Object.entries(数理)) {
      expect(JI_XIONG, n).toContain(v.吉凶)
      expect(v.诗号.length, n).toBeGreaterThan(0)
      expect(v.含义.length, n).toBeGreaterThan(0)
      expect(v.关键词.length, n).toBeGreaterThan(0)
    }
  })

  it('吉凶分布与 _meta.吉凶分布 完全一致', () => {
    const actual: Record<string, number> = {}
    for (const v of Object.values(数理)) actual[v.吉凶] = (actual[v.吉凶] ?? 0) + 1
    expect(actual).toEqual(shuli._meta.吉凶分布)
  })

  it('原始吉凶 仅存于被映射改档的条目（映射规则自证）', () => {
    for (const [n, v] of Object.entries(数理)) {
      const orig = (v as { 原始吉凶?: string }).原始吉凶
      if (orig === undefined) continue
      // 映射规则：大凶→凶，其余不改；凡带原始吉凶者必为大凶且映射后为凶
      expect(orig, n).toBe('大凶')
      expect(v.吉凶, n).toBe('凶')
    }
  })
})

describe('shuli-81.json 抽样值（诗号锚点）', () => {
  const at = (n: number) => 数理[String(n) as keyof typeof 数理]

  it.each([
    [1, '吉', '太极之数'],
    [2, '凶', '两仪之数'],
    [3, '大吉', '三才之数'],
    [8, '吉', '八卦之数'],
    [10, '凶', '终结之数'],
    [81, '大吉', '万物回春'],
  ] as const)('%i = %s（%s）', (n, jx, sh) => {
    expect(at(n).吉凶).toBe(jx)
    expect(at(n).诗号).toBe(sh)
  })
})
