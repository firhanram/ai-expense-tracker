import React from "react"
import { Easing, Interactive, interpolate, useCurrentFrame } from "remotion"
import { prog, typed, typedEnd } from "../anim"
import { c, mono, sans } from "../theme"
import {
  AppWindow,
  Composer,
  Conversation,
  DraftCard,
  Pointer,
  Reveal,
  Thinking,
  UserBubble,
} from "../ui/kit"
import { Stage } from "../ui/Stage"

const MESSAGE = "buy cloth 70rb"
const TYPE_AT = 20
const SEND_AT = typedEnd(MESSAGE, TYPE_AT) + 8
const CLICK_AT = 162

const LogWindow: React.FC = () => {
  const frame = useCurrentFrame()
  const sent = frame >= SEND_AT + 4
  const pointer = {
    x: interpolate(frame, [128, 156], [430, 64], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.65, 0, 0.35, 1),
    }),
    y: interpolate(frame, [128, 156], [640, 500], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(0.65, 0, 0.35, 1),
    }),
    opacity: prog(frame, 126, 8) * (1 - prog(frame, 196, 10)),
  }
  const down = frame >= CLICK_AT && frame < CLICK_AT + 5
  return (
    <>
      <AppWindow tab={0}>
        <Conversation>
          <Reveal p={prog(frame, SEND_AT + 4, 12)}>
            <UserBubble text={MESSAGE} />
          </Reveal>
          <Reveal p={prog(frame, SEND_AT + 16, 8) * (1 - prog(frame, 100, 8))}>
            <Thinking frame={frame} />
          </Reveal>
          <Reveal p={prog(frame, 104, 14)}>
            <DraftCard
              amount="Rp70.000"
              meta="Uniqlo · 24 Nov 2026"
              category="Shopping"
              pressed={down}
              confirmed={prog(frame, CLICK_AT + 6, 10)}
            />
          </Reveal>
        </Conversation>
        <Composer
          text={sent ? "" : typed(MESSAGE, frame, TYPE_AT)}
          focused={frame >= 10 && !sent}
          caret={frame >= 10 && !sent && (frame < SEND_AT || Math.floor(frame / 12) % 2 === 0)}
          sendPressed={frame >= SEND_AT && frame < SEND_AT + 4}
        />
      </AppWindow>
      <Pointer x={pointer.x} y={pointer.y} opacity={pointer.opacity} down={down} />
    </>
  )
}

const LogSceneInner: React.FC = () => {
  const frame = useCurrentFrame()
  return (
    <Stage
      windowEnter={prog(frame, 0, 20)}
      window={<LogWindow />}
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
            01 — Log
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
            Say it once.
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
            Type a purchase the way you'd say it. The agent drafts the amount, merchant, date and
            Category.
          </Interactive.Div>
          <Interactive.Div
            name="Confirm note"
            style={{
              fontFamily: sans,
              fontSize: 40,
              lineHeight: 1.35,
              fontWeight: 600,
              color: c.text,
              opacity: interpolate(frame, [166, 180], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              translate: interpolate(frame, [166, 184], ["0px 16px", "0px 0px"], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.16, 1, 0.3, 1),
              }),
            }}
          >
            Nothing is recorded until you press Confirm.
          </Interactive.Div>
        </>
      }
    />
  )
}

export const LogScene = Interactive.create({ Component: LogSceneInner, layout: "absolute-fill" })
