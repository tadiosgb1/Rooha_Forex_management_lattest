import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'
import { apiRequest } from '../services/apiClient'

export const SYSTEM_CONFIG_DEFAULTS = Object.freeze({
  site_name: 'Forex Trading Platform',
  logo_light: '',
  logo_dark: '',
  favicon: '',
  base_color: '#16A34A',
  secondary_color: '#15803D',
  tertiary_color: '#0891B2',
})

function unwrapConfig(response) {
  let value = response?.data ?? response
  if (Array.isArray(value)) value = value[0]
  if (value && typeof value === 'object' && value.data && typeof value.data === 'object') value = value.data
  return value && typeof value === 'object' ? value : null
}

export const useSystemConfigStore = defineStore('systemConfig', () => {
  // The frontend defaults are always available, even before the API responds.
  const config = reactive({ ...SYSTEM_CONFIG_DEFAULTS })
  const loading = ref(false)
  const loaded = ref(false)
  const error = ref('')
  let pendingLoad = null

  function applyConfig(settings = config) {
    const root = document.documentElement
    root.style.setProperty('--brand-base-color', settings.base_color || SYSTEM_CONFIG_DEFAULTS.base_color)
    root.style.setProperty('--brand-secondary-color', settings.secondary_color || SYSTEM_CONFIG_DEFAULTS.secondary_color)
    root.style.setProperty('--brand-tertiary-color', settings.tertiary_color || SYSTEM_CONFIG_DEFAULTS.tertiary_color)
    document.title = settings.site_name || SYSTEM_CONFIG_DEFAULTS.site_name

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

  function setConfig(settings) {
    if (!settings || typeof settings !== 'object') return
    Object.assign(config, SYSTEM_CONFIG_DEFAULTS, settings)
    loaded.value = true
    applyConfig(config)
  }

  async function loadConfig({ force = false } = {}) {
    if (loaded.value && !force) return config
    if (pendingLoad && !force) return pendingLoad

    loading.value = true
    error.value = ''
    // Apply frontend-owned defaults immediately so the UI never waits on the API.
    applyConfig(config)

    pendingLoad = (async () => {
      try {
        const response = await apiRequest('system-config', { method: 'GET' })
        const settings = unwrapConfig(response)
        if (settings && Object.keys(settings).length) {
          setConfig(settings)
        } else {
          setConfig(SYSTEM_CONFIG_DEFAULTS)
        }
        return config
      } catch (cause) {
        error.value = cause?.message || 'Unable to load system configuration.'
        // Keep using frontend defaults when the backend has no configuration yet
        // or is temporarily unavailable. Do not write defaults to the server here.
        setConfig(SYSTEM_CONFIG_DEFAULTS)
        return config
      } finally {
        loading.value = false
        pendingLoad = null
      }
    })()
    return pendingLoad
  }

  return { config, loading, loaded, error, loadConfig, setConfig, applyConfig }
})
