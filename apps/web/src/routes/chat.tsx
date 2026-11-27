import { createRoute } from "@tanstack/react-router"
import { ChatPage } from "../features/chat/ChatPage.tsx"
import { rootRoute } from "./root.tsx"

export const chatRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: ChatPage,
})
