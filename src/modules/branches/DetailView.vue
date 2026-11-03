<script setup>
import EntityDetailView from '../../components/modules/EntityDetailView.vue'
const moduleConfig = { moduleKey: 'branches', title: 'Branches', singular: 'Branch', fields: [["code","Branch code"],["name","Branch name"],["location","Location"],["manager","Manager"],["status","Status"]] }
</script>
<template><EntityDetailView v-bind="moduleConfig" /></template>
