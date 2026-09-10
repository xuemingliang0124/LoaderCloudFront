import request from './request'
import type { LoginIn, LoginOut } from '@/types/api'

export const login = (payload: LoginIn) =>
  request.post<unknown, LoginOut>('/auth/login', payload)
