import React, { useLayoutEffect, useRef, useState } from "react"
import { interpolate } from "remotion"
import { c, mono, sans, shadowXs, windowShadow } from "../theme"
import { Icon } from "./Icon"

/* ---------- Window and top bar ---------- */

export const WINDOW_W = 760
export const WINDOW_H = 700

/** The app as it sits in a browser: native 760×700 design pixels. */
export const AppWindow: React.FC<{
  tab: number // 0 = Chat, 1 = Expenses; fractional while switching
  children: React.ReactNode
}> = ({ tab, children }) => (
  <div
    style={{
      width: WINDOW_W,
      height: WINDOW_H,
      background: c.bg,
      borderRadius: 18,
      border: `1px solid ${c.line}`,
      boxShadow: windowShadow,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      fontFamily: sans,
      color: c.text,
      position: "relative",
    }}
  >
    <TopBar tab={tab} />
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      {children}
    </div>
  </div>
)

export const LogoTile: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size * 0.286,
      background: c.accent,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <Icon name="wallet" size={size * 0.57} color={c.accentFg} />
  </div>
)

const TopBar: React.FC<{ tab: number }> = ({ tab }) => (
  <div
    style={{
      height: 56,
      flexShrink: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 20px",
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <LogoTile />
      <span style={{ fontSize: 15, fontWeight: 600 }}>expense</span>
      <span style={{ width: 6, height: 6, borderRadius: 3, background: c.online }} />
    </div>
    <div
      style={{
        position: "relative",
        display: "flex",
        background: c.surface2,
        borderRadius: 8,
        padding: 3,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 3,
          left: 3 + tab * 92,
          width: 92,
          height: 28,
          borderRadius: 6,
          background: c.surface,
          boxShadow: shadowXs,
        }}
      />
      {(
        [
          ["chat", "Chat"],
          ["list", "Expenses"],
        ] as const
      ).map(([icon, label], i) => {
        const active = 1 - Math.min(1, Math.abs(tab - i))
        const color = interpolate(active, [0, 1], [0, 1]) > 0.5 ? c.text : c.muted
        return (
          <div
            key={label}
            style={{
              position: "relative",
              width: 92,
              height: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              fontSize: 13,
              fontWeight: 500,
              color,
            }}
          >
            <Icon name={icon} size={14} color={color} />
            {label}
          </div>
        )
      })}
    </div>
  </div>
)

/* ---------- Reveal: grows a chat item into the column ---------- */

/**
 * Grows from zero height to the child's measured height, so earlier messages
 * slide up the way a chat scrolls instead of jumping.
 */
export const Reveal: React.FC<{
  p: number
  gap?: number
  children: React.ReactNode
}> = ({ p, gap = 16, children }) => {
  const ref = useRef<HTMLDivElement>(null)
  const [h, setH] = useState<number | null>(null)
  useLayoutEffect(() => {
    if (ref.current) setH(ref.current.offsetHeight)
  }, [children])
  if (p <= 0) return null
  return (
    <div
      style={{
        height: h === null ? undefined : p * (h + gap),
        overflow: p < 1 ? "hidden" : "visible",
        flexShrink: 0,
      }}
    >
      <div
        ref={ref}
        style={{
          marginTop: gap,
          opacity: p,
          translate: `0px ${(1 - p) * 14}px`,
        }}
      >
        {children}
      </div>
    </div>
  )
}

/* ---------- Chat pieces ---------- */

/** The conversation column: newest at the bottom, like the real Chat. */
export const Conversation: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      flex: 1,
      minHeight: 0,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      justifyContent: "flex-end",
      padding: "0 20px 20px",
    }}
  >
    {children}
  </div>
)

export const UserBubble: React.FC<{ text: string; photo?: boolean }> = ({ text, photo }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
    {photo ? <ReceiptPhoto width={96} height={120} rotate={0} /> : null}
    <div
      style={{
        maxWidth: "85%",
        background: c.surface2,
        borderRadius: 16,
        padding: "10px 14px",
        fontSize: 15,
        lineHeight: "23px",
        fontWeight: 500,
      }}
    >
      {text}
    </div>
  </div>
)

export const Prose: React.FC<{ text: string; shown: number }> = ({ text, shown }) => {
  const words = text.split(" ")
  return (
    <div style={{ fontSize: 15, lineHeight: "23px", maxWidth: 640 }}>
      {words.map((w, i) => (
        <span key={i} style={{ opacity: i < shown ? 1 : 0 }}>
          {w}{" "}
        </span>
      ))}
    </div>
  )
}

export const Thinking: React.FC<{ frame: number }> = ({ frame }) => (
  <div style={{ display: "flex", gap: 5, padding: "8px 2px" }}>
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        style={{
          width: 7,
          height: 7,
          borderRadius: 4,
          background: c.muted,
          opacity: 0.35 + 0.65 * Math.max(0, Math.sin((frame - i * 4) / 5)),
        }}
      />
    ))}
  </div>
)

/* ---------- Draft Expense card ---------- */

const btn = (primary: boolean, pressed = false): React.CSSProperties => ({
  height: 32,
  padding: "0 14px",
  display: "flex",
  alignItems: "center",
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 600,
  background: primary ? c.accent : c.surface,
  color: primary ? c.accentFg : c.text,
  border: primary ? "none" : `1px solid ${c.line}`,
  scale: pressed ? "0.96" : "1",
})

export const CategoryChip: React.FC<{ label: string; editable?: boolean }> = ({
  label,
  editable = true,
}) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 6,
      height: 26,
      padding: "0 10px",
      borderRadius: 999,
      border: `1px solid ${c.line}`,
      background: c.surface,
      fontSize: 13,
      fontWeight: 500,
      whiteSpace: "nowrap",
    }}
  >
    {label}
    {editable ? <Icon name="pencil" size={12} color={c.muted} /> : null}
  </div>
)

export const NeedsReview: React.FC = () => (
  <div
    style={{
      alignSelf: "flex-start",
      display: "flex",
      alignItems: "center",
      gap: 5,
      height: 22,
      padding: "0 8px",
      borderRadius: 999,
      background: c.warnBg,
      color: c.warnFg,
      fontSize: 12,
      fontWeight: 500,
    }}
  >
    <Icon name="alert" size={12} color={c.warnFg} />
    Check amount
  </div>
)

export const DraftCard: React.FC<{
  amount: string
  meta: string
  category: string
  needsReview?: boolean
  receipt?: boolean
  pressed?: boolean
  confirmed: number // 0 → 1
}> = ({ amount, meta, category, needsReview, receipt, pressed, confirmed }) => (
  <div
    style={{
      background: interpolate(confirmed, [0, 1], [0, 1]) > 0.5 ? c.surface2 : c.surface,
      border: `1px solid ${c.line}`,
      borderRadius: 12,
      padding: 16,
      display: "flex",
      gap: 16,
      alignItems: "flex-start",
    }}
  >
    {receipt ? <ReceiptPhoto width={64} height={80} rotate={0} /> : null}
    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
      {needsReview ? (
        <div style={{ marginBottom: 8, display: "flex" }}>
          <NeedsReview />
        </div>
      ) : null}
      <div
        style={{
          fontFamily: mono,
          fontSize: 28,
          lineHeight: "34px",
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {amount}
      </div>
      <div style={{ fontSize: 13, lineHeight: "20px", color: c.muted }}>{meta}</div>
      <div style={{ position: "relative", height: 32, marginTop: 14 }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            gap: 8,
            opacity: 1 - confirmed,
          }}
        >
          <div style={btn(true, pressed)}>Confirm</div>
          <div style={btn(false)}>Discard</div>
        </div>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            fontWeight: 500,
            color: c.muted,
            opacity: confirmed,
          }}
        >
          Confirmed
          <Icon name="check" size={14} color={c.online} strokeWidth={2.5} />
        </div>
      </div>
    </div>
    <CategoryChip label={category} />
  </div>
)

/* ---------- Receipt photo (drawn, not an asset) ---------- */

export const ReceiptPhoto: React.FC<{ width: number; height: number; rotate: number }> = ({
  width,
  height,
  rotate,
}) => {
  const lines = [0.7, 0.45, 0.62, 0.5, 0.58, 0.4]
  return (
    <div
      style={{
        width,
        height,
        flexShrink: 0,
        borderRadius: 8,
        background: "linear-gradient(160deg, #57534E, #292524)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        rotate: `${rotate}deg`,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: width * 0.62,
          height: height * 0.86,
          background: "#F5F1E8",
          rotate: "-6deg",
          padding: `${height * 0.08}px ${width * 0.07}px`,
          display: "flex",
          flexDirection: "column",
          gap: height * 0.045,
          boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
        }}
      >
        <div
          style={{
            height: height * 0.05,
            width: "60%",
            background: "#44403C",
            alignSelf: "center",
          }}
        />
        {lines.map((l, i) => (
          <div
            key={i}
            style={{
              height: Math.max(1.5, height * 0.022),
              width: `${l * 100}%`,
              background: "#A8A29E",
            }}
          />
        ))}
        <div
          style={{ height: height * 0.04, width: "80%", background: "#292524", marginTop: "auto" }}
        />
      </div>
    </div>
  )
}

/* ---------- Composer ---------- */

const Pill: React.FC<{ children: React.ReactNode; active?: boolean }> = ({ children, active }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 6,
      height: 30,
      padding: "0 12px",
      borderRadius: 999,
      border: `1px solid ${active ? c.ring : c.line}`,
      background: active ? c.surface2 : c.surface,
      fontSize: 13,
      fontWeight: 500,
      color: c.text,
    }}
  >
    {children}
  </div>
)

export const Composer: React.FC<{
  text: string
  focused: boolean
  caret: boolean
  attachment?: number // 0 → 1
  sendPressed?: boolean
}> = ({ text, focused, caret, attachment = 0, sendPressed }) => (
  <div style={{ padding: "0 20px 20px", flexShrink: 0 }}>
    <div
      style={{
        background: c.surface,
        border: `1px solid ${focused ? c.ring : c.line}`,
        borderRadius: 16,
        padding: "14px 16px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div
        style={{ fontSize: 15, lineHeight: "23px", minHeight: 46, color: text ? c.text : c.muted }}
      >
        {text || (caret ? "" : "Log a purchase or ask about your spending…")}
        {caret ? (
          <span
            style={{
              display: "inline-block",
              width: 1.5,
              height: 18,
              background: c.text,
              marginLeft: 1,
              verticalAlign: -3,
            }}
          />
        ) : null}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Pill active={attachment > 0.5}>
          <Icon name="paperclip" size={14} color={c.muted} />
          {attachment > 0.5 ? "receipt.jpg" : "Receipt"}
        </Pill>
        <Pill>
          <Icon name="calendar" size={14} color={c.muted} />
          Today
          <Icon name="chevronDown" size={12} color={c.muted} />
        </Pill>
        <div style={{ flex: 1 }} />
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            background: text ? c.accent : c.line,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            scale: sendPressed ? "0.88" : "1",
          }}
        >
          <Icon name="arrowUp" size={16} color={text ? c.accentFg : c.surface} strokeWidth={2.5} />
        </div>
      </div>
    </div>
  </div>
)

/* ---------- Pointer ---------- */

export const Pointer: React.FC<{ x: number; y: number; opacity: number; down: boolean }> = ({
  x,
  y,
  opacity,
  down,
}) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      opacity,
      zIndex: 10,
      scale: down ? "0.88" : "1",
      transformOrigin: "0 0",
    }}
  >
    <svg width={22} height={26} viewBox="0 0 22 26">
      <path
        d="M2 2 L2 21 L7 16.5 L10.5 24 L14 22.5 L10.5 15 L17.5 15 Z"
        fill={c.text}
        stroke="#FFFFFF"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    </svg>
  </div>
)
