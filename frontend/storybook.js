
/* =========================================================
   PEERVA STORYBOOK — On-site Books, Novels, Manga & Comics
   Replace the entire existing storybook.js with this file.
   Existing HTML controls are reused where available.
   ========================================================= */

(function () {
  "use strict";

  var SAVE_KEY = "chathub-saved-stories";
  var PROGRESS_KEY = "peerva-story-progress-v2";
  var SETTINGS_KEY = "peerva-reader-settings";

  var ITEMS = [];
  var SEARCH_RESULTS = [];
  var GUTENBERG_PAGE = 1;
  var GUTENBERG_LOADING = false;
  var GUTENBERG_DONE = false;
  var GUTENBERG_TARGET = 1000;
  var SEARCH_ID = 0;
  var activeType = "All";
  var activeAudience = "All";
  var activeGenre = "All";
  var onlySaved = false;
  var readerOverlay = null;
  var readerItem = null;
  var readerChapterIndex = 0;
  var currentSearch = "";
  var saved = readJSON(SAVE_KEY, []);
  var progress = readJSON(PROGRESS_KEY, {});
  var readerSettings = readJSON(SETTINGS_KEY, {
    fontSize: 19,
    theme: "light",
    lineHeight: 1.85
  });

  var COLORS = [
    "#805A46", "#526B65", "#78628D", "#B36C52",
    "#52698B", "#9B7A45", "#526C82", "#8A5C68"
  ];

  var LICENSED_STORIES = [];
  var LICENSED_MANGA = [];

  function readJSON(key, fallback) {
    try {
      var value = JSON.parse(localStorage.getItem(key));
      return value == null ? fallback : value;
    } catch (error) {
      return fallback;
    }
  }

  function saveJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn("Peerva could not save browser data.", error);
    }
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) {
      node.textContent = String(text);
    }
    return node;
  }

  function findElement(ids) {
    for (var i = 0; i < ids.length; i++) {
      var found = document.getElementById(ids[i]);
      if (found) return found;
    }
    return null;
  }

  var grid = findElement(["stories", "story-grid", "story-list"]);
  var search = findElement(["story-search", "search"]);
  var tabBox = findElement(["tabs", "story-tabs"]);
  var audienceBox = findElement(["audience-chips", "audience-filters"]);
  var genreBox = findElement(["chips", "genre-chips", "genre-filters"]);
  var savedBtn = findElement(["saved-toggle", "show-saved"]);

  if (!grid) {
    console.error("Peerva Storybook: cannot find the story grid.");
    return;
  }

  if (!search) {
    search = el("input");
    search.type = "search";
    search.placeholder = "Search books, authors and manga...";
    search.setAttribute("aria-label", "Search the Peerva library");
    search.style.cssText =
      "width:100%;max-width:680px;display:block;margin:16px auto;padding:13px;border-radius:12px;border:1px solid #ccc;box-sizing:border-box;";
    grid.parentNode.insertBefore(search, grid);
  }

  injectLibraryStyles();

  /* -------------------- Library controls -------------------- */

  function makeButtons(box, values, current, callback, className) {
    if (!box) return;
    box.innerHTML = "";

    values.forEach(function (value) {
      var button = el("button", className || "", value);
      button.type = "button";
      button.setAttribute("aria-pressed", value === current ? "true" : "false");
      button.addEventListener("click", function () {
        callback(value);
      });
      box.appendChild(button);
    });
  }

  function buildControls() {
    makeButtons(tabBox, ["All", "Story", "Manga"], activeType, function (value) {
      activeType = value;
      activeGenre = "All";
      buildControls();
      render();
    }, "tab");

    if (tabBox) {
      var labels = ["All", "Books & Stories", "Manga & Comics"];
      Array.prototype.forEach.call(tabBox.children, function (button, index) {
        button.textContent = labels[index] || button.textContent;
      });
    }

    makeButtons(audienceBox, ["All", "Teens", "Adults"], activeAudience, function (value) {
      activeAudience = value;
      buildControls();
      render();
    }, "chip");

    var genres = ["All"];
    allItems().forEach(function (item) {
      if (
        (activeType === "All" || item.type === activeType) &&
        genres.indexOf(item.genre) === -1
      ) {
        genres.push(item.genre);
      }
    });

    makeButtons(genreBox, genres, activeGenre, function (value) {
      activeGenre = value;
      buildControls();
      render();
    }, "chip");
  }

  function allItems() {
    var result = ITEMS.slice();

    SEARCH_RESULTS.forEach(function (item) {
      if (!result.some(function (existing) { return existing.id === item.id; })) {
        result.push(item);
      }
    });

    return result;
  }

  function matchesAudience(item) {
    if (activeAudience === "All") return true;
    if (activeAudience === "Teens") {
      return item.audience === "Teens" || item.audience === "Teens & Adults";
    }
    return item.audience === "Adults" || item.audience === "Teens & Adults";
  }

  function heartIcon() {
    var span = el("span");
    span.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/></svg>';
    return span.firstChild;
  }

  /* -------------------- Book cards -------------------- */

  function makeCard(item, index) {
    var card = el("article", "story peerva-book-card");
    var cover = el("div", "cover peerva-book-cover");

    if (item.cover) {
      cover.style.backgroundImage = "url(" + JSON.stringify(item.cover) + ")";
    } else {
      cover.classList.add("no-image");
      cover.style.backgroundColor = COLORS[index % COLORS.length];

      var coverText = el("div", "cover-text");
      coverText.appendChild(el("span", "cover-title", item.title));
      cover.appendChild(coverText);
    }

    var heart = el("button", "heart");
    heart.type = "button";
    heart.setAttribute("aria-label", "Save " + item.title);
    heart.setAttribute("aria-pressed", saved.indexOf(item.id) >= 0 ? "true" : "false");
    heart.appendChild(heartIcon());
    heart.addEventListener("click", function () {
      var position = saved.indexOf(item.id);
      if (position < 0) saved.push(item.id);
      else saved.splice(position, 1);
      saveJSON(SAVE_KEY, saved);
      render();
    });
    cover.appendChild(heart);

    var body = el("div", "story-body");
    body.appendChild(el("div", "story-meta", (item.author || "Unknown author") + " · " + item.genre));

    var badges = el("div", "badges");
    badges.appendChild(el("span", "badge", item.type === "Manga" ? "Manga & Comics" : "Book"));
    badges.appendChild(el("span", "badge plain", item.lang || "English"));

    if (item.provider === "internetarchive") {
      badges.appendChild(el("span", "badge plain", "Internet Archive"));
    } else if (item.provider === "gutendex") {
      badges.appendChild(el("span", "badge plain", "Public-domain candidate"));
    } else if (item.rights) {
      badges.appendChild(el("span", "badge plain", item.rights));
    }

    body.appendChild(badges);
    body.appendChild(el("p", "story-summary", item.summary || "Open this title to see its available reading format."));
    body.appendChild(el("span", "story-source", "Source: " + (item.source || "Peerva library")));

    var read = el("button", "read-btn", "Read on Peerva");
    read.type = "button";
    read.addEventListener("click", function () {
      openReader(item);
    });
    body.appendChild(read);

    card.appendChild(cover);
    card.appendChild(body);
    return card;
  }

  function render() {
    var query = (search.value || "").trim().toLowerCase();
    var list = allItems().filter(function (item) {
      var text = [
        item.title, item.author, item.genre, item.summary,
        item.titleKo, item.source
      ].join(" ").toLowerCase();

      return (
        (activeType === "All" || item.type === activeType) &&
        (activeGenre === "All" || item.genre === activeGenre) &&
        (!query || text.indexOf(query) >= 0) &&
        (!onlySaved || saved.indexOf(item.id) >= 0) &&
        matchesAudience(item)
      );
    });

    grid.innerHTML = "";

    if (!list.length) {
      grid.appendChild(el(
        "p",
        "empty",
        onlySaved
          ? "No saved books match these filters yet."
          : query
            ? "No matching books yet. Peerva is searching the online catalogues as you type."
            : "Books will appear here as the catalogue loads."
      ));
      return;
    }

    list.forEach(function (item, index) {
      grid.appendChild(makeCard(item, index));
    });
  }

  search.addEventListener("input", debounce(function () {
    currentSearch = search.value.trim();
    render();
    searchOnline(currentSearch);
  }, 450));

  if (savedBtn) {
    savedBtn.addEventListener("click", function () {
      onlySaved = !onlySaved;
      savedBtn.setAttribute("aria-pressed", onlySaved ? "true" : "false");
      render();
    });
  }

  function debounce(callback, delay) {
    var timer;
    return function () {
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () {
        callback.apply(null, args);
      }, delay);
    };
  }

  /* -------------------- Online book discovery --------------------
     Internet Archive Advanced Search returns catalogue metadata.
     Gutendex supplies English public-domain candidate metadata.
     Search results are not automatically proof of redistribution rights.
  ---------------------------------------------------------------- */

  function genreFromText(value) {
    var text = String(value || "").toLowerCase();
    if (/fantasy|magic|fairy|myth/.test(text)) return "Fantasy";
    if (/romance|love story|marriage/.test(text)) return "Romance";
    if (/mystery|detective|crime|suspense/.test(text)) return "Mystery";
    if (/horror|ghost|gothic/.test(text)) return "Horror";
    if (/science fiction|sci-fi|space/.test(text)) return "Science Fiction";
    if (/adventure|journey|travel/.test(text)) return "Adventure";
    if (/manga|comic|graphic novel/.test(text)) return "Manga & Comics";
    return "Classics";
  }

  function isMangaTitle(title, subjects) {
    return /manga|comic|graphic novel|comic book/i.test(
      String(title || "") + " " + String(subjects || "")
    );
  }

  function addSearchResults(items) {
    items.forEach(function (item) {
      if (!item || !item.id) return;
      if (!ITEMS.some(function (x) { return x.id === item.id; }) &&
          !SEARCH_RESULTS.some(function (x) { return x.id === item.id; })) {
        SEARCH_RESULTS.push(item);
      }
    });
    buildControls();
    render();
  }

  function searchOnline(query) {
    var requestId = ++SEARCH_ID;
    SEARCH_RESULTS = [];

    if (!query || query.length < 2) {
      render();
      return;
    }

    grid.innerHTML = "";
    grid.appendChild(el("p", "empty", "Searching Peerva, Internet Archive and English book catalogues…"));

    Promise.allSettled([
      searchInternetArchive(query),
      searchGutenberg(query)
    ]).then(function (results) {
      if (requestId !== SEARCH_ID) return;

      results.forEach(function (result) {
        if (result.status === "fulfilled") addSearchResults(result.value);
      });

      if (!SEARCH_RESULTS.length) {
        grid.innerHTML = "";
        grid.appendChild(el("p", "empty", "No results found. Try another title or author."));
      }
    });
  }

  function searchInternetArchive(query) {
    var url = new URL("https://archive.org/advancedsearch.php");
    url.searchParams.set("q", 'title:("' + query.replace(/["\\]/g, " ") + '") AND mediatype:texts AND language:eng');
    url.searchParams.append("fl[]", "identifier");
    url.searchParams.append("fl[]", "title");
    url.searchParams.append("fl[]", "creator");
    url.searchParams.append("fl[]", "description");
    url.searchParams.append("fl[]", "subject");
    url.searchParams.append("fl[]", "year");
    url.searchParams.append("fl[]", "language");
    url.searchParams.set("rows", "30");
    url.searchParams.set("page", "1");
    url.searchParams.set("output", "json");

    return fetch(url.toString())
      .then(function (response) {
        if (!response.ok) throw new Error("Internet Archive search failed");
        return response.json();
      })
      .then(function (data) {
        return ((data.response && data.response.docs) || []).map(function (book) {
          var title = book.title || "Untitled book";
          var subjectText = Array.isArray(book.subject) ? book.subject.join(", ") : (book.subject || "");
          var description = Array.isArray(book.description) ? book.description.join(" ") : (book.description || "");

          return {
            id: "ia-" + book.identifier,
            provider: "internetarchive",
            archiveId: book.identifier,
            title: title,
            author: Array.isArray(book.creator) ? book.creator.join(", ") : (book.creator || "Unknown author"),
            type: isMangaTitle(title, subjectText) ? "Manga" : "Story",
            genre: genreFromText(title + " " + subjectText + " " + description),
            audience: "Teens & Adults",
            lang: "English",
            rights: "Check item access and rights",
            summary: String(description).replace(/<[^>]*>/g, "").slice(0, 350) ||
              "Book record found in Internet Archive. Available formats depend on this item's access and files.",
            source: "Internet Archive",
            cover: "https://archive.org/services/img/" + encodeURIComponent(book.identifier),
            chapters: []
          };
        });
      });
  }

  function searchGutenberg(query) {
    var url = "https://gutendex.com/books/?search=" + encodeURIComponent(query) + "&languages=en";
    return fetch(url)
      .then(function (response) {
        if (!response.ok) throw new Error("English book search failed");
        return response.json();
      })
      .then(function (data) {
        return (data.results || []).map(normalizeGutenbergBook).filter(Boolean);
      });
  }

  function normalizeGutenbergBook(book) {
    var formats = book.formats || {};
    var textUrl =
      formats["text/plain; charset=utf-8"] ||
      formats["text/plain"] ||
      formats["text/plain; charset=us-ascii"];

    var author = (book.authors || []).map(function (a) {
      return a.name;
    }).filter(Boolean).join(", ") || "Unknown author";

    return {
      id: "gutenberg-" + book.id,
      provider: "gutendex",
      gutenbergId: book.id,
      type: "Story",
      title: book.title || "Untitled book",
      author: author,
      genre: genreFromText((book.subjects || []).join(" ")),
      audience: "Teens & Adults",
      lang: "English",
      rights: "Public-domain candidate — verify rights",
      summary: "English-language book. Its full text can be loaded into Peerva's reader when the text file is accessible.",
      source: "Project Gutenberg catalogue",
      cover: formats["image/jpeg"] || "",
      downloadUrl: textUrl || "",
      chapters: [{ title: "Full book", body: "" }]
    };
  }

  /* -------------------- Reader design -------------------- */

  function injectLibraryStyles() {
    if (document.getElementById("peerva-reader-styles")) return;

    var style = el("style");
    style.id = "peerva-reader-styles";
    style.textContent = `
      .peerva-reader-overlay {
        position:fixed; inset:0; z-index:999999;
        background:rgba(15,15,18,.78); display:flex;
        justify-content:center; align-items:stretch;
      }
      .peerva-reader-panel {
        --reader-bg:#fffaf2; --reader-text:#28251f; --reader-muted:#777064;
        --reader-accent:#a46d3b;
        background:var(--reader-bg); color:var(--reader-text);
        width:100%; max-width:1000px; height:100%;
        overflow-y:auto; box-sizing:border-box; position:relative;
        padding:0 clamp(16px,4vw,52px) 44px;
      }
      .peerva-reader-panel[data-theme="dark"] {
        --reader-bg:#171817; --reader-text:#eeeeea; --reader-muted:#aaa99f;
        --reader-accent:#d8ad79;
      }
      .peerva-reader-panel[data-theme="sepia"] {
        --reader-bg:#f2e4ca; --reader-text:#463727; --reader-muted:#7d6b56;
        --reader-accent:#93683d;
      }
      .peerva-reader-top {
        position:sticky; top:0; z-index:5; display:flex;
        align-items:center; justify-content:space-between; gap:10px;
        padding:12px 0; background:var(--reader-bg);
        border-bottom:1px solid rgba(120,110,90,.22);
      }
      .peerva-reader-top button, .peerva-reader-toolbar button,
      .peerva-reader-controls button, .peerva-reader-select {
        color:var(--reader-text); background:transparent;
        border:1px solid rgba(120,110,90,.35); border-radius:11px;
        padding:9px 12px; cursor:pointer; font:inherit;
      }
      .peerva-reader-top button:hover, .peerva-reader-toolbar button:hover,
      .peerva-reader-controls button:hover { border-color:var(--reader-accent); }
      .peerva-reader-heading { max-width:760px; margin:28px auto 24px; }
      .peerva-reader-kicker {
        font-size:11px; letter-spacing:.14em; text-transform:uppercase;
        color:var(--reader-muted); font-weight:700;
      }
      .peerva-reader-title {
        font-size:clamp(26px,4vw,42px); line-height:1.16;
        letter-spacing:-.025em; margin:10px 0;
      }
      .peerva-reader-subtitle { color:var(--reader-muted); margin:0; }
      .peerva-reader-toolbar {
        display:flex; flex-wrap:wrap; align-items:center; gap:8px;
        padding:12px 0; margin:0 auto 24px; max-width:760px;
        border-top:1px solid rgba(120,110,90,.22);
        border-bottom:1px solid rgba(120,110,90,.22);
      }
      .peerva-reader-toolbar .peerva-reader-spacer { flex:1; }
      .peerva-reader-content {
        max-width:690px; margin:0 auto;
        font-family:Georgia,"Times New Roman",serif;
        line-height:1.85; overflow-wrap:anywhere;
      }
      .peerva-reader-content p { margin:0 0 1.35em; }
      .peerva-reader-progress {
        height:3px; background:rgba(120,110,90,.18);
        position:sticky; top:55px; z-index:4;
      }
      .peerva-reader-progress span {
        display:block; height:100%; width:0; background:var(--reader-accent);
      }
      .peerva-reader-controls {
        max-width:690px; margin:34px auto 0; padding-top:20px;
        border-top:1px solid rgba(120,110,90,.22);
        display:flex; align-items:center; justify-content:space-between; gap:10px;
      }
      .peerva-reader-controls button:disabled { opacity:.35; cursor:not-allowed; }
      .peerva-reader-note {
        max-width:690px; margin:18px auto; color:var(--reader-muted);
        font-size:13px; line-height:1.6;
      }
      .peerva-reader-frame {
        width:100%; height:calc(100vh - 220px); min-height:420px;
        border:0; border-radius:8px; background:white;
      }
      .peerva-manga-pages {
        max-width:850px; margin:0 auto; display:flex;
        flex-direction:column; align-items:center; gap:0;
      }
      .peerva-manga-pages img {
        display:block; max-width:100%; width:auto; height:auto;
        object-fit:contain; margin:0 auto;
      }
      .peerva-reader-error {
        border:1px solid rgba(180,80,60,.4); padding:16px;
        border-radius:12px; line-height:1.6;
      }
      @media(max-width:600px) {
        .peerva-reader-panel { padding:0 16px 28px; }
        .peerva-reader-top { padding:10px 0; }
        .peerva-reader-heading { margin:22px auto; }
        .peerva-reader-toolbar { gap:6px; }
        .peerva-reader-toolbar button { padding:8px 10px; }
        .peerva-reader-content { line-height:1.8; }
        .peerva-reader-frame { height:70vh; min-height:360px; }
      }
    `;
    document.head.appendChild(style);
  }

  function closeReader() {
    if (readerOverlay && readerOverlay.parentNode) {
      readerOverlay.parentNode.removeChild(readerOverlay);
    }
    readerOverlay = null;
    readerItem = null;
    document.body.style.overflow = "";
  }

  function readerButton(label, callback, title) {
    var button = el("button", "", label);
    button.type = "button";
    if (title) button.title = title;
    button.addEventListener("click", callback);
    return button;
  }

  function openReader(item, chapterIndex) {
    readerItem = item;
    readerChapterIndex = typeof chapterIndex === "number"
      ? chapterIndex
      : (progress[item.id] || 0);

    if (readerOverlay) closeReader();

    readerOverlay = el("div", "peerva-reader-overlay");
    readerOverlay.setAttribute("role", "dialog");
    readerOverlay.setAttribute("aria-modal", "true");
    readerOverlay.setAttribute("aria-label", "Peerva reading view");

    var panel = el("section", "peerva-reader-panel");
    panel.dataset.theme = readerSettings.theme || "light";

    var top = el("div", "peerva-reader-top");
    top.appendChild(readerButton("← Library", closeReader, "Return to the library"));
    top.appendChild(el("span", "", "PEERVA READER"));
    top.appendChild(readerButton("×", closeReader, "Close reader"));
    panel.appendChild(top);

    var heading = el("header", "peerva-reader-heading");
    heading.appendChild(el("div", "peerva-reader-kicker",
      (item.type === "Manga" ? "Manga & Comics" : "Books & Stories") + " · " + (item.genre || "Reading")));
    heading.appendChild(el("h1", "peerva-reader-title", item.title));
    heading.appendChild(el("p", "peerva-reader-subtitle", "By " + (item.author || "Unknown author")));
    panel.appendChild(heading);

    var toolbar = el("div", "peerva-reader-toolbar");
    toolbar.appendChild(readerButton("A−", function () {
      readerSettings.fontSize = Math.max(14, Number(readerSettings.fontSize) - 1);
      saveJSON(SETTINGS_KEY, readerSettings);
      applyReaderSettings(panel);
    }, "Decrease font size"));
    toolbar.appendChild(readerButton("A+", function () {
      readerSettings.fontSize = Math.min(32, Number(readerSettings.fontSize) + 1);
      saveJSON(SETTINGS_KEY, readerSettings);
      applyReaderSettings(panel);
    }, "Increase font size"));

    var theme = document.createElement("select");
    theme.className = "peerva-reader-select";
    theme.setAttribute("aria-label", "Reader colour theme");
    [
      { value: "light", label: "Light" },
      { value: "sepia", label: "Sepia" },
      { value: "dark", label: "Dark" }
    ].forEach(function (option) {
      var node = el("option", "", option.label);
      node.value = option.value;
      if (readerSettings.theme === option.value) node.selected = true;
      theme.appendChild(node);
    });
    theme.addEventListener("change", function () {
      readerSettings.theme = theme.value;
      panel.dataset.theme = theme.value;
      saveJSON(SETTINGS_KEY, readerSettings);
    });
    toolbar.appendChild(theme);
    toolbar.appendChild(el("span", "peerva-reader-spacer"));
    toolbar.appendChild(readerButton("Save book ♡", function () {
      var position = saved.indexOf(item.id);
      if (position < 0) saved.push(item.id);
      else saved.splice(position, 1);
      saveJSON(SAVE_KEY, saved);
    }, "Add or remove this book from saved books"));
    panel.appendChild(toolbar);

    var progressBar = el("div", "peerva-reader-progress");
    var progressFill = el("span");
    progressBar.appendChild(progressFill);
    panel.appendChild(progressBar);

    var content = el("div", "peerva-reader-content");
    content.id = "peerva-reader-content";
    panel.appendChild(content);

    readerOverlay.appendChild(panel);
    readerOverlay.addEventListener("click", function (event) {
      if (event.target === readerOverlay) closeReader();
    });
    document.body.style.overflow = "hidden";
    document.body.appendChild(readerOverlay);

    var escapeHandler = function (event) {
      if (event.key === "Escape") {
        closeReader();
        document.removeEventListener("keydown", escapeHandler);
      }
    };
    document.addEventListener("keydown", escapeHandler);

    panel.addEventListener("scroll", function () {
      var scrollable = panel.scrollHeight - panel.clientHeight;
      var percentage = scrollable > 0 ? (panel.scrollTop / scrollable) * 100 : 0;
      progressFill.style.width = Math.max(0, Math.min(100, percentage)) + "%";
    });

    applyReaderSettings(panel);

    if (item.provider === "internetarchive") {
      loadInternetArchiveReader(item, content, panel);
    } else if (item.provider === "gutendex") {
      loadGutenbergReader(item, content, panel);
    } else {
      renderLocalChapter(item, content, panel);
    }
  }

  function applyReaderSettings(panel) {
    var content = panel.querySelector(".peerva-reader-content");
    if (!content) return;
    content.style.fontSize = Number(readerSettings.fontSize || 19) + "px";
    content.style.lineHeight = String(readerSettings.lineHeight || 1.85);
  }

  function showReaderError(content, message) {
    content.innerHTML = "";
    content.appendChild(el("div", "peerva-reader-error", message));
  }

  /* -------------------- Internet Archive reader --------------------
     Prefer plain text inside Peerva. If no plain text is available,
     embed an accessible PDF in the Peerva reader panel.
     Some restricted items may not be readable or downloadable.
  ------------------------------------------------------------------ */

  function loadInternetArchiveReader(item, content, panel) {
    content.innerHTML = "";
    content.appendChild(el("p", "", "Loading the available book files into Peerva…"));

    fetch("https://archive.org/metadata/" + encodeURIComponent(item.archiveId))
      .then(function (response) {
        if (!response.ok) throw new Error("Could not retrieve item metadata.");
        return response.json();
      })
      .then(function (data) {
        if (!data || !data.metadata || !Array.isArray(data.files)) {
          throw new Error("This item has no readable metadata.");
        }

        var files = data.files.filter(function (file) {
          return file && file.name && !file.private;
        });

        var textFile = files.find(function (file) {
          return /\.txt$/i.test(file.name) &&
            !/meta|djvu\.xml|scandata|files\.xml/i.test(file.name);
        });

        var pdfFile = files.find(function (file) {
          return /\.pdf$/i.test(file.name) && !file.private;
        });

        if (textFile) {
          var textUrl = archiveDownloadUrl(item.archiveId, textFile.name);
          fetch(textUrl)
            .then(function (response) {
              if (!response.ok) throw new Error("The text file is not available.");
              return response.text();
            })
            .then(function (raw) {
              if (!readerOverlay || !content.isConnected) return;
              content.innerHTML = "";
              var cleanText = raw
                .replace(/\r/g, "")
                .replace(/^\s*Created by.*\n/i, "");

              cleanText.split(/\n\s*\n/).forEach(function (paragraph) {
                if (paragraph.trim()) {
                  content.appendChild(el("p", "", paragraph.trim()));
                }
              });

              if (!content.children.length) {
                showReaderError(content, "This text file did not contain readable text.");
              }
            })
            .catch(function () {
              if (pdfFile) showArchivePdf(item, pdfFile, content);
              else showReaderError(content, "Peerva couldn't load the text file. This item may restrict direct access.");
            });
          return;
        }

        if (pdfFile) {
          showArchivePdf(item, pdfFile, content);
          return;
        }

        showReaderError(
          content,
          "Internet Archive did not provide a directly readable text or PDF file for this item. It may be a lending-only item, use another format, or have access restrictions. Peerva has not redirected you away."
        );
      })
      .catch(function (error) {
        showReaderError(
          content,
          "Peerva couldn't load this item's files. Internet Archive may be temporarily unavailable or this item may have access restrictions. Please try another book."
        );
        console.warn("Peerva Internet Archive reader:", error);
      });
  }

  function archiveDownloadUrl(identifier, filename) {
    return "https://archive.org/download/" +
      encodeURIComponent(identifier) + "/" +
      filename.split("/").map(encodeURIComponent).join("/");
  }

  function showArchivePdf(item, file, content) {
    content.innerHTML = "";
    content.style.maxWidth = "100%";

    var note = el("p", "peerva-reader-note",
      "Reading this available PDF inside Peerva. Some PDFs may not display on every browser or device.");
    content.appendChild(note);

    var frame = el("iframe", "peerva-reader-frame");
    frame.title = item.title + " PDF reader";
    frame.loading = "lazy";
    frame.src = archiveDownloadUrl(item.archiveId, file.name) + "#view=FitH";
    frame.setAttribute("referrerpolicy", "no-referrer");
    content.appendChild(frame);
  }

  /* -------------------- Project Gutenberg reader -------------------- */

  function loadGutenbergReader(item, content, panel) {
    if (item.chapters && item.chapters[0] && item.chapters[0].body) {
      renderLocalChapter(item, content, panel);
      return;
    }

    if (!item.downloadUrl) {
      showReaderError(content, "No directly readable text file was found for this book.");
      return;
    }

    content.innerHTML = "";
    content.appendChild(el("p", "", "Loading the full text into Peerva…"));

    fetch(item.downloadUrl)
      .then(function (response) {
        if (!response.ok) throw new Error("Book text unavailable.");
        return response.text();
      })
      .then(function (raw) {
        if (!readerOverlay || !content.isConnected) return;

        raw = raw
          .replace(/^.*?\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*\n/i, "")
          .replace(/\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[\s\S]*$/i, "")
          .trim();

        item.chapters[0].body = raw;
        renderLocalChapter(item, content, panel);
      })
      .catch(function () {
        showReaderError(
          content,
          "The book text could not be fetched directly. The source may block browser requests. This book has not been opened on an external reading page."
        );
      });
  }

  /* -------------------- Local/licensed chapter reader -------------------- */

  function renderLocalChapter(item, content, panel) {
    content.innerHTML = "";
    content.style.maxWidth = item.type === "Manga" ? "850px" : "690px";

    var chapters = item.chapters || [];
    var index = Math.max(0, Math.min(readerChapterIndex, chapters.length - 1));
    var chapter = chapters[index];

    if (!chapter) {
      showReaderError(content, "This title has no readable chapters yet.");
      return;
    }

    if (chapter.pages && chapter.pages.length) {
      var pages = el("div", "peerva-manga-pages");
      chapter.pages.forEach(function (page, pageIndex) {
        var url = typeof page === "string" ? page : page.url;
        if (!url) return;
        var image = el("img");
        image.src = url;
        image.alt = item.title + ", page " + (pageIndex + 1);
        image.loading = "lazy";
        image.decoding = "async";
        pages.appendChild(image);
      });
      content.appendChild(pages);
    } else {
      content.style.whiteSpace = "normal";
      String(chapter.body || "").split(/\n\s*\n/).forEach(function (paragraph) {
        if (paragraph.trim()) content.appendChild(el("p", "", paragraph.trim()));
      });
    }

    progress[item.id] = index;
    saveJSON(PROGRESS_KEY, progress);

    var controls = el("div", "peerva-reader-controls");
    var previous = readerButton("← Previous", function () {
      readerChapterIndex = index - 1;
      openReader(item, readerChapterIndex);
    });
    previous.disabled = index <= 0;

    controls.appendChild(previous);
    controls.appendChild(el("span", "", chapters.length > 1
      ? "Chapter " + (index + 1) + " of " + chapters.length
      : "Full book"));

    var next = readerButton("Next →", function () {
      readerChapterIndex = index + 1;
      openReader(item, readerChapterIndex);
    });
    next.disabled = index >= chapters.length - 1;
    controls.appendChild(next);
    panel.appendChild(controls);
  }

  /* -------------------- Catalogue loading -------------------- */

  function loadMoreBooks() {
    if (GUTENBERG_LOADING || GUTENBERG_DONE || ITEMS.length >= GUTENBERG_TARGET) return;

    GUTENBERG_LOADING = true;
    updateLoadMoreButton("Loading English books…", true);

    fetch("https://gutendex.com/books/?languages=en&copyright=false&page=" + GUTENBERG_PAGE)
      .then(function (response) {
        if (!response.ok) throw new Error("Catalogue request failed.");
        return response.json();
      })
      .then(function (data) {
        (data.results || []).forEach(function (book) {
          var normalized = normalizeGutenbergBook(book);
          if (normalized && !ITEMS.some(function (x) { return x.id === normalized.id; }) &&
              ITEMS.length < GUTENBERG_TARGET) {
            ITEMS.push(normalized);
          }
        });

        GUTENBERG_PAGE++;
        GUTENBERG_DONE = !data.next || ITEMS.length >= GUTENBERG_TARGET;

        addPermittedItems();
        buildControls();
        render();

        updateLoadMoreButton(
          GUTENBERG_DONE
            ? "Loaded " + ITEMS.length + " catalogue books"
            : "Load more English books (" + ITEMS.length + " / " + GUTENBERG_TARGET + ")",
          GUTENBERG_DONE
        );
      })
      .catch(function (error) {
        console.warn("Peerva catalogue loading failed:", error);
        updateLoadMoreButton("Couldn't load books — tap to retry", false);
      })
      .finally(function () {
        GUTENBERG_LOADING = false;
      });
  }

  function addPermittedItems() {
    LICENSED_STORIES.concat(LICENSED_MANGA).forEach(function (item) {
      if (!item || !item.id || !item.title) return;
      if (ITEMS.some(function (x) { return x.id === item.id; })) return;

      item.type = item.type || (LICENSED_MANGA.indexOf(item) >= 0 ? "Manga" : "Story");
      item.author = item.author || "Unknown author";
      item.genre = item.genre || "Fantasy";
      item.audience = item.audience || "Teens & Adults";
      item.lang = item.lang || "English";
      item.source = item.source || "Creator-approved";
      item.chapters = item.chapters || [];
      ITEMS.push(item);
    });
  }

  function getLoadMoreButton() {
    var button = document.getElementById("peerva-load-more-books");
    if (button) return button;

    button = el("button", "read-btn", "Load more English books");
    button.id = "peerva-load-more-books";
    button.type = "button";
    button.style.cssText = "display:block;margin:24px auto;padding:12px 20px;cursor:pointer;";
    button.addEventListener("click", loadMoreBooks);

    if (grid.parentNode) {
      grid.parentNode.insertBefore(button, grid.nextSibling);
    }
    return button;
  }

  function updateLoadMoreButton(label, disabled) {
    var button = getLoadMoreButton();
    button.textContent = label;
    button.disabled = !!disabled;
    button.style.opacity = disabled ? ".65" : "1";
  }

  /* -------------------- Start library -------------------- */

  buildControls();
  addPermittedItems();
  render();
  loadMoreBooks();

})();
