<script setup lang="ts">
definePageMeta({ layout: false })
const user = useSupabaseUser()
watchEffect(() => {
  if (user.value) navigateTo('/')
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center">
    Connexion…
  </div>
</template>
