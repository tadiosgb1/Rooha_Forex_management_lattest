<script setup>
import { hasPermission } from '../../utils/permissions'
import { onMounted, reactive, ref } from 'vue'
import BaseButton from '../../components/ui/BaseButton.vue'
import { apiRequest } from '../../services/apiClient.js'
import { SYSTEM_CONFIG_DEFAULTS, useSystemConfigStore } from '../../stores/systemConfig'

const configEndpoint = 'system-config'
const systemConfig = useSystemConfigStore()
const defaults = { ...SYSTEM_CONFIG_DEFAULTS }
const form = reactive({ ...defaults })
const logoLightFile = ref(null)
const logoDarkFile = ref(null)
const faviconFile = ref(null)
const saved = ref(false)
const loading = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

function unwrapConfig(response) {
  let value = response?.data ?? response
  if (Array.isArray(value)) value = value[0]
  if (value && typeof value === 'object' && value.data && typeof value.data === 'object') value = value.data
  return value && typeof value === 'object' ? value : null
}

function applySettings(settings) {
  document.documentElement.style.setProperty('--brand-base-color', settings.base_color || defaults.base_color)
  document.documentElement.style.setProperty('--brand-secondary-color', settings.secondary_color || defaults.secondary_color)
  document.documentElement.style.setProperty('--brand-tertiary-color', settings.tertiary_color || defaults.tertiary_color)
  document.title = settings.site_name || defaults.site_name
  if (settings.favicon) {
    let link = document.querySelector('link[rel~="icon"]')
    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      document.head.appendChild(link)
    }
    link.href = settings.favicon
  }
}

function selectedFile(event, field) {
  const file = event.target.files?.[0] ?? null
  if (field === 'light') logoLightFile.value = file
  if (field === 'dark') logoDarkFile.value = file
  if (field === 'favicon') faviconFile.value = file
  saved.value = false
  successMessage.value = ''
}

async function loadSettings() {
  loading.value = true
  errorMessage.value = ''
  try {
    const response = await apiRequest(configEndpoint, { method: 'GET' })
    const settings = unwrapConfig(response)
    if (settings && Object.keys(settings).length) {
      Object.assign(form, defaults, settings)
    } else {
      Object.assign(form, defaults)
    }
    applySettings(form)
    systemConfig.setConfig(form)
  } catch (error) {
    if (error?.status === 404) {
      configExists.value = false
      Object.assign(form, defaults)
    } else {
      errorMessage.value = error?.message || 'Unable to load system configuration. Frontend defaults are being used.'
      configExists.value = false
      Object.assign(form, defaults)
    }
    systemConfig.setConfig(form)
  } finally {
    loading.value = false
  }
}

async function saveSettings() {
  errorMessage.value = ''
  successMessage.value = ''
  saved.value = false

  // Only require a light logo when neither an existing logo nor a replacement is available.
  if (!logoLightFile.value && !form.logo_light) {
    errorMessage.value = 'Please choose a light theme logo file because no light logo is currently configured.'
    return
  }
  for (const key of ['base_color', 'secondary_color', 'tertiary_color']) {
    if (!/^#[0-9a-fA-F]{6}$/.test(form[key])) {
      errorMessage.value = 'Please enter valid six-digit hex colors (for example, #16A34A).'
      return
    }
  }
  if (!form.site_name.trim()) {
    errorMessage.value = 'Site name is required.'
    return
  }

  const payload = new FormData()
  payload.append('site_name', form.site_name.trim())
  // PATCH only the files the user actually selected. Omitting untouched file fields
  // preserves the server's existing uploads when changing the name or brand colors.
  if (logoLightFile.value) payload.append('logo_light', logoLightFile.value)
  if (logoDarkFile.value) payload.append('logo_dark', logoDarkFile.value)
  if (faviconFile.value) payload.append('favicon', faviconFile.value)
  payload.append('base_color', form.base_color.toUpperCase())
  payload.append('secondary_color', form.secondary_color.toUpperCase())
  payload.append('tertiary_color', form.tertiary_color.toUpperCase())

  saving.value = true
  try {
    // Use PATCH even when GET returned no configuration record, as required by
    // the system-config API contract. The endpoint can create/update the settings.
    const response = await apiRequest(configEndpoint, {
      method: 'PATCH',
      body: payload,
    })
    const returnedConfig = unwrapConfig(response)
    if (returnedConfig) Object.assign(form, defaults, returnedConfig)
    applySettings(form)
    systemConfig.setConfig(form)
    saved.value = true
    successMessage.value = 'System configuration saved successfully.'
  } catch (error) {
    errorMessage.value = error?.message || 'Unable to save system configuration.'
  } finally {
    saving.value = false
  }
}

function resetForm() {
  Object.assign(form, defaults)
  logoLightFile.value = null
  logoDarkFile.value = null
  faviconFile.value = null
  for (const id of ['logo-light-file', 'logo-dark-file', 'favicon-file']) {
    const input = document.getElementById(id)
    if (input) input.value = ''
  }
  saved.value = false
  successMessage.value = ''
  errorMessage.value = ''
}

onMounted(loadSettings)
</script>

<template>
  <section class="module-page platform-brands-page">
    <div class="module-page-intro">
      <div><h2>Platform Brands</h2><p class="module-description">Configure the platform name, logo files, favicon, and brand colors.</p></div>
    </div>
    <section class="module-panel module-form-panel">
      <div class="module-panel-header"><h3>Brand configuration</h3></div>
      <p v-if="loading" class="module-description brand-storage-note" role="status">Loading system configuration…</p>
      <form @submit.prevent="saveSettings">
        <fieldset class="brand-form-fieldset" :disabled="loading || saving">
          <div class="module-form-grid">
            <label class="module-form-field"><span>Site name <b>*</b></span><input v-model="form.site_name" class="ui-input" required /></label>
            <label class="module-form-field"><span>Light theme logo file <b>*</b></span><input id="logo-light-file" class="ui-input brand-file-input" type="file" accept="image/*" @change="selectedFile($event, 'light')" /><small>Required only if no light logo is configured yet. Leave unchanged to keep the current upload.{{ logoLightFile ? ' Selected: ' + logoLightFile.name : form.logo_light ? ' Current logo will be kept unless you choose a replacement.' : '' }}</small></label>
            <label class="module-form-field"><span>Dark theme logo file</span><input id="logo-dark-file" class="ui-input brand-file-input" type="file" accept="image/*" @change="selectedFile($event, 'dark')" /><small>Optional. Leave unchanged to keep the current upload.{{ logoDarkFile ? ' Selected: ' + logoDarkFile.name : form.logo_dark ? ' Current logo will be kept unless you choose a replacement.' : '' }}</small></label>
            <label class="module-form-field"><span>Favicon file</span><input id="favicon-file" class="ui-input brand-file-input" type="file" accept="image/*,.ico" @change="selectedFile($event, 'favicon')" /><small>Optional. Leave unchanged to keep the current upload.{{ faviconFile ? ' Selected: ' + faviconFile.name : form.favicon ? ' Current favicon will be kept unless you choose a replacement.' : '' }}</small></label>
            <label class="module-form-field"><span>Base color <b>*</b></span><div class="brand-color-input"><input v-model="form.base_color" class="ui-input" type="text" pattern="#[0-9A-Fa-f]{6}" required /><input v-model="form.base_color" type="color" aria-label="Choose base color" /></div></label>
            <label class="module-form-field"><span>Secondary color <b>*</b></span><div class="brand-color-input"><input v-model="form.secondary_color" class="ui-input" type="text" pattern="#[0-9A-Fa-f]{6}" required /><input v-model="form.secondary_color" type="color" aria-label="Choose secondary color" /></div></label>
            <label class="module-form-field"><span>Tertiary color <b>*</b></span><div class="brand-color-input"><input v-model="form.tertiary_color" class="ui-input" type="text" pattern="#[0-9A-Fa-f]{6}" required /><input v-model="form.tertiary_color" type="color" aria-label="Choose tertiary color" /></div></label>
          </div>
          <div class="brand-preview">
            <div class="brand-preview-heading"><strong>Preview</strong><span>{{ form.site_name || 'Your platform name' }}</span></div>
            <div class="brand-preview-logos">
              <div class="brand-preview-logo light"><span>Light logo</span><img v-if="form.logo_light" :src="form.logo_light" alt="Current light logo preview" @error="$event.target.style.display='none'" /><small>{{ logoLightFile ? logoLightFile.name : form.logo_light ? 'Current logo file' : 'No logo configured' }}</small></div>
              <div class="brand-preview-logo dark"><span>Dark logo</span><img v-if="form.logo_dark" :src="form.logo_dark" alt="Current dark logo preview" @error="$event.target.style.display='none'" /><small>{{ logoDarkFile ? logoDarkFile.name : form.logo_dark ? 'Current logo file' : 'No dark logo configured' }}</small></div>
            </div>
            <div class="brand-swatches">
              <div><span :style="{ backgroundColor: form.base_color }"></span><small>Base · {{ form.base_color }}</small></div>
              <div><span :style="{ backgroundColor: form.secondary_color }"></span><small>Secondary · {{ form.secondary_color }}</small></div>
              <div><span :style="{ backgroundColor: form.tertiary_color }"></span><small>Tertiary · {{ form.tertiary_color }}</small></div>
            </div>
          </div>
        </fieldset>
        <p v-if="errorMessage" role="alert" class="brand-form-message error">{{ errorMessage }}</p>
        <p v-if="successMessage" role="status" class="brand-form-message success">{{ successMessage }}</p>
        <div class="module-form-footer"><span></span><div><BaseButton type="button" variant="secondary" class="module-secondary-btn" :disabled="saving || loading" @click="resetForm">Reset form</BaseButton><BaseButton v-if="hasPermission('system-config:update')" type="submit" class="module-primary-btn" :disabled="saving || loading">{{ saving ? 'Saving…' : 'Save brand settings' }}</BaseButton></div></div>
      </form>
    </section>
    <p class="module-description brand-storage-note">Settings are loaded from and saved to the server system configuration using multipart form data.</p>
  </section>
</template>

<style scoped>
.brand-form-fieldset { border: 0; margin: 0; padding: 0; min-width: 0; }
.brand-color-input { display: flex; gap: 8px; align-items: center; }
.brand-color-input .ui-input { flex: 1; min-width: 0; }
.brand-color-input input[type="color"] { width: 42px; height: 38px; padding: 2px; border: 1px solid var(--line, #d8e0e9); border-radius: 8px; background: transparent; cursor: pointer; }
.brand-file-input { width: 100%; min-width: 0; padding: 8px; }
.brand-preview { margin: 8px 24px 24px; padding: 20px; border: 1px solid var(--line, #d8e0e9); border-radius: 12px; }
.brand-preview-heading { display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; }
.brand-preview-logos { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.brand-preview-logo { min-height: 120px; padding: 12px; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 10px; border-radius: 8px; overflow-wrap: anywhere; }
.brand-preview-logo span { font-size: 12px; opacity: .8; }
.brand-preview-logo img { max-width: 100%; max-height: 72px; object-fit: contain; }
.brand-preview-logo small { font-size: 12px; text-align: center; }
.brand-preview-logo.light { background: #fff; color: #182333; }
.brand-preview-logo.dark { background: #111e2c; color: #f1f5f9; }
.brand-swatches { display: flex; flex-wrap: wrap; gap: 18px; margin-top: 18px; }
.brand-swatches > div { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.brand-swatches span { display: inline-block; width: 28px; height: 28px; border-radius: 7px; border: 1px solid #0001; }
.brand-form-message { margin: 0 24px 16px; font-size: 13px; }
.brand-form-message.error { color: #b43f4a; }
.brand-form-message.success { color: #16835d; }
.brand-storage-note { margin-top: 12px; }
@media (max-width: 640px) { .brand-preview-logos { grid-template-columns: 1fr; } .brand-preview { margin-inline: 12px; } }
</style>
