let questions = [];
let answers = {};
let seconds = 0;

// Score-review pagination state
let resultBlocks = [];
let currentPage = 0;
const RESULTS_PER_PAGE = 5;

function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Timer (writes into the header slot once header.js has rendered it)
setInterval(() => {
  seconds++;
  const el = document.getElementById("headerTimer");
  if (!el) return;
  const m = String(Math.floor(seconds / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  el.textContent = `⏱ ${m}:${s}`;
}, 1000);

async function loadQuiz() {
  const params = new URLSearchParams(window.location.search);
  const limit = params.get("limit");

  const res = await fetch(`/api/questions${limit ? `?limit=${limit}` : '?limit=60'}`, {
    headers: { Authorization: "Bearer " + localStorage.getItem("token") },
  });

  const status = res.status;
  if (status === 401 || status === 403) {
    alert("Unauthorized! Please log in.");
    window.location.href = "/login.html";
    return;
  } else if (status !== 200) {
    alert("Failed to load quiz questions.");
    return;
  }

  questions = await res.json();
  const container = document.getElementById("quiz");

  questions.forEach((q, idx) => {
    const div = document.createElement("div");
    div.className = "question-card";

    const question = escapeHtml(q.question).replace(/\n/g, "<br/>");
    const explanation = q.explanation
      ? escapeHtml(q.explanation).replace(/\n/g, "<br/>")
      : "";
    div.innerHTML = `
      <h3>${idx + 1}. ${question}</h3>
      <div class="choice-row">
        <div><small>${
          q.multiple ? "(Select all that apply)" : "(Select one)"
        }</small></div>
        ${renderChoices(q, idx)}
      </div>
      <button type="button" class="reveal-btn" onclick="toggleAnswer(${idx})">See Answer</button>
      <div class="answer-box" id="answer_${idx}">
        <b>Answer:</b> ${escapeHtml(q.answer)}
        ${explanation ? `<br/><b>Explanation:</b><br/>${explanation}` : ""}
      </div>
    `;

    container.appendChild(div);
  });
}

function renderChoices(q, index) {
  return q.choices
    .map(
      (c) => `
      <div>
        <label>
          <input type="${q.multiple ? "checkbox" : "radio"}"
                 name="q_${index}"
                 value="${escapeHtml(c.key)}">
          ${escapeHtml(c.key)}. ${escapeHtml(c.value)}
        </label>
      </div>`
    )
    .join("");
}

function submitAnswers() {
  let score = 0;
  let total = questions.length;
  resultBlocks = [];

  questions.forEach((q, idx) => {
    const correct = q.answer.split(",").map((a) => a.trim());
    const selected = Array.from(
      document.querySelectorAll(`input[name="q_${idx}"]:checked`)
    ).map((i) => i.value);

    let questionScore = 0;

    const correctSet = new Set(correct);

    const correctSelections = selected.filter((s) => correctSet.has(s));
    const wrongSelections = selected.filter((s) => !correctSet.has(s));

    if (wrongSelections.length === 0) {
      // Partial credit: correct selections / total correct
      questionScore = correctSelections.length / correct.length;
    } else {
      questionScore = 0; // user selected something wrong
    }

    score += questionScore;

    let explanation = "";
    if (q.explanation) {
      explanation = escapeHtml(q.explanation).replace(/\n/g, "<br/>");
    }
    resultBlocks.push(`
      <div class="result-item">
        <b>Q${idx + 1}:</b>
        <span class="${questionScore === 1 ? "correct" : "wrong"}">
          ${Math.round(questionScore * 100)}% correct
        </span>
        ${
          questionScore !== 1
            ? `<br/>
                <b>Correct Answer(s):</b>${escapeHtml(q.answer)}
                ${
                  q.explanation
                    ? `<br/><b>Explanation:</b><br/> ${explanation}`
                    : ""
                }`
            : ""
        }
      </div>
    `);
  });

  document.getElementById(
    "scoreSummary"
  ).textContent = `Score: ${score.toFixed(2)} / ${total}`;
  currentPage = 0;
  renderResultsPage();
  openModal();
  recordAttempt(score, total);
}

// Record this attempt for the logged-in user. Failure is logged, not surfaced —
// it must never block the score review.
async function recordAttempt(score, total) {
  try {
    await fetch("/api/questions/score", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + localStorage.getItem("token"),
      },
      body: JSON.stringify({ score: Number(score.toFixed(2)), total }),
    });
  } catch (e) {
    console.error("Failed to record score", e);
  }
}

function totalResultPages() {
  return Math.max(1, Math.ceil(resultBlocks.length / RESULTS_PER_PAGE));
}

function renderResultsPage() {
  const totalPages = totalResultPages();
  currentPage = Math.min(Math.max(currentPage, 0), totalPages - 1);

  const start = currentPage * RESULTS_PER_PAGE;
  const pageBlocks = resultBlocks.slice(start, start + RESULTS_PER_PAGE);
  document.getElementById("resultsPage").innerHTML = pageBlocks.join("");

  const pager = document.getElementById("resultsPager");
  pager.style.display = totalPages > 1 ? "flex" : "none";
  document.getElementById(
    "pageIndicator"
  ).textContent = `Page ${currentPage + 1} of ${totalPages}`;
  document.getElementById("prevPage").disabled = currentPage === 0;
  document.getElementById("nextPage").disabled =
    currentPage === totalPages - 1;
}

function prevPage() {
  if (currentPage > 0) {
    currentPage--;
    renderResultsPage();
    scrollModalTop();
  }
}

function nextPage() {
  if (currentPage < totalResultPages() - 1) {
    currentPage++;
    renderResultsPage();
    scrollModalTop();
  }
}

function scrollModalTop() {
  document.getElementById("modalOverlay").scrollTop = 0;
}

function openModal() {
  scrollModalTop();
  document.getElementById("modalOverlay").style.display = "flex";
}

function closeModal() {
  document.getElementById("modalOverlay").style.display = "none";
}

document.addEventListener("click", function (event) {
  const overlay = document.getElementById("modalOverlay");
  const box = document.querySelector(".modal-box");

  if (event.target === overlay) {
    closeModal();
  }
});

function toggleAnswer(idx) {
  const box = document.getElementById(`answer_${idx}`);
  box.style.display = box.style.display === "block" ? "none" : "block";
}

loadQuiz();
