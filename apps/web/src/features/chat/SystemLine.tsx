import { CircleAlert } from "lucide-react"
import type { ReplyFailure } from "./useChatSession.ts"

const sayings: Readonly<Record<ReplyFailure, { readonly text: string; readonly retry: boolean }>> =
  {
    "model-unreachable": { text: "Couldn't reach the model.", retry: true },
    "rate-limited": { text: "The model is busy. Wait a moment, then retry.", retry: true },
    network: { text: "Couldn't reach the server.", retry: true },
    "cut-off": { text: "The reply stopped early.", retry: true },
    failed: { text: "Something went wrong.", retry: true },
    unauthorized: { text: "Not authorised. Check the API token.", retry: false },
    "receipt-not-found": { text: "That receipt is gone. Attach it again.", retry: false },
    "receipt-invalid": {
      text: "Couldn't read that photo. Attach a JPEG, PNG or WebP.",
      retry: false,
    },
  }

/** A system line, not a card: what failed, in one line, with Retry when sending again can help. */
export const SystemLine = ({
  failure,
  onRetry,
}: {
  readonly failure: ReplyFailure
  readonly onRetry: () => void
}) => {
  const { text, retry } = sayings[failure]
  return (
    <p className="animate-message-in flex items-center gap-2 text-sm text-danger">
      <CircleAlert aria-hidden="true" size={14} className="shrink-0" />
      <span>{text}</span>
      {retry ? (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-sm font-semibold hover:underline"
        >
          Retry
        </button>
      ) : null}
    </p>
  )
}
