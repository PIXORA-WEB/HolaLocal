export function mergeLocale(base, ...overrides) {
  const result = { ...base }

  for (const override of overrides) {
    for (const [key, value] of Object.entries(override ?? {})) {
      const baseValue = result[key]
      result[key] = value && typeof value === 'object' && !Array.isArray(value)
        ? mergeLocale(
            baseValue && typeof baseValue === 'object' && !Array.isArray(baseValue) ? baseValue : {},
            value,
          )
        : value
    }
  }

  return result
}
