// hmm hmm
const baseURL = "https://g.sawcak.com/flashcarder";

const maxURLLength = 4000;
const csvDelim = ",";

let optionsChanged = false;
let shareURL = "";
let copyToast = null;

const stage = new _Stage();

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

addScenes();

const defaultLanguagePrompts = "fr-ca";
const defaultLanguageAnswers = "en-us";

const defaultDictionary = {
  chien: "dog",
  bonjour: "hello",
  fille: "girl"
};
const defaultTitle = "French Test Deck";
const defaultSource = "French Test Deck";
const defaultSourceURL = "#";

let dictionary = JSON.parse(JSON.stringify(defaultDictionary));
let title = defaultTitle;
let source = defaultSource;
let sourceURL = defaultSourceURL;
let languagePrompts = defaultLanguagePrompts;
let languageAnswers = defaultLanguageAnswers;

let currentDictionary = {};
let currentDictionaryOrder = [];
let currentDictionaryIndex = 0;

let word = "";
let translation = "";
let denom = 2;

let optVolume = null;
let optTextPromptNext = null;
let optTextPromptReveal = null;
let optTextAnswerNext = null;
let optTextAnswerReveal = null;
let optSayPrompt = null;
let optSayAnswer = null;
let optVoicePromptsRate = null;
let optVoiceAnswersRate = null;
let optRandomizeOrder = null;
let optInvertDictionary = null;
let optSilentParentheses = null;
let optSilentAlternatives = null;

let voiceLanguages = [];

let data = {};
let filename = "";

const speech = window.speechSynthesis;

const restartDictionary = () => {
  currentDictionary = JSON.parse(JSON.stringify(dictionary));
  if (optInvertDictionary.value()) {
    currentDictionary = swapObjectKeys(currentDictionary);
  }

  currentDictionaryOrder = [];
  for (let i = 0; i < Object.keys(currentDictionary).length; i++) {
    currentDictionaryOrder.push(i);
  }

  if (optRandomizeOrder.value()) {
    currentDictionaryOrder = Tools.shuffle(currentDictionaryOrder);
  }

  currentDictionaryIndex = -1;
};

const updateWordShown = () => {
  let i = currentDictionaryOrder[currentDictionaryIndex];

  keys = Object.keys(currentDictionary);
  word = keys[i];
  translation = currentDictionary[word];

  $("#word").html(word);
  $("#translation").html(translation);

  if (optSayPrompt.value()) {
    speech.cancel();
    let voice = $("#optVoicePrompts").val();
    sayUtterance(word, voice, optVoicePromptsRate.value() / 100);
  }

  if (optTextPromptNext.value()) {
    $("#word").removeClass("hide");
    $("#wordHider").addClass("hide");
  } else {
    $("#word").addClass("hide");
    $("#wordHider").removeClass("hide");
  }

  if (optTextAnswerNext.value()) {
    $("#translation").removeClass("hide");
    $("#translationHider").addClass("hide");
  } else {
    $("#translation").addClass("hide");
    $("#translationHider").removeClass("hide");
  }

  $("#infoCount").html(currentDictionaryIndex + 1);
  checkAndToggleControls();
}

const next = () => {
  if (stage.hiding("game") || !canNext()) {
    return;
  }

  currentDictionaryIndex++;
  updateWordShown();

  $("#toBeginPanel").addClass("hide");
};

const previous = () => {
  if (stage.hiding("game") || !canPrevious()) {
    return;
  }

  currentDictionaryIndex--;
  updateWordShown();

  if (currentDictionaryIndex === -1) {
    $("#toBeginPanel").removeClass("hide");
  }
}

const reveal = () => {
  if (stage.hiding("game") || !canReveal()) {
    return;
  }

  if (optTextPromptReveal.value()) {
    $("#word").removeClass("hide");
    $("#wordHider").addClass("hide");
  } else {
    $("#word").addClass("hide");
    $("#wordHider").removeClass("hide");
  }
  if (optTextAnswerReveal.value()) {
    $("#translation").removeClass("hide");
    $("#translationHider").addClass("hide");
  } else {
    $("#translation").addClass("hide");
    $("#translationHider").removeClass("hide");
  }

  if (optSayAnswer.value()) {
    speech.cancel();
    let voice = $("#optVoiceAnswers").val();
    sayUtterance(translation, voice, optVoiceAnswersRate.value() / 100);
  }

  toggleControl($("#btnReveal"), false);
};

const restart = (force = false) => {
  if ((stage.hiding("game") && !force) || !canRestart()) {
    return;
  }

  $("#toBeginPanel").removeClass("hide");

  speech.cancel();

  restartDictionary();
  checkAndToggleControls();

  $("#infoCount").html(0);
  $("#word").html("");
  $("#translation").html("");
};

const canNext = () => {
  return currentDictionaryIndex < (currentDictionaryOrder.length - 1);
};

const canPrevious = () => {
  return currentDictionaryIndex > -1;
}

const canReveal = () => {
  if (optTextPromptNext.value() && optTextAnswerNext.value()) {
    return false;
  } else {
    return (
      $("#translation").hasClass("hide") &&
      (currentDictionaryIndex > -1)
    );
  }
};

const canRestart = () => {
  return canPrevious();
};

const checkAndToggleControls = () => {
  toggleControl($("#btnNext"), canNext());
  toggleControl($("#btnPrevious"), canPrevious());
  toggleControl($("#btnReveal"), canReveal());
  toggleControl($("#btnRestart"), canRestart());
}

const upload = () => {
  $("#btnUpload").click();
};

const receiveUploadedContent = (content, path) => {
  filename = path.split("\\").pop().split("/").pop().toLowerCase();
  data = parseData(content, path);

  if (data.sourceURL === "") {
    data.sourceURL = "#";
  }
  
  else if (!data.sourceURL.startsWith("http")) {
    data.sourceURL = "https://" + data.sourceURL;
  }

  setData(data.dictionary, data.title, data.source, data.sourceURL);
  setLanguageData(data.languagePrompts, data.languageAnswers);
  toggleControl($("#btnReset"), true);
};

const parseData = (content, path) => {
  if (path.endsWith("json")) {
    data = parseJSON(content);
  } else if (path.endsWith("txt")) {
    data = parseTXT(content);
  } else if (path.endsWith("csv")) {
    data = parseCSV(content);
  }
  return data;
};

const parseJSON = (content) => {
  // TODO no validation here...
  return JSON.parse(content);
};

const parseCSV = (content) => {
  return _parseCSVlike(content, csvDelim);
};

const parseTXT = (content) => {
  let delim = detectDelimiter(content);
  return _parseCSVlike(content, delim);
};

const breakPieces = (line, delim) => {
  let re_pieces = `/"(.+?)"${delim}"(.+?)"/`;
  let result = re_pieces.exec(line);
  return [cleanCell(result[1]), cleanCell(result[2])];
};

const _parseCSVlike = (content, delim) => {
  let _dictionary = {};
  let _title = "";
  let _source = "";
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
      pieces = breakPieces(line, delim);
    } else {
      pieces = line.split(delim);
    }

    firstPiece = cleanCell(pieces[0]);
    lastPiece = cleanCell(pieces[pieces.length - 1]);

    firstPieceLower = firstPiece.toLowerCase();
    if (["_title", "_t"].includes(firstPieceLower)) {
      _title = lastPiece;
    } else if (["_source", "_src"].includes(firstPieceLower)) {
      _source = lastPiece;
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
    source: _source,
    sourceURL: _sourceURL,
    delimiter: delim,
    languagePrompts: _languagePrompts,
    languageAnswers: _languageAnswers
  };
};

const cleanCell = (cell) => {
  cell = cell.trim();
  if (cell.startsWith(`"`) && cell.endsWith(`"`)) {
    cell = cell.slice(1, cell.length - 1);
  }

  return cell;
};

const detectDelimiter = (
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

const reset = () => {
  if (!isControlEnabled($("#btnReset"))) {
    return;
  }

  speech.cancel();

  setData(defaultDictionary, defaultTitle, defaultSource, defaultSourceURL);  
  setLanguageData(defaultLanguagePrompts, defaultLanguageAnswers);
  
  toggleControl($("#btnReset"), false);
  // toggleControl($("#btnShare"), false);
};

const handleKeyup = (e) => {
      
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

    // case "KeyC":
    //   copyShareURL();
    //   break;

    case "KeyD":
      setDefaultOptions();
      break;

    case "Escape":
      if (!$("#helpPanel").hasClass("hide")) {
        stage.toggle("help");
      }
      if (!$("#editPanel").hasClass("hide")) {
        stage.toggle("edit");
      }
      if (!$("#optionsPanel").hasClass("hide")) {
        stage.toggle("options");
      }

      if ($("#dropzone").css("display") !== "none") {
        $("#dropzone").css("display", "none");
      }

      break;
  }
};

const toggleControl = (control, enable) => {
  control.prop("wasEnabled", isControlEnabled(control));
  control.prop("disabled", !enable);
};

const isControlEnabled = (control) => {
  return !control.prop("disabled");
};

const setDictionary = (_dictionary) => {
  dictionary = JSON.parse(JSON.stringify(_dictionary));
  restartDictionary();

  denom = currentDictionaryOrder.length;
  $("#infoDenom").text(denom);
};

const setTitle = (_title, _source) => {
  title = !!_title ? _title : !!_source ? _source : "";
  title = !!title ? title : "Unknown Flashcard Deck"; // lol
  $("#title").html(title);
};

const setSource = (_title, _source, _URL) => {
  $("#sourceContainer").html("");

  source = !!_source ? _source : !!_title ? _title : "";
  sourceURL = _URL;

  if (!source && !sourceURL) {
    return;
  }

  let html = "Source: ";
  if (!sourceURL) {
    html += source;
  } else {
    let sourceText = !!source ? source : "Link";
    html += `<a href="${sourceURL}" title="Source">${sourceText}</a>`;
  }

  html = `<div id="source">${html}</div>`;
  $("#sourceContainer").append(html);
};

const displaySamples = () => {
  let keys = Object.keys(currentDictionary);
  let sP = keys[0];
  let sA = currentDictionary[sP];

  $("#samplePrompt").html(`e.g. "${sP}"`);
  $("#sampleAnswer").html(`e.g. "${sA}"`);
};

const setNonRestartData = (_title, _source, _sourceURL) => {
  setTitle(_title, _source);
  setSource(_title, _source, _sourceURL);
  populateShareURL();
}

const setRestartData = (_dictionary, skipEditorItems, skipEditorRaw) => {
  setDictionary(_dictionary);
  populateShareURL();
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
}

const setLanguageData = (_languagePrompts, _languageAnswers) => {  
  languagePrompts = _languagePrompts;
  languageAnswers = _languageAnswers;
  $('#editLanguagePrompts').val(languagePrompts);
  $('#editLanguageAnswers').val(languageAnswers);
  editLanguageField();
}

const setData = (_dictionary, _title, _source, _sourceURL) => {
  setNonRestartData(_title, _source, _sourceURL);
  setRestartData(_dictionary);  
};

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
  
  for (let key of Object.keys(dictionary)) {
    val = dictionary[key];    
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
  $('.btnEditDeleteItem').click(e => {editDeleteItem(e); });
}

const populateEditorRaw = () => {
  let raw = "";
  let val;
  
  for (let key of Object.keys(dictionary)) {
    val = dictionary[key];
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

// lol utility
const renameObjectKeys = (o, remapping) => {
  for (const [oldK, newK] of Object.entries(remapping)) {
    //o[newK] = o[oldK];

    if (oldK in o) {
      Object.defineProperty(o, newK, Object.getOwnPropertyDescriptor(o, oldK));

      delete o[oldK];
    }
  }
};

const swapObjectKeys = (o) => {
  return Object.keys(o).reduce((o2, key) => {
    o2[o[key]] = key;
    return o2;
  }, {});
};

const compileSaveData = () => {
  let _data = {};

  _data["dictionary"] = JSON.parse(JSON.stringify(dictionary));

  if (title && title !== source) {
    _data["title"] = title;
  }

  if (source) {
    _data["source"] = source;
  }

  if (sourceURL) {
    _data["sourceURL"] = sourceURL;
  }

  if (
    $("#optLanguagePrompts").val() &&
    $("#optLanguagePrompts").val() !== "--" &&
    $("#optLanguagePrompts").val() !== defaultLanguagePrompts
  ) {
    _data["languagePrompts"] = $("#optLanguagePrompts").val();
  }

  if (
    $("#optLanguageAnswers").val() &&
    $("#optLanguageAnswers").val() !== "--" &&
    $("#optLanguageAnswers").val() !== defaultLanguageAnswers
  ) {
    _data["languageAnswers"] = $("#optLanguageAnswers").val();
  }

  return _data;
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

  renameObjectKeys(_data, {
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

  let val = $("#shareURL").val();
  Copy.writeToClipboard(val);
  // Copy.ping($("#copyPingNotification"));
  
  if (copyToast !== null) {
    copyToast.reset();  
  }  
  
  copyToast = $.toast({
    text: 'Copied!',
    icon: 'success',
    hideAfter: 2000,
    showHideTransition: 'slide',
    position: 'bottom-center',
    loaderBg: '#ffffff'
})
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
    
    if (! (key in keys)) {
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
  let _lp = getClosestVoiceLanguage(languagePrompts);
  let _la = getClosestVoiceLanguage(languageAnswers);
  
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
  if (show) {
    holder.removeClass("hide");
    hider.addClass("hide");
  } else {
    holder.addClass("hide");
    hider.removeClass("hide");
  }
};

const toggleTextHolder = (holder, hider) => {
  // If Reveal is enabled, it means we're showing Next
  if (isControlEnabled($("#btnReveal"))) {
    if (optTextPromptNext.value()) {
      toggleWord(holder, hider, true);
    } else {
      toggleWord(holder, hider, false);
    }

    // Otherwise we're showing Reveal
  } else {
    if (optTextPromptReveal.value()) {
      toggleWord(holder, hider, true);
    } else {
      toggleWord(holder, hider, false);
    }
  }
};

const toggleTextPrompt = () => {
  toggleTextHolder($("#word"), $("#wordHider"));
};

const toggleTextAnswer = () => {
  toggleTextHolder($("#translation"), $("#translationHider"));
};

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

const createDynamicOptions = () => {
  optVolume = new OptionSlider($("#optVolume"));
  optVolume.min(0);
  optVolume.max(100);
  optVolume.step(5);

  optVoicePromptsRate = new OptionSlider($("#optVoicePromptsRate"));
  optVoicePromptsRate.min(25);
  optVoicePromptsRate.max(200);
  optVoicePromptsRate.step(5);

  optVoiceAnswersRate = new OptionSlider($("#optVoiceAnswersRate"));
  optVoiceAnswersRate.min(25);
  optVoiceAnswersRate.max(200);
  optVoiceAnswersRate.step(5);

  optTextPromptNext = new OptionCheckbox($("#optTextPromptNext"));
  optTextAnswerNext = new OptionCheckbox($("#optTextAnswerNext"));
  optTextPromptReveal = new OptionCheckbox($("#optTextPromptReveal"));
  optTextAnswerReveal = new OptionCheckbox($("#optTextAnswerReveal"));
  optSayPrompt = new OptionCheckbox($("#optSayPrompt"));
  optSayAnswer = new OptionCheckbox($("#optSayAnswer"));
  optRandomizeOrder = new OptionCheckbox($("#optRandomizeOrder"));
  optInvertDictionary = new OptionCheckbox($("#optInvertDictionary"));
  optSilentParentheses = new OptionCheckbox($("#optSilentParentheses"));
  optSilentAlternatives = new OptionCheckbox($("#optSilentAlternatives"));
};

const invertDictionary = () => {

  // results of swapping options feel unexpected
  
//   let oNP = optTextPromptNext.value();
//   let oRP = optTextPromptReveal.value();
//   let oSP = optSayPrompt.value();

//   let oNA = optTextAnswerNext.value();
//   let oRA = optTextAnswerReveal.value();
//   let oSA = optSayAnswer.value();

//   optTextPromptNext.value(oNA);
//   optTextPromptReveal.value(oRA);
//   optSayPrompt.value(oSA);

//   optTextAnswerNext.value(oNP);
//   optTextAnswerReveal.value(oRP);
//   optSayAnswer.value(oSP);
  
  // but must swap language/voice

  let vLP = $("#optLanguagePrompts").val();
  let vVP = $("#optVoicePrompts").val();
  let vRP = optVoicePromptsRate.value();

  let vLA = $("#optLanguageAnswers").val();
  let vVA = $("#optVoiceAnswers").val();
  let vRA = optVoiceAnswersRate.value();

  $("#optLanguagePrompts").val(vLA).change();
  $("#optLanguageAnswers").val(vLP).change();

  updateVoicePromptsOptions();
  updateVoiceAnswersOptions();

  $("#optVoicePrompts").val(vVA).change();
  $("#optVoiceAnswers").val(vVP).change();

  optVoicePromptsRate.value(vRA);
  optVoiceAnswersRate.value(vRP);
  
  // basics
  
  changeOptionAndRestart();
  displaySamples();
};

const changeOption = () => {
  optionsChanged = true;
  toggleControl($("#btnSetDefaultOptions"), true);
};

const changeOptionAndRestart = () => {
  changeOption();
  restart(true);
};

const editMetaField = () => {
  
  let _source = $('#editSource').val().trim();
  let _title = $('#editTitle').val().trim();
  let _sourceURL = $('#editURL').val().trim();
  
  if (_sourceURL === "") {
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
  $('.editItemContent').each(function() {
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
  $('.editItemContent').each(function() {
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
  $('.btnEditDeleteItem').click(e => {editDeleteItem(e); });
}

const editDeleteItem = (e) => {
  let i = e.target.id.split('-')[1];
  let id = `#editItem-${i}`;
  $(id).remove();
  
  editItemField();
}

const setDefaultOptions = () => {
  // if (! optionsChanged) { return; }
  optionsChanged = false;

  optVolume.value(100);
  optVoicePromptsRate.value(100);
  optVoiceAnswersRate.value(100);

  optTextPromptNext.value(true);
  optTextPromptReveal.value(true);
  optTextAnswerNext.value(false);
  optTextAnswerReveal.value(true);
  optSayPrompt.value(false);
  optSayAnswer.value(false);
  optRandomizeOrder.value(true);
  optInvertDictionary.value(false);
  optSilentParentheses.value(true);
  optSilentAlternatives.value(true);

  toggleControl($("#btnSetDefaultOptions"), false);
};

const formatFilename = (data, ext) => {
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

const chooseDelimiter = (data) => {
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

const downloadFile = (content, name, type) => {
  const blob = new Blob([content], { type: type });
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

const prepareAndDownloadFile = (formatter, ext, type) => {
  let data = compileSaveData();
  let content = formatter(data);
  downloadFile(content, formatFilename(data, ext), type);
};

const downloadJSON = () => {
  prepareAndDownloadFile(JSON.stringify, "json", "application/json");
};

const downloadCSV = () => {
  prepareAndDownloadFile(formatCSV, "csv", "text/csv");
};

const downloadTXT = () => {
  prepareAndDownloadFile(formatTXT, "txt", "text/plain");
};

const formatDataRow = (data, key, delim, wrap = false) => {
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

const formatDictRow = (p, a, delim, wrap = false) => {
  if (wrap) {
    p = `"${p}"`;
    a = `"${a}"`;
  }
  return `${p}${delim}${a}\n`;
};

const formatCSV = (data) => {
  // start with utf-8 BOM
  let csv = "\ufeff";

  for (let k of [
    "title",
    "source",
    "sourceURL",
    "languagePrompts",
    "languageAnswers"
  ]) {
    csv += formatDataRow(data, k, csvDelim, true);
  }

  for (const [p, a] of Object.entries(data["dictionary"])) {
    csv += formatDictRow(p, a, csvDelim, true);
  }

  return csv;
};

const formatTXT = (data) => {
  let txt = "";
  let delim = chooseDelimiter(data);

  for (let k of [
    "title",
    "source",
    "sourceURL",
    "languagePrompts",
    "languageAnswers"
  ]) {
    txt += formatDataRow(data, k, delim);
  }

  txt += "\n";

  for (const [p, a] of Object.entries(data["dictionary"])) {
    txt += formatDictRow(p, a, delim);
  }

  return txt;
};

const bind = () => {
  $("#btnNext").click(next);
  $("#btnPrevious").click(previous);
  $("#btnReveal").click(reveal);
  $("#btnRestart").click(restart);
  $("#btnReset").click(reset);
  $("#btnCopyShareURL").click(copyShareURL);

  $("#btnDownloadJSON").click(downloadJSON);
  $("#btnDownloadCSV").click(downloadCSV);
  $("#btnDownloadTXT").click(downloadTXT);
  $("#btnSetDefaultOptions").click(setDefaultOptions);

  $("#optLanguagePrompts").change(updateVoicePromptsOptions);
  $("#optLanguageAnswers").change(updateVoiceAnswersOptions);

  $("#optTextPromptNext").change(toggleTextPrompt);
  $("#optTextPromptReveal").change(toggleTextPrompt);
  $("#optTextAnswerNext").change(toggleTextAnswer);
  $("#optTextAnswerReveal").change(toggleTextAnswer);

  $("#optionsPanel input").change(changeOption);
  $("#optionsPanel select").change(changeOption);
  optVoiceAnswersRate.change(changeOption);
  optVoicePromptsRate.change(changeOption);

  $("#optRandomizeOrder").change(changeOptionAndRestart);
  $("#optInvertDictionary").change(invertDictionary);
  $("#optSilentParentheses").change(changeOption);
  $("#optSilentAlternatives").change(changeOption);
  
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
  // $('#btnEditClearItems').click(editClearItems);
  $('#btnEditClearRaw').click(editClearRaw);
  $('#btnEditSetDefaults').click(reset);

  $(document).keyup(handleKeyup);

  speechSynthesis.onvoiceschanged = updateVoiceOptions;
};

const updateCopyright = () => {
  $('#copyrightYear').text(new Date().getFullYear());
}

const initialize = () => {
  updateCopyright();

  createDynamicOptions();

  createUploadButton();
  createDropzone();

  bind();

  updateVoiceOptions();
  setDefaultOptions();

  stage.show("game");
  
  // TODO working on
    // stage.show("edit");

  reset();
  readDataFromURL();
};

$(document).ready(initialize);