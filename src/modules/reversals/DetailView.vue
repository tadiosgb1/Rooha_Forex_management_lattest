<script setup>
import EntityDetailView from '../../components/modules/EntityDetailView.vue'
const moduleConfig = { moduleKey: 'reversals', title: 'Reversals & Receipts', singular: 'Reversal request', fields: [["reference","Transaction reference"],["reason","Reason"],["requestedBy","Requested by"],["status","Status"]] }
</script>
<template><EntityDetailView v-bind="moduleConfig" /></template>
