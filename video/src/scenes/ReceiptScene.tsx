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

const MESSAGE = "here's the indomaret one"
const ATTACH_AT = 30
const TYPE_AT = 46
const SEND_AT = typedEnd(MESSAGE, TYPE_AT) + 8
const DRAFT_AT = SEND_AT + 52

const ReceiptWindow: React.FC = () => {
  const frame = useCurrentFrame()
  const sent = frame >= SEND_AT + 4
  const down = frame >= ATTACH_AT && frame < ATTACH_AT + 5
  return (
    <>
      <AppWindow tab={0}>
        <Conversation>
          {/* Where the previous scene left off */}
          <Reveal p={1}>
            <UserBubble text="buy cloth 70rb" />
          </Reveal>
          <Reveal p={1}>
            <DraftCard
              amount="Rp70.000"
              meta="Uniqlo · 24 Nov 2026"
              category="Shopping"
              confirmed={1}
            />
          </Reveal>
          <Reveal p={prog(frame, SEND_AT + 4, 12)}>
            <UserBubble text={MESSAGE} photo />
          </Reveal>
          <Reveal p={prog(frame, SEND_AT + 18, 8) * (1 - prog(frame, DRAFT_AT - 4, 8))}>
            <Thinking frame={frame} />
          </Reveal>
          <Reveal p={prog(frame, DRAFT_AT, 14)}>
            <DraftCard
              amount="Rp146.500"
              meta="Indomaret · 22 Nov 2026"
              category="Groceries"
              needsReview
              receipt
              confirmed={0}
            />
          </Reveal>
        </Conversation>
        <Composer
          text={sent ? "" : typed(MESSAGE, frame, TYPE_AT, 1.6)}
          focused={frame >= TYPE_AT - 4 && !sent}
          caret={frame >= TYPE_AT - 4 && !sent}
          attachment={sent ? 0 : prog(frame, ATTACH_AT + 4, 4)}
          sendPressed={frame >= SEND_AT && frame < SEND_AT + 4}
        />
      </AppWindow>
      <Pointer
        x={interpolate(frame, [8, 28], [360, 62], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.65, 0, 0.35, 1),
        })}
        y={interpolate(frame, [8, 28], [470, 640], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.65, 0, 0.35, 1),
        })}
        opacity={prog(frame, 6, 6) * (1 - prog(frame, 40, 8))}
        down={down}
      />
    </>
  )
}

const ReceiptSceneInner: React.FC = () => {
  const frame = useCurrentFrame()
  return (
    <Stage
      windowEnter={1}
      window={<ReceiptWindow />}
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
            02 — Receipts
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
            Or snap the receipt.
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
            Paste, drop or pick a photo. It reads the total, and the photo sits next to it so you
            can check.
          </Interactive.Div>
          <Interactive.Div
            name="Review note"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              fontFamily: sans,
              fontSize: 40,
              lineHeight: 1.35,
              fontWeight: 600,
              color: c.text,
              opacity: interpolate(frame, [150, 164], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              translate: interpolate(frame, [150, 168], ["0px 16px", "0px 0px"], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.16, 1, 0.3, 1),
              }),
            }}
          >
            Not sure? It flags the Draft for you.
          </Interactive.Div>
        </>
      }
    />
  )
}

export const ReceiptScene = Interactive.create({
  Component: ReceiptSceneInner,
  layout: "absolute-fill",
})
