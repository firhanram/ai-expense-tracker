import React from "react"
import { linearTiming, TransitionSeries } from "@remotion/transitions"
import { fade } from "@remotion/transitions/fade"
import { useVideoConfig } from "remotion"
import { ListScene } from "./scenes/ListScene"
import { LogScene } from "./scenes/LogScene"
import { Intro } from "./scenes/Intro"
import { Outro } from "./scenes/Outro"
import { ReceiptScene } from "./scenes/ReceiptScene"
import { ReportScene } from "./scenes/ReportScene"

export const ExpenseVideo: React.FC = () => {
  const { fps } = useVideoConfig()
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence name="Intro" durationInFrames={3.5 * fps}>
        <Intro
          name="Intro"
          style={{ backgroundColor: "#FAFAF9", justifyContent: "center", alignItems: "center" }}
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 15 })}
      />
      <TransitionSeries.Sequence name="Log" durationInFrames={7.5 * fps}>
        <LogScene name="Log" style={{ backgroundColor: "#FAFAF9" }} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 15 })}
      />
      <TransitionSeries.Sequence name="Receipts" durationInFrames={7.5 * fps}>
        <ReceiptScene name="Receipts" style={{ backgroundColor: "#FAFAF9" }} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 15 })}
      />
      <TransitionSeries.Sequence name="Reports" durationInFrames={8.5 * fps}>
        <ReportScene name="Reports" style={{ backgroundColor: "#FAFAF9" }} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 15 })}
      />
      <TransitionSeries.Sequence name="Expense list" durationInFrames={7 * fps}>
        <ListScene name="Expense list" style={{ backgroundColor: "#FAFAF9" }} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 15 })}
      />
      <TransitionSeries.Sequence name="Outro" durationInFrames={4.5 * fps}>
        <Outro
          name="Outro"
          style={{ backgroundColor: "#FAFAF9", justifyContent: "center", alignItems: "center" }}
        />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  )
}
