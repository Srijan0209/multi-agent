# Architecture Document

## Objective

The Startup Sprint Simulator models a small product sprint using multiple role-based agents. The system is intentionally deterministic: a fixed seed produces the same state transitions, artifact versions, review outcome, and quantitative metrics.

## Agents

| Agent | Responsibility | Writes |
| --- | --- | --- |
| Product Agent | Converts backlog ticket into goal, user story, acceptance criteria, and product clarifications. | `spec` |
| Planning Agent | Converts the spec into implementation tasks, risks, and dependencies. | `plan` |
| QA Agent | Generates scenario coverage and automated check names. | `tests` |
| Review Agent | Scores readiness, approves, or requests revisions. | `review` |

There is no god agent. The simulator orchestrator owns deterministic state transitions, but each agent owns a narrow artifact surface.

## State Machine

States:

- `BACKLOG`
- `SPEC_DRAFTING`
- `PLANNING`
- `TEST_DESIGN`
- `REVIEW`
- `REVISION`
- `DONE`
- `STOPPED`

Transition logic is explicit in `src/simulator.js`. Each transition records:

- index
- timestamp
- source state
- target state
- reason

The standard lifecycle is:

`BACKLOG -> SPEC_DRAFTING -> PLANNING -> TEST_DESIGN -> REVIEW -> DONE`

When the reviewer finds weak coverage, sparse planning, or unresolved questions, the lifecycle becomes:

`REVIEW -> REVISION -> SPEC_DRAFTING -> PLANNING -> TEST_DESIGN -> REVIEW`

## Structured Agent Protocol

Every invocation creates a JSON message:

```json
{
  "protocol": "startup-sprint.v1",
  "runId": "run-42-20260416040000",
  "timestamp": "2026-04-16T04:00:45.000Z",
  "state": "SPEC_DRAFTING",
  "agent": {
    "id": "product",
    "name": "Product Agent",
    "role": "Clarifies sprint intent and acceptance criteria"
  },
  "input": {},
  "output": {}
}
```

## State Management

The `SprintSimulator` class is the single domain state container. React stores the latest immutable snapshot and renders it into panels. The simulator stores:

- current state
- active agent
- run ID and seed
- ticket status
- transition history
- agent invocation log
- versioned artifacts
- metrics

The Vite + React UI renders immutable snapshots returned by the simulator.

## Artifact Versioning

Artifacts are plain JSON objects with monotonically increasing `version` fields:

- `spec`
- `plan`
- `tests`
- `review`

Revision loops create new versions of the affected artifacts before the ticket returns to review.

## Observability

The React UI includes:

- agent panel with active role highlight
- state panel with current state and transition history
- interaction panel with timestamped JSON messages
- metrics dashboard
- run controls for start, stop, reset, seed, and replay

## Reproducibility

The simulator uses a seeded linear congruential generator. Given the same seed and the same simulator version, the run is reproducible. The tests verify fixed-seed determinism.
