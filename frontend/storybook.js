
/* storybook.js
   Peerva Storybook + Manga Library
   Real titles from public-domain collections and official reading platforms.
   This catalogue links to the source; it does not copy chapters or manga pages.
*/

var ITEMS = [
    /* ---------- English public-domain books ---------- */
    {
        id: "pride-prejudice",
        type: "Story",
        title: "Pride and Prejudice",
        author: "Jane Austen",
        genre: "Romance",
        audience: "Teens & Adults",
        lang: "English",
        rights: "Public domain",
        summary: "Elizabeth Bennet navigates love, family expectations and her complicated first impressions of Mr Darcy.",
        source: "Project Gutenberg",
        url: "https://www.gutenberg.org/ebooks/1342"
    },
    {
        id: "alice-wonderland",
        type: "Story",
        title: "Alice's Adventures in Wonderland",
        author: "Lewis Carroll",
        genre: "Fantasy",
        audience: "Teens",
        lang: "English",
        rights: "Public domain",
        summary: "Alice follows a rabbit into a strange world filled with curious characters and impossible adventures.",
        source: "Project Gutenberg",
        url: "https://www.gutenberg.org/ebooks/11"
    },
    {
        id: "sherlock-holmes",
        type: "Story",
        title: "The Adventures of Sherlock Holmes",
        author: "Arthur Conan Doyle",
        genre: "Mystery",
        audience: "Teens & Adults",
        lang: "English",
        rights: "Public domain",
        summary: "Sherlock Holmes and Dr Watson solve unusual mysteries through observation and deduction.",
        source: "Project Gutenberg",
        url: "https://www.gutenberg.org/ebooks/1661"
    },
    {
        id: "frankenstein",
        type: "Story",
        title: "Frankenstein",
        author: "Mary Shelley",
        genre: "Fantasy",
        audience: "Teens & Adults",
        lang: "English",
        rights: "Public domain",
        summary: "A scientist's experiment creates a being whose search for companionship leads to tragedy.",
        source: "Project Gutenberg",
        url: "https://www.gutenberg.org/ebooks/84",
        note: "Contains dark themes and frightening scenes."
    },
    {
        id: "wizard-oz",
        type: "Story",
        title: "The Wonderful Wizard of Oz",
        author: "L. Frank Baum",
        genre: "Fantasy",
        audience: "Teens",
        lang: "English",
        rights: "Public domain",
        summary: "Dorothy and her unusual companions travel through Oz hoping to find what each of them needs.",
        source: "Project Gutenberg",
        url: "https://www.gutenberg.org/ebooks/55"
    },

    /* ---------- English romance and web novels ---------- */
    {
        id: "bride-never-chose",
        type: "Story",
        title: "The Bride He Never Chose",
        author: "ao3_refugee",
        genre: "Billionaire Romance",
        audience: "Adults",
        lang: "English",
        rights: "Official free reader",
        summary: "A woman is forced to marry a billionaire in her cousin's place, and the marriage begins with suspicion and secrets.",
        source: "BedReads",
        url: "https://www.bedreads.net/r/the-bride-he-never-chose-b26e1ff9-e7df-4d8f-bbc7-3252287ab960",
        note: "Romance with mature themes. First four chapters free online."
    },
    {
        id: "bought-billionaire",
        type: "Story",
        title: "Bought by the Billionaire",
        author: "plot_hole_patcher",
        genre: "Billionaire Romance",
        audience: "Adults",
        lang: "English",
        rights: "Official free reader",
        summary: "A marriage made for business turns into a difficult relationship filled with secrets and conflict.",
        source: "BedReads",
        url: "https://www.bedreads.net/r/bought-by-the-billionaire-7a65c9d5-1601-41b7-bf73-693849787bdb",
        note: "Mature romance themes. First four chapters free online."
    },
    {
        id: "voiceless-bride",
        type: "Story",
        title: "The Voiceless Bride He Waited For",
        author: "wip_whisperer",
        genre: "Billionaire Romance",
        audience: "Adults",
        lang: "English",
        rights: "Official free reader",
        summary: "A hidden identity and a long-lost love connect a silent woman with a billionaire searching for someone from his past.",
        source: "BedReads",
        url: "https://www.bedreads.net/r/the-voiceless-bride-he-waited-for-18902e00-adb0-478d-a18f-d55523c09ee5",
        note: "Mature romance themes. First four chapters free online."
    },
    {
        id: "reborn-save-husband",
        type: "Story",
        title: "Reborn to Save the Husband I Buried",
        author: "plot_hole_patcher",
        genre: "Romance Fantasy",
        audience: "Adults",
        lang: "English",
        rights: "Official free reader",
        summary: "After a tragic ending, a woman gets another chance to change her past and save the husband she once lost.",
        source: "BedReads",
        url: "https://www.bedreads.net/r/reborn-to-save-the-husband-i-buried-45c1fb4e-acfa-4767-903f-024b339c9810",
        note: "Contains grief and mature romance themes. First four chapters free online."
    },
    {
        id: "wrong-woman-wed",
        type: "Story",
        title: "He Kidnapped the Wrong Woman to Wed",
        author: "tbr_mountaineer",
        genre: "Billionaire Romance",
        audience: "Adults",
        lang: "English",
        rights: "Official free reader",
        summary: "A billionaire marries the wrong woman, whose hidden talents and secrets challenge his assumptions about her.",
        source: "BedReads",
        url: "https://www.bedreads.net/r/he-kidnapped-the-wrong-woman-to-wed-cd9b6c6b-275c-41a9-a9ef-ab95da1c8377",
        note: "Mature romance themes. First four chapters free online."
    },
    {
        id: "bedreads-billionaire",
        type: "Story",
        title: "More Billionaire Romance Novels",
        author: "Various authors",
        genre: "Billionaire Romance",
        audience: "Adults",
        lang: "English",
        rights: "Official free reader",
        summary: "Browse more stories about billionaires, secret marriages, unexpected relationships and family drama.",
        source: "BedReads",
        url: "https://www.bedreads.net/",
        note: "Choose a title on BedReads. Free online previews; full reading may require its app."
    },
    {
        id: "bedreads-fantasy",
        type: "Story",
        title: "More Fantasy Web Novels",
        author: "Various authors",
        genre: "Fantasy",
        audience: "Teens & Adults",
        lang: "English",
        rights: "Official free reader",
        summary: "Explore fantasy stories featuring reincarnation, magical worlds, royalty and second chances.",
        source: "BedReads",
        url: "https://www.bedreads.net/genre/fantasy",
        note: "Check each title's content rating before reading."
    },

    /* ---------- Official English webtoons ---------- */
    {
        id: "remarried-empress",
        type: "Manga",
        title: "The Remarried Empress",
        author: "Alphatart, HereLee and SUMPUL",
        genre: "Romance Fantasy",
        audience: "Adults",
        lang: "English",
        rights: "Official free reader",
        summary: "After her husband demands a divorce, an empress decides to build a new future on her own terms.",
        source: "WEBTOON",
        url: "https://www.webtoons.com/en/fantasy/the-remarried-empress/list?title_no=2135",
        note: "Check the platform's age rating and episode access."
    },
    {
        id: "maybe-meant-be",
        type: "Manga",
        title: "Maybe Meant to Be",
        author: "honeyskein and damcho",
        genre: "Romance",
        audience: "Teens & Adults",
        lang: "English",
        rights: "Official free reader",
        summary: "Two childhood friends agree to marry after growing tired of family pressure, and discover what their agreement means.",
        source: "WEBTOON",
        url: "https://www.webtoons.com/en/romance/maybe-meant-to-be/list?title_no=4208",
        note: "Episode access may vary."
    },
    {
        id: "greatest-estate",
        type: "Manga",
        title: "The Greatest Estate Developer",
        author: "BK_Moon, Lee Hyun Min and Kim Hyunsoo",
        genre: "Fantasy",
        audience: "Teens & Adults",
        lang: "English",
        rights: "Official free reader",
        summary: "A civil engineering student wakes up as a noble in a fantasy novel and uses his knowledge to save a debt-ridden family.",
        source: "WEBTOON",
        url: "https://www.webtoons.com/en/fantasy/the-greatest-estate-developer/list?title_no=3596",
        note: "Episode access may vary."
    },
    {
        id: "webtoon-romance",
        type: "Manga",
        title: "Discover Romance Webtoons",
        author: "Various creators",
        genre: "Romance",
        audience: "Teens & Adults",
        lang: "English",
        rights: "Official free reader",
        summary: "Find more romance comics, relationship stories and romantic dramas from different creators.",
        source: "WEBTOON",
        url: "https://www.webtoons.com/en/",
        note: "Search the site and check each series' age rating."
    },

    /* ---------- Official manga reader ---------- */
    {
        id: "mangaplus",
        type: "Manga",
        title: "MANGA Plus by Shueisha",
        author: "Various creators",
        genre: "Manga Library",
        audience: "Teens & Adults",
        lang: "English",
        rights: "Official free reader",
        summary: "Read officially published manga series in English. Available chapters and free-reading rules vary by series.",
        source: "MANGA Plus",
        url: "https://mangaplus.shueisha.co.jp/",
        note: "Check chapter availability in your region."
    },
    {
        id: "spy-family",
        type: "Manga",
        title: "SPY x FAMILY",
        author: "Tatsuya Endo",
        genre: "Comedy",
        audience: "Teens & Adults",
        lang: "English",
        rights: "Official publisher reader",
        summary: "A spy creates a fake family for a mission, unaware that his new wife and daughter each have secrets of their own.",
        source: "MANGA Plus",
        url: "https://mangaplus.shueisha.co.jp/",
        note: "Search the title in the official reader."
    },
    {
        id: "jujutsu-kaisen",
        type: "Manga",
        title: "Jujutsu Kaisen",
        author: "Gege Akutami",
        genre: "Action",
        audience: "Adults",
        lang: "English",
        rights: "Official publisher reader",
        summary: "A student enters the dangerous world of curses and sorcerers after swallowing a cursed object.",
        source: "MANGA Plus",
        url: "https://mangaplus.shueisha.co.jp/",
        note: "Contains intense supernatural violence. Search the title in the official reader."
    },
    {
        id: "chainsaw-man",
        type: "Manga",
        title: "Chainsaw Man",
        author: "Tatsuki Fujimoto",
        genre: "Action",
        audience: "Adults",
        lang: "English",
        rights: "Official publisher reader",
        summary: "A young devil hunter gains a terrifying new power and becomes involved in dangerous battles.",
        source: "MANGA Plus",
        url: "https://mangaplus.shueisha.co.jp/",
        note: "Strong violence and mature themes. Search the title in the official reader."
    }
];


/* ---------- Library setup ---------- */

var COLORS = [
    "#4b4fe0",
    "#2d3099",
    "#7a4fd6",
    "#1c8fd6",
    "#d6336c",
    "#e08a00"
];

var SAVE_KEY = "peerva-saved-stories";

var grid = document.getElementById("stories");
var search = document.getElementById("story-search");
var tabBox = document.getElementById("tabs");
var audienceBox = document.getElementById("audience-chips");
var genreBox = document.getElementById("chips");
var savedBtn = document.getElementById("saved-toggle");

if (grid && search && tabBox && audienceBox && genreBox && savedBtn) {
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
            // Saving may be unavailable in private browsing.
        }
    }

    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined && text !== null) {
            node.textContent = text;
        }
        return node;
    }

    function heartIcon() {
        var wrap = document.createElement("span");
        wrap.innerHTML =
            '<svg viewBox="0 0 24 24" aria-hidden="true">' +
            '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/>' +
            '</svg>';
        return wrap.firstChild;
    }

    function matchesAudience(item) {
        if (activeAudience === "All") return true;

        if (activeAudience === "Teens") {
            return item.audience === "Teens" ||
                item.audience === "Teens & Adults";
        }

        return item.audience === "Adults" ||
            item.audience === "Teens & Adults";
    }

    function makeButtons(box, values, current, onPick, className) {
        box.innerHTML = "";

        values.forEach(function (value) {
            var button = el("button", className, value);
            button.type = "button";
            button.setAttribute(
                "aria-pressed",
                value === current ? "true" : "false"
            );

            button.addEventListener("click", function () {
                onPick(value);
            });

            box.appendChild(button);
        });
    }

    /* ---------- Controls ---------- */

    function buildControls() {
        makeButtons(
            tabBox,
            ["All", "Story", "Manga"],
            activeType,
            function (value) {
                activeType = value;
                activeGenre = "All";
                buildControls();
                render();
            },
            "tab"
        );

        var labels = {
            All: "All",
            Story: "Stories",
            Manga: "Manga"
        };

        Array.prototype.forEach.call(tabBox.children, function (button, i) {
            button.textContent =
                labels[["All", "Story", "Manga"][i]];
        });

        makeButtons(
            audienceBox,
            ["All", "Teens", "Adults"],
            activeAudience,
            function (value) {
                activeAudience = value;
                buildControls();
                render();
            },
            "chip"
        );

        var genres = ["All"];

        ITEMS.forEach(function (item) {
            var inType =
                activeType === "All" || item.type === activeType;

            if (inType && genres.indexOf(item.genre) === -1) {
                genres.push(item.genre);
            }
        });

        makeButtons(
            genreBox,
            genres,
            activeGenre,
            function (value) {
                activeGenre = value;
                buildControls();
                render();
            },
            "chip"
        );
    }

    /* ---------- Cards ---------- */

    function makeCard(item, index) {
        var card = el("article", "story");
        var cover = el("div", "cover");

        if (item.cover) {
            cover.style.backgroundImage =
                "url('" + item.cover.replace(/'/g, "%27") + "')";
        } else {
            cover.classList.add("no-image");
            cover.style.backgroundColor =
                COLORS[index % COLORS.length];

            var coverText = el("div", "cover-text");
            coverText.appendChild(
                el("span", "cover-title", item.title)
            );

            if (item.titleKo) {
                coverText.appendChild(
                    el("span", "cover-ko", item.titleKo)
                );
            }

            cover.appendChild(coverText);
        }

        var isSaved = saved.indexOf(item.id) !== -1;
        var heart = el("button", "heart");

        heart.type = "button";
        heart.setAttribute(
            "aria-pressed",
            isSaved ? "true" : "false"
        );
        heart.setAttribute("aria-label", "Save " + item.title);
        heart.appendChild(heartIcon());

        heart.addEventListener("click", function () {
            var position = saved.indexOf(item.id);

            if (position === -1) {
                saved.push(item.id);
            } else {
                saved.splice(position, 1);
            }

            storeSaved();
            render();
        });

        cover.appendChild(heart);

        var body = el("div", "story-body");
        body.appendChild(
            el("div", "story-meta", item.author + " · " + item.genre)
        );

        var badges = el("div", "badges");
        badges.appendChild(el("span", "badge", item.audience));
        badges.appendChild(el("span", "badge plain", item.lang));
        badges.appendChild(el("span", "badge plain", item.rights));
        body.appendChild(badges);

        body.appendChild(
            el("p", "story-summary", item.summary)
        );

        if (item.note) {
            body.appendChild(
                el("p", "story-note", item.note)
            );
        }

        body.appendChild(
            el("span", "story-source", "Source: " + item.source)
        );

        var read = el(
            "a",
            "read-btn",
            item.type === "Manga" ? "Open reader" : "Read story"
        );

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
        var query = search.value.trim().toLowerCase();

        var list = ITEMS.filter(function (item) {
            var okType =
                activeType === "All" || item.type === activeType;

            var okGenre =
                activeGenre === "All" || item.genre === activeGenre;

            var searchableText = (
                item.title + " " +
                (item.titleKo || "") + " " +
                item.author + " " +
                item.genre + " " +
                item.summary
            ).toLowerCase();

            var okText =
                !query || searchableText.indexOf(query) !== -1;

            var okSaved =
                !onlySaved || saved.indexOf(item.id) !== -1;

            return okType &&
                okGenre &&
                okText &&
                okSaved &&
                matchesAudience(item);
        });

        grid.innerHTML = "";

        if (!list.length) {
            var message = onlySaved
                ? "No saved titles match your filters. Tap a heart on a card to save a title."
                : "Nothing matches that search. Try another title or genre.";

            grid.appendChild(el("p", "empty", message));
            return;
        }

        list.forEach(function (item) {
            grid.appendChild(
                makeCard(item, ITEMS.indexOf(item))
            );
        });
    }

    search.addEventListener("input", render);

    savedBtn.addEventListener("click", function () {
        onlySaved = !onlySaved;

        savedBtn.setAttribute(
            "aria-pressed",
            onlySaved ? "true" : "false"
        );

        render();
    });

    buildControls();
    render();
} else {
    console.error(
        "Peerva Library: One or more required HTML elements are missing. " +
        "Check #stories, #story-search, #tabs, #audience-chips, " +
        "#chips and #saved-toggle."
    );
}
