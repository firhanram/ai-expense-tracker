import React from "react"
import { Easing, Interactive, interpolate, useCurrentFrame } from "remotion"
import { typed } from "../anim"
import { c, mono, sans } from "../theme"
import { LogoTile } from "../ui/kit"

const IntroInner: React.FC = () => {
  const frame = useCurrentFrame()
  const headline = "Where did your money go?"
  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 48 }}>
        <Interactive.Div
          name="Logo lockup"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            fontFamily: sans,
            fontSize: 56,
            fontWeight: 600,
            color: c.text,
            opacity: interpolate(frame, [0, 14], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            scale: interpolate(frame, [0, 20], [0.85, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
              output: "perceptual-scale",
            }),
          }}
        >
          <LogoTile size={76} />
          expense
          <span style={{ width: 14, height: 14, borderRadius: 7, background: c.online }} />
        </Interactive.Div>
        <Interactive.Div
          name="Headline"
          style={{
            fontFamily: mono,
            fontSize: 104,
            fontWeight: 500,
            letterSpacing: -2,
            color: c.text,
            minHeight: 130,
          }}
        >
          {typed(headline, frame, 24, 1.4)}
          <span
            style={{
              display: "inline-block",
              width: 6,
              height: 96,
              marginLeft: 6,
              verticalAlign: -14,
              background: c.text,
              opacity: Math.floor(frame / 12) % 2 === 0 || frame < 60 ? 1 : 0,
            }}
          />
        </Interactive.Div>
        <Interactive.Div
          name="Subhead"
          style={{
            fontFamily: sans,
            fontSize: 44,
            color: c.muted,
            opacity: interpolate(frame, [62, 78], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            translate: interpolate(frame, [62, 78], ["0px 16px", "0px 0px"], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
          }}
        >
          An expense tracker you just talk to.
        </Interactive.Div>
      </div>
    </>
  )
}

export const Intro = Interactive.create({ Component: IntroInner, layout: "absolute-fill" })
