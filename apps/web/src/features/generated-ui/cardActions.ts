import type { LibraryActionEvent } from "@openuidev/react-lang"
import { useCallback } from "react"
import type { webLibrary } from "./webLibrary.tsx"

/** What a generated component asked for: `ConfirmExpense` or `DiscardExpense` with `{ id }`, or a built-in. */
export type CardAction = LibraryActionEvent<typeof webLibrary>

/**
 * The Renderer's `onAction`. A card fires an action with `useTriggerAction`
 * and a `custom_action` step; handling it means calling the API directly,
 * never the model (ADR-0007). Nothing fires one until the Draft card (W12).
 */
export const useCardActions = () => useCallback((_action: CardAction) => {}, [])
