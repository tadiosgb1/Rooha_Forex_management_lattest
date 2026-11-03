<script setup>
import EntityFormView from '../../components/modules/EntityFormView.vue'
const moduleConfig = { moduleKey: 'inventory', title: 'FX Inventory / FIFO', singular: 'Inventory lot', fields: [["lot","Lot reference"],["currency","Currency"],["acquired","Acquired amount"],["remaining","Remaining amount"],["unitCost","Unit cost"]] }
</script>
<template><EntityFormView v-bind="moduleConfig" mode="create" /></template>
