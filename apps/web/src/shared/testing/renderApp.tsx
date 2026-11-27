import { QueryClient } from "@tanstack/react-query"
import { createMemoryHistory } from "@tanstack/react-router"
import { act, render } from "@testing-library/react"
import { App, createAppRouter } from "../../App.tsx"

/** Renders the whole app at `path`, with its own router and query cache, once the route has loaded. */
export const renderApp = async (
  path: string,
): Promise<{
  readonly router: ReturnType<typeof createAppRouter>
  readonly queryClient: QueryClient
}> => {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }))
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<App router={router} queryClient={queryClient} />)
  await act(() => router.load())
  return { router, queryClient }
}
