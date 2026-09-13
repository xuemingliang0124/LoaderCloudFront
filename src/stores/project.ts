import { defineStore } from 'pinia'
import { ref } from 'vue'
import { listProjects } from '@/api/projects'
import type { Project } from '@/types/api'

const CURRENT_PROJECT_KEY = 'ptp_current_project'

// 项目角色等级：数字越大权限越高（owner ⊃ editor ⊃ viewer）
const ROLE_ORDER: Record<string, number> = {
  观察者: 1,
  编辑者: 2,
  项目管理员: 3,
}

export const useProjectStore = defineStore('project', () => {
  // 当前用户可见的项目列表缓存（admin 全量，非 admin 仅成员项目）
  const projects = ref<Project[]>([])
  const currentProjectId = ref<number | null>(
    Number(localStorage.getItem(CURRENT_PROJECT_KEY)) || null,
  )
  const loading = ref(false)

  // 拉取项目列表并缓存；若当前选中项目不在列表中，清空选择
  const fetchProjects = async (): Promise<Project[]> => {
    loading.value = true
    try {
      const res = await listProjects({ page: 1, page_size: 100 })
      projects.value = res.items
      // 校验当前选中项目是否仍可见
      if (
        currentProjectId.value !== null &&
        !res.items.some((p) => p.id === currentProjectId.value)
      ) {
        currentProjectId.value = null
        localStorage.removeItem(CURRENT_PROJECT_KEY)
      }
      return res.items
    } finally {
      loading.value = false
    }
  }

  // 切换当前项目并持久化
  const setCurrent = (id: number) => {
    currentProjectId.value = id
    localStorage.setItem(CURRENT_PROJECT_KEY, String(id))
  }

  // 进入项目作用域页时若未选中，取列表第一个
  const selectFirstIfNeeded = async (): Promise<number | null> => {
    if (currentProjectId.value !== null) return currentProjectId.value
    let list = projects.value
    if (!list.length) list = await fetchProjects()
    if (list.length) {
      setCurrent(list[0].id)
      return list[0].id
    }
    return null
  }

  // 当前项目对象
  const currentProject = ref<Project | null>(null)
  const syncCurrentProject = () => {
    currentProject.value =
      projects.value.find((p) => p.id === currentProjectId.value) || null
  }

  // 判断当前用户在指定项目中的角色是否满足 required
  const hasRole = (project: Project | undefined, required: '观察者' | '编辑者' | '项目管理员'): boolean => {
    if (!project) return false
    return (ROLE_ORDER[project.my_role] || 0) >= (ROLE_ORDER[required] || 99)
  }

  return {
    projects,
    currentProjectId,
    currentProject,
    loading,
    fetchProjects,
    setCurrent,
    selectFirstIfNeeded,
    syncCurrentProject,
    hasRole,
  }
})
