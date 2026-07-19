# LLM Architecture & Constraints Guide
**Project:** Latin Vocabulary Study App

## CRITICAL CONSTRAINT: THE BRACKET BUG
**DO NOT USE SQUARE BRACKETS IN ANY GENERATED CODE.** 
This codebase is maintained through a chat interface that contains an aggressive markdown-parsing bug. It will silently delete any square brackets and the text inside them. 
*   **DO NOT** use array literals. Use `new Array()` or `Array.of()`.
*   **DO NOT** use array index accessors. Use `.slice(0, 1).pop()` or `.charAt()`.
*   **DO NOT** use bracketed Character Classes in Regular Expressions. Use string alternation `(a|b)`, hexadecimal unicode escapes, or `\p{Category}` where possible. To target square brackets in regex, you MUST use `\x5b` and `\x5d`.

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