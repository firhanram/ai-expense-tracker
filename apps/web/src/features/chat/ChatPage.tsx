import { Unauthorized } from "@expense/contract"
import { createFileInputController } from "@ui-sdk/react/file-input"
import { createInputController } from "@ui-sdk/react/textarea"
import { WifiOff } from "lucide-react"
import { useState } from "react"
import { apiConnection } from "../../shared/api/api.ts"
import { useOnline } from "../../shared/shell/useOnline.ts"
import { Composer } from "./Composer.tsx"
import { ConversationLog } from "./ConversationLog.tsx"
import { EmptyIntro, Suggestions } from "./EmptyState.tsx"
import { createUploadReceipt } from "../receipts/index.ts"
import { createSendChat } from "./sendChat.ts"
import { createSendTurn } from "./sendTurn.ts"
import type { ReplyFailure } from "./useChatSession.ts"
import { useChatHistory } from "./useChatHistory.ts"
import { useChatSession } from "./useChatSession.ts"

const sendTurn = createSendTurn(createSendChat(apiConnection), createUploadReceipt(apiConnection))

const historyFailure = (error: Error | null): ReplyFailure | null => {
  if (error === null) return null
  return error instanceof Unauthorized ? "unauthorized" : "network"
}

const OfflineBar = () => (
  <p
    role="status"
    className="mb-2 flex items-center gap-2 rounded-md bg-warn-bg px-3 py-1.5 text-sm text-warn-fg"
  >
    <WifiOff aria-hidden="true" size={14} />
    Offline. Messages will send when reconnected.
  </p>
)

/** The Chat at `/`: the conversation, or the empty state, over the composer. */
export const ChatPage = () => {
  const history = useChatHistory()
  const session = useChatSession(sendTurn)
  const online = useOnline()
  const [input] = useState(createInputController)
  const [receipts] = useState(createFileInputController)

  const empty = history.loaded && history.messages.length === 0 && session.turns.length === 0

  const fill = (prompt: string) => {
    input.setValue(prompt)
    input.focus()
  }

  return (
    <div className="flex flex-1 flex-col">
      <div
        aria-hidden="true"
        data-shown={empty}
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_70%_55%_at_50%_0%,var(--line),var(--bg))] opacity-0 transition-opacity duration-(--motion-layout) data-[shown=true]:opacity-100"
      />
      <h1 className={empty ? "hidden" : "sr-only"}>Chat</h1>
      <div className={empty ? "flex flex-1 flex-col justify-end" : "flex flex-1 flex-col"}>
        {empty ? (
          <EmptyIntro />
        ) : (
          <ConversationLog
            history={history.messages}
            historyFailure={historyFailure(history.error)}
            turns={session.turns}
            hasOlder={history.hasOlder}
            onLoadOlder={history.loadOlder}
            onRetryHistory={history.retry}
            onRetry={session.retry}
          />
        )}
      </div>
      <div
        className={
          empty
            ? ""
            : "sticky bottom-0 bg-bg pt-2 pb-[max(16px,env(safe-area-inset-bottom))] md:pb-6"
        }
      >
        {online ? null : <OfflineBar />}
        <Composer
          controller={input}
          tall={empty}
          receipts={receipts}
          onSend={(message, clientDate, receipt) => session.send({ message, clientDate, receipt })}
        />
      </div>
      {empty ? (
        <div className="flex-1">
          <Suggestions onFill={fill} onAttachReceipt={() => receipts.open()} />
        </div>
      ) : null}
    </div>
  )
}
