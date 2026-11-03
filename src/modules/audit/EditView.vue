<script setup>
import EntityFormView from '../../components/modules/EntityFormView.vue'
const moduleConfig = { moduleKey: 'audit', title: 'Audit Trail', singular: 'Audit event', fields: [["timestamp","Timestamp"],["actor","Actor"],["action","Action"],["entity","Entity"],["result","Result"]] }
</script>
<template><EntityFormView v-bind="moduleConfig" mode="edit" /></template>
