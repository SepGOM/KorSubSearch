import type { Repository } from './types'
import { createBrowserJsonRepository } from './browserJsonRepository'
import { createTauriRepository } from './tauriRepository'

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

/** 실행 환경에 맞는 저장소를 고른다. Tauri 안이면 SQLite, 아니면 정적 JSON. */
export function createRepository(): Repository {
  return isTauriRuntime() ? createTauriRepository() : createBrowserJsonRepository()
}
