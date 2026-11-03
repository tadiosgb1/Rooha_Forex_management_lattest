<script setup>
import {useRoute} from 'vue-router'
import ApiRecordDetailView from '../../components/modules/ApiRecordDetailView.vue'
import {roleService} from '../../services/roleService'
const route=useRoute()
const fields=[['id','Role ID'],['name','Name'],['description','Description']]
</script>
<template><ApiRecordDetailView title="Role" collection-path="/roles" :fields="fields" :load-record="roleService.get" :edit-path="`/roles/${route.params.id}/edit`" /></template>
