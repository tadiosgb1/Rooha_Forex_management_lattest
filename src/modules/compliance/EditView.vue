<script setup>
import EntityFormView from '../../components/modules/EntityFormView.vue'
const moduleConfig = { moduleKey: 'compliance', title: 'Compliance / AML', singular: 'Compliance case', fields: [["caseId","Case ID"],["customer","Customer"],["alert","Alert"],["riskLevel","Risk level"],["owner","Case owner"],["status","Status"]] }
</script>
<template><EntityFormView v-bind="moduleConfig" mode="edit" /></template>
