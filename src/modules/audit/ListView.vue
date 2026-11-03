<script setup>
import ModuleListView from '../../components/modules/ModuleListView.vue'
const moduleConfig = { moduleKey: 'audit', title: 'Audit Trail', singular: 'Audit event', fields: [["timestamp","Timestamp"],["actor","Actor"],["action","Action"],["entity","Entity"],["result","Result"]] }
</script>
<template><ModuleListView v-bind="moduleConfig" /></template>
