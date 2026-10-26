/* =========================================================
   PEERVA STORYBOOK — On-site Books, Novels, Manga & Comics
   Replace the entire existing storybook.js with this file.

   What's new in this version
   1. Manga & comics open as IMAGE pages (never plain text).
   2. PDFs are rendered inside the reader with PDF.js (canvas pages).
   3. The first 1000 catalogue books load automatically and each one
      has a reading fallback chain, so they open reliably.
   ========================================================= */

(function () {
  "use strict";

  var SAVE_KEY = "chathub-saved-stories";
  var PROGRESS_KEY = "peerva-story-progress-v2";
  var SETTINGS_KEY = "peerva-reader-settings";

  var PDFJS_VERSION = "3.11.174";
  var PDFJS_SRC = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/" + PDFJS_VERSION + "/pdf.min.js";
  var PDFJS_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/" + PDFJS_VERSION + "/pdf.worker.min.js";

  var ITEMS = [];
  var SEARCH_RESULTS = [];
  var GUTENBERG_NEXT = "";
  var GUTENBERG_COUNT = 0;
  var GUTENBERG_LOADING = false;
  var GUTENBERG_DONE = false;
  var GUTENBERG_TARGET = 1000;
  var MANGA_LOADED = false;
  var SEARCH_ID = 0;
  var PAGE_SIZE = 60;
  var visibleCount = PAGE_SIZE;

  var activeType = "All";
  var activeAudience = "All";
  var activeGenre = "All";
  var onlySaved = false;
  var readerOverlay = null;
  var readerItem = null;
  var readerChapterIndex = 0;
  var currentSearch = "";
  var escapeHandler = null;
  var pdfJsPromise = null;

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

  /* Add creator-approved titles here.
     Manga/comic chapter format:
       chapters: [{ title: "Chapter 1", pages: ["img1.jpg", "img2.jpg"] }]
     or a PDF chapter:
       chapters: [{ title: "Chapter 1", pdf: "https://.../chapter1.pdf" }]
     Story format:
       chapters: [{ title: "Chapter 1", body: "Text..." }]                */
  var LICENSED_STORIES = [];
  var LICENSED_MANGA = [];

  /* -------------------- Helpers -------------------- */

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
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function findElement(ids) {
    for (var i = 0; i < ids.length; i++) {
      var found = document.getElementById(ids[i]);
      if (found) return found;
    }
    return null;
  }

  function debounce(callback, delay) {
    var timer;
    return function () {
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () { callback.apply(null, args); }, delay);
    };
  }

  function fetchWithTimeout(url, ms) {
    var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, ms || 15000) : null;
    return fetch(url, controller ? { signal: controller.signal } : undefined)
      .then(function (response) {
        if (timer) clearTimeout(timer);
        return response;
      })
      .catch(function (error) {
        if (timer) clearTimeout(timer);
        throw error;
      });
  }

  function fetchJSONRetry(url, tries) {
    return fetchWithTimeout(url, 20000)
      .then(function (response) {
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.json();
      })
      .catch(function (error) {
        if (tries > 1) {
          return new Promise(function (resolve) { setTimeout(resolve, 1200); })
            .then(function () { return fetchJSONRetry(url, tries - 1); });
        }
        throw error;
      });
  }

  /* -------------------- Page elements -------------------- */

  var grid = findElement(["stories", "story-grid", "story-list"]);
  var search = findElement(["story-search", "search"]);
  var tabBox = findElement(["tabs", "story-tabs"]);
  var audienceBox = findElement(["audience-chips", "audience-filters"]);
  var genreBox = findElement(["chips", "genre-chips", "genre-filters"]);
  var savedBtn = findElement(["saved-toggle", "show-saved"]);

  if (!grid) {
    console.error("Peerva Storybook: cannot find the story grid (id=\"stories\").");
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
      button.addEventListener("click", function () { callback(value); });
      box.appendChild(button);
    });
  }

  function buildControls() {
    makeButtons(tabBox, ["All", "Story", "Manga"], activeType, function (value) {
      activeType = value;
      activeGenre = "All";
      visibleCount = PAGE_SIZE;
      buildControls();
      render();
      if (value === "Manga") loadManga();
      if (currentSearch) searchOnline(currentSearch);
    }, "tab");

    if (tabBox) {
      var labels = ["All", "Books & Stories", "Manga & Comics"];
      Array.prototype.forEach.call(tabBox.children, function (button, index) {
        button.textContent = labels[index] || button.textContent;
      });
    }

    makeButtons(audienceBox, ["All", "Teens", "Adults"], activeAudience, function (value) {
      activeAudience = value;
      visibleCount = PAGE_SIZE;
      buildControls();
      render();
    }, "chip");

    var genres = ["All"];
    allItems().forEach(function (item) {
      if ((activeType === "All" || item.type === activeType) &&
          genres.indexOf(item.genre) === -1) {
        genres.push(item.genre);
      }
    });

    makeButtons(genreBox, genres, activeGenre, function (value) {
      activeGenre = value;
      visibleCount = PAGE_SIZE;
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
      toggleSaved(item.id);
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
      badges.appendChild(el("span", "badge plain", "Public domain"));
    } else if (item.rights) {
      badges.appendChild(el("span", "badge plain", item.rights));
    }

    body.appendChild(badges);
    body.appendChild(el("p", "story-summary", item.summary || "Open this title to read it on Peerva."));
    body.appendChild(el("span", "story-source", "Source: " + (item.source || "Peerva library")));

    var read = el("button", "read-btn", "Read on Peerva");
    read.type = "button";
    read.addEventListener("click", function () { openReader(item); });
    body.appendChild(read);

    card.appendChild(cover);
    card.appendChild(body);
    return card;
  }

  function toggleSaved(id) {
    var position = saved.indexOf(id);
    if (position < 0) saved.push(id);
    else saved.splice(position, 1);
    saveJSON(SAVE_KEY, saved);
    return position < 0;
  }

  var moreBtn = null;

  function getMoreButton() {
    if (moreBtn) return moreBtn;
    moreBtn = el("button", "read-btn", "Show more books");
    moreBtn.type = "button";
    moreBtn.style.cssText = "display:none;margin:20px auto;padding:12px 20px;cursor:pointer;";
    moreBtn.addEventListener("click", function () {
      visibleCount += PAGE_SIZE;
      render();
    });
    if (grid.parentNode) grid.parentNode.insertBefore(moreBtn, grid.nextSibling);
    return moreBtn;
  }

  function render() {
    var query = (search.value || "").trim().toLowerCase();
    var list = allItems().filter(function (item) {
      var text = [item.title, item.author, item.genre, item.summary, item.titleKo, item.source]
        .join(" ").toLowerCase();

      return (
        (activeType === "All" || item.type === activeType) &&
        (activeGenre === "All" || item.genre === activeGenre) &&
        (!query || text.indexOf(query) >= 0) &&
        (!onlySaved || saved.indexOf(item.id) >= 0) &&
        matchesAudience(item)
      );
    });

    grid.innerHTML = "";
    var more = getMoreButton();

    if (!list.length) {
      more.style.display = "none";
      var loading = GUTENBERG_LOADING || (activeType === "Manga" && !MANGA_LOADED);
      grid.appendChild(el(
        "p",
        "empty",
        onlySaved
          ? "No saved books match these filters yet."
          : query
            ? "No matching books yet. Peerva is searching the online catalogues as you type."
            : loading
              ? "Loading the library…"
              : "Nothing here yet."
      ));
      return;
    }

    var shown = list.slice(0, visibleCount);
    var fragment = document.createDocumentFragment();
    shown.forEach(function (item, index) {
      fragment.appendChild(makeCard(item, index));
    });
    grid.appendChild(fragment);

    if (list.length > shown.length) {
      more.textContent = "Show more (" + shown.length + " of " + list.length + ")";
      more.style.display = "block";
    } else {
      more.style.display = "none";
    }
  }

  search.addEventListener("input", debounce(function () {
    currentSearch = search.value.trim();
    visibleCount = PAGE_SIZE;
    render();
    searchOnline(currentSearch);
  }, 450));

  if (savedBtn) {
    savedBtn.addEventListener("click", function () {
      onlySaved = !onlySaved;
      visibleCount = PAGE_SIZE;
      savedBtn.setAttribute("aria-pressed", onlySaved ? "true" : "false");
      render();
    });
  }

  /* -------------------- Online book discovery -------------------- */

  function genreFromText(value) {
    var text = String(value || "").toLowerCase();
    if (/manga|comic|graphic novel/.test(text)) return "Manga & Comics";
    if (/fantasy|magic|fairy|myth/.test(text)) return "Fantasy";
    if (/romance|love story|marriage/.test(text)) return "Romance";
    if (/mystery|detective|crime|suspense/.test(text)) return "Mystery";
    if (/horror|ghost|gothic/.test(text)) return "Horror";
    if (/science fiction|sci-fi|space/.test(text)) return "Science Fiction";
    if (/adventure|journey|travel/.test(text)) return "Adventure";
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
      buildControls();
      render();
      return;
    }

    var mangaOnly = activeType === "Manga";
    var jobs = [searchInternetArchive(query, mangaOnly)];
    if (!mangaOnly) jobs.push(searchGutenberg(query));

    Promise.allSettled(jobs).then(function (results) {
      if (requestId !== SEARCH_ID) return;
      results.forEach(function (result) {
        if (result.status === "fulfilled") addSearchResults(result.value);
      });
      if (!SEARCH_RESULTS.length) render();
    });
  }

  function cleanArchiveQuery(text) {
    return String(text).replace(/["\\():\[\]{}^~*?!+\-\/]/g, " ").replace(/\s+/g, " ").trim();
  }

  function archiveSearch(q, rows, sortByDownloads) {
    var url = new URL("https://archive.org/advancedsearch.php");
    url.searchParams.set("q", q);
    ["identifier", "title", "creator", "description", "subject", "year", "language", "imagecount"]
      .forEach(function (field) { url.searchParams.append("fl[]", field); });
    if (sortByDownloads) url.searchParams.append("sort[]", "downloads desc");
    url.searchParams.set("rows", String(rows));
    url.searchParams.set("page", "1");
    url.searchParams.set("output", "json");

    return fetchJSONRetry(url.toString(), 2).then(function (data) {
      return (data.response && data.response.docs) || [];
    });
  }

  function normalizeArchiveDoc(book, forceManga) {
    var title = book.title || "Untitled book";
    if (Array.isArray(title)) title = title[0];
    var subjectText = Array.isArray(book.subject) ? book.subject.join(", ") : (book.subject || "");
    var description = Array.isArray(book.description) ? book.description.join(" ") : (book.description || "");
    var isManga = forceManga || isMangaTitle(title, subjectText);

    return {
      id: "ia-" + book.identifier,
      provider: "internetarchive",
      archiveId: book.identifier,
      title: title,
      author: Array.isArray(book.creator) ? book.creator.join(", ") : (book.creator || "Unknown author"),
      type: isManga ? "Manga" : "Story",
      genre: isManga ? "Manga & Comics" : genreFromText(title + " " + subjectText + " " + description),
      audience: "Teens & Adults",
      lang: "English",
      rights: "Check item access and rights",
      imageCount: parseInt(book.imagecount, 10) || 0,
      summary: String(description).replace(/<[^>]*>/g, "").slice(0, 350) ||
        "Record from the Internet Archive. Opens as page images or a PDF inside Peerva.",
      source: "Internet Archive",
      cover: "https://archive.org/services/img/" + encodeURIComponent(book.identifier),
      chapters: []
    };
  }

  var ARCHIVE_OPEN = " AND mediatype:texts AND language:eng AND -access-restricted-item:true";
  var ARCHIVE_MANGA = '(subject:manga OR subject:comics OR subject:"comic books" OR subject:"graphic novels")';

  function searchInternetArchive(query, mangaOnly) {
    var words = cleanArchiveQuery(query);
    if (!words) return Promise.resolve([]);

    var q = "(title:(" + words + ") OR creator:(" + words + "))" + ARCHIVE_OPEN;
    if (mangaOnly) q += " AND " + ARCHIVE_MANGA;

    return archiveSearch(q, 30, true).then(function (docs) {
      return docs.map(function (doc) { return normalizeArchiveDoc(doc, mangaOnly); });
    });
  }

  /* Preload manga & comics so the Manga tab is never empty. */
  function loadManga() {
    if (MANGA_LOADED) return;
    MANGA_LOADED = true;

    archiveSearch(ARCHIVE_MANGA + ARCHIVE_OPEN, 100, true)
      .then(function (docs) {
        docs.forEach(function (doc) {
          var item = normalizeArchiveDoc(doc, true);
          if (!ITEMS.some(function (x) { return x.id === item.id; })) ITEMS.push(item);
        });
        buildControls();
        render();
      })
      .catch(function (error) {
        MANGA_LOADED = false;
        console.warn("Peerva manga catalogue failed:", error);
      });
  }

  function searchGutenberg(query) {
    var url = "https://gutendex.com/books/?search=" + encodeURIComponent(query) + "&languages=en";
    return fetchJSONRetry(url, 2).then(function (data) {
      return (data.results || []).map(normalizeGutenbergBook).filter(Boolean);
    });
  }

  function pickFormat(formats, prefix) {
    var keys = Object.keys(formats || {});
    var utf = keys.filter(function (k) { return k.indexOf(prefix) === 0 && /utf-8/i.test(k); })[0];
    var any = keys.filter(function (k) { return k.indexOf(prefix) === 0; })[0];
    var key = utf || any;
    return key ? formats[key] : "";
  }

  function normalizeGutenbergBook(book) {
    if (!book || !book.id) return null;
    var formats = book.formats || {};
    var id = book.id;

    var textUrls = [];
    var textUrl = pickFormat(formats, "text/plain");
    if (textUrl) textUrls.push(textUrl.replace(/^http:/, "https:"));
    textUrls.push("https://www.gutenberg.org/cache/epub/" + id + "/pg" + id + ".txt");
    textUrls.push("https://www.gutenberg.org/ebooks/" + id + ".txt.utf-8");

    var htmlUrl = pickFormat(formats, "text/html");
    htmlUrl = htmlUrl
      ? htmlUrl.replace(/^http:/, "https:")
      : "https://www.gutenberg.org/cache/epub/" + id + "/pg" + id + "-images.html";

    var author = (book.authors || []).map(function (a) { return a.name; })
      .filter(Boolean).join(", ") || "Unknown author";

    var subjects = (book.subjects || []).concat(book.bookshelves || []).join(" ");

    return {
      id: "gutenberg-" + id,
      provider: "gutendex",
      gutenbergId: id,
      type: "Story",
      title: book.title || "Untitled book",
      author: author,
      genre: genreFromText(subjects),
      audience: "Teens & Adults",
      lang: "English",
      rights: "Public domain",
      summary: (book.subjects && book.subjects.length)
        ? "Subjects: " + book.subjects.slice(0, 3).join("; ")
        : "Classic English-language book from Project Gutenberg.",
      source: "Project Gutenberg",
      cover: formats["image/jpeg"] || "",
      textUrls: textUrls,
      htmlUrl: htmlUrl,
      chapters: [{ title: "Full book", body: "" }]
    };
  }

  /* -------------------- Reader styles -------------------- */

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
      .peerva-reader-content.is-visual { max-width:900px; font-family:inherit; }
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
        font-size:13px; line-height:1.6; font-family:inherit;
      }
      .peerva-reader-frame {
        width:100%; height:calc(100vh - 220px); min-height:420px;
        border:0; border-radius:8px; background:white;
      }
      .peerva-manga-pages, .peerva-pdf-pages {
        max-width:900px; margin:0 auto; display:flex;
        flex-direction:column; align-items:center; gap:6px;
      }
      .peerva-manga-pages img {
        display:block; max-width:100%; width:auto; height:auto;
        object-fit:contain; margin:0 auto; background:#e8e4dc;
        min-height:240px;
      }
      .peerva-pdf-page {
        width:100%; background:#fff; box-shadow:0 1px 6px rgba(0,0,0,.18);
        position:relative;
      }
      .peerva-pdf-page canvas { display:block; width:100%; height:auto; }
      .peerva-reader-error {
        border:1px solid rgba(180,80,60,.4); padding:16px;
        border-radius:12px; line-height:1.6; font-family:inherit;
      }
      @media(max-width:600px) {
        .peerva-reader-panel { padding:0 10px 28px; }
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

  /* -------------------- Reader shell -------------------- */

  function closeReader() {
    if (readerOverlay && readerOverlay.parentNode) {
      readerOverlay.parentNode.removeChild(readerOverlay);
    }
    readerOverlay = null;
    readerItem = null;
    document.body.style.overflow = "";
    if (escapeHandler) {
      document.removeEventListener("keydown", escapeHandler);
      escapeHandler = null;
    }
  }

  function readerButton(label, callback, title) {
    var button = el("button", "", label);
    button.type = "button";
    if (title) button.title = title;
    button.addEventListener("click", callback);
    return button;
  }

  function isVisualItem(item) {
    return item.type === "Manga";
  }

  function openReader(item, chapterIndex) {
    if (readerOverlay) closeReader();

    readerItem = item;
    readerChapterIndex = typeof chapterIndex === "number" ? chapterIndex : (progress[item.id] || 0);

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

    if (!isVisualItem(item)) {
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
    }

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

    var saveBtn = readerButton(
      saved.indexOf(item.id) >= 0 ? "Saved ♥" : "Save book ♡",
      function () {
        var nowSaved = toggleSaved(item.id);
        saveBtn.textContent = nowSaved ? "Saved ♥" : "Save book ♡";
        render();
      },
      "Add or remove this book from saved books"
    );
    toolbar.appendChild(saveBtn);
    panel.appendChild(toolbar);

    var progressBar = el("div", "peerva-reader-progress");
    var progressFill = el("span");
    progressBar.appendChild(progressFill);
    panel.appendChild(progressBar);

    var content = el("div", "peerva-reader-content");
    if (isVisualItem(item)) content.classList.add("is-visual");
    content.id = "peerva-reader-content";
    panel.appendChild(content);

    readerOverlay.appendChild(panel);
    readerOverlay.addEventListener("click", function (event) {
      if (event.target === readerOverlay) closeReader();
    });
    document.body.style.overflow = "hidden";
    document.body.appendChild(readerOverlay);

    escapeHandler = function (event) {
      if (event.key === "Escape") closeReader();
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
    if (!content || content.classList.contains("is-visual")) return;
    content.style.fontSize = Number(readerSettings.fontSize || 19) + "px";
    content.style.lineHeight = String(readerSettings.lineHeight || 1.85);
  }

  function showReaderError(content, message) {
    content.innerHTML = "";
    content.appendChild(el("div", "peerva-reader-error", message));
  }

  function readerIsOpen(content) {
    return !!readerOverlay && content.isConnected;
  }

  function renderParagraphs(content, rawText) {
    var fragment = document.createDocumentFragment();
    String(rawText || "").replace(/\r/g, "").split(/\n\s*\n/).forEach(function (block) {
      var text = block.replace(/\s*\n\s*/g, " ").trim();
      if (text) fragment.appendChild(el("p", "", text));
    });
    content.appendChild(fragment);
    return content.children.length > 0;
  }

  /* -------------------- Image pages (manga & comics) -------------------- */

  function showImagePages(content, urls, altBase, onFirstFail) {
    content.innerHTML = "";
    content.classList.add("is-visual");

    if (!urls.length) {
      if (onFirstFail) onFirstFail();
      return;
    }

    /* Probe the first image so we can fall back cleanly if it's blocked. */
    var probe = new Image();
    probe.onload = function () {
      if (!readerIsOpen(content)) return;
      var pages = el("div", "peerva-manga-pages");
      var fragment = document.createDocumentFragment();

      urls.forEach(function (url, i) {
        var image = el("img");
        image.alt = altBase + ", page " + (i + 1);
        image.loading = i < 2 ? "eager" : "lazy";
        image.decoding = "async";
        image.referrerPolicy = "no-referrer";
        image.src = url;
        image.addEventListener("error", function () {
          if (image.dataset.retried) {
            image.alt = "Page " + (i + 1) + " could not be loaded";
            return;
          }
          image.dataset.retried = "1";
          setTimeout(function () { image.src = url + (url.indexOf("?") < 0 ? "?" : "&") + "r=1"; }, 1500);
        });
        fragment.appendChild(image);
      });

      pages.appendChild(fragment);
      content.appendChild(pages);
    };
    probe.onerror = function () {
      if (onFirstFail) onFirstFail();
      else showReaderError(content, "These page images could not be loaded.");
    };
    probe.referrerPolicy = "no-referrer";
    probe.src = urls[0];
  }

  /* -------------------- PDF reader (PDF.js) -------------------- */

  function loadPdfJs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (pdfJsPromise) return pdfJsPromise;

    pdfJsPromise = new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = PDFJS_SRC;
      script.async = true;
      script.onload = function () {
        if (!window.pdfjsLib) { reject(new Error("PDF.js did not load")); return; }
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
        resolve(window.pdfjsLib);
      };
      script.onerror = function () { pdfJsPromise = null; reject(new Error("PDF.js failed to load")); };
      document.head.appendChild(script);
    });

    return pdfJsPromise;
  }

  /* Draws every PDF page to a canvas, rendering only pages near the screen. */
  function showPdf(url, content, panel, onFail) {
    content.innerHTML = "";
    content.classList.add("is-visual");
    var status = el("p", "peerva-reader-note", "Opening PDF…");
    content.appendChild(status);

    loadPdfJs()
      .then(function (pdfjsLib) {
        return pdfjsLib.getDocument({ url: url }).promise;
      })
      .then(function (pdf) {
        if (!readerIsOpen(content)) return;
        return pdf.getPage(1).then(function (firstPage) {
          if (!readerIsOpen(content)) return;
          content.innerHTML = "";

          var base = firstPage.getViewport({ scale: 1 });
          var ratio = base.width / base.height;
          var holder = el("div", "peerva-pdf-pages");
          content.appendChild(holder);

          var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
              if (!entry.isIntersecting) return;
              observer.unobserve(entry.target);
              drawPdfPage(pdf, entry.target);
            });
          }, { root: panel, rootMargin: "900px 0px" });

          for (var n = 1; n <= pdf.numPages; n++) {
            var wrap = el("div", "peerva-pdf-page");
            wrap.style.aspectRatio = String(ratio);
            wrap.dataset.page = String(n);
            holder.appendChild(wrap);
            observer.observe(wrap);
          }
        });
      })
      .catch(function (error) {
        console.warn("Peerva PDF reader:", error);
        if (!readerIsOpen(content)) return;
        if (onFail) onFail();
        else showReaderError(content, "This PDF could not be opened. The file server may block browser access.");
      });
  }

  function drawPdfPage(pdf, wrap) {
    var number = parseInt(wrap.dataset.page, 10);
    pdf.getPage(number).then(function (page) {
      var cssWidth = wrap.clientWidth || 800;
      var base = page.getViewport({ scale: 1 });
      var scale = (cssWidth / base.width) * Math.min(window.devicePixelRatio || 1, 2);
      var viewport = page.getViewport({ scale: scale });

      var canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      wrap.style.aspectRatio = canvas.width + " / " + canvas.height;
      wrap.appendChild(canvas);

      return page.render({
        canvasContext: canvas.getContext("2d"),
        viewport: viewport
      }).promise;
    }).catch(function (error) {
      console.warn("Peerva PDF page " + number + " failed:", error);
    });
  }

  /* -------------------- Internet Archive reader -------------------- */

  function archiveDownloadUrl(identifier, filename) {
    return "https://archive.org/download/" +
      encodeURIComponent(identifier) + "/" +
      filename.split("/").map(encodeURIComponent).join("/");
  }

  function archivePageUrls(identifier, count) {
    var urls = [];
    for (var i = 0; i < count; i++) {
      urls.push("https://archive.org/download/" + encodeURIComponent(identifier) +
        "/page/n" + i + "_w1000.jpg");
    }
    return urls;
  }

  /* Last resort: the Internet Archive's own embedded reader, kept inside Peerva. */
  function showArchiveEmbed(item, content) {
    content.innerHTML = "";
    content.classList.add("is-visual");
    content.appendChild(el("p", "peerva-reader-note",
      "Reading inside Peerva with the Internet Archive viewer."));

    var frame = el("iframe", "peerva-reader-frame");
    frame.title = item.title + " reader";
    frame.src = "https://archive.org/embed/" + encodeURIComponent(item.archiveId);
    frame.setAttribute("allowfullscreen", "true");
    content.appendChild(frame);
  }

  function loadInternetArchiveReader(item, content, panel) {
    content.innerHTML = "";
    content.appendChild(el("p", "peerva-reader-note", "Loading pages into Peerva…"));

    fetchWithTimeout("https://archive.org/metadata/" + encodeURIComponent(item.archiveId), 20000)
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

        var imageCount = parseInt(data.metadata.imagecount, 10) || item.imageCount || 0;

        var pdfFile =
          files.find(function (f) { return /\.pdf$/i.test(f.name) && !/_text\.pdf$/i.test(f.name); }) ||
          files.find(function (f) { return /\.pdf$/i.test(f.name); });

        var textFile =
          files.find(function (f) { return /_djvu\.txt$/i.test(f.name); }) ||
          files.find(function (f) {
            return /\.txt$/i.test(f.name) && !/meta|djvu\.xml|scandata|files\.xml/i.test(f.name);
          });

        var embed = function () { showArchiveEmbed(item, content); };
        var tryPdf = function (fallback) {
          if (pdfFile) showPdf(archiveDownloadUrl(item.archiveId, pdfFile.name), content, panel, fallback);
          else fallback();
        };

        /* Manga & comics: always images. Never plain text. */
        if (isVisualItem(item)) {
          if (imageCount > 0) {
            showImagePages(content, archivePageUrls(item.archiveId, imageCount), item.title, function () {
              tryPdf(embed);
            });
          } else {
            tryPdf(embed);
          }
          return;
        }

        /* Books: readable text first, then PDF pages, then embedded viewer. */
        if (textFile) {
          fetchWithTimeout(archiveDownloadUrl(item.archiveId, textFile.name), 30000)
            .then(function (response) {
              if (!response.ok) throw new Error("The text file is not available.");
              return response.text();
            })
            .then(function (raw) {
              if (!readerIsOpen(content)) return;
              content.innerHTML = "";
              var cleaned = raw.replace(/^\s*Created by.*\n/i, "");
              if (!renderParagraphs(content, cleaned)) throw new Error("empty text");
            })
            .catch(function () {
              if (!readerIsOpen(content)) return;
              tryPdf(function () {
                if (imageCount > 0) {
                  showImagePages(content, archivePageUrls(item.archiveId, imageCount), item.title, embed);
                } else {
                  embed();
                }
              });
            });
          return;
        }

        tryPdf(function () {
          if (imageCount > 0) {
            showImagePages(content, archivePageUrls(item.archiveId, imageCount), item.title, embed);
          } else {
            embed();
          }
        });
      })
      .catch(function (error) {
        console.warn("Peerva Internet Archive reader:", error);
        if (readerIsOpen(content)) showArchiveEmbed(item, content);
      });
  }

  /* -------------------- Project Gutenberg reader -------------------- */

  function stripGutenbergBoilerplate(raw) {
    return raw
      .replace(/^[\s\S]*?\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*\n/i, "")
      .replace(/\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[\s\S]*$/i, "")
      .trim();
  }

  /* Tries each text URL directly, then through public CORS relays. */
  function fetchBookText(urls) {
    var candidates = [];
    urls.forEach(function (u) { candidates.push(u); });
    var first = urls[0];
    candidates.push("https://api.allorigins.win/raw?url=" + encodeURIComponent(first));
    candidates.push("https://corsproxy.io/?" + encodeURIComponent(first));

    var index = 0;
    function attempt() {
      if (index >= candidates.length) return Promise.reject(new Error("All text sources failed"));
      var url = candidates[index++];
      return fetchWithTimeout(url, 15000)
        .then(function (response) {
          if (!response.ok) throw new Error("HTTP " + response.status);
          return response.text();
        })
        .then(function (text) {
          if (!text || text.length < 800 || /^\s*<(!doctype|html)/i.test(text)) {
            throw new Error("Not a book text");
          }
          return text;
        })
        .catch(attempt);
    }
    return attempt();
  }

  function showGutenbergFrame(item, content) {
    content.innerHTML = "";
    content.classList.add("is-visual");
    content.appendChild(el("p", "peerva-reader-note",
      "Reading this book inside Peerva with the original formatted edition."));

    var frame = el("iframe", "peerva-reader-frame");
    frame.title = item.title;
    frame.src = item.htmlUrl;
    frame.setAttribute("referrerpolicy", "no-referrer");
    content.appendChild(frame);
  }

  function loadGutenbergReader(item, content, panel) {
    if (item.chapters && item.chapters[0] && item.chapters[0].body) {
      renderLocalChapter(item, content, panel);
      return;
    }

    content.innerHTML = "";
    content.appendChild(el("p", "peerva-reader-note", "Loading the full text into Peerva…"));

    fetchBookText(item.textUrls || [])
      .then(function (raw) {
        if (!readerIsOpen(content)) return;
        item.chapters[0].body = stripGutenbergBoilerplate(raw);
        renderLocalChapter(item, content, panel);
      })
      .catch(function () {
        if (readerIsOpen(content)) showGutenbergFrame(item, content);
      });
  }

  /* -------------------- Local / licensed chapter reader -------------------- */

  function renderLocalChapter(item, content, panel) {
    content.innerHTML = "";

    var chapters = item.chapters || [];
    var index = Math.max(0, Math.min(readerChapterIndex, chapters.length - 1));
    var chapter = chapters[index];

    if (!chapter) {
      showReaderError(content, "This title has no readable chapters yet.");
      return;
    }

    var visual = isVisualItem(item) || (chapter.pages && chapter.pages.length) || chapter.pdf;
    if (visual) content.classList.add("is-visual");
    content.style.maxWidth = visual ? "900px" : "690px";

    if (chapter.pages && chapter.pages.length) {
      var urls = chapter.pages.map(function (page) {
        return typeof page === "string" ? page : page.url;
      }).filter(Boolean);
      showImagePages(content, urls, item.title, function () {
        showReaderError(content, "The page images for this chapter could not be loaded.");
      });
    } else if (chapter.pdf) {
      showPdf(chapter.pdf, content, panel);
    } else if (isVisualItem(item)) {
      showReaderError(content, "This manga has no page images yet.");
    } else {
      renderParagraphs(content, chapter.body || "");
    }

    progress[item.id] = index;
    saveJSON(PROGRESS_KEY, progress);

    if (chapters.length > 1) {
      var controls = el("div", "peerva-reader-controls");
      var previous = readerButton("← Previous", function () {
        openReader(item, index - 1);
      });
      previous.disabled = index <= 0;
      controls.appendChild(previous);
      controls.appendChild(el("span", "", "Chapter " + (index + 1) + " of " + chapters.length));

      var next = readerButton("Next →", function () {
        openReader(item, index + 1);
      });
      next.disabled = index >= chapters.length - 1;
      controls.appendChild(next);
      panel.appendChild(controls);
    }
  }

  /* -------------------- Catalogue loading (first 1000 books) --------------------
     Loads Gutendex pages one after another (32 books each) until 1000
     readable books are in the library. Cards show 60 at a time so the
     page stays fast.
  ------------------------------------------------------------------------------ */

  var statusBtn = null;

  function getStatusButton() {
    if (statusBtn) return statusBtn;
    statusBtn = el("button", "read-btn", "");
    statusBtn.id = "peerva-load-more-books";
    statusBtn.type = "button";
    statusBtn.style.cssText = "display:none;margin:10px auto 30px;padding:10px 18px;cursor:pointer;";
    statusBtn.addEventListener("click", loadMoreBooks);
    if (grid.parentNode) {
      grid.parentNode.insertBefore(statusBtn, getMoreButton().nextSibling);
    }
    return statusBtn;
  }

  function setStatus(label, clickable) {
    var button = getStatusButton();
    if (!label) {
      button.style.display = "none";
      return;
    }
    button.textContent = label;
    button.disabled = !clickable;
    button.style.opacity = clickable ? "1" : ".65";
    button.style.display = "block";
  }

  function loadMoreBooks() {
    if (GUTENBERG_LOADING || GUTENBERG_DONE) return;
    GUTENBERG_LOADING = true;

    var url = GUTENBERG_NEXT || "https://gutendex.com/books/?languages=en&copyright=false";
    setStatus("Loading English books… " + GUTENBERG_COUNT + " / " + GUTENBERG_TARGET, false);

    fetchJSONRetry(url, 3)
      .then(function (data) {
        (data.results || []).forEach(function (book) {
          if (GUTENBERG_COUNT >= GUTENBERG_TARGET) return;
          var item = normalizeGutenbergBook(book);
          if (item && !ITEMS.some(function (x) { return x.id === item.id; })) {
            ITEMS.push(item);
            GUTENBERG_COUNT++;
          }
        });

        GUTENBERG_NEXT = data.next ? String(data.next).replace(/^http:/, "https:") : "";
        GUTENBERG_DONE = !GUTENBERG_NEXT || GUTENBERG_COUNT >= GUTENBERG_TARGET;

        addPermittedItems();
        buildControls();
        render();

        GUTENBERG_LOADING = false;

        if (GUTENBERG_DONE) {
          setStatus("", false);
        } else {
          loadMoreBooks();
        }
      })
      .catch(function (error) {
        console.warn("Peerva catalogue loading failed:", error);
        GUTENBERG_LOADING = false;
        render();
        setStatus("Couldn't load more books (" + GUTENBERG_COUNT + " loaded) — tap to retry", true);
      });
  }

  function addPermittedItems() {
    LICENSED_STORIES.concat(LICENSED_MANGA).forEach(function (item) {
      if (!item || !item.id || !item.title) return;
      if (ITEMS.some(function (x) { return x.id === item.id; })) return;

      item.type = item.type || (LICENSED_MANGA.indexOf(item) >= 0 ? "Manga" : "Story");
      item.author = item.author || "Unknown author";
      item.genre = item.genre || (item.type === "Manga" ? "Manga & Comics" : "Fantasy");
      item.audience = item.audience || "Teens & Adults";
      item.lang = item.lang || "English";
      item.source = item.source || "Creator-approved";
      item.chapters = item.chapters || [];
      ITEMS.push(item);
    });
  }

  /* -------------------- Start library -------------------- */

  buildControls();
  addPermittedItems();
  render();
  loadManga();
  loadMoreBooks();

})();
