<script setup lang="ts">
const toast = useToast()
const { current } = useCurrentClient()
const { categories, load, saveCategories } = useClientSettings()

const localCategories = ref<string[]>([])
const saving = ref(false)

onMounted(async () => {
  try {
    await load()
    localCategories.value = [...categories.value]
  } catch {
    toast.add({ title: 'Erreur de chargement des réglages', color: 'error' })
  }
})

async function onSave() {
  saving.value = true
  try {
    await saveCategories(localCategories.value)
    toast.add({ title: 'Réglages enregistrés', color: 'success' })
  } catch {
    toast.add({ title: 'Erreur lors de l\'enregistrement', color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="max-w-xl mx-auto space-y-6">
    <h1 class="text-xl font-semibold">
      Réglages
    </h1>

    <p
      v-if="current"
      class="text-sm text-muted"
    >
      Client : <span class="font-medium text-default">{{ current.name }}</span>
    </p>

    <UCard>
      <template #header>
        <span class="font-medium">Catégories de leads</span>
      </template>

      <div class="space-y-4">
        <p class="text-sm text-muted">
          Ces catégories seront proposées lors de la saisie d'un nouveau lead.
        </p>

        <UFormField label="Catégories">
          <UInputTags
            v-model="localCategories"
            placeholder="Ajouter une catégorie…"
            class="w-full"
          />
        </UFormField>
      </div>

      <template #footer>
        <div class="flex justify-end">
          <UButton
            icon="i-lucide-save"
            :loading="saving"
            @click="onSave"
          >
            Enregistrer
          </UButton>
        </div>
      </template>
    </UCard>
  </div>
</template>
