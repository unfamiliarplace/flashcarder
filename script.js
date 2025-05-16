class App {
    deck;
    invertedDeck;
    playthrough;

    voiceLanguages;

    setDeck = deck => {
        this.deck = deck;
        this.invertedDeck = this.deck.copy().invert();
        this.handleDeckChange();
    }

    getActiveDeck = () => {
        return (options.invertDictionary.value()) ? this.invertedDeck : this.deck;
    }

    setDefault = () => {
        this.setDeck(defaultDeck.copy());
    }

    deckHasChanged = () => {
        return (!!this.deck) && (!this.deck.equals(defaultDeck));
    }

    deckHasMeta = () => {
        return (!!this.deck) &&
            [
                this.deck.title.length > 0,
                this.deck.sourceName.length > 0,
                this.deck.sourceURL.length > 0,
                !['', '--'].includes(this.deck.languagePrompts),
                !['', '--'].includes(this.deck.languageAnswers),
            ].some(Boolean);
    }

    deckHasContent = () => {
        return (!!this.deck) && (Object.keys(this.deck.dictionary).length > 0);
    }

    reset = () => {
        speechSynthesis.cancel(); // JIC I guess?

        this.voiceLanguages = {}; // TODO ??

        this.setDefault();
        options.setDynamicOptionDefaults();

        View.updateControls();
    }

    handleDeckChange = (editorArgs) => {
        if (!editorArgs) {
            editorArgs = {};
        } // JIC

        this.playthrough = new Playthrough();

        let n = Object.keys(this.deck.dictionary).length;
        $('#editItemsHeading').text(`Items (${n})`);
        $('#infoDenom').text(n);

        Editor.populate(editorArgs);
        this.handleRestartingChange();
    }

    handleRestartingChange = () => {
        this.playthrough.restart();
        this.handleGeneralChange();
    }

    handleGeneralChange = () => {
        $("#deckTitle").text(app.deck.title);
        View.updateSourceView();
        View.updateCardView();
        View.updateShareURLView();
        View.updateControls();
    }
}

class Deck {
    dictionary;
    title;
    sourceName;
    sourceURL;
    languagePrompts;
    languageAnswers;

    static fromData = (data) => {
        let deck = new Deck();

        deck.dictionary = JSON.parse(JSON.stringify(data.dictionary));
        deck.title = data.title;
        deck.sourceName = data.sourceName;
        deck.sourceURL = data.sourceURL;
        deck.languagePrompts = data.languagePrompts;
        deck.languageAnswers = data.languageAnswers;

        return deck;
    }

    copy = () => {
        // Works since the data is just an Object like this Deck...
        return Deck.fromData(this);
    }

    invert = () => {
        this.dictionary = JSTools.swapObjectKeys(this.dictionary);
        return this;
    }

    toData = () => {
        return {
            dictionary: this.dictionary,
            title: this.title,
            sourceName: this.sourceName,
            sourceURL: this.sourceURL,
            languagePrompts: this.languagePrompts,
            languageAnswers: this.languageAnswers
        };
    }

    equals = (other) => {
        return JSON.stringify(this.toData()) === JSON.stringify(other.toData());
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

        if (options.randomizeOrder.value()) {
            this.order = Random.shuffle(this.order);
        }
    }

    updateCard = () => {
        let deck = app.getActiveDeck();

        let i = this.order[this.index];
        let keys = Object.keys(deck.dictionary);
        this.prompt = keys[i];
        this.answer = deck.dictionary[this.prompt];
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
                options.showAnswer.value() === 'showAnswerReveal',
                options.sayAnswer.value()
            ].some(Boolean)
        ].every(Boolean);
    }

    canRestart = () => {
        return this.canPrevious(); // K
    }

    sayPrompt = () => {
        if (options.sayPrompt.value()) {
            speechSynthesis.cancel();
            let voice = $("#optVoicePrompts").val(); // TODO
            let rate = options.voicePromptsRate.value() / 100
            sayUtterance(prompt, voice, rate);
        }
    }

    sayReveal = () => {
        if (options.sayAnswer.value()) {
            speechSynthesis.cancel();
            let voice = $("#optVoiceAnswers").val(); // TODO
            let rate = options.voiceAnswersRate.value() / 100;
            sayUtterance(this.answer, voice, rate);
        }
    }

    next = () => {
        this.state = PlaythroughState.AfterNext;

        this.index++;
        this.updateCard();

        // TODO What if they have show answer on next and read aloud on reveal?
        this.sayPrompt();

        View.updateCardView();
        View.updateControls();
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

        View.updateCardView();
        View.updateControls();
    }

    reveal = () => {
        this.state = PlaythroughState.AfterReveal;

        this.sayReveal();

        View.updateCardView();
        View.updateControls();
    };

    restart = () => {
        this.state = PlaythroughState.InitializedButNotStarted;

        this.clearCard();
        this.updateOrder();

        speechSynthesis.cancel();

        View.updateCardView();
        View.updateControls();
    };
}

class Options {
    // TODO Add option to toggle whether restarting reshuffles order or not

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

    initialize = () => {
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
        this.volume.value(optDefaultVolume);
        this.voicePromptsRate.value(optDefaultVoicePromptsRate);
        this.voiceAnswersRate.value(optDefaultVoiceAnswersRate);

        this.showPrompt.value(optDefaultShowPrompt);
        this.showAnswer.value(optDefaultShowAnswer);
        this.sayPrompt.value(optDefaultSayPrompt);
        this.sayAnswer.value(optDefaultSayAnswer);

        this.randomizeOrder.value(optDefaultRandomizeOrder);
        this.invertDictionary.value(optDefaultInvertDictionary);
        this.silentParentheses.value(optDefaultSilentParentheses);
        this.silentAlternatives.value(optDefaultSilentAlternatives);

        View.updateControls();
    };

    bindDynamicOptions = () => {
        this.showPrompt.change(View.toggleTextPromptVisibility);
        this.showAnswer.change(View.toggleTextPromptVisibility);

        $("#optionsPanel input").change(View.updateControls);
        $("#optionsPanel select").change(View.updateControls);
        this.voiceAnswersRate.change(View.updateControls);
        this.voicePromptsRate.change(View.updateControls);

        this.randomizeOrder.change(app.handleRestartingChange);
        this.invertDictionary.change(handleChangeInvertDictionary);
        this.silentParentheses.change(View.updateControls);
        this.silentAlternatives.change(View.updateControls);
    }

    haveChanged = () => {
        return [
            options.volume.value() !== optDefaultVolume,
            options.voicePromptsRate.value() !== optDefaultVoicePromptsRate,
            options.voiceAnswersRate.value() !== optDefaultVoiceAnswersRate,

            options.showPrompt.value() !== optDefaultShowPrompt,
            options.showAnswer.value() !== optDefaultShowAnswer,
            options.sayPrompt.value() !== optDefaultSayPrompt,
            options.sayAnswer.value() !== optDefaultSayAnswer,

            options.randomizeOrder.value() !== optDefaultRandomizeOrder,
            options.invertDictionary.value() !== optDefaultInvertDictionary,
            options.silentParentheses.value() !== optDefaultSilentParentheses,
            options.silentAlternatives.value() !== optDefaultSilentAlternatives

            // TODO missing the voice selection?
        ].some(Boolean);
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
        return Parser._parseCSVLike(content, defaultCSVDelimiter);
    };

    static parseTXT = (content) => {
        let delim = Parser.detectDelimiter(content);
        return Parser._parseCSVLike(content, delim);
    };

    static breakPieces = (line, delim) => {
        let re_pieces = `/"(.+?)"${delim}"(.+?)"/`;
        let result = re_pieces.exec(line);
        return [Parser.cleanCell(result[1]), Parser.cleanCell(result[2])];
    };

    static _parseCSVLike = (content, delim) => {
        let data = {};
        data.dictionary = {};

        let pieces = [];
        let firstPiece = "";
        let firstPieceLower = "";
        let lastPiece = "";

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
                data.title = lastPiece;
            } else if (["_source", "_sourcename", "_src"].includes(firstPieceLower)) {
                data.sourceName = lastPiece;
            } else if (["_sourceurl", "_url"].includes(firstPieceLower)) {
                data.sourceURL = lastPiece;
            } else if (["_languageprompts", "_lngp"].includes(firstPieceLower)) {
                data.languagePrompts = lastPiece.toLowerCase();
            } else if (["_languageanswers", "_lnga"].includes(firstPieceLower)) {
                data.languageAnswers = lastPiece.toLowerCase();
            } else {
                data.dictionary[firstPiece] = lastPiece;
            }
        }

        return data;
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
            "sourceName",
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
            "sourceName",
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

        if (!!data.title) {
            filename = data.title;
        } else if (!!data.source) {
            filename = data.source;
        }

        // separate from timestamp
        if (filename) {
            filename += " ";
        }

        // sanitization characters
        // https://gist.github.com/barbietunnie/7bc6d48a424446c44ff4
        let illegalRe = /[\/?<>\\:*|"]/g;
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

class Receiver {

    static ameliorateData = (data) => {

        if (!data.title) {
            data.title = 'Untitled Deck';
        }

        if (!!data.sourceURL) {
            data.sourceURL = addSourceURLProtocol(data.sourceURL);
        } else {
            data.sourceURL = "";
        }

        if (!data.sourceName) {
            data.sourceName = "";
        }

        if (!data.languagePrompts) {
            data.languagePrompts = "--";
        }

        if (!data.languageAnswers) {
            data.languageAnswers = "--";
        }
    }

    static handleIncomingData = data => {
        Receiver.ameliorateData(data);

        // Back out if no functional dictionary (cannot be ameliorated...)
        if (!data.dictionary || (Object.keys(data.dictionary).length === 0)) {
            return;
        }

        // Make deck, set deck, trigger change
        app.setDeck(Deck.fromData(data));
    }

    static handleIncomingFile = (content, path) => {
        let data = Parser.parseData(content, path);
        Receiver.handleIncomingData(data);
    };
}

class Editor {

    static populateMeta = () => {
        $('#editTitle').val(app.deck.title);
        $('#editSourceName').val(app.deck.sourceName);
        $('#editSourceURL').val(app.deck.sourceURL);

        Editor.populateLanguages();
    }

    static formatItem = (i, key, val) => {
        let inputPrompt = `<input class='editItemInput editItemPrompt' value='${key}'>`;
        let inputAnswer = `<input class='editItemInput editItemAnswer' value='${val}'>`;
        let btnDelete = `<button class='btnEditDeleteItem buttonBase buttonEffects' data-item-index="${i}" id='btnEditDeleteItem-${i}' title='Delete this item'>-</button>`;
        return `<div class='editItem editItemContent flexRow' data-item-index="${i}" id='editItem-${i}'>${inputPrompt}${inputAnswer}${btnDelete}</div>`;
    }

    static formatAddItemButton = () => {
        let btnAdd = `<button class='btnEditAddItem buttonBase buttonEffects' id='btnEditAddItem' title='Add a new item'>+</button>`;
        return `<div class='editItem flexRow' id='editItem-Add'>${btnAdd}</div>`;
    }

    static populateItems = () => {
        $('#editItemsList').html("");

        let items = "";
        let val;
        let i = 0;

        for (let key of Object.keys(app.deck.dictionary)) {
            val = app.deck.dictionary[key];
            items += Editor.formatItem(i, key, val);
            i += 1;
        }

        items += Editor.formatAddItemButton();

        // paint
        $('#editItemsList').html(items);

        // bind
        $('.editItemInput').keyup(Editor.editItemField);
        $('.editItemInput').change(Editor.editItemField);
        $('#btnEditAddItem').click(Editor.addItem);
        $('.btnEditDeleteItem').click(e => {
            Editor.deleteItem(e);
        });
    }

    static populateRaw = () => {
        let raw = "";
        let val;

        for (let key of Object.keys(app.deck.dictionary)) {
            val = app.deck.dictionary[key];
            raw += `${key}${rawDelimiter}${val}\n`;
        }

        $('#editRaw').val(raw.trim());
    }

    static populate = (args) => {
        Editor.populateMeta();

        // These checks prevent editing items or raw from immediately parsing half-formed data as an error
        if (!args.skipItems) {
            Editor.populateItems();
        }

        if (!args.skipRaw) {
            Editor.populateRaw();
        }

        Editor.populateLanguages();
    }

    static editMetaField = () => {
        app.deck.title = $('#editTitle').val().trim();
        app.deck.sourceName = $('#editSourceName').val().trim();
        app.deck.sourceURL = addSourceURLProtocol($('#editSourceURL').val().trim());

        app.deck.languagePrompts = $('#editLanguagePrompts').val();
        app.deck.languageAnswers = $('#editLanguageAnswers').val();

        app.handleGeneralChange();
    }

    static editItemField = () => {
        let dict = {};

        let els = $('.editItemContent');
        let key, val;

        els.each(function () {
            key = $(this).find('.editItemPrompt').val().trim();
            val = $(this).find('.editItemAnswer').val().trim();

            if ((key !== "") && (val !== "")) {
                dict[key] = val;
            }
        });

        app.deck.dictionary = dict;
        app.handleDeckChange({'skipItems': true});
    }

    static editRawField = () => {
        let raw = $('#editRaw').val().trim();
        let parsed = Parser.parseTXT(raw);

        app.deck.dictionary = parsed.dictionary;
        app.handleDeckChange({'skipRaw': true});
    }

    static clearAllFields = () => {
        Editor.clearMetaFields();
        Editor.clearItems();
        Editor.clearRaw();
    }

    static clearMetaFields = () => {
        $('#editTitle').val("");
        $('#editSourceName').val("");
        $('#editSourceURL').val("");
        $('#editLanguagePrompts').val("--");
        $('#editLanguageAnswers').val("--");
        Editor.editMetaField();
        Editor.editLanguageField();
    }

    static clearItems = () => {
        $('.editItemContent').each(function () {
            this.remove();
        });
        Editor.editItemField();
    }

    static clearRaw = () => {
        $('#editRaw').val("");
        Editor.editRawField();
    }

    static addItem = () => {
        let list = $('#editItemsList');

        let highest = 0;
        let current;
        $('.editItemContent').each(function () {
            current = parseInt(this.id.split('-')[1]);
            if (current >= highest) {
                highest = current + 1;
            }
        });

        let item = Editor.formatItem(highest, "", "");

        $('#editItem-Add').remove();
        list.append(item);

        $('.editItemInput').unbind();
        $('.editItemInput').keyup(Editor.editItemField);
        $('.editItemInput').change(Editor.editItemField);

        list.append(Editor.formatAddItemButton());
        $('#btnEditAddItem').click(Editor.addItem);
        $('.btnEditDeleteItem').unbind();
        $('.btnEditDeleteItem').click(e => {
            Editor.deleteItem(e);
        });

        View.updateControls();
    }

    static deleteItem = (e) => {
        let i = $(e.target).attr('data-item-index');
        $(`#editItem-${i}`).remove();
        Editor.editItemField();
    }

    static populateLanguages = () => {
        $('#editLanguagePrompts').val(app.deck.languagePrompts);
        $('#editLanguageAnswers').val(app.deck.languageAnswers);
        View.updateLanguageOptionDisplay();
        updateVoiceOptions($('#optLanguagePrompts'), $('#optVoicePrompts'), app.deck.languagePrompts);
        updateVoiceOptions($('#optLanguageAnswers'), $('#optVoiceAnswers'), app.deck.languageAnswers);
    }

    static editLanguagePromptsField = () => {
        let newL = $('#editLanguagePrompts').val();

        // If lang didn't change, return
        if (newL === app.deck.languagePrompts) {
            return;
        }

        app.deck.languagePrompts = newL;
        updateVoiceOptions($('#optLanguagePrompts'), $('#optVoicePrompts'), newL);
        Editor.editLanguageField();
    }

    static editLanguageAnswersField = () => {
        let newL = $('#editLanguageAnswers').val();

        // If lang didn't change, return
        if (newL === app.deck.languageAnswers) {
            return;
        }

        app.deck.languageAnswers = newL;
        updateVoiceOptions($('#optLanguageAnswers'), $('#optVoiceAnswers'), newL);
        Editor.editLanguageField();
    }

    static editLanguageField = () => {
        View.updateLanguageOptionDisplay();
        Editor.editMetaField();
    }
}

class View {
    static toggleVisibility = (element, visible) => {
        if (visible) {
            element.removeClass("hide");
        } else {
            element.addClass("hide");
        }
    }

    static toggleControl = (control, enable) => {
        control.prop("disabled", !enable);
    };

    static updateControls = () => {
        if (!!app.playthrough) {
            View.toggleControl($("#btnNext"), app.playthrough.canNext());
            View.toggleControl($("#btnPrevious"), app.playthrough.canPrevious());
            View.toggleControl($("#btnReveal"), app.playthrough.canReveal());
            View.toggleControl($("#btnRestart"), app.playthrough.canRestart());
        } else {
            View.toggleControl($("#btnNext"), false);
            View.toggleControl($("#btnPrevious"), false);
            View.toggleControl($("#btnReveal"), false);
            View.toggleControl($("#btnRestart"), false);
        }

        // minor optimization
        let deckHasChanged = app.deckHasChanged();
        let optionsHaveChanged = options.haveChanged();

        let editRawExists = !!$('#editRaw').val().trim();
        let editItemsExist = $('.editItemContent').length > 0;

        let editMetaExists = app.deckHasMeta();
        let editContentExists = app.deckHasContent();

        View.toggleControl($('#btnReset'), deckHasChanged || optionsHaveChanged);
        View.toggleControl($('#btnEditSetDefaults'), deckHasChanged);

        View.toggleControl($('#btnShare'), () => {editContentExists() && lio.shareURLIsValid(); });
        View.toggleControl($('.buttonDownload'), editContentExists);
        View.toggleControl($('#btnEditClearItems'), editRawExists || editItemsExist);
        View.toggleControl($('#btnEditClearMeta'), editMetaExists || editRawExists || editItemsExist);
        View.toggleControl($('#btnEditClearAll'), editContentExists || editMetaExists);

        View.toggleControl($('#btnSetDefaultOptions'), optionsHaveChanged);
    }

    static toggleWordVisibility = (holder, hider, show) => {
        View.toggleVisibility(holder, show);
        View.toggleVisibility(hider, !show);
    };

    static toggleTextPromptVisibility = () => {
        let optionOne = [
            app.playthrough.state === PlaythroughState.AfterNext,
            options.showPrompt.value() === 'showPromptNext'
        ].every(Boolean);

        let optionTwo = [
            app.playthrough.state === PlaythroughState.AfterReveal,
            [
                options.showPrompt.value() === 'showPromptNext',
                options.showPrompt.value() === 'showPromptReveal'
            ].some(Boolean)
        ].every(Boolean);

        View.toggleWordVisibility($("#prompt"), $("#promptHider"), optionOne || optionTwo);
    };

    static toggleTextAnswerVisibility = () => {
        let optionOne = [
            app.playthrough.state === PlaythroughState.AfterNext,
            options.showAnswer.value() === 'showAnswerNext'
        ].every(Boolean);

        let optionTwo = [
            app.playthrough.state === PlaythroughState.AfterReveal,
            [
                options.showAnswer.value() === 'showAnswerNext',
                options.showAnswer.value() === 'showAnswerReveal'
            ].some(Boolean)
        ].every(Boolean);

        View.toggleWordVisibility($("#answer"), $("#answerHider"), optionOne || optionTwo);
    };

    static updateSamplesView = () => {
        let deck = app.getActiveDeck();

        let keys = Object.keys(deck.dictionary);
        let sP = keys[0];
        let sA = deck.dictionary[sP];

        $("#samplePrompt").text(`e.g. "${sP}"`);
        $("#sampleAnswer").text(`e.g. "${sA}"`);
    };

    static updateSourceView = () => {
        let html = "";

        if (app.deck.sourceName || app.deck.sourceURL) {
            html += "Source: ";
        }

        if (!app.deck.sourceURL) {
            html += app.deck.sourceName;
        } else {
            let sourceText = !!app.deck.sourceName ? app.deck.sourceName : "Link";
            html += `<a href="${app.deck.sourceURL}" title="Source">${sourceText}</a>`;
        }

        html = `<div id="source">${html}</div>`;
        $("#sourceContainer").html(html);
    }

    static updateCardView = () => {
        $("#prompt").text(app.playthrough.prompt);
        $("#answer").text(app.playthrough.answer);

        View.toggleTextPromptVisibility();
        View.toggleTextAnswerVisibility();

        $("#infoCount").text(app.playthrough.index + 1);

        let begun = app.playthrough.state !== PlaythroughState.InitializedButNotStarted;
        View.toggleVisibility($("#toBeginPanel"), ! begun);
        View.toggleVisibility($("#begunPanel"), begun);
    }

    static updateCopyrightView = () => {
        $('#copyrightYear').text(new Date().getFullYear());
    }

    static updateShareURLView = () => {
        if (lio.shareURLIsValid()) {
            $("#shareURL").val(lio.updateShareURL());
        } else {
            $('#shareURL').val("[Too much data for URL encoding. Edit data or download instead.]")
        }
    };

    static updateLanguageOptionDisplay = () => {
        if (! ['--', ''].includes(app.deck.languagePrompts)) {
            let lpName = Languages.getLanguageByCode(app.deck.languagePrompts).formatBilingualName();
            $('#deckLanguagePromptsNotice').text(lpName);
        } else {
            $('#deckLanguagePromptsNotice').text("not set");
        }

        if (! ['--', ''].includes(app.deck.languageAnswers)) {
            let laName = Languages.getLanguageByCode(app.deck.languageAnswers).formatBilingualName();
            $('#deckLanguageAnswersNotice').text(laName);
        } else {
            $('#deckLanguageAnswersNotice').text("not set");
        }
    }
}

const compileSaveData = () => {
    let data = {};

    data.dictionary = app.deck.dictionary;

    if (app.deck.title && (app.deck.title !== app.deck.sourceName)) {
        data.title = app.deck.title;
    }

    if (app.deck.sourceName) {
        data.sourceName = app.deck.sourceName;
    }

    if (app.deck.sourceURL) {
        data.sourceURL = app.deck.sourceURL;
    }

    if (!["", "--"].includes(app.deck.languagePrompts)) {
        data.languagePrompts = app.deck.languagePrompts;
    }

    if (!["", "--"].includes(app.deck.languageAnswers)) {
        data.languageAnswers = app.deck.languageAnswers;
    }

    return data;
};

/* Link IO */

const packLinkData = () => {
    let data = compileSaveData();

    // compress the dict (the only component that seems to benefit)
    data.dictionary = lio.compress(JSON.stringify(data.dictionary));

    // shorten the URL by removing the protocol. It will be assumed to be https lol
    if ("sourceURL" in data) {
        let url = data.sourceURL;
        if (url.includes("://")) {
            url = url.split("://")[1];
        }
        data.sourceURL = url;
    }

    JSTools.renameObjectKeys(data, {
        dictionary: "d",
        title: "t",
        sourceName: "s",
        sourceURL: "u",
        languagePrompts: "lp",
        languageAnswers: "la"
    });

    return data;
}

const unpackLinkData = (data) => {
    JSTools.renameObjectKeys(data, {
        d: "dictionary",
        t: "title",
        s: "sourceName",
        u: "sourceURL",
        lp: "languagePrompts",
        la: "languageAnswers"
    });

    // Cannot proceed without dictionary
    if (!data.dictionary) {
        return;
    } else {
        data.dictionary = JSON.parse(lio.decompress(data.dictionary));
    }

    Receiver.handleIncomingData(data);
}

const copyShareURL = () => {
    copyToast = Copy.toast(copyToast, $("#shareURL").val(), 'Copied share URL!');
};

const updateVoiceOptions = (selectLanguage, selectVoice, language) => {

    // Get lang's closest voiceLang. If none, return (or clear optlang and voice?)
    let closest = Speech.getClosestLanguage(language);
    if (closest === null) {
        return; // TODO clear optlang and voice??
    }

    // If closest voiceLang matches optLang's selection, return
    if (closest === selectLanguage.val()) {
        return;
    }

    // Otherwise, set optlang to closest voicelang, repopulate its voices
    selectLanguage.val(closest);
    Speech.populateVoiceSelectForLanguage(selectVoice, closest); // auto-chooses first one
}

const createLanguageSelectOptions = () => {
    Languages.populateLanguageSelect($('#editLanguagePrompts'), true, false);
    Languages.populateLanguageSelect($('#editLanguageAnswers'), true, false);
    Speech.populateVoiceLanguageSelect($('#optLanguagePrompts'), false, false);
    Speech.populateVoiceLanguageSelect($('#optLanguageAnswers'), false, false);
}

const handleChangeInvertDictionary = () => {

    let vLP = $("#optLanguagePrompts").val();
    let vVP = $("#optVoicePrompts").val();
    let vRP = options.voicePromptsRate.value();

    let vLA = $("#optLanguageAnswers").val();
    let vVA = $("#optVoiceAnswers").val();
    let vRA = options.voiceAnswersRate.value();

    // TODO
    $("#optLanguagePrompts").val(vLA).change();
    $("#optLanguageAnswers").val(vLP).change();

    updateVoicePromptsOptions();
    updateVoiceAnswersOptions();

    // TODO
    $("#optVoicePrompts").val(vVA).change();
    $("#optVoiceAnswers").val(vVP).change();

    options.voicePromptsRate.value(vRA);
    options.voiceAnswersRate.value(vRP);

    // basics
    View.updateSamplesView();

    app.playthrough.updateCard();
    View.updateCardView();

    app.handleGeneralChange();
};

const addSourceURLProtocol = (sourceURL) => {
    if (!sourceURL) {
        sourceURL = "";
    } else {
        if (!sourceURL.startsWith("http")) {
            sourceURL = "https://" + sourceURL;
        }
    }
    return sourceURL;
}

const createDropzone = () => {
    DropzoneUniversal.create(
        $("#app"),
        Receiver.handleIncomingFile,
        "dropzone",
        "dropzone"
    );
};

/* Binders */

// Bind helpers
// Needed because app.playthrough's definition changes over time so it needs to be decoupled

const next = () => {
    if (stage.active === 'game' && app.playthrough.canNext()) {
        app.playthrough.next();
    }
}

const previous = () => {
    if (stage.active === 'game' &&app.playthrough.canPrevious()) {
        app.playthrough.previous();
    }
}

const reveal = () => {
    if (stage.active === 'game' &&app.playthrough.canReveal()) {
        app.playthrough.reveal();
    }
}

const restart = () => {
    if (stage.active === 'game' &&app.playthrough.canRestart()) {
        app.playthrough.restart();
    }
}

const reset = () => {
    app.reset();
}

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

        case "KeyZ":
            reset();
            break;

        case "KeyU":
            $("#btnUpload").click();
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
            options.setDynamicOptionDefaults();
            break;

        case "Escape":
            stage.show('game');

            if ($("#dropzone").css("display") !== "none") {
                $("#dropzone").css("display", "none");
            }

            break;
    }
};

const bindUploadButton = () => {
    UploadButton.bind(
        $("#btnUpload"),
        Receiver.handleIncomingFile
    );
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
    $("#btnSetDefaultOptions").click(options.setDynamicOptionDefaults);
    $('#optLanguagePrompts').change(() => {
        Speech.populateVoiceSelectForLanguage($('#optVoicePrompts'), $('#optLanguagePrompts').val());
    });
    $('#optLanguageAnswers').change(() => {
        Speech.populateVoiceSelectForLanguage($('#optVoiceAnswers'), $('#optLanguageAnswers').val());
    });
}

const bindEditorControls = () => {
    $('#editTitle').keyup(Editor.editMetaField);
    $('#editSourceName').keyup(Editor.editMetaField);
    $('#editSourceURL').keyup(Editor.editMetaField);
    $('#editTitle').change(Editor.editMetaField);
    $('#editSourceName').change(Editor.editMetaField);
    $('#editSourceURL').change(Editor.editMetaField);

    $('#editLanguagePrompts').change(Editor.editLanguagePromptsField);
    $('#editLanguageAnswers').change(Editor.editLanguageAnswersField);

    $('#editRaw').keyup(Editor.editRawField);
    $('#editRaw').change(Editor.editRawField);

    $('#btnEditClearAll').click(Editor.clearAllFields);
    $('#btnEditClearMeta').click(Editor.clearMetaFields);
    $('#btnEditClearItems').click(Editor.clearItems);
    $('#btnEditClearRaw').click(Editor.clearRaw);
    $('#btnEditSetDefaults').click(app.setDefault);
}

const bind = () => {
    bindGameControls();
    bindShareControls();
    bindOptionsControls();
    bindEditorControls();
    bindUploadButton();
    $(document).keyup(handleKeyup);
};

/* Basics */

const setupStage = () => {
    stage = new Stage();
    stage.createScenes([
        {'name': 'game', 'panelSelector': '#gamePanel'},
        {'name': 'edit', 'panelSelector': '#editPanel', 'toggleSelector': '#btnEdit'},
        {'name': 'options', 'panelSelector': '#optionsPanel', 'toggleSelector': '#btnOptions'},
        {'name': 'help', 'panelSelector': '#helpPanel', 'toggleSelector': '#btnHelp'}
    ]);

    stage.setDefault("game");
    stage.show("game");
};

// Initialize

const initialize = () => {
    Speech.wake();
    View.updateCopyrightView();
    createDropzone();

    setupStage();

    app = new App();

    options = new Options();
    options.initialize();

    bind();
    createLanguageSelectOptions();

    app.setDefault();
    lio.readURL();
};

/* Constants */

const baseURL = "https://g.sawczak.com/flashcarder";
const defaultCSVDelimiter = ",";
const rawDelimiter = ";";

const defaultDeck = Deck.fromData({
    dictionary: {
        chien: "dog",
        bonjour: "hello",
        fille: "girl"
    },
    title: "French Test Deck",
    sourceName: "",
    sourceURL: "",
    languagePrompts: "fr-CA",
    languageAnswers: "en-US"
});

const optDefaultVolume = 100;
const optDefaultShowPrompt = 'showPromptNext';
const optDefaultShowAnswer = 'showAnswerReveal';
const optDefaultSayPrompt = false;
const optDefaultSayAnswer = false;
const optDefaultVoicePromptsRate = 100;
const optDefaultVoiceAnswersRate = 100;
const optDefaultRandomizeOrder = true;
const optDefaultInvertDictionary = false;
const optDefaultSilentParentheses = true;
const optDefaultSilentAlternatives = true;

let copyToast;
let stage;
let options;
let app;
let lio = new LinkIO(
    baseURL,
    packLinkData,
    unpackLinkData,
    () => {
        return !app.deckHasChanged();
    }
);

Speech.wake();
$(document).ready(initialize);
