const demos = {
  explain: {
    prompt: "Explain how authentication works in this project.",
    output: ["Reading routes and middleware", "Tracing the session flow", "I found the entry point and mapped the request path."],
  },
  fix: {
    prompt: "Fix the empty checkout state and add a regression test.",
    output: ["Reproducing the empty state", "Updating the form guard and test", "The focused test suite passes."],
  },
  review: {
    prompt: "Review my uncommitted changes for regressions.",
    output: ["Reading the current diff", "Checking affected call sites", "Review complete. Findings are prioritized by impact."],
  },
};

const prompt = document.querySelector("#demo-prompt");
const output = document.querySelector("#demo-output");

document.querySelectorAll("[data-demo]").forEach((button) => {
  button.addEventListener("click", () => {
    const demo = demos[button.dataset.demo];
    document.querySelectorAll("[data-demo]").forEach((item) => {
      const selected = item === button;
      item.classList.toggle("active", selected);
      item.setAttribute("aria-pressed", String(selected));
    });
    prompt.textContent = demo.prompt;
    output.innerHTML = `
      <p><span class="terminal-step">•</span> ${demo.output[0]}</p>
      <p><span class="terminal-step">•</span> ${demo.output[1]}</p>
      <p class="terminal-success"><span>✓</span> ${demo.output[2]}</p>
    `;
  });
});

const toast = document.querySelector("#copy-toast");
let toastTimer;

async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
}

document.querySelectorAll("[data-copy]").forEach((button) => {
  button.addEventListener("click", async () => {
    await copyText(button.dataset.copy);
    const previous = button.textContent;
    button.textContent = "Copied";
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 1600);
    setTimeout(() => { button.textContent = previous; }, 1600);
  });
});

const checks = [...document.querySelectorAll(".check-button")];
const progressCount = document.querySelector("#progress-count");
const progressMessage = document.querySelector("#progress-message");
const progressTrack = document.querySelector(".progress-track");
const progressFill = document.querySelector("#progress-fill");

function updateProgress() {
  const complete = checks.filter((button) => button.getAttribute("aria-pressed") === "true").length;
  progressCount.textContent = `${complete} of ${checks.length} complete`;
  progressTrack.setAttribute("aria-valuenow", String(complete));
  progressFill.style.width = `${(complete / checks.length) * 100}%`;
  progressMessage.textContent = complete === checks.length
    ? "You have the loop. Next: connect one useful MCP server."
    : complete === 0
      ? "Start with the installer when you’re ready."
      : "Nice—keep going while the commands are fresh.";
}

checks.forEach((button) => {
  button.addEventListener("click", () => {
    button.setAttribute("aria-pressed", String(button.getAttribute("aria-pressed") !== "true"));
    updateProgress();
  });
});

document.querySelector("#print-guide").addEventListener("click", () => window.print());
