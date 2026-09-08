export type WeightUnit = 'kg' | 'lb'

const LB_TO_KG = 0.453592

export function toKg(weight: number | null, unit: WeightUnit | null): number | null {
  if (weight == null || unit == null) return null
  return unit === 'lb' ? weight * LB_TO_KG : weight
}
