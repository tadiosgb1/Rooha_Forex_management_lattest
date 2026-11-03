<script setup>
import ModuleListView from '../../components/modules/ModuleListView.vue'
const moduleConfig = { moduleKey: 'decision-management', title: 'Decision Management', singular: 'Decision rule', fields: [["name","Rule name"],["condition","Condition"],["outcome","Outcome"],["priority","Priority"],["status","Status"]] }
</script>
<template><ModuleListView v-bind="moduleConfig" /></template>
