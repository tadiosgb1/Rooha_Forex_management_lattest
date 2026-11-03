<script setup>
import EntityDetailView from '../../components/modules/EntityDetailView.vue'
const moduleConfig = { moduleKey: 'reconciliation', title: 'Reconciliation', singular: 'Reconciliation', fields: [["reference","Reference"],["till","Till"],["expected","Expected balance"],["counted","Counted balance"],["variance","Variance"],["status","Status"]] }
</script>
<template><EntityDetailView v-bind="moduleConfig" /></template>
