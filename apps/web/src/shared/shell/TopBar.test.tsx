import { act, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { renderApp } from "../testing/renderApp.tsx"

const setOnline = (online: boolean) => {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(online)
  act(() => {
    window.dispatchEvent(new Event(online ? "online" : "offline"))
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe("the top bar", () => {
  it("marks the current page in the Chat | Expenses navigation", async () => {
    await renderApp("/expenses")

    const nav = screen.getByRole("navigation")
    expect(screen.getByRole("link", { name: "Expenses" })).toHaveAttribute("aria-current", "page")
    expect(screen.getByRole("link", { name: "Chat" })).not.toHaveAttribute("aria-current")
    expect(nav).toContainElement(screen.getByRole("link", { name: "Chat" }))
  })

  it("moves the current page when the user navigates", async () => {
    await renderApp("/expenses")

    await userEvent.click(screen.getByRole("link", { name: "Chat" }))

    expect(await screen.findByRole("link", { name: "Chat" })).toHaveAttribute(
      "aria-current",
      "page",
    )
    expect(screen.getByRole("link", { name: "Expenses" })).not.toHaveAttribute("aria-current")
  })

  it("says nothing while online and shows 'offline' when the connection drops", async () => {
    await renderApp("/")
    expect(screen.queryByText("offline")).not.toBeInTheDocument()

    setOnline(false)
    expect(screen.getByText("offline")).toBeInTheDocument()

    setOnline(true)
    expect(screen.queryByText("offline")).not.toBeInTheDocument()
  })

  it("starts offline when the browser already is", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false)

    await renderApp("/")

    expect(screen.getByText("offline")).toBeInTheDocument()
  })
})
