# Copyright and licensing

This repository combines three bodies of material under three sets of terms.

## 1. Latin — public domain

The Latin words themselves, and the texts of Ovid and Vergil they are drawn from, are in the public
domain. Facts about them — a word's frequency in the reading, its rank on a published core list — are
not anyone's to license.

## 2. Editorial content — CC BY-NC-SA 4.0

Licensed under Creative Commons Attribution-NonCommercial-ShareAlike 4.0 (see
[`LICENSE-CONTENT`](LICENSE-CONTENT)):

- `vocabulary.csv` — the headwords as presented, their macrons, and every definition and comment.
- `forms.csv` — the inflected forms and the headwords they point to.
- `index.html` and `favicon.svg`.
- The project's Markdown documentation (`README.md`, `LLM_ARCHITECTURE.md`, and this file).

In plain terms: others may share and adapt this material, but must credit it, may not use it
commercially, and must release adaptations under the same terms.

Summary: https://creativecommons.org/licenses/by-nc-sa/4.0/

## 3. Code — AGPL-3.0

Licensed under the GNU Affero General Public License, version 3 (see [`LICENSE-CODE`](LICENSE-CODE)):

- `app.js` — search, form resolution, rendering, and the study list.
- `styles.css`.

In plain terms: anyone may use and modify the code, including to build a dictionary for other texts,
but must keep it open. The Affero clause adds that anyone who runs a modified version as a website must
offer its users the corresponding source.

## Why this split

It follows the reasoning of this project's sibling, the Pharr *Aeneid* grammar edition. Making the
code non-commercial as well would block legitimate educational reuse — teachers at tuition-charging
schools, nonprofits, open educational-resource libraries — while the AGPL already prevents what
matters: closed, proprietary versions of the code. The content stays non-commercial; the code stays
open.

Until 2026-09 this repository was licensed as a whole under GPL-3.0; earlier versions remain available
under those terms.

## Combining the two licenses

CC BY-NC-SA 4.0 and AGPL-3.0 are not compatible within a single file, and in this project they never
share one: content lives in CSV, HTML and Markdown; code lives in JavaScript and CSS. If you extract
material, keep that boundary.
