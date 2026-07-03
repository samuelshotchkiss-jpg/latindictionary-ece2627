(function() {
    // --- DOM Element Cache ---
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
    
    let vocabulary = new Array();
    let formsList = new Array();
    let studyList = new Array();
    const STORAGE_KEY_LIST = 'latinStudyList';
    const STORAGE_KEY_CONSENT = 'privacyConsent';

    // --- Core & Data Functions ---

    function formatHeadwordHTML(rawLatin) {
        if (!rawLatin) return '';
        return rawLatin.replace(/\{(.*?)\}/g, '<span class="headword-comment">$1</span>');
    }

function formatDefinitionHTML(rawDef) {
        if (!rawDef) return '';
        
        let formatted = rawDef;
        
        // 1. Parse grammar links WITH an ID: {{Display Text|ID}}
        formatted = formatted.replace(/\{\{(.*?)\|(.*?)\}\}/g, '<span class="grammar-link" data-pharr-id="$2">$1</span>');
        
        // 2. Parse grammar links WITHOUT an ID: {{Display Text}}
        formatted = formatted.replace(/\{\{(.*?)\}\}/g, '<span class="grammar-link" data-pharr-id="pending">$1</span>');
        
        // 3. Parse Idioms using Hex Codes to avoid Markdown UI bugs
        // \x5b represents the left square bracket, \x5d represents the right
        const idiomRegex = new RegExp('\\x5b\\x5b(.*?)\\x5d\\x5d', 'g');
        formatted = formatted.replace(idiomRegex, '<span class="idiom-phrase">$1</span>');

        // 4. Parse commentary: {chatty explanatory text}
        formatted = formatted.replace(/\{(.*?)\}/g, '<span class="def-comment">$1</span>');

        // 5. Parse Latin words in context: *terra*
        formatted = formatted.replace(/\*(.*?)\*/g, '<span class="latin-in-context">$1</span>');
        
        return formatted;
    }

    function normalizeForSearch(str) {
        if (!str) return '';
        return str
            .toLowerCase()
            .normalize('NFD')
            .replace(/\p{Diacritic}/gu, '') 
            .replace(/,|;|\.|:|-|\u2013|\u2014|\(|\)|=|>|</g, '')
            .trim(); 
    }

    // NEW: One-Way Macron Strictness Checker
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
                const sCharRaw = searchRawStr.charAt(i);
                const sCharNorm = searchNormStr.charAt(i);
                
                // If the user typed a diacritic (it vanished during normalization)
                if (sCharRaw !== sCharNorm) {
                    const tCharRaw = targetRawStr.charAt(matchIdx + i);
                    // The dictionary word MUST possess that exact diacritic
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

    function parseCSV(data) {
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
            
            if (values.length >= 2) {
                const latin = (values.slice(0, 1).pop() || '').replace(/"/g, '');
                const definition = (values.slice(1, 2).pop() || '').replace(/"/g, '');
                const column3 = (values.slice(2, 3).pop() || '').replace(/"/g, '');
                const column4 = (values.slice(3, 4).pop() || '').replace(/"/g, '');

                let frequency = null;
                let partOfSpeech = '';
                
                const freqNum = parseInt(column3);

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
                    forms: new Array() 
                });
            }
        }
        return records;
    }

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

    function displayWordDetails(word, selectedFormObj = null) {
        if (!word) {
            resultDisplay.innerHTML = `<div class="placeholder-text"><p>Word not found.</p></div>`;
            return;
        }
        const isSaved = studyList.includes(word.latin);
        const buttonHtml = `<button class="btn add-to-list-btn-action ${isSaved ? 'btn-danger' : 'btn-primary'}">${isSaved ? 'Remove from List' : 'Add to List'}</button>`;
        
        const posHtml = word.partOfSpeech ? `<div class="part-of-speech">${word.partOfSpeech}</div>` : '';
        const freqHtml = (word.frequency !== null) ? `<div class="frequency">Frequency: ${word.frequency}</div>` : '';

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

        if (selectedFormObj) {
            const highlighted = resultDisplay.querySelector('.highlighted-form');
            if (highlighted) {
                setTimeout(() => highlighted.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
            }
        }
        
        resultDisplay.querySelectorAll('.add-to-list-btn-action').forEach(btn => {
            btn.addEventListener('click', () => {
                if (isSaved) removeFromStudyList(word.latin);
                else addToStudyList(word.latin);
                displayWordDetails(word, selectedFormObj); 
            });
        });

        updateWordWheelSelection(word.latin);
        searchInput.value = selectedFormObj ? selectedFormObj.form : word.latin.replace(/\{.*?\}/g, '').trim();
        suggestionsList.style.display = 'none';
    }
    
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
    
    function showStudyListModal() {
        studyListUl.innerHTML = '';
        if (studyList.length === 0) {
            studyListPlaceholder.style.display = 'block';
        } else {
            studyListPlaceholder.style.display = 'none';
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
            
            const hasHeader = firstLineCols.length > 0 && (firstCol.toLowerCase().includes('latin') || firstCol.toLowerCase().includes('word'));
            const dataLines = hasHeader ? lines.slice(1) : lines;
            const newList = new Array();
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
        e.target.value = '';
    }

    // --- Event Handlers ---

    function onSearchInput(e) {
        const rawSearchTerm = e.target.value;
        const normalizedSearchTerm = normalizeForSearch(rawSearchTerm);

        if (normalizedSearchTerm.length === 0) {
            suggestionsList.style.display = 'none';
            return;
        }

        const searchNoPunct = rawSearchTerm.toLowerCase().replace(/,|;|\.|:|-|\u2013|\u2014|\(|\)|=|>|</g, '').trim();
        const collapsedSearchRaw = searchNoPunct.replace(/\s+/g, ' ');
        const searchPatternRaw = ' ' + collapsedSearchRaw;

        const collapsedSearchNorm = normalizedSearchTerm.replace(/\s+/g, ' ');
        const searchPatternNorm = ' ' + collapsedSearchNorm;

        const searchWordsNorm = collapsedSearchNorm.split(' ');

        let matches = new Array();
        const addedDisplays = new Set();

        // 1. Gather matching headwords (Lemmata)
        vocabulary.forEach(word => {
            const cleanLatinRaw = word.latin.toLowerCase().replace(/\{(.*?)\}/g, ' '); 
            const rawLemmaNoPunct = cleanLatinRaw.replace(/,|;|\.|:|-|\u2013|\u2014|\(|\)|=|>|</g, '').trim();
            const collapsedLemmaRaw = rawLemmaNoPunct.replace(/\s+/g, ' ');
            const lemmaTargetRaw = ' ' + collapsedLemmaRaw;

            const collapsedLemmaNorm = normalizeForSearch(cleanLatinRaw).replace(/\s+/g, ' ');
            const lemmaTargetNorm = ' ' + collapsedLemmaNorm;
            
            if (checkOneWayMatch(lemmaTargetRaw, lemmaTargetNorm, searchPatternRaw, searchPatternNorm)) {
                
                // Determine if this is an Exact Match
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

        // 2. Gather matching inflected forms
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

        // 3. New Sorting Hierarchy
        matches.sort((a, b) => {
            // Rule A: Exact Matches rise to the very top
            if (a.isExact !== b.isExact) {
                return a.isExact ? -1 : 1;
            }

            // Rule B: Standard Dictionary Lemmata beat Inflected Forms
            if (a.isForm !== b.isForm) {
                return a.isForm ? 1 : -1;
            }

            // Rule C: Frequency Ranking
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

        const topMatches = matches.slice(0, 10);
        suggestionsList.innerHTML = '';
        
        if (topMatches.length > 0) {
            topMatches.forEach(match => {
                const div = document.createElement('div');
                
                // Assigns receding visual style if it's an inflected form
                if (match.isForm) {
                    div.classList.add('is-form-match');
                }

                let innerHtml = "";
                const segments = match.text.split(/(\{.*?\})/g);
                
                segments.forEach(segment => {
                    if (segment.startsWith('{') && segment.endsWith('}')) {
                        const innerText = segment.substring(1, segment.length - 1);
                        innerHtml += '<span class="headword-comment">' + innerText + '</span>';
                    } else {
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

    function onWordWheelClick(e) {
        if (e.target && e.target.nodeName === "LI") {
            const latinWord = e.target.dataset.latin;
            const wordObject = vocabulary.find(w => w.latin === latinWord);
            if (wordObject) {
                displayWordDetails(wordObject);
                if (window.innerWidth <= 768) closeMobileMenu();
            }
        }
    }
    
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
                if (!response.ok) return ""; 
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

            vocabulary.forEach(word => {
                word.forms = formsList.filter(f => f.lemma === word.latin);
            });

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

        // --- Grammar Link Click Handler ---
        resultDisplay.addEventListener('click', function(e) {
            if (e.target && e.target.classList.contains('grammar-link')) {
                const pharrId = e.target.getAttribute('data-pharr-id');
                
                if (pharrId === 'pending') {
                    alert('Grammar link pending: We have not assigned a specific Pharr section to this term yet.');
                } else {
                    alert('Integration ready! This will eventually open Pharr Section: ' + pharrId);
                }
            }
        });

        searchInput.addEventListener('input', onSearchInput);
        wordWheel.addEventListener('click', onWordWheelClick);
        searchInput.addEventListener('blur', () => setTimeout(() => { suggestionsList.style.display = 'none'; }, 150));
        
        acknowledgePrivacyBtn.addEventListener('click', () => {
            privacyNoticeModal.style.display = 'none';
            localStorage.setItem(STORAGE_KEY_CONSENT, 'true');
        });

        viewStudyListBtn.addEventListener('click', showStudyListModal);
        closeStudyListModal.addEventListener('click', () => studyListModal.style.display = 'none');
        
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
