<script setup>
import { computed, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { cashManagementService } from './service'
import BaseButton from '../../components/ui/BaseButton.vue'
const route=useRoute(), busy=ref(false), success=ref(''), error=ref('')
const section=computed(()=>route.meta.cashManagementSection||'vaults')
const heading=computed(()=>({vaults:['Vaults','Create cash vaults and initiate opening balances.'],transfers:['Transfers','Initiate cash transfers and confirm receipt.'],'opening-balances':['Opening balances','Accept or reject submitted handovers.'],reconciliations:['Reconciliations','Record physical cash counts and approve reconciliations.']}[section.value]||['Cash Management','Cash operations']))
const data=reactive({
vault:{vault_type:'TELLER_TILL',vault_code:'TL-001',vault_name:'Teller 001 Till',owner_user_id:25,custodian_user_id:12},
transfer:{source_vault_id:'a1b2c3d4-1111-4222-8333-123456789001',dest_vault_id:'a1b2c3d4-1111-4222-8333-123456789002',currency_id:'d1b2c3d4-1111-4222-8333-123456789001',transfer_type:'VAULT_TO_TELLER',initiated_amount:10000,tolerance_amount:10,remarks:'Daily teller cash allocation'},
receive:{id:'a1b2c3d4-1111-4222-8333-123456789001',received_amount:10000,receipt_notes:'Cash counted and matched with transfer slip'},
opening:{vault_id:'a1b2c3d4-1111-4222-8333-123456789002',currency_id:'d1b2c3d4-1111-4222-8333-123456789001',opening_balance:25000,notes:'Initial teller cash handover'},
accept:{id:'a1b2c3d4-1111-4222-8333-123456789002'},
reject:{id:'a1b2c3d4-1111-4222-8333-123456789001',reason:'Received amount does not match the handover slip'},
reconcile:{vault_id:'a1b2c3d4-1111-4222-8333-123456789002',currency_id:'d1b2c3d4-1111-4222-8333-123456789001',business_date:'2026-11-23',counted_physical_amount:22450,notes:'End-of-day teller cash count'},
approve:{id:'a1b2c3d4-1111-4222-8333-123456789002'}
})
const operations=computed(()=>section.value==='vaults'?[{key:'vault',label:'Create Vault'},{key:'opening',label:'Opening Balance'}]:section.value==='transfers'?[{key:'transfer',label:'Create Transfer'},{key:'receive',label:'Receive Transfer'}]:section.value==='opening-balances'?[{key:'accept',label:'Accept Balance'},{key:'reject',label:'Reject Balance'}]:[{key:'reconcile',label:'Create Reconciliation'},{key:'approve',label:'Approve Reconciliation'}])
const selected=ref(''), op=computed(()=>selected.value||operations.value[0]?.key)
const fields=computed(()=>({
vault:[['vault_type','Vault type','select'],['vault_code','Vault code'],['vault_name','Vault name'],['owner_user_id','Owner user ID','number'],['custodian_user_id','Custodian user ID','number']],
transfer:[['source_vault_id','Source vault ID'],['dest_vault_id','Destination vault ID'],['currency_id','Currency ID'],['transfer_type','Transfer type','select'],['initiated_amount','Amount','number'],['tolerance_amount','Tolerance','number'],['remarks','Remarks','textarea']],
receive:[['id','Transfer ID'],['received_amount','Received amount','number'],['receipt_notes','Receipt notes','textarea']],
opening:[['vault_id','Vault ID'],['currency_id','Currency ID'],['opening_balance','Opening balance','number'],['notes','Notes','textarea']],
accept:[['id','Opening balance ID']],reject:[['id','Opening balance ID'],['reason','Reason','textarea']],
reconcile:[['vault_id','Vault ID'],['currency_id','Currency ID'],['business_date','Business date','date'],['counted_physical_amount','Physical count amount','number'],['notes','Notes','textarea']],
approve:[['id','Reconciliation ID']]
}[op.value]||[]))
const endpoints={vault:'/cash-management/vaults',transfer:'/cash-management/transfers',receive:()=>'/cash-management/transfers/'+encodeURIComponent(data.receive.id)+'/receive',opening:()=>'/cash-management/vaults/'+encodeURIComponent(data.opening.vault_id)+'/opening-balances',accept:()=>'/cash-management/opening-balances/'+encodeURIComponent(data.accept.id)+'/accept',reject:()=>'/cash-management/opening-balances/'+encodeURIComponent(data.reject.id)+'/reject',reconcile:'/cash-management/reconciliations',approve:()=>'/cash-management/reconciliations/'+encodeURIComponent(data.approve.id)+'/approve'}
function endpoint(){const e=endpoints[op.value];return typeof e==='function'?e():e}
function payload(){const p={...data[op.value]};if(['receive','accept','reject','approve'].includes(op.value))delete p.id;if(op.value==='opening')delete p.vault_id; if(op.value==='vault'){p.owner_user_id=Number(p.owner_user_id);p.custodian_user_id=Number(p.custodian_user_id)}if(op.value==='transfer'){p.initiated_amount=Number(p.initiated_amount);p.tolerance_amount=Number(p.tolerance_amount)}if(op.value==='receive')p.received_amount=Number(p.received_amount);if(op.value==='opening')p.opening_balance=Number(p.opening_balance);if(op.value==='reconcile')p.counted_physical_amount=Number(p.counted_physical_amount);if(['accept','approve'].includes(op.value))return {};return p}
async function submit(){busy.value=true;success.value='';error.value='';try{await cashManagementService.post(endpoint(),payload());success.value='Request completed successfully.'}catch(e){error.value=e?.message||'Request failed. Please try again.'}finally{busy.value=false}}
</script>
<template><section class="module-page cash-management">
<div class="module-page-intro"><div><h2>{{ heading[0] }}</h2><p class="module-description">{{ heading[1] }}</p></div></div>
<div class="module-stat-row"><div class="module-stat-card"><span>Module</span><strong>Cash Management</strong><small>Cash operations</small></div><div class="module-stat-card"><span>Operations</span><strong>{{ operations.length }}</strong><small>Available actions</small></div><div class="module-stat-card"><span>HTTP method</span><strong>POST</strong><small>Configured API service</small></div></div>
<section class="module-panel"><div class="module-panel-header"><h3>Cash workflow</h3></div>
<div class="cash-tabs"><button v-for="item in operations" :key="item.key" type="button" :class="{active:op===item.key}" @click="selected=item.key">{{ item.label }}</button></div>
<p v-if="success" class="cash-success" role="status">{{ success }}</p><p v-if="error" class="cash-error" role="alert">{{ error }}</p>
<form class="cash-fields" @submit.prevent="submit"><div v-for="field in fields" :key="field[0]" class="cash-field" :class="{wide:field[3]==='wide'||field[2]==='textarea'}"><label :for="'cash-'+field[0]">{{ field[1] }}</label>
<select v-if="field[2]==='select'&&field[0]==='vault_type'" v-model="data[op][field[0]]" :id="'cash-'+field[0]"><option>TELLER_TILL</option><option>VAULT</option><option>BRANCH_VAULT</option></select>
<select v-else-if="field[2]==='select'" v-model="data[op][field[0]]" :id="'cash-'+field[0]"><option>VAULT_TO_TELLER</option><option>TELLER_TO_VAULT</option><option>VAULT_TO_VAULT</option></select>
<textarea v-else-if="field[2]==='textarea'" v-model="data[op][field[0]]" :id="'cash-'+field[0]" rows="3" required />
<input v-else v-model="data[op][field[0]]" :id="'cash-'+field[0]" :type="field[2]||'text'" :step="field[2]==='number'?'any':undefined" required /></div>
<div class="cash-submit"><BaseButton type="submit" :disabled="busy">{{ busy?'Submitting…':'Submit '+(operations.find(x=>x.key===op)?.label||'action') }}</BaseButton></div></form>
<div class="cash-endpoint"><strong>POST</strong><code>{{ endpoint() }}</code><small>Accept and approve operations send an empty JSON payload.</small></div>
</section></section>
</template>
<style scoped>
.cash-tabs{display:flex;flex-wrap:wrap;gap:8px;padding:16px 20px}.cash-tabs button{padding:9px 13px;border:1px solid var(--border-color,#dbe2ea);border-radius:8px;background:var(--surface-color,#fff);color:var(--text-color,#233247);cursor:pointer;font:inherit}.cash-tabs button.active{background:#2168ce;color:#fff;border-color:#2168ce}.cash-fields{padding:20px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.cash-field{display:flex;flex-direction:column;gap:7px}.cash-field.wide,.cash-submit{grid-column:1/-1}.cash-field label{font-size:.88rem;font-weight:600}.cash-field input,.cash-field select,.cash-field textarea{width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid var(--border-color,#dbe2ea);border-radius:8px;background:var(--surface-color,#fff);color:var(--text-color,#233247);font:inherit}.cash-submit{display:flex;justify-content:flex-end}.cash-success,.cash-error{padding:10px 20px;margin:12px 0}.cash-success{color:#11733d}.cash-error{color:#b42332}.cash-endpoint{margin:0 20px 20px;padding:12px;border-radius:9px;background:var(--surface-muted,#f3f6f9);display:flex;flex-wrap:wrap;gap:10px;align-items:center}.cash-endpoint code{overflow-wrap:anywhere}.cash-endpoint small{width:100%;opacity:.7}@media(max-width:650px){.cash-fields{grid-template-columns:1fr}.cash-field.wide,.cash-submit{grid-column:auto}}
</style>