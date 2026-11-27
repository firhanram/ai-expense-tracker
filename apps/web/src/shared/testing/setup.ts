import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach, vi } from "vitest"

// jsdom lacks what ui-sdk popups need (ui-sdk testing guide).
HTMLElement.prototype.showPopover = function () {}
HTMLElement.prototype.hidePopover = function () {}
Element.prototype.getAnimations = () => []
Element.prototype.scrollIntoView = function () {}
Element.prototype.checkVisibility = () => true
// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- an empty list is all jsdom needs.
Element.prototype.getClientRects = () => [] as unknown as DOMRectList
document.elementFromPoint = () => null
document.elementsFromPoint = () => []
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
}
document.head.append(
  Object.assign(document.createElement("style"), {
    textContent: "[popover] { display: block !important }",
  }),
)
// A `presentation="auto"` popup asks matchMedia whether to open as a sheet; jsdom has no media.
window.matchMedia ??= (query: string) =>
  Object.assign(new EventTarget(), {
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
  })
// jsdom has no layout, so scrolling is a no-op rather than a "not implemented" error.
window.scrollTo = () => {}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
