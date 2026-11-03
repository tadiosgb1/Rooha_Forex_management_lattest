<script setup>
import ModuleListView from '../../components/modules/ModuleListView.vue'
const moduleConfig = { moduleKey: 'reversals', title: 'Reversals & Receipts', singular: 'Reversal request', fields: [["reference","Transaction reference"],["reason","Reason"],["requestedBy","Requested by"],["status","Status"]] }
</script>
<template><ModuleListView v-bind="moduleConfig" /></template>
