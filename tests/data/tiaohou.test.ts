import { describe, it, expect } from 'vitest'
import tiaohou from '@/data/tiaohou.json'

// 《穷通宝鉴》调候用神表验收测试（数据层口径；与 tests/xiyong/tiaohou.test.ts 的契约测试互补）
// 来源与逐格校订依据见 JSON _meta 与 docs/research/06-调候表核验.md

const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const
const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const
const WUXING = ['木', '火', '土', '金', '水'] as const
const GAN_OR_ZHI = new Set<string>([...GAN, ...ZHI])

const entries = tiaohou.表
const keyOf = (e: { 日主: string; 月支: string }) => `${e.日主}-${e.月支}`

describe('tiaohou.json 结构', () => {
  it('恰好 120 格（10 日主 × 12 月支），无缺失无重复', () => {
    expect(entries).toHaveLength(120)
    const keys = entries.map(keyOf)
    expect(new Set(keys).size).toBe(120)
    for (const g of GAN) for (const z of ZHI) expect(keys).toContain(`${g}-${z}`)
  })

  it('调候五行：非空、合法五行、格内不重复、不含天干地支字', () => {
    for (const e of entries) {
      expect(e.调候五行.length, keyOf(e)).toBeGreaterThan(0)
      const seen = new Set<string>()
      for (const w of e.调候五行) {
        expect(WUXING, `${keyOf(e)}: ${w}`).toContain(w)
        expect(GAN_OR_ZHI.has(w), `${keyOf(e)} 混入干支字: ${w}`).toBe(false)
        expect(seen.has(w), `${keyOf(e)} 五行重复: ${w}`).toBe(false)
        seen.add(w)
      }
    }
  })

  it('依据均为原文摘句且非空；_meta 记录来源与校勘记', () => {
    for (const e of entries) expect(e.依据.length, keyOf(e)).toBeGreaterThan(0)
    expect(tiaohou._meta.来源).toContain('穷通宝鉴')
    expect(tiaohou._meta.校勘记.length).toBeGreaterThan(0)
  })
})

describe('tiaohou.json 抽样值（原文锚点）', () => {
  const at = (g: string, z: string) =>
    entries.find((e) => e.日主 === g && e.月支 === z)!.调候五行

  // 排盘下游依赖的硬锚点（与 tests/xiyong/tiaohou.test.ts 所钉一致）
  const anchors: Record<string, string[]> = {
    甲子: ['火', '金'],
    乙寅: ['火', '水'],
    丙午: ['水'],
    丁未: ['木', '水'],
    戊午: ['水', '木', '火'],
    己巳: ['水', '火', '金'],
    庚辰: ['木', '火'],
    辛亥: ['水', '火'],
    壬申: ['土', '火'],
    癸酉: ['金', '火'],
    壬丑: ['火', '木'],
  }
  for (const [k, v] of Object.entries(anchors)) {
    it(`${k} = [${v.join('')}]`, () => {
      expect(at(k.slice(0, 1), k.slice(1))).toEqual(v)
    })
  }

  // 手工校订的代表性取舍（校勘记对应格）
  it('甲辰 先庚后壬→金水（不从简化表的水金序）', () => expect(at('甲', '辰')).toEqual(['金', '水']))
  it('甲午 先癸后丁庚次→火金俱全', () => expect(at('甲', '午')).toEqual(['水', '火', '金']))
  it('丁申/丁酉 三秋甲庚丙并用→木火金', () => {
    expect(at('丁', '申')).toEqual(['木', '火', '金'])
    expect(at('丁', '酉')).toEqual(['木', '火', '金'])
  })
  it('丁亥 甲尊庚佐、癸戊权宜不取→木金', () => expect(at('丁', '亥')).toEqual(['木', '金']))
  it('戊戌 先看甲次癸（丙为见金条件）→木水', () => expect(at('戊', '戌')).toEqual(['木', '水']))
  it('己戌 癸先丙后辛辅癸、九月甲疏→水火金木', () => expect(at('己', '戌')).toEqual(['水', '火', '金', '木']))
  it('庚未 忌癸伤丁，不取忌神水→火木', () => expect(at('庚', '未')).toEqual(['火', '木']))
  it('辛寅 先己后壬、己君庚佐→土水金', () => expect(at('辛', '寅')).toEqual(['土', '水', '金']))
  it('壬未 先辛癸次甲→金水木', () => expect(at('壬', '未')).toEqual(['金', '水', '木']))
  it('癸未 专用庚辛（比劫为条件句）→金', () => expect(at('癸', '未')).toEqual(['金']))
  it('乙丑 原文阙条、依共识丙先癸次→火水，且依据注明阙文', () => {
    expect(at('乙', '丑')).toEqual(['火', '水'])
    expect(entries.find((e) => e.日主 === '乙' && e.月支 === '丑')!.依据).toContain('阙')
  })
})
