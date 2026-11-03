<script setup>
import EntityDetailView from '../../components/modules/EntityDetailView.vue'
const moduleConfig = { moduleKey: 'users', title: 'Users & Roles', singular: 'User', fields: [["name","Full name"],["username","Username"],["role","Role"],["branch","Branch"],["status","Status"]] }
</script>
<template><EntityDetailView v-bind="moduleConfig" /></template>
