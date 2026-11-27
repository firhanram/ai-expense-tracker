import React from "react"
import { WINDOW_H } from "./kit"

export const WINDOW_SCALE = 1.3

/** Feature-scene layout: caption column on the left, the app window on the right. */
export const Stage: React.FC<{
  caption: React.ReactNode
  window: React.ReactNode
  windowEnter: number // 0 → 1
}> = ({ caption, window, windowEnter }) => (
  <>
    <div
      style={{
        position: "absolute",
        left: 120,
        top: 0,
        bottom: 0,
        width: 600,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 28,
      }}
    >
      {caption}
    </div>
    <div
      style={{
        position: "absolute",
        right: 120,
        top: (1080 - WINDOW_H * WINDOW_SCALE) / 2,
        width: 760 * WINDOW_SCALE,
        height: WINDOW_H * WINDOW_SCALE,
        opacity: windowEnter,
        translate: `${(1 - windowEnter) * 60}px 0px`,
      }}
    >
      <div
        style={{
          position: "relative",
          scale: `${WINDOW_SCALE}`,
          transformOrigin: "0 0",
          width: 760,
          height: WINDOW_H,
        }}
      >
        {window}
      </div>
    </div>
  </>
)
