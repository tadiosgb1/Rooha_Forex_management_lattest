<script setup>
import { useAppStore } from '../stores/app'
import BaseCard from '../components/ui/BaseCard.vue'
const appStore = useAppStore()
</script>
<template>
  <section class="module-page">
    <div class="module-page-intro"><h2>My profile</h2></div>
    <BaseCard as="section" class="module-panel account-panel">
      <div class="account-avatar">{{ (appStore.loginUser || 'DU').slice(0, 2).toUpperCase() }}</div>
      <dl class="account-details">
        <div><dt>Username</dt><dd>{{ appStore.loginUser || 'Demo user' }}</dd></div>
        <div><dt>Role</dt><dd>{{ appStore.loginRole }}</dd></div>
        <div><dt>Branch</dt><dd>Mercato Branch (ADD-01)</dd></div>
      </dl>
    </BaseCard>
  </section>
</template>