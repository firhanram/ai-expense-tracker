import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createRouter, type RouterHistory, RouterProvider } from "@tanstack/react-router"
import { routeTree } from "./routes/routeTree.ts"

export const createAppRouter = (history?: RouterHistory) =>
  createRouter({ routeTree, ...(history === undefined ? {} : { history }) })

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}

export const App = ({
  router,
  queryClient,
}: {
  router: ReturnType<typeof createAppRouter>
  queryClient: QueryClient
}) => (
  <QueryClientProvider client={queryClient}>
    <RouterProvider router={router} />
  </QueryClientProvider>
)

export const createQueryClient = () => new QueryClient()
