import { describe, it, expect } from 'vitest'
import { charDetail } from 'shunshi-kangxi-core'
import overrides from '@/data/kangxi-overrides.json'

// 康熙笔画特例覆盖表验收测试（数据层口径）
// 仅收录姓名学计算中需特判的部首归并字，口径见 _meta.说明

describe('kangxi-overrides.json', () => {
  const data = overrides as unknown as Record<string, unknown>

  it('萬 = 15（艹部按部首 6+9 计）、里 = 7', () => {
    expect(overrides.萬).toBe(15)
    expect(overrides.里).toBe(7)
  })

  it('_meta 外的每个覆盖值均为正整数', () => {
    const strokes = Object.entries(data).filter(([k]) => k !== '_meta')
    expect(strokes.length).toBeGreaterThanOrEqual(2)
    for (const [k, v] of strokes) {
      expect(Number.isInteger(v), k).toBe(true)
      expect(v as number, k).toBeGreaterThan(0)
    }
  })

  // 裁决（2026-08-29）：部首归并特例由字库内置，无需 override 补录；
  // 此守卫锁死该前提——若未来换库/升级导致口径回退为现代部首画数，此处先红。
  it('部首特例口径已由 charDetail 内置（氵水4/艹艸6/辶辵7/阝阜8邑7/忄心4/王玉5/月肉6/衤衣6）', () => {
    const cases: Array<[string, number]> = [
      ['沐', 8], ['芷', 10], ['迪', 12], ['阮', 12], ['邵', 12],
      ['怡', 9], ['玲', 10], ['肌', 8], ['袖', 11],
    ]
    for (const [字, 画] of cases) {
      expect(charDetail(字)?.康熙笔画, 字).toBe(画)
    }
  })
})
