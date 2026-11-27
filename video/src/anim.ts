import { Easing, interpolate } from "remotion"

const ease = Easing.bezier(0.16, 1, 0.3, 1)

/** 0 → 1 between `from` and `from + dur`, eased out. */
export const prog = (frame: number, from: number, dur = 12) =>
  interpolate(frame, [from, from + dur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  })

/** The part of `text` typed by `frame`, one character every `fpc` frames from `from`. */
export const typed = (text: string, frame: number, from: number, fpc = 2) =>
  frame < from ? "" : text.slice(0, Math.floor((frame - from) / fpc) + 1)

/** Frame at which typing `text` from `from` finishes. */
export const typedEnd = (text: string, from: number, fpc = 2) => from + (text.length - 1) * fpc
