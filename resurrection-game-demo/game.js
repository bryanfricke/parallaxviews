const QUESTION_URL = "questions.json";
const SOUND_PREF_KEY = "resurrectionQuizSoundEnabled";
const ANSWER_LABELS = ["A", "B", "C", "D"];

const state = {
  lessons: [],
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
  soundEnabled: true,
  audioContext: null,
  audioUnlocked: false,
  audioPrimed: false,
  audioUnavailable: false,
  audioUnlockPromise: null
};

const els = {
  startScreen: document.getElementById("startScreen"),
  quizScreen: document.getElementById("quizScreen"),
  endScreen: document.getElementById("endScreen"),
  startButton: document.getElementById("startButton"),
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
  els.startButton.addEventListener("click", withAudioUnlock(startFirstLesson));
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
      void unlockAudio();
      const button = els.choiceList.querySelector(`[data-choice-position="${keyNumber - 1}"]`);
      button?.click();
      return;
    }

    const letterIndex = ANSWER_LABELS.indexOf(event.key.toUpperCase());
    if (letterIndex >= 0) {
      void unlockAudio();
      const button = els.choiceList.querySelector(`[data-choice-position="${letterIndex}"]`);
      button?.click();
    }
  });
}

function withAudioUnlock(callback) {
  return (...args) => {
    void unlockAudio();
    callback(...args);
  };
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

  state.currentLessonIndex = lessonIndex;
  state.questions = prepareLessonQuestions(lesson);
  state.currentIndex = 0;
  state.score = 0;
  state.streak = 0;
  state.bestStreak = 0;
  state.missed = [];
  state.isQuestionTransitioning = false;
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
      void unlockAudio();
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
  state.isQuestionTransitioning = true;
  els.answerActionButton.disabled = true;
  els.quizScreen.classList.add("is-transitioning");

  try {
    els.questionPanel.classList.remove("slide-out-left", "slide-in-right");
    void els.questionPanel.offsetWidth;
    els.questionPanel.classList.add("slide-out-left");
    await waitForQuestionAnimation("slide-out-left", 320);

    state.currentIndex = nextIndex;
    renderQuestion({ focusFirstChoice: false });

    void els.questionPanel.offsetWidth;
    els.questionPanel.classList.add("slide-in-right");
    await waitForQuestionAnimation("slide-in-right", 360);
  } finally {
    els.questionPanel.classList.remove("slide-out-left", "slide-in-right");
    els.quizScreen.classList.remove("is-transitioning");
    state.isQuestionTransitioning = false;
    focusFirstChoice();
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
    void playToneSequence([
      { frequency: 660, start: 0, duration: 0.06, gain: 0.08 },
      { frequency: 880, start: 0.07, duration: 0.08, gain: 0.08 }
    ]);
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
  if (isCorrect) {
    void playToneSequence([
      { frequency: 523.25, start: 0, duration: 0.07, gain: 0.07 },
      { frequency: 659.25, start: 0.08, duration: 0.07, gain: 0.08 },
      { frequency: 783.99, start: 0.16, duration: 0.09, gain: 0.08 }
    ]);
  } else {
    void playToneSequence([
      { frequency: 220, start: 0, duration: 0.09, gain: 0.055 },
      { frequency: 185, start: 0.11, duration: 0.12, gain: 0.045 }
    ]);
  }
}

async function unlockAudio() {
  if (state.audioUnavailable || state.audioUnlocked) {
    return state.audioUnlocked;
  }

  if (state.audioUnlockPromise) {
    return state.audioUnlockPromise;
  }

  state.audioUnlockPromise = (async () => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {
      state.audioUnavailable = true;
      updateSoundToggle();
      return false;
    }

    try {
      if (!state.audioContext || state.audioContext.state === "closed") {
        state.audioContext = new AudioContextClass();
      }

      if (state.audioContext.state !== "running" && typeof state.audioContext.resume === "function") {
        await Promise.race([
          state.audioContext.resume(),
          waitForAudioUnlockTimeout()
        ]);
      }

      if (state.audioContext.state === "running") {
        primeAudioContext();
        state.audioUnlocked = true;
      }

      return state.audioUnlocked;
    } catch (error) {
      console.warn("Audio could not be initialized.", error);
      return false;
    } finally {
      state.audioUnlockPromise = null;
    }
  })();

  return state.audioUnlockPromise;
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
  } catch (error) {
    console.warn("Audio priming was skipped.", error);
  }
}

async function playToneSequence(notes) {
  if (!state.soundEnabled) {
    return;
  }

  const isAudioReady = await unlockAudio();
  if (!isAudioReady || !state.audioContext || state.audioContext.state !== "running") {
    return;
  }

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
