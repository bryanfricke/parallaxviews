const QUESTION_URL = "questions.json";
const SOUND_PREF_KEY = "resurrectionQuizSoundEnabled";
const LESSON_PROGRESS_KEY = "resurrectionQuizLessonProgress";
const ANSWER_LABELS = ["A", "B", "C", "D"];
const DEBUG_AUDIO = true;
const CORRECT_SOUND_NOTES = [
  { frequency: 523.25, start: 0, duration: 0.07, gain: 0.07 },
  { frequency: 659.25, start: 0.08, duration: 0.07, gain: 0.08 },
  { frequency: 783.99, start: 0.16, duration: 0.09, gain: 0.08 }
];
const WRONG_SOUND_NOTES = [
  { frequency: 220, start: 0, duration: 0.09, gain: 0.055 },
  { frequency: 185, start: 0.11, duration: 0.12, gain: 0.045 }
];
const TOGGLE_SOUND_NOTES = [
  { frequency: 660, start: 0, duration: 0.06, gain: 0.08 },
  { frequency: 880, start: 0.07, duration: 0.08, gain: 0.08 }
];

const state = {
  lessons: [],
  lessonProgress: {},
  currentLessonIndex: 0,
  questions: [],
  currentIndex: 0,
  score: 0,
  streak: 0,
  bestStreak: 0,
  missed: [],
  selectedChoiceId: null,
  hasCheckedAnswer: false,
  checkedResult: null,
  lastFocusedElement: null,
  isQuestionTransitioning: false,
  questionTransitionId: 0,
  lessonCompletionSaved: false,
  soundEnabled: true,
  audioContext: null,
  audioUnlocked: false,
  audioPrimed: false,
  audioUnavailable: false,
  audioUnlockPromise: null,
  webAudioUnavailable: false,
  fallbackAudioReady: false,
  fallbackAudioUnavailable: false,
  correctFallbackAudio: null,
  wrongFallbackAudio: null,
  fallbackSoundUrls: null
};

const els = {
  startScreen: document.getElementById("startScreen"),
  quizScreen: document.getElementById("quizScreen"),
  endScreen: document.getElementById("endScreen"),
  homeButton: document.getElementById("homeButton"),
  startButton: document.getElementById("startButton"),
  lessonList: document.getElementById("lessonList"),
  continueLessonButton: document.getElementById("continueLessonButton"),
  restartButton: document.getElementById("restartButton"),
  reviewButton: document.getElementById("reviewButton"),
  soundToggle: document.getElementById("soundToggle"),
  soundToggleText: document.getElementById("soundToggleText"),
  loadMessage: document.getElementById("loadMessage"),
  progressText: document.getElementById("progressText"),
  progressFill: document.getElementById("progressFill"),
  scoreText: document.getElementById("scoreText"),
  streakText: document.getElementById("streakText"),
  questionPanel: document.getElementById("questionPanel"),
  questionText: document.getElementById("questionText"),
  choiceList: document.getElementById("choiceList"),
  feedbackPanel: document.getElementById("feedbackPanel"),
  feedbackTitle: document.getElementById("feedbackTitle"),
  choiceFeedback: document.getElementById("choiceFeedback"),
  correctSolution: document.getElementById("correctSolution"),
  explainButton: document.getElementById("explainButton"),
  answerActionButton: document.getElementById("answerActionButton"),
  explanationModal: document.getElementById("explanationModal"),
  modalBackdrop: document.getElementById("modalBackdrop"),
  modalCloseIcon: document.getElementById("modalCloseIcon"),
  modalCloseButton: document.getElementById("modalCloseButton"),
  modalChoiceFeedback: document.getElementById("modalChoiceFeedback"),
  modalCorrectAnswer: document.getElementById("modalCorrectAnswer"),
  modalExplanation: document.getElementById("modalExplanation"),
  resultScore: document.getElementById("resultScore"),
  resultMessage: document.getElementById("resultMessage"),
  correctCount: document.getElementById("correctCount"),
  totalCount: document.getElementById("totalCount"),
  bestStreak: document.getElementById("bestStreak"),
  reviewPanel: document.getElementById("reviewPanel"),
  missedList: document.getElementById("missedList")
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  restoreSoundPreference();
  restoreLessonProgress();
  bindEvents();
  setStartReady(false);

  try {
    const deck = await loadQuestions();
    const lessons = normalizeLessons(deck);
    validateLessons(lessons);
    state.lessons = lessons;
    els.loadMessage.textContent = `${lessons.length} lessons loaded. Ready when you are.`;
    els.loadMessage.classList.remove("error");
    setStartReady(true);
  } catch (error) {
    console.error(error);
    els.loadMessage.textContent =
      "The question deck could not be loaded. Start a local static server and refresh this page.";
    els.loadMessage.classList.add("error");
  }
}

function bindEvents() {
  els.homeButton.addEventListener("click", returnToStartScreen);
  els.startButton.addEventListener("click", withAudioUnlock(startFirstLesson));
  els.lessonList.addEventListener("click", handleLessonListClick);
  els.continueLessonButton.addEventListener("click", withAudioUnlock(continueToNextLesson));
  els.restartButton.addEventListener("click", withAudioUnlock(replayCurrentLesson));
  els.answerActionButton.addEventListener("click", withAudioUnlock(handleAnswerAction));
  els.reviewButton.addEventListener("click", toggleMissedReview);
  els.soundToggle.addEventListener("click", withAudioUnlock(toggleSound));
  els.explainButton.addEventListener("click", openExplanationModal);
  els.modalBackdrop.addEventListener("click", closeExplanationModal);
  els.modalCloseIcon.addEventListener("click", closeExplanationModal);
  els.modalCloseButton.addEventListener("click", closeExplanationModal);

  document.addEventListener("keydown", (event) => {
    if (!els.explanationModal.hidden) {
      if (event.key === "Escape") {
        closeExplanationModal();
      } else if (event.key === "Tab") {
        trapModalFocus(event);
      }
      return;
    }

    if (els.quizScreen.hidden || state.hasCheckedAnswer) {
      return;
    }

    const keyNumber = Number(event.key);
    if (keyNumber >= 1 && keyNumber <= 4) {
      void initAudioFromGesture();
      const button = els.choiceList.querySelector(`[data-choice-position="${keyNumber - 1}"]`);
      button?.click();
      return;
    }

    const letterIndex = ANSWER_LABELS.indexOf(event.key.toUpperCase());
    if (letterIndex >= 0) {
      void initAudioFromGesture();
      const button = els.choiceList.querySelector(`[data-choice-position="${letterIndex}"]`);
      button?.click();
    }
  });
}

function withAudioUnlock(callback) {
  return (...args) => {
    callback(...args);
    void initAudioFromGesture();
  };
}

function handleLessonListClick(event) {
  const button = event.target.closest("[data-lesson-index]");

  if (!button || !els.lessonList.contains(button)) {
    return;
  }

  const lessonIndex = Number(button.dataset.lessonIndex);
  startLesson(lessonIndex);
  void initAudioFromGesture();
}

function returnToStartScreen() {
  stopQuestionTransition();
  state.currentLessonIndex = 0;
  state.questions = [];
  state.currentIndex = 0;
  state.score = 0;
  state.streak = 0;
  state.bestStreak = 0;
  state.missed = [];
  state.lessonCompletionSaved = false;
  resetQuestionState();
  els.choiceList.innerHTML = "";
  els.questionText.textContent = "Question text";
  els.progressText.textContent = "Question 1 of 10";
  els.progressFill.style.width = "0%";
  els.scoreText.textContent = "Score 0";
  els.streakText.textContent = "Streak 0";
  els.reviewPanel.hidden = true;
  els.missedList.innerHTML = "";
  els.reviewButton.textContent = "Review misses";
  els.continueLessonButton.hidden = true;
  renderLessonHub();
  showScreen("start");
  window.scrollTo({ top: 0, behavior: "auto" });
  focusFirstLessonButton();
}

function stopQuestionTransition() {
  state.questionTransitionId += 1;
  state.isQuestionTransitioning = false;
  els.quizScreen.classList.remove("is-transitioning");
  els.questionPanel.classList.remove("slide-out-left", "slide-in-right");
}

async function loadQuestions() {
  const response = await fetch(QUESTION_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load ${QUESTION_URL}: ${response.status}`);
  }
  return response.json();
}

function validateQuestions(questions) {
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error("Question deck must be a non-empty array.");
  }

  questions.forEach((question) => {
    const isKnownType = question.type === "multiple-choice" || question.type === "true-false";
    const choices = Array.isArray(question.choices) ? question.choices : [];
    const correctCount = choices.filter((choice) => choice.isCorrect).length;

    if (!question.id || !isKnownType || !question.question || correctCount !== 1) {
      throw new Error(`Question ${question.id || "unknown"} has invalid data.`);
    }

    if (question.type === "multiple-choice" && choices.length !== 4) {
      throw new Error(`Multiple-choice question ${question.id} must have exactly four choices.`);
    }

    if (question.type === "true-false" && choices.length !== 2) {
      throw new Error(`True/false question ${question.id} must have exactly two choices.`);
    }
  });
}

function normalizeLessons(deck) {
  if (Array.isArray(deck)) {
    return [
      {
        id: "lesson-01",
        title: "Historical Method and Minimal Facts",
        category: "Foundations",
        questions: deck
      }
    ];
  }

  if (deck && Array.isArray(deck.lessons)) {
    return deck.lessons;
  }

  throw new Error("Question deck must contain a lessons array.");
}

function validateLessons(lessons) {
  if (!Array.isArray(lessons) || lessons.length === 0) {
    throw new Error("Question deck must include at least one lesson.");
  }

  lessons.forEach((lesson, index) => {
    if (!lesson.id || !lesson.title || !Array.isArray(lesson.questions)) {
      throw new Error(`Lesson ${index + 1} has invalid data.`);
    }

    validateQuestions(lesson.questions);
  });
}

function setStartReady(isReady) {
  els.startButton.disabled = !isReady;
  els.startButton.textContent = isReady ? "Start Lesson 1" : "Loading...";
  els.startButton.hidden = true;

  if (isReady) {
    renderLessonHub();
  } else {
    els.lessonList.innerHTML = '<p class="lesson-loading">Loading lessons...</p>';
  }
}

function renderLessonHub() {
  if (!state.lessons.length) {
    els.lessonList.innerHTML = '<p class="lesson-loading">Loading lessons...</p>';
    return;
  }

  els.lessonList.innerHTML = state.lessons
    .map((lesson, index) => renderLessonCard(lesson, index))
    .join("");
}

function renderLessonCard(lesson, index) {
  const progress = state.lessonProgress[lesson.id];
  const lessonNumber = index + 1;
  const questionCount = lesson.questions.length;
  const questionLabel = `${questionCount} ${questionCount === 1 ? "question" : "questions"}`;
  const categoryLabel = [lesson.category, questionLabel].filter(Boolean).join(" · ");

  return `
    <article class="lesson-card">
      <div class="lesson-card-copy">
        <h3 class="lesson-card-title">Lesson ${lessonNumber}: ${escapeHtml(lesson.title)}</h3>
        <p class="lesson-card-meta">${escapeHtml(categoryLabel)}</p>
        ${renderLessonStatus(progress)}
      </div>
      <button
        class="primary-action lesson-card-action"
        type="button"
        data-lesson-index="${index}"
        aria-label="Start Lesson ${lessonNumber}: ${escapeHtml(lesson.title)}"
      >
        Start Lesson ${lessonNumber}
      </button>
    </article>
  `;
}

function renderLessonStatus(progress) {
  if (!progress) {
    return `
      <p class="lesson-card-status">
        <span class="lesson-score-pill is-empty">Not completed yet</span>
      </p>
    `;
  }

  const completedCount = Number(progress.completedCount) || 1;
  const completedLabel = `${completedCount} ${completedCount === 1 ? "completion" : "completions"}`;
  const completedDate = formatCompletionDate(progress.completedAt);

  return `
    <p class="lesson-card-status">
      <span class="lesson-score-pill">Last score: ${formatScore(progress.lastScore, progress.totalQuestions)}</span>
      <span class="lesson-score-pill">Best: ${formatScore(progress.bestScore, progress.totalQuestions)}</span>
      <span class="lesson-score-pill">${escapeHtml(completedDate || completedLabel)}</span>
    </p>
  `;
}

function formatScore(score, total) {
  return `${Number(score) || 0}/${Number(total) || 0}`;
}

function formatCompletionDate(timestamp) {
  if (!timestamp) {
    return "";
  }

  const completedAt = new Date(timestamp);

  if (Number.isNaN(completedAt.getTime())) {
    return "";
  }

  return `Completed ${completedAt.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  })}`;
}

function focusFirstLessonButton() {
  requestAnimationFrame(() => {
    const firstLessonButton = els.lessonList.querySelector("[data-lesson-index]");
    (firstLessonButton || els.startButton).focus({ preventScroll: true });
  });
}

function startFirstLesson() {
  startLesson(0);
}

function replayCurrentLesson() {
  startLesson(state.currentLessonIndex);
}

function continueToNextLesson() {
  const nextLessonIndex = state.currentLessonIndex + 1;

  if (nextLessonIndex < state.lessons.length) {
    startLesson(nextLessonIndex);
  }
}

function startLesson(lessonIndex) {
  const lesson = state.lessons[lessonIndex];

  if (!lesson) {
    return;
  }

  stopQuestionTransition();
  state.currentLessonIndex = lessonIndex;
  state.questions = prepareLessonQuestions(lesson);
  state.currentIndex = 0;
  state.score = 0;
  state.streak = 0;
  state.bestStreak = 0;
  state.missed = [];
  state.lessonCompletionSaved = false;
  resetQuestionState();

  showScreen("quiz");
  renderQuestion();
}

function prepareLessonQuestions(lesson) {
  const regularQuestions = lesson.questions.filter((question) => !question.isBonus);
  const bonusQuestions = lesson.questions.filter((question) => question.isBonus);

  return [...shuffleArray(regularQuestions), ...bonusQuestions].map(prepareQuestionForPlay);
}

function prepareQuestionForPlay(question) {
  const choices = question.choices.map((choice) => ({ ...choice }));
  const shouldShuffle = question.type === "multiple-choice" && question.shuffleChoices === true;

  return {
    ...question,
    displayChoices: shouldShuffle ? shuffleArray(choices) : choices
  };
}

function renderQuestion(options = {}) {
  const question = getCurrentQuestion();
  const regularTotal = getRegularQuestionTotal();
  const regularQuestionNumber = getRegularQuestionNumber();
  const shouldFocusFirstChoice = options.focusFirstChoice !== false;

  resetQuestionState();
  els.questionPanel.classList.remove("slide-out-left", "slide-in-right");
  window.scrollTo({ top: 0, behavior: "auto" });
  els.feedbackPanel.hidden = true;
  els.choiceList.innerHTML = "";
  els.progressText.textContent = question.isBonus
    ? "Bonus Question"
    : `Question ${regularQuestionNumber} of ${regularTotal}`;
  els.progressFill.style.width = question.isBonus
    ? "100%"
    : `${(regularQuestionNumber / regularTotal) * 100}%`;
  els.scoreText.textContent = `Score ${state.score}`;
  els.streakText.textContent = `Streak ${state.streak}`;
  els.questionText.textContent = question.question;

  question.displayChoices.forEach((choice, index) => {
    const button = document.createElement("button");
    button.className = "choice-button";
    button.type = "button";
    button.dataset.choiceId = choice.id;
    button.dataset.choicePosition = String(index);
    button.setAttribute("aria-label", `${ANSWER_LABELS[index]} ${choice.text}`);
    button.setAttribute("aria-pressed", "false");
    button.innerHTML = `
      <span class="choice-label" aria-hidden="true">${ANSWER_LABELS[index]}</span>
      <span class="choice-text">${escapeHtml(choice.text)}</span>
      <span class="choice-status" aria-hidden="true"></span>
    `;
    button.addEventListener("click", () => {
      void initAudioFromGesture();
      selectChoice(choice.id);
    });
    els.choiceList.appendChild(button);
  });

  if (shouldFocusFirstChoice) {
    focusFirstChoice();
  }
}

function resetQuestionState() {
  state.selectedChoiceId = null;
  state.hasCheckedAnswer = false;
  state.checkedResult = null;
  closeExplanationModal({ restoreFocus: false });
  els.quizScreen.classList.remove("is-feedback-open");
  els.feedbackPanel.hidden = true;
  els.feedbackTitle.textContent = "";
  els.feedbackTitle.classList.remove("correct", "wrong");
  els.choiceFeedback.textContent = "";
  els.correctSolution.textContent = "";
  els.correctSolution.hidden = true;
  els.explainButton.hidden = true;
  clearExplanationModal();
  els.answerActionButton.textContent = "Check";
  els.answerActionButton.disabled = true;

  els.choiceList.querySelectorAll(".choice-button").forEach((button) => {
    button.disabled = false;
    button.classList.remove("is-selected", "is-correct", "is-wrong", "is-revealed");
    button.setAttribute("aria-pressed", "false");
    const status = button.querySelector(".choice-status");
    if (status) {
      status.textContent = "";
    }
  });
}

function selectChoice(choiceId) {
  if (state.hasCheckedAnswer) {
    return;
  }

  state.selectedChoiceId = choiceId;
  els.answerActionButton.disabled = false;
  updateSelectedChoiceButtons(choiceId);
}

function updateSelectedChoiceButtons(selectedId) {
  els.choiceList.querySelectorAll(".choice-button").forEach((button) => {
    const isSelected = button.dataset.choiceId === selectedId;
    const status = button.querySelector(".choice-status");

    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));

    if (status) {
      status.textContent = isSelected ? "Selected" : "";
    }
  });
}

function handleAnswerAction() {
  if (state.isQuestionTransitioning) {
    return;
  }

  if (state.hasCheckedAnswer) {
    goToNextQuestion();
    return;
  }

  if (state.selectedChoiceId) {
    checkSelectedAnswer();
  }
}

function checkSelectedAnswer() {
  const question = getCurrentQuestion();
  const selectedChoice = question.displayChoices.find((choice) => choice.id === state.selectedChoiceId);
  const correctChoice = question.displayChoices.find((choice) => choice.isCorrect);
  const isCorrect = selectedChoice?.isCorrect === true;

  if (!selectedChoice || !correctChoice) {
    return;
  }

  state.hasCheckedAnswer = true;
  state.checkedResult = { question, selectedChoice, correctChoice, isCorrect };
  updateScore(isCorrect);
  updateChoiceButtons(selectedChoice.id, correctChoice.id, isCorrect);
  showFeedback(question, selectedChoice, correctChoice, isCorrect);
  playFeedbackSound(isCorrect);
  animateShell(isCorrect);
  els.answerActionButton.textContent = "Continue";
  els.answerActionButton.disabled = false;
  els.answerActionButton.focus({ preventScroll: true });
  keepCheckedAnswersVisible(selectedChoice.id, correctChoice.id);
}

function updateScore(isCorrect) {
  if (isCorrect) {
    state.score += 1;
    state.streak += 1;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
  } else {
    state.streak = 0;
    state.missed.push(getCurrentQuestion());
  }

  els.scoreText.textContent = `Score ${state.score}`;
  els.streakText.textContent = `Streak ${state.streak}`;
}

function updateChoiceButtons(selectedId, correctId, isCorrect) {
  const buttons = [...els.choiceList.querySelectorAll(".choice-button")];

  buttons.forEach((button) => {
    const status = button.querySelector(".choice-status");
    button.disabled = true;
    button.classList.remove("is-selected");

    if (button.dataset.choiceId === selectedId && isCorrect) {
      button.classList.add("is-correct");
      status.textContent = "Correct";
    } else if (button.dataset.choiceId === selectedId) {
      button.classList.add("is-wrong");
      status.textContent = "Your pick";
    } else if (button.dataset.choiceId === correctId) {
      button.classList.add("is-revealed");
      status.textContent = "Correct";
    }
  });
}

function showFeedback(question, selectedChoice, correctChoice, isCorrect) {
  els.quizScreen.classList.add("is-feedback-open");
  els.feedbackPanel.hidden = false;
  els.feedbackTitle.classList.toggle("correct", isCorrect);
  els.feedbackTitle.classList.toggle("wrong", !isCorrect);
  els.feedbackTitle.textContent = isCorrect ? "Correct" : "Not quite";
  els.choiceFeedback.textContent = getCompactFeedback(question, selectedChoice, isCorrect);
  els.correctSolution.hidden = true;
  els.correctSolution.textContent = "";
  els.explainButton.hidden = false;
  populateExplanationModal(question);
}

function getCompactFeedback(question, selectedChoice, isCorrect) {
  const source =
    selectedChoice.shortFeedback ||
    selectedChoice.feedback ||
    (isCorrect ? "That is the best answer." : "That is not the best answer.");

  return trimCompactText(stripStatusPrefix(source), 185);
}

function populateExplanationModal(question) {
  const fullExplanation =
    question.detailExplanation ||
    question.explanation ||
    "No additional explanation is available for this question yet.";

  setOptionalText(els.modalChoiceFeedback, "");
  setOptionalText(els.modalCorrectAnswer, "");
  setOptionalText(els.modalExplanation, fullExplanation);
}

function openExplanationModal() {
  if (!state.checkedResult) {
    return;
  }

  state.lastFocusedElement = document.activeElement;
  populateExplanationModal(state.checkedResult.question);
  els.explanationModal.hidden = false;

  requestAnimationFrame(() => {
    els.modalCloseButton.focus({ preventScroll: true });
  });
}

function closeExplanationModal(options = {}) {
  const wasOpen = !els.explanationModal.hidden;
  const shouldRestoreFocus = options.restoreFocus !== false;
  els.explanationModal.hidden = true;

  if (wasOpen && shouldRestoreFocus) {
    const focusTarget = document.contains(state.lastFocusedElement)
      ? state.lastFocusedElement
      : els.explainButton;
    focusTarget?.focus?.({ preventScroll: true });
  }

  state.lastFocusedElement = null;
}

function clearExplanationModal() {
  setOptionalText(els.modalChoiceFeedback, "");
  setOptionalText(els.modalCorrectAnswer, "");
  setOptionalText(els.modalExplanation, "");
}

function trapModalFocus(event) {
  const focusableElements = [
    ...els.explanationModal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
  ].filter((element) => !element.disabled && !element.hidden);

  if (focusableElements.length === 0) {
    return;
  }

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  if (event.shiftKey && document.activeElement === firstElement) {
    event.preventDefault();
    lastElement.focus();
  } else if (!event.shiftKey && document.activeElement === lastElement) {
    event.preventDefault();
    firstElement.focus();
  }
}

function setOptionalText(element, value) {
  const text = normalizeText(value);
  element.textContent = text;
  element.hidden = text.length === 0;
}

function getCorrectAnswerSummary(question, correctChoice) {
  return question.correctSummary || `${getChoiceLabelForQuestion(question, correctChoice.id)} - ${correctChoice.text}`;
}

function stripStatusPrefix(value) {
  return normalizeText(value).replace(/^(Correct|Not quite)\.?\s+/i, "");
}

function trimCompactText(value, maxLength) {
  const text = normalizeText(value);

  if (text.length <= maxLength) {
    return text;
  }

  const sentenceEnd = text.slice(0, maxLength).search(/[.!?]\s/);
  if (sentenceEnd > 50) {
    return text.slice(0, sentenceEnd + 1);
  }

  const wordBreak = text.lastIndexOf(" ", maxLength - 3);
  const endIndex = wordBreak > 80 ? wordBreak : maxLength - 3;
  return `${text.slice(0, endIndex).trim()}...`;
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function keepCheckedAnswersVisible(selectedId, correctId) {
  requestAnimationFrame(() => {
    const shelf = document.querySelector(".bottom-shelf");
    const visibleIds = [...new Set([selectedId, correctId])];
    const buttons = visibleIds
      .map((id) => els.choiceList.querySelector(`[data-choice-id="${cssEscape(id)}"]`))
      .filter(Boolean);

    if (!shelf || buttons.length === 0) {
      return;
    }

    const shelfTop = shelf.getBoundingClientRect().top;
    const lowestButtonEdge = Math.max(...buttons.map((button) => button.getBoundingClientRect().bottom));
    const coveredDistance = lowestButtonEdge - shelfTop + 18;

    if (coveredDistance > 0) {
      window.scrollBy({
        top: coveredDistance,
        behavior: getScrollBehavior()
      });
    }
  });
}

function focusFirstChoice() {
  requestAnimationFrame(() => {
    const firstChoice = els.choiceList.querySelector(".choice-button");
    firstChoice?.focus({ preventScroll: true });
  });
}

function getScrollBehavior() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

function cssEscape(value) {
  if (window.CSS?.escape) {
    return window.CSS.escape(value);
  }

  return String(value).replaceAll('"', '\\"');
}

function goToNextQuestion() {
  if (state.isQuestionTransitioning) {
    return;
  }

  closeExplanationModal({ restoreFocus: false });
  const nextIndex = state.currentIndex + 1;

  if (nextIndex >= state.questions.length) {
    state.currentIndex = nextIndex;
    showEndScreen();
    return;
  }

  if (prefersReducedMotion()) {
    state.currentIndex = nextIndex;
    renderQuestion();
    return;
  }

  void transitionToQuestion(nextIndex);
}

async function transitionToQuestion(nextIndex) {
  const transitionId = state.questionTransitionId + 1;
  state.questionTransitionId = transitionId;
  state.isQuestionTransitioning = true;
  els.answerActionButton.disabled = true;
  els.quizScreen.classList.add("is-transitioning");

  try {
    els.questionPanel.classList.remove("slide-out-left", "slide-in-right");
    void els.questionPanel.offsetWidth;
    els.questionPanel.classList.add("slide-out-left");
    await waitForQuestionAnimation("slide-out-left", 320);

    if (transitionId !== state.questionTransitionId) {
      return;
    }

    state.currentIndex = nextIndex;
    renderQuestion({ focusFirstChoice: false });

    void els.questionPanel.offsetWidth;
    els.questionPanel.classList.add("slide-in-right");
    await waitForQuestionAnimation("slide-in-right", 360);
  } finally {
    if (transitionId === state.questionTransitionId) {
      els.questionPanel.classList.remove("slide-out-left", "slide-in-right");
      els.quizScreen.classList.remove("is-transitioning");
      state.isQuestionTransitioning = false;
      focusFirstChoice();
    }
  }
}

function waitForQuestionAnimation(className, fallbackMs) {
  return new Promise((resolve) => {
    let isDone = false;

    const finish = () => {
      if (isDone) {
        return;
      }

      isDone = true;
      window.clearTimeout(timeoutId);
      els.questionPanel.removeEventListener("animationend", handleAnimationEnd);
      resolve();
    };

    const handleAnimationEnd = (event) => {
      if (event.target === els.questionPanel && els.questionPanel.classList.contains(className)) {
        finish();
      }
    };

    const timeoutId = window.setTimeout(finish, fallbackMs);
    els.questionPanel.addEventListener("animationend", handleAnimationEnd);
  });
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function showEndScreen() {
  closeExplanationModal({ restoreFocus: false });
  state.isQuestionTransitioning = false;
  const total = state.questions.length;
  const percent = Math.round((state.score / total) * 100);
  const hasNextLesson = state.currentLessonIndex < state.lessons.length - 1;

  saveLessonCompletion(total);
  els.resultScore.textContent = `${state.score} / ${total}`;
  els.correctCount.textContent = String(state.score);
  els.totalCount.textContent = String(total);
  els.bestStreak.textContent = String(state.bestStreak);
  els.resultMessage.textContent = getResultMessage(percent);
  els.continueLessonButton.hidden = !hasNextLesson;
  els.continueLessonButton.textContent = hasNextLesson
    ? `Continue to Lesson ${state.currentLessonIndex + 2}`
    : "";
  els.restartButton.classList.toggle("primary-action", !hasNextLesson);
  els.restartButton.classList.toggle("secondary-action", hasNextLesson);
  els.reviewButton.hidden = state.missed.length === 0;
  els.reviewButton.textContent = "Review misses";
  els.reviewPanel.hidden = true;
  renderMissedReview();
  showScreen("end");
  els.progressFill.style.width = "100%";
  const focusTarget = hasNextLesson ? els.continueLessonButton : els.restartButton;
  focusTarget.focus({ preventScroll: true });
}

function renderMissedReview() {
  els.missedList.innerHTML = "";

  state.missed.forEach((question) => {
    const correctChoice = question.displayChoices.find((choice) => choice.isCorrect);
    const item = document.createElement("article");
    item.className = "missed-item";
    item.innerHTML = `
      <p><strong>${escapeHtml(question.question)}</strong></p>
      <p class="missed-answer">Answer: ${escapeHtml(correctChoice.text)}</p>
      <p>${escapeHtml(question.explanation || "")}</p>
    `;
    els.missedList.appendChild(item);
  });
}

function toggleMissedReview() {
  const willShow = els.reviewPanel.hidden;
  els.reviewPanel.hidden = !willShow;
  els.reviewButton.textContent = willShow ? "Hide review" : "Review misses";
}

function showScreen(screenName) {
  els.startScreen.hidden = screenName !== "start";
  els.quizScreen.hidden = screenName !== "quiz";
  els.endScreen.hidden = screenName !== "end";

  els.startScreen.classList.toggle("screen-active", screenName === "start");
  els.quizScreen.classList.toggle("screen-active", screenName === "quiz");
  els.endScreen.classList.toggle("screen-active", screenName === "end");
}

function getCurrentQuestion() {
  return state.questions[state.currentIndex];
}

function getCurrentLesson() {
  return state.lessons[state.currentLessonIndex];
}

function getRegularQuestionTotal() {
  return state.questions.filter((question) => !question.isBonus).length;
}

function getRegularQuestionNumber() {
  const questionsSoFar = state.questions.slice(0, state.currentIndex + 1);
  return questionsSoFar.filter((question) => !question.isBonus).length;
}

function getChoiceLabel(choiceId) {
  return getChoiceLabelForQuestion(getCurrentQuestion(), choiceId);
}

function getChoiceLabelForQuestion(question, choiceId) {
  const index = question.displayChoices.findIndex((choice) => choice.id === choiceId);
  return ANSWER_LABELS[index] || "?";
}

function getResultMessage(percent) {
  if (percent === 100) {
    return "Perfect lesson. You handled this set cleanly.";
  }

  if (percent >= 80) {
    return "Strong round. A quick review of the misses should lock in the weaker spots.";
  }

  if (percent >= 60) {
    return "Solid start. The review list will help connect the historical methods to the arguments.";
  }

  return "Good practice round. Replay once or twice and watch for the evidence, context, and explanation pattern.";
}

function shuffleArray(items) {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}

function restoreLessonProgress() {
  try {
    const storedValue = localStorage.getItem(LESSON_PROGRESS_KEY);
    const parsedValue = storedValue ? JSON.parse(storedValue) : {};
    state.lessonProgress = isPlainObject(parsedValue) ? parsedValue : {};
  } catch (error) {
    console.warn("Lesson progress could not be loaded.", error);
    state.lessonProgress = {};
  }
}

function saveLessonCompletion(totalQuestions) {
  if (state.lessonCompletionSaved) {
    return;
  }

  const lesson = getCurrentLesson();

  if (!lesson) {
    return;
  }

  const previousProgress = state.lessonProgress[lesson.id] || {};
  const previousBest = Number(previousProgress.bestScore) || 0;
  const completedCount = (Number(previousProgress.completedCount) || 0) + 1;
  const lessonProgress = {
    lessonId: lesson.id,
    lastScore: state.score,
    totalQuestions,
    bestScore: Math.max(previousBest, state.score),
    completedCount,
    completedAt: new Date().toISOString()
  };

  state.lessonProgress = {
    ...state.lessonProgress,
    [lesson.id]: lessonProgress
  };
  state.lessonCompletionSaved = true;
  persistLessonProgress();
  renderLessonHub();
}

function persistLessonProgress() {
  try {
    localStorage.setItem(LESSON_PROGRESS_KEY, JSON.stringify(state.lessonProgress));
  } catch (error) {
    console.warn("Lesson progress could not be saved.", error);
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function restoreSoundPreference() {
  const storedValue = localStorage.getItem(SOUND_PREF_KEY);
  state.soundEnabled = storedValue === null ? true : storedValue === "true";
  updateSoundToggle();
}

function toggleSound() {
  state.soundEnabled = !state.soundEnabled;
  localStorage.setItem(SOUND_PREF_KEY, String(state.soundEnabled));
  updateSoundToggle();

  if (state.soundEnabled) {
    void playToneSequence(TOGGLE_SOUND_NOTES, "correct");
  }
}

function updateSoundToggle() {
  const soundIsUsable = state.soundEnabled && !state.audioUnavailable;
  els.soundToggle.setAttribute("aria-pressed", String(soundIsUsable));
  els.soundToggleText.textContent = state.audioUnavailable
    ? "Sound unavailable"
    : state.soundEnabled ? "Sound on" : "Sound off";
  els.soundToggle.querySelector(".sound-icon").textContent = soundIsUsable ? "♪" : "x";
}

function playFeedbackSound(isCorrect) {
  const notes = isCorrect ? CORRECT_SOUND_NOTES : WRONG_SOUND_NOTES;
  const fallbackName = isCorrect ? "correct" : "wrong";
  void playToneSequence(notes, fallbackName);
}

async function initAudioFromGesture() {
  audioDebug("initAudioFromGesture called", {
    soundEnabled: state.soundEnabled,
    webAudioState: state.audioContext?.state || "none",
    fallbackAudioReady: state.fallbackAudioReady
  });

  if (state.audioUnlockPromise) {
    return state.audioUnlockPromise;
  }

  state.audioUnlockPromise = (async () => {
    try {
      const fallbackPromise = initFallbackAudioFromGesture();
      const webAudioPromise = initWebAudioFromGesture();
      const [fallbackReady, webAudioReady] = await Promise.all([
        fallbackPromise,
        webAudioPromise
      ]);

      state.audioUnlocked = webAudioReady || fallbackReady;
      updateAudioAvailability();
      audioDebug("Audio init complete", {
        audioUnlocked: state.audioUnlocked,
        webAudioReady,
        fallbackReady,
        webAudioState: state.audioContext?.state || "none",
        audioUnavailable: state.audioUnavailable
      });

      return state.audioUnlocked;
    } finally {
      state.audioUnlockPromise = null;
    }
  })();

  return state.audioUnlockPromise;
}

function unlockAudio() {
  return initAudioFromGesture();
}

async function initWebAudioFromGesture() {
  if (state.webAudioUnavailable) {
    audioDebug("Web Audio previously marked unavailable");
    return false;
  }

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass) {
    state.webAudioUnavailable = true;
    audioDebug("Web Audio unsupported");
    updateAudioAvailability();
    return false;
  }

  try {
    if (!state.audioContext || state.audioContext.state === "closed") {
      state.audioContext = new AudioContextClass();
      audioDebug("AudioContext created", { state: state.audioContext.state });
    }

    audioDebug("AudioContext before resume", { state: state.audioContext.state });

    if (state.audioContext.state !== "running" && typeof state.audioContext.resume === "function") {
      await Promise.race([
        state.audioContext.resume(),
        waitForAudioUnlockTimeout()
      ]);
    }

    audioDebug("AudioContext after resume", { state: state.audioContext.state });

    if (state.audioContext.state === "running") {
      primeAudioContext();
      return true;
    }

    return false;
  } catch (error) {
    audioWarn("Web Audio could not be initialized.", error);
    return false;
  }
}

async function initFallbackAudioFromGesture() {
  if (!initFallbackAudioElements()) {
    updateAudioAvailability();
    return false;
  }

  if (state.fallbackAudioReady) {
    audioDebug("Fallback audio already primed");
    return true;
  }

  const fallbackAudios = [
    state.correctFallbackAudio,
    state.wrongFallbackAudio
  ].filter(Boolean);

  const results = await Promise.allSettled(fallbackAudios.map(primeFallbackAudio));
  const wasPrimed = results.some((result) => result.status === "fulfilled" && result.value === true);

  state.fallbackAudioReady = state.fallbackAudioReady || wasPrimed;
  audioDebug("Fallback audio init complete", {
    fallbackAudioReady: state.fallbackAudioReady,
    primedThisGesture: wasPrimed
  });

  return state.fallbackAudioReady;
}

function initFallbackAudioElements() {
  if (state.correctFallbackAudio && state.wrongFallbackAudio) {
    return true;
  }

  if (typeof Audio === "undefined") {
    state.fallbackAudioUnavailable = true;
    audioDebug("HTMLAudioElement fallback unsupported");
    return false;
  }

  try {
    const soundUrls = getFallbackSoundUrls();
    state.correctFallbackAudio = createFallbackAudioElement("correct", soundUrls.correct);
    state.wrongFallbackAudio = createFallbackAudioElement("wrong", soundUrls.wrong);
    state.fallbackAudioUnavailable = false;
    audioDebug("Fallback audio elements created");
    return true;
  } catch (error) {
    state.fallbackAudioUnavailable = true;
    audioWarn("Fallback audio elements could not be created.", error);
    return false;
  }
}

function createFallbackAudioElement(kind, sourceUrl) {
  const audio = new Audio(sourceUrl);
  audio.preload = "auto";
  audio.dataset.soundKind = kind;
  audio.setAttribute("preload", "auto");
  audio.setAttribute("playsinline", "");
  audio.setAttribute("webkit-playsinline", "");
  return audio;
}

async function primeFallbackAudio(audio) {
  const originalMuted = audio.muted;
  const originalVolume = audio.volume;

  try {
    audio.load();
    audio.muted = !state.soundEnabled;
    audio.volume = state.soundEnabled ? 0.001 : 0;
    audio.currentTime = 0;

    const playPromise = audio.play();

    if (playPromise && typeof playPromise.then === "function") {
      await Promise.race([
        playPromise,
        waitForAudioUnlockTimeout()
      ]);
    }

    audio.pause();
    audio.currentTime = 0;
    audioDebug("Fallback audio primed", { kind: audio.dataset.soundKind });
    return true;
  } catch (error) {
    audioWarn("Fallback audio priming failed.", error);
    return false;
  } finally {
    audio.muted = originalMuted;
    audio.volume = originalVolume;
  }
}

function updateAudioAvailability() {
  state.audioUnavailable = state.webAudioUnavailable && state.fallbackAudioUnavailable;
  updateSoundToggle();
}

function waitForAudioUnlockTimeout() {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 750);
  });
}

function primeAudioContext() {
  if (!state.audioContext || state.audioPrimed) {
    return;
  }

  try {
    const source = state.audioContext.createBufferSource();
    const gain = state.audioContext.createGain();
    source.buffer = state.audioContext.createBuffer(1, 1, state.audioContext.sampleRate);
    gain.gain.setValueAtTime(0.00001, state.audioContext.currentTime);
    source.connect(gain).connect(state.audioContext.destination);
    source.start(0);
    state.audioPrimed = true;
    audioDebug("Web Audio primed");
  } catch (error) {
    audioWarn("Audio priming was skipped.", error);
  }
}

async function playToneSequence(notes, fallbackName) {
  if (!state.soundEnabled) {
    audioDebug("Sound muted; play skipped", { fallbackName });
    return;
  }

  const shouldPreferFallback = isIOSDevice();

  if (shouldPreferFallback) {
    initFallbackAudioElements();
    const immediateFallbackPlayed = await playFallbackSound(fallbackName);

    if (immediateFallbackPlayed) {
      void initAudioFromGesture();
      return;
    }
  }

  await initAudioFromGesture();

  if (shouldPreferFallback) {
    const fallbackPlayed = await playFallbackSound(fallbackName);

    if (fallbackPlayed) {
      return;
    }
  }

  const webAudioPlayed = playWebAudioSequence(notes);

  if (!webAudioPlayed) {
    await playFallbackSound(fallbackName);
  }
}

function playWebAudioSequence(notes) {
  if (!state.audioContext || state.audioContext.state !== "running") {
    audioDebug("Web Audio play skipped", {
      state: state.audioContext?.state || "none"
    });
    return false;
  }

  try {
    const now = state.audioContext.currentTime;

    notes.forEach((note) => {
      const oscillator = state.audioContext.createOscillator();
      const gain = state.audioContext.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(note.frequency, now + note.start);
      gain.gain.setValueAtTime(0.0001, now + note.start);
      gain.gain.exponentialRampToValueAtTime(note.gain, now + note.start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + note.start + note.duration);
      oscillator.connect(gain).connect(state.audioContext.destination);
      oscillator.start(now + note.start);
      oscillator.stop(now + note.start + note.duration + 0.02);
    });

    audioDebug("Web Audio play attempted", { noteCount: notes.length });
    return true;
  } catch (error) {
    audioWarn("Web Audio play failed.", error);
    return false;
  }
}

async function playFallbackSound(fallbackName) {
  const audio = getFallbackAudio(fallbackName);

  if (!audio) {
    audioDebug("Fallback audio play skipped; no audio element", { fallbackName });
    return false;
  }

  try {
    audio.pause();
    audio.currentTime = 0;
    audio.muted = false;
    audio.volume = 1;
    audioDebug("Fallback audio play attempted", { fallbackName });

    const playPromise = audio.play();

    if (playPromise && typeof playPromise.then === "function") {
      await playPromise;
    }

    return true;
  } catch (error) {
    audioWarn("Fallback audio play failed.", error);
    return false;
  }
}

function getFallbackAudio(fallbackName) {
  if (fallbackName === "wrong") {
    return state.wrongFallbackAudio;
  }

  return state.correctFallbackAudio;
}

function getFallbackSoundUrls() {
  if (!state.fallbackSoundUrls) {
    state.fallbackSoundUrls = {
      correct: createWavDataUrl(CORRECT_SOUND_NOTES),
      wrong: createWavDataUrl(WRONG_SOUND_NOTES)
    };
  }

  return state.fallbackSoundUrls;
}

function createWavDataUrl(notes) {
  const sampleRate = 22050;
  const endTime = Math.max(...notes.map((note) => note.start + note.duration)) + 0.05;
  const sampleCount = Math.ceil(endTime * sampleRate);
  const bytes = new Uint8Array(44 + sampleCount * 2);
  const view = new DataView(bytes.buffer);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + sampleCount * 2, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, sampleCount * 2, true);

  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    const time = sampleIndex / sampleRate;
    const sample = notes.reduce((total, note) => {
      const localTime = time - note.start;

      if (localTime < 0 || localTime > note.duration) {
        return total;
      }

      const fadeIn = Math.min(1, localTime / 0.012);
      const fadeOut = Math.min(1, (note.duration - localTime) / 0.03);
      const envelope = Math.max(0, Math.min(fadeIn, fadeOut));
      return total + Math.sin(2 * Math.PI * note.frequency * localTime) * note.gain * envelope;
    }, 0);
    const clampedSample = Math.max(-0.9, Math.min(0.9, sample));
    view.setInt16(44 + sampleIndex * 2, clampedSample * 0x7fff, true);
  }

  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return `data:audio/wav;base64,${window.btoa(binary)}`;
}

function writeAscii(view, offset, value) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function isIOSDevice() {
  if (typeof navigator === "undefined") {
    return false;
  }

  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function audioDebug(message, details) {
  if (!DEBUG_AUDIO) {
    return;
  }

  if (details === undefined) {
    console.info(`[quiz audio] ${message}`);
  } else {
    console.info(`[quiz audio] ${message}`, details);
  }
}

function audioWarn(message, error) {
  if (!DEBUG_AUDIO) {
    return;
  }

  console.warn(`[quiz audio] ${message}`, error);
}

function animateShell(isCorrect) {
  const target = isCorrect ? els.feedbackPanel : els.choiceList;
  const className = isCorrect ? "bump" : "shake";
  target.classList.remove(className);
  void target.offsetWidth;
  target.classList.add(className);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
