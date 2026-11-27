import React from "react"
import { c, mono, rupiah } from "../theme"
import { prog } from "../anim"
import { Icon } from "./Icon"

const rows: [string, string, string, number, boolean][] = [
  ["24 Nov", "Uniqlo", "Shopping", 70000, false],
  ["24 Nov", "Warung Bu Tini", "Dining", 25000, false],
  ["23 Nov", "Gojek", "Transport", 18000, false],
  ["22 Nov", "Indomaret", "Groceries", 146500, true],
  ["21 Nov", "Kopi Kenangan", "Dining", 32000, false],
  ["20 Nov", "Tokopedia — refund", "Shopping", -120000, false],
  ["18 Nov", "Superindo", "Groceries", 312000, false],
  ["15 Nov", "PLN token", "Utilities", 200000, false],
]

/** `frame` is relative to the scene; `menuAt` opens the row menu on row 1. */
export const ExpenseList: React.FC<{ frame: number; menuAt: number }> = ({ frame, menuAt }) => {
  const total = 2480000 * prog(frame, 8, 36)
  const menu = prog(frame, menuAt, 8)
  return (
    <div
      style={{
        padding: "16px 20px 0",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      {/* Where */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="chevronLeft" size={18} color={c.muted} />
          <span style={{ fontSize: 18, fontWeight: 600, lineHeight: "26px" }}>November 2026</span>
          <Icon name="chevronRight" size={18} color={c.muted} />
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            height: 32,
            padding: "0 12px",
            borderRadius: 6,
            background: c.accent,
            color: c.accentFg,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          <Icon name="plus" size={16} color={c.accentFg} />
          Add expense
        </div>
      </div>
      {/* How much */}
      <div
        style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 6, paddingLeft: 26 }}
      >
        <span
          style={{
            fontFamily: mono,
            fontSize: 28,
            fontWeight: 600,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {rupiah(total)}
        </span>
        <span style={{ fontSize: 13, color: c.muted }}>spent · 9 expenses</span>
      </div>
      {/* Which slice */}
      <div
        style={{
          marginTop: 18,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          borderBottom: `1px solid ${c.line}`,
        }}
      >
        <div style={{ display: "flex", gap: 20, fontSize: 13 }}>
          <div
            style={{
              fontWeight: 600,
              paddingBottom: 9,
              borderBottom: `2px solid ${c.text}`,
              marginBottom: -1,
            }}
          >
            Confirmed
          </div>
          <div
            style={{
              color: c.muted,
              paddingBottom: 9,
              display: "flex",
              gap: 6,
              alignItems: "center",
            }}
          >
            Drafts
            <span
              style={{
                background: c.warnBg,
                color: c.warnFg,
                fontFamily: mono,
                fontSize: 11,
                borderRadius: 999,
                padding: "0 6px",
                lineHeight: "16px",
              }}
            >
              3
            </span>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            color: c.text,
            paddingBottom: 9,
          }}
        >
          All categories
          <Icon name="chevronDown" size={12} color={c.muted} />
        </div>
      </div>
      {/* Rows */}
      {rows.map(([date, merchant, cat, amount, receipt], i) => {
        const p = prog(frame, 10 + i * 4, 14)
        const hot = i === 1 && menu > 0
        return (
          <div
            key={merchant}
            style={{
              height: 52,
              display: "flex",
              alignItems: "center",
              borderBottom: `1px solid ${c.line}`,
              opacity: p,
              translate: `0px ${(1 - p) * 10}px`,
              background: hot ? c.surface2 : "transparent",
              margin: "0 -8px",
              padding: "0 8px",
              fontSize: 13,
            }}
          >
            <div style={{ width: 72, color: c.muted }}>{date}</div>
            <div
              style={{
                flex: 1,
                fontSize: 15,
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              {merchant}
              {receipt ? <Icon name="receipt" size={14} color={c.muted} /> : null}
            </div>
            <div style={{ width: 130, color: c.muted }}>{cat}</div>
            <div
              style={{
                width: 110,
                textAlign: "right",
                fontFamily: mono,
                fontSize: 13,
                fontWeight: 500,
                fontVariantNumeric: "tabular-nums",
                color: amount < 0 ? c.danger : c.text,
              }}
            >
              {rupiah(amount)}
            </div>
            <div style={{ width: 36, display: "flex", justifyContent: "flex-end" }}>
              <Icon name="more" size={16} color={c.muted} />
            </div>
          </div>
        )
      })}
      {/* Row menu */}
      {menu > 0 ? (
        <div
          style={{
            position: "absolute",
            right: 20,
            top: 136 + 52 * 2 - 4,
            width: 150,
            background: c.surface,
            border: `1px solid ${c.line}`,
            borderRadius: 10,
            boxShadow: "0 12px 32px -8px rgba(28,25,23,0.22)",
            padding: 4,
            opacity: menu,
            scale: `${0.94 + 0.06 * menu}`,
            transformOrigin: "top right",
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              height: 34,
              padding: "0 10px",
              borderRadius: 6,
              background: c.surface2,
            }}
          >
            <Icon name="pencil" size={14} color={c.text} />
            Edit
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              height: 34,
              padding: "0 10px",
              color: c.danger,
            }}
          >
            <Icon name="trash" size={14} color={c.danger} />
            Delete
          </div>
        </div>
      ) : null}
    </div>
  )
}
