import { useEffect, useState } from 'react'

/** 값이 delayMs 동안 바뀌지 않을 때만 반영한다 (검색어 입력 디바운스용). */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
