<script setup>
import ModuleListView from '../../components/modules/ModuleListView.vue'
const moduleConfig = { moduleKey: 'inventory', title: 'FX Inventory / FIFO', singular: 'Inventory lot', fields: [["lot","Lot reference"],["currency","Currency"],["acquired","Acquired amount"],["remaining","Remaining amount"],["unitCost","Unit cost"]] }
</script>
<template><ModuleListView v-bind="moduleConfig" /></template>
