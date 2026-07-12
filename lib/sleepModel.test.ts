import { describe, it, expect } from 'vitest'
import { recencyWeight, clipOutliersIQR, weightedMean, weightedStdDev } from './sleepModel'

describe('recencyWeight', () => {
  it('returns 1 for age 0', () => {
    expect(recencyWeight(0)).toBe(1)
  })

  it('returns 0.5 at the half-life', () => {
    expect(recencyWeight(5, 5)).toBeCloseTo(0.5, 5)
  })

  it('decays toward 0 for old observations', () => {
    expect(recencyWeight(50, 5)).toBeLessThan(0.01)
  })
})

describe('clipOutliersIQR', () => {
  it('removes values far outside the interquartile range', () => {
    const values = [60, 65, 70, 68, 62, 500]
    const clipped = clipOutliersIQR(values)
    expect(clipped).not.toContain(500)
    expect(clipped).toEqual(expect.arrayContaining([60, 65, 70, 68, 62]))
  })

  it('returns input unchanged when fewer than 4 values', () => {
    const values = [10, 500, 20]
    expect(clipOutliersIQR(values)).toEqual(values)
  })
})

describe('weightedMean', () => {
  it('returns 0 for an empty array', () => {
    expect(weightedMean([])).toBe(0)
  })

  it('weights higher-weight observations more heavily', () => {
    const mean = weightedMean([
      { value: 100, weight: 1 },
      { value: 200, weight: 3 },
    ])
    expect(mean).toBeCloseTo(175, 5)
  })
})

describe('weightedStdDev', () => {
  it('returns 0 for an empty array', () => {
    expect(weightedStdDev([], 0)).toBe(0)
  })

  it('returns 0 for a single observation', () => {
    expect(weightedStdDev([{ value: 100, weight: 1 }], 100)).toBe(0)
  })

  it('computes a positive spread for varied observations', () => {
    const obs = [
      { value: 60, weight: 1 },
      { value: 90, weight: 1 },
      { value: 120, weight: 1 },
    ]
    const mean = weightedMean(obs)
    expect(weightedStdDev(obs, mean)).toBeCloseTo(24.49, 1)
  })
})
