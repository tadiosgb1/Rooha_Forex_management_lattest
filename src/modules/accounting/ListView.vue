<script setup>
import ModuleListView from '../../components/modules/ModuleListView.vue'
const moduleConfig = { moduleKey: 'accounting', title: 'Accounting Ledger', singular: 'Journal entry', fields: [["reference","Posting reference"],["date","Date"],["account","Account"],["debit","Debit"],["credit","Credit"],["status","Status"]] }
</script>
<template><ModuleListView v-bind="moduleConfig" /></template>
