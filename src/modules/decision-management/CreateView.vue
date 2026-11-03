<script setup>
import EntityFormView from '../../components/modules/EntityFormView.vue'
const moduleConfig = { moduleKey: 'decision-management', title: 'Decision Management', singular: 'Decision rule', fields: [["name","Rule name"],["condition","Condition"],["outcome","Outcome"],["priority","Priority"],["status","Status"]] }
</script>
<template><EntityFormView v-bind="moduleConfig" mode="create" /></template>
