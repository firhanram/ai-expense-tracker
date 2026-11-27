import { createRootRoute } from "@tanstack/react-router"
import { AppShell } from "../shared/shell/AppShell.tsx"

export const rootRoute = createRootRoute({ component: AppShell })
