/**
 * Commercial capability catalogue.
 * Pure data: safe to import in a browser, worker, or Node test runner.
 */

export const SCHEMA_VERSION = "1.0.0";

export const sectors = Object.freeze([
  { id: "aviation", name: "Aviation", criticality: "critical" },
  { id: "education", name: "Education", criticality: "high" },
  { id: "healthcare", name: "Healthcare", criticality: "critical" },
  { id: "maritime-industrial", name: "Maritime & Industrial", criticality: "critical" },
  { id: "public-transport", name: "Public Transport", criticality: "critical" },
  { id: "community", name: "Community", criticality: "standard" },
  { id: "residential", name: "Residential", criticality: "standard" },
]);

export const districts = Object.freeze([
  { id: "changi", name: "Changi Airport", region: "east", sectorId: "aviation", map: { x: 0.91, y: 0.55 } },
  { id: "kent-ridge", name: "Kent Ridge Campus", region: "south-west", sectorId: "education", map: { x: 0.38, y: 0.68 } },
  { id: "outram", name: "Outram Health Campus", region: "central", sectorId: "healthcare", map: { x: 0.53, y: 0.70 } },
  { id: "tuas", name: "Tuas Port & Industry", region: "west", sectorId: "maritime-industrial", map: { x: 0.10, y: 0.64 } },
  { id: "paya-lebar", name: "Paya Lebar Interchange", region: "east-central", sectorId: "public-transport", map: { x: 0.69, y: 0.56 } },
  { id: "tampines", name: "Tampines Community Hub", region: "east", sectorId: "community", map: { x: 0.81, y: 0.49 } },
  { id: "toa-payoh", name: "Toa Payoh Estate", region: "central", sectorId: "residential", map: { x: 0.56, y: 0.46 } },
]);

export const competencies = Object.freeze([
  { id: "diagnosis", name: "Evidence-led diagnosis", weight: 0.25 },
  { id: "service-continuity", name: "Service continuity", weight: 0.20 },
  { id: "safety-compliance", name: "Safety & compliance", weight: 0.20 },
  { id: "customer-communication", name: "Customer communication", weight: 0.15 },
  { id: "technical-execution", name: "Technical execution", weight: 0.15 },
  { id: "commercial-judgement", name: "Commercial judgement", weight: 0.05 },
]);

export const roleModes = Object.freeze({
  fieldEngineer: { id: "fieldEngineer", label: "Field engineer", visibleEvidence: "full", timeMultiplier: 1 },
  dispatcher: { id: "dispatcher", label: "Dispatcher", visibleEvidence: "remote", timeMultiplier: 0.8 },
  dutyManager: { id: "dutyManager", label: "Duty manager", visibleEvidence: "summary", timeMultiplier: 0.7 },
});

export const difficultyModes = Object.freeze({
  guided: { id: "guided", label: "Guided", hintCount: 3, scoreMultiplier: 0.85 },
  standard: { id: "standard", label: "Standard", hintCount: 1, scoreMultiplier: 1 },
  assessment: { id: "assessment", label: "Assessment", hintCount: 0, scoreMultiplier: 1.15 },
});

const option = (id, label, competencyImpact, nextStep, extra = {}) => ({
  id, label, competencyImpact, nextStep, ...extra,
});

/**
 * Every scenario is a small directed graph. `nextStep: null` completes it.
 * Impact values are intentionally -2..+2 so authoring remains understandable.
 */
export const scenarios = Object.freeze([
  {
    id: "changi-terminal-congestion", version: 1, title: "Terminal Wi-Fi Congestion",
    sectorId: "aviation", districtId: "changi", roles: ["fieldEngineer", "dispatcher", "dutyManager"],
    difficulty: 4, estimatedMinutes: 12, rootCause: "A failed controller has overloaded the remaining access-point cluster.",
    briefing: "Departure-gate Wi-Fi latency is affecting airline operations during the evening peak.",
    evidence: ["Client count rose 34%", "One controller is unreachable", "WAN utilisation is normal"],
    firstStepId: "triage",
    steps: [
      { id: "triage", prompt: "What should happen first?", options: [
        option("inspect-controller", "Correlate controller health, AP load and affected gates", { diagnosis: 2, "service-continuity": 1 }, "contain"),
        option("reboot-all", "Restart every access point in the terminal", { diagnosis: -2, "service-continuity": -2, "safety-compliance": -1 }, null, { outcome: "avoidable-terminal-outage" }),
        option("blame-wan", "Escalate immediately to the WAN carrier", { diagnosis: -1, "customer-communication": -1 }, "contain"),
      ]},
      { id: "contain", prompt: "How do you protect operations while repairing?", options: [
        option("rebalance", "Fail over the controller and prioritise operational SSIDs", { "service-continuity": 2, "technical-execution": 2, "safety-compliance": 1 }, null, { outcome: "service-stabilised" }),
        option("close-gates", "Ask the terminal to stop gate operations", { "service-continuity": -2, "commercial-judgement": -2 }, null, { outcome: "operations-disrupted" }),
      ]},
    ],
  },
  {
    id: "university-lecture-stream", version: 1, title: "Campus Lecture Streaming Failure",
    sectorId: "education", districtId: "kent-ridge", roles: ["fieldEngineer", "dispatcher"], difficulty: 3, estimatedMinutes: 10,
    rootCause: "A newly introduced multicast stream is flooding an access switch VLAN.",
    briefing: "Hybrid lectures are dropping across two faculties ten minutes before a major examination briefing.",
    evidence: ["Packet loss is local to one VLAN", "Internet uplink is healthy", "Switch CPU is at 98%"], firstStepId: "localise",
    steps: [
      { id: "localise", prompt: "Choose the best diagnostic action.", options: [
        option("switch-telemetry", "Inspect switch telemetry and recent VLAN changes", { diagnosis: 2, "technical-execution": 1 }, "restore"),
        option("increase-bandwidth", "Order a larger internet circuit", { diagnosis: -2, "commercial-judgement": -2 }, null, { outcome: "issue-persists" }),
      ]},
      { id: "restore", prompt: "Choose the restoration plan.", options: [
        option("isolate-multicast", "Isolate the stream, enable snooping and notify teaching staff", { "technical-execution": 2, "service-continuity": 2, "customer-communication": 1 }, null, { outcome: "classes-restored" }),
        option("disable-vlan", "Disable the entire teaching VLAN without notice", { "service-continuity": -2, "customer-communication": -2 }, null, { outcome: "campus-disrupted" }),
      ]},
    ],
  },
  {
    id: "hospital-redundant-link", version: 1, title: "Clinical Network Degradation",
    sectorId: "healthcare", districtId: "outram", roles: ["fieldEngineer", "dispatcher", "dutyManager"], difficulty: 5, estimatedMinutes: 14,
    rootCause: "Primary fibre attenuation has pushed clinical traffic onto an incorrectly shaped backup link.",
    briefing: "Imaging transfers are slow; life-safety systems remain online. The incident requires controlled clinical escalation.",
    evidence: ["Primary optical power is below threshold", "Backup link is active", "QoS policy differs between links"], firstStepId: "safety",
    steps: [
      { id: "safety", prompt: "What is the first response?", options: [
        option("clinical-command", "Confirm safety impact with clinical command and preserve the backup", { "safety-compliance": 2, "customer-communication": 2, "service-continuity": 1 }, "repair"),
        option("unplug-backup", "Disconnect the backup link to force primary recovery", { "safety-compliance": -2, "service-continuity": -2 }, null, { outcome: "clinical-risk" }),
      ]},
      { id: "repair", prompt: "Select the controlled fix.", options: [
        option("qos-repair", "Align backup QoS, dispatch fibre repair and monitor clinical traffic", { diagnosis: 2, "technical-execution": 2, "service-continuity": 2 }, null, { outcome: "continuity-maintained" }),
        option("wait", "Wait for the primary fibre to recover by itself", { diagnosis: -1, "service-continuity": -1 }, null, { outcome: "degradation-continues" }),
      ]},
    ],
  },
  {
    id: "tuas-private-network", version: 1, title: "Automated Crane Connectivity Loss",
    sectorId: "maritime-industrial", districtId: "tuas", roles: ["fieldEngineer", "dispatcher", "dutyManager"], difficulty: 5, estimatedMinutes: 15,
    rootCause: "Construction equipment damaged a private-network fibre route near the quay.",
    briefing: "Two automated cranes have entered safe-stop, reducing berth throughput.",
    evidence: ["Radio cells remain healthy", "Backhaul path is down", "Civil works are active nearby"], firstStepId: "secure",
    steps: [
      { id: "secure", prompt: "How do you begin?", options: [
        option("permit", "Coordinate safe access, verify permits and trace the backhaul break", { "safety-compliance": 2, diagnosis: 2 }, "recover"),
        option("enter-quay", "Enter the restricted quay immediately", { "safety-compliance": -2, "commercial-judgement": -1 }, null, { outcome: "work-stopped" }),
      ]},
      { id: "recover", prompt: "Choose a recovery strategy.", options: [
        option("diverse-route", "Activate the diverse path, splice fibre, then prove crane latency", { "service-continuity": 2, "technical-execution": 2, "commercial-judgement": 1 }, null, { outcome: "berth-restored" }),
        option("temporary-radio", "Deploy an untested public hotspot", { "safety-compliance": -2, "technical-execution": -1 }, null, { outcome: "unsafe-workaround" }),
      ]},
    ],
  },
  {
    id: "mrt-interchange-outage", version: 1, title: "Interchange Communications Incident",
    sectorId: "public-transport", districtId: "paya-lebar", roles: ["fieldEngineer", "dispatcher", "dutyManager"], difficulty: 4, estimatedMinutes: 12,
    rootCause: "A power-supply fault has isolated a communications cabinet while redundant passenger systems remain available.",
    briefing: "Platform displays and staff handsets are intermittent during peak travel.",
    evidence: ["Cabinet UPS alarms are active", "Adjacent station links are normal", "Public address remains available"], firstStepId: "coordinate",
    steps: [
      { id: "coordinate", prompt: "Select the incident response.", options: [
        option("ops-channel", "Open the transport operations channel and validate fallback systems", { "customer-communication": 2, "service-continuity": 2, "safety-compliance": 1 }, "power"),
        option("silent-repair", "Begin an unannounced cabinet restart", { "customer-communication": -2, "safety-compliance": -1 }, "power"),
      ]},
      { id: "power", prompt: "What repair is justified by the evidence?", options: [
        option("isolate-psu", "Isolate the failed supply, transfer load and replace under permit", { diagnosis: 2, "technical-execution": 2, "safety-compliance": 2 }, null, { outcome: "interchange-restored" }),
        option("restart-network", "Factory-reset all network equipment", { diagnosis: -2, "service-continuity": -2 }, null, { outcome: "extended-outage" }),
      ]},
    ],
  },
  {
    id: "community-event-capacity", version: 1, title: "Community Event Capacity Surge",
    sectorId: "community", districtId: "tampines", roles: ["fieldEngineer", "dispatcher"], difficulty: 2, estimatedMinutes: 8,
    rootCause: "Event attendance exceeded the temporary Wi-Fi design capacity.",
    briefing: "Digital check-in queues are growing at a community festival.",
    evidence: ["RF interference is low", "Client association failures are high", "Wired check-in desk is healthy"], firstStepId: "assist",
    steps: [
      { id: "assist", prompt: "Choose the most helpful first action.", options: [
        option("protect-checkin", "Protect the check-in service and explain the temporary plan", { "service-continuity": 2, "customer-communication": 2 }, "capacity"),
        option("dismiss", "Tell organisers that crowds are outside the contract", { "customer-communication": -2, "commercial-judgement": -2 }, null, { outcome: "event-impact" }),
      ]},
      { id: "capacity", prompt: "How should capacity be restored?", options: [
        option("temporary-aps", "Deploy managed temporary APs and rebalance clients", { diagnosis: 1, "technical-execution": 2, "commercial-judgement": 1 }, null, { outcome: "event-recovered" }),
        option("open-network", "Remove all access controls", { "safety-compliance": -2, "technical-execution": -1 }, null, { outcome: "security-exposure" }),
      ]},
    ],
  },
  {
    id: "hdb-intermittent-broadband", version: 1, title: "Intermittent Home Broadband",
    sectorId: "residential", districtId: "toa-payoh", roles: ["fieldEngineer", "dispatcher"], difficulty: 2, estimatedMinutes: 8,
    rootCause: "A sharply bent internal fibre patch lead causes intermittent optical loss.",
    briefing: "A resident working from home reports drops each afternoon and has already rebooted the router.",
    evidence: ["Optical power fluctuates", "Neighbouring units are unaffected", "Router logs show WAN loss"], firstStepId: "listen",
    steps: [
      { id: "listen", prompt: "What should the technician do first?", options: [
        option("confirm-pattern", "Confirm the symptoms, inspect optical history and internal fibre", { "customer-communication": 2, diagnosis: 2 }, "fix"),
        option("upsell", "Offer a faster plan before testing", { "commercial-judgement": -2, "customer-communication": -2 }, null, { outcome: "repeat-call" }),
      ]},
      { id: "fix", prompt: "Choose the lasting resolution.", options: [
        option("replace-lead", "Replace and correctly route the patch lead, then prove stability", { "technical-execution": 2, "safety-compliance": 1, diagnosis: 1 }, null, { outcome: "first-time-fix" }),
        option("reboot", "Reboot the router and leave", { diagnosis: -1, "technical-execution": -1 }, null, { outcome: "fault-returns" }),
      ]},
    ],
  },
]);

export const catalogue = Object.freeze({
  schemaVersion: SCHEMA_VERSION,
  sectors,
  districts,
  competencies,
  roleModes,
  difficultyModes,
  scenarios,
});

