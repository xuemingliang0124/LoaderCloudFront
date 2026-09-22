import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import TransactionList from '../TransactionList.vue'

// ===== Mock 数据 =====
const mockTransactions = [
  {
    id: 1,
    project_id: 100,
    name: '登录交易',
    txn_code: 'login',
    default_script_id: 1,
    sla_tps: 100,
    sla_p95_ms: 500,
    sla_error_rate: 1.0,
    description: '登录接口压测',
    created_at: '2026-09-01T10:00:00Z',
    updated_at: '2026-09-01T10:00:00Z',
  },
  {
    id: 2,
    project_id: 100,
    name: '下单交易',
    txn_code: 'create_order',
    default_script_id: null,
    sla_tps: null,
    sla_p95_ms: null,
    sla_error_rate: null,
    description: '',
    created_at: '2026-09-02T10:00:00Z',
    updated_at: '2026-09-02T10:00:00Z',
  },
]

const mockScripts = [
  { id: 1, name: '登录脚本', version: '1.0', file_key: '', data_files: null, params: null, plugins: null, description: '' },
  { id: 2, name: '下单脚本', version: '2.0', file_key: '', data_files: null, params: null, plugins: null, description: '' },
]

// ===== API Mock（用 vi.hoisted 避免 vi.mock 提升导致的 TDZ 问题）=====
const {
  listTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  precheckTransactionDelete,
} = vi.hoisted(() => ({
  listTransactions: vi.fn(),
  createTransaction: vi.fn(),
  updateTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
  precheckTransactionDelete: vi.fn(),
}))

const { listScripts } = vi.hoisted(() => ({
  listScripts: vi.fn(),
}))

vi.mock('@/api/transactions', () => ({
  listTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  precheckTransactionDelete,
}))

vi.mock('@/api/scripts', () => ({
  listScripts,
}))

// ===== Store Mock =====
// 控制 canWrite / canDelete 的角色
let mockRole = '项目管理员'
let mockIsAdmin = false

vi.mock('@/stores/project', () => ({
  useProjectStore: () => ({
    projects: [{ id: 100, name: '测试项目', my_role: mockRole }],
    currentProjectId: 100,
    hasRole: (p: any, required: string) => {
      if (!p) return false
      const order: Record<string, number> = { 观察者: 1, 编辑者: 2, 项目管理员: 3 }
      return (order[p.my_role] || 0) >= (order[required] || 99)
    },
  }),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    isAdmin: mockIsAdmin,
    role: mockRole,
  }),
}))

// ===== Router Mock =====
vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { projectId: 100 } }),
}))

// ===== 挂载辅助 =====
const mountComponent = () => {
  setActivePinia(createPinia())
  return mount(TransactionList, {
    global: {
      stubs: {
        teleport: true,
        // 以下 Element Plus 组件依赖 popper/ResizeObserver，jsdom 下会触发递归更新，
        // 用简单桩替换，不影响业务逻辑断言
        'el-select': { template: '<select :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><slot /></select>', props: ['modelValue'] },
        'el-option': { template: '<option :value="value">{{ label }}</option>', props: ['value', 'label'] },
        'el-input-number': { template: '<input type="number" :value="modelValue" @input="$emit(\'update:modelValue\', Number($event.target.value) || null)" />', props: ['modelValue'] },
      },
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockRole = '项目管理员'
  mockIsAdmin = false
  listTransactions.mockResolvedValue({ total: mockTransactions.length, items: mockTransactions })
  listScripts.mockResolvedValue({ total: mockScripts.length, items: mockScripts })
  createTransaction.mockResolvedValue(mockTransactions[0])
  updateTransaction.mockResolvedValue(mockTransactions[0])
  deleteTransaction.mockResolvedValue({ id: 1, deleted: true, force: false, removed_scenarios: 0, removed_test_plans: 0 })
  precheckTransactionDelete.mockResolvedValue({ transaction_id: 1, scenarios: 0, test_plans: 0 })
  // 清理上一个测试残留的 MessageBox / Dialog（它们渲染到 body）
  document.body.innerHTML = ''
})

describe('TransactionList.vue', () => {
  it('挂载后调用 listTransactions 并渲染表格数据', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    expect(listTransactions).toHaveBeenCalledTimes(1)
    expect(listTransactions).toHaveBeenCalledWith(100, {
      name: undefined,
      txn_code: undefined,
      page: 1,
      page_size: 20,
    })

    const text = wrapper.text()
    expect(text).toContain('登录交易')
    expect(text).toContain('login')
    expect(text).toContain('下单交易')
    expect(text).toContain('create_order')
  })

  it('SLA 空值显示为 "-"', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    // 第二条交易 SLA 全空
    expect(wrapper.text()).toContain('-')
  })

  it('查询按钮点击时以 name/txn_code 调用列表接口', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    const inputs = wrapper.findAll('input')
    // 第一个 input 是交易名称
    await inputs[0].setValue('登录')
    // 第二个 input 是交易编码
    await inputs[1].setValue('login')

    const buttons = wrapper.findAll('button')
    const searchBtn = buttons.find((b) => b.text() === '查询')
    await searchBtn!.trigger('click')
    await flushPromises()

    expect(listTransactions).toHaveBeenLastCalledWith(100, {
      name: '登录',
      txn_code: 'login',
      page: 1,
      page_size: 20,
    })
  })

  it('重置按钮清空筛选条件并重新查询', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    const inputs = wrapper.findAll('input')
    await inputs[0].setValue('登录')
    await inputs[1].setValue('login')

    const buttons = wrapper.findAll('button')
    const resetBtn = buttons.find((b) => b.text() === '重置')
    await resetBtn!.trigger('click')
    await flushPromises()

    expect(inputs[0].element.value).toBe('')
    expect(inputs[1].element.value).toBe('')
    expect(listTransactions).toHaveBeenLastCalledWith(100, {
      name: undefined,
      txn_code: undefined,
      page: 1,
      page_size: 20,
    })
  })

  it('编辑者角色：新建/编辑按钮可见，删除按钮不可见', async () => {
    mockRole = '编辑者'
    const wrapper = mountComponent()
    await flushPromises()

    const text = wrapper.text()
    expect(text).toContain('新建交易')
    expect(text).toContain('编辑')
    expect(text).not.toContain('删除')
  })

  it('观察者角色：仅详情按钮可见', async () => {
    mockRole = '观察者'
    const wrapper = mountComponent()
    await flushPromises()

    const text = wrapper.text()
    expect(text).not.toContain('新建交易')
    expect(text).not.toContain('编辑')
    expect(text).not.toContain('删除')
    expect(text).toContain('详情')
  })

  it('admin 角色：所有操作按钮均可见', async () => {
    mockRole = '普通用户'
    mockIsAdmin = true
    const wrapper = mountComponent()
    await flushPromises()

    const text = wrapper.text()
    expect(text).toContain('新建交易')
    expect(text).toContain('编辑')
    expect(text).toContain('删除')
  })

  it('新建交易：空名称时提示 warning，不调用 API', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    // 打开新建弹窗
    const createBtn = wrapper.findAll('button').find((b) => b.text() === '新建交易')
    await createBtn!.trigger('click')
    await flushPromises()

    // 名称留空，直接点创建
    const submitBtn = wrapper.findAll('button').find((b) => b.text() === '创建')
    await submitBtn!.trigger('click')
    await flushPromises()

    expect(createTransaction).not.toHaveBeenCalled()
  })

  it('新建交易：填写完整后调用 createTransaction', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    const createBtn = wrapper.findAll('button').find((b) => b.text() === '新建交易')
    await createBtn!.trigger('click')
    await flushPromises()

    // 限定到新建弹窗内的输入框（按 placeholder 定位）
    const nameInput = wrapper.find('input[placeholder="如：登录交易"]')
    const codeInput = wrapper.find('input[placeholder="如：login（项目内唯一）"]')
    await nameInput.setValue('支付交易')
    await codeInput.setValue('pay')

    const submitBtn = wrapper.findAll('button').find((b) => b.text() === '创建')
    await submitBtn!.trigger('click')
    await flushPromises()

    expect(createTransaction).toHaveBeenCalledTimes(1)
    expect(createTransaction).toHaveBeenCalledWith(100, {
      name: '支付交易',
      txn_code: 'pay',
      default_script_id: null,
      sla_tps: null,
      sla_p95_ms: null,
      sla_error_rate: null,
      description: '',
    })
  })

  it('编辑交易：仅提交变更字段', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    // 点击第一行的编辑按钮
    const editBtn = wrapper.findAll('button').find((b) => b.text() === '编辑')
    await editBtn!.trigger('click')
    await flushPromises()

    // 修改描述（textarea）
    const textarea = wrapper.find('textarea')
    await textarea.setValue('更新后的描述')

    const submitBtn = wrapper.findAll('button').find((b) => b.text() === '保存')
    await submitBtn!.trigger('click')
    await flushPromises()

    expect(updateTransaction).toHaveBeenCalledTimes(1)
    const [projectId, txnId, payload] = updateTransaction.mock.calls[0]
    expect(projectId).toBe(100)
    expect(txnId).toBe(1)
    // 仅 description 变更，其余字段不应出现在 payload 中
    expect(payload).toEqual({ description: '更新后的描述' })
  })

  it('编辑交易：未修改任何字段时提示 info，不调用 API', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    const editBtn = wrapper.findAll('button').find((b) => b.text() === '编辑')
    await editBtn!.trigger('click')
    await flushPromises()

    const submitBtn = wrapper.findAll('button').find((b) => b.text() === '保存')
    await submitBtn!.trigger('click')
    await flushPromises()

    expect(updateTransaction).not.toHaveBeenCalled()
  })

  it('删除交易：调用预检接口，确认后调用 deleteTransaction', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    const deleteBtn = wrapper.findAll('button').find((b) => b.text() === '删除')
    await deleteBtn!.trigger('click')
    await flushPromises()

    expect(precheckTransactionDelete).toHaveBeenCalledWith(100, 1)

    // Element Plus MessageBox 渲染在 body 中，确认按钮文本为"删除"
    const confirmBtn = document.querySelector('.el-message-box__btns .el-button--primary')
    expect(confirmBtn).not.toBeNull()
    ;(confirmBtn as HTMLButtonElement).click()
    await flushPromises()

    expect(deleteTransaction).toHaveBeenCalledWith(100, 1, false)
  })

  it('删除交易：被引用时 force=true 删除', async () => {
    precheckTransactionDelete.mockResolvedValue({ transaction_id: 1, scenarios: 2, test_plans: 1 })
    const wrapper = mountComponent()
    await flushPromises()

    const deleteBtn = wrapper.findAll('button').find((b) => b.text() === '删除')
    await deleteBtn!.trigger('click')
    await flushPromises()

    // 取最新（最后一个）MessageBox 的确认按钮
    const boxes = document.querySelectorAll('.el-message-box')
    const confirmBtn = boxes[boxes.length - 1].querySelector('.el-button--primary')
    ;(confirmBtn as HTMLButtonElement).click()
    await flushPromises()

    expect(deleteTransaction).toHaveBeenCalledWith(100, 1, true)
  })

  it('详情按钮打开详情弹窗展示交易信息', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    const detailBtn = wrapper.findAll('button').find((b) => b.text() === '详情')
    await detailBtn!.trigger('click')
    await flushPromises()

    const text = wrapper.text()
    expect(text).toContain('交易详情')
    expect(text).toContain('登录交易')
    expect(text).toContain('login')
  })
})
