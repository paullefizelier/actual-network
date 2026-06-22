// test/rls/isolation.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const URL = process.env.NUXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NUXT_PUBLIC_SUPABASE_KEY!
const SERVICE = process.env.NUXT_SUPABASE_SECRET_KEY!

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } })

let clientA: string
let clientB: string
let userId: string
const userA = { email: 'a@test.dev', password: 'password123' }

beforeAll(async () => {
  // Seed deux clients + un compte chacun, via service role (bypass RLS)
  const { data: ca } = await admin.from('clients').insert({ name: 'A', slug: 'a' }).select().single()
  const { data: cb } = await admin.from('clients').insert({ name: 'B', slug: 'b' }).select().single()
  clientA = ca!.id
  clientB = cb!.id
  await admin.from('accounts').insert({ client_id: clientA, name: 'Compte A' })
  await admin.from('accounts').insert({ client_id: clientB, name: 'Compte B' })

  // Créer userA, membre de clientA seulement
  const { data: u } = await admin.auth.admin.createUser({ email: userA.email, password: userA.password, email_confirm: true })
  userId = u.user!.id
  await admin.from('memberships').insert({ user_id: userId, client_id: clientA, role: 'admin' })
})

afterAll(async () => {
  // Nettoyer la base distante : cascade supprime comptes/memberships
  await admin.from('clients').delete().in('id', [clientA, clientB])
  if (userId) await admin.auth.admin.deleteUser(userId)
})

describe('RLS multi-tenant isolation', () => {
  it('un membre de A ne voit que les comptes de A', async () => {
    const c = createClient(URL, ANON, { auth: { persistSession: false } })
    await c.auth.signInWithPassword(userA)
    const { data } = await c.from('accounts').select('client_id')
    expect(data).toBeTruthy()
    expect(data!.every(r => r.client_id === clientA)).toBe(true)
    expect(data!.length).toBe(1)
  })
})
