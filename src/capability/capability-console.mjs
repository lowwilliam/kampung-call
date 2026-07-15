import {
  catalogue, createSession, getCurrentStep, chooseOption, useHint, createReport,
} from "./index.mjs";

const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#039;");

export function scenarioOptionsForDistrict(districtId, data = catalogue) {
  return data.scenarios.filter((scenario) => scenario.districtId === districtId);
}

export function availableRoles(scenarioId, data = catalogue) {
  const scenario = data.scenarios.find(({ id }) => id === scenarioId);
  return scenario ? scenario.roles.map((id) => data.roleModes[id]).filter(Boolean) : [];
}

export function formatScoreLabel(score) {
  if (score >= 85) return "Proficient";
  if (score >= 70) return "Capable";
  return "Development required";
}

const BaseElement = globalThis.HTMLElement ?? class {};

export class CapabilityConsole extends BaseElement {
  constructor() {
    super();
    this._open = false;
    this._session = null;
    this._report = null;
    this._message = "";
    this._districtId = this.getAttribute?.("district-id") || catalogue.districts[0].id;
    this._scenarioId = this.getAttribute?.("scenario-id") || scenarioOptionsForDistrict(this._districtId)[0]?.id;
    this._roleId = "fieldEngineer";
    this._difficultyId = "standard";
    this.attachShadow?.({ mode: "open" });
  }

  connectedCallback() {
    if (!this.shadowRoot) return;
    const requestedDistrict = this.getAttribute("district-id");
    if (catalogue.districts.some(({ id }) => id === requestedDistrict)) this._districtId = requestedDistrict;
    const requestedScenario = this.getAttribute("scenario-id");
    if (scenarioOptionsForDistrict(this._districtId).some(({ id }) => id === requestedScenario)) this._scenarioId = requestedScenario;
    this.render();
    this.shadowRoot.addEventListener("click", (event) => this._handleClick(event));
    this.shadowRoot.addEventListener("change", (event) => this._handleChange(event));
    this.shadowRoot.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && this._open) {
        this._open = false;
        this.render();
        this.shadowRoot.querySelector(".launcher")?.focus();
      }
    });
  }

  _handleClick(event) {
    const action = event.target.closest?.("[data-action]")?.dataset.action;
    if (!action) return;
    if (action === "toggle") {
      this._open = !this._open;
      this.render();
      if (this._open) queueMicrotask(() => this.shadowRoot.querySelector(".close")?.focus());
    } else if (action === "start") {
      try {
        this._session = createSession({ scenarioId: this._scenarioId, roleId: this._roleId, difficultyId: this._difficultyId });
        this._report = null;
        this._message = "Scenario started.";
      } catch (error) {
        this._message = error.message;
      }
      this.render();
    } else if (action === "choose") {
      this._session = chooseOption(this._session, event.target.closest("button").dataset.optionId);
      this._message = this._session.completedAt ? "Scenario complete." : "Decision recorded.";
      if (this._session.completedAt) this._report = createReport(this._session);
      this.render();
    } else if (action === "hint") {
      try {
        this._session = useHint(this._session);
        const scenario = catalogue.scenarios.find(({ id }) => id === this._session.scenarioId);
        const evidence = scenario.evidence[this._session.hintsUsed - 1] ?? scenario.evidence.at(-1);
        this._message = `Hint: focus on this evidence — ${evidence}`;
      } catch (error) {
        this._message = error.message;
      }
      this.render();
    } else if (action === "restart") {
      this._session = null;
      this._report = null;
      this._message = "Ready for another scenario.";
      this.render();
    }
  }

  _handleChange(event) {
    const field = event.target.dataset.field;
    if (field === "district") {
      this._districtId = event.target.value;
      this._scenarioId = scenarioOptionsForDistrict(this._districtId)[0]?.id;
      this._roleId = availableRoles(this._scenarioId)[0]?.id;
    } else if (field === "scenario") {
      this._scenarioId = event.target.value;
      if (!availableRoles(this._scenarioId).some(({ id }) => id === this._roleId)) {
        this._roleId = availableRoles(this._scenarioId)[0]?.id;
      }
    } else if (field === "role") this._roleId = event.target.value;
    else if (field === "difficulty") this._difficultyId = event.target.value;
    this.render();
  }

  render() {
    const body = this._report ? this._renderReport() : this._session ? this._renderScenario() : this._renderSetup();
    this.shadowRoot.innerHTML = `
      <style>${styles}</style>
      <button class="launcher" data-action="toggle" aria-expanded="${this._open}" aria-controls="capability-panel">
        <span aria-hidden="true">◎</span><span>Missions</span>
      </button>
      ${this._open ? `<section id="capability-panel" class="panel" role="dialog" aria-modal="false" aria-labelledby="capability-title">
        <header><div><span class="eyebrow">Challenge board</span><h2 id="capability-title">Bonus Missions</h2></div>
        <button class="icon close" data-action="toggle" aria-label="Close missions panel">×</button></header>
        <main>${body}</main>
        <p class="status" role="status" aria-live="polite">${escapeHtml(this._message)}</p>
      </section>` : ""}`;
  }

  _renderSetup() {
    const scenarios = scenarioOptionsForDistrict(this._districtId);
    if (!scenarios.some(({ id }) => id === this._scenarioId)) this._scenarioId = scenarios[0]?.id;
    const scenario = catalogue.scenarios.find(({ id }) => id === this._scenarioId);
    const roles = availableRoles(this._scenarioId);
    if (!roles.some(({ id }) => id === this._roleId)) this._roleId = roles[0]?.id;
    return `<div class="intro"><p>Take on an evidence-led island challenge and see how you did.</p></div>
      <div class="fields">
        <label>District<select data-field="district">${catalogue.districts.map((item) => `<option value="${item.id}" ${item.id === this._districtId ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}</select></label>
        <label>Scenario<select data-field="scenario">${scenarios.map((item) => `<option value="${item.id}" ${item.id === this._scenarioId ? "selected" : ""}>${escapeHtml(item.title)}</option>`).join("")}</select></label>
        <div class="split">
          <label>Role<select data-field="role">${roles.map((item) => `<option value="${item.id}" ${item.id === this._roleId ? "selected" : ""}>${escapeHtml(item.label)}</option>`).join("")}</select></label>
          <label>Mode<select data-field="difficulty">${Object.values(catalogue.difficultyModes).map((item) => `<option value="${item.id}" ${item.id === this._difficultyId ? "selected" : ""}>${escapeHtml(item.label)}</option>`).join("")}</select></label>
        </div>
      </div>
      ${scenario ? `<article class="brief"><div class="meta"><span>Difficulty ${scenario.difficulty}/5</span><span>~${scenario.estimatedMinutes} min</span></div><p>${escapeHtml(scenario.briefing)}</p></article>` : ""}
      <button class="primary" data-action="start" ${scenario ? "" : "disabled"}>Start scenario</button>`;
  }

  _renderScenario() {
    const scenario = catalogue.scenarios.find(({ id }) => id === this._session.scenarioId);
    const step = getCurrentStep(this._session);
    const allowance = catalogue.difficultyModes[this._session.difficultyId].hintCount;
    const progress = Math.min(100, Math.round((this._session.decisions.length / scenario.steps.length) * 100));
    return `<div class="meta"><span>${escapeHtml(catalogue.districts.find(({ id }) => id === scenario.districtId).name)}</span><span>${this._session.decisions.length}/${scenario.steps.length}</span></div>
      <h3>${escapeHtml(scenario.title)}</h3>
      <div class="progress" role="progressbar" aria-label="Scenario progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}"><i style="width:${progress}%"></i></div>
      <article class="brief"><span class="eyebrow">Situation</span><p>${escapeHtml(scenario.briefing)}</p></article>
      <fieldset><legend>${escapeHtml(step.prompt)}</legend><div class="choices">${step.options.map((item, index) => `<button data-action="choose" data-option-id="${item.id}"><b>${index + 1}</b><span>${escapeHtml(item.label)}</span></button>`).join("")}</div></fieldset>
      <button class="secondary" data-action="hint" ${this._session.hintsUsed >= allowance ? "disabled" : ""}>Use hint <span>${Math.max(0, allowance - this._session.hintsUsed)} left</span></button>`;
  }

  _renderReport() {
    const { score } = this._report;
    const assessed = Object.entries(score.dimensions).filter(([, value]) => value.assessed);
    return `<div class="result ${score.passed ? "pass" : "develop"}"><div class="score"><strong>${score.overall}</strong><span>/100</span></div><div><span class="eyebrow">${score.passed ? "Scenario passed" : "Further practice"}</span><h3>${formatScoreLabel(score.overall)}</h3><p>${escapeHtml(this._report.outcome.replaceAll("-", " "))}</p></div></div>
      <h4>Competency profile</h4><div class="dimensions">${assessed.map(([id, item]) => {
        const name = catalogue.competencies.find((entry) => entry.id === id).name;
        return `<div><span>${escapeHtml(name)}</span><b>${item.percentage}%</b><i><em style="width:${item.percentage}%"></em></i></div>`;
      }).join("")}</div>
      <div class="report-meta"><span>${this._report.decisions.length} decisions</span><span>${this._report.timing.durationSeconds}s elapsed</span><span>${score.hintPenalty} hint penalty</span></div>
      <button class="primary" data-action="restart">Choose another scenario</button>`;
  }
}

const styles = `
  :host{position:fixed;right:18px;bottom:18px;z-index:9000;font:14px/1.45 Inter,ui-sans-serif,system-ui,-apple-system,sans-serif;color:#eaf8f3;pointer-events:none;color-scheme:dark}
  *{box-sizing:border-box}.launcher,.panel{pointer-events:auto}.launcher{height:48px;padding:0 18px;border:1px solid #68e0b4;border-radius:24px;background:#083b36;color:#f3fffa;box-shadow:0 8px 26px #001b18aa;display:flex;align-items:center;gap:9px;font:700 14px inherit;cursor:pointer}.launcher span:first-child{font-size:22px;color:#7dffd0}.launcher:focus-visible,button:focus-visible,select:focus-visible{outline:3px solid #ffd166;outline-offset:2px}
  .panel{position:absolute;right:0;bottom:60px;width:min(390px,calc(100vw - 24px));max-height:min(680px,calc(100vh - 90px));overflow:auto;border:1px solid #ffffff26;border-radius:20px;background:linear-gradient(160deg,#0c2f30 0%,#071e26 100%);box-shadow:0 22px 70px #001412dd}
  header{position:sticky;top:0;z-index:1;padding:19px 20px 15px;display:flex;justify-content:space-between;align-items:start;background:#0b292bea;border-bottom:1px solid #ffffff16;backdrop-filter:blur(12px)}h2,h3,h4,p{margin:0}h2{font-size:20px;letter-spacing:-.02em}.eyebrow{display:block;color:#79e9bd;font-size:11px;font-weight:800;letter-spacing:.11em;text-transform:uppercase;margin-bottom:4px}.icon{border:0;background:#ffffff12;color:#fff;border-radius:50%;width:34px;height:34px;font-size:25px;line-height:28px;cursor:pointer}main{padding:18px 20px}.intro{color:#b8d0cc;margin-bottom:16px}.fields{display:grid;gap:12px}.split{display:grid;grid-template-columns:1fr 1fr;gap:10px}label{display:grid;gap:5px;color:#a9c8c3;font-size:12px;font-weight:700}select{width:100%;height:42px;border:1px solid #ffffff25;border-radius:9px;padding:0 34px 0 10px;background:#103a3d;color:#f5fffc;font:600 13px inherit}.brief{margin:15px 0;padding:14px;border:1px solid #ffffff16;border-radius:12px;background:#ffffff08;color:#c9dcd9}.brief p{margin-top:5px}.meta,.report-meta{display:flex;gap:8px;justify-content:space-between;color:#89aaa6;font-size:11px;text-transform:uppercase;letter-spacing:.05em}.primary,.secondary{width:100%;min-height:44px;border-radius:10px;font:800 13px inherit;cursor:pointer}.primary{border:0;background:#70e7b8;color:#052b27}.secondary{margin-top:12px;border:1px solid #5bbf9d;background:transparent;color:#baf3dc;display:flex;justify-content:center;gap:8px}.secondary span{color:#7ea39e}.primary:disabled,.secondary:disabled{opacity:.45;cursor:not-allowed}
  h3{font-size:19px;margin:7px 0 10px}.progress{height:5px;background:#ffffff14;border-radius:9px;overflow:hidden}.progress i{height:100%;display:block;background:#68e0b4}fieldset{border:0;padding:0;margin:18px 0 0}legend{font-size:15px;font-weight:750;margin-bottom:11px}.choices{display:grid;gap:8px}.choices button{width:100%;min-height:54px;padding:9px 10px;display:flex;align-items:center;gap:10px;text-align:left;border:1px solid #ffffff1c;border-radius:10px;background:#ffffff09;color:#e9f7f3;font:600 13px/1.35 inherit;cursor:pointer}.choices button:hover{background:#ffffff12;border-color:#68e0b480}.choices b{flex:0 0 27px;height:27px;display:grid;place-items:center;border-radius:7px;background:#164b49;color:#7dffd0}
  .result{display:flex;align-items:center;gap:16px;padding:15px;border-radius:13px;background:#ffffff09;border:1px solid #ffffff17}.result.pass{border-color:#64d9aa66}.result.develop{border-color:#f19c7966}.score strong{font-size:38px;line-height:1}.score span{color:#86a9a4}.result p{color:#9eb9b5;text-transform:capitalize}h4{margin:18px 0 10px}.dimensions{display:grid;gap:11px}.dimensions>div{display:grid;grid-template-columns:1fr auto;gap:5px}.dimensions span{color:#c9dcda;font-size:12px}.dimensions b{font-size:12px}.dimensions i{grid-column:1/-1;height:5px;background:#ffffff14;border-radius:6px;overflow:hidden}.dimensions em{display:block;height:100%;background:#6ce1b3}.report-meta{margin:17px 0;justify-content:flex-start;flex-wrap:wrap}.report-meta span{padding:4px 7px;border-radius:5px;background:#ffffff09}.status{min-height:34px;padding:8px 20px 12px;color:#9fb9b5;font-size:12px;border-top:1px solid #ffffff0d}
  @media(max-width:480px){:host{right:12px;bottom:12px}.panel{bottom:58px}.launcher{height:45px}.split{grid-template-columns:1fr}}
  @media(prefers-reduced-motion:no-preference){.panel{animation:appear .18s ease-out}@keyframes appear{from{opacity:0;transform:translateY(8px)}}}
`;

export function defineCapabilityConsole(tagName = "capability-console") {
  if (!globalThis.customElements) return false;
  if (!customElements.get(tagName)) customElements.define(tagName, CapabilityConsole);
  return true;
}

export function mountCapabilityConsole(parent = document.body, options = {}) {
  defineCapabilityConsole(options.tagName);
  const element = document.createElement(options.tagName || "capability-console");
  if (options.districtId) element.setAttribute("district-id", options.districtId);
  if (options.scenarioId) element.setAttribute("scenario-id", options.scenarioId);
  parent.append(element);
  return element;
}

defineCapabilityConsole();
