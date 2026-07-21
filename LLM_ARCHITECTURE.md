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
1. Grammar link, explicit target: `\{\{([^{}|]*?)\|([^{}]*?)\}\}` -> `<a class="grammar-link">`
2. Grammar link, plain: `\{\{([^{}]*?)\}\}` -> same, the label doubling as the id
3. Idioms: `\x5b\x5b(.*?)\x5d\x5d` -> `<span class="idiom-phrase">`
4. Commentary: `\{(.*?)\}` -> `<span class="def-comment">`
5. Latin in Context: `\*(.*?)\*` -> `<span class="latin-in-context">`

## Pharr Grammar Links
A `{{tagged}}` term becomes a real `<a target="_blank">` to the editor's digital Pharr
appendix. `pharrHref` decides the destination:

| tag | opens |
|---|---|
| `{{ablative}}` | `#term=ablative` — the **glossary entry** |
| `{{takes the ablative\|ablative}}` | same; the pipe supplies the term when the visible text isn't it |
| `{{ablative\|§342}}` | `#s342` — a deliberate **narrowing** to one section |

**The default target is the glossary entry, not a section, and that is the whole
design.** The entry is a hub: Pharr's own definition, the editor's plain-English
expansion, and a "Kinds" menu listing each construction with its section. A student
who has forgotten what an ablative is and lands on §30 reads "the case of adverbial
relation" — true, and no help. The hub is never wrong, only general, and leaves them
one click from the particular use on a screen that also tells them what the case is.

There is **no authored "pending" state**. A tag either names a real glossary term or
the appendix says plainly that it doesn't. Correctness is enforced upstream: the
vocabulary toolkit's `lint_entry.py` fails on any tag that doesn't resolve against
the term list it vendors from the Pharr repo.

`pharrSlug` **must stay identical** to `slugify()` in Pharr's `js/tooltips.js` and in
the toolkit's `engine/sync_grammar_terms.py`. Verified identical over all 330 slugs.
