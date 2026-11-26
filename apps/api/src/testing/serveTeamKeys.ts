import { serveTeamKeys } from "./access.ts"

// Setup file: every test file's Worker can fetch the test Access team's keys.
serveTeamKeys()
