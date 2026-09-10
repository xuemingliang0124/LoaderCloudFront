import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { ElMessage } from 'element-plus'
import type { ApiResponse } from '@/types/api'
import { useAuthStore } from '@/stores/auth'
import router from '@/router'

const instance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '/api/v1',
  timeout: 30000,
})

// 请求拦截器：注入 Bearer token（token 来自 authStore，不直接读 localStorage）
instance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const auth = useAuthStore()
  if (auth.token) {
    config.headers.Authorization = `Bearer ${auth.token}`
  }
  return config
})

// 响应拦截器（成功分支）：code=0 返回 data；code≠0 兜底抛错
instance.interceptors.response.use(
  (resp) => {
    const body = resp.data as ApiResponse
    if (body.code !== 0) {
      ElMessage.error(body.message || '请求失败')
      return Promise.reject(new Error(body.message))
    }
    return body.data as never
  },
  (err: AxiosError<ApiResponse | { detail?: string }>) => {
    const status = err.response?.status
    // 1. 401 优先：登出 + 跳登录，不弹 ElMessage（避免与登录页叠加）
    if (status === 401) {
      const auth = useAuthStore()
      auth.logout()
      const redirect = router.currentRoute.value.fullPath
      router.push(`/login?redirect=${encodeURIComponent(redirect)}`)
      return Promise.reject(err)
    }
    // 2. 400 业务错误：读后端 {code, message}（BusinessError 走此通道）
    if (status === 400 && err.response?.data && 'message' in err.response.data) {
      ElMessage.error((err.response.data as ApiResponse).message)
      return Promise.reject(err)
    }
    // 3. 其他：兜底
    const msg = (err.response?.data as ApiResponse | undefined)?.message || err.message || '网络异常'
    ElMessage.error(msg)
    return Promise.reject(err)
  },
)

export default instance
