import React from "react"
import { Easing, Interactive, interpolate, useCurrentFrame } from "remotion"
import { prog, typed, typedEnd } from "../anim"
import { c, mono, sans } from "../theme"
import {
  AppWindow,
  Composer,
  Conversation,
  DraftCard,
  Prose,
  Reveal,
  Thinking,
  UserBubble,
} from "../ui/kit"
import { SpendingChart } from "../ui/SpendingChart"
import { Stage } from "../ui/Stage"

const MESSAGE = "report of my expenses this month"
const ANSWER =
  "You've spent Rp2.480.000 so far in November. Groceries is the largest share, at about 40%."
const TYPE_AT = 14
const SEND_AT = typedEnd(MESSAGE, TYPE_AT, 1.2) + 8
const ANSWER_AT = SEND_AT + 40

const ReportWindow: React.FC = () => {
  const frame = useCurrentFrame()
  const sent = frame >= SEND_AT + 4
  return (
    <AppWindow tab={0}>
      <Conversation>
        <Reveal p={1}>
          <UserBubble text="here's the indomaret one" />
        </Reveal>
        <Reveal p={1}>
          <DraftCard
            amount="Rp146.500"
            merchant="Indomaret"
            date="22 Nov 2026"
            category="Groceries"
            receipt
            confirmed={1}
          />
        </Reveal>
        <Reveal p={prog(frame, SEND_AT + 4, 12)}>
          <UserBubble text={MESSAGE} />
        </Reveal>
        <Reveal p={prog(frame, SEND_AT + 16, 8) * (1 - prog(frame, ANSWER_AT - 6, 6))}>
          <Thinking frame={frame} />
        </Reveal>
        <Reveal p={prog(frame, ANSWER_AT, 10)}>
          <Prose text={ANSWER} shown={Math.floor((frame - ANSWER_AT) / 1.5)} />
        </Reveal>
        <Reveal p={prog(frame, ANSWER_AT + 12, 16)}>
          <SpendingChart frame={frame - ANSWER_AT - 22} />
        </Reveal>
      </Conversation>
      <Composer
        text={sent ? "" : typed(MESSAGE, frame, TYPE_AT, 1.2)}
        focused={frame >= TYPE_AT - 4 && !sent}
        caret={frame >= TYPE_AT - 4 && !sent}
        sendPressed={frame >= SEND_AT && frame < SEND_AT + 4}
      />
    </AppWindow>
  )
}

const ReportSceneInner: React.FC = () => {
  const frame = useCurrentFrame()
  return (
    <Stage
      windowEnter={1}
      window={<ReportWindow />}
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
            03 — Reports
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
            Ask. See the answer.
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
            A question about your spending comes back as a chart, not three paragraphs.
          </Interactive.Div>
          <Interactive.Div
            name="Server note"
            style={{
              fontFamily: sans,
              fontSize: 40,
              lineHeight: 1.35,
              fontWeight: 600,
              color: c.text,
              opacity: interpolate(frame, [140, 154], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              translate: interpolate(frame, [140, 158], ["0px 16px", "0px 0px"], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.16, 1, 0.3, 1),
              }),
            }}
          >
            The server does the maths, never the model.
          </Interactive.Div>
        </>
      }
    />
  )
}

export const ReportScene = Interactive.create({
  Component: ReportSceneInner,
  layout: "absolute-fill",
})
