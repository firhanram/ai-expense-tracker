# Confirmation is a user action, never a model tool

The agent's tools create, read, edit and discard a Draft Expense. None of them confirms one. Confirmation happens when the user presses the button on the rendered card, which calls the API directly.

This makes "the agent cannot spend your money" structural rather than instructed. It also avoids a specific failure: a model that holds a confirm tool can act on "yes" in chat when the user meant something else entirely, or confirm a draft that is not the one on screen. Prompt instructions are not a control; an absent tool is.

## Consequences

- The agent cannot complete a flow end-to-end. Every recorded Expense has a human action in it. This is the intended property.
- Two implementations exist for the same state transition — the button and the API — but only one of them is reachable by the model.
- The confirm endpoint must be idempotent, since a button can be pressed twice and a network retry can duplicate a request.
