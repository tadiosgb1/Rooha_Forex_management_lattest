<script setup>
import { useRoute } from 'vue-router'
import ApiRecordDetailView from '../../components/modules/ApiRecordDetailView.vue'
import { referenceCurrencyService } from '../../services/referenceCurrencyService'
const route = useRoute()
const fields = [['code', 'Currency code'], ['name', 'Currency name'], ['symbol', 'Symbol'], ['flag_url', 'Flag URL'], ['is_base_currency', 'Base currency'], ['is_active', 'Active']]
</script>
<template><ApiRecordDetailView title="Reference Currency" collection-path="/reference-currencies" :fields="fields" :load-record="referenceCurrencyService.get" :edit-path="`/reference-currencies/${encodeURIComponent(route.params.id)}/edit`" record-key="id" /></template>
