<script setup>
import EntityFormView from '../../components/modules/EntityFormView.vue'
const moduleConfig = { moduleKey: 'trades', title: 'Trading Desk', singular: 'Trade', fields: [["customer","Customer"],["direction","Direction"],["currency","Currency"],["amount","Amount"],["rate","Exchange rate"],["status","Status"]] }
</script>
<template><EntityFormView v-bind="moduleConfig" mode="edit" /></template>
