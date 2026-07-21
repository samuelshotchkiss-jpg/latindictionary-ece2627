# Latin Vocabulary Study App

## Overview
This is a lightweight, client-side web application designed to help students study Latin vocabulary. It provides a searchable dictionary, grammatical form resolution, and a locally stored, exportable "Study List."

Built entirely with Vanilla HTML5, CSS3, and ES6 JavaScript, it requires no backend server, no database, and no build tools (like Webpack or Node.js). 

## Primary Features
*   **Forgiving Incremental Search:** Students can search without worrying about macrons or punctuation. The engine automatically handles `i/j` equivalence (crucial for older texts) and multi-word phrases.
*   **One-Way Macron Strictness:** If a student types "o", it returns both "o" and "ō". If a student specifically types "ō", it filters out short "o"s.
*   **Grammar Engine:** It recognizes inflected forms (e.g., typing "quō" pulls up the pronoun "quī, quae, quod") and groups them under their dictionary lemmata. This functionality is intentionally limited to short and irregular words that are likely to cause the student trouble, but can be expanded using the provided forms.csv. A thoroughgoing grammar engine (such as the ones found in Perseus, Logeion, or Whitaker's Words) is not something I regard as practical (using the present architecture) or pedagogically desirable.
*   **Smart Sorting:** Search results prioritize Exact Matches first, Dictionary Lemmata second, Frequency third, and Alphabetical order last.
*   **Local Study List:** Students can save words to their browser's Local Storage, export them as a TSV file, and import them across devices.

## Data Entry & Markup Guide
The app reads from two files: `vocabulary.csv` (the main dictionary) and `forms.csv` (inflected grammar forms). The app dynamically parses specific text formatting in the `definition` column to create a beautiful typographical hierarchy:

1.  **Core Definitions (Default):** Text typed normally appears as the primary definition.
    *   *Example:* `hand, handiwork`
2.  **Commentary/Context (Single Braces):** Explanatory text wrapped in `{curly braces}` renders as italicized gray text. 
    *   *Example:* `{figuratively, of control}`
3.  **Latin in Context (Asterisks):** Latin words used *inside* a commentary block should be wrapped in `*asterisks*` so they render as bold, dark text. 
    *   *Example:* `{used in contrast to *terra*}`
4.  **Grammar Links (Double Braces):** Grammatical terms wrapped in `{{double braces}}` open that term's entry in the digital Pharr appendix, in a new tab. Normally the term speaks for itself and needs nothing else.
    *   *Example:* `{{ablative}}` — opens the **ablative** entry: Pharr's definition, a plain-English expansion, and a list of the ablative's Kinds, each linking to its own §.
    *   Use a pipe when the visible words aren't the term's name: `{{takes the ablative|ablative}}`.
    *   Use a pipe with a **section number** only to narrow deliberately, when you know which construction is at play: `{{ablative|§342}}` (Ablative with Special Verbs).
    *   Prefer the plain form. A section answers "which use is this?"; the entry answers "what is an ablative?" — which is the question a stuck student actually has.
5.  **Idioms (Double Square Brackets):** Phrases that require special structural highlighting should be wrapped in double square brackets: `[[Latin Phrase "Literal" → "Idiomatic"]]`. 
    *   *Example:* `[[**inicere manūs** "to lay hands on" → "to lay legal claim to"]]`

## Testing grammar links against a local appendix
Grammar links point at the published Pharr appendix
(`samuelshotchkiss-jpg.github.io/pharr-aeneid-grammar/`). To test against a local
copy instead, run the Pharr project's `build/serve.py` and set one value in the
browser console — no file is edited, so testing can never leave a diff:

```js
localStorage.setItem('pharrBase', 'http://localhost:8766/');  // then reload
localStorage.removeItem('pharrBase');                         // back to live
```

**The override only works when this page is itself on localhost.** Production is
the unconditional default everywhere else, so a stale value left in a classroom or
shared browser cannot send a student to a dead address. When the override is
active the console says so, so you can't spend an afternoon testing links against
the wrong copy without noticing.
