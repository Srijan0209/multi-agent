export const STATES = Object.freeze({
  BACKLOG: "BACKLOG",
  SPEC_DRAFTING: "SPEC_DRAFTING",
  PLANNING: "PLANNING",
  TEST_DESIGN: "TEST_DESIGN",
  REVIEW: "REVIEW",
  REVISION: "REVISION",
  DONE: "DONE",
  STOPPED: "STOPPED"
});

export const AGENTS = Object.freeze([
  {
    id: "product",
    name: "Product Agent",
    role: "Clarifies sprint intent and acceptance criteria",
    color: "#276ef1"
  },
  {
    id: "planner",
    name: "Planning Agent",
    role: "Breaks the ticket into implementation tasks",
    color: "#0f8b6f"
  },
  {
    id: "qa",
    name: "QA Agent",
    role: "Creates deterministic scenario coverage",
    color: "#b05f00"
  },
  {
    id: "reviewer",
    name: "Review Agent",
    role: "Scores readiness and requests revisions",
    color: "#8c4ac9"
  }
]);

const agentById = Object.fromEntries(AGENTS.map((agent) => [agent.id, agent]));

export const TEST_SCENARIOS = Object.freeze([
  "happy_path_ticket_reaches_done",
  "review_requests_revision_when_tests_are_weak",
  "review_requests_revision_when_plan_is_sparse",
  "fixed_seed_replays_identical_transitions",
  "stop_freezes_state_without_done",
  "reset_clears_logs_and_versions",
  "artifact_versions_increase_monotonically",
  "baseline_has_lower_review_score",
  "message_protocol_contains_run_agent_state_payload",
  "transition_history_records_from_to_reason"
]);

function createRng(seed) {
  let state = Number(seed) % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createRunId(seed) {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  return `run-${seed}-${stamp}`;
}

function scoreArtifacts(artifacts) {
  const specScore = Math.min(1, artifacts.spec.acceptanceCriteria.length / 4);
  const planScore = Math.min(1, artifacts.plan.tasks.length / 5);
  const testScore = Math.min(1, artifacts.tests.scenarios.length / 8);
  const riskScore = artifacts.plan.risks.length > 0 ? 1 : 0.55;
  return Number(((specScore * 0.3 + planScore * 0.25 + testScore * 0.3 + riskScore * 0.15) * 100).toFixed(1));
}

export class SprintSimulator {
  constructor({ seed = 42 } = {}) {
    this.seed = Number(seed) || 42;
    this.rng = createRng(this.seed);
    this.reset(this.seed);
  }

  reset(seed = this.seed) {
    this.seed = Number(seed) || 42;
    this.rng = createRng(this.seed);
    this.runId = createRunId(this.seed);
    this.state = STATES.BACKLOG;
    this.activeAgent = null;
    this.currentStep = 0;
    this.reviewLoops = 0;
    this.stopped = false;
    this.ticket = {
      id: `TICKET-${100 + (this.seed % 800)}`,
      title: "Launch founder waitlist onboarding",
      status: "Backlog",
      priority: "High"
    };
    this.artifacts = {
      spec: {
        version: 0,
        goal: "",
        userStory: "",
        acceptanceCriteria: [],
        openQuestions: []
      },
      plan: {
        version: 0,
        tasks: [],
        risks: [],
        dependencies: []
      },
      tests: {
        version: 0,
        scenarios: [],
        automatedChecks: []
      },
      review: {
        version: 0,
        score: 0,
        decision: "pending",
        findings: []
      }
    };
    this.transitions = [
      {
        index: 0,
        at: this.timestamp(),
        from: null,
        to: STATES.BACKLOG,
        reason: "Ticket seeded into backlog"
      }
    ];
    this.messages = [];
    this.invocations = [];
    this.metrics = this.computeMetrics();
    return this.snapshot();
  }

  timestamp() {
    const base = Date.UTC(2026, 3, 16, 4, 0, 0);
    return new Date(base + this.currentStep * 45000).toISOString();
  }

  transition(to, reason) {
    const from = this.state;
    this.state = to;
    this.transitions.push({
      index: this.transitions.length,
      at: this.timestamp(),
      from,
      to,
      reason
    });
  }

  invoke(agentId, input, output) {
    const agent = agentById[agentId];
    const message = {
      protocol: "startup-sprint.v1",
      runId: this.runId,
      timestamp: this.timestamp(),
      state: this.state,
      agent: {
        id: agent.id,
        name: agent.name,
        role: agent.role
      },
      input,
      output
    };
    this.activeAgent = agentId;
    this.invocations.push(message);
    this.messages.push(message);
    return message;
  }

  versionArtifact(name, patch) {
    this.artifacts[name] = {
      ...this.artifacts[name],
      ...patch,
      version: this.artifacts[name].version + 1,
      updatedAt: this.timestamp()
    };
  }

  computeBaseline() {
    const naiveSpec = 2;
    const naivePlan = 3;
    const naiveTests = 3;
    const readiness = Number(((naiveSpec / 4) * 30 + (naivePlan / 5) * 25 + (naiveTests / 8) * 30 + 8).toFixed(1));
    return {
      agents: 1,
      reviewScore: readiness,
      coverage: naiveTests,
      transitions: 4,
      revisions: 0
    };
  }

  computeMetrics() {
    const baseline = this.computeBaseline();
    const reviewScore = scoreArtifacts(this.artifacts);
    const coverage = this.artifacts.tests.scenarios.length;
    const artifactVersions = Object.values(this.artifacts).reduce((sum, artifact) => sum + artifact.version, 0);
    return {
      reviewScore,
      coverage,
      artifactVersions,
      transitions: this.transitions.length,
      revisions: this.reviewLoops,
      agentInvocations: this.invocations.length,
      baseline,
      improvement: Number((reviewScore - baseline.reviewScore).toFixed(1))
    };
  }

  step() {
    if (this.stopped || this.state === STATES.DONE) return this.snapshot();
    this.currentStep += 1;

    if (this.state === STATES.BACKLOG) {
      this.transition(STATES.SPEC_DRAFTING, "Product agent pulls ticket from backlog");
      this.ticket.status = "Spec drafting";
      this.versionArtifact("spec", {
        goal: "Convert interested founders into a qualified beta waitlist.",
        userStory: "As a founder, I want to join the beta with company context so the startup team can prioritize access.",
        acceptanceCriteria: [
          "Capture name, email, company stage, and main workflow pain",
          "Validate business email format before submission",
          "Show confirmation with next-step expectation",
          this.rng() > 0.42 ? "Persist source attribution for growth analysis" : "Ask product to confirm analytics requirements"
        ],
        openQuestions: this.rng() > 0.55 ? [] : ["Should the first beta cohort be capped by company stage?"]
      });
      this.invoke("product", { ticket: this.ticket }, { artifact: "spec", version: this.artifacts.spec.version, status: "drafted" });
    } else if (this.state === STATES.SPEC_DRAFTING) {
      this.transition(STATES.PLANNING, "Spec has enough acceptance criteria for task planning");
      this.ticket.status = "Planning";
      this.versionArtifact("plan", {
        tasks: [
          "Create waitlist form model and validation",
          "Build responsive onboarding form",
          "Add confirmation state and event logging",
          "Wire local persistence adapter",
          this.rng() > 0.35 ? "Add admin export for founder submissions" : "Defer admin export until analytics question is resolved"
        ],
        risks: this.artifacts.spec.openQuestions.length
          ? ["Open cohort policy can affect validation copy"]
          : ["Duplicate submissions may skew acquisition metrics"],
        dependencies: ["Product copy", "Analytics event schema"]
      });
      this.invoke("planner", { specVersion: this.artifacts.spec.version }, { artifact: "plan", version: this.artifacts.plan.version, tasks: this.artifacts.plan.tasks.length });
    } else if (this.state === STATES.PLANNING) {
      this.transition(STATES.TEST_DESIGN, "Plan is ready for QA scenario generation");
      this.ticket.status = "Test design";
      const minimumScenarios = this.seed % 2 === 0 && this.reviewLoops === 0 ? 5 : 8;
      this.versionArtifact("tests", {
        scenarios: TEST_SCENARIOS.slice(0, minimumScenarios),
        automatedChecks: [
          "schema_validation_for_agent_messages",
          "state_transition_determinism",
          "artifact_version_monotonicity",
          "baseline_metric_comparison"
        ]
      });
      this.invoke("qa", { planVersion: this.artifacts.plan.version }, { artifact: "tests", version: this.artifacts.tests.version, scenarios: this.artifacts.tests.scenarios.length });
    } else if (this.state === STATES.TEST_DESIGN) {
      this.transition(STATES.REVIEW, "Reviewer evaluates spec, plan, tests, and metrics");
      this.ticket.status = "Review";
      const score = scoreArtifacts(this.artifacts);
      const findings = [];
      if (this.artifacts.tests.scenarios.length < 8) findings.push("Increase QA scenario coverage to at least 8 cases.");
      if (this.artifacts.plan.tasks.length < 5) findings.push("Plan needs complete implementation and validation tasks.");
      if (this.artifacts.spec.openQuestions.length > 0) findings.push("Resolve open product question before done.");
      const decision = score >= 82 && findings.length === 0 ? "approve" : "revise";
      this.versionArtifact("review", { score, decision, findings });
      this.invoke("reviewer", { artifactVersions: this.artifactVersions() }, { artifact: "review", decision, score, findings });
    } else if (this.state === STATES.REVIEW) {
      if (this.artifacts.review.decision === "approve") {
        this.transition(STATES.DONE, "Reviewer approved ticket for done");
        this.ticket.status = "Done";
        this.activeAgent = null;
      } else {
        this.reviewLoops += 1;
        this.transition(STATES.REVISION, "Reviewer requested revisions");
        this.ticket.status = "Revision";
      }
    } else if (this.state === STATES.REVISION) {
      this.transition(STATES.SPEC_DRAFTING, "Agents apply reviewer feedback and create new artifact versions");
      this.ticket.status = "Spec revision";
      this.versionArtifact("spec", {
        acceptanceCriteria: [
          ...new Set([
            ...this.artifacts.spec.acceptanceCriteria.filter((item) => !item.startsWith("Ask product")),
            "Persist source attribution for growth analysis",
            "Prevent duplicate submissions for the same email"
          ])
        ],
        openQuestions: []
      });
      this.versionArtifact("plan", {
        tasks: [
          ...new Set([
            ...this.artifacts.plan.tasks.filter((item) => !item.startsWith("Defer")),
            "Add admin export for founder submissions",
            "Add duplicate submission guard"
          ])
        ],
        risks: ["Duplicate submissions may skew acquisition metrics"],
        dependencies: ["Product copy", "Analytics event schema"]
      });
      this.invoke("product", { findings: this.artifacts.review.findings }, { artifact: "spec", version: this.artifacts.spec.version, status: "revised" });
      this.invoke("planner", { findings: this.artifacts.review.findings }, { artifact: "plan", version: this.artifacts.plan.version, status: "revised" });
    }

    this.metrics = this.computeMetrics();
    return this.snapshot();
  }

  runToCompletion(maxSteps = 20) {
    let guard = 0;
    while (this.state !== STATES.DONE && !this.stopped && guard < maxSteps) {
      this.step();
      guard += 1;
    }
    return this.snapshot();
  }

  stop() {
    if (this.state !== STATES.DONE) {
      this.stopped = true;
      this.transition(STATES.STOPPED, "User stopped the run");
      this.ticket.status = "Stopped";
      this.activeAgent = null;
      this.metrics = this.computeMetrics();
    }
    return this.snapshot();
  }

  artifactVersions() {
    return Object.fromEntries(Object.entries(this.artifacts).map(([key, value]) => [key, value.version]));
  }

  snapshot() {
    return clone({
      runId: this.runId,
      seed: this.seed,
      state: this.state,
      activeAgent: this.activeAgent,
      ticket: this.ticket,
      artifacts: this.artifacts,
      transitions: this.transitions,
      messages: this.messages,
      invocations: this.invocations,
      metrics: this.metrics,
      agents: AGENTS
    });
  }
}
