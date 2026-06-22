<script setup lang="ts">
const supabase = useSupabaseClient()
const { clients, current, setCurrent, load } = useCurrentClient()
await load()

const nav = [
  { label: 'Pilotage', icon: 'i-lucide-gauge', to: '/' },
  { label: 'Comptes', icon: 'i-lucide-building-2', to: '/comptes' },
  { label: 'Partenariats', icon: 'i-lucide-handshake', to: '/partenariats' },
  { label: 'Événements', icon: 'i-lucide-calendar', to: '/evenements' },
  { label: 'Import CA', icon: 'i-lucide-upload', to: '/import' },
  { label: 'Réglages', icon: 'i-lucide-settings', to: '/reglages' }
]

const clientItems = computed(() => clients.value.map(c => ({
  label: c.name,
  onSelect: () => setCurrent(c.id)
})))

async function logout() {
  await supabase.auth.signOut()
  await navigateTo('/login')
}
</script>

<template>
  <div class="min-h-screen flex">
    <aside class="w-60 border-r border-default p-4 flex flex-col gap-2">
      <div class="font-semibold px-2 py-3">
        Pilotage Network
      </div>
      <UNavigationMenu
        orientation="vertical"
        :items="nav"
      />
    </aside>
    <div class="flex-1 flex flex-col">
      <header class="h-14 border-b border-default flex items-center justify-between px-4">
        <UDropdownMenu :items="clientItems">
          <UButton
            variant="ghost"
            icon="i-lucide-chevron-down"
            trailing
          >
            {{ current?.name ?? 'Aucun client' }}
          </UButton>
        </UDropdownMenu>
        <div class="flex items-center gap-2">
          <UColorModeButton />
          <UButton
            variant="ghost"
            icon="i-lucide-log-out"
            @click="logout"
          >
            Déconnexion
          </UButton>
        </div>
      </header>
      <main class="flex-1 p-6">
        <slot />
      </main>
    </div>
  </div>
</template>
