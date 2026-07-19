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
4.  **Grammar Links (Double Braces):** Grammatical terms wrapped in `{{double braces}}` render as clickable red links. To route the link to a specific section of Pharr's Grammar, use a pipe `|` and the section number. 
    *   *Example:* `{{ablative absolute|344}}`
5.  **Idioms (Double Square Brackets):** Phrases that require special structural highlighting should be wrapped in double square brackets: `[[Latin Phrase "Literal" → "Idiomatic"]]`. 
    *   *Example:* `[[**inicere manūs** "to lay hands on" → "to lay legal claim to"]]`