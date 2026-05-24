# Feasibility Review & Architectural Comments - WordLover

This document compiles the engineering review comments, feasibility assessments, and alternative tech solutions for the **WordLover** product requirements and architecture.

---

## 1. Executive Feasibility Assessment

| Metric | Rating | Detail |
| :--- | :--- | :--- |
| **Client-Side Portability (Vite + React)** | **Extremely High** | Excellent pairing of React 19 state handles with local browser local storage. Safe, immediate client responsiveness. |
| **Spaced Repetition Algorithm (SM-2)** | **High Feasibility** | Simple mathematical iterations of interval lengths, repetitions ($N$), and ease factors ($EF$). Can run entirely client-side. |
| **AI Generation (Gemini 3.5 Flash)** | **Highly Feasible** | Prompt limits are well within bounds. Streaming responses over server endpoints solves token usage latency. |
| **Dynamic Daily Challenges** | **Moderate Feasibility** | If generated on-the-fly via AI, latency may affect first-paint times. A static client pool fallback is recommended. |
| **Storage Scalability** | **Low-Moderate Feasibility** | Relying on `localStorage` poses severe data replacement and size limits (~5MB maximum), leading to risk of data loss on browser cache wipes. |

---

## 2. Deep-Dive Code Review & Design Comments

### 2.1 The Spaced Repetition Scheduling Loop
*   **The Issue:** The initial SM-2 algorithm does not specify fractional review intervals. If a user sets a card's interval to 1 day ($I = 1$), and revisits 2 hours later, they face immediate re-review or interval compounding, creating redundant learning sessions.
*   **The Better Solution:** Implement a **Review Backlog Grace Window**. Filter cards for review where:
    $$\text{now} \ge \text{nextReviewDate} - \epsilon$$
    where $\epsilon \approx 12\text{ hours}$ to allow students to group their reviews per day without penalizing algorithm calculations.

### 2.2 Feasibility of Browser `localStorage` for Vocabularies
*   **The Issue:** A learner adding custom dictionary entries, storing multiple review records, and tracking daily stats will eventually overflow the standard $5\text{MB}$ synchronous `localStorage` limit. Additionally, `localStorage` can be wiped by the operating system (e.g., iOS Safari) if disk space runs low.
*   **The Better Solution:**
    1.  *Near-term:* Switch to standard browser **IndexedDB** (using lightweight libraries like `idb` or `localforage`) which supports up to 50%+ of free disk space.
    2.  *Long-term:* Transition to **Firebase Firestore** via the `firebase-integration` skill. This allows account synchronization so users can access cards seamlessly on mobile and desktop without data wipe vulnerabilities.

### 2.3 AI Prompt Structuring for Vocab Details
*   **The Issue:** Requesting unconstrained text generation from Gemini models can lead to markdown formatting shifts, unexpected emojis, and hard-to-parse responses.
*   **The Better Solution:** Leverage **Gemini Structured Output JSON Schema**. Define the exact JSON schema in the configuration block of `ai.models.generateContent` ensuring predictable structure:
    ```json
    {
      "type": "object",
      "properties": {
        "word": { "type": "string" },
        "phonetics": { "type": "string" },
        "definition": { "type": "string" },
        "exampleSentence": { "type": "string" },
        "synonyms": { "type": "array", "items": { "type": "string" } }
      },
      "required": ["word", "phonetics", "definition", "exampleSentence"]
    }
    ```

### 2.4 Daily Challenge Generation Bottlenecks
*   **The Issue:** Booting the vocabulary platform and waiting for 3 customized AI challenges on first-load introduces a 2–4 second latency delay.
*   **The Better Solution:** Adopt a **Pre-Compiled Seed Vocab Database** directly inside the React application containing static packages of daily quizzes. If the user requests an "infinite practice mode" or specialized topic, offload *that* dynamically to the Gemini route.

---

## 3. Recommended Optimization Blueprint

1.  **Stage 1 - Prototype (Implemented):** Rely on modularized React functional sub-states, local storage caches, and seamless Framer animations. Integrate a server-side Express proxy for secure Gemini lookups and sentence completion helpers.
2.  **Stage 2 - DB Sync (Recommended):** Integrate Firebase Auth + Firestore so cards, intervals, and streaks persist on the cloud. Security rules govern that only the authentic owner can mutate their scheduling tables.
3.  **Stage 3 - Offline Support:** Add service workers (PWA wrapper) enabling offline reviews with cached audio pronunciations.
