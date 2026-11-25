# Interface design

How the app looks and behaves. Read with `GLOSSARY.md` (vocabulary) and `docs/SPEC.md` (behaviour). Where this document and the spec disagree about behaviour, the spec wins; this document wins on presentation.

The canvas source is `docs/design/design.pen` (pen.dev). Where the canvas and this document disagree, this document wins and the canvas is updated.

## The shape of the thing

Two surfaces. A **Chat** at `/` where almost everything happens, and an **Expense list** at `/expenses` for audit and repair.

There is no dashboard. The Chat is not a feature bolted onto an app; it is the app. Every design decision below follows from that, plus one constraint the rest of the system imposes: **rendered cards fetch their own data by id** (ADR-0001), so every card has a loading state and a not-found state that must look deliberate rather than broken.

Money is Indonesian Rupiah, whole units only. It is the most-repeated element on screen and is treated as such: tabular numerals, right-aligned in lists, `Rp15.000` everywhere, never `Rp15,000.00`.

## Layout

### Chat, desktop ≥ 768px

```
┌────────────────────────────────────────────────────────────┐
│       ▣ expense ●                    [ Chat | Expenses ]   │  top bar, 56px
│                                                            │
│                              ┌──────────────────────────┐  │
│                              │ buy cloth 70rb           │  │  user bubble
│                              └──────────────────────────┘  │
│                                                            │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Rp70.000                            Shopping  ✎   │    │  Draft Expense
│  │  Uniqlo · 24 Nov 2026                              │    │
│  │  [ Confirm ]  [ Discard ]                          │    │
│  └────────────────────────────────────────────────────┘    │
│                                                            │
│  ╭──────────────────────────────────────────────────────╮  │
│  │ Log a purchase or ask about your spending…           │  │  composer
│  │                                                      │  │
│  │ (📎 Receipt) (📅 Today ▾)                       (↑)  │  │
│  ╰──────────────────────────────────────────────────────╯  │
└────────────────────────────────────────────────────────────┘
        max-width 720px, centered
```

The conversation column is `max-width: 720px`, centered, with `24px` gutters, so content is `672px` wide. Content wider than that is wrong: it makes a message unreadable and a chart unnecessary. The column does not grow with the viewport.

### Top bar

`56px`, sticky, `--bg` fill, **no bottom border** — it blends into the page. Its contents sit in the same `672px` row as the conversation, so the brand lines up with the cards' left edge and the navigation with their right edge.

- **Left:** a `28×28` logo tile (`--accent`, radius `8px`, wallet icon in `--accent-fg`), the product name "expense" at `--text-md` weight 600, and the connection dot.
- **Connection dot:** `6px`, green `#16A34A` when online, with no label — online is the normal state and should be quiet. When offline the dot turns `--text-muted` and the word "offline" appears beside it at `--text-sm` `--text-muted`.
- **Right:** a segmented switch, **Chat | Expenses**, each tab an icon plus label at `--text-sm`. Track is `--surface-2`, radius `8px`, `3px` padding. The active tab is `--surface` with `--shadow-xs` and `--text`; the inactive tab is transparent with `--text-muted`. The active tab is the current page.

Nothing else — no menu, no settings, no avatar.

### Chat, mobile < 768px

Same column, gutters drop to `16px`, top bar stays `56px` and its row fills the width. The composer is pinned above the on-screen keyboard using `position: sticky` with `padding-bottom: env(safe-area-inset-bottom)`.

Messages fill the width; the user bubble is capped at `85%`. Cards always fill the width — a card is the content, not a decoration. In the composer toolbar the Receipt button drops its label and shows only the paperclip, so the chips and the send button fit on one row.

### Expense list

```
┌────────────────────────────────────────────────────────────┐
│       ▣ expense ●                    [ Chat | Expenses ]   │
│                                                            │
│  ◀ November 2026 ▶                      [All categories ▾] │
│                                                Rp2.480.000 │
├────────────────────────────────────────────────────────────┤
│  24 Nov   Uniqlo           Shopping            Rp70.000  ⋯ │
│  24 Nov   Warung Bu Tini   Dining              Rp25.000  ⋯ │
│  22 Nov   Indomaret        Groceries          Rp146.500  ⋯ │
└────────────────────────────────────────────────────────────┘
```

A single column of rows, not a table. A table fights the mobile layout and buys nothing for four fields. Month stepper left at `--text-lg`, Category filter right, month total right-aligned under the filter at `--text-lg` tabular. Rows are `56px`, separated by `--line`, with the date in a fixed `72px` gutter so amounts align down the page.

The `⋯` opens a small menu with Edit and Delete (Delete in `--danger`). On mobile, the whole row is tappable and opens the same actions as a bottom sheet headed by the row's merchant, date, Category and amount. On mobile the month label shortens to "Nov 2026", the total moves beside it, the filter drops to its own line, and rows omit the Category chip.

## Colour

Two themes, both shipped. Tokens are CSS custom properties on `:root` and `[data-theme="dark"]`, and everything else references them. No component hardcodes a hex value — the online dot's green is the one exception and should become a token if a second use appears.

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--bg` | `#FAFAF9` | `#0C0A09` | page, top bar |
| `--surface` | `#FFFFFF` | `#1C1917` | cards, composer, popovers, active nav tab |
| `--surface-2` | `#F5F5F4` | `#292524` | user bubble, chips, nav track, selected option |
| `--line` | `#E7E5E4` | `#292524` | borders, separators, disabled day numbers |
| `--text` | `#1C1917` | `#FAFAF9` | primary text |
| `--text-muted` | `#78716C` | `#A8A29E` | secondary, metadata |
| `--accent` | `#1C1917` | `#FAFAF9` | primary button, send button, icon tiles, selected day |
| `--accent-fg` | `#FAFAF9` | `#1C1917` | text and icons on `--accent` |
| `--ring` | `#57534E` | `#A8A29E` | focused composer border, open chip/filter border |
| `--danger` | `#B91C1C` | `#F87171` | delete, refunds, model-unreachable line |
| `--warn-bg` | `#FEF3C7` | `#422006` | needs-review badge, offline bar |
| `--warn-fg` | `#92400E` | `#FDE68A` | needs-review text, offline text |
| `--focus` | `#2563EB` | `#60A5FA` | keyboard focus ring |

Chart ramp, always in this order so the same Category is the same colour in every Report and in the Category filter's swatches:

| Token | Light | Dark |
|---|---|---|
| `--chart-1` | `#1C1917` | `#FAFAF9` |
| `--chart-2` | `#44403C` | `#D6D3D1` |
| `--chart-3` | `#78716C` | `#A8A29E` |
| `--chart-4` | `#A8A29E` | `#78716C` |
| `--chart-5` | `#D6D3D1` | `#57534E` |

Near-monochrome by design. The only saturated colours on screen are a destructive action, the needs-review badge and the online dot, which is exactly what those things should look like. Focus on the composer is shown in grey (`--ring`), not a brand hue; `--focus` blue is reserved for the keyboard focus ring, where it must be unmistakable.

Dark mode follows `prefers-color-scheme` and is overridable by a `data-theme` attribute that persists in memory only (the app runs sandboxed in some contexts and cannot use localStorage).

## Type

System stack; no webfont. A personal tool should not wait on a font download, and the system UI font is well-hinted at small sizes. The canvas uses Inter and JetBrains Mono as stand-ins for these stacks.

```
--font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif
--font-num:  ui-monospace, "SF Mono", monospace   /* amounts, dates in the calendar, empty-state headline */
```

| Token | Size / line-height | Weight | Used for |
|---|---|---|---|
| `--text-3xl` | 34 / 44 | 500 | empty-state headline (`--font-num`, `-0.5px` tracking) |
| `--text-2xl` | 28 / 34 | 600 | card amount |
| `--text-lg` | 18 / 26 | 600 | page title, chart total, month total |
| `--text-md` | 15 / 23 | 500 | message text, row merchant |
| `--text-sm` | 13 / 20 | 450 | metadata, dates, chips, nav tabs |
| `--text-xs` | 12 / 16 | 500 | badges, suggestion hints, calendar days |

Message text is `--text-md` at `23px` line-height — above the 1.5 ratio, because a chat is read in long-ish runs of one or two sentences and cramping them is the most common failure of chat UIs.

The empty-state headline is monospace on purpose: it is the same face as every amount in the app, so the first screen already speaks in the app's voice for money.

**Amounts always use `font-variant-numeric: tabular-nums`.** This is not cosmetic: a column of amounts that shifts horizontally as digits change is harder to scan, and Reports depend on the eye comparing figures down a column.

## Spacing and shape

`4px` base. Use `4, 8, 12, 16, 24, 32, 48` only. Card padding `16px`; card-to-card gap `12px`; message-to-message gap `20px`; section gap `32px`.

Radius:

| Radius | Used for |
|---|---|
| `16px` | composer, user bubble (bottom-right corner `4px`) |
| `12px` | cards, suggestion cards, popovers |
| `8px` | logo and icon tiles, nav track, offline bar |
| `6px` | buttons, Category and status chips, nav tabs, menu items, calendar days |
| `9999px` | needs-review badge, send button, composer toolbar chips (Receipt, attachment, date) |

Fully rounded shapes are kept to the badge and the composer's own controls, where they read as "attached to this input". A fully rounded Confirm or Discard would read as decorative.

Borders carry the structure; cards are defined by `--line`, not by elevation. Shadows are tokens and stay faint:

| Token | Value | Used for |
|---|---|---|
| `--shadow-xs` | `0 1px 2px rgb(0 0 0 / 0.08)` | active nav tab |
| `--shadow-sm` | `0 1px 3px rgb(0 0 0 / 0.04)` | suggestion cards |
| `--shadow-md` | `0 2px 8px rgb(0 0 0 / 0.05)` | composer at rest |
| `--shadow-focus` | `0 4px 16px rgb(28 25 23 / 0.08)` | composer while focused |
| `--shadow-pop` | `0 8px 24px rgb(28 25 23 / 0.12)` | popovers and menus |

## Components

### User message

Right-aligned bubble, `--surface-2`, radius `16px` with the bottom-right corner at `4px` to point at the composer, padding `10px 16px`. Max width `85%`. Text only; a user cannot send markup.

### Assistant message

**No bubble.** Assistant content is full-width because it is usually a card or a chart, and a bubble around a card wastes the horizontal space the card needs. Prose-only replies get `--text-md` on `--bg` with `20px` bottom margin.

Streaming: text appears token by token with a `1px` caret block that disappears when the stream ends. No spinner — the text arriving *is* the progress.

### Draft Expense card

```
┌────────────────────────────────────────────────────┐
│┌────────┐   Rp70.000                  Shopping  ✎  │
││ photo  │   Uniqlo · 24 Nov 2026                   │
││ 56×56  │   [ Confirm ] [ Discard ]                │
│└────────┘                                          │
└────────────────────────────────────────────────────┘
```

- Background `--surface`, `1px` `--line`, radius `12px`.
- Amount at `--text-2xl`, `--font-num`, tabular numerals, top-left after the optional thumbnail.
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
│  Groceries  ████████████████████ 980.000           │
│  Dining     ████████████ 612.500                   │
│  Shopping   ██████ 310.000                         │
│  Utilities  ████ 200.000                           │
│  Transport  ████ 187.500                           │
│  Health     ██ 85.000                              │
└────────────────────────────────────────────────────┘
```

- Card radius `12px`. Title is the range in human words, total right-aligned at `--text-lg` tabular.
- Default for `groupBy=category` is a **horizontal bar chart**: category names are long, and horizontal bars read them without rotated labels. Vertical bars are used only for `groupBy=month`.
- Values are labelled on the bar itself, right-aligned inside it, `--text-xs` `--font-num`. Use `--accent-fg` on `--chart-1`–`--chart-3` and `--text` on `--chart-4`–`--chart-5`. A chart the user has to hover to read is not a chart, it is a puzzle.
- Bars are sorted by amount, largest first. Categories with no spending in the range are omitted.
- Each Category's colour is the chart ramp cycled over the seeded order in ADR-0004, so it is fixed per Category, not per position. With eleven Categories and five colours, two Categories in one chart can share a colour; the label beside each bar is what identifies it.
- Negative amounts (refunds) render below the axis in `--danger` at `--text-sm`.
- Zero results: a single line, "No expenses in this range", at `--text-muted`. Never an empty axis.
- Recharts is wrapped, never exposed: the component takes `from`, `to`, `groupBy`, `chartType` and does the rest.

### Expense list row

`56px` tall, date gutter `72px` at `--text-sm` `--text-muted`, merchant at `--text-md`, Category chip (without the `✎`), amount right-aligned in a fixed `120px` column at `--text-md` tabular. Refunds show a leading `−` in `--danger`. Hover raises the row to `--surface`. Keyboard focus shows the `--focus` ring at `2px` offset `2px`.

Deleting asks for confirmation in the row itself — "Delete? **Yes** / **No**" replaces the `⋯`, with Yes in `--danger` — not a modal. A modal for a single-row action is heavier than the action. The amount stays visible so the user can see what they are deleting.

### Category filter

A button — `--surface`, `1px` `--line`, radius `6px` — reading the current filter ("All categories") with a chevron. While open it turns `--surface-2` with a `--ring` border and the chevron points up.

The dropdown is a popover (`--surface`, `1px` `--line`, radius `12px`, `--shadow-pop`, `264px` wide), right-aligned to the button and `6px` below it:

- First option: "All categories" with the month total.
- A `--line` divider.
- One option per Category, in seeded order (ADR-0004): a check column, an `8px` swatch in that Category's chart colour, the name, and its month total in `--font-num` `--text-muted`. Categories with no spending that month stay listed, with the name in `--text-muted` and `—` for the total. `Other` gets an outlined swatch, because it is a classification failure rather than a real bucket.
- The selected option has a `--surface-2` fill and a check.

Showing per-Category totals turns the filter into a quick breakdown, so the user can see where the month went before filtering.

### Composer

```
╭──────────────────────────────────────────────────────╮
│ Log a purchase or ask about your spending…           │
│                                                      │
│ (📎 Receipt) (🧾 receipt.jpg ×) (📅 Today ▾)     (↑)  │
╰──────────────────────────────────────────────────────╯
```

`--surface`, `1px` `--line`, radius `16px`, `12px` padding, `--shadow-md`. Two parts:

- **Text area** on top: auto-growing, `1–6` lines then scrolls, `--text-md`. Enter sends, Shift+Enter newline. On the empty state it starts taller (about three lines) to invite a full sentence.
- **Toolbar** below, split left and right. Left holds the context chips; right holds the send button.

While focused, the border becomes `--ring` and the shadow `--shadow-focus`. No coloured glow.

**Toolbar chips** are fully rounded, `--text-sm`, `6px 12px` padding:

- **Receipt** (`📎`, `--surface`, `1px` `--line`): opens the file picker. Drag-drop anywhere over the conversation targets the composer; paste from clipboard works.
- **Attachment** (`--surface-2`): appears when a Receipt is pending, showing the file name and an `×` to remove it. It is sent with the next message, not immediately — the user may want to add words.
- **Date** (`📅 Today ▾`, `--surface`, `1px` `--line`): sets the date sent with the message, for back-dating an expense. It defaults to Today and resets to Today after each send.

**Send** is a `32×32` circle in `--accent` with an up-arrow in `--accent-fg`, at `40%` opacity and disabled until there is text or an attachment.

While a reply streams, the composer stays enabled and a second send queues. The composer never locks.

### Date picker

Opens from the Date chip as a popover (`--surface`, `1px` `--line`, radius `12px`, `--shadow-pop`, `288px` wide). It opens **upward**, because the composer sits low on the screen. While open, the chip turns `--surface-2` with a `--ring` border and its chevron points up.

- **Quick picks**: Today, Yesterday, "2 days ago", each with its weekday and date right-aligned in `--text-muted`. The selected one has a `--surface-2` fill and a check. These cover nearly every back-dated expense.
- A `--line` divider.
- **Month calendar**: a month header with previous and next arrows, weekdays starting Monday, and `32px`-tall day cells in `--font-num` `--text-xs`. The selected day is `--accent` with `--accent-fg`. Days from other months and days after today are `--line` and cannot be picked; the next-month arrow is disabled while viewing the current month.

"Today" means the client's date (ADR-0009); the server never decides it.

### Empty state

```
            Where did your money go?
   Type a purchase the way you'd say it, attach a
          receipt, or ask for a report.

  ╭────────────────────────────────────────────────╮
  │ composer                                       │
  ╰────────────────────────────────────────────────╯
  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
  │ ▣            │ │ ▣            │ │ ▣            │
  │ Log a        │ │ Scan a       │ │ See this     │
  │ purchase     │ │ receipt      │ │ month        │
  │ buy cloth…   │ │ attach a…    │ │ report of…   │
  └──────────────┘ └──────────────┘ └──────────────┘
```

The headline, intro line, composer and suggestions are centred vertically in the viewport, in the `672px` column. There is no logo above the headline; the top bar already carries the brand.

- **Headline**: "Where did your money go?", one line, `--text-3xl` `--font-num`, centred.
- **Intro**: one line of `--text-md` `--text-muted`, centred, max `440px`.
- **Composer**: the real composer, not a copy, so typing here starts the conversation.
- **Suggestion cards**: three, side by side, equal width and a fixed equal height (`108px`). Each is `--surface`, `1px` `--line`, radius `12px`, `--shadow-sm`, `14px` padding, with a `32×32` `--accent` icon tile, a title at `--text-sm` weight 500 and a one-line hint at `--text-xs` `--text-muted`. Hints must fit on one line. Clicking a card fills the composer with its full prompt:

| Title | Hint | Fills the composer with |
|---|---|---|
| Log a purchase | buy cloth 70rb | `buy cloth 70rb` |
| Scan a receipt | attach a photo, I'll read it | opens the file picker |
| See this month | report of this month | `report of my expenses this month` |

The third is there specifically so the user discovers Reports exist without reading anything.

The page behind the empty state carries a faint radial wash of `--line` from the top centre, fading to `--bg`. It is the only background treatment in the app and disappears once the conversation starts.

### Error states

| Failure | Presentation |
|---|---|
| Model unreachable | A system line, not a card: `--text-sm`, `--danger`, "Couldn't reach the model. Retry." with Retry as a text button. |
| UI parse failed | The stored prose renders as text, plus a `--text-sm` line "Showing text only" and Retry. Never a blank area. |
| API 401 | No screen of its own: the token is set at deployment, not typed by the user. A system line in `--danger`: "Not authorised. Check the API token." |
| Network offline | A `--warn-bg` bar above the composer: "Offline. Messages will send when reconnected." The top bar's dot turns grey with an "offline" label. No modal. |

A parse failure is the most likely error in this system (ADR-0006 assumes ~7% first-pass failure), so its presentation is part of the design rather than a fallback: the user still gets their answer as text, and the failure is stated in one small line rather than apologised for in a paragraph.

## Motion

Three durations, no more: `120ms` for colour and opacity, `200ms` for layout changes (card collapse, message insertion, popover open), `300ms` for chart entrance (bars grow from zero length).

- New messages fade and rise `4px` over `200ms`.
- Streaming text does not animate per token; it simply appears.
- Card confirm fades to `--surface-2` over `200ms` and buttons are removed after a `120ms` fade.
- Popovers fade and move `4px` toward their trigger's opposite side over `120ms`.
- Charts animate once on mount and never re-animate on refetch.
- The empty state's background wash fades out over `200ms` when the first message is sent.
- `prefers-reduced-motion: reduce` removes all transforms, keeps opacity changes at `1ms`.

## Accessibility

Non-negotiable, and cheap if done now:

- Text contrast ≥ `4.5:1`; control edges, focus rings and state fills ≥ `3:1`. The token table above is chosen to satisfy this in both themes, including `--ring` against `--surface`.
- Every control has a name: the Category chip's edit is "Edit category", not an unlabelled icon. Row actions are named per row. The icon-only Receipt button on mobile is "Attach receipt"; the Date chip is "Expense date: Today".
- Focus is always visible: `2px` `--focus` ring, `2px` offset. Never `outline: none`. The composer's `--ring` border is a focus *style*, not a replacement for the keyboard ring on its controls.
- The Chat | Expenses switch is navigation, not tabs: two links with `aria-current="page"` on the active one.
- The conversation is a `role="log"` with `aria-live="polite"`. Streaming announcements are throttled so a screen reader is not spammed per token.
- Charts have a text alternative: the same figures as a visually-hidden list. A chart with no accessible equivalent is a chart some people cannot read.
- The date picker's calendar is keyboard operable (arrows move by day, Page Up/Down by month) and disabled days are announced as unavailable.
- The Confirm button is reachable and operable by keyboard, which matters more here than anywhere else in the app.

## Implementing this with the chosen libraries

`ui-sdk` supplies behaviour — keyboard navigation, focus, dismissal, popups, drag and drop, and the ARIA they require — and renders no styles. Tailwind supplies appearance.

Constraints that follow from that:

- **Import per component entry** (`@ui-sdk/react/select`), never from the package root, never from `@ui-sdk/core/internal/*`.
- **`@layer ui-sdk;` goes at the top of the global stylesheet**, above `@import "tailwindcss"`. Omitting it means ui-sdk's behaviour attributes lose to Tailwind resets in ways that are hard to trace.
- **Style from state**, not from JS: target `data-slot`, `data-open`, `data-pressed`, `data-disabled`, plus the documented CSS variables. No inline styles for state, no generated ids. The open Date chip and Category filter are styled from `data-open`.
- **Do not hand-roll** a `role="listbox"`, `"menu"`, `"dialog"`, `"tablist"`, `"switch"`, `"slider"`, `"radiogroup"`, `"toolbar"` or `"tree"` — if one of those is needed, use the component that provides it. The Category filter, the date picker, the row menu and the mobile bottom sheet all come from ui-sdk.
- Lists are keyed by id, never index. Messages and expense rows both have stable ids, so there is no excuse.
- Right-to-left needs no provider; components read direction from the page.

`@openuidev/react-ui` is deliberately **not** used: it brings Radix, which duplicates ui-sdk's behaviours with a second focus-trap and overlay implementation. The cost of that duplication is a class of bug that is expensive to find.

## What this design does not do

- No sidebar, no tabs inside the conversation, no settings page, no sign-in screen.
- No avatar, persona greeting or assistant character; the agent is a system, and dressing it as a character would imply opinions it does not have.
- No markdown rendering of assistant prose beyond paragraphs and emphasis. The agent's structured output is UI, not markdown.
- No skeleton shimmer. Static skeleton bars only; shimmer pulls attention to absence.
- No brand hue. Focus, selection and emphasis are carried by the greys.
- No multi-column layouts, with one exception: the three suggestion cards on the empty state sit side by side, because they are a menu of equal choices, not content read in sequence. Everything else is one column.
