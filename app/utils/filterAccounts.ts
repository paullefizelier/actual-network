type AccountRow = {
  name: string
  siret: string | null
  current_status: string
  [key: string]: unknown
}

export function filterAccounts(
  rows: AccountRow[],
  { search, status }: { search: string; status: string | null }
): AccountRow[] {
  const q = search.trim().toLowerCase()
  return rows.filter((row) => {
    const matchesSearch =
      !q ||
      row.name.toLowerCase().includes(q) ||
      (row.siret ?? '').toLowerCase().includes(q)
    const matchesStatus = status === null || row.current_status === status
    return matchesSearch && matchesStatus
  })
}
