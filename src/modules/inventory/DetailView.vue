<script setup>
import EntityDetailView from '../../components/modules/EntityDetailView.vue'
const moduleConfig = { moduleKey: 'inventory', title: 'FX Inventory / FIFO', singular: 'Inventory lot', fields: [["lot","Lot reference"],["currency","Currency"],["acquired","Acquired amount"],["remaining","Remaining amount"],["unitCost","Unit cost"]] }
</script>
<template><EntityDetailView v-bind="moduleConfig" /></template>
