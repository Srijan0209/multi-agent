import assert from "node:assert/strict";
import scenarios from "../data/scenarios.json" with { type: "json" };
import { SprintSimulator, STATES } from "../src/simulator.js";

function run(seed) {
  const simulator = new SprintSimulator({ seed });
  return simulator.runToCompletion();
}

function transitionSignature(snapshot) {
  return snapshot.transitions.map((transition) => ({
    from: transition.from,
    to: transition.to,
    reason: transition.reason
  }));
}

function versions(snapshot) {
  return Object.fromEntries(Object.entries(snapshot.artifacts).map(([key, artifact]) => [key, artifact.version]));
}

const tests = {
  happy_path_ticket_reaches_done({ seed }) {
    const snapshot = run(seed);
    assert.equal(snapshot.state, STATES.DONE);
    assert.equal(snapshot.ticket.status, "Done");
  },

  review_requests_revision_when_tests_are_weak({ seed }) {
    const snapshot = run(seed);
    assert.ok(snapshot.metrics.revisions >= 1);
    assert.ok(snapshot.transitions.some((transition) => transition.to === STATES.REVISION));
  },

  review_requests_revision_when_plan_is_sparse({ seed }) {
    const simulator = new SprintSimulator({ seed });
    let sawRevise = false;
    for (let index = 0; index < 8; index += 1) {
      const snapshot = simulator.step();
      if (snapshot.artifacts.review.decision === "revise") sawRevise = true;
    }
    assert.equal(sawRevise, true);
  },

  fixed_seed_replays_identical_transitions({ seed }) {
    const first = run(seed);
    const second = run(seed);
    assert.deepEqual(transitionSignature(first), transitionSignature(second));
    assert.deepEqual(first.artifacts, second.artifacts);
  },

  stop_freezes_state_without_done({ seed }) {
    const simulator = new SprintSimulator({ seed });
    simulator.step();
    const snapshot = simulator.stop();
    assert.equal(snapshot.state, STATES.STOPPED);
    assert.notEqual(snapshot.ticket.status, "Done");
  },

  reset_clears_logs_and_versions({ seed }) {
    const simulator = new SprintSimulator({ seed });
    simulator.runToCompletion();
    const snapshot = simulator.reset(seed);
    assert.equal(snapshot.messages.length, 0);
    assert.deepEqual(versions(snapshot), { spec: 0, plan: 0, tests: 0, review: 0 });
  },

  artifact_versions_increase_monotonically({ seed }) {
    const simulator = new SprintSimulator({ seed });
    const history = [versions(simulator.snapshot())];
    for (let index = 0; index < 12; index += 1) {
      const snapshot = simulator.step();
      history.push(versions(snapshot));
      if (snapshot.state === STATES.DONE) break;
    }
    for (let index = 1; index < history.length; index += 1) {
      for (const key of Object.keys(history[index])) {
        assert.ok(history[index][key] >= history[index - 1][key], `${key} regressed at step ${index}`);
      }
    }
  },

  baseline_has_lower_review_score({ seed }) {
    const snapshot = run(seed);
    assert.ok(snapshot.metrics.improvement > 0);
    assert.ok(snapshot.metrics.reviewScore > snapshot.metrics.baseline.reviewScore);
  },

  message_protocol_contains_run_agent_state_payload({ seed }) {
    const snapshot = run(seed);
    assert.ok(snapshot.messages.length >= 4);
    for (const message of snapshot.messages) {
      assert.equal(message.protocol, "startup-sprint.v1");
      assert.equal(message.runId, snapshot.runId);
      assert.ok(message.agent.id);
      assert.ok(message.state);
      assert.ok(Object.hasOwn(message, "input"));
      assert.ok(Object.hasOwn(message, "output"));
    }
  },

  transition_history_records_from_to_reason({ seed }) {
    const snapshot = run(seed);
    assert.ok(snapshot.transitions.length >= 5);
    for (const transition of snapshot.transitions.slice(1)) {
      assert.ok(Object.hasOwn(transition, "from"));
      assert.ok(Object.hasOwn(transition, "to"));
      assert.ok(transition.reason.length > 0);
    }
  }
};

let passed = 0;

for (const scenario of scenarios) {
  const test = tests[scenario.id];
  assert.ok(test, `Missing test for ${scenario.id}`);
  test(scenario);
  passed += 1;
  console.log(`PASS ${scenario.id}`);
}

console.log(`\n${passed}/${scenarios.length} scenarios passed`);
