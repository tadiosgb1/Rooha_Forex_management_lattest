<script setup>
import EntityDetailView from '../../components/modules/EntityDetailView.vue'
const moduleConfig = { moduleKey: 'compliance', title: 'Compliance / AML', singular: 'Compliance case', fields: [["caseId","Case ID"],["customer","Customer"],["alert","Alert"],["riskLevel","Risk level"],["owner","Case owner"],["status","Status"]] }
</script>
<template><EntityDetailView v-bind="moduleConfig" /></template>
