import { useSyncExternalStore } from "react"

const noMatch = () => false

/** Whether `query` matches now, following changes. False where `matchMedia` is missing. */
export const useMediaQuery = (query: string): boolean =>
  useSyncExternalStore(
    (onChange) => {
      if (typeof window.matchMedia !== "function") return () => {}
      const list = window.matchMedia(query)
      list.addEventListener("change", onChange)
      return () => list.removeEventListener("change", onChange)
    },
    typeof window.matchMedia === "function" ? () => window.matchMedia(query).matches : noMatch,
    noMatch,
  )
