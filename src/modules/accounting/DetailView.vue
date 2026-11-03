<script setup>
import EntityDetailView from '../../components/modules/EntityDetailView.vue'
const moduleConfig = { moduleKey: 'accounting', title: 'Accounting Ledger', singular: 'Journal entry', fields: [["reference","Posting reference"],["date","Date"],["account","Account"],["debit","Debit"],["credit","Credit"],["status","Status"]] }
</script>
<template><EntityDetailView v-bind="moduleConfig" /></template>
