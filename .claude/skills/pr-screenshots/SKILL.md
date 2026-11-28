---
name: pr-screenshots
description: Capture screenshots of a UI change and embed them in its pull request. Use whenever a PR changes anything visible in apps/web or packages/ui, while writing the PR body's Evidence section, or when asked to add screenshots to a PR.
---

GitHub has no API for comment-style image uploads, so screenshots go on the orphan `pr-assets` branch and the PR body links them by commit SHA.

## 1. Capture

Use the Playwright suite. It builds and serves the bundle with `vite preview` and mocks the API, so it needs no dev server (never start one without asking).

- Write or extend a spec in `apps/web/e2e/` that drives the changed UI, then call `screenshot(target, "<ticket>", "<name>")` from `e2e/support/screenshot.ts`. Use `showAs(page, viewport, theme)` for the desktop/mobile × light/dark frames that matter for the change.
- Run only that spec: `pnpm --filter @expense/web test:e2e <spec-file>`.
- **Before:** run the same spec on `master` in a worktree (`git worktree add <scratchpad>/before master`, install, run, copy the PNGs out), so before and after show the same state.
- Open each PNG with Read and check it shows the change before you publish it.

## 2. Publish

```bash
scripts/pr-screenshots.sh <branch-name> before.png after.png after-mobile-dark.png
```

It pushes the files to `pr-assets` under `<branch-name>/` and prints one Markdown image line per file, pinned to the commit SHA. Name the files for what they show (`after-mobile-dark.png`), since the name becomes the alt text. Copy each file to its final name first if needed.

## 3. Embed

Put the printed lines in the PR body's **Evidence** section (the `pr` skill template), then `gh pr create --body-file` or `gh pr edit <n> --body-file`.

```markdown
- **Before:** ![before](https://github.com/firhanram/ai-expense-tracker/blob/<sha>/feat-x/before.png?raw=true)
  **After:** ![after](https://github.com/firhanram/ai-expense-tracker/blob/<sha>/feat-x/after.png?raw=true)
```

Never link a screenshot by a feature branch name (`blob/feat/x/...`). The image breaks once the branch is deleted after the merge.
