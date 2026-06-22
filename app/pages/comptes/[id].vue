<script setup lang="ts">
import { z } from 'zod'
import type { TableColumn } from '@nuxt/ui'
import type { Database } from '~/types/database'

type Account = Database['public']['Tables']['accounts']['Row']
type Contact = Database['public']['Tables']['contacts']['Row']
type Participation = Database['public']['Tables']['participations']['Row']
type EventRow = Database['public']['Tables']['events']['Row']

const route = useRoute()
const id = route.params.id as string
const toast = useToast()

const accountResource = useClientResource<Account>('accounts')
const contactResource = useClientResource<Contact>('contacts')
const participationResource = useClientResource<Participation>('participations')
const eventResource = useClientResource<EventRow>('events')

const account = ref<Account | null>(null)
const contacts = ref<Contact[]>([])
const participations = ref<Participation[]>([])
const eventMap = ref(new Map<string, { name: string, date: string | null }>())
const loading = ref(true)
const notFound = ref(false)

// --- Account edit modal ---
const openAccountEdit = ref(false)

const accountSchema = z.object({
  name: z.string().min(1, 'Nom requis'),
  siret: z.string().regex(/^\d{14}$/, 'SIRET = 14 chiffres').optional().or(z.literal('')),
  effectif: z.string().optional(),
  secteur: z.string().optional(),
  marche_public: z.boolean().optional(),
  current_status: z.enum(['suspect', 'prospect', 'client'])
})
type AccountState = z.output<typeof accountSchema>
const accountState = reactive<Partial<AccountState>>({
  name: '',
  siret: '',
  effectif: '',
  secteur: '',
  marche_public: false,
  current_status: 'suspect'
})

function openEditAccount() {
  if (!account.value) return
  Object.assign(accountState, {
    name: account.value.name,
    siret: account.value.siret ?? '',
    effectif: account.value.effectif ?? '',
    secteur: account.value.secteur ?? '',
    marche_public: account.value.marche_public,
    current_status: account.value.current_status
  })
  openAccountEdit.value = true
}

async function onSubmitAccount() {
  try {
    const payload = {
      name: accountState.name,
      siret: accountState.siret === '' ? null : (accountState.siret ?? null),
      effectif: accountState.effectif === '' ? null : (accountState.effectif ?? null),
      secteur: accountState.secteur === '' ? null : (accountState.secteur ?? null),
      marche_public: accountState.marche_public ?? false,
      current_status: accountState.current_status ?? 'suspect'
    }
    const updated = await accountResource.update(id, payload)
    account.value = updated
    toast.add({ title: 'Compte mis à jour', color: 'success' })
    openAccountEdit.value = false
  } catch {
    toast.add({ title: 'Échec de la mise à jour', color: 'error' })
  }
}

// --- Contacts ---
const openContact = ref(false)
const editingContact = ref<Contact | null>(null)

const contactSchema = z.object({
  nom: z.string().optional(),
  prenom: z.string().optional(),
  fonction: z.string().optional(),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  tel: z.string().optional(),
  lead_level: z.enum(['reseau', 'patron', 'interne']).optional()
})
type ContactState = z.output<typeof contactSchema>
const contactState = reactive<Partial<ContactState>>({
  nom: '',
  prenom: '',
  fonction: '',
  email: '',
  tel: '',
  lead_level: undefined
})

function openCreateContact() {
  editingContact.value = null
  Object.assign(contactState, { nom: '', prenom: '', fonction: '', email: '', tel: '', lead_level: undefined })
  openContact.value = true
}

function openEditContact(row: Contact) {
  editingContact.value = row
  Object.assign(contactState, {
    nom: row.nom ?? '',
    prenom: row.prenom ?? '',
    fonction: row.fonction ?? '',
    email: row.email ?? '',
    tel: row.tel ?? '',
    lead_level: row.lead_level ?? undefined
  })
  openContact.value = true
}

async function onSubmitContact() {
  try {
    const payload = {
      nom: contactState.nom || null,
      prenom: contactState.prenom || null,
      fonction: contactState.fonction || null,
      email: contactState.email === '' ? null : (contactState.email ?? null),
      tel: contactState.tel || null,
      lead_level: contactState.lead_level || null
    }
    if (editingContact.value) {
      const updated = await contactResource.update(editingContact.value.id, payload)
      const idx = contacts.value.findIndex(c => c.id === editingContact.value!.id)
      if (idx !== -1) contacts.value[idx] = updated
    } else {
      const created = await contactResource.create({ ...payload, account_id: id })
      contacts.value.push(created)
    }
    toast.add({ title: 'Contact enregistré', color: 'success' })
    openContact.value = false
  } catch {
    toast.add({ title: 'Échec de l\'enregistrement', color: 'error' })
  }
}

async function onDeleteContact(row: Contact) {
  try {
    await contactResource.remove(row.id)
    contacts.value = contacts.value.filter(c => c.id !== row.id)
    toast.add({ title: 'Contact supprimé', color: 'success' })
  } catch {
    toast.add({ title: 'Échec de la suppression', color: 'error' })
  }
}

// --- Load ---
async function loadData() {
  loading.value = true
  notFound.value = false
  try {
    const [allAccounts, allContacts, allParticipations, allEvents] = await Promise.all([
      accountResource.list({ order: 'name', ascending: true }),
      contactResource.list({ order: 'created_at', ascending: false }),
      participationResource.list({ order: 'entered_network_at', ascending: false }),
      eventResource.list({ order: 'date', ascending: false })
    ])

    account.value = allAccounts.find(a => a.id === id) ?? null
    if (!account.value) {
      notFound.value = true
      return
    }

    contacts.value = allContacts.filter(c => c.account_id === id)
    participations.value = allParticipations.filter(p => p.account_id === id)

    const map = new Map<string, { name: string, date: string | null }>()
    for (const ev of allEvents) {
      map.set(ev.id, { name: ev.name, date: ev.date ?? null })
    }
    eventMap.value = map
  } catch {
    toast.add({ title: 'Erreur de chargement', color: 'error' })
  } finally {
    loading.value = false
  }
}

onMounted(loadData)

// --- Badge colors ---
const statusBadgeColor: Record<string, 'neutral' | 'warning' | 'success'> = {
  suspect: 'neutral',
  prospect: 'warning',
  client: 'success'
}

const directionBadgeColor: Record<string, 'primary' | 'secondary'> = {
  direct: 'primary',
  indirect: 'secondary'
}

const leadLevelLabel: Record<string, string> = {
  reseau: 'Réseau',
  patron: 'Patron',
  interne: 'Interne'
}

// --- Columns ---
const contactColumns: TableColumn<Contact>[] = [
  { accessorKey: 'nom', header: 'Nom' },
  { accessorKey: 'prenom', header: 'Prénom' },
  { accessorKey: 'fonction', header: 'Fonction' },
  { accessorKey: 'email', header: 'Email' },
  { accessorKey: 'tel', header: 'Téléphone' },
  { id: 'lead_level', header: 'Niveau lead' },
  { id: 'actions' }
]

const participationColumns: TableColumn<Participation>[] = [
  { id: 'event_name', header: 'Événement' },
  { id: 'event_date', header: 'Date' },
  { id: 'direction', header: 'Direction' },
  { id: 'status_at_entry', header: 'Statut à l\'entrée' },
  { accessorKey: 'category', header: 'Catégorie' },
  { accessorKey: 'notes', header: 'Notes' }
]
</script>

<template>
  <div class="space-y-6">
    <!-- Back link -->
    <div>
      <NuxtLink
        to="/comptes"
        class="text-sm text-muted hover:underline flex items-center gap-1"
      >
        <UIcon
          name="i-lucide-arrow-left"
          class="size-4"
        />
        Retour aux comptes
      </NuxtLink>
    </div>

    <!-- Loading -->
    <div
      v-if="loading"
      class="flex justify-center py-12"
    >
      <UIcon
        name="i-lucide-loader-circle"
        class="size-8 animate-spin text-muted"
      />
    </div>

    <!-- Not found -->
    <UAlert
      v-else-if="notFound"
      color="error"
      title="Compte introuvable"
      description="Ce compte n'existe pas ou vous n'y avez pas accès."
    />

    <template v-else-if="account">
      <!-- Identity card -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <h1 class="text-xl font-semibold">
                {{ account.name }}
              </h1>
              <UBadge
                :color="statusBadgeColor[account.current_status] ?? 'neutral'"
                variant="subtle"
              >
                {{ account.current_status }}
              </UBadge>
            </div>
            <UButton
              icon="i-lucide-pencil"
              color="neutral"
              variant="ghost"
              @click="openEditAccount"
            >
              Modifier
            </UButton>
          </div>
        </template>

        <dl class="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3">
          <div>
            <dt class="text-xs text-muted font-medium uppercase tracking-wide">
              SIRET
            </dt>
            <dd class="mt-1 text-sm">
              {{ account.siret ?? '—' }}
            </dd>
          </div>
          <div>
            <dt class="text-xs text-muted font-medium uppercase tracking-wide">
              Effectif
            </dt>
            <dd class="mt-1 text-sm">
              {{ account.effectif ?? '—' }}
            </dd>
          </div>
          <div>
            <dt class="text-xs text-muted font-medium uppercase tracking-wide">
              Secteur
            </dt>
            <dd class="mt-1 text-sm">
              {{ account.secteur ?? '—' }}
            </dd>
          </div>
          <div>
            <dt class="text-xs text-muted font-medium uppercase tracking-wide">
              Marché public
            </dt>
            <dd class="mt-1 text-sm">
              {{ account.marche_public ? '✓' : '—' }}
            </dd>
          </div>
          <div>
            <dt class="text-xs text-muted font-medium uppercase tracking-wide">
              Client depuis
            </dt>
            <dd class="mt-1 text-sm">
              {{ account.became_client_at ?? '—' }}
            </dd>
          </div>
        </dl>
      </UCard>

      <!-- Contacts section -->
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold">
            Contacts
          </h2>
          <UButton
            icon="i-lucide-plus"
            @click="openCreateContact"
          >
            Ajouter un contact
          </UButton>
        </div>

        <UTable
          :data="contacts"
          :columns="contactColumns"
        >
          <template #lead_level-cell="{ row }">
            <UBadge
              v-if="row.original.lead_level"
              color="neutral"
              variant="subtle"
            >
              {{ leadLevelLabel[row.original.lead_level] ?? row.original.lead_level }}
            </UBadge>
            <span v-else>—</span>
          </template>

          <template #actions-cell="{ row }">
            <div class="flex gap-1 justify-end">
              <UButton
                icon="i-lucide-pencil"
                color="neutral"
                variant="ghost"
                size="sm"
                @click="openEditContact(row.original)"
              />
              <UButton
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                size="sm"
                @click="onDeleteContact(row.original)"
              />
            </div>
          </template>
        </UTable>
      </div>

      <!-- Participations timeline section -->
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold">
            Participations aux événements
          </h2>
        </div>

        <UTable
          :data="participations"
          :columns="participationColumns"
        >
          <template #event_name-cell="{ row }">
            {{ eventMap.get(row.original.event_id)?.name ?? '—' }}
          </template>

          <template #event_date-cell="{ row }">
            {{ eventMap.get(row.original.event_id)?.date ?? '—' }}
          </template>

          <template #direction-cell="{ row }">
            <UBadge
              :color="directionBadgeColor[row.original.direction] ?? 'neutral'"
              variant="subtle"
            >
              {{ row.original.direction }}
            </UBadge>
          </template>

          <template #status_at_entry-cell="{ row }">
            <UBadge
              v-if="row.original.status_at_entry"
              :color="statusBadgeColor[row.original.status_at_entry] ?? 'neutral'"
              variant="subtle"
            >
              {{ row.original.status_at_entry }}
            </UBadge>
            <span v-else>—</span>
          </template>
        </UTable>

        <p class="text-xs text-muted italic">
          Graphe CA — Phase 3
        </p>
      </div>
    </template>

    <!-- Account edit modal -->
    <UModal
      v-model:open="openAccountEdit"
      title="Modifier le compte"
    >
      <template #body>
        <UForm
          :schema="accountSchema"
          :state="accountState"
          class="space-y-4"
          @submit="onSubmitAccount"
        >
          <UFormField
            name="name"
            label="Nom de l'entreprise"
            required
          >
            <UInput
              v-model="accountState.name"
              class="w-full"
            />
          </UFormField>

          <UFormField
            name="siret"
            label="SIRET"
          >
            <UInput
              v-model="accountState.siret"
              inputmode="numeric"
              placeholder="14 chiffres"
              class="w-full"
            />
          </UFormField>

          <UFormField
            name="current_status"
            label="Statut"
          >
            <USelectMenu
              v-model="accountState.current_status"
              :items="[
                { label: 'Suspect', value: 'suspect' },
                { label: 'Prospect', value: 'prospect' },
                { label: 'Client', value: 'client' }
              ]"
              value-key="value"
              class="w-full"
            />
          </UFormField>

          <UFormField
            name="effectif"
            label="Effectif"
          >
            <UInput
              v-model="accountState.effectif"
              placeholder="ex. 50-200"
              class="w-full"
            />
          </UFormField>

          <UFormField
            name="secteur"
            label="Secteur"
          >
            <UInput
              v-model="accountState.secteur"
              placeholder="ex. Industrie"
              class="w-full"
            />
          </UFormField>

          <UFormField
            name="marche_public"
            label="Soumis aux marchés publics"
          >
            <USwitch v-model="accountState.marche_public" />
          </UFormField>

          <div class="flex justify-end gap-2">
            <UButton
              color="neutral"
              variant="ghost"
              @click="openAccountEdit = false"
            >
              Annuler
            </UButton>
            <UButton type="submit">
              Enregistrer
            </UButton>
          </div>
        </UForm>
      </template>
    </UModal>

    <!-- Contact add/edit modal -->
    <UModal
      v-model:open="openContact"
      :title="editingContact ? 'Modifier le contact' : 'Nouveau contact'"
    >
      <template #body>
        <UForm
          :schema="contactSchema"
          :state="contactState"
          class="space-y-4"
          @submit="onSubmitContact"
        >
          <UFormField
            name="nom"
            label="Nom"
          >
            <UInput
              v-model="contactState.nom"
              class="w-full"
            />
          </UFormField>

          <UFormField
            name="prenom"
            label="Prénom"
          >
            <UInput
              v-model="contactState.prenom"
              class="w-full"
            />
          </UFormField>

          <UFormField
            name="fonction"
            label="Fonction"
          >
            <UInput
              v-model="contactState.fonction"
              placeholder="ex. Directeur commercial"
              class="w-full"
            />
          </UFormField>

          <UFormField
            name="email"
            label="Email"
          >
            <UInput
              v-model="contactState.email"
              type="email"
              class="w-full"
            />
          </UFormField>

          <UFormField
            name="tel"
            label="Téléphone"
          >
            <UInput
              v-model="contactState.tel"
              type="tel"
              class="w-full"
            />
          </UFormField>

          <UFormField
            name="lead_level"
            label="Niveau lead"
          >
            <USelectMenu
              v-model="contactState.lead_level"
              :items="[
                { label: 'Réseau', value: 'reseau' },
                { label: 'Patron', value: 'patron' },
                { label: 'Interne', value: 'interne' }
              ]"
              value-key="value"
              placeholder="Aucun"
              class="w-full"
              clearable
            />
          </UFormField>

          <div class="flex justify-end gap-2">
            <UButton
              color="neutral"
              variant="ghost"
              @click="openContact = false"
            >
              Annuler
            </UButton>
            <UButton type="submit">
              Enregistrer
            </UButton>
          </div>
        </UForm>
      </template>
    </UModal>
  </div>
</template>
