<script setup>
import EntityDetailView from '../../components/modules/EntityDetailView.vue'
const moduleConfig = { moduleKey: 'decision-management', title: 'Decision Management', singular: 'Decision rule', fields: [["name","Rule name"],["condition","Condition"],["outcome","Outcome"],["priority","Priority"],["status","Status"]] }
</script>
<template><EntityDetailView v-bind="moduleConfig" /></template>
