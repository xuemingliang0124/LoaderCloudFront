import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import 'element-plus/theme-chalk/dark/css-vars.css'
// 函数式服务组件（ElMessage/ElMessageBox）不走模板标签，unplugin-vue-components
// 无法按需注入样式，必须全局显式引入，否则弹窗无遮罩/定位样式
import 'element-plus/es/components/message/style/css'
import 'element-plus/es/components/message-box/style/css'
import './styles/global.scss'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
