<script setup>
import EntityFormView from '../../components/modules/EntityFormView.vue'
const moduleConfig = { moduleKey: 'reconciliation', title: 'Reconciliation', singular: 'Reconciliation', fields: [["reference","Reference"],["till","Till"],["expected","Expected balance"],["counted","Counted balance"],["variance","Variance"],["status","Status"]] }
</script>
<template><EntityFormView v-bind="moduleConfig" mode="create" /></template>
