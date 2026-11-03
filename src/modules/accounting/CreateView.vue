<script setup>
import EntityFormView from '../../components/modules/EntityFormView.vue'
const moduleConfig = { moduleKey: 'accounting', title: 'Accounting Ledger', singular: 'Journal entry', fields: [["reference","Posting reference"],["date","Date"],["account","Account"],["debit","Debit"],["credit","Credit"],["status","Status"]] }
</script>
<template><EntityFormView v-bind="moduleConfig" mode="create" /></template>
