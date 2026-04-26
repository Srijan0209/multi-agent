# Evaluation Report

## Method

The simulator was evaluated with deterministic seeds and ten named test scenarios. Each run compares the multi-agent process with a naive single-agent baseline that creates fewer criteria, fewer tasks, and fewer QA scenarios.

## Quantitative Metrics

| Metric | Meaning |
| --- | --- |
| Review score | Weighted readiness score from spec completeness, plan depth, test coverage, and risk handling. |
| Coverage | Number of QA scenarios generated. |
| Artifact versions | Total versions across spec, plan, tests, and review. |
| Transitions | Number of logged state transitions. |
| Agent invocations | Number of structured agent messages. |
| Improvement | Review score delta versus naive baseline. |

## Baseline

The baseline represents a single-agent or naive workflow:

- 1 combined agent
- 2 acceptance criteria
- 3 implementation tasks
- 3 test scenarios
- no revision loop

This intentionally mirrors a rushed chatbot-like response and is expected to underperform the role-separated workflow.

## Scenario Coverage

The project includes these scenarios in `data/scenarios.json`:

1. happy path ticket reaches done
2. review requests revision when tests are weak
3. review requests revision when plan is sparse
4. fixed seed replays identical transitions
5. stop freezes state without done
6. reset clears logs and versions
7. artifact versions increase monotonically
8. baseline has lower review score
9. message protocol contains run, agent, state, input, and output
10. transition history records source, target, and reason

## Results

Expected deterministic results for seed `42`:

| Output | Value |
| --- | --- |
| Final state | `DONE` |
| Minimum review loops | `1` |
| Minimum coverage after revision | `8` |
| Final review decision | `approve` |
| Review score improvement | positive delta over baseline |

## Reproducibility

Run:

```bash
npm install
npm test
```

The test runner executes seeded simulations and validates state transitions, artifact versioning, protocol shape, review loop tracking, and baseline comparison.
