<script setup>
import EntityFormView from '../../components/modules/EntityFormView.vue'
const moduleConfig = { moduleKey: 'reversals', title: 'Reversals & Receipts', singular: 'Reversal request', fields: [["reference","Transaction reference"],["reason","Reason"],["requestedBy","Requested by"],["status","Status"]] }
</script>
<template><EntityFormView v-bind="moduleConfig" mode="edit" /></template>
