# Resurrection Game Demo

This is a static proof-of-concept browser quiz game for helping users practice key facts, arguments, and historical reasoning concepts related to *The Case for the Resurrection of Jesus* by Gary Habermas and Michael Licona.

The demo is intentionally self-contained. It uses vanilla HTML, CSS, and JavaScript, loads its lesson and question data from `questions.json`, and does not require a backend, package manager, build step, framework, or external asset.

## Run locally

Serve the folder with any static web server. For example:

```bash
cd resurrection-game-demo
python3 -m http.server
```

Then open the local URL shown in the terminal, usually `http://localhost:8000/`.

## Why a local server is needed

The game loads `questions.json` with `fetch()`. Most browsers block `fetch()` from reading local files when the page is opened directly with a `file://` URL. A local static server serves the HTML, CSS, JavaScript, and JSON over `http://localhost`, which lets the browser load the question deck normally.

## Add or edit questions

Edit `questions.json`. The file is organized by lesson:

```json
{
  "lessons": [
    {
      "id": "lesson-01",
      "title": "Historical Method and Minimal Facts",
      "category": "Foundations",
      "questions": []
    }
  ]
}
```

Each question uses this shape:

```json
{
  "id": "q001",
  "type": "multiple-choice",
  "category": "Historical Method",
  "difficulty": "beginner",
  "shuffleChoices": true,
  "question": "Question text here?",
  "choices": [
    {
      "id": "minimal-facts",
      "text": "The minimal facts approach",
      "isCorrect": true,
      "feedback": "Explanation for this choice."
    }
  ],
  "explanation": "Short explanation shown after the answer is selected."
}
```

Multiple-choice questions should have exactly four choices. True/false questions should have exactly two choices in this order: `True`, then `False`.

Do not include visible answer letters such as `A.` or `B.` in ordinary choice text. The game assigns answer labels at render time. If a question has combination wording such as `A, B, and C` or `All of the above`, set `"shuffleChoices": false` so the answer references remain stable.

Regular questions are shuffled within a lesson. To place a question after the regular set, add `"isBonus": true`; bonus questions are shown after the shuffled regular questions and use `Bonus Question` progress text.
