import React from "react"
import { c, mono, rupiah } from "../theme"
import { prog } from "../anim"

// November 2026 by Category, the figures shown on the design canvas.
const rows = [
  ["Groceries", 980000],
  ["Dining", 612500],
  ["Shopping", 310000],
  ["Utilities", 200000],
  ["Transport", 187500],
  ["Health", 85000],
  ["Entertainment", 54000],
  ["Giving & family", 51000],
] as const

const fills = [
  "#1C1917",
  "#292524",
  "#44403C",
  "#57534E",
  "#78716C",
  "#A8A29E",
  "#C4C0BD",
  "#D6D3D1",
]
const TOTAL = 2480000
const MAX = rows[0][1]

/** `frame` is relative to when the card starts drawing its bars. */
export const SpendingChart: React.FC<{ frame: number }> = ({ frame }) => {
  const total = TOTAL * prog(frame, 0, 40)
  return (
    <div
      style={{
        background: c.surface,
        border: `1px solid ${c.line}`,
        borderRadius: 12,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, lineHeight: "22px" }}>November 2026</div>
          <div style={{ fontSize: 13, color: c.muted, lineHeight: "20px" }}>by category</div>
        </div>
        <div
          style={{
            fontFamily: mono,
            fontSize: 18,
            fontWeight: 600,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {rupiah(total)}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {rows.map(([label, value], i) => {
          const p = prog(frame, 4 + i * 3, 26)
          const light = i >= 5
          const w = (value / MAX) * p
          return (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 12, height: 22 }}>
              <div style={{ width: 118, fontSize: 13, color: c.muted, flexShrink: 0 }}>{label}</div>
              <div style={{ flex: 1, height: 22, position: "relative" }}>
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: `${w * 100}%`,
                    minWidth: p > 0 ? 4 : 0,
                    background: fills[i],
                    borderRadius: 4,
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    display: "flex",
                    alignItems: "center",
                    fontFamily: mono,
                    fontSize: 12,
                    fontWeight: 500,
                    fontVariantNumeric: "tabular-nums",
                    opacity: prog(frame, 16 + i * 3, 10),
                    ...(w > 0.35
                      ? { right: `${(1 - w) * 100}%`, paddingRight: 8, color: c.accentFg }
                      : { left: `calc(${w * 100}% + 8px)`, color: light ? c.muted : c.text }),
                  }}
                >
                  {new Intl.NumberFormat("id-ID").format(value)}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
