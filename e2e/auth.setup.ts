import { test as setup } from '@playwright/test'

const authFile = 'e2e/.auth/user.json'

setup('登录并保存认证状态', async ({ page }) => {
  await page.goto('/login')
  // 登录表单已预填 admin/admin123，直接点登录
  await page.getByRole('button', { name: '登录' }).click()
  // 登录成功后跳转到 /agents，等待侧边栏出现
  await page.waitForURL(/\/agents/, { timeout: 10000 })
  await page.getByText('全局管理').waitFor({ state: 'visible' })
  // 保存 localStorage（含 token）与 cookie
  await page.context().storageState({ path: authFile })
})
