# Interface design

How the app looks and behaves. Read with `GLOSSARY.md` (vocabulary) and `docs/SPEC.md` (behaviour). Where this document and the spec disagree about behaviour, the spec wins; this document wins on presentation.

## The shape of the thing

Two surfaces. A **Chat** at `/` where almost everything happens, and an **Expense list** at `/expenses` for audit and repair.

There is no dashboard. The Chat is not a feature bolted onto an app; it is the app. Every design decision below follows from that, plus one constraint the rest of the system imposes: **rendered cards fetch their own data by id** (ADR-0001), so every card has a loading state and a not-found state that must look deliberate rather than broken.

Money is Indonesian Rupiah, whole units only. It is the most-repeated element on screen and is treated as such: tabular numerals, right-aligned in lists, `Rp15.000` everywhere, never `Rp15,000.00`.

## Layout

### Chat, desktop ≥ 768px

```
┌────────────────────────────────────────────────────────────┐
│  expense                              ● online   Expenses  │  top bar, 56px
├────────────────────────────────────────────────────────────┤
│                                                            │
│                              ┌──────────────────────────┐  │
│                              │ buy cloth 70rb           │  │  user bubble
│                              └──────────────────────────┘  │
│                                                            │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Rp70.000                            Shopping  ✎   │    │  Draft Expense
│  │  Uniqlo · 24 Nov 2026                              │    │
│  │  ┌──────────┐  ┌────────┐                          │    │
│  │  │ Confirm  │  │ Discard│                          │    │
│  │  └──────────┘  └────────┘                          │    │
│  └────────────────────────────────────────────────────┘    │
│                                                            │
├────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Message…                                    [ ↑ ]    │  │  composer, 64px
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
        max-width 720px, centered
```

The conversation column is `max-width: 720px`, centered, with `24px` gutters. Content wider than that is wrong: it makes a message unreadable and a chart unnecessary. The column does not grow with the viewport.

Top bar is `56px`, sticky, `border-b` in `--line`. It holds the product name at `--text-md` weight 600, a connection dot, and a link to Expenses. Nothing else — no menu, no settings, no avatar.

### Chat, mobile < 768px

Same column, gutters drop to `16px`, top bar stays `56px`. The composer is pinned above the on-screen keyboard using `position: sticky` with `padding-bottom: env(safe-area-inset-bottom)`.

Messages fill the width; the user bubble is capped at `85%`. Cards always fill the width — a card is the content, not a decoration.

### Expense list

```
┌────────────────────────────────────────────────────────────┐
│  expense                              ● online   Chat      │
├────────────────────────────────────────────────────────────┤
│  ◀ November 2026 ▶      All categories ▾        Rp2.480.000 │
├────────────────────────────────────────────────────────────┤
│  24 Nov   Uniqlo           Shopping            Rp70.000  ⋯ │
│  24 Nov   Warung Bu Tini   Dining              Rp25.000  ⋯ │
│  22 Nov   Indomaret        Groceries          Rp146.500  ⋯ │
└────────────────────────────────────────────────────────────┘
```

A single column of rows, not a table. A table fights the mobile layout and buys nothing for four fields. Month stepper left, Category filter right, month total right-aligned under the filter. Rows are `56px`, separated by `--line`, with the date in a fixed `72px` gutter so amounts align down the page.

The `⋯` opens a small menu with Edit and Delete. On mobile, the whole row is tappable and opens the same menu as a bottom sheet.

## Colour

Two themes, both shipped. Tokens are CSS custom properties on `:root` and `[data-theme="dark"]`, and everything else references them. No component hardcodes a hex value.

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--bg` | `#FAFAF9` | `#0C0A09` | page |
| `--surface` | `#FFFFFF` | `#1C1917` | cards, composer |
| `--surface-2` | `#F5F5F4` | `#292524` | user bubble, chips |
| `--line` | `#E7E5E4` | `#292524` | borders, separators |
| `--text` | `#1C1917` | `#FAFAF9` | primary text |
| `--text-muted` | `#78716C` | `#A8A29E` | secondary, metadata |
| `--accent` | `#1C1917` | `#FAFAF9` | primary button |
| `--accent-fg` | `#FAFAF9` | `#1C1917` | primary button text |
| `--danger` | `#B91C1C` | `#F87171` | delete |
| `--warn-bg` | `#FEF3C7` | `#422006` | needs-review badge |
| `--warn-fg` | `#92400E` | `#FDE68A` | needs-review text |
| `--focus` | `#2563EB` | `#60A5FA` | focus ring |

Near-monochrome by design. The only saturated colours on screen are a destructive action and the needs-review badge, which is exactly what those things should look like. Charts supply the one place colour carries meaning, and they use a five-colour categorical ramp derived from the accent, not a rainbow.

Dark mode follows `prefers-color-scheme` and is overridable by a `data-theme` attribute that persists in memory only (the app runs sandboxed in some contexts and cannot use localStorage).

## Type

System stack; no webfont. A personal tool should not wait on a font download, and the system UI font is well-hinted at small sizes.

```
--font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif
--font-num:  ui-monospace, "SF Mono", monospace   /* amounts only */
```

| Token | Size / line-height | Weight | Used for |
|---|---|---|---|
| `--text-2xl` | 28 / 34 | 600 | card amount |
| `--text-lg` | 18 / 26 | 600 | page title, chart total |
| `--text-md` | 15 / 23 | 500 | message text, row merchant |
| `--text-sm` | 13 / 20 | 450 | metadata, dates, chips |
| `--text-xs` | 12 / 16 | 500 | badges |

Message text is `--text-md` at `23px` line-height — above the 1.5 ratio, because a chat is read in long-ish runs of one or two sentences and cramping them is the most common failure of chat UIs.

**Amounts always use `font-variant-numeric: tabular-nums`.** This is not cosmetic: a column of amounts that shifts horizontally as digits change is harder to scan, and Reports depend on the eye comparing figures down a column.

## Spacing and shape

`4px` base. Use `4, 8, 12, 16, 24, 32, 48` only. Card padding `16px`; card-to-card gap `12px`; message-to-message gap `20px`; section gap `32px`.

Radius: `8px` for cards and the composer, `6px` for buttons and chips, `9999px` for the needs-review badge. Nothing is a pill except the badge; a fully-rounded button reads as decorative.

Borders carry the structure; there is one shadow token, `0 1px 2px rgb(0 0 0 / 0.04)`, used only by the sticky top bar and the composer when it floats over content. Cards are defined by `--line`, not by elevation.

## Components

### User message

Right-aligned bubble, `--surface-2`, radius `8px` with the bottom-right corner at `2px` to point at the composer. Max width `85%`. Text only; a user cannot send markup.

### Assistant message

**No bubble.** Assistant content is full-width because it is usually a card or a chart, and a bubble around a card wastes the horizontal space the card needs. Prose-only replies get `--text-md` on `--bg` with `20px` bottom margin.

Streaming: text appears token by token with a `1px` caret block that disappears when the stream ends. No spinner — the text arriving *is* the progress.

### Draft Expense card

```
┌────────────────────────────────────────────────────┐
│┌────────┐   Rp70.000                  Shopping  ✎  │
││ photo  │   Uniqlo · 24 Nov 2026                   │
││ 56×56  │   ┌──────────┐ ┌─────────┐              │
│└────────┘   │ Confirm  │ │ Discard │              │
│             └──────────┘ └─────────┘              │
└────────────────────────────────────────────────────┘
```

- Background `--surface`, `1px` `--line`, radius `8px`.
- Amount at `--text-2xl`, tabular numerals, top-left after the optional thumbnail.
- Category is a chip, `--surface-2`, with a `✎` that opens an inline `<select>` — the correction path for a wrong Category (ADR-0004). Changing it is a `PATCH` on the draft.
- Merchant and date on one line at `--text-sm` `--text-muted`, separated by `·`.
- **Confirm** is the only primary button in the app. **Discard** is secondary.
- If `needs_review`, a `--warn-bg` badge reading "Check amount" sits above the amount. This is the receipt the model wasn't sure about.
- Thumbnail appears only when there is a Receipt; tapping it opens the image full-screen.
- **Editable fields**: amount, Category, merchant, note, date. Tapping the amount or merchant turns it into an input in place. This is the "agent was wrong, fix it without retyping" path.

**States**, all designed:

| State | Appearance |
|---|---|
| loading | `--surface` card at `88px` tall with two `--surface-2` skeleton bars; no spinner |
| needs review | as above, plus the warning badge |
| confirming | Confirm button shows a label change to "Confirming…", both buttons disabled, card at `opacity: 0.7` |
| confirmed | buttons removed; a `Confirmed ✓` line replaces them at `--text-sm`; the card fades to `--surface-2` over `200ms` |
| discarded | card collapses to one line, `--text-sm` `--text-muted`: "Discarded · Rp70.000 · Uniqlo", with an Undo that appears for 10 seconds |
| not found | dereferenced draft already deleted: one line, `--text-muted`: "This draft no longer exists" |

The discarded state collapsing rather than vanishing is deliberate: the user asked to discard, so the row should acknowledge it happened, and Undo covers the misclick.

### Expense card

Same geometry as the Draft card, minus the thumbnail, with the Category chip followed by a status chip. No Confirm button — it is already confirmed. Edit opens the same inline fields. Used when the user asks about an existing Expense; the default for a rendered card is the list.

### Spending chart

```
┌────────────────────────────────────────────────────┐
│  November 2026                        Rp2.480.000  │
│  by category                                       │
│                                                    │
│  Groceries  ████████████████████          980.000  │
│  Dining     ████████████                  612.500  │
│  Shopping   ██████                        310.000  │
│  Transport  ███                           187.500  │
│  Other      ██                            390.000  │
└────────────────────────────────────────────────────┘
```

- Title is the range in human words, total right-aligned at `--text-lg` tabular.
- Default for `groupBy=category` is a **horizontal bar chart**: category names are long, and horizontal bars read them without rotated labels. Vertical bars are used only for `groupBy=month`.
- Values are labelled on the bar itself, right-aligned, tabular. A chart the user has to hover to read is not a chart, it is a puzzle.
- Categorical ramp: five hues derived from `--accent`, cycling, always in the same order so the same Category is the same colour across every Report.
- Negative amounts (refunds) render below the axis in `--danger` at `--text-sm`.
- Zero results: a single line, "No expenses in this range", at `--text-muted`. Never an empty axis.
- Recharts is wrapped, never exposed: the component takes `from`, `to`, `groupBy`, `chartType` and does the rest.

### Expense list row

`56px` tall, date gutter `72px` at `--text-sm` `--text-muted`, merchant at `--text-md`, Category chip, amount right-aligned at `--text-md` tabular. Amounts are right-aligned to a fixed column so the eye can compare down the list. Hover raises the row to `--surface`. Keyboard focus shows the `--focus` ring at `2px` offset `2px`.

Deleting asks for confirmation in the row itself ("Delete? Yes / No"), not a modal. A modal for a single-row action is heavier than the action.

### Composer

Pinned bottom, `--surface`, `1px` `--line`, radius `8px`, `16px` padding. Auto-growing textarea, `1–6` lines then scrolls. Enter sends, Shift+Enter newline. Send button is `32×32`, `--accent`, disabled until there is text.

**Receipt attach**: a `📎` at the left opens the file picker; drag-drop anywhere over the conversation targets the composer; paste from clipboard works. A pending attachment appears as a `56×56` thumbnail with an `×`, above the textarea. It is sent with the next message, not immediately — the user may want to add words.

While a reply streams, the composer stays enabled and a second send queues. The composer never locks.

### Empty state

Three example prompts, each a button that fills the composer:

- `buy cloth 70rb`
- `attach a receipt`
- `report of my expenses this month`

The third is there specifically so the user discovers Reports exist without reading anything.

### Error states

| Failure | Presentation |
|---|---|
| Model unreachable | A system line, not a card: `--text-sm`, `--danger`, "Couldn't reach the model. Retry." with Retry as a text button. |
| UI parse failed | The stored prose renders as text, plus a `--text-sm` line "Showing text only" and Retry. Never a blank area. |
| API 401 | Full-screen, one sentence, an input for the token. |
| Network offline | A `--warn-bg` bar above the composer: "Offline. Messages will send when reconnected." No modal. |

A parse failure is the most likely error in this system (ADR-0006 assumes ~7% first-pass failure), so its presentation is part of the design rather than a fallback: the user still gets their answer as text, and the failure is stated in one small line rather than apologised for in a paragraph.

## Motion

Three durations, no more: `120ms` for colour and opacity, `200ms` for layout changes (card collapse, message insertion), `300ms` for chart entrance (bars grow from zero height).

- New messages fade and rise `4px` over `200ms`.
- Streaming text does not animate per token; it simply appears.
- Card confirm fades to `--surface-2` over `200ms` and buttons are removed after a `120ms` fade.
- Charts animate once on mount and never re-animate on refetch.
- `prefers-reduced-motion: reduce` removes all transforms, keeps opacity changes at `1ms`.

## Accessibility

Non-negotiable, and cheap if done now:

- Text contrast ≥ `4.5:1`; control edges, focus rings and state fills ≥ `3:1`. The token table above is chosen to satisfy this in both themes.
- Every control has a name: the Category chip's edit is "Edit category", not an unlabelled icon. Row actions are named per row.
- Focus is always visible: `2px` `--focus` ring, `2px` offset. Never `outline: none`.
- The conversation is a `role="log"` with `aria-live="polite"`. Streaming announcements are throttled so a screen reader is not spammed per token.
- Charts have a text alternative: the same figures as a visually-hidden list. A chart with no accessible equivalent is a chart some people cannot read.
- The Confirm button is reachable and operable by keyboard, which matters more here than anywhere else in the app.

## Implementing this with the chosen libraries

`ui-sdk` supplies behaviour — keyboard navigation, focus, dismissal, popups, drag and drop, and the ARIA they require — and renders no styles. Tailwind supplies appearance.

Constraints that follow from that:

- **Import per component entry** (`@ui-sdk/react/select`), never from the package root, never from `@ui-sdk/core/internal/*`.
- **`@layer ui-sdk;` goes at the top of the global stylesheet**, above `@import "tailwindcss"`. Omitting it means ui-sdk's behaviour attributes lose to Tailwind resets in ways that are hard to trace.
- **Style from state**, not from JS: target `data-slot`, `data-open`, `data-pressed`, `data-disabled`, plus the documented CSS variables. No inline styles for state, no generated ids.
- **Do not hand-roll** a `role="listbox"`, `"menu"`, `"dialog"`, `"tablist"`, `"switch"`, `"slider"`, `"radiogroup"`, `"toolbar"` or `"tree"` — if one of those is needed, use the component that provides it.
- Lists are keyed by id, never index. Messages and expense rows both have stable ids, so there is no excuse.
- Right-to-left needs no provider; components read direction from the page.

`@openuidev/react-ui` is deliberately **not** used: it brings Radix, which duplicates ui-sdk's behaviours with a second focus-trap and overlay implementation. The cost of that duplication is a class of bug that is expensive to find.

## What this design does not do

- No sidebar, no tabs inside the conversation, no settings page.
- No avatar or assistant persona; the agent is a system, and dressing it as a character would imply opinions it does not have.
- No markdown rendering of assistant prose beyond paragraphs and emphasis. The agent's structured output is UI, not markdown.
- No skeleton shimmer. Static skeleton bars only; shimmer pulls attention to absence.
- No multi-column layouts anywhere. Every surface is one column, because everything in this app is read in sequence.
