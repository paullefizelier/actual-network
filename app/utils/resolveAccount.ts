export interface AccountLike {
  id: string
  siret: string | null
}

function normalizeSiret(s: string | null | undefined): string {
  return (s ?? '').replace(/\s+/g, '')
}

export function resolveAccount<T extends AccountLike>(
  existing: T[],
  { siret }: { siret: string | null | undefined }
): { match: T | null } {
  const normalized = normalizeSiret(siret)
  if (!normalized) return { match: null }
  const match = existing.find(a => normalizeSiret(a.siret) === normalized) ?? null
  return { match }
}
