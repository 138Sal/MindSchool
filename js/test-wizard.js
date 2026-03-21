const TEST_SCALE = [
    { value: 0, label: "0", caption: "Никогда", tone: "low" },
    { value: 1, label: "1", caption: "Редко", tone: "low" },
    { value: 2, label: "2", caption: "Иногда", tone: "mid" },
    { value: 3, label: "3", caption: "Часто", tone: "mid" },
    { value: 4, label: "4", caption: "Сильно", tone: "high" },
    { value: 5, label: "5", caption: "Почти всегда", tone: "high" }
];

const testWizardState = {
    questions: [],
    answers: [],
    currentIndex: 0,
    isAnimating: false,
    ready: false,
    introTimer: null,
    keyboardBound: false
};

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll("\"", "&quot;")
        .replaceAll("'", "&#39;");
}

function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getTestQuestions() {
    return Array.from(document.querySelectorAll("#test-questions-source li")).map((item, index) => ({
        index: index + 1,
        text: item.textContent.trim()
    }));
}

function countAnsweredTestQuestions() {
    return testWizardState.answers.filter((value) => Number.isInteger(value)).length;
}

function getSelectedAnswerLabel(value) {
    const option = TEST_SCALE.find((item) => item.value === value);
    return option ? `${option.label} · ${option.caption}` : "Ответ не выбран";
}

function getTestAnswerButtons() {
    return Array.from(document.querySelectorAll(".test-answer"));
}

function getActiveTestAnswer() {
    return document.activeElement?.closest(".test-answer");
}

function getKeyboardTestAnswer() {
    const answers = getTestAnswerButtons();
    return getActiveTestAnswer() || document.querySelector(".test-answer.is-selected") || answers[0] || null;
}

function focusCurrentAnswer() {
    getKeyboardTestAnswer()?.focus({ preventScroll: true });
}

function moveTestAnswerFocus(direction) {
    const answers = getTestAnswerButtons();
    const currentAnswer = getKeyboardTestAnswer();
    const currentIndex = answers.indexOf(currentAnswer);

    if (currentIndex < 0) {
        answers[0]?.focus({ preventScroll: true });
        return;
    }

    const nextIndex = Math.min(answers.length - 1, Math.max(0, currentIndex + direction));
    answers[nextIndex]?.focus({ preventScroll: true });
}

function bindTestWizardKeyboard() {
    if (testWizardState.keyboardBound) {
        return;
    }

    document.addEventListener("keydown", handleTestWizardKeydown);
    testWizardState.keyboardBound = true;
}

function handleTestWizardKeydown(event) {
    const resultBox = document.getElementById("result");
    const isEditingField = ["INPUT", "TEXTAREA", "SELECT"].includes(event.target?.tagName);

    if (
        !testWizardState.ready ||
        testWizardState.isAnimating ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        isEditingField ||
        resultBox?.style.display === "grid"
    ) {
        return;
    }

    if (/^[0-5]$/.test(event.key)) {
        event.preventDefault();
        selectTestAnswer(Number(event.key));
        return;
    }

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        moveTestAnswerFocus(1);
        return;
    }

    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        moveTestAnswerFocus(-1);
        return;
    }

    if (event.key === "Backspace" && testWizardState.currentIndex > 0) {
        event.preventDefault();
        goToPreviousQuestion();
        return;
    }

    if (event.key === "Enter" || event.key === " ") {
        const activeAnswer = getKeyboardTestAnswer();
        const value = Number(activeAnswer?.dataset?.value);

        if (Number.isInteger(value)) {
            event.preventDefault();
            selectTestAnswer(value);
        }
    }
}

function buildTestBook() {
    const book = document.getElementById("test-book");

    if (!book) {
        return;
    }

    const pages = [...testWizardState.questions].reverse();

    book.innerHTML = pages.map((question, index) => {
        const originalIndex = testWizardState.questions.length - index;
        const isBase = originalIndex === 1;

        return `
            <article class="test-book-page${isBase ? " is-base" : ""}" style="--page-delay:${index}; --page-stack:${index}; z-index:${testWizardState.questions.length - index};">
                <span class="test-book-index">${String(originalIndex).padStart(2, "0")}</span>
                <p>${escapeHtml(question.text)}</p>
            </article>
        `;
    }).join("");
}

function updateTestWizardChrome() {
    const total = testWizardState.questions.length;
    const current = testWizardState.currentIndex + 1;
    const answered = countAnsweredTestQuestions();
    const selectedValue = testWizardState.answers[testWizardState.currentIndex];
    const currentStep = document.getElementById("test-current-step");
    const totalSteps = document.getElementById("test-total-steps");
    const meta = document.getElementById("test-progress-meta");
    const fill = document.getElementById("test-progress-fill");
    const selected = document.getElementById("test-selected-value");
    const backButton = document.getElementById("test-back");

    if (currentStep) currentStep.textContent = String(current);
    if (totalSteps) totalSteps.textContent = String(total);
    if (meta) meta.textContent = `Отвечено: ${answered} / ${total}`;
    if (fill) fill.style.width = `${(answered / total) * 100}%`;

    if (selected) {
        selected.textContent = selectedValue === null || selectedValue === undefined
            ? "Ответ не выбран"
            : `Выбрано: ${getSelectedAnswerLabel(selectedValue)}`;
    }

    if (backButton) {
        const shouldHide = testWizardState.currentIndex === 0;
        backButton.disabled = shouldHide || testWizardState.isAnimating || !testWizardState.ready;
        backButton.classList.toggle("is-hidden", shouldHide);
    }
}

function buildTestCardMarkup(question, selectedValue) {
    const helperText = testWizardState.currentIndex === testWizardState.questions.length - 1
        ? "Последний ответ сразу покажет итог."
        : "Выберите значение и переход произойдёт автоматически.";

    return `
        <div class="test-card-head">
            <span class="question-index">${String(question.index).padStart(2, "0")}</span>
            <div class="test-card-copy">
                <p class="test-card-kicker">Шкала 0-5</p>
                <h2 class="test-card-title">${escapeHtml(question.text)}</h2>
            </div>
        </div>

        <div class="test-scale-shell">
            <div class="test-scale-meta" aria-hidden="true">
                <span>0 — слабее</span>
                <span>5 — сильнее</span>
            </div>

            <div class="test-answer-grid" role="radiogroup" aria-label="Варианты ответа">
                ${TEST_SCALE.map((option) => {
                    const isSelected = option.value === selectedValue;

                    return `
                        <button
                            type="button"
                            class="test-answer${isSelected ? " is-selected" : ""}"
                            data-value="${option.value}"
                            data-tone="${option.tone}"
                            role="radio"
                            aria-checked="${isSelected}"
                            aria-label="${option.label} — ${option.caption}"
                            onclick="selectTestAnswer(${option.value})"
                        >
                            <span class="test-answer-value">${option.label}</span>
                            <span class="test-answer-caption">${option.caption}</span>
                        </button>
                    `;
                }).join("")}
            </div>
        </div>

        <p class="test-card-helper">${helperText}</p>
    `;
}

function renderTestQuestion(direction = "instant") {
    const card = document.getElementById("test-card");
    const question = testWizardState.questions[testWizardState.currentIndex];

    if (!card || !question) {
        return;
    }

    const markup = buildTestCardMarkup(question, testWizardState.answers[testWizardState.currentIndex]);

    updateTestWizardChrome();

    if (direction === "instant" || prefersReducedMotion()) {
        card.innerHTML = markup;
        focusCurrentAnswer();
        return;
    }

    const exitClass = direction === "backward" ? "is-exit-back" : "is-exit-forward";
    const enterClass = direction === "backward" ? "is-enter-back" : "is-enter-forward";

    testWizardState.isAnimating = true;
    updateTestWizardChrome();

    card.classList.remove("is-exit-forward", "is-exit-back", "is-enter-forward", "is-enter-back");
    card.classList.add(exitClass);

    window.setTimeout(() => {
        card.innerHTML = markup;
        card.classList.remove(exitClass);
        card.classList.add(enterClass);

        window.setTimeout(() => {
            card.classList.remove(enterClass);
            testWizardState.isAnimating = false;
            updateTestWizardChrome();
            focusCurrentAnswer();
        }, 280);
    }, 140);
}

function initTestWizard() {
    const card = document.getElementById("test-card");
    const stage = document.getElementById("test-stage");
    const book = document.getElementById("test-book");

    if (!card || !stage) {
        return;
    }

    testWizardState.questions = getTestQuestions();
    testWizardState.answers = new Array(testWizardState.questions.length).fill(null);
    testWizardState.currentIndex = 0;
    testWizardState.isAnimating = false;
    testWizardState.ready = false;

    bindTestWizardKeyboard();
    buildTestBook();
    renderTestQuestion("instant");

    if (prefersReducedMotion() || !book) {
        stage.classList.remove("is-intro-active");
        stage.classList.add("is-ready");
        testWizardState.ready = true;
        updateTestWizardChrome();
        focusCurrentAnswer();
        return;
    }

    book.classList.add("is-playing");
    window.clearTimeout(testWizardState.introTimer);

    const introDuration = testWizardState.questions.length * 70 + 620;

    testWizardState.introTimer = window.setTimeout(() => {
        stage.classList.remove("is-intro-active");
        stage.classList.add("is-ready");
        book.classList.add("is-finished");
        testWizardState.ready = true;
        updateTestWizardChrome();
        focusCurrentAnswer();
    }, introDuration);
}

function selectTestAnswer(value) {
    if (!testWizardState.ready || testWizardState.isAnimating) {
        return;
    }

    testWizardState.answers[testWizardState.currentIndex] = value;
    updateTestWizardChrome();

    document.querySelector(`.test-answer[data-value="${value}"]`)?.classList.add("is-picked");

    testWizardState.isAnimating = true;
    updateTestWizardChrome();

    window.setTimeout(() => {
        const isLast = testWizardState.currentIndex === testWizardState.questions.length - 1;

        if (isLast) {
            testWizardState.isAnimating = false;
            submitTest();
            return;
        }

        testWizardState.currentIndex += 1;
        testWizardState.isAnimating = false;
        renderTestQuestion("forward");
    }, 220);
}

function goToPreviousQuestion() {
    if (!testWizardState.ready || testWizardState.isAnimating || testWizardState.currentIndex === 0) {
        return;
    }

    testWizardState.currentIndex -= 1;
    renderTestQuestion("backward");
}

function saveTestResult(answers) {
    const user = getUser();
    const score = answers.reduce((sum, value) => sum + value, 0);
    const level = getLevelByScore(score);

    DB.saveTest(user.id, score, level);

    return { score, level };
}

function submitTest(event) {
    if (event) {
        event.preventDefault();
    }

    const answers = [...testWizardState.answers];

    if (answers.length !== testWizardState.questions.length || answers.some((value) => !Number.isInteger(value))) {
        showToast("Ответьте на все вопросы", "warning");
        return;
    }

    const { score, level } = saveTestResult(answers);
    const meta = getLevelMeta(level);
    const resultBox = document.getElementById("result");
    const form = document.getElementById("test-form");
    const stage = document.getElementById("test-stage");

    if (!resultBox) {
        return;
    }

    resultBox.style.display = "grid";
    resultBox.innerHTML = `
        <p class="eyebrow">Результат сохранён</p>
        <h3>${meta.title}</h3>
        <p class="result-score">${score} / 75</p>
        <p class="result-level ${level}">${meta.label}</p>
        <p>${meta.description}</p>
        <p><strong>${meta.recommendation}</strong></p>
        <a href="test.html" class="btn-secondary">Пройти ещё раз</a>
    `;

    if (form) form.style.display = "none";
    if (stage) stage.classList.add("is-complete");

    resultBox.querySelector(".btn-secondary")?.focus({ preventScroll: true });
    resultBox.scrollIntoView({
        behavior: prefersReducedMotion() ? "auto" : "smooth",
        block: "start"
    });
}
