import request from './request'
import { useAuthStore } from '@/stores/auth'
import type { AnswerOut, ChatRequest } from '@/types/api'

// 同步对话：POST /chat，返回 AnswerOut（统一响应壳 data 字段）
export const sendChat = (payload: ChatRequest) =>
  request.post<unknown, AnswerOut>('/chat', payload)

// SSE 流式事件：后端 astream_qa_events 推送的 event 字段（type 取 token/tool_call/error/done）
export type ChatStreamEvent = { type: string; [key: string]: unknown }

// 流式对话：POST /chat/stream，返回 text/event-stream，逐帧推送 token/error/done 事件
// axios 不便处理 SSE 流，使用原生 fetch + ReadableStream 解析 \n\n 分隔的 data: 行
export async function streamChat(
  payload: ChatRequest,
  onEvent: (evt: ChatStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const auth = useAuthStore()
  const baseURL = (import.meta.env.VITE_API_BASE || '/api/v1') as string
  const resp = await fetch(`${baseURL}/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(auth.token ? { Authorization: `Bearer ${auth.token}` } : {}),
    },
    body: JSON.stringify(payload),
    signal,
  })
  if (!resp.ok) {
    let msg = `请求失败 (${resp.status})`
    try {
      const body = await resp.json()
      msg = body.message || body.detail || msg
    } catch {
      // 响应非 JSON，使用默认提示
    }
    throw new Error(msg)
  }
  if (!resp.body) throw new Error('响应无内容流')
  const reader = resp.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    // SSE 事件以空行分隔；逐帧解析避免跨 chunk 截断
    let idx: number
    while ((idx = buffer.indexOf('\n\n')) >= 0) {
      const raw = buffer.slice(0, idx)
      buffer = buffer.slice(idx + 2)
      const line = raw.split('\n').find((l) => l.startsWith('data:'))
      if (!line) continue
      const json = line.slice(5).trim()
      if (!json) continue
      try {
        onEvent(JSON.parse(json) as ChatStreamEvent)
      } catch {
        // 忽略无法解析的事件帧
      }
    }
  }
}
