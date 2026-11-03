<script setup>
import {useRoute} from 'vue-router'
import ApiRecordDetailView from '../../components/modules/ApiRecordDetailView.vue'
import {permissionService} from '../../services/permissionService'
const route=useRoute()
const fields=[['id','Permission ID'],['name','Name'],['codename','Codename'],['content_type','Content type']]
</script>
<template><ApiRecordDetailView title="Permission" collection-path="/permissions" :fields="fields" :load-record="permissionService.get" :edit-path="`/permissions/${route.params.id}/edit`" /></template>
