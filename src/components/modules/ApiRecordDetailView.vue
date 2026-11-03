<script setup>
import { computed, onMounted, ref } from 'vue'
import { hasPermission } from '../../utils/permissions'
import {useRoute,useRouter} from 'vue-router'
import BaseButton from '../ui/BaseButton.vue'
const props=defineProps({title:{type:String,required:true},collectionPath:{type:String,required:true},fields:{type:Array,required:true},loadRecord:{type:Function,required:true},editPath:{type:String,required:true},recordKey:{type:String,default:'id'}})
const route=useRoute(),router=useRouter(),loading=ref(false),errorMessage=ref(''),record=ref(null)
const editPermissionByPath = { '/roles': 'roles:update', '/permissions': 'permissions:update', '/reference-currencies': 'reference-currencies:update', '/reference-id-types': 'reference-id-types:update' }
const canEdit = computed(() => hasPermission(editPermissionByPath[props.collectionPath] || ''))
onMounted(async()=>{loading.value=true;try{const res=await props.loadRecord(route.params[props.recordKey]);record.value=res?.data||res}catch(e){errorMessage.value=e?.message||'Unable to load record.'}finally{loading.value=false}})
</script>
<template><section class="module-page"><div class="module-page-intro"><div><h2>{{title}} Details</h2><p class="module-description">Review the saved record.</p></div><div style="display:flex;gap:8px"><BaseButton variant="secondary" @click="router.push(collectionPath)">← Back to list</BaseButton><BaseButton v-if="canEdit" :disabled="!record" @click="router.push(editPath)">Edit</BaseButton></div></div><section class="module-panel"><p v-if="loading" class="module-description" style="padding:20px">Loading record…</p><p v-else-if="errorMessage" role="alert" style="padding:20px;color:#b43f4a">{{errorMessage}}</p><dl v-else-if="record" class="entity-detail-grid" style="padding:20px"><div v-for="field in fields" :key="field[0]" class="entity-detail-item"><dt>{{field[1]}}</dt><dd>{{record[field[0]] ?? '—'}}</dd></div></dl></section></section></template>
