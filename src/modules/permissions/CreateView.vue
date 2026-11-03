<script setup>
import EntityFormView from '../../components/modules/EntityFormView.vue'
const moduleConfig = { moduleKey: 'permissions', title: 'Roles & Permissions', singular: 'Permission', fields: [["name","Permission"],["module","Module"],["role","Role"],["access","Access level"]] }
</script>
<template><EntityFormView v-bind="moduleConfig" mode="create" /></template>
