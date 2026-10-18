// storybook.js
// Every item here is hosted on another website. Cards only link out.
//
// To add one, copy an entry and change it:
//   id        any unique text
//   type      "Story" or "Manga"
//   title     title in English or the main title
//   titleKo   optional Korean title
//   author    author name
//   genre     used for the genre chips
//   audience  "Teens", "Adults" or "Teens & Adults"
//   lang      language you read it in
//   rights    "Public domain", "Official free reader" or similar label
//   summary   one or two lines in your own words
//   source    site name shown on the card
//   url       the page where it can be read
//   note      optional warning or tip shown on the card
//   cover     optional image URL (leave out for a colour cover)
//
// Only list things you are allowed to link to. Never copy pages from
// manga or story sites onto ChatHub.

var ITEMS = [

    /* ---------- Korean stories (expired copyright) ---------- */

    {
        id: "memil",
        type: "Story",
        title: "When the Buckwheat Blooms",
        titleKo: "메밀꽃 필 무렵",
        author: "Lee Hyo-seok (이효석)",
        genre: "Classic fiction",
        audience: "Teens & Adults",
        lang: "Korean",
        rights: "Public domain",
        summary: "Travelling merchants walk through the night to the next market, and one remembers a single moonlit evening from long ago.",
        source: "공유마당 (Gongu Madang)",
        url: "https://gongu.copyright.or.kr/",
        note: "Search the Korean title on the site."
    },
    {
        id: "unsu",
        type: "Story",
        title: "A Lucky Day",
        titleKo: "운수 좋은 날",
        author: "Hyun Jin-geon (현진건)",
        genre: "Classic fiction",
        audience: "Teens & Adults",
        lang: "Korean",
        rights: "Public domain",
        summary: "A poor rickshaw puller has an unusually lucky day while his sick wife waits at home.",
        source: "공유마당 (Gongu Madang)",
        url: "https://gongu.copyright.or.kr/",
        note: "Search the Korean title on the site. Sad themes."
    },
    {
        id: "dongbaek",
        type: "Story",
        title: "Camellia Flowers",
        titleKo: "동백꽃",
        author: "Kim Yu-jeong (김유정)",
        genre: "Classic fiction",
        audience: "Teens & Adults",
        lang: "Korean",
        rights: "Public domain",
        summary: "A shy village boy gets pushed around by a bold neighbour girl in a short, funny country tale.",
        source: "공유마당 (Gongu Madang)",
        url: "https://gongu.copyright.or.kr/",
        note: "Search the Korean title on the site."
    },
    {
        id: "yeonsil",
        type: "Story",
        title: "The Story of Kim Yeon-sil",
        titleKo: "김연실전",
        author: "Kim Dong-in (김동인)",
        genre: "Classic fiction",
        audience: "Adults",
        lang: "Korean",
        rights: "Public domain",
        summary: "Looks behind the public image of well-known women in early modern Korea.",
        source: "Ridibooks (free public-domain book)",
        url: "https://ridibooks.com/books/111000144",
        note: "Ridibooks may ask you to log in."
    },
    {
        id: "wongoryo",
        type: "Story",
        title: "Two Hundred Won for the Manuscript",
        titleKo: "원고료 이백 원",
        author: "Kang Gyeong-ae (강경애)",
        genre: "Classic fiction",
        audience: "Adults",
        lang: "Korean",
        rights: "Public domain",
        summary: "A letter from an older sister to her younger sibling about the path an educated woman should take.",
        source: "Ridibooks (free public-domain book)",
        url: "https://ridibooks.com/books/111000159",
        note: "Ridibooks may ask you to log in."
    },

    /* ---------- Korean tales in English (public domain) ---------- */

    {
        id: "imps",
        type: "Story",
        title: "Korean Folk Tales: Imps, Ghosts and Fairies",
        author: "Translated by James Scarth Gale",
        genre: "Folklore",
        audience: "Teens & Adults",
        lang: "English",
        rights: "Public domain",
        summary: "Old Korean stories of imps, ghosts and fairies, translated into English.",
        source: "Project Gutenberg",
        url: "https://www.gutenberg.org/ebooks/51002"
    },
    {
        id: "kt",
        type: "Story",
        title: "Korean Tales",
        author: "Horace Newton Allen",
        genre: "Folklore",
        audience: "Teens & Adults",
        lang: "English",
        rights: "Public domain",
        summary: "Folk tales from all over Korea, translated into English, with notes on Korean life.",
        source: "Project Gutenberg",
        url: "https://www.gutenberg.org/ebooks/55539"
    },

    /* ---------- Manga and webtoons (official free readers) ---------- */

    {
        id: "mangaplus",
        type: "Manga",
        title: "MANGA Plus by Shueisha",
        author: "Shueisha (publisher)",
        genre: "Manga library",
        audience: "Teens & Adults",
        lang: "English",
        rights: "Official free reader",
        summary: "The publisher's own free reader. First and newest chapters are free, and ongoing series can be read once for free.",
        source: "MANGA Plus",
        url: "https://mangaplus.shueisha.co.jp",
        note: "Not available in Japan, China or Korea."
    },
    {
        id: "webtoon",
        type: "Manga",
        title: "WEBTOON",
        author: "Many creators",
        genre: "Webtoons",
        audience: "Teens & Adults",
        lang: "English",
        rights: "Official free reader",
        summary: "An official site and app with free chapters that change over time, including many Korean webtoons.",
        source: "WEBTOON",
        url: "https://www.webtoons.com",
        note: "Some series are for mature readers."
    },
    {
        id: "spyfamily",
        type: "Manga",
        title: "SPY x FAMILY",
        author: "Tatsuya Endo",
        genre: "Comedy",
        audience: "Teens & Adults",
        lang: "English",
        rights: "Official free reader",
        summary: "A spy, an assassin and a girl who can read minds pretend to be an ordinary family.",
        source: "MANGA Plus",
        url: "https://mangaplus.shueisha.co.jp",
        note: "Search the title on MANGA Plus."
    },
    {
        id: "jjk",
        type: "Manga",
        title: "Jujutsu Kaisen",
        author: "Gege Akutami",
        genre: "Action",
        audience: "Teens & Adults",
        lang: "English",
        rights: "Official free reader",
        summary: "A student swallows a cursed object and joins a school for sorcerers who fight curses.",
        source: "MANGA Plus",
        url: "https://mangaplus.shueisha.co.jp",
        note: "Violence. Search the title on MANGA Plus."
    },
    {
        id: "chainsaw",
        type: "Manga",
        title: "Chainsaw Man",
        author: "Tatsuki Fujimoto",
        genre: "Action",
        audience: "Adults",
        lang: "English",
        rights: "Official free reader",
        summary: "A broke young man merges with his devil dog and hunts devils for a living.",
        source: "MANGA Plus",
        url: "https://mangaplus.shueisha.co.jp",
        note: "Mature readers: strong violence. Search the title on MANGA Plus."
    }
];


/* ---------------------------------------------------------- */

var COLORS = ["#4b4fe0", "#2d3099", "#7a4fd6", "#1c8fd6", "#d6336c", "#e08a00"];
var SAVE_KEY = "chathub-saved-stories";

var grid = document.getElementById("stories");
var search = document.getElementById("story-search");
var tabBox = document.getElementById("tabs");
var audienceBox = document.getElementById("audience-chips");
var genreBox = document.getElementById("chips");
var savedBtn = document.getElementById("saved-toggle");

var activeType = "All";
var activeAudience = "All";
var activeGenre = "All";
var onlySaved = false;
var saved = loadSaved();


function loadSaved() {
    try {
        return JSON.parse(localStorage.getItem(SAVE_KEY)) || [];
    } catch (e) {
        return [];
    }
}

function storeSaved() {
    try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(saved));
    } catch (e) {
        /* storage blocked: saves last until the page closes */
    }
}

function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
}

function heartIcon() {
    var wrap = document.createElement("span");
    wrap.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/></svg>';
    return wrap.firstChild;
}

function matchesAudience(item) {
    if (activeAudience === "All") return true;
    if (activeAudience === "Teens") return item.audience === "Teens" || item.audience === "Teens & Adults";
    return item.audience === "Adults" || item.audience === "Teens & Adults";
}

function makeButtons(box, values, current, onPick, className) {
    box.innerHTML = "";
    values.forEach(function (value) {
        var b = el("button", className, value);
        b.type = "button";
        b.setAttribute("aria-pressed", value === current ? "true" : "false");
        b.addEventListener("click", function () {
            onPick(value);
        });
        box.appendChild(b);
    });
}


/* ---------- Controls ---------- */

function buildControls() {
    makeButtons(tabBox, ["All", "Story", "Manga"], activeType, function (v) {
        activeType = v;
        activeGenre = "All";
        buildControls();
        render();
    }, "tab");

    // tab labels read nicer in plural
    var labels = { All: "All", Story: "Stories", Manga: "Manga" };
    Array.prototype.forEach.call(tabBox.children, function (b, i) {
        b.textContent = labels[["All", "Story", "Manga"][i]];
    });

    makeButtons(audienceBox, ["All", "Teens", "Adults"], activeAudience, function (v) {
        activeAudience = v;
        buildControls();
        render();
    }, "chip");

    var genres = ["All"];
    ITEMS.forEach(function (s) {
        var inType = activeType === "All" || s.type === activeType;
        if (inType && genres.indexOf(s.genre) === -1) genres.push(s.genre);
    });
    makeButtons(genreBox, genres, activeGenre, function (v) {
        activeGenre = v;
        buildControls();
        render();
    }, "chip");
}


/* ---------- Cards ---------- */

function makeCard(item, index) {
    var card = el("article", "story");

    var cover = el("div", "cover");
    if (item.cover) {
        cover.style.backgroundImage = "url('" + item.cover.replace(/'/g, "%27") + "')";
    } else {
        cover.classList.add("no-image");
        cover.style.backgroundColor = COLORS[index % COLORS.length];
        var text = el("div", "cover-text");
        text.appendChild(el("span", "cover-title", item.title));
        if (item.titleKo) text.appendChild(el("span", "cover-ko", item.titleKo));
        cover.appendChild(text);
    }

    var isSaved = saved.indexOf(item.id) !== -1;
    var heart = el("button", "heart");
    heart.type = "button";
    heart.setAttribute("aria-pressed", isSaved ? "true" : "false");
    heart.setAttribute("aria-label", "Save " + item.title);
    heart.appendChild(heartIcon());
    heart.addEventListener("click", function () {
        var i = saved.indexOf(item.id);
        if (i === -1) saved.push(item.id);
        else saved.splice(i, 1);
        storeSaved();
        render();
    });
    cover.appendChild(heart);

    var body = el("div", "story-body");
    body.appendChild(el("div", "story-meta", item.author + " · " + item.genre));

    var badges = el("div", "badges");
    badges.appendChild(el("span", "badge", item.audience));
    badges.appendChild(el("span", "badge plain", item.lang));
    badges.appendChild(el("span", "badge plain", item.rights));
    body.appendChild(badges);

    body.appendChild(el("p", "story-summary", item.summary));
    if (item.note) body.appendChild(el("p", "story-note", item.note));
    body.appendChild(el("span", "story-source", "Source: " + item.source));

    var read = el("a", "read-btn", item.type === "Manga" ? "Open reader" : "Read story");
    read.href = item.url;
    read.target = "_blank";
    read.rel = "noopener noreferrer";
    body.appendChild(read);

    card.appendChild(cover);
    card.appendChild(body);
    return card;
}


/* ---------- Render ---------- */

function render() {
    var q = search.value.trim().toLowerCase();

    var list = ITEMS.filter(function (s) {
        var okType = activeType === "All" || s.type === activeType;
        var okGenre = activeGenre === "All" || s.genre === activeGenre;
        var okText = !q || (s.title + " " + (s.titleKo || "") + " " + s.author).toLowerCase().indexOf(q) !== -1;
        var okSaved = !onlySaved || saved.indexOf(s.id) !== -1;
        return okType && okGenre && okText && okSaved && matchesAudience(s);
    });

    grid.innerHTML = "";

    if (!list.length) {
        var message = onlySaved && !q && activeType === "All" && activeGenre === "All" && activeAudience === "All"
            ? "You have not saved anything yet. Tap the heart on a card to keep it here."
            : "Nothing matches that.";
        grid.appendChild(el("p", "empty", message));
        return;
    }

    list.forEach(function (item) {
        grid.appendChild(makeCard(item, ITEMS.indexOf(item)));
    });
}

search.addEventListener("input", render);

savedBtn.addEventListener("click", function () {
    onlySaved = !onlySaved;
    savedBtn.setAttribute("aria-pressed", onlySaved ? "true" : "false");
    render();
});

buildControls();
render();
