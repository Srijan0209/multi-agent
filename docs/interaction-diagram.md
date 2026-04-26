# Agent Interaction Diagram

```mermaid
sequenceDiagram
  participant O as Orchestrator
  participant P as Product Agent
  participant L as Planning Agent
  participant Q as QA Agent
  participant R as Review Agent

  O->>O: BACKLOG
  O->>P: Pull ticket and draft spec
  P-->>O: spec v1
  O->>O: SPEC_DRAFTING -> PLANNING
  O->>L: Convert spec into implementation plan
  L-->>O: plan v1
  O->>O: PLANNING -> TEST_DESIGN
  O->>Q: Generate test scenarios
  Q-->>O: tests v1
  O->>O: TEST_DESIGN -> REVIEW
  O->>R: Score artifacts and decide
  alt revision needed
    R-->>O: review v1, decision revise
    O->>O: REVIEW -> REVISION
    O->>P: Resolve product findings
    P-->>O: spec v2
    O->>L: Update plan for findings
    L-->>O: plan v2
    O->>Q: Regenerate expanded tests
    Q-->>O: tests v2
    O->>R: Re-score revised artifacts
    R-->>O: review v2, decision approve
  else approved
    R-->>O: review v1, decision approve
  end
  O->>O: REVIEW -> DONE
```

## Message Flow

1. The orchestrator advances only when the current state allows the next role.
2. The active agent receives a structured input payload.
3. The agent returns a structured output payload.
4. The orchestrator records the invocation, versions artifacts, computes metrics, and logs the transition.
