# AcademIA — Final Video (English) · Narration Script

**Deliverable:** `AcademIA_Video_Final_EN.mp4` — 1920×1080, ~4:52, H.264/AAC.
**Voice:** Gemini TTS (voice *Algieba*). Segments 1–13 via `gemini-3.1-flash-tts-preview`;
the closing (14) via `gemini-2.5-flash-preview-tts` (same voice) because the 3.1 daily
quota was exhausted — re-render segment 14 with 3.1 later for perfect timbre uniformity.

**Structure:** 8 narrated slides → 5 live-app screens (logged-in demo) → closing slide.
Covers the requested points: project overview, SMART objectives, per-sprint work,
whether goals were met (honestly), and the final product delivered.

> Integrity note: the measurable targets (≥80% / ≥70% / ≥50%) are stated as **planned,
> not yet measured** — no fabricated results, matching the ENEGEP article.

---

### 1 · Cover (slide01)
Meet AcademIA — an AI academic assistant built by five industrial-engineering students at the University of Brasília, for the PSP2 course. In the next few minutes: what we set out to do, what we built across five sprints, and what we actually delivered.

### 2 · The Problem (slide02)
The problem we started from: students already use generative AI every day, but they paste a PDF or a photo into a tool that knows nothing about their course or their exam. And a typical student loses three to five hours a week just organizing scattered material. The gap isn't AI — it's context and organization.

### 3 · The Solution (slide03)
AcademIA closes that gap. The student drops in raw material and gets back a reliable summary of each document, automatically organized by subject in their own Google Drive, plus ready-to-use prompts for any AI. Four steps: upload, understand, condense, study. Less time organizing, more time learning.

### 4 · SMART Objective (slide04)
Our goal was one SMART objective. Specific: a working web system that ingests raw academic documents, processes them with a language model, exports them organized to Google Drive, and generates a personalized system prompt. Measurable: at least eighty percent correct processing over fifty documents, seventy percent satisfaction, and a fifty percent cut in organization time. Achievable: five people, free-tier AI, zero-cost infrastructure, five sprints. Relevant: it attacks the wasted time and missing context directly. And time-bound: delivered by June twenty-fifth, twenty twenty-six.

### 5 · The Five Sprints (slide05)
Five sprints. Sprint one, Foundation: authentication, the upload pipeline, the core architecture. Sprint two, Intelligence: the five-stage AI pipeline, with a four-layer validation guard. Sprint three, Hardening: turning loose parts into a secure product, guided by four rounds of auditing — around two hundred findings, including one critical flaw we fixed. Sprint four, the Article: a full paper under Design Science Research. And sprint five, the Customer Journey: the whole student experience, from onboarding to daily study.

### 6 · Were the goals achieved? (slide06)
Did we hit the goals? The engineering objectives, yes — the prototype runs end-to-end across all five formats, with security hardening and the paper complete. But we're honest about the measurable targets: the eighty, seventy and fifty percent were fully designed, but not yet measured, because they need a public deployment we couldn't fund this cycle. So we report zero fabricated numbers. The artifact is delivered; the measurement is the next step.

### 7 · The Final Product (slide07)
So what did we ship? The artifact itself — and it's portable. For every document: a synthesized Markdown file with formulas preserved, a folder structure mirrored in Google Drive, and a personalized system prompt with an editable prompt library. We even went beyond scope, adding AI-generated flashcards with LaTeX and spaced repetition. The delivered product ended up bigger than the plan.

### 8 · Live product (slide08 → app)
That's the summary. Now let's see the product actually running.

### 9 · Dashboard (shot_dashboard)
This is the student's dashboard — the daily cockpit: the next class, the subjects with material uploaded, flashcards reviewed this week, and progress by subject, all in the University of Brasília's identity.

### 10 · Documents (shot_documents)
Document management: every file the student uploaded, classified by subject, with live metrics and a clear status for each one as it moves through the pipeline.

### 11 · Reader (shot_reader)
Open any document and you get the generated summary — clean Markdown, with LaTeX formulas and tables preserved exactly, plus compact and cheat-sheet versions.

### 12 · Flashcards (shot_deck)
From those same materials, AcademIA generates flashcards — here, with real LaTeX math — studied with spaced repetition to lock the content in.

### 13 · Prompt library (shot_prompts)
And a library of ready-to-use prompts, portable to any AI — ChatGPT, Claude or Gemini — next to the student's own personalized system prompt.

### 14 · Closing (slide09)
To wrap up: the goal was a working academic AI assistant — and that artifact is delivered. Next comes deployment, the empirical evaluation, and carrying this forward as undergraduate research. The course ends here; the research begins. Thank you.
