import React from "react"
import { Easing, Interactive, interpolate, useCurrentFrame } from "remotion"
import { prog } from "../anim"
import { c, mono, sans } from "../theme"
import { ExpenseList } from "../ui/ExpenseList"
import { AppWindow, Pointer } from "../ui/kit"
import { Stage } from "../ui/Stage"

const MENU_AT = 118

const ListWindow: React.FC = () => {
  const frame = useCurrentFrame()
  const down = frame >= MENU_AT - 4 && frame < MENU_AT + 1
  return (
    <>
      <AppWindow tab={prog(frame, 4, 12)}>
        <ExpenseList frame={frame - 8} menuAt={MENU_AT - 8} />
      </AppWindow>
      <Pointer
        x={interpolate(frame, [0, 4, 90, 112], [560, 690, 690, 728], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.65, 0, 0.35, 1),
        })}
        y={interpolate(frame, [0, 4, 90, 112], [60, 26, 26, 262], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.65, 0, 0.35, 1),
        })}
        opacity={1 - prog(frame, 180, 10)}
        down={(frame >= 2 && frame < 6) || down}
      />
    </>
  )
}

const ListSceneInner: React.FC = () => {
  const frame = useCurrentFrame()
  return (
    <Stage
      windowEnter={1}
      window={<ListWindow />}
      caption={
        <>
          <Interactive.Div
            name="Kicker"
            style={{
              fontFamily: mono,
              fontSize: 26,
              fontWeight: 500,
              color: c.muted,
              opacity: interpolate(frame, [4, 18], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            04 — Expense list
          </Interactive.Div>
          <Interactive.Div
            name="Headline"
            style={{
              fontFamily: sans,
              fontSize: 88,
              lineHeight: 1.05,
              fontWeight: 600,
              letterSpacing: -2,
              color: c.text,
              opacity: interpolate(frame, [8, 22], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              translate: interpolate(frame, [8, 26], ["0px 24px", "0px 0px"], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.16, 1, 0.3, 1),
              }),
            }}
          >
            Fix anything, later.
          </Interactive.Div>
          <Interactive.Div
            name="Body"
            style={{
              fontFamily: sans,
              fontSize: 40,
              lineHeight: 1.35,
              color: c.muted,
              opacity: interpolate(frame, [16, 30], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            Every Expense in one plain list. Step through months, filter by Category, edit or delete
            a row.
          </Interactive.Div>
        </>
      }
    />
  )
}

export const ListScene = Interactive.create({ Component: ListSceneInner, layout: "absolute-fill" })
