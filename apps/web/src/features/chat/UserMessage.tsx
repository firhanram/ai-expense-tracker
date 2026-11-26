/** The user's message: a right-aligned bubble pointing at the composer. Text only. */
export const UserMessage = ({ content }: { readonly content: string }) => (
  <article aria-label="You" className="animate-message-in flex justify-end">
    <p className="max-w-[85%] rounded-xl rounded-br-[4px] bg-surface-2 px-4 py-2.5 text-md whitespace-pre-wrap break-words">
      {content}
    </p>
  </article>
)
