# LLM Architecture & Constraints Guide
**Project:** Latin Vocabulary Study App

## RETIRED CONSTRAINT: THE BRACKET BUG (lifted 2026-07-21)
**Square brackets are now allowed in new code.** This codebase used to be maintained through a
chat interface with a markdown-parsing bug that silently deleted brackets and their contents, so
the code avoids array literals, index accessors, and bracketed regex character classes throughout.
**That interface is no longer the maintenance path — the repo is now edited directly (Claude Code),
which has no such bug.**

**But DO NOT sweep the existing idioms.** `new Array()`, `.slice(0, 1).pop()` and `\x5b`/`\x5d`
appear all over `app.js`. They are ugly but correct, cost nothing at runtime, and rewriting ~780
lines of working search/sort/regex logic in a tool that students depend on is risk with no
user-visible benefit. The policy is:

*   **New code**: use normal idioms (`[]`, `arr[0]`, `[a-z]`).
*   **Existing code**: modernize a line only when you are already editing that function for a real
    reason. No standalone cleanup passes.
*   Note that the worst offenders — `parseCSV` and `parseFormsCSV` — are slated for deletion if the
    app moves to a JSON bundle, so most of this cleans itself up for free. Do not pre-empt it.

## Application Architecture
*   **Stack:** Vanilla HTML5, CSS3, ES6 JavaScript. No frameworks.
*   **Data Source:** `vocabulary.csv` (Lemmata) and `forms.csv` (Inflected forms). Fetched dynamically via Promises.
*   **State Management:** `studyList` is maintained in a global Set/Array and persisted via `localStorage` (Key: `latinStudyList`).
*   **CSS Theming:** Uses CSS variables (`:root`) for all colors. Responsive mobile layout relies on a sliding off-canvas menu (`#word-wheel-container.mobile-visible`).

## Search Engine Logic (`app.js`)
The search engine is highly optimized for Latin pedagogy. If modifying `onSearchInput`, you must respect these rules:
1.  **Normalization (`normalizeForSearch`):** Strips punctuation, applies NFD normalization, removes diacritics, and converts `j` to `i` (for legacy text compatibility).
2.  **The Space-Prefix Rule:** To ensure search terms only match the *start* of a word (preventing "sum" from matching "ipsum"), a space character is artificially prepended to both the search string and the target string before `.includes()` is evaluated.
3.  **One-Way Strictness (`checkOneWayMatch`):** Compares raw user input against raw dictionary strings. If the user explicitly typed a macron, it forces a strict match. If they typed a standard vowel, it accepts both short and macron vowels.
4.  **Sorting Hierarchy:** 
    *   *Priority 1:* Exact Matches (`isExact: true`)
    *   *Priority 2:* Dictionary Lemmata > Inflected Forms
    *   *Priority 3:* Dictionary Frequency (Highest to Lowest)
    *   *Priority 4:* Alphabetical Fallback

## Markup Parsing (`formatDefinitionHTML`)
Definitions are parsed dynamically before being injected into `innerHTML`. Order of regex operations is critical:
1. Grammar Links w/ IDs: `\{\{(.*?)\|(.*?)\}\}` -> `<span data-pharr-id="$2">`
2. Grammar Links w/o IDs: `\{\{(.*?)\}\}` -> `<span data-pharr-id="pending">`
3. Idioms: `\x5b\x5b(.*?)\x5d\x5d` -> `<span class="idiom-phrase">`
4. Commentary: `\{(.*?)\}` -> `<span class="def-comment">`
5. Latin in Context: `\*(.*?)\*` -> `<span class="latin-in-context">`