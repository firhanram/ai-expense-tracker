import { Outlet } from "@tanstack/react-router"
import { TopBar } from "./TopBar.tsx"

/** Every page: the top bar, then the page in the 720px column. */
export const AppShell = () => (
  <div className="flex min-h-dvh flex-col">
    <TopBar />
    <main className="mx-auto flex w-full max-w-[720px] flex-1 flex-col px-4 md:px-6">
      <Outlet />
    </main>
  </div>
)
