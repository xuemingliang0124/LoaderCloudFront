<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { type FormInstance, type FormRules } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import type { LoginIn } from '@/types/api'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const formRef = ref<FormInstance>()
const loading = ref(false)
const form = reactive<LoginIn>({
  // dev 预填默认账号（生产不预填）
  username: 'admin',
  password: 'admin123',
})

const rules: FormRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

const handleLogin = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    loading.value = true
    try {
      await auth.login(form)
      const redirect = (route.query.redirect as string) || '/agents'
      router.push(redirect)
    } catch {
      // 拦截器已弹 ElMessage
    } finally {
      loading.value = false
    }
  })
}
</script>

<template>
  <div class="login">
    <el-card class="login__card">
      <template #header>
        <div class="login__title">LoaderCloud 压测平台</div>
      </template>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="0" @submit.prevent>
        <el-form-item prop="username">
          <el-input v-model="form.username" placeholder="用户名" size="large" />
        </el-form-item>
        <el-form-item prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="密码"
            size="large"
            show-password
            @keyup.enter="handleLogin"
          />
        </el-form-item>
        <el-button
          type="primary"
          size="large"
          class="login__btn"
          :loading="loading"
          @click="handleLogin"
        >
          登录
        </el-button>
      </el-form>
    </el-card>
  </div>
</template>

<style scoped lang="scss">
.login {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
  &__card {
    width: 380px;
  }
  &__title {
    text-align: center;
    font-size: 18px;
    font-weight: 600;
  }
  &__btn {
    width: 100%;
  }
}
</style>
