import { CircleAlert } from "lucide-react"
import type { ReactNode } from "react"
import type { ReplyFailure } from "./useChatSession.ts"

type Saying = { readonly text: string; readonly retry: boolean } | { readonly signedOut: true }

const sayings: Readonly<Record<ReplyFailure, Saying>> = {
  "model-unreachable": { text: "Couldn't reach the model.", retry: true },
  "rate-limited": { text: "The model is busy. Wait a moment, then retry.", retry: true },
  network: { text: "Couldn't reach the server.", retry: true },
  "cut-off": { text: "The reply stopped early.", retry: true },
  failed: { text: "Something went wrong.", retry: true },
  unauthorized: { signedOut: true },
  "receipt-not-found": { text: "That receipt is gone. Attach it again.", retry: false },
  "receipt-invalid": {
    text: "Couldn't read that photo. Attach a JPEG, PNG or WebP.",
    retry: false,
  },
}

const TextButton = ({
  onClick,
  children,
}: {
  readonly onClick: () => void
  readonly children: ReactNode
}) => (
  <button type="button" onClick={onClick} className="rounded-sm font-semibold hover:underline">
    {children}
  </button>
)

/**
 * A system line, not a card: what failed, in one line, with Retry when
 * sending again can help. Signed out (a 401: Access let the request through
 * but the Worker refused it) offers a reload, which goes back through Access.
 */
export const SystemLine = ({
  failure,
  onRetry,
}: {
  readonly failure: ReplyFailure
  readonly onRetry: () => void
}) => {
  const saying = sayings[failure]
  return (
    <p className="animate-message-in flex items-center gap-2 text-sm text-danger">
      <CircleAlert aria-hidden="true" size={14} className="shrink-0" />
      {"signedOut" in saying ? (
        <span>
          Not signed in. <TextButton onClick={() => window.location.reload()}>Reload</TextButton> to
          sign in again.
        </span>
      ) : (
        <>
          <span>{saying.text}</span>
          {saying.retry ? <TextButton onClick={onRetry}>Retry</TextButton> : null}
        </>
      )}
    </p>
  )
}
