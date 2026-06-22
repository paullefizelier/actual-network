<script setup lang="ts">
import { z } from 'zod'
import type { Database } from '~/types/database'
import { resolveAccount } from '~/utils/resolveAccount'

type Account = Database['public']['Tables']['accounts']['Row']
type Contact = Database['public']['Tables']['contacts']['Row']
type EventRow = Database['public']['Tables']['events']['Row']
type Participation = Database['public']['Tables']['participations']['Row']

const toast = useToast()
const accountsResource = useClientResource<Account>('accounts')
const contactsResource = useClientResource<Contact>('contacts')
const eventsResource = useClientResource<EventRow>('events')
const participationsResource = useClientResource<Participation>('participations')

const accounts = ref<Account[]>([])
const contacts = ref<Contact[]>([])
const events = ref<EventRow[]>([])
const loading = ref(true)

// --- Account section ---
const createAccount = ref(false)
const selectedAccountId = ref<string | undefined>(undefined)
const newAccountName = ref('')
const newAccountSiret = ref('')

// --- Contact section ---
const createContact = ref(false)
const selectedContactId = ref<string | undefined>(undefined)
const newContactNom = ref('')
const newContactPrenom = ref('')
const newContactFonction = ref('')
const newContactEmail = ref('')

// --- Participation fields ---
const selectedEventId = ref<string | undefined>(undefined)
const direction = ref<'direct' | 'indirect' | undefined>(undefined)
const category = ref('')
const statusAtEntry = ref<'suspect' | 'prospect' | 'client' | undefined>(undefined)
const enteredNetworkAt = ref('')
const notes = ref('')

const submitting = ref(false)

// Computed items for selects
const accountItems = computed(() =>
  accounts.value.map(a => ({
    label: `${a.name}${a.siret ? ` (${a.siret})` : ''}`,
    value: a.id
  }))
)

const accountContacts = computed(() => {
  const id = selectedAccountId.value
  if (!id) return []
  return contacts.value.filter(c => c.account_id === id)
})

const contactItems = computed(() =>
  accountContacts.value.map(c => ({
    label: [c.prenom, c.nom].filter(Boolean).join(' ') || c.email || c.id,
    value: c.id
  }))
)

const eventItems = computed(() =>
  events.value.map(e => ({
    label: `${e.name}${e.date ? ` — ${e.date}` : ''}`,
    value: e.id
  }))
)

const directionItems = [
  { label: 'Direct', value: 'direct' },
  { label: 'Indirect', value: 'indirect' }
]

const statusItems = [
  { label: 'Suspect', value: 'suspect' },
  { label: 'Prospect', value: 'prospect' },
  { label: 'Client', value: 'client' }
]

// Validation schema — pure Zod, not used with UForm since submit is manual
const schema = z.object({
  event_id: z.string().uuid('Événement requis'),
  direction: z.enum(['direct', 'indirect'], { error: 'Direction requise' })
})

// Reset contact when account changes
watch(selectedAccountId, () => {
  selectedContactId.value = undefined
  createContact.value = false
})

watch(createAccount, (val) => {
  if (val) selectedAccountId.value = undefined
})

watch(createContact, (val) => {
  if (val) selectedContactId.value = undefined
})

async function loadData() {
  loading.value = true
  try {
    ;[accounts.value, contacts.value, events.value] = await Promise.all([
      accountsResource.list({ order: 'name', ascending: true }),
      contactsResource.list({ order: 'nom', ascending: true }),
      eventsResource.list({ order: 'date', ascending: false })
    ])
  } catch {
    toast.add({ title: 'Erreur de chargement', color: 'error' })
  } finally {
    loading.value = false
  }
}

onMounted(loadData)

async function onSubmit() {
  // Manual validation
  const eventId = selectedEventId.value
  const dir = direction.value

  if (!eventId) {
    toast.add({ title: 'Veuillez sélectionner un événement', color: 'error' })
    return
  }
  if (!dir) {
    toast.add({ title: 'Veuillez choisir une direction (direct/indirect)', color: 'error' })
    return
  }

  if (!createAccount.value && !selectedAccountId.value) {
    toast.add({ title: 'Veuillez sélectionner ou créer un compte', color: 'error' })
    return
  }

  if (createAccount.value && !newAccountName.value.trim()) {
    toast.add({ title: 'Le nom du compte est requis', color: 'error' })
    return
  }

  submitting.value = true
  try {
    // --- Resolve or create account ---
    let accountId: string

    if (createAccount.value) {
      const siretInput = newAccountSiret.value.trim() || null
      const { match } = resolveAccount(accounts.value, { siret: siretInput })
      if (match) {
        accountId = match.id
        toast.add({
          title: 'Compte existant réutilisé (SIRET)',
          description: `Le SIRET correspond au compte existant "${accounts.value.find(a => a.id === match.id)?.name ?? match.id}".`,
          color: 'warning'
        })
      } else {
        const created = await accountsResource.create({
          name: newAccountName.value.trim(),
          siret: siretInput,
          current_status: 'suspect'
        })
        accountId = created.id
        // Reload accounts so next operations have fresh list
        accounts.value = await accountsResource.list({ order: 'name', ascending: true })
      }
    } else {
      accountId = selectedAccountId.value!
    }

    // --- Resolve or create contact ---
    let contactId: string | null = null

    if (createContact.value) {
      const hasAnyContactData = newContactNom.value.trim()
        || newContactPrenom.value.trim()
        || newContactEmail.value.trim()
        || newContactFonction.value.trim()

      if (hasAnyContactData) {
        const createdContact = await contactsResource.create({
          account_id: accountId,
          nom: newContactNom.value.trim() || null,
          prenom: newContactPrenom.value.trim() || null,
          fonction: newContactFonction.value.trim() || null,
          email: newContactEmail.value.trim() || null
        })
        contactId = createdContact.id
      }
    } else {
      contactId = selectedContactId.value ?? null
    }

    // --- Create participation ---
    await participationsResource.create({
      account_id: accountId,
      event_id: eventId,
      contact_id: contactId,
      direction: dir,
      category: category.value.trim() || null,
      status_at_entry: statusAtEntry.value || null,
      entered_network_at: enteredNetworkAt.value || null,
      notes: notes.value.trim() || null
    })

    toast.add({ title: 'Lead enregistré', color: 'success' })
    await navigateTo(`/comptes/${accountId}`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue'
    toast.add({ title: 'Échec de l\'enregistrement', description: msg, color: 'error' })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="max-w-2xl mx-auto space-y-6">
    <h1 class="text-xl font-semibold">
      Nouveau lead
    </h1>

    <UCard v-if="loading">
      <p class="text-sm text-muted">
        Chargement…
      </p>
    </UCard>

    <template v-else>
      <!-- ── Account ── -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <span class="font-medium">Compte</span>
            <div class="flex items-center gap-2">
              <span class="text-sm text-muted">Créer un nouveau compte</span>
              <USwitch v-model="createAccount" />
            </div>
          </div>
        </template>

        <div
          v-if="!createAccount"
          class="space-y-3"
        >
          <UFormField
            label="Compte existant"
            required
          >
            <USelectMenu
              v-model="selectedAccountId"
              :items="accountItems"
              value-key="value"
              placeholder="Rechercher un compte…"
              searchable
              class="w-full"
              clearable
            />
          </UFormField>
        </div>

        <div
          v-else
          class="space-y-3"
        >
          <UFormField
            label="Nom de l'entreprise"
            required
          >
            <UInput
              v-model="newAccountName"
              placeholder="ex. Acme SAS"
              class="w-full"
            />
          </UFormField>
          <UFormField label="SIRET">
            <UInput
              v-model="newAccountSiret"
              inputmode="numeric"
              placeholder="14 chiffres"
              class="w-full"
            />
          </UFormField>
        </div>
      </UCard>

      <!-- ── Contact (optional) ── -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <span class="font-medium">Contact <span class="text-muted text-sm font-normal">(optionnel)</span></span>
            <div class="flex items-center gap-2">
              <span class="text-sm text-muted">Créer un nouveau contact</span>
              <USwitch
                v-model="createContact"
                :disabled="!selectedAccountId && !createAccount"
              />
            </div>
          </div>
        </template>

        <div
          v-if="!createContact"
          class="space-y-3"
        >
          <UFormField label="Contact existant">
            <USelectMenu
              v-model="selectedContactId"
              :items="contactItems"
              value-key="value"
              placeholder="Sélectionner un contact…"
              :disabled="!selectedAccountId && !createAccount"
              class="w-full"
              clearable
            />
          </UFormField>
          <p
            v-if="!selectedAccountId && !createAccount"
            class="text-xs text-muted"
          >
            Sélectionnez d'abord un compte pour filtrer les contacts.
          </p>
        </div>

        <div
          v-else
          class="space-y-3"
        >
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Prénom">
              <UInput
                v-model="newContactPrenom"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Nom">
              <UInput
                v-model="newContactNom"
                class="w-full"
              />
            </UFormField>
          </div>
          <UFormField label="Fonction">
            <UInput
              v-model="newContactFonction"
              placeholder="ex. DRH, PDG"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Email">
            <UInput
              v-model="newContactEmail"
              type="email"
              class="w-full"
            />
          </UFormField>
        </div>
      </UCard>

      <!-- ── Event ── -->
      <UCard>
        <template #header>
          <span class="font-medium">Événement</span>
        </template>

        <UFormField
          label="Événement"
          required
        >
          <USelectMenu
            v-model="selectedEventId"
            :items="eventItems"
            value-key="value"
            placeholder="Sélectionner un événement…"
            searchable
            class="w-full"
            clearable
          />
        </UFormField>
      </UCard>

      <!-- ── Participation fields ── -->
      <UCard>
        <template #header>
          <span class="font-medium">Détails de la participation</span>
        </template>

        <div class="space-y-4">
          <UFormField
            label="Direction"
            required
          >
            <URadioGroup
              v-model="direction"
              :items="directionItems"
              value-key="value"
              orientation="horizontal"
            />
          </UFormField>

          <UFormField label="Catégorie">
            <UInput
              v-model="category"
              placeholder="ex. Commerce, Industrie…"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Statut à l'entrée">
            <USelectMenu
              v-model="statusAtEntry"
              :items="statusItems"
              value-key="value"
              placeholder="Statut (optionnel)"
              class="w-full"
              clearable
            />
          </UFormField>

          <UFormField label="Date d'entrée réseau">
            <UInput
              v-model="enteredNetworkAt"
              type="date"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Notes">
            <UTextarea
              v-model="notes"
              :rows="3"
              placeholder="Observations, contexte…"
              class="w-full"
            />
          </UFormField>
        </div>
      </UCard>

      <!-- ── Actions ── -->
      <div class="flex justify-end gap-3">
        <UButton
          color="neutral"
          variant="ghost"
          :to="'/comptes'"
        >
          Annuler
        </UButton>
        <UButton
          icon="i-lucide-save"
          :loading="submitting"
          @click="onSubmit"
        >
          Enregistrer le lead
        </UButton>
      </div>
    </template>
  </div>
</template>
