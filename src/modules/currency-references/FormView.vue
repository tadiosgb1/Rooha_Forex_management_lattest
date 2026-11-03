<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from '../../composables/toast'
import BaseButton from '../../components/ui/BaseButton.vue'
import { hasPermission } from '../../utils/permissions'
import { referenceCurrencyService } from '../../services/referenceCurrencyService'
const route = useRoute(), router = useRouter(), toast = useToast(), isEdit = !!route.params.id, loading = ref(false), saving = ref(false), errorMessage = ref('')
const flagFile = ref(null), flagPreview = ref('')
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
function resolveFlagUrl(url) { if (!url) return ''; if (/^(https?:)?\/\//i.test(url) || /^(data|blob):/i.test(url)) return url; return `${apiBaseUrl}/${String(url).replace(/^\/+/, '')}` }
const form = reactive({ code: '', name: '', symbol: '', flag_url: '', is_base_currency: false, is_active: true })
function selectFlag(event) {
  const file = event.target.files?.[0] ?? null
  if (flagPreview.value.startsWith('blob:')) URL.revokeObjectURL(flagPreview.value)
  flagFile.value = file
  flagPreview.value = file ? URL.createObjectURL(file) : resolveFlagUrl(form.flag_url)
}
async function load() { if (!isEdit) return; loading.value = true; try { const res = await referenceCurrencyService.get(route.params.id), row = res?.data || res; Object.assign(form, { code: row.code || '', name: row.name || '', symbol: row.symbol || '', flag_url: row.flag_url || '', is_base_currency: Boolean(row.is_base_currency), is_active: Boolean(row.is_active) }) } catch (e) { errorMessage.value = e?.message || 'Unable to load currency.' } finally { loading.value = false } }
async function save() {
  errorMessage.value = ''
  const code = String(form.code ?? '').trim().toUpperCase()
  const name = String(form.name ?? '').trim()
  const symbol = String(form.symbol ?? '').trim()
  if (!code) { errorMessage.value = 'Code is required.'; return }
  if (code.length !== 3) { errorMessage.value = 'Code must be exactly 3 characters.'; return }
  if (!name) { errorMessage.value = 'Name is required.'; return }
  if (name.length > 50) { errorMessage.value = 'Name must be between 1 and 50 characters.'; return }
  if (!symbol) { errorMessage.value = 'Symbol is required.'; return }
  saving.value = true
  try {
    // Use JSON when no file is selected so boolean fields remain actual booleans.
    // Multipart form fields are always serialized as strings by the browser.
    let payload
    if (flagFile.value) {
      payload = new FormData()
      payload.append('code', code)
      payload.append('name', name)
      payload.append('symbol', symbol)
      payload.append('is_base_currency', String(code === 'ETB'))
      payload.append('is_active', String(Boolean(form.is_active)))
      payload.append('flag', flagFile.value)
    } else {
      payload = {
        code,
        name,
        symbol,
        is_base_currency: code === 'ETB',
        is_active: Boolean(form.is_active),
      }
      if (!isEdit && form.flag_url.trim()) payload.flag = form.flag_url.trim()
    }
    if (isEdit) await referenceCurrencyService.update(route.params.id, payload)
    else await referenceCurrencyService.create(payload)
    toast.success('Currency saved successfully.');router.push('/reference-currencies')
  } catch (e) {
    errorMessage.value = e?.message || 'Unable to save currency.'
  } finally {
    saving.value = false
  }
}
onMounted(load)
</script>
<template><section class="module-page"><div class="module-page-intro"><div><h2>{{ isEdit ? 'Edit Currency' : 'Add Reference Currency' }}</h2><p class="module-description">Configure the currency code, display details, and operational status.</p></div><BaseButton variant="secondary" @click="router.push('/reference-currencies')">← Back to currencies</BaseButton></div><section class="module-panel module-form-panel"><div class="module-panel-header"><h3>Currency information</h3></div><p v-if="loading" class="module-description" style="padding:16px 24px">Loading currency…</p><form v-else @submit.prevent="save"><div class="module-form-grid"><label class="module-form-field"><span>Currency code *</span><input v-model="form.code" class="ui-input" type="text" placeholder="USD" minlength="3" maxlength="3" required @input="form.code = form.code.toUpperCase().slice(0, 3); form.is_base_currency = form.code === 'ETB'" /><small>Enter exactly 3 characters. The code can be changed when editing.</small></label><label class="module-form-field"><span>Currency name *</span><input v-model="form.name" class="ui-input" type="text" placeholder="US Dollar" minlength="1" maxlength="50" required /><small>Enter 1–50 characters.</small></label><label class="module-form-field"><span>Symbol *</span><input v-model="form.symbol" class="ui-input" placeholder="$" required /></label><label class="module-form-field"><span>Flag image file</span><input class="ui-input" type="file" accept="image/*" @change="selectFlag" /><small>Choose an image to upload. The multipart field name is <code>flag</code>.{{ flagFile ? ' Selected: ' + flagFile.name : form.flag_url ? ' Existing flag will be kept unless replaced.' : ' Optional.' }}</small></label><label class="module-form-field" style="flex-direction:row;align-items:center;gap:10px"><input :checked="String(form.code).toUpperCase() === 'ETB'" type="checkbox" style="width:auto;min-height:0" :disabled="String(form.code).toUpperCase() !== 'ETB'" @change="form.is_base_currency = String(form.code).toUpperCase() === 'ETB'" /><span>Base currency <small>(ETB only)</small></span></label><label class="module-form-field" style="flex-direction:row;align-items:center;gap:10px"><input v-model="form.is_active" type="checkbox" style="width:auto;min-height:0" :disabled="saving || loading || (form.is_active ? !hasPermission('reference-currencies:deactivate') : !hasPermission('reference-currencies:activate'))" /><span>Active</span></label></div><div v-if="flagPreview || form.flag_url" style="padding:0 24px 18px"><span class="module-description">Flag preview</span><div style="margin-top:8px"><img :src="flagPreview || resolveFlagUrl(form.flag_url)" alt="Currency flag preview" style="width:48px;height:32px;object-fit:cover;border:1px solid var(--border-color,#e5e7eb);border-radius:4px" @error="$event.target.style.display='none'"></div></div><div v-if="errorMessage" class="module-alert" role="alert" aria-live="assertive"><div class="module-alert__content"><strong>Unable to complete action.</strong><span>{{ errorMessage }}</span></div><button type="button" class="module-alert__close" aria-label="Close error alert" @click="errorMessage = ''">×</button></div><div class="module-form-footer"><span>Currency code remains editable; keep it unique.</span><div><BaseButton type="button" variant="secondary" @click="router.push('/reference-currencies')">Cancel</BaseButton><BaseButton type="submit" :disabled="saving || loading">{{ saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create currency' }}</BaseButton></div></div></form></section></section></template>
