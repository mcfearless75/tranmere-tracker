import { sumMacros } from '@/lib/utils'

describe('sumMacros', () => {
  it('sums nutrition log entries', () => {
    const logs = [
      { calories: 400, protein_g: 30, carbs_g: 50, fat_g: 10 },
      { calories: 200, protein_g: 15, carbs_g: 20, fat_g: 5 },
    ]
    const result = sumMacros(logs)
    expect(result.calories).toBe(600)
    expect(result.protein_g).toBeCloseTo(45)
    expect(result.carbs_g).toBeCloseTo(70)
    expect(result.fat_g).toBeCloseTo(15)
  })

  it('returns zeros for empty array', () => {
    const result = sumMacros([])
    expect(result.calories).toBe(0)
    expect(result.protein_g).toBe(0)
  })
})
