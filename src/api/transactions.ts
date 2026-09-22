import request from './request'
import type {
  PageResult,
  Transaction,
  TransactionDeletePrecheck,
  TransactionDeleteResult,
  TransactionIn,
  TransactionQuery,
  TransactionUpdateIn,
} from '@/types/api'

// 分页列表：name 模糊、txn_code 精确，按 id 倒序
export const listTransactions = (projectId: number, params: TransactionQuery = {}) =>
  request.get<unknown, PageResult<Transaction>>(
    `/projects/${projectId}/transactions`,
    { params },
  )

// 交易详情
export const getTransaction = (projectId: number, txnId: number) =>
  request.get<unknown, Transaction>(`/projects/${projectId}/transactions/${txnId}`)

// 新建交易：项目内 txn_code 不可重复（3050），default_script_id 须属同项目（3054）
export const createTransaction = (projectId: number, payload: TransactionIn) =>
  request.post<unknown, Transaction>(`/projects/${projectId}/transactions`, payload)

// 更新交易：所有字段可选，至少传一项；txn_code 变更后不可与项目内其他重复
export const updateTransaction = (
  projectId: number,
  txnId: number,
  payload: TransactionUpdateIn,
) =>
  request.put<unknown, Transaction>(
    `/projects/${projectId}/transactions/${txnId}`,
    payload,
  )

// 删除前预检：返回引用该交易的场景/方案数（当前阶段恒为 0）
export const precheckTransactionDelete = (projectId: number, txnId: number) =>
  request.get<unknown, TransactionDeletePrecheck>(
    `/projects/${projectId}/transactions/${txnId}/delete-precheck`,
  )

// 删除：遵循「预检 + force」模式，被引用时严格模式拒绝（3053）
export const deleteTransaction = (
  projectId: number,
  txnId: number,
  force = false,
) =>
  request.delete<unknown, TransactionDeleteResult>(
    `/projects/${projectId}/transactions/${txnId}`,
    { params: { force } },
  )
