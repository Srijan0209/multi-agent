import { StrictMode, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { AGENTS, SprintSimulator, STATES } from "./simulator.js";
import "./styles.css";

const ARTIFACTS = ["spec", "plan", "tests", "review"];

function formatState(state) {
  return state.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatTime(value) {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function MetricCard({ label, value, footnote }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{footnote}</p>
    </article>
  );
}

function App() {
  const [seed, setSeed] = useState(42);
  const simulatorRef = useRef(new SprintSimulator({ seed: 42 }));
  const timerRef = useRef(null);
  const replayFramesRef = useRef([simulatorRef.current.snapshot()]);
  const [snapshot, setSnapshot] = useState(replayFramesRef.current[0]);
  const [selectedArtifact, setSelectedArtifact] = useState("spec");

  const activeAgent = useMemo(
    () => AGENTS.find((agent) => agent.id === snapshot.activeAgent),
    [snapshot.activeAgent]
  );

  const selectedArtifactData = snapshot.artifacts[selectedArtifact];

  useEffect(() => {
    document.body.dataset.state = snapshot.state;
  }, [snapshot.state]);

  useEffect(() => {
    return () => window.clearInterval(timerRef.current);
  }, []);

  function clearTimer() {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
  }

  function startRun() {
    clearTimer();
    timerRef.current = window.setInterval(() => {
      const nextSnapshot = simulatorRef.current.step();
      replayFramesRef.current = [...replayFramesRef.current, nextSnapshot];
      setSnapshot(nextSnapshot);
      if (nextSnapshot.state === STATES.DONE || nextSnapshot.state === STATES.STOPPED) clearTimer();
    }, 650);
  }

  function resetRun(nextSeed = seed) {
    clearTimer();
    simulatorRef.current = new SprintSimulator({ seed: Number(nextSeed) });
    const nextSnapshot = simulatorRef.current.snapshot();
    replayFramesRef.current = [nextSnapshot];
    setSnapshot(nextSnapshot);
  }

  function stopRun() {
    clearTimer();
    setSnapshot(simulatorRef.current.stop());
  }

  function replayRun() {
    clearTimer();
    let index = 0;
    const frames = replayFramesRef.current.length > 0 ? replayFramesRef.current : [simulatorRef.current.snapshot()];
    timerRef.current = window.setInterval(() => {
      setSnapshot(frames[index]);
      index += 1;
      if (index >= frames.length) clearTimer();
    }, 500);
  }

  function handleSeedChange(event) {
    const nextSeed = Number(event.target.value);
    setSeed(nextSeed);
    resetRun(nextSeed);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Multi-Agent Systems Demo</p>
          <h1>Startup Sprint Simulator</h1>
        </div>
        <section className="run-card" aria-label="Run controls">
          <label className="seed-field">
            <span>Seed</span>
            <input type="number" value={seed} min="1" max="999999" onChange={handleSeedChange} />
          </label>
          <button type="button" onClick={startRun}>Start</button>
          <button type="button" className="secondary" onClick={stopRun}>Stop</button>
          <button type="button" className="secondary" onClick={() => resetRun(seed)}>Reset</button>
          <button type="button" className="ghost" onClick={replayRun}>Replay</button>
        </section>
      </header>

      <section className="status-strip" aria-label="Current run summary">
        <div>
          <span>Run ID</span>
          <strong>{snapshot.runId}</strong>
        </div>
        <div>
          <span>Current State</span>
          <strong>{formatState(snapshot.state)}</strong>
        </div>
        <div>
          <span>Ticket</span>
          <strong>{snapshot.ticket.status}</strong>
        </div>
        <div>
          <span>Review Loops</span>
          <strong>{snapshot.metrics.revisions}</strong>
        </div>
      </section>

      <section className="workspace-grid">
        <aside className="panel agent-panel">
          <div className="panel-heading">
            <h2>Agents</h2>
            <span>{activeAgent ? activeAgent.name : "Idle"}</span>
          </div>
          <div className="agent-list">
            {AGENTS.map((agent) => (
              <article
                className={`agent-card ${snapshot.activeAgent === agent.id ? "active" : ""}`}
                style={{ "--agent-color": agent.color }}
                key={agent.id}
              >
                <div className="agent-dot" />
                <div>
                  <h3>{agent.name}</h3>
                  <p>{agent.role}</p>
                </div>
              </article>
            ))}
          </div>
        </aside>

        <section className="panel state-panel">
          <div className="panel-heading">
            <h2>State Machine</h2>
            <span>Transitions</span>
          </div>
          <div className="state-timeline">
            {snapshot.transitions.map((transition) => (
              <article className="transition-item" key={transition.index}>
                <div className="transition-index">{transition.index}</div>
                <div>
                  <strong>
                    {transition.from ? formatState(transition.from) : "Start"} -&gt; {formatState(transition.to)}
                  </strong>
                  <p>{transition.reason}</p>
                  <time>{formatTime(transition.at)}</time>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="panel metrics-panel">
          <div className="panel-heading">
            <h2>Metrics</h2>
            <span>Multi-agent vs baseline</span>
          </div>
          <div className="metrics-grid">
            <MetricCard label="Review Score" value={`${snapshot.metrics.reviewScore}%`} footnote={`Baseline ${snapshot.metrics.baseline.reviewScore}%`} />
            <MetricCard label="Coverage" value={snapshot.metrics.coverage} footnote={`Baseline ${snapshot.metrics.baseline.coverage}`} />
            <MetricCard label="Artifact Versions" value={snapshot.metrics.artifactVersions} footnote="Spec + plan + tests + review" />
            <MetricCard label="Transitions" value={snapshot.metrics.transitions} footnote="Logged deterministic moves" />
            <MetricCard label="Agent Calls" value={snapshot.metrics.agentInvocations} footnote="Every input/output captured" />
            <MetricCard label="Improvement" value={`${snapshot.metrics.improvement >= 0 ? "+" : ""}${snapshot.metrics.improvement}`} footnote="Readiness delta vs naive" />
          </div>
        </section>

        <section className="panel interaction-panel">
          <div className="panel-heading">
            <h2>Interaction Log</h2>
            <span>{snapshot.messages.length} messages</span>
          </div>
          <div className="message-log">
            {snapshot.messages.slice().reverse().map((message, index) => (
              <article className="message-card" key={`${message.timestamp}-${message.agent.id}-${index}`}>
                <div className="message-meta">
                  <strong>{message.agent.name}</strong>
                  <span>{formatState(message.state)}</span>
                  <time>{formatTime(message.timestamp)}</time>
                </div>
                <pre>
                  {JSON.stringify({
                    protocol: message.protocol,
                    runId: message.runId,
                    input: message.input,
                    output: message.output
                  }, null, 2)}
                </pre>
              </article>
            ))}
          </div>
        </section>

        <section className="panel artifact-panel">
          <div className="panel-heading">
            <h2>Artifact Evolution</h2>
            <span>{selectedArtifact} v{selectedArtifactData.version}</span>
          </div>
          <div className="artifact-tabs" role="tablist" aria-label="Artifact tabs">
            {ARTIFACTS.map((artifact) => (
              <button
                className={`tab ${selectedArtifact === artifact ? "active" : ""}`}
                type="button"
                onClick={() => setSelectedArtifact(artifact)}
                key={artifact}
              >
                {artifact[0].toUpperCase() + artifact.slice(1)}
              </button>
            ))}
          </div>
          <pre className="artifact-view">{JSON.stringify(selectedArtifactData, null, 2)}</pre>
        </section>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
