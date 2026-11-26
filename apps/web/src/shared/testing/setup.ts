import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach } from "vitest"

afterEach(cleanup)

// jsdom gaps ui-sdk's popups need (ui-sdk testing guide). Assigned, not `??=`:
// jsdom has some of them without the parts that matter.
HTMLElement.prototype.showPopover = function () {}
HTMLElement.prototype.hidePopover = function () {}
Element.prototype.getAnimations = () => []
Element.prototype.scrollIntoView = function () {}
Element.prototype.checkVisibility = () => true
const noRects = document.createElement("div").getClientRects()
Element.prototype.getClientRects = () => noRects
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
// jsdom has no layout, so scrolling is a no-op rather than a "not implemented" error.
window.scrollTo = () => {}
