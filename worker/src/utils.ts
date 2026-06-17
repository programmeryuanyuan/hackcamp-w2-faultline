export async function withRetry<T>(
  fn: () => Promise<T>,
  label: string
): Promise<T | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (attempt === 0) {
        console.warn(`[${label}] attempt 1 failed, retrying…`)
      } else {
        console.warn(`[${label}] attempt 2 failed, skipping round:`, (err as Error).message)
      }
    }
  }
  return null
}
