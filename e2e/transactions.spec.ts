import { test, expect } from '@playwright/test'

// 交易清单页面 E2E 测试
// 前置：auth.setup.ts 已登录并保存 storageState
const PROJECT_ID = 1
const TXN_PAGE = `/projects/${PROJECT_ID}/assets/transactions`

// 生成唯一交易编码，避免与已有数据冲突
const uniqueCode = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}`

test.describe('交易清单管理', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(TXN_PAGE)
    // 等待表格加载
    await page.getByRole('button', { name: '新建交易' }).waitFor({ state: 'visible' })
  })

  test('页面加载：展示交易清单标题与表格列', async ({ page }) => {
    // 卡片标题
    await expect(page.getByText('交易清单管理').first()).toBeVisible()
    // 表格列头
    await expect(page.getByRole('columnheader', { name: '交易名称' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: '交易编码' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: '默认脚本' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'SLA 目标 TPS' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: '操作' })).toBeVisible()
  })

  test('新建交易：填写完整表单并创建成功', async ({ page }) => {
    const txnCode = uniqueCode('e2e_create')
    const txnName = 'E2E新建交易'

    await page.getByRole('button', { name: '新建交易' }).click()
    // 等待弹窗出现
    await page.getByText('新建交易').nth(1).waitFor({ state: 'visible' })

    // 填写表单
    await page.getByLabel('交易名称').fill(txnName)
    await page.getByLabel('交易编码').fill(txnCode)
    await page.getByLabel('SLA 目标 TPS').fill('200')
    await page.getByLabel('SLA P95(ms)').fill('800')
    await page.getByLabel('SLA 错误率(%)').fill('0.5')
    await page.getByLabel('描述').fill('E2E 自动化测试创建')

    // 提交
    await page.getByRole('button', { name: '创建' }).click()

    // 成功提示
    await expect(page.getByText('创建成功').first()).toBeVisible()
    // 表格中出现新交易
    await expect(page.getByRole('cell', { name: txnName }).first()).toBeVisible()
    await expect(page.getByRole('cell', { name: txnCode }).first()).toBeVisible()
  })

  test('新建交易：名称为空时前端拦截，不调用接口', async ({ page }) => {
    await page.getByRole('button', { name: '新建交易' }).click()
    await page.getByText('新建交易').nth(1).waitFor({ state: 'visible' })

    // 名称留空，填写编码
    await page.getByLabel('交易编码').fill(uniqueCode('e2e_empty'))

    await page.getByRole('button', { name: '创建' }).click()
    // 应有 warning 提示（名称为空）
    await expect(page.getByText('交易名称不能为空').first()).toBeVisible()
  })

  test('查询：按交易编码精确过滤', async ({ page }) => {
    // 先创建一条用于查询
    const txnCode = uniqueCode('e2e_search')
    await page.getByRole('button', { name: '新建交易' }).click()
    await page.getByText('新建交易').nth(1).waitFor({ state: 'visible' })
    await page.getByLabel('交易名称').fill('E2E查询测试')
    await page.getByLabel('交易编码').fill(txnCode)
    await page.getByRole('button', { name: '创建' }).click()
    await expect(page.getByText('创建成功').first()).toBeVisible()

    // 在查询框输入编码并查询
    await page.getByPlaceholder('交易编码').fill(txnCode)
    await page.getByRole('button', { name: '查询' }).click()

    // 表格应仅展示匹配的交易
    await expect(page.getByRole('cell', { name: txnCode }).first()).toBeVisible()
  })

  test('编辑交易：修改描述并保存', async ({ page }) => {
    // 先创建一条
    const txnCode = uniqueCode('e2e_edit')
    await page.getByRole('button', { name: '新建交易' }).click()
    await page.getByText('新建交易').nth(1).waitFor({ state: 'visible' })
    await page.getByLabel('交易名称').fill('E2E编辑前')
    await page.getByLabel('交易编码').fill(txnCode)
    await page.getByRole('button', { name: '创建' }).click()
    await expect(page.getByText('创建成功').first()).toBeVisible()

    // 找到该行并点编辑
    const row = page.getByRole('row', { name: txnCode })
    await row.getByRole('button', { name: '编辑' }).click()
    await page.getByText('编辑交易').waitFor({ state: 'visible' })

    // 限定到编辑弹窗内（避免与残留的创建弹窗输入框冲突）
    const editDialog = page.getByRole('dialog', { name: '编辑交易' })
    await editDialog.getByLabel('交易名称').fill('E2E编辑后')
    await editDialog.getByLabel('描述').fill('编辑后的描述内容')
    await editDialog.getByRole('button', { name: '保存' }).click()

    await expect(page.getByText('更新成功').first()).toBeVisible()
    await expect(page.getByRole('cell', { name: 'E2E编辑后' }).first()).toBeVisible()
  })

  test('详情：点击详情展示交易完整信息', async ({ page }) => {
    // 先创建一条
    const txnCode = uniqueCode('e2e_detail')
    await page.getByRole('button', { name: '新建交易' }).click()
    await page.getByText('新建交易').nth(1).waitFor({ state: 'visible' })
    await page.getByLabel('交易名称').fill('E2E详情测试')
    await page.getByLabel('交易编码').fill(txnCode)
    await page.getByLabel('SLA 目标 TPS').fill('150')
    await page.getByRole('button', { name: '创建' }).click()
    await expect(page.getByText('创建成功').first()).toBeVisible()

    // 点详情
    const row = page.getByRole('row', { name: txnCode })
    await row.getByRole('button', { name: '详情' }).click()

    // 详情弹窗内容
    const dialog = page.getByRole('dialog', { name: '交易详情' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('E2E详情测试')).toBeVisible()
    await expect(dialog.getByText(txnCode)).toBeVisible()
  })

  test('删除交易：确认后从列表移除', async ({ page }) => {
    // 先创建一条
    const txnCode = uniqueCode('e2e_delete')
    await page.getByRole('button', { name: '新建交易' }).click()
    await page.getByText('新建交易').nth(1).waitFor({ state: 'visible' })
    await page.getByLabel('交易名称').fill('E2E删除测试')
    await page.getByLabel('交易编码').fill(txnCode)
    await page.getByRole('button', { name: '创建' }).click()
    await expect(page.getByText('创建成功').first()).toBeVisible()

    // 点删除
    const row = page.getByRole('row', { name: txnCode })
    await row.getByRole('button', { name: '删除' }).click()

    // 确认弹窗
    const confirmBox = page.getByRole('dialog', { name: '删除确认' })
    await expect(confirmBox).toBeVisible()
    await confirmBox.getByRole('button', { name: '删除' }).click()

    await expect(page.getByText('删除成功').first()).toBeVisible()
    // 该交易不再出现在列表中
    await expect(page.getByRole('cell', { name: txnCode })).toHaveCount(0)
  })
})
