<script setup>
import EntityDetailView from '../../components/modules/EntityDetailView.vue'
const moduleConfig = { moduleKey: 'audit', title: 'Audit Trail', singular: 'Audit event', fields: [["timestamp","Timestamp"],["actor","Actor"],["action","Action"],["entity","Entity"],["result","Result"]] }
</script>
<template><EntityDetailView v-bind="moduleConfig" /></template>
