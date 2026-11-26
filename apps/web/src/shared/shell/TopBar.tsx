import { Link } from "@tanstack/react-router"
import { MessageSquare, Receipt, Wallet } from "lucide-react"
import type { ReactNode } from "react"
import { useOnline } from "./useOnline.ts"

const NavLink = ({
  to,
  icon,
  children,
}: {
  to: "/" | "/expenses"
  icon: ReactNode
  children: string
}) => (
  <Link
    to={to}
    activeOptions={{ exact: true }}
    className="flex items-center gap-1.5 rounded-sm px-2.5 py-[5px] text-sm font-medium text-text-muted transition-colors duration-(--motion-color) aria-[current=page]:bg-surface aria-[current=page]:text-text aria-[current=page]:shadow-xs"
  >
    {icon}
    {children}
  </Link>
)

/** The 56px bar: brand and connection on the left, Chat | Expenses on the right, in the 672px row. */
export const TopBar = () => {
  const online = useOnline()

  return (
    <header className="sticky top-0 z-10 h-14 bg-bg">
      <div className="mx-auto flex h-full max-w-[720px] items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="grid size-7 place-items-center rounded-md bg-accent text-accent-fg"
          >
            <Wallet size={16} strokeWidth={2} />
          </span>
          <span className="text-md font-semibold">expense</span>
          <span
            aria-hidden="true"
            data-online={online}
            className="size-1.5 rounded-full bg-text-muted transition-colors duration-(--motion-color) data-[online=true]:bg-online"
          />
          <span role="status" className="text-sm text-text-muted">
            {online ? "" : "offline"}
          </span>
        </div>
        <nav
          aria-label="Primary"
          className="flex items-center gap-0.5 rounded-md bg-surface-2 p-[3px]"
        >
          <NavLink to="/" icon={<MessageSquare aria-hidden="true" size={14} />}>
            Chat
          </NavLink>
          <NavLink to="/expenses" icon={<Receipt aria-hidden="true" size={14} />}>
            Expenses
          </NavLink>
        </nav>
      </div>
    </header>
  )
}
