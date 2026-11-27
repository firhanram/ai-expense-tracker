import React from "react"
import { Composition, Folder } from "remotion"
import { ExpenseVideo } from "./ExpenseVideo"
import { Intro } from "./scenes/Intro"
import { ListScene } from "./scenes/ListScene"
import { LogScene } from "./scenes/LogScene"
import { Outro } from "./scenes/Outro"
import { ReceiptScene } from "./scenes/ReceiptScene"
import { ReportScene } from "./scenes/ReportScene"

// Scenes total 38.5s at 30fps, minus five 15-frame fades = 1080 frames (36s).
export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="ExpenseVideo"
      component={ExpenseVideo}
      durationInFrames={1080}
      fps={30}
      width={1920}
      height={1080}
    />
    <Folder name="Scenes">
      <Composition
        id="Intro"
        component={Intro}
        durationInFrames={105}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          style: { backgroundColor: "#FAFAF9", justifyContent: "center", alignItems: "center" },
        }}
      />
      <Composition
        id="Log"
        component={LogScene}
        durationInFrames={225}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ style: { backgroundColor: "#FAFAF9" } }}
      />
      <Composition
        id="Receipts"
        component={ReceiptScene}
        durationInFrames={225}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ style: { backgroundColor: "#FAFAF9" } }}
      />
      <Composition
        id="Reports"
        component={ReportScene}
        durationInFrames={255}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ style: { backgroundColor: "#FAFAF9" } }}
      />
      <Composition
        id="ExpenseList"
        component={ListScene}
        durationInFrames={210}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ style: { backgroundColor: "#FAFAF9" } }}
      />
      <Composition
        id="Outro"
        component={Outro}
        durationInFrames={135}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          style: { backgroundColor: "#FAFAF9", justifyContent: "center", alignItems: "center" },
        }}
      />
    </Folder>
  </>
)
