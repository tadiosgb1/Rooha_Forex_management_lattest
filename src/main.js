import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import './style.css'
import { hasPermission } from './utils/permissions'

const app = createApp(App)
app.config.globalProperties.hasPermission = hasPermission
app.use(createPinia())
app.use(router)
app.mount('#app')
