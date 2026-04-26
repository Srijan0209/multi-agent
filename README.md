# Startup Sprint Simulator

A local, deterministic multi-agent sprint lifecycle simulator built with Vite + React. A ticket moves through backlog, specification, planning, test design, review, revision, and done while role-based agents exchange structured JSON messages and update versioned artifacts.

## Run

Install dependencies:

```bash
npm install
```

Start the React dev server:

```bash
npm run dev
```

Then open the URL printed by Vite, usually:

```text
http://127.0.0.1:5174/
```

## Test

```bash
npm test
```

## What It Demonstrates

- Four role-separated agents: Product, Planning, QA, and Reviewer.
- Explicit state machine with logged transitions.
- Structured `startup-sprint.v1` JSON message protocol.
- Artifact versioning for spec, plan, tests, and review.
- Review loop tracking with deterministic revisions.
- Quantitative metrics and a naive single-agent baseline comparison.
- Reproducible runs from a fixed seed.

## Deliverables

- Architecture document: [docs/architecture.md](./docs/architecture.md)
- Agent interaction diagram: [docs/interaction-diagram.md](./docs/interaction-diagram.md)
- Evaluation report: [docs/evaluation-report.md](./docs/evaluation-report.md)
- Working UI: [src/main.jsx](./src/main.jsx)
- Test scenarios: [data/scenarios.json](./data/scenarios.json)
