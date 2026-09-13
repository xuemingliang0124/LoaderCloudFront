import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { login as loginApi } from '@/api/auth'
import type { LoginIn } from '@/types/api'

// localStorage key 与项目代号 ptp 一致
const TOKEN_KEY = 'ptp_token'
const USER_KEY = 'ptp_user'
const ROLE_KEY = 'ptp_role'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem(TOKEN_KEY) || '')
  const username = ref(localStorage.getItem(USER_KEY) || '')
  const role = ref(localStorage.getItem(ROLE_KEY) || '')

  // 全局角色：后端 DB 存 admin/user（历史 viewer 视为普通用户），仅 admin 为超管
  const isAdmin = computed(() => role.value === 'admin')

  const login = async (payload: LoginIn) => {
    const data = await loginApi(payload)
    token.value = data.token
    username.value = data.username
    role.value = data.role
    localStorage.setItem(TOKEN_KEY, data.token)
    localStorage.setItem(USER_KEY, data.username)
    localStorage.setItem(ROLE_KEY, data.role)
  }

  const logout = () => {
    token.value = ''
    username.value = ''
    role.value = ''
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    localStorage.removeItem(ROLE_KEY)
  }

  return { token, username, role, isAdmin, login, logout }
})
