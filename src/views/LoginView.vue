<script setup>
import { ref } from 'vue'
import { useSystemConfigStore } from '../stores/systemConfig'
import { useRouter } from 'vue-router'
import { useAppStore } from '../stores/app'
import { apiRequest, setAuthToken } from '../services/apiClient'
import logo from '../assets/images/logo.png'
import BaseButton from '../components/ui/BaseButton.vue'
import BaseInput from '../components/ui/BaseInput.vue'

const store = useAppStore()
const systemConfig = useSystemConfigStore()
const router = useRouter()
const email = ref('admin@gmail.com')
const password = ref('')
const loading = ref(false)
const errorMessage = ref('')
const errorTitle = ref('')

function showLoginError(title, message) {
  errorTitle.value = title
  errorMessage.value = message
}

function handleLoginError(error) {
  const status = Number(error?.status || 0)

  if (error?.code === 'NETWORK_ERROR' || status === 0) {
    showLoginError(
      'Connection problem',
      'We couldn’t connect to the sign-in service. Check your network connection and try again. If the problem continues, contact your system administrator.'
    )
    return
  }

  if (error?.code === 'REQUEST_ABORTED') {
    showLoginError(
      'Request timed out',
      'The sign-in service took too long to respond. Please try again.'
    )
    return
  }

  if (status === 400 || status === 422) {
    showLoginError(
      'Check your sign-in details',
      'Please check that your email and password are entered correctly, then try again.'
    )
    return
  }

  if (status === 401 || status === 403) {
    showLoginError(
      'Sign-in unsuccessful',
      'The email or password may be incorrect, or your account may not have permission to sign in. Check your details and try again.'
    )
    return
  }

  if (status === 404) {
    showLoginError(
      'Sign-in service unavailable',
      'The sign-in service could not be found. Please contact your system administrator.'
    )
    return
  }

  if (status === 429) {
    showLoginError(
      'Too many attempts',
      'There have been too many sign-in attempts. Please wait a moment before trying again.'
    )
    return
  }

  if (status >= 500) {
    showLoginError(
      'Service temporarily unavailable',
      'The server couldn’t complete your sign-in request. Please try again shortly.'
    )
    return
  }

  showLoginError(
    'Unable to sign in',
    'We couldn’t complete your sign-in request. Please try again. If the problem continues, contact your system administrator.'
  )
}

async function login() {
  if (loading.value) return

  errorMessage.value = ''
  errorTitle.value = ''

  const normalizedEmail = email.value.trim()
  if (!normalizedEmail || !password.value) {
    showLoginError('Missing sign-in details', 'Enter your email address and password to continue.')
    return
  }

  loading.value = true

  try {
    const response = await apiRequest('users/login', {
      method: 'POST',
      body: { email: normalizedEmail, password: password.value },
    })

    const user = response?.data?.user ?? response?.user ?? response?.data
    const token = response?.token ?? response?.access_token ?? response?.accessToken ??
      response?.data?.token ?? response?.data?.access_token ?? response?.data?.accessToken

    if (response?.status !== 'success' || !user || user.id === undefined || user.id === null) {
      showLoginError(
        'Unable to sign in',
        'The sign-in service returned an unexpected response. Please try again, or contact your system administrator if the problem continues.'
      )
      return
    }

    setAuthToken(token)
    store.login(user)
    await router.push('/')
  } catch (error) {
    handleLoginError(error)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="modular-login-page">
    <div class="modular-login-brand">
      <img
        :src="systemConfig.config.logo_light || logo"
        :alt="`${systemConfig.config.site_name} logo`"
        style="display: block; width: 180px; max-width: 100%; max-height: 100px; height: auto; object-fit: contain; margin-bottom: 1.5rem;"
      />
      <p class="modular-eyebrow">NBE-READY OPERATIONS</p>
      <h1>{{ systemConfig.config.site_name }}</h1>
      <p>Multi-branch foreign currency trading, treasury control, KYC/AML and accounting.</p>
      <div class="modular-login-footnote">Secure access · Backend authentication</div>
    </div>

    <form class="modular-login-card" @submit.prevent="login" novalidate>
      <p class="module-eyebrow">SECURE ACCESS</p>
      <h2>Sign in to operations</h2>
      <p class="module-description">Enter your registered email and password to continue.</p>

      <div class="module-form-field">
        <BaseInput v-model="email" label="Email" type="email" autocomplete="username" required />
      </div>
      <div class="module-form-field">
        <BaseInput v-model="password" label="Password" type="password" autocomplete="current-password" required />
      </div>

      <div
        v-if="errorMessage"
        class="modular-login-error"
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
      >
        <span class="modular-login-error-icon" aria-hidden="true">!</span>
        <div class="modular-login-error-copy">
          <strong>{{ errorTitle || 'Unable to sign in' }}</strong>
          <p>{{ errorMessage }}</p>
        </div>
      </div>

      <BaseButton class="module-primary-btn modular-login-submit" type="submit" :disabled="loading" :loading="loading">
        {{ loading ? 'Signing in…' : 'Sign in →' }}
      </BaseButton>
    </form>
  </div>
</template>

<style scoped>
.modular-login-error {
  box-sizing: border-box;
  display: flex !important;
  align-items: flex-start;
  gap: 12px;
  width: 100%;
  margin: 18px 0 14px;
  padding: 15px 16px;
  border: 1px solid #efb8be;
  border-left: 4px solid #c43d4b;
  border-radius: 10px;
  background: #fff4f5;
  color: #7f1d2d;
  box-shadow: 0 4px 14px rgba(127, 29, 45, 0.08);
  text-align: left;
}
.modular-login-error-icon {
  box-sizing: border-box;
  display: inline-flex;
  flex: 0 0 28px;
  width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #b42332;
  color: #fff;
  font-size: 16px;
  font-weight: 800;
  line-height: 1;
}
.modular-login-error-copy {
  flex: 1;
  min-width: 0;
}
.modular-login-error-copy strong {
  display: block;
  margin: 1px 0 5px;
  color: #8f1d2c;
  font-size: 14px;
  font-weight: 750;
  line-height: 1.4;
}
.modular-login-error-copy p {
  display: block;
  margin: 0;
  color: #762b36;
  font-size: 13px;
  font-weight: 450;
  line-height: 1.6;
  white-space: normal;
  overflow-wrap: anywhere;
}
.modular-login-submit {
  width: 100%;
}
@media (max-width: 480px) {
  .modular-login-error {
    gap: 9px;
    padding: 12px;
  }
  .modular-login-error-copy p {
    font-size: 12px;
  }
}
</style>
