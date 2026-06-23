import { normalizeSiret } from './normalizeSiret'

export interface AccountLike {
  id: string
  siret: string | null
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
