<script setup>
import {useRoute} from 'vue-router'
import ApiRecordDetailView from '../../components/modules/ApiRecordDetailView.vue'
import {referenceIdTypeService} from '../../services/referenceIdTypeService'
const route=useRoute()
const fields=[['code','Code'],['display_label','Display label'],['is_active','Active']]
</script>
<template><ApiRecordDetailView title="Reference ID Type" collection-path="/reference-id-types" :fields="fields" :load-record="referenceIdTypeService.get" :edit-path="`/reference-id-types/${encodeURIComponent(route.params.code)}/edit`" record-key="code" /></template>
