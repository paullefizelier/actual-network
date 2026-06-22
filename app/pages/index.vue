<script setup lang="ts">
const { current } = useCurrentClient()
</script>

<template>
  <div>
    <h1 class="text-xl font-semibold mb-2">
      Pilotage
    </h1>
    <p class="text-muted">
      Client courant : {{ current?.name ?? '—' }}. Dashboards en Phase 4.
    </p>
  </div>
</template>
