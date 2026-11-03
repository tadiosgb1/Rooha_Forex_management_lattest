<script setup>
import ModuleListView from '../../components/modules/ModuleListView.vue'
const moduleConfig = { moduleKey: 'reconciliation', title: 'Reconciliation', singular: 'Reconciliation', fields: [["reference","Reference"],["till","Till"],["expected","Expected balance"],["counted","Counted balance"],["variance","Variance"],["status","Status"]] }
</script>
<template><ModuleListView v-bind="moduleConfig" /></template>
