import { type ChatHistoryPage, type ChatMessage, Unauthorized } from "@expense/contract"
import { type InfiniteData, useInfiniteQuery } from "@tanstack/react-query"
import { useCallback } from "react"
import { api } from "../../shared/api/api.ts"

const oldestFirst = (data: InfiniteData<ChatHistoryPage> | undefined): ReadonlyArray<ChatMessage> =>
  (data?.pages ?? []).flatMap((page) => page.messages).toReversed()

/**
 * The stored Chat, oldest first. It loads the newest page, then older ones
 * on `loadOlder`. Fetched fresh each time the Chat opens, and never again
 * while it is open: replies sent meanwhile live in `useChatSession`.
 */
export const useChatHistory = () => {
  const query = useInfiniteQuery({
    queryKey: ["chat", "history"],
    queryFn: ({ pageParam }) =>
      api((client) =>
        client.chat.history({ query: pageParam === null ? {} : { before: pageParam } }),
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextBefore,
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    // A refused token stays refused; retrying only delays saying so.
    retry: (failures, error) => !(error instanceof Unauthorized) && failures < 3,
  })

  const { fetchNextPage, refetch } = query
  const loadOlder = useCallback(() => {
    void fetchNextPage({ cancelRefetch: false })
  }, [fetchNextPage])
  const retry = useCallback(() => {
    void refetch()
  }, [refetch])

  return {
    messages: oldestFirst(query.data),
    loaded: query.isSuccess,
    error: query.error,
    hasOlder: query.hasNextPage,
    loadingOlder: query.isFetchingNextPage,
    loadOlder,
    retry,
  }
}
