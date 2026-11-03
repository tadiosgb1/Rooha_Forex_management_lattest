<script setup>
import ModuleListView from '../../components/modules/ModuleListView.vue'
const moduleConfig = { moduleKey: 'compliance', title: 'Compliance / AML', singular: 'Compliance case', fields: [["caseId","Case ID"],["customer","Customer"],["alert","Alert"],["riskLevel","Risk level"],["owner","Case owner"],["status","Status"]] }
</script>
<template><ModuleListView v-bind="moduleConfig" /></template>
