# Ouroboros Demo Script (about 2 minutes)

**Setup before you start:** Docker Desktop running, backend on :5000, dashboard on :5173, browser open at `http://localhost:5173`.

## 1. The problem (15s)
"Teams lose hours to repeat bugs that have been fixed before. Ouroboros turns that failure history into an automated first fix, with a human in control."

## 2. Incident feed (15s)
Open **Incidents**. Show the list, the classified types, and the status filters. "Every error from the sample app lands here and is classified automatically."

## 3. Generate a patch (25s)
Click **Review** on an incident, then **Generate patch**. Point out the explanation, confidence score and side-by-side diff.

## 4. Sandbox gate (30s)
Click **Run sandbox test**. "The patch runs in a Docker container with no network, a read-only filesystem and strict limits." Show a failed patch (for example the `/api/profile` one that dropped `displayName`): Approve stays locked. Reject it with a note, regenerate, and show the passing one.

## 5. Memory (20s)
Scroll to **Similar past incidents**. "Each incident is embedded and stored, so the system retrieves its own history. This is the ouroboros: failures feed the next fix."

## 6. Human approval (10s)
Approve the passing patch, leaving a note.

## 7. Metrics (10s)
Open **Metrics**: incidents by status, sandbox results, approvals, awaiting review, mean time to review.

## Closing line
"It never auto-deploys. Safety comes from the sandbox plus human approval. Next step is feeding sandbox failures back to the LLM for automatic retries."
