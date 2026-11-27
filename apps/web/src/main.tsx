import "./styles.css"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { App, createAppRouter, createQueryClient } from "./App.tsx"

const root = document.getElementById("root")
if (root === null) throw new Error("index.html has no #root")

createRoot(root).render(
  <StrictMode>
    <App router={createAppRouter()} queryClient={createQueryClient()} />
  </StrictMode>,
)
