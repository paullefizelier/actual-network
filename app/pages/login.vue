<script setup lang="ts">
definePageMeta({ layout: false })
const supabase = useSupabaseClient()
const user = useSupabaseUser()
const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

watchEffect(() => {
  if (user.value) navigateTo('/')
})

async function onSubmit() {
  loading.value = true
  error.value = ''
  const { error: e } = await supabase.auth.signInWithPassword({
    email: email.value,
    password: password.value
  })
  loading.value = false
  if (e) error.value = 'Identifiants invalides'
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4">
    <UCard class="w-full max-w-sm">
      <template #header>
        <h1 class="text-lg font-semibold">Pilotage Network</h1>
      </template>
      <form class="space-y-4" @submit.prevent="onSubmit">
        <UFormField label="Email">
          <UInput v-model="email" type="email" autocomplete="email" class="w-full" />
        </UFormField>
        <UFormField label="Mot de passe">
          <UInput v-model="password" type="password" autocomplete="current-password" class="w-full" />
        </UFormField>
        <UAlert v-if="error" color="error" :title="error" />
        <UButton type="submit" block :loading="loading">Se connecter</UButton>
      </form>
    </UCard>
  </div>
</template>
