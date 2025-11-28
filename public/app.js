let questions = [];
let answers = {};
let seconds = 0;

// Timer
setInterval(() => {
  seconds++;
  const m = String(Math.floor(seconds / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  timer.textContent = `Time: ${m}:${s}`;
}, 1000);

async function loadQuiz() {
  const params = new URLSearchParams(window.location.search);
  const limit = params.get("limit");

  const res = await fetch(`/api/questions${limit ? `?limit=${limit}` : '?limit=60'}`, {
    headers: { Authorization: "Bearer " + localStorage.getItem("token") },
  });

  questions = await res.json();
  const container = document.getElementById("quiz");

  questions.forEach((q, idx) => {
    const div = document.createElement("div");
    div.className = "question-card";

    const question = q.question.replace(/\n/g, "<br/>");
    div.innerHTML = `
      <h3>${idx + 1}. ${question}</h3>
      <div>
      <div><small>${
        q.multiple ? "(Select all that apply)" : "(Select one)"
      }</small></div>
        ${renderChoices(q, idx)}
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
                 value="${c.key}">
          ${c.key}. ${c.value}
        </label>
      </div>`
    )
    .join("");
}

function submitAnswers() {
  let score = 0;
  let total = questions.length;
  let detailsHTML = "";

  questions.forEach((q, idx) => {
    const correct = q.answer.split(",").map((a) => a.trim());
    const selected = Array.from(
      document.querySelectorAll(`input[name="q_${idx}"]:checked`)
    ).map((i) => i.value);

    let questionScore = 0;

    const correctSet = new Set(correct);
    const selectedSet = new Set(selected);

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
      explanation = q.explanation.replace(/\n/g, "<br/>");
    }
    detailsHTML += `
      <div>
        <b>Q${idx + 1}:</b> 
        <span class="${questionScore === 1 ? "correct" : "wrong"}">
          ${Math.round(questionScore * 100)}% correct  
        </span>
        ${
          questionScore !== 1
            ? `<br/>
                <b>Correct Answer(s):</b>${q.answer}
                ${
                  q.explanation
                    ? `<br/><b>Explanation:</b><br/> ${explanation}`
                    : ""
                }`
            : ""
        }
        <br/>

      </div><br/>
    `;
  });

  document.getElementById("result").innerHTML = `
    <h3>Your Score: ${score.toFixed(2)} / ${total}</h3>
    ${detailsHTML}
  `;

  openModal();
}

function openModal() {
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

loadQuiz();
