// Vitest 全局 setup：注册 Element Plus + Vue Router + Pinia 所需环境
import { config } from '@vue/test-utils'

// Element Plus 组件在测试中按需全局注册，避免自动导入插件在 vitest 下失效
import ElementPlus from 'element-plus'

config.global.plugins.push(ElementPlus)

// 全局 mock window.matchMedia（jsdom 未实现）
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})

// Element Plus ResizeObserver mock
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
;(globalThis as any).ResizeObserver = ResizeObserverMock
