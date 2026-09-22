<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  ChatDotRound,
  Close,
  Promotion,
  UserFilled,
} from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { useProjectStore } from '@/stores/project'
import { streamChat } from '@/api/chat'
import type { ChatRequest } from '@/types/api'

interface Message {
  role: 'user' | 'assistant'
  content: string
  pending?: boolean // 流式接收中
  error?: boolean
  citations?: string[]
}

const auth = useAuthStore()
const projectStore = useProjectStore()

const visible = ref(false)
const messages = ref<Message[]>([])
const input = ref('')
const sending = ref(false)
const abortController = ref<AbortController | null>(null)
const scrollRef = ref<HTMLDivElement>()

const canSend = computed(() => input.value.trim().length > 0 && !sending.value)
const projectId = computed(() => projectStore.currentProjectId)

const scrollToBottom = async () => {
  await nextTick()
  const el = scrollRef.value
  if (el) el.scrollTop = el.scrollHeight
}

const toggle = () => {
  visible.value = !visible.value
  if (visible.value) scrollToBottom()
}

const handleSend = async () => {
  const text = input.value.trim()
  if (!text || sending.value) return
  if (auth.token === '') {
    ElMessage.warning('请先登录后再发起对话')
    return
  }
  if (projectId.value === null) {
    ElMessage.warning('请先在顶部选择项目后再发起对话')
    return
  }
  const assistantMsg: Message = { role: 'assistant', content: '', pending: true }
  messages.value.push({ role: 'user', content: text }, assistantMsg)
  input.value = ''
  sending.value = true
  await scrollToBottom()

  const req: ChatRequest = {
    project_id: projectId.value,
    message: text,
    use_tools: true,
  }
  abortController.value = new AbortController()
  let buf = ''
  try {
    await streamChat(
      req,
      (evt) => {
        const t = evt.type
        if (t === 'token' && typeof evt.content === 'string') {
          buf += evt.content
          assistantMsg.content = buf
          scrollToBottom()
        } else if (t === 'done') {
          // done 携带完整五字段；若 token 流已写满则保留，否则取 answer
          if (typeof evt.answer === 'string' && evt.answer) {
            assistantMsg.content = evt.answer
          }
          if (Array.isArray(evt.citations) && evt.citations.length) {
            assistantMsg.citations = evt.citations.filter(
              (c): c is string => typeof c === 'string',
            )
          }
        } else if (t === 'error') {
          assistantMsg.error = true
          assistantMsg.content =
            (typeof evt.message === 'string' && evt.message) || '回答生成失败'
        }
      },
      abortController.value.signal,
    )
  } catch (e: unknown) {
    // 用户主动取消时不当作错误
    if (e instanceof DOMException && e.name === 'AbortError') {
      if (!assistantMsg.content) assistantMsg.content = '（已停止）'
    } else {
      assistantMsg.error = true
      assistantMsg.content =
        (e instanceof Error && e.message) || '网络异常，请重试'
    }
  } finally {
    assistantMsg.pending = false
    sending.value = false
    abortController.value = null
    scrollToBottom()
  }
}

const handleStop = () => {
  abortController.value?.abort()
}

const handleClear = () => {
  if (sending.value) return
  messages.value = []
}

// Enter 发送，Shift+Enter 换行
const handleEnter = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault()
    handleSend()
  }
}

const handleQuickStart = () => {
  input.value = '当前项目最近的压测运行情况如何？'
}

onBeforeUnmount(() => {
  abortController.value?.abort()
})
</script>

<template>
  <!-- AI 浮动头像按钮（面板打开时隐藏，由面板内 × 关闭） -->
  <div
    v-show="!visible"
    class="ai-fab"
    title="AI 助手"
    @click="toggle"
  >
    <el-icon class="ai-fab__icon"><ChatDotRound /></el-icon>
    <span class="ai-fab__badge" />
  </div>

  <!-- 聊天面板：贴右侧边缘，顶部从布局 header 下方 60px 起到底部 -->
  <transition name="ai-slide">
    <section v-if="visible" class="ai-panel">
      <header class="ai-panel__header">
        <div class="ai-panel__title">
          <el-icon class="ai-panel__logo"><ChatDotRound /></el-icon>
          <div class="ai-panel__titletext">
            <div class="ai-panel__name">AI 助手</div>
            <div class="ai-panel__sub">LoaderCloud 智能问答</div>
          </div>
        </div>
        <el-icon class="ai-panel__close" @click="visible = false"><Close /></el-icon>
      </header>

      <div ref="scrollRef" class="ai-panel__body">
        <div v-if="!messages.length" class="ai-empty">
          <el-icon class="ai-empty__icon"><ChatDotRound /></el-icon>
          <p class="ai-empty__title">你好，我是 AI 助手</p>
          <p class="ai-empty__desc">
            可以问我项目压测情况、运行结果分析、场景配置等
          </p>
          <el-button size="small" round @click="handleQuickStart">
            <el-icon><Promotion /></el-icon>试试看
          </el-button>
        </div>
        <div
          v-for="(m, i) in messages"
          :key="i"
          class="ai-msg"
          :class="`ai-msg--${m.role}`"
        >
          <div class="ai-msg__avatar">
            <el-icon v-if="m.role === 'user'"><UserFilled /></el-icon>
            <el-icon v-else><ChatDotRound /></el-icon>
          </div>
          <div class="ai-msg__main">
            <div
              class="ai-msg__bubble"
              :class="{
                'ai-msg__bubble--error': m.error,
                'ai-msg__bubble--pending': m.pending,
              }"
            >
              <template v-if="m.content">{{ m.content }}</template>
              <template v-else-if="m.pending">
                正在思考<span class="ai-msg__dots">…</span>
              </template>
            </div>
            <div v-if="m.citations?.length" class="ai-msg__citations">
              <span class="ai-msg__cite-label">引用：</span>
              <span
                v-for="(c, idx) in m.citations"
                :key="idx"
                class="ai-msg__cite-item"
                :title="c"
              >{{ c }}</span>
            </div>
          </div>
        </div>
      </div>

      <footer class="ai-panel__footer">
        <textarea
          v-model="input"
          class="ai-input"
          placeholder="输入问题，Enter 发送 / Shift+Enter 换行"
          rows="2"
          :disabled="sending"
          @keydown="handleEnter"
        />
        <div class="ai-panel__bar">
          <span class="ai-hint">
            <template v-if="projectId === null">请先选择项目</template>
            <template v-else>当前项目 #{{ projectId }}</template>
          </span>
          <div class="ai-panel__actions">
            <el-button v-if="sending" size="small" @click="handleStop">
              停止
            </el-button>
            <el-button
              size="small"
              :disabled="!canSend"
              @click="handleClear"
            >
              清空
            </el-button>
            <el-button
              type="primary"
              size="small"
              :disabled="!canSend"
              @click="handleSend"
            >
              <el-icon><Promotion /></el-icon>发送
            </el-button>
          </div>
        </div>
      </footer>
    </section>
  </transition>
</template>

<style scoped lang="scss">
.ai-fab {
  position: fixed;
  right: 28px;
  bottom: 28px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 2000;
  color: #fff;
  background: linear-gradient(135deg, var(--el-color-primary), #6a8dff);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  &:hover {
    transform: translateY(-2px) scale(1.04);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.24);
  }
  &__icon {
    font-size: 26px;
  }
  &__badge {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #f56c6c;
    border: 2px solid #fff;
  }
}

.ai-panel {
  position: fixed;
  top: 60px;
  right: 0;
  bottom: 0;
  width: 420px;
  max-width: 100vw;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
  border-left: 1px solid var(--el-border-color);
  box-shadow: -8px 0 24px rgba(0, 0, 0, 0.08);
  z-index: 2001;

  &__header {
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    border-bottom: 1px solid var(--el-border-color-lighter);
    background: linear-gradient(135deg, var(--el-color-primary), #6a8dff);
    color: #fff;
  }
  &__title {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  &__logo {
    font-size: 22px;
    color: #fff;
  }
  &__titletext {
    line-height: 1.2;
  }
  &__name {
    font-size: 15px;
    font-weight: 600;
  }
  &__sub {
    font-size: 12px;
    opacity: 0.85;
  }
  &__close {
    cursor: pointer;
    font-size: 18px;
    color: #fff;
    opacity: 0.85;
    transition: opacity 0.2s;
    &:hover {
      opacity: 1;
    }
  }
  &__body {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    background: var(--el-fill-color-lighter);
  }
  &__footer {
    border-top: 1px solid var(--el-border-color-lighter);
    background: var(--el-bg-color);
    padding: 10px 12px 8px;
  }
  &__bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 8px;
  }
  &__actions {
    display: flex;
    gap: 6px;
  }
}

.ai-empty {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--el-text-color-secondary);
  &__icon {
    font-size: 42px;
    color: var(--el-color-primary);
    margin-bottom: 4px;
  }
  &__title {
    margin: 0;
    font-size: 14px;
    color: var(--el-text-color-primary);
    font-weight: 600;
  }
  &__desc {
    margin: 0 0 4px;
    font-size: 12px;
    text-align: center;
    line-height: 1.5;
  }
}

.ai-msg {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  align-items: flex-start;
  &--user {
    flex-direction: row-reverse;
  }
  &__avatar {
    flex-shrink: 0;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    background: var(--el-color-primary);
    font-size: 16px;
  }
  &--user &__avatar {
    background: var(--el-color-success);
  }
  &__main {
    max-width: calc(100% - 42px);
    display: flex;
    flex-direction: column;
  }
  &--user &__main {
    align-items: flex-end;
  }
  &__bubble {
    padding: 8px 12px;
    border-radius: 8px;
    font-size: 13px;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
    &--error {
      color: var(--el-color-danger);
      background: var(--el-color-danger-light-9);
      border-color: var(--el-color-danger-light-5);
    }
    &--pending {
      &::after {
        content: '';
      }
    }
  }
  &--user &__bubble {
    background: var(--el-color-primary);
    color: #fff;
    border-color: var(--el-color-primary);
  }
  &__dots {
    display: inline-block;
    animation: ai-blink 1s steps(3, start) infinite;
  }
  &__citations {
    margin-top: 4px;
    font-size: 11px;
    color: var(--el-text-color-secondary);
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    align-items: center;
    max-width: 100%;
  }
  &__cite-label {
    color: var(--el-text-color-secondary);
  }
  &__cite-item {
    background: var(--el-fill-color);
    padding: 1px 6px;
    border-radius: 4px;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.ai-input {
  width: 100%;
  resize: none;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 13px;
  line-height: 1.5;
  font-family: inherit;
  outline: none;
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
  transition: border-color 0.2s;
  &:focus {
    border-color: var(--el-color-primary);
  }
  &:disabled {
    background: var(--el-fill-color-light);
    cursor: not-allowed;
  }
}

.ai-hint {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

// 右侧滑入动画
.ai-slide-enter-active,
.ai-slide-leave-active {
  transition: transform 0.25s ease, opacity 0.25s ease;
}
.ai-slide-enter-from,
.ai-slide-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

@keyframes ai-blink {
  0%,
  100% {
    opacity: 0.3;
  }
  50% {
    opacity: 1;
  }
}
</style>
