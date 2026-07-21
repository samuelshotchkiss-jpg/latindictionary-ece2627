(function() {
    // --- DOM Element Cache ---
    // Grabbing references to HTML elements once so we don't query the DOM repeatedly
    const searchInput = document.getElementById('search-input');
    const suggestionsList = document.getElementById('suggestions-list');
    const resultDisplay = document.getElementById('result-display');
    const wordWheel = document.getElementById('word-wheel');
    const wordWheelContainer = document.getElementById('word-wheel-container');
    const privacyNoticeModal = document.getElementById('privacy-notice-modal');
    const acknowledgePrivacyBtn = document.getElementById('acknowledge-privacy-btn');
    const viewStudyListBtn = document.getElementById('view-study-list-btn');
    const studyListModal = document.getElementById('study-list-modal');
    const closeStudyListModal = document.getElementById('close-study-list-modal');
    const studyListUl = document.getElementById('study-list-ul');
    const studyListPlaceholder = document.getElementById('study-list-placeholder');
    const downloadListBtn = document.getElementById('download-list-btn');
    const importListBtn = document.getElementById('import-list-btn');
    const importFileInput = document.getElementById('import-file-input');
    const copyListBtn = document.getElementById('copy-list-btn');
    const toggleWordWheelBtn = document.getElementById('toggle-word-wheel-btn');
    const closeWordWheelBtn = document.getElementById('close-word-wheel-btn');
    const mobileMenuOverlay = document.getElementById('mobile-menu-overlay');
    
    // --- Global State Variables ---
    let vocabulary = new Array(); // Holds standard dictionary lemmata
    let formsList = new Array();  // Holds inflected grammar forms
    let studyList = new Array();  // Holds the user's saved words
    
    // Keys used for browser LocalStorage
    const STORAGE_KEY_LIST = 'latinStudyList';
    const STORAGE_KEY_CONSENT = 'privacyConsent';

    // --- Pharr grammar links -------------------------------------------------
    // A {{tagged}} grammatical term opens the matching entry in the digital
    // Pharr appendix. The target is the GLOSSARY ENTRY, not a section number:
    // the entry carries Pharr's definition, the editor's plain-English
    // expansion, and a "Kinds" menu listing each construction with its own
    // section. A student who has forgotten what an ablative is and lands on
    // section 30 gets "the case of adverbial relation" and nothing else --
    // true, and no help at all. The entry answers the question they have.
    const PHARR_BASE = 'https://samuelshotchkiss-jpg.github.io/pharr-aeneid-grammar/';

    // Slugs must be derived IDENTICALLY in three places, or a link dies:
    //   here, Pharr's js/tooltips.js slugify(), and the toolkit's
    //   engine/sync_grammar_terms.py slugify(). The toolkit gates every tag
    //   against the vocabulary it vendors from Pharr, so drift is caught before
    //   a student meets it.
    function pharrSlug(str) {
        return String(str || '').toLowerCase()
            .normalize('NFD').replace(/\p{Diacritic}/gu, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    // A pipe id that is a bare section number ("342", "§342") is a deliberate
    // NARROWING -- we know which construction is at play, so send them straight
    // there. Anything else names a glossary term.
    function pharrHref(id) {
        const raw = String(id || '').trim();
        const section = raw.match(/^§?\s*(\d+)$/);
        return section
            ? PHARR_BASE + '#s' + section[1]
            : PHARR_BASE + '#term=' + encodeURIComponent(pharrSlug(raw));
    }

    function escapeHTML(str) {
        return String(str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[c]);
    }

    // A real <a>, not a span with a click handler: middle-click, ctrl-click,
    // "open in new tab", keyboard focus and screen readers all work for free.
    function grammarLinkHTML(label, id) {
        const text = String(label).trim();
        return '<a class="grammar-link" href="' + escapeHTML(pharrHref(id)) + '"' +
               ' target="_blank" rel="noopener"' +
               ' title="' + escapeHTML(text) + ' — look it up in Pharr’s grammar">' +
               escapeHTML(text) + '</a>';
    }

    // --- Core & Data Functions ---

    // Parses single {curly braces} to style commentary text lightly
    function formatHeadwordHTML(rawLatin) {
        if (!rawLatin) return '';
        return rawLatin.replace(/\{(.*?)\}/g, '<span class="headword-comment">$1</span>');
    }

    // Parses complex markup rules (Grammar links, Idioms, Commentary, Latin terms)
    // Order of operations is crucial so nested spans don't break each other
    function formatDefinitionHTML(rawDef) {
        if (!rawDef) return '';
        
        let formatted = rawDef;
        
        // 1. Grammar link with an explicit target: {{label|term}} or {{label|§342}}.
        //    The pipe is the EXCEPTION -- it is for when the visible text is not
        //    the term's name ({{takes the ablative|ablative}}), or when we mean to
        //    narrow to one section.
        formatted = formatted.replace(/\{\{([^{}|]*?)\|([^{}]*?)\}\}/g,
            (_m, label, id) => grammarLinkHTML(label, id));

        // 2. The normal case: {{ablative}} -- the visible text IS the term, so it
        //    is also the id. There is no "pending" state to author; a tag either
        //    resolves in the appendix or that page says so plainly.
        formatted = formatted.replace(/\{\{([^{}]*?)\}\}/g,
            (_m, label) => grammarLinkHTML(label, label));
        
        // 3. Idiom Phrases (Using Hex codes \x5b and \x5d to avoid markdown UI bugs)
        const idiomRegex = new RegExp('\\x5b\\x5b(.*?)\\x5d\\x5d', 'g');
        formatted = formatted.replace(idiomRegex, '<span class="idiom-phrase">$1</span>');

        // 4. English Commentary Context
        formatted = formatted.replace(/\{(.*?)\}/g, '<span class="def-comment">$1</span>');
        
        // 5. Latin Words embedded inside English Commentary
        formatted = formatted.replace(/\*(.*?)\*/g, '<span class="latin-in-context">$1</span>');
        
        return formatted;
    }

    // Strips out all punctuation, diacritics, and handles i/j equivalence for search
    function normalizeForSearch(str) {
        if (!str) return '';
        return str
            .toLowerCase()
            .replace(/j/g, 'i') // Maps j to i for texts like Pharr
            .normalize('NFD')   // Separates letters from their diacritic marks
            .replace(/\p{Diacritic}/gu, '') // Deletes the isolated diacritic marks
            .replace(/,|;|\.|:|-|\u2013|\u2014|\(|\)|=|>|</g, '') // Cleans punctuation
            .trim(); 
    }

    // One-Way Macron Strictness Checker
    // If user types standard vowel, accepts long/short. If user types macron, rejects short.
    function checkOneWayMatch(targetRawStr, targetNormStr, searchRawStr, searchNormStr) {
        let startIdx = 0;
        let found = false;
        
        while (startIdx < targetNormStr.length) {
            const matchIdx = targetNormStr.indexOf(searchNormStr, startIdx);
            if (matchIdx === -1) {
                break; 
            }

            let isValid = true;
            for (let i = 0; i < searchRawStr.length; i++) {
                let sCharRaw = searchRawStr.charAt(i).toLowerCase();
                let tCharRaw = targetRawStr.charAt(matchIdx + i).toLowerCase();
                
                // Allow i/j equivalence to bypass strictness rejection
                if (sCharRaw === 'j') sCharRaw = 'i';
                if (tCharRaw === 'j') tCharRaw = 'i';

                const sCharNorm = searchNormStr.charAt(i);
                
                // Checks if the user intentionally typed a diacritic
                if (sCharRaw !== sCharNorm) {
                    // Verifies the dictionary word has that exact same diacritic
                    if (sCharRaw !== tCharRaw) {
                        isValid = false;
                        break;
                    }
                }
            }

            if (isValid) {
                found = true;
                break;
            }
            startIdx = matchIdx + 1;
        }
        return found;
    }

    // Custom CSV Parser built without array literal brackets to survive UI bugs
    function parseCSV(data) {
        const records = new Array();
        const lines = data.trim().split(/\r?\n/).slice(1); // Skips header row

        for (const line of lines) {
            let inQuotes = false;
            let currentVal = "";
            const values = new Array();

            // Manually splits columns to respect commas hidden inside quotation marks
            for (let i = 0; i < line.length; i++) {
                const char = line.charAt(i);
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    values.push(currentVal.trim());
                    currentVal = "";
                } else {
                    currentVal += char;
                }
            }
            values.push(currentVal.trim());
            
            if (values.length >= 2) {
                // Using slice.pop() as a safe alternative to array indexing
                const latin = (values.slice(0, 1).pop() || '').replace(/"/g, '');
                const definition = (values.slice(1, 2).pop() || '').replace(/"/g, '');
                const column3 = (values.slice(2, 3).pop() || '').replace(/"/g, '');
                const column4 = (values.slice(3, 4).pop() || '').replace(/"/g, '');

                let frequency = null;
                let partOfSpeech = '';
                
                const freqNum = parseInt(column3);

                // Dynamically determines if column 3 is Frequency or Part of Speech
                if (!isNaN(freqNum)) {
                    frequency = freqNum;
                    partOfSpeech = column4;
                } else {
                    partOfSpeech = column3;
                }

                records.push({
                    latin: latin, 
                    definition: definition,
                    frequency: frequency,
                    partOfSpeech: partOfSpeech,
                    forms: new Array() // Will be populated after forms.csv is loaded
                });
            }
        }
        return records;
    }

    // Similar robust parser for the forms list
    function parseFormsCSV(data) {
        const records = new Array();
        const lines = data.trim().split(/\r?\n/).slice(1);

        for (const line of lines) {
            let inQuotes = false;
            let currentVal = "";
            const values = new Array();

            for (let i = 0; i < line.length; i++) {
                const char = line.charAt(i);
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    values.push(currentVal.trim());
                    currentVal = "";
                } else {
                    currentVal += char;
                }
            }
            values.push(currentVal.trim());

            if (values.length >= 3) {
                records.push({
                    form: (values.slice(0, 1).pop() || '').replace(/"/g, ''),
                    lemma: (values.slice(1, 2).pop() || '').replace(/"/g, ''),
                    definition: (values.slice(2, 3).pop() || '').replace(/"/g, '')
                });
            }
        }
        return records;
    }
    
    // --- UI Update Functions ---

    // Fills the left-hand alphabetical sidebar
    function populateWordWheel() {
        wordWheel.innerHTML = '';
        const fragment = document.createDocumentFragment();
        vocabulary.forEach(word => {
            const li = document.createElement('li');
            li.innerHTML = formatHeadwordHTML(word.latin);
            li.dataset.latin = word.latin;
            fragment.appendChild(li);
        });
        wordWheel.appendChild(fragment);
    }

    // Renders the main definition card when a word is selected
    function displayWordDetails(word, selectedFormObj = null) {
        if (!word) {
            resultDisplay.innerHTML = `<div class="placeholder-text"><p>Word not found.</p></div>`;
            return;
        }
        const isSaved = studyList.includes(word.latin);
        
        // Dynamically sets button color/text based on save state
        const buttonHtml = `<button class="btn add-to-list-btn-action ${isSaved ? 'btn-danger' : 'btn-primary'}">${isSaved ? 'Remove from List' : 'Add to List'}</button>`;
        
        const posHtml = word.partOfSpeech ? `<div class="part-of-speech">${word.partOfSpeech}</div>` : '';
        const freqHtml = (word.frequency !== null) ? `<div class="frequency">Frequency: ${word.frequency}</div>` : '';

        // Builds the dropdown HTML for grammatical forms if they exist
        let formsHtml = '';
        if (word.forms && word.forms.length > 0) {
            const isOpen = selectedFormObj ? 'open' : '';
            const listItems = word.forms.map(f => {
                const isSelected = selectedFormObj && f.form === selectedFormObj.form;
                return `<li class="${isSelected ? 'highlighted-form' : ''}">
                    <span class="form-name">${f.form}</span>: ${f.definition}
                </li>`;
            }).join('');
            
            formsHtml = `
                <details class="forms-section" ${isOpen}>
                    <summary>Forms</summary>
                    <ul class="forms-list">
                        ${listItems}
                    </ul>
                </details>
            `;
        }

        // Injects the final parsed HTML into the screen
        resultDisplay.innerHTML = `
            <div class="result-header">
                <h2>${formatHeadwordHTML(word.latin)}</h2>
                ${buttonHtml}
            </div>
            ${posHtml}
            <p>${formatDefinitionHTML(word.definition)}</p>
            ${formsHtml}
            ${freqHtml}
            <div class="result-footer">${buttonHtml}</div>
        `;

        // If a specific form was searched, scroll it to the center of the forms box
        if (selectedFormObj) {
            const highlighted = resultDisplay.querySelector('.highlighted-form');
            if (highlighted) {
                setTimeout(() => highlighted.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
            }
        }
        
        // Attach click listeners to the Add/Remove buttons
        resultDisplay.querySelectorAll('.add-to-list-btn-action').forEach(btn => {
            btn.addEventListener('click', () => {
                if (isSaved) removeFromStudyList(word.latin);
                else addToStudyList(word.latin);
                displayWordDetails(word, selectedFormObj); 
            });
        });

        updateWordWheelSelection(word.latin);
        
        // Leaves the specific form in the search bar if they typed one, otherwise clears {comments}
        searchInput.value = selectedFormObj ? selectedFormObj.form : word.latin.replace(/\{.*?\}/g, '').trim();
        suggestionsList.style.display = 'none';
    }
    
    // Highlights the active word in the left sidebar
    function updateWordWheelSelection(latinWord) {
        const currentSelected = wordWheel.querySelector('.selected');
        if (currentSelected) currentSelected.classList.remove('selected');
        const items = wordWheel.querySelectorAll('li');
        let newSelectedItem = null;
        for (const item of items) {
            if (item.dataset.latin === latinWord) {
                newSelectedItem = item;
                break;
            }
        }

        if (newSelectedItem) {
            newSelectedItem.classList.add('selected');
            newSelectedItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
    
    // Colors words green in the sidebar if they are in the Study List
    function updateWordWheelStyles() {
        const studyListSet = new Set(studyList);
        wordWheel.querySelectorAll('li').forEach(li => {
            li.classList.toggle('in-study-list', studyListSet.has(li.dataset.latin));
        });
    }

    // --- Study List & Storage Functions ---

    function saveStudyList() {
        localStorage.setItem(STORAGE_KEY_LIST, JSON.stringify(studyList));
        updateWordWheelStyles();
    }

    function loadStudyList() {
        const savedList = localStorage.getItem(STORAGE_KEY_LIST);
        if (savedList) {
            try { studyList = JSON.parse(savedList); } 
            catch (e) { studyList = new Array(); }
        }
    }

    function addToStudyList(latinWord) {
        if (!studyList.includes(latinWord)) {
            studyList.push(latinWord);
            saveStudyList();
        }
    }
    
    function removeFromStudyList(latinWord, refreshModal = false) {
        studyList = studyList.filter(word => word !== latinWord);
        saveStudyList();
        if (refreshModal) showStudyListModal();
    }
    
    // Builds the Study List Modal UI
    function showStudyListModal() {
        studyListUl.innerHTML = '';
        if (studyList.length === 0) {
            studyListPlaceholder.style.display = 'block';
        } else {
            studyListPlaceholder.style.display = 'none';
            
            // Sorts the study list alphabetically, ignoring any {comments}
            studyList.sort((a, b) => {
                const keyA = normalizeForSearch(a.replace(/\{.*?\}/g, ''));
                const keyB = normalizeForSearch(b.replace(/\{.*?\}/g, ''));
                return keyA.localeCompare(keyB);
            }).forEach(latinWord => {
                const wordObject = vocabulary.find(w => w.latin === latinWord);
                if (wordObject) {
                    const freqHtml = (wordObject.frequency !== null) ? `<span class="study-list-frequency">Frequency: ${wordObject.frequency}</span>` : '';
                    const li = document.createElement('li');
                    li.innerHTML = `
                        <div class="study-list-item-content">
                            <span class="study-list-latin">${formatHeadwordHTML(wordObject.latin)}</span>
                            <span class="study-list-definition">${formatDefinitionHTML(wordObject.definition)}</span>
                            ${freqHtml}
                        </div>
                        <button class="remove-from-list-btn" data-word="${latinWord}" title="Remove from list">&times;</button>
                    `;
                    studyListUl.appendChild(li);
                }
            });
        }
        studyListModal.style.display = 'flex';
    }

    // Creates the formatted string for TSV Export
    function generateTSVContent() {
        return studyList.map(latinWord => {
            const word = vocabulary.find(w => w.latin === latinWord);
            if (!word) return '';

            const row = Array.of(word.latin, word.definition);
            if (word.frequency !== null) row.push(word.frequency);
            if (word.partOfSpeech) row.push(word.partOfSpeech);
            
            return row.join('\t');
        }).filter(Boolean).join('\n');
    }

    function downloadTSV() {
        const blobContent = Array.of(generateTSVContent());
        const blob = new Blob(blobContent, { type: 'text/tab-separated-values;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "latin_study_list.tsv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function copyTSVToClipboard() {
        const tsvContent = generateTSVContent();
        if (!navigator.clipboard) { alert("Clipboard API not available."); return; }
        navigator.clipboard.writeText(tsvContent).then(() => {
            const originalText = copyListBtn.textContent;
            copyListBtn.textContent = "Copied!";
            setTimeout(() => { copyListBtn.textContent = originalText; }, 2000);
        }).catch(err => { alert('Failed to copy list.'); });
    }

    function handleImport() {
        if (!confirm("This will replace your current study list. Are you sure?")) return;
        importFileInput.click();
    }

    // Validates and processes an uploaded TSV file
    function processImportFile(e) {
        const file = e.target.files.item(0);
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(event) {
            const content = event.target.result;
            const lines = content.trim().split('\n');
            const firstLine = lines.slice(0, 1).pop();
            const firstLineCols = lines.length > 0 ? firstLine.split('\t') : new Array();
            const firstCol = firstLineCols.slice(0, 1).pop() || '';
            
            // Checks if the first row is a header and skips it if so
            const hasHeader = firstLineCols.length > 0 && (firstCol.toLowerCase().includes('latin') || firstCol.toLowerCase().includes('word'));
            const dataLines = hasHeader ? lines.slice(1) : lines;
            const newList = new Array();
            
            // Only allows words that actually exist in the current dictionary
            const allLatinWords = new Set(vocabulary.map(v => v.latin));
            dataLines.forEach(line => {
                const parts = line.split('\t');
                const latinWord = parts.slice(0, 1).pop().trim();
                if (latinWord && allLatinWords.has(latinWord)) newList.push(latinWord);
            });
            
            studyList = Array.from(new Set(newList));
            saveStudyList();
            showStudyListModal();
            alert(`Import complete. ${studyList.length} valid words were added.`);
        };
        reader.readAsText(file);
        e.target.value = ''; // Resets the input so the same file can be uploaded again if needed
    }

    // --- Event Handlers (The Search Engine) ---

    function onSearchInput(e) {
        const rawSearchTerm = e.target.value;
        const normalizedSearchTerm = normalizeForSearch(rawSearchTerm);

        if (normalizedSearchTerm.length === 0) {
            suggestionsList.style.display = 'none';
            return;
        }

        // Prepares strings for the "Space-Prefix" matching rule
        const searchNoPunct = rawSearchTerm.toLowerCase().replace(/,|;|\.|:|-|\u2013|\u2014|\(|\)|=|>|</g, '').trim();
        const collapsedSearchRaw = searchNoPunct.replace(/\s+/g, ' ');
        const searchPatternRaw = ' ' + collapsedSearchRaw;

        const collapsedSearchNorm = normalizedSearchTerm.replace(/\s+/g, ' ');
        const searchPatternNorm = ' ' + collapsedSearchNorm;

        const searchWordsNorm = collapsedSearchNorm.split(' ');

        let matches = new Array();
        const addedDisplays = new Set(); // Prevents duplicate visual entries

        // 1. Check Standard Dictionary Lemmata
        vocabulary.forEach(word => {
            const cleanLatinRaw = word.latin.toLowerCase().replace(/\{(.*?)\}/g, ' '); 
            const rawLemmaNoPunct = cleanLatinRaw.replace(/,|;|\.|:|-|\u2013|\u2014|\(|\)|=|>|</g, '').trim();
            const collapsedLemmaRaw = rawLemmaNoPunct.replace(/\s+/g, ' ');
            const lemmaTargetRaw = ' ' + collapsedLemmaRaw;

            const collapsedLemmaNorm = normalizeForSearch(cleanLatinRaw).replace(/\s+/g, ' ');
            const lemmaTargetNorm = ' ' + collapsedLemmaNorm;
            
            if (checkOneWayMatch(lemmaTargetRaw, lemmaTargetNorm, searchPatternRaw, searchPatternNorm)) {
                
                // Flag as "isExact" if it perfectly matches the whole word or a distinct sub-word
                let isExact = false;
                if (collapsedLemmaNorm === collapsedSearchNorm) {
                    isExact = true;
                } else {
                    const words = collapsedLemmaNorm.split(' ');
                    if (words.indexOf(collapsedSearchNorm) !== -1) {
                        isExact = true;
                    }
                }

                matches.push({
                    type: 'lemma',
                    text: word.latin,
                    displayStr: word.latin,
                    word: word,
                    isForm: false,
                    isExact: isExact
                });
                addedDisplays.add(word.latin);
            }
        });

        // 2. Check Inflected Grammar Forms
        formsList.forEach(formObj => {
            const rawFormNoPunct = formObj.form.toLowerCase().replace(/,|;|\.|:|-|\u2013|\u2014|\(|\)|=|>|</g, '').trim();
            const collapsedFormRaw = rawFormNoPunct.replace(/\s+/g, ' ');
            const formTargetRaw = ' ' + collapsedFormRaw;

            const collapsedFormNorm = normalizeForSearch(formObj.form).replace(/\s+/g, ' ');
            const formTargetNorm = ' ' + collapsedFormNorm;
            
            if (checkOneWayMatch(formTargetRaw, formTargetNorm, searchPatternRaw, searchPatternNorm)) {
                const displayStr = formObj.form + ' > ' + formObj.lemma;
                if (!addedDisplays.has(displayStr)) {
                    const wordObj = vocabulary.find(w => w.latin === formObj.lemma);
                    if (wordObj) {
                        let isExact = false;
                        if (collapsedFormNorm === collapsedSearchNorm) {
                            isExact = true;
                        }

                        matches.push({
                            type: 'form',
                            text: formObj.form,
                            displayStr: displayStr,
                            word: wordObj,
                            formObj: formObj,
                            isForm: true,
                            isExact: isExact
                        });
                        addedDisplays.add(displayStr);
                    }
                }
            }
        });

        // 3. Apply the Sorting Hierarchy
        matches.sort((a, b) => {
            // Rule A: Exact Matches rise to the very top
            if (a.isExact !== b.isExact) {
                return a.isExact ? -1 : 1;
            }
            // Rule B: Dictionary Lemmata defeat Inflected Forms
            if (a.isForm !== b.isForm) {
                return a.isForm ? 1 : -1;
            }
            // Rule C: Highest Dictionary Frequency wins
            const freqA = a.word.frequency !== null ? a.word.frequency : -1;
            const freqB = b.word.frequency !== null ? b.word.frequency : -1;
            if (freqA !== freqB) {
                return freqB - freqA; 
            }
            // Rule D: Alphabetical Tie-Breaker
            const keyA = normalizeForSearch(a.displayStr.replace(/\{.*?\}/g, ''));
            const keyB = normalizeForSearch(b.displayStr.replace(/\{.*?\}/g, ''));
            return keyA.localeCompare(keyB);
        });

        // Limit to top 10 results to keep UI clean
        const topMatches = matches.slice(0, 10);
        suggestionsList.innerHTML = '';
        
        if (topMatches.length > 0) {
            topMatches.forEach(match => {
                const div = document.createElement('div');
                
                // Visually demotes inflected forms with CSS
                if (match.isForm) {
                    div.classList.add('is-form-match');
                }

                let innerHtml = "";
                // Protects comments from getting bolded by splitting the string
                const segments = match.text.split(/(\{.*?\})/g);
                
                segments.forEach(segment => {
                    if (segment.startsWith('{') && segment.endsWith('}')) {
                        const innerText = segment.substring(1, segment.length - 1);
                        innerHtml += '<span class="headword-comment">' + innerText + '</span>';
                    } else {
                        // Applies bolding to the matching parts of the Latin text
                        const parts = segment.split(' ');
                        const htmlParts = parts.map(part => {
                            const normPart = normalizeForSearch(part);
                            
                            if (normPart.length > 0) {
                                let matchedSearchWord = '';
                                for (let idx = 0; idx < searchWordsNorm.length; idx++) {
                                    const sw = searchWordsNorm.slice(idx, idx + 1).pop();
                                    if (sw.length > 0 && normPart.startsWith(sw)) {
                                        matchedSearchWord = sw;
                                        break;
                                    }
                                }

                                // Calculates exact index to stop bolding, jumping over punctuation
                                if (matchedSearchWord.length > 0) {
                                    let matchEndIndex = 0;
                                    let normCount = 0;
                                    for (let i = 0; i < part.length; i++) {
                                        const charNorm = normalizeForSearch(part.charAt(i));
                                        if (charNorm.length > 0) {
                                            normCount += charNorm.length;
                                        }
                                        if (normCount >= matchedSearchWord.length) {
                                            matchEndIndex = i + 1;
                                            break;
                                        }
                                    }

                                    if (matchEndIndex > 0) {
                                        return '<strong>' + part.substring(0, matchEndIndex) + '</strong>' + part.substring(matchEndIndex);
                                    }
                                }
                            }
                            return part;
                        });
                        innerHtml += htmlParts.join(' ');
                    }
                });
                
                // Appends the redirect label (e.g. "> rēs reī f.") for form matches
                if (match.isForm) {
                    innerHtml += ' <span class="search-form-lemma-label">&gt; ' + formatHeadwordHTML(match.word.latin) + '</span>';
                }

                div.innerHTML = innerHtml;
                div.addEventListener('mousedown', () => displayWordDetails(match.word, match.formObj));
                suggestionsList.appendChild(div);
            });
            suggestionsList.style.display = 'block';
        } else {
            suggestionsList.style.display = 'none';
        }
    }

    // Handles clicks on the left-hand alphabetical sidebar
    function onWordWheelClick(e) {
        if (e.target && e.target.nodeName === "LI") {
            const latinWord = e.target.dataset.latin;
            const wordObject = vocabulary.find(w => w.latin === latinWord);
            if (wordObject) {
                displayWordDetails(wordObject);
                // Auto-close sidebar on mobile after making a selection
                if (window.innerWidth <= 768) closeMobileMenu();
            }
        }
    }
    
    // --- Mobile Menu Controls ---
    function openMobileMenu() {
        wordWheelContainer.classList.add('mobile-visible');
        mobileMenuOverlay.style.display = 'block';
    }
    function closeMobileMenu() {
        wordWheelContainer.classList.remove('mobile-visible');
        mobileMenuOverlay.style.display = 'none';
    }

    // --- INITIALIZATION ---
    function initialize() {
        if (!localStorage.getItem(STORAGE_KEY_CONSENT)) {
            privacyNoticeModal.style.display = 'flex';
        }
        
        loadStudyList();

        // Fetch both dictionary CSVs in parallel for speed
        const fetchPromises = new Array();
        fetchPromises.push(
            fetch('vocabulary.csv')
            .then(response => {
                if (!response.ok) throw new Error("Vocab error");
                return response.text();
            })
        );
        fetchPromises.push(
            fetch('forms.csv')
            .then(response => {
                if (!response.ok) return ""; // Gracefully fails if forms.csv is missing
                return response.text();
            })
            .catch(() => "") 
        );

        Promise.all(fetchPromises)
        .then(results => {
            const vocabData = results.slice(0, 1).pop();
            const formsData = results.slice(1, 2).pop();

            vocabulary = parseCSV(vocabData);
            if (formsData && formsData.trim().length > 0) {
                formsList = parseFormsCSV(formsData);
            }

            // Connect sub-forms to their master headwords
            vocabulary.forEach(word => {
                word.forms = formsList.filter(f => f.lemma === word.latin);
            });

            // Sort Word Wheel alphabetically ignoring comments/punctuation
            vocabulary.sort((a, b) => {
                const keyA = normalizeForSearch(a.latin.replace(/\{.*?\}/g, ''));
                const keyB = normalizeForSearch(b.latin.replace(/\{.*?\}/g, ''));
                return keyA.localeCompare(keyB);
            });

            populateWordWheel();
            updateWordWheelStyles();
        })
        .catch(error => {
            console.error('Error fetching dictionaries:', error);
            resultDisplay.innerHTML = `<div class="placeholder-text"><p style="color:var(--danger-color);">Error: Could not load vocabulary.csv. Please ensure the file is in the same folder as index.html.</p></div>`;
        });

        // Grammar links need no click handler: grammarLinkHTML builds real <a>
        // elements, so the browser routes them (and ctrl-click, middle-click and
        // the keyboard all behave the way a student expects).

        // Event Listener Bindings
        searchInput.addEventListener('input', onSearchInput);
        wordWheel.addEventListener('click', onWordWheelClick);
        
        // Timeout prevents dropdown from hiding before a click can register
        searchInput.addEventListener('blur', () => setTimeout(() => { suggestionsList.style.display = 'none'; }, 150));
        
        acknowledgePrivacyBtn.addEventListener('click', () => {
            privacyNoticeModal.style.display = 'none';
            localStorage.setItem(STORAGE_KEY_CONSENT, 'true');
        });

        viewStudyListBtn.addEventListener('click', showStudyListModal);
        closeStudyListModal.addEventListener('click', () => studyListModal.style.display = 'none');
        
        // Event delegation for deleting words from the study list
        studyListUl.addEventListener('click', (e) => {
            const removeBtn = e.target.closest('.remove-from-list-btn');
            if (removeBtn) {
                removeFromStudyList(removeBtn.dataset.word, true);
            }
        });

        downloadListBtn.addEventListener('click', downloadTSV);
        importListBtn.addEventListener('click', handleImport);
        importFileInput.addEventListener('change', processImportFile);
        copyListBtn.addEventListener('click', copyTSVToClipboard);

        toggleWordWheelBtn.addEventListener('click', openMobileMenu);
        closeWordWheelBtn.addEventListener('click', closeMobileMenu);
        mobileMenuOverlay.addEventListener('click', closeMobileMenu);
    }

    document.addEventListener('DOMContentLoaded', initialize);
})();