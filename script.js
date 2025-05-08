const defaultCSVDelimiter = ",";

/*
TODO Maybe add a settings page for the app (not options for the deck!)
where you choose things like default language for unknown decks
*/
const defaultLanguagePrompts = 'fr-ca';
const defaultLanguageAnswers = 'en-us';

const speech = window.speechSynthesis;

class App {
    options;
    deck;
    playthrough;

    voiceLanguages;

    copyToast = null;

    constructor() {
        this.options = new Options();
    }

    setupDefault = () => {
        this.deck = defaultDeck.copy();
        this.playthrough = new Playthrough();
        this.playthrough.restart();
    }

    canReset = () => {
        return true; // TODO ??
    }

    reset = () => {
        speech.cancel(); // JIC I guess?

        this.copyToast = null;

        this.voiceLanguages = {};

        this.deck = null;
        this.playthrough = null;

        toggleControl($("#btnReset"), false);

        this.setupDefault();
    }

    handleRestartingChange = () => {
        setDictionary(_dictionary);
        displaySamples();

        populateEditorMeta();

        if (skipEditorItems !== true) {
            populateEditorItems();
        }

        if (skipEditorRaw !== true) {
            populateEditorRaw();
        }

        restart(true);

        let n = Object.keys(currentDictionary).length;
        $('#editItemsHeading').html(`Items (${n})`);

        toggleControl($("#btnReset"), true);
        toggleControl($("#btnShare"), true);

        this.handleGeneralChange();
    }

    handleGeneralChange = () => {
        $("#title").text(app.deck.title);

        let sourceHTML = "Source: ";
        if (! app.deck.sourceURL) {
            sourceHTML += app.deck.sourceName;
        } else {
            let sourceText = !!app.deck.sourceName ? app.deck.sourceName : "Link";
            sourceHTML += `<a href="${app.deck.sourceURL}" title="Source">${sourceText}</a>`;
        }

        sourceHTML = `<div id="source">${sourceHTML}</div>`;
        $("#sourceContainer").html(sourceHTML);

        editLanguageField();
        updateDisplay();
        populateShareURL();
    }
}

class Deck {
    dictionary;
    title;
    sourceName;
    sourceURL;
    languagePrompts;
    languageAnswers;

    static fromData = (d) => {
        let deck = new Deck();

        deck.dictionary = JSON.parse(JSON.stringify(d.dictionary));
        deck.title = d.title;
        deck.sourceName = d.sourceName;
        deck.sourceURL = d.sourceURL;
        deck.languagePrompts = d.languagePrompts;
        deck.languageAnswers = d.languageAnswers;

        return deck;
    }

    copy = () => {
        return Deck.fromData(this);
    }

    invert = () => {
        this.dictionary = Tools.swapObjectKeys(this.dictionary);
        return this;
    }
}

const PlaythroughState = {
    Uninitialized: "Uninitialized",
    InitializedButNotStarted: "InitializedButNotStarted",
    AfterNext: "AfterNext",
    AfterReveal: "AfterReveal"
}

class Playthrough {
    order;
    index;
    prompt;
    answer;
    state;

    constructor() {
        this.state = PlaythroughState.Uninitialized;
        this.order = [];
        this.clearCard();
    }

    updateOrder = () => {
        this.order = [];

        for (let i = 0; i < Object.keys(app.deck.dictionary).length; i++) {
            this.order.push(i);
        }

        if (app.options.randomizeOrder.value()) {
            this.order = Tools.shuffle(this.order);
        }
    }

    updateCard = () => {
        let i = this.order[this.index];
        let keys = Object.keys(app.deck.dictionary);
        this.prompt = keys[i];
        this.answer = app.deck.dictionary[this.prompt];
    }

    clearCard = () => {
        this.index = -1;
        this.prompt = "";
        this.answer = "";
    }

    canNext = () => {
        return this.index < (this.order.length - 1);
    }

    canPrevious = () => {
        return this.index > -1;
    }

    canReveal = () => {
        return [
            this.state === PlaythroughState.AfterNext,
            [
                app.options.showAnswer.value() === 'showAnswerReveal',
                app.options.sayAnswer.value()
            ].some(Boolean)
        ].every(Boolean);
    }

    canRestart = () => {
        return this.canPrevious();
    }

    sayPrompt = () => {
        if (app.options.sayPrompt.value()) {
            speech.cancel();
            let voice = $("#optVoicePrompts").val(); // TODO
            sayUtterance(prompt, voice, app.options.voicePromptsRate.value() / 100);
        }
    }

    sayReveal = () => {
        if (app.options.sayAnswer.value()) {
            speech.cancel();
            let voice = $("#optVoiceAnswers").val(); // TODO
            sayUtterance(this.answer, voice, app.options.voiceAnswersRate.value() / 100);
        }
    }

    next = () => {
        this.state = PlaythroughState.AfterNext;

        this.index++;
        this.updateCard();

        // TODO What if they have show answer on next and read aloud on reveal?
        this.sayPrompt();

        updateDisplay();
        updateGameControls();
    };

    previous = () => {
        if (this.index === 0) {
            this.state = PlaythroughState.InitializedButNotStarted;
        } else {
            this.state = PlaythroughState.AfterNext;
        }

        this.index--;
        this.updateCard();

        this.sayPrompt();

        updateDisplay();
        updateGameControls();
    }

    reveal = () => {
        this.state = PlaythroughState.AfterReveal;

        this.sayReveal();

        updateDisplay();
        updateGameControls();
    };

    restart = () => {
        this.state = PlaythroughState.InitializedButNotStarted;

        this.clearCard();
        this.updateOrder();

        speech.cancel();

        updateDisplay();
        updateGameControls();
    };
}

class Options {
    // TODO Add option to toggle whether restarting reshuffles order or not

    optionsChanged;

    volume;
    showPrompt;
    showAnswer;
    sayPrompt;
    sayAnswer;
    voicePromptsRate;
    voiceAnswersRate;
    randomizeOrder;
    invertDictionary;
    silentParentheses;
    silentAlternatives;

    constructor() {
        this.optionsChanged = false;
        this.createDynamicOptions();
        this.setDynamicOptionDefaults();
        this.bindDynamicOptions();
    }

    createDynamicOptions = () => {
        this.volume = new OptionSlider($("#optVolume"));
        this.volume.min(0);
        this.volume.max(100);
        this.volume.step(5);

        this.voicePromptsRate = new OptionSlider($("#optVoicePromptsRate"));
        this.voicePromptsRate.min(25);
        this.voicePromptsRate.max(200);
        this.voicePromptsRate.step(5);

        this.voiceAnswersRate = new OptionSlider($("#optVoiceAnswersRate"));
        this.voiceAnswersRate.min(25);
        this.voiceAnswersRate.max(200);
        this.voiceAnswersRate.step(5);

        this.showPrompt = new OptionRadio($('input[name="optShowPrompt"]'));
        this.showAnswer = new OptionRadio($('input[name="optShowAnswer"]'));
        this.sayPrompt = new OptionCheckbox($("#optSayPrompt"));
        this.sayAnswer = new OptionCheckbox($("#optSayAnswer"));
        this.randomizeOrder = new OptionCheckbox($("#optRandomizeOrder"));
        this.invertDictionary = new OptionCheckbox($("#optInvertDictionary"));
        this.silentParentheses = new OptionCheckbox($("#optSilentParentheses"));
        this.silentAlternatives = new OptionCheckbox($("#optSilentAlternatives"));
    };

    setDynamicOptionDefaults = () => {
        this.optionsChanged = false;

        this.volume.value(100);
        this.voicePromptsRate.value(100);
        this.voiceAnswersRate.value(100);

        // TODO Make constants for the defaults
        this.showPrompt.value("showPromptNext");
        this.showAnswer.value("showAnswerReveal");
        this.sayPrompt.value(false);
        this.sayAnswer.value(false);
        this.randomizeOrder.value(true);
        this.invertDictionary.value(false);
        this.silentParentheses.value(true);
        this.silentAlternatives.value(true);

        toggleControl($("#btnSetDefaultOptions"), false);
    };

    bindDynamicOptions = () => {
        this.showPrompt.change(toggleTextPromptVisibility);
        this.showAnswer.change(toggleTextPromptVisibility);

        $("#optionsPanel input").change(changeOption);
        $("#optionsPanel select").change(changeOption);
        this.voiceAnswersRate.change(changeOption);
        this.voicePromptsRate.change(changeOption);

        this.randomizeOrder.change(changeOptionAndRestart);
        this.invertDictionary.change(invertDictionary);
        this.silentParentheses.change(changeOption);
        this.silentAlternatives.change(changeOption);
    }
}

class Parser {
    static parseData = (content, path) => {
        if (path.endsWith("json")) {
            return Parser.parseJSON(content);
        } else if (path.endsWith("txt")) {
            return Parser.parseTXT(content);
        } else if (path.endsWith("csv")) {
            return Parser.parseCSV(content);
        }
    };

    static parseJSON = (content) => {
        // TODO no validation here...
        return JSON.parse(content);
    };

    static parseCSV = (content) => {
        return Parser._parseCSVlike(content, defaultCSVDelimiter);
    };

    static parseTXT = (content) => {
        let delim = Parser.detectDelimiter(content);
        return Parser._parseCSVlike(content, delim);
    };

    static breakPieces = (line, delim) => {
        let re_pieces = `/"(.+?)"${delim}"(.+?)"/`;
        let result = re_pieces.exec(line);
        return [Parser.cleanCell(result[1]), Parser.cleanCell(result[2])];
    };

    static _parseCSVlike = (content, delim) => {
        let _dictionary = {};
        let _title = "";
        let _sourceName = "";
        let _sourceURL = "";

        let pieces = [];
        let firstPiece = "";
        let firstPieceLower = "";
        let lastPiece = "";
        let _languagePrompts, _languageAnswers;

        for (let line of content.split(/\r?\n/)) {
            if (line.trim().length < 1) {
                continue;
            }

            line = line.trim();

            if (line.startsWith(`"`) && line.endsWith(`"`)) {
                pieces = Parser.breakPieces(line, delim);
            } else {
                pieces = line.split(delim);
            }

            firstPiece = Parser.cleanCell(pieces[0]);
            lastPiece = Parser.cleanCell(pieces[pieces.length - 1]);

            firstPieceLower = firstPiece.toLowerCase();
            if (["_title", "_t"].includes(firstPieceLower)) {
                _title = lastPiece;
            } else if (["_source", "_src"].includes(firstPieceLower)) {
                _sourceName = lastPiece;
            } else if (["_sourceurl", "_url"].includes(firstPieceLower)) {
                _sourceURL = lastPiece;
            } else if (["_languageprompts", "_lngp"].includes(firstPieceLower)) {
                _languagePrompts = lastPiece.toLowerCase();
                // $("#optLanguagePrompts").val(languagePrompts).change();
            } else if (["_languageAnswers", "_lnga"].includes(firstPieceLower)) {
                _languageAnswers = lastPiece.toLowerCase();
                // $("#optLanguageAnswers").val(languageAnswers).change();
            } else {
                _dictionary[firstPiece] = lastPiece;
            }
        }

        return {
            dictionary: _dictionary,
            title: _title,
            sourceName: _sourceName,
            sourceURL: _sourceURL,
            delimiter: delim,
            languagePrompts: _languagePrompts,
            languageAnswers: _languageAnswers
        };
    };

    static cleanCell = (cell) => {
        cell = cell.trim();
        if (cell.startsWith(`"`) && cell.endsWith(`"`)) {
            cell = cell.slice(1, cell.length - 1);
        }

        return cell;
    };

    static detectDelimiter = (
        text,
        targetPieces = -1,
        whitelist = "\t\v:;|,",
        blacklist = []
    ) => {
        let firstLine = text.split(/\r?\n/)[0];
        if (firstLine.startsWith("SEP=")) {
            return firstLine.split("=")[1];
        }

        if (blacklist.length === 0) {
            blacklist = "abcdefghijklmnopqrstuvwxyz";
            blacklist += blacklist.toUpperCase();
            blacklist += "0123456789.";
        }

        let whitelist2 = "";
        for (let c of whitelist) {
            if (!blacklist.includes(c)) {
                whitelist2 += c;
            }
        }
        whitelist = whitelist2;

        let candidates = {};

        let lines;
        let pieces;
        let nPieces;
        let isViable;
        let nOccurrences;

        for (let d of whitelist) {
            isViable = true;

            // Hmm
            while (text.includes(d + d)) {
                text = text.replace(d + d, d);
            }

            lines = text.split(/\r?\n/);
            targetPieces = -1;
            nOccurrences = 0;

            for (let line of lines) {
                if (line.trim().length < 1) {
                    continue;
                }

                pieces = line.split(d);

                // This is not general purpose because empty cells SHOULD be possible. :(
                pieces = pieces.filter((p) => {
                    return !!p.trim();
                });

                nPieces = pieces.length;
                if (nPieces < 2) {
                    isViable = false;
                    break;
                } else {
                    if (targetPieces === -1) {
                        targetPieces = nPieces;
                    } else if (nPieces !== targetPieces) {
                        isViable = false;
                        break;
                    }
                }

                nOccurrences += nPieces - 1;
            }

            if (isViable) {
                candidates[d] = nOccurrences;
            }
        }

        // return the one with the most occurrences
        if (Object.keys(candidates).length === 0) {
            // console.log("Could not find any candidate delimiters....");
            true; //
        } else {
            return Object.keys(candidates).reduce((a, b) =>
                candidates[a] > candidates[b] ? a : b
            );
        }
    };
}

class Downloader {

    static downloadFile = (content, name, type) => {
        const blob = new Blob([content], {type: type});
        if (window.navigator.msSaveOrOpenBlob) {
            window.navigator.msSaveBlob(blob, name);
        } else {
            const elem = window.document.createElement(`a`);
            elem.href = window.URL.createObjectURL(blob);
            elem.download = name;
            document.body.appendChild(elem);
            elem.click();
            document.body.removeChild(elem);
        }
    };

    static prepareAndDownloadFile = (formatter, ext, type) => {
        let data = compileSaveData();
        let content = formatter(data);
        Downloader.downloadFile(content, Downloader.formatFilename(data, ext), type);
    };

    static downloadJSON = () => {
        Downloader.prepareAndDownloadFile(JSON.stringify, "json", "application/json");
    };

    static downloadCSV = () => {
        Downloader.prepareAndDownloadFile(Downloader.formatCSV, "csv", "text/csv");
    };

    static downloadTXT = () => {
        Downloader.prepareAndDownloadFile(Downloader.formatTXT, "txt", "text/plain");
    };

    static formatDataRow = (data, key, delim, wrap = false) => {
        if (key in data) {
            let ukey = "_" + key;
            let val = data[key];
            if (wrap) {
                ukey = `"${ukey}"`;
                val = `"${val}"`;
            }
            return `${ukey}${delim}${val}\n`;
        } else {
            return ``;
        }
    };

    static formatDictRow = (p, a, delim, wrap = false) => {
        if (wrap) {
            p = `"${p}"`;
            a = `"${a}"`;
        }
        return `${p}${delim}${a}\n`;
    };

    static formatCSV = (data) => {
        // start with utf-8 BOM
        let csv = "\ufeff";

        for (let k of [
            "title",
            "source",
            "sourceURL",
            "languagePrompts",
            "languageAnswers"
        ]) {
            csv += Downloader.formatDataRow(data, k, defaultCSVDelimiter, true);
        }

        for (const [p, a] of Object.entries(data["dictionary"])) {
            csv += Downloader.formatDictRow(p, a, defaultCSVDelimiter, true);
        }

        return csv;
    };

    static formatTXT = (data) => {
        let txt = "";
        let delim = Downloader.chooseDelimiter(data);

        for (let k of [
            "title",
            "source",
            "sourceURL",
            "languagePrompts",
            "languageAnswers"
        ]) {
            txt += Downloader.formatDataRow(data, k, delim);
        }

        txt += "\n";

        for (const [p, a] of Object.entries(data["dictionary"])) {
            txt += Downloader.formatDictRow(p, a, delim);
        }

        return txt;
    };

    static formatFilename = (data, ext) => {
        let filename = "";

        // core element
        if ("title" in data) {
            filename = title;
        } else if ("source" in data) {
            filename = source;
        }

        // separate from timestamp
        if (filename) {
            filename += " ";
        }

        // sanitization characters
        // https://gist.github.com/barbietunnie/7bc6d48a424446c44ff4
        let illegalRe = /[\/\?<>\\:\*\|"]/g;
        let controlRe = /[\x00-\x1f\x80-\x9f]/g;
        let reservedRe = /^\.+$/;
        let windowsReservedRe = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;

        // sanitize
        filename = filename
            .replace(illegalRe, "_")
            .replace(controlRe, "_")
            .replace(reservedRe, "_")
            .replace(windowsReservedRe, "_")
            .slice(0, 245);

        // add timestamp
        let date = new Date();
        let offset = date.getTimezoneOffset();
        date = new Date(date.getTime() - offset * 60 * 1000);
        let ts = date.toISOString().split("T")[0];
        filename += ts;

        // add extension
        return `${filename}.${ext}`;
    };

    static chooseDelimiter = (data) => {
        let candidates = "\t,\v:;|";

        let found = false;
        for (const c of candidates) {
            for (const [p, a] of Object.entries(data["dictionary"])) {
                if (p.includes(c) || a.includes(c)) {
                    found = true;
                    break;
                }
            }
            if (!found) {
                return c;
            }
        }

        // TODO none found -- need to wrap in quotes?
        return "";
    };
}

const upload = () => {
    $("#btnUpload").click();
};

class Receiver {
    static ameliorateData = (data) => {

        // Source URL protocol
        if (! data.sourceURL.startsWith("http")) {
            data.sourceURL = "https://" + data.sourceURL;
        }

        // Title: if none, use source; if no source, use unknown
        if (! data.title) {
            if (! data.sourceName) {
                data.title = "Unknown Flashcard Deck";
                data.sourceName = "Unknown";
            } else {
                data.title = data.sourceName;
            }
        }

        // If title and no source, make source title (should it just be "unknown"?
        if (! data.sourceName) {
            data.sourceName = data.title;
        }

        if (! data.languagePrompts) {
            data.languagePrompts = defaultLanguagePrompts;
        }

        if (! data.languageAnswers) {
            data.languageAnswers = defaultLanguageAnswers;
        }
    }

    static handleIncomingData = data => {
        Receiver.ameliorateData(data);

        // Back out if no functional dictionary (cannot be ameliorated...)
        if (! data.dictionary || (Object.keys(data.dictionary).length === 0)) {
            return;
        }

        // Make deck, set deck, trigger change
        app.deck = Deck.fromData(data);
        app.handleRestartingChange();
    }

    static handleIncomingFile = (content, path) => {
        let data = Parser.parseData(content, path);
        Receiver.handleIncomingData(data);
    };
}

const toggleVisibility = (element, visible) => {
    if (visible) {
        element.removeClass("hide");
    } else {
        element.addClass("hide");
    }
}

const toggleControl = (control, enable) => {
    control.prop("disabled", !enable);
};

const updateGameControls = () => {
    toggleControl($("#btnNext"), app.playthrough.canNext());
    toggleControl($("#btnPrevious"), app.playthrough.canPrevious());
    toggleControl($("#btnReveal"), app.playthrough.canReveal());
    toggleControl($("#btnRestart"), app.playthrough.canRestart());
}

const populateEditorLanguages = () => {

    for (let id of ["editLanguagePrompts", "editLanguageAnswers"]) {
        select = $(`#${id}`);
        select.empty();

        option = `<option value="--">--</option>`;
        select.append(option);

        for (let lang of Languages) {
            optionValue = lang['code'].toLowerCase();
            optionText = lang['name'];
            option = `<option value="${optionValue}">${optionText}</option>`;
            select.append(option);
        }
    }

    $('#editLanguagePrompts').val(languagePrompts);
    $('#editLanguageAnswers').val(languageAnswers);
}

const populateEditorMeta = () => {
    $('#editSource').val(source);
    $('#editTitle').val(title);
    $('#editURL').val(sourceURL);

    populateEditorLanguages();
}

const formatEditorItem = (i, key, val) => {
    return `<div class='editItem editItemContent flexRow' id='editItem-${i}'><input class='editItemInput editItemPrompt' value='${key}'><input class='editItemInput editItemAnswer' value='${val}'><button class='btnEditDeleteItem buttonBase buttonEffects' id='btnEditDeleteItem-${i}' title='Delete this item'>-</button></div>`;
}

const formatEditorAddItem = () => {
    return `<div class='editItem flexRow' id='editItem-Add'><button class='btnEditAddItem buttonBase buttonEffects' id='btnEditAddItem' title='Add a new item'>+</button></div>`;
}

const populateEditorItems = () => {
    $('#editItemsList').html("");

    let items = "";
    let val;
    let i = 0;

    for (let key of Object.keys(app.deck.dictionary)) {
        val = app.deck.dictionary[key];
        items += formatEditorItem(i, key, val);
        i += 1;
    }

    items += formatEditorAddItem();

    // paint
    $('#editItemsList').html(items);

    // bind
    $('.editItemInput').keyup(editItemField);
    $('.editItemInput').change(editItemField);
    $('#btnEditAddItem').click(editAddItem);
    $('.btnEditDeleteItem').click(e => {
        editDeleteItem(e);
    });
}

const populateEditorRaw = () => {
    let raw = "";
    let val;

    for (let key of Object.keys(app.deck.dictionary)) {
        val = app.deck.dictionary[key];
        raw += `${key}\t${val}\n`;
    }

    $('#editRaw').val(raw.trim());
}

const shareURLIsValid = () => {
    return shareURL.length <= maxURLLength;
};

const createShareURL = () => {
    let params = formatURLParams();
    shareURL = `${baseURL}?${params}`;
};

const populateShareURL = () => {
    createShareURL();

    if (shareURLIsValid()) {
        $("#shareURL").val(shareURL);
        toggleControl($("#btnCopyShareURL"), true);
        toggleControl($("#shareURL", true));
    } else {
        $("#shareURL").val(
            "[Too much data for URL encoding. Edit data or download instead.]"
        );
        toggleControl($("#btnCopyShareURL"), false);
        toggleControl($("#shareURL", false));
    }
};

const readDataFromURL = () => {
    let params = new URLSearchParams(location.search);
    if (!params.has("d")) {
        return;
    }

    let _d = JSON.parse(_decompress(params.get("d")));
    let _t = params.has("t") ? decodeURIComponent(params.get("t")) : "";
    let _s = params.has("s") ? decodeURIComponent(params.get("s")) : "";
    let _u = params.has("u") ? decodeURIComponent(params.get("u")) : "";

    if (params.has("lp")) {
        $("#optLanguagePrompts")
            .val(decodeURIComponent(params.get("lp").toLowerCase()))
            .change();
    }

    if (params.has("la")) {
        $("#optLanguageAnswers")
            .val(decodeURIComponent(params.get("la").toLowerCase()))
            .change();
    }

    setData(_d, _t, _s, _u);
};

const compileSaveData = () => {
    let data = {};

    data["dictionary"] = JSON.parse(JSON.stringify(dictionary));

    if (title && title !== source) {
        data["title"] = title;
    }

    if (source) {
        data["source"] = source;
    }

    if (sourceURL) {
        data["sourceURL"] = sourceURL;
    }

    if (
        $("#optLanguagePrompts").val() &&
        $("#optLanguagePrompts").val() !== "--" &&
        $("#optLanguagePrompts").val() !== defaultDeck.languagePrompts
    ) {
        data["languagePrompts"] = $("#optLanguagePrompts").val();
    }

    if (
        $("#optLanguageAnswers").val() &&
        $("#optLanguageAnswers").val() !== "--" &&
        $("#optLanguageAnswers").val() !== defaultDeck.languageAnswers
    ) {
        data["languageAnswers"] = $("#optLanguageAnswers").val();
    }

    return data;
};

const formatURLParams = () => {
    let _data = compileSaveData();

    // compress the dict

    _data["dictionary"] = _compress(JSON.stringify(_data["dictionary"]));

    // shorten the URL

    if ("sourceURL" in _data) {
        let surl = _data["sourceURL"];
        if (surl.includes("://")) {
            surl = surl.split("://")[1];
        }
        _data["sourceURL"] = surl;
    }

    // encode components

    if ("title" in _data) {
        _data["title"] = encodeURIComponent(_data["title"]);
    }

    if ("source" in _data) {
        _data["source"] = encodeURIComponent(_data["source"]);
    }

    if ("sourceURL" in _data) {
        _data["sourceURL"] = encodeURIComponent(_data["sourceURL"]);
    }

    // shorten keys

    Tools.renameObjectKeys(_data, {
        dictionary: "d",
        sourceURL: "u",
        title: "t",
        source: "s",
        languagePrompts: "lp",
        languageAnswers: "la"
    });

    return new URLSearchParams(_data);
};

const _compress = (data) => {
    return LZString.compressToEncodedURIComponent(data);
};

const _decompress = (data) => {
    return LZString.decompressFromEncodedURIComponent(data);
};

const copyShareURL = () => {
    if (stage.hiding("edit") || !shareURLIsValid()) {
        return;
    }

    copyToast = Copy.toast(copyToast, $("#shareURL").val(), 'Copied share URL!');
};

const createLanguageOptions = () => {
    let select, option, optionValue, optionText;

    for (let id of ["optLanguagePrompts", "optLanguageAnswers"]) {
        select = $(`#${id}`);
        select.empty();

        option = `<option value="--">--</option>`;
        select.append(option);

        for (let lang of voiceLanguages) {
            optionValue = lang[0];
            optionText = lang[1];
            option = `<option value="${optionValue}">${optionText}</option>`;
            select.append(option);
        }
    }
};

const updateVoiceLanguages = () => {
    if (typeof speechSynthesis === "undefined") {
        return;
    }

    let niceName = "";
    let languageToNiceName = {};
    let languageSet = new Set();
    let voices = speechSynthesis.getVoices();

    for (let voice of voices) {
        niceName = voice.lang;
        if (niceName.includes(" - ")) {
            niceName = niceName.split(" - ")[1];
        }

        languageToNiceName[voice.lang.toLowerCase()] = niceName;
        languageSet.add(voice.lang.toLowerCase());
    }

    voiceLanguages = [];
    for (let lang of languageSet) {
        voiceLanguages.push([lang, languageToNiceName[lang]]);
    }
};

const getVoiceOptions = (language) => {
    if (typeof speechSynthesis === "undefined") {
        return;
    }

    let voices = speechSynthesis.getVoices();
    let voiceOptions = [];

    for (let voice of voices) {
        if (voice.lang.toLowerCase() === language) {
            voiceOptions.push(voice);
        }
    }

    return voiceOptions;
};

const createVoiceOptions = (select, language) => {
    let option, optionValue, optionText;

    let voices = getVoiceOptions(language);

    select.empty();

    if (voices.length === 0) {
        option = `<option value="--">--</option>`;
        select.append(option);
    } else {
        for (let voice of voices) {
            optionValue = voice.name;
            optionText = voice.name.split(" - ")[0];
            option = `<option value="${optionValue}">${optionText}</option>`;
            select.append(option);
        }

        select.val(voices[0].name).change();
    }
};

const updateVoicePromptsOptions = () => {
    createVoiceOptions($("#optVoicePrompts"), $("#optLanguagePrompts").val());
};

const updateVoiceAnswersOptions = () => {
    createVoiceOptions($("#optVoiceAnswers"), $("#optLanguageAnswers").val());
};

const updateVoiceOptions = () => {
    updateVoiceLanguages();
    createLanguageOptions();
    updateVoicePromptsOptions();
    setLanguageOptions();
    updateVoiceAnswersOptions();
};

const getClosestVoiceLanguage = (lang) => {
    let ids = [];
    let keys = {};
    let id, key;

    for (let tuple of voiceLanguages) {
        id = tuple[0];
        key = id.split('-')[0];
        ids.push(tuple[0]);

        if (!(key in keys)) {
            keys[key] = [];
        }
        keys[key].push(id);
    }

    let langkey = lang.split('-')[0];

    if (ids.includes(lang)) {
        return lang;
    } else {

        // TODO Probably improve this by just mapping...
        if (langkey in keys) {
            return keys[langkey][0];
        } else {
            return '--';
        }
    }
}

const setLanguageOptions = () => {
    let _lp = getClosestVoiceLanguage(app.deck.languagePrompts);
    let _la = getClosestVoiceLanguage(app.deck.languageAnswers);

    $("#optLanguagePrompts").val(_lp).change();
    $("#optLanguageAnswers").val(_la).change();
}

const makeUtterance = (text, voiceName, rate) => {

    if (optSilentParentheses.value()) {
        text = text.replace(/\(.*?\)/i, "");
    }

    if (optSilentAlternatives.value()) {
        let re = /\/.*/i;
        text = text.replace(re, "");
    }

    let utterance = new SpeechSynthesisUtterance(text);
    for (let voice of speech.getVoices()) {
        if (voice.name === voiceName) {
            utterance.voice = voice;
            break;
        }
    }

    // TODO
    utterance.pitch = 1;
    utterance.rate = rate;
    utterance.volume = optVolume.value() / 100;
    return utterance;
};

const sayUtterance = (text, voiceName, rate) => {
    if (voiceName === "--") {
        return;
    }
    let utterance = makeUtterance(text, voiceName, rate);
    speech.speak(utterance);
};

const toggleWord = (holder, hider, show) => {
    toggleVisibility(holder, show);
    toggleVisibility(hider, !show);
};

const toggleTextPromptVisibility = () => {
    let optionOne = [
        app.playthrough.state === PlaythroughState.AfterNext,
        app.options.showPrompt.value() === 'showPromptNext'
    ].every(Boolean);

    let optionTwo = [
        app.playthrough.state === PlaythroughState.AfterReveal,
        [
            app.options.showPrompt.value() === 'showPromptNext',
            app.options.showPrompt.value() === 'showPromptReveal'
        ].some(Boolean)
    ].every(Boolean);

    toggleWord($("#prompt"), $("#promptHider"), optionOne || optionTwo);
};

const toggleTextAnswerVisibility = () => {
    let optionOne = [
        app.playthrough.state === PlaythroughState.AfterNext,
        app.options.showAnswer.value() === 'showAnswerNext'
    ].every(Boolean);

    let optionTwo = [
        app.playthrough.state === PlaythroughState.AfterReveal,
        [
            app.options.showAnswer.value() === 'showAnswerNext',
            app.options.showAnswer.value() === 'showAnswerReveal'
        ].some(Boolean)
    ].every(Boolean);

    toggleWord($("#answer"), $("#answerHider"), optionOne || optionTwo);
};

const displaySamples = () => {
    let keys = Object.keys(app.deck.dictionary);
    let sP = keys[0];
    let sA = app.deck.dictionary[sP];

    $("#samplePrompt").text(`e.g. "${sP}"`);
    $("#sampleAnswer").text(`e.g. "${sA}"`);
};

const invertDictionary = () => {

    let vLP = $("#optLanguagePrompts").val();
    let vVP = $("#optVoicePrompts").val();
    let vRP = app.options.voicePromptsRate.value();

    let vLA = $("#optLanguageAnswers").val();
    let vVA = $("#optVoiceAnswers").val();
    let vRA = app.options.voiceAnswersRate.value();

    // TODO
    $("#optLanguagePrompts").val(vLA).change();
    $("#optLanguageAnswers").val(vLP).change();

    updateVoicePromptsOptions();
    updateVoiceAnswersOptions();

    // TODO
    $("#optVoicePrompts").val(vVA).change();
    $("#optVoiceAnswers").val(vVP).change();

    app.options.voicePromptsRate.value(vRA);
    app.options.voiceAnswersRate.value(vRP);

    // basics
    app.deck = app.deck.copy().invert();
    displaySamples();
    changeOptionAndRestart();
};

const changeOption = () => {
    app.options.optionsChanged = true;
    toggleControl($("#btnSetDefaultOptions"), true);
};

const changeOptionAndRestart = () => {
    changeOption();
    app.playthrough.restart();
};

const editMetaField = () => {
    ß
    let _source = $('#editSource').val().trim();
    let _title = $('#editTitle').val().trim();
    let _sourceURL = $('#editURL').val().trim();

    if (_sourceURL.length === 0) {
        _sourceURL = "#";
    }

    languagePrompts = $('#editLanguagePrompts').val();
    languageAnswers = $('#editLanguageAnswers').val();

    setNonRestartData(_source, _title, _sourceURL);
    toggleControl($("#btnReset"), true);
}

const editLanguageField = () => {
    editMetaField();
    updateVoiceOptions();
}

const editItemField = () => {
    let newDictionary = {};

    let els = $('.editItemContent');
    let key, val;

    els.each(function () {
        key = $(this).find('.editItemPrompt').val().trim();
        val = $(this).find('.editItemAnswer').val().trim();

        if ((key !== "") && (val !== "")) {
            newDictionary[key] = val;
        }
    });

    setRestartData(newDictionary, true, false);
    toggleControl($("#btnReset"), true);
}

const editRawField = () => {
    let raw = $('#editRaw').val().trim();
    let parsed = parseTXT(raw);

    let newDictionary = parsed['dictionary'];
    // let newDelimiter = parsed['delimiter'];

    setRestartData(newDictionary, false, true);
    toggleControl($("#btnReset"), true);
}

const editClearAll = () => {
    editClearMeta();
    editClearItems();
}

const editClearMeta = () => {
    $('#editSource').val("");
    $('#editTitle').val("");
    $('#editURL').val("#");
    $('#editLanguagePrompts').val("--");
    $('#editLanguageAnswers').val("--");
    editMetaField();
    editLanguageField();
}

const editClearItems = () => {
    $('.editItemContent').each(function () {
        this.remove();
    });
    editItemField();
}

const editClearRaw = () => {
    $('#editRaw').val("");
    editRawField();
}

const editAddItem = () => {
    let list = $('#editItemsList');

    let highest = 0;
    let current;
    $('.editItemContent').each(function () {
        current = parseInt(this.id.split('-')[1]);
        if (current >= highest) {
            highest = current + 1;
        }
    });

    let item = formatEditorItem(highest, "", "");

    $('#editItem-Add').remove();
    list.append(item);

    $('.editItemInput').unbind();
    $('.editItemInput').keyup(editItemField);
    $('.editItemInput').change(editItemField);

    list.append(formatEditorAddItem());
    $('#btnEditAddItem').click(editAddItem);
    $('.btnEditDeleteItem').unbind();
    $('.btnEditDeleteItem').click(e => {
        editDeleteItem(e);
    });
}

const editDeleteItem = (e) => {
    $(e.target).remove();
    // let i = e.target.id.split('-')[1];
    // let id = `#editItem-${i}`;
    // $(id).remove();

    editItemField();
}

const createUploadButton = () => {
    UploadButton.create(
        $("#uploadButtonContainer"),
        receiveUploadedContent,
        "btnUpload",
        "buttonBase buttonEffects buttonFooter",
        "Upload [U]"
    );
};

const createDropzone = () => {
    DropzoneUniversal.create(
        $("#app"),
        receiveUploadedContent,
        "dropzone",
        "dropzone"
    );
};

/* Display updater */

updateDisplay = () => {
    $("#prompt").text(app.playthrough.prompt);
    $("#answer").text(app.playthrough.answer);

    toggleTextPromptVisibility();
    toggleTextAnswerVisibility();

    $("#infoCount").text(app.playthrough.index + 1);
    toggleVisibility($("#toBeginPanel"),
        app.playthrough.state === PlaythroughState.InitializedButNotStarted);
}

/*
* Possibility-checking aliases... a little redundant, but...
* Having these checks in the functions themselves requires adding a force flag,
* and having them as anonymous functions during binding seems uglier than this
* (especially because keyup and buttons both need to bind them).
*/

const next = () => {
    if (app.playthrough.canNext()) {
        app.playthrough.next();
    }
}

const previous = () => {
    if (app.playthrough.canPrevious()) {
        app.playthrough.previous();
    }
}

const reveal = () => {
    if (app.playthrough.canReveal()) {
        app.playthrough.reveal();
    }
}

const restart = () => {
    if (app.playthrough.canRestart()) {
        app.playthrough.restart();
    }
}

const reset = () => {
    if (app.canReset()) {
        app.reset();
    }
};

/* Binders */

const handleKeyup = (e) => {

    // If we are escaping from a text entry field, don't hide the window... apparently
    let tag = document.activeElement.tagName;
    if (["input", "textarea"].includes(tag.toLowerCase()) && (e.code !== "Escape")) {
        return;
    }

    switch (e.code) {
        case "KeyN":
            next();
            break;

        case "KeyP":
            previous();
            break;

        case "KeyR":
            reveal();
            break;

        case "KeyX":
            restart();
            break;

        case "KeyU":
            upload();
            break;

        case "KeyZ":
            reset();
            break;

        case "KeyH":
            stage.toggle("help");
            break;

        case "KeyO":
            stage.toggle("options");
            break;

        case "KeyS":
            stage.toggle("share");
            break;

        case "KeyE":
            stage.toggle("edit");
            break;

        case "KeyD":
            app.options.setDynamicOptionDefaults();
            break;

        case "Escape":
            stage.show('game');

            if ($("#dropzone").css("display") !== "none") {
                $("#dropzone").css("display", "none");
            }

            break;
    }
};

const bindGameControls = () => {
    $("#btnNext").click(next);
    $("#btnPrevious").click(previous);
    $("#btnReveal").click(reveal);
    $("#btnRestart").click(restart);
    $("#btnReset").click(reset);
}

const bindShareControls = () => {
    $("#btnCopyShareURL").click(copyShareURL);
    $("#btnDownloadJSON").click(Downloader.downloadJSON);
    $("#btnDownloadCSV").click(Downloader.downloadCSV);
    $("#btnDownloadTXT").click(Downloader.downloadTXT);
}

const bindOptionsControls = () => {
    $("#btnSetDefaultOptions").click(app.options.setDynamicOptionDefaults());
}

const bindEditorControls = () => {
    $('#editSource').keyup(editMetaField);
    $('#editTitle').keyup(editMetaField);
    $('#editURL').keyup(editMetaField);
    $('#editSource').change(editMetaField);
    $('#editTitle').change(editMetaField);
    $('#editURL').change(editMetaField);

    $('#editLanguagePrompts').change(editLanguageField);
    $('#editLanguageAnswers').change(editLanguageField);

    $('#editRaw').keyup(editRawField);
    $('#editRaw').change(editRawField);

    $('#btnEditClearAll').click(editClearAll);
    $('#btnEditClearMeta').click(editClearMeta);
    $('#btnEditClearItems').click(editClearItems);
    $('#btnEditClearRaw').click(editClearRaw);
    $('#btnEditSetDefaults').click(reset);
}

const bind = () => {
    bindGameControls();
    bindShareControls();
    bindOptionsControls();
    bindEditorControls();

    $(document).keyup(handleKeyup);
    speechSynthesis.onvoiceschanged = updateVoiceOptions;
};

/* Basics */

const addScenes = () => {
    stage.addScene(
        new _Scene("game", "#gamePanel", "", [$("#gamePanel button")])
    );
    stage.addScene(new _Scene("edit", "#editPanel", "#btnEdit", []));
    stage.addScene(
        new _Scene("options", "#optionsPanel", "#btnOptions", [
            $("#optionsPanel button"),
            $("#optionsPanel input")
        ])
    );
    stage.addScene(new _Scene("help", "#helpPanel", "#btnHelp", []));

    stage.setDefault("game");
};

const updateCopyright = () => {
    $('#copyrightYear').text(new Date().getFullYear());
}

const initialize = () => {
    updateCopyright();

    stage = new _Stage();
    addScenes();
    stage.show("game");

    app = new App();
    app.setupDefault();

    createUploadButton();
    createDropzone();

    bind();

    updateVoiceOptions();

    readDataFromURL();
};

/* Initial things and startup */

const defaultDeck = new Deck();
defaultDeck.dictionary = {
    chien: "dog",
    bonjour: "hello",
    fille: "girl"
};
defaultDeck.title = "French Test Deck";
defaultDeck.sourceName = "French Test Deck";
defaultDeck.sourceURL = "#";
defaultDeck.languagePrompts = "fr-ca";
defaultDeck.languageAnswers = "en-us";

let stage;
let app = null;

$(document).ready(initialize);
