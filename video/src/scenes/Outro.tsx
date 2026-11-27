import React from "react"
import { Easing, Interactive, interpolate, useCurrentFrame } from "remotion"
import { prog } from "../anim"
import { c, mono, sans } from "../theme"
import { LogoTile } from "../ui/kit"

const features = ["Log in a sentence", "Read receipts", "Charts you can trust", "One plain list"]

const OutroInner: React.FC = () => {
  const frame = useCurrentFrame()
  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 44 }}>
        <Interactive.Div
          name="Headline"
          style={{
            fontFamily: mono,
            fontSize: 96,
            fontWeight: 500,
            letterSpacing: -2,
            color: c.text,
            opacity: interpolate(frame, [0, 16], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            translate: interpolate(frame, [0, 22], ["0px 24px", "0px 0px"], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
          }}
        >
          One sentence per purchase.
        </Interactive.Div>
        <Interactive.Div
          name="Subhead"
          style={{
            fontFamily: sans,
            fontSize: 44,
            color: c.muted,
            opacity: interpolate(frame, [12, 28], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          The agent proposes. You confirm.
        </Interactive.Div>
        {/* Feature chips: one template, staggered */}
        <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
          {features.map((f, i) => {
            const p = prog(frame, 26 + i * 5, 14)
            return (
              <div
                key={f}
                style={{
                  fontFamily: sans,
                  fontSize: 30,
                  fontWeight: 500,
                  color: c.text,
                  background: c.surface,
                  border: `2px solid ${c.line}`,
                  borderRadius: 999,
                  padding: "14px 28px",
                  opacity: p,
                  translate: `0px ${(1 - p) * 16}px`,
                }}
              >
                {f}
              </div>
            )
          })}
        </div>
        <Interactive.Div
          name="Logo lockup"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginTop: 56,
            fontFamily: sans,
            fontSize: 44,
            fontWeight: 600,
            color: c.text,
            opacity: interpolate(frame, [56, 72], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          <LogoTile size={60} />
          expense
        </Interactive.Div>
      </div>
    </>
  )
}

export const Outro = Interactive.create({ Component: OutroInner, layout: "absolute-fill" })
