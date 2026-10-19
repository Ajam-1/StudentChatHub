
/* ==========================================================
   PEERVA STORYBOOK + MANGA LIBRARY
   Features:
   - Stories and Manga filters
   - Audience and genre filters
   - Search inside Peerva
   - External book search for titles not in Peerva
   - Saved titles
   - Official source links
   ========================================================== */

var ITEMS = [
    /* ---------- Public-domain English books ---------- */
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
        id: "alice",
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
        id: "sherlock",
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
        note: "Dark themes and frightening scenes."
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
        summary: "Dorothy and her companions travel through Oz hoping to find what each of them needs.",
        source: "Project Gutenberg",
        url: "https://www.gutenberg.org/ebooks/55"
    },
    {
        id: "dracula",
        type: "Story",
        title: "Dracula",
        author: "Bram Stoker",
        genre: "Horror",
        audience: "Adults",
        lang: "English",
        rights: "Public domain",
        summary: "A group of people confronts the terrifying Count Dracula and his supernatural powers.",
        source: "Project Gutenberg",
        url: "https://www.gutenberg.org/ebooks/345"
    },
    {
        id: "jane-eyre",
        type: "Story",
        title: "Jane Eyre",
        author: "Charlotte Brontë",
        genre: "Romance",
        audience: "Teens & Adults",
        lang: "English",
        rights: "Public domain",
        summary: "An independent young woman becomes a governess and discovers secrets at Thornfield Hall.",
        source: "Project Gutenberg",
        url: "https://www.gutenberg.org/ebooks/1260"
    },
    {
        id: "little-women",
        type: "Story",
        title: "Little Women",
        author: "Louisa May Alcott",
        genre: "Family",
        audience: "Teens",
        lang: "English",
        rights: "Public domain",
        summary: "The March sisters grow up, pursue their dreams and navigate love, hardship and family life.",
        source: "Project Gutenberg",
        url: "https://www.gutenberg.org/ebooks/514"
    },
    {
        id: "secret-garden",
        type: "Story",
        title: "The Secret Garden",
        author: "Frances Hodgson Burnett",
        genre: "Adventure",
        audience: "Teens",
        lang: "English",
        rights: "Public domain",
        summary: "A lonely girl discovers a hidden garden that changes the lives of everyone around her.",
        source: "Project Gutenberg",
        url: "https://www.gutenberg.org/ebooks/113"
    },
    {
        id: "treasure-island",
        type: "Story",
        title: "Treasure Island",
        author: "Robert Louis Stevenson",
        genre: "Adventure",
        audience: "Teens",
        lang: "English",
        rights: "Public domain",
        summary: "A young boy joins a dangerous voyage in search of buried pirate treasure.",
        source: "Project Gutenberg",
        url: "https://www.gutenberg.org/ebooks/120"
    },

    /* ---------- English web novels ---------- */
    {
        id: "bedreads-bride",
        type: "Story",
        title: "The Bride He Never Chose",
        author: "ao3_refugee",
        genre: "Billionaire Romance",
        audience: "Adults",
        lang: "English",
        rights: "Official reader",
        summary: "A marriage begins with suspicion and secrets when a woman takes her cousin's place.",
        source: "BedReads",
        url: "https://www.bedreads.net/r/the-bride-he-never-chose-b26e1ff9-e7df-4d8f-bbc7-3252287ab960",
        note: "Mature romance themes. Check the reading options on the source site."
    },
    {
        id: "bedreads-bought",
        type: "Story",
        title: "Bought by the Billionaire",
        author: "plot_hole_patcher",
        genre: "Billionaire Romance",
        audience: "Adults",
        lang: "English",
        rights: "Official reader",
        summary: "A business arrangement develops into a complicated relationship full of secrets.",
        source: "BedReads",
        url: "https://www.bedreads.net/r/bought-by-the-billionaire-7a65c9d5-1601-41b7-bf73-693849787bdb",
        note: "Mature romance themes."
    },
    {
        id: "bedreads-voiceless",
        type: "Story",
        title: "The Voiceless Bride He Waited For",
        author: "wip_whisperer",
        genre: "Billionaire Romance",
        audience: "Adults",
        lang: "English",
        rights: "Official reader",
        summary: "A hidden identity connects a woman with a billionaire searching for someone from his past.",
        source: "BedReads",
        url: "https://www.bedreads.net/r/the-voiceless-bride-he-waited-for-18902e00-adb0-478d-a18f-d55523c09ee5",
        note: "Mature romance themes."
    },
    {
        id: "bedreads-reborn",
        type: "Story",
        title: "Reborn to Save the Husband I Buried",
        author: "plot_hole_patcher",
        genre: "Romance Fantasy",
        audience: "Adults",
        lang: "English",
        rights: "Official reader",
        summary: "A woman gets another chance to change her past and save the husband she lost.",
        source: "BedReads",
        url: "https://www.bedreads.net/r/reborn-to-save-the-husband-i-buried-45c1fb4e-acfa-4767-903f-024b339c9810",
        note: "Grief and mature romance themes."
    },
    {
        id: "bedreads-wrong-woman",
        type: "Story",
        title: "He Kidnapped the Wrong Woman to Wed",
        author: "tbr_mountaineer",
        genre: "Billionaire Romance",
        audience: "Adults",
        lang: "English",
        rights: "Official reader",
        summary: "An unexpected marriage challenges a billionaire's assumptions about the woman he has chosen.",
        source: "BedReads",
        url: "https://www.bedreads.net/r/he-kidnapped-the-wrong-woman-to-wed-cd9b6c6b-275c-41a9-a9ef-ab95da1c8377",
        note: "Mature romance themes."
    },
    {
        id: "bedreads-romance",
        type: "Story",
        title: "More Billionaire Romance Novels",
        author: "Various authors",
        genre: "Billionaire Romance",
        audience: "Adults",
        lang: "English",
        rights: "Official reader",
        summary: "Discover romance novels featuring wealthy characters, secret marriages and complicated relationships.",
        source: "BedReads",
        url: "https://www.bedreads.net/",
        note: "Browse the source for available titles and reading options."
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
        rights: "Official reader",
        summary: "An empress plans a new future after her husband asks for a divorce.",
        source: "WEBTOON",
        url: "https://www.webtoons.com/en/fantasy/the-remarried-empress/list?title_no=2135"
    },
    {
        id: "maybe-meant",
        type: "Manga",
        title: "Maybe Meant to Be",
        author: "honeyskein and damcho",
        genre: "Romance",
        audience: "Teens & Adults",
        lang: "English",
        rights: "Official reader",
        summary: "Two childhood friends agree to marry and discover what their unexpected arrangement means.",
        source: "WEBTOON",
        url: "https://www.webtoons.com/en/romance/maybe-meant-to-be/list?title_no=4208"
    },
    {
        id: "estate-developer",
        type: "Manga",
        title: "The Greatest Estate Developer",
        author: "BK_Moon, Lee Hyun Min and Kim Hyunsoo",
        genre: "Fantasy",
        audience: "Teens & Adults",
        lang: "English",
        rights: "Official reader",
        summary: "An engineering student uses his knowledge to transform a struggling noble family's fortunes.",
        source: "WEBTOON",
        url: "https://www.webtoons.com/en/fantasy/the-greatest-estate-developer/list?title_no=3596"
    },
    {
        id: "webtoon-library",
        type: "Manga",
        title: "Explore WEBTOON",
        author: "Various creators",
        genre: "Webtoons",
        audience: "Teens & Adults",
        lang: "English",
        rights: "Official reader",
        summary: "Discover romance, fantasy, drama, action and comedy comics from many creators.",
        source: "WEBTOON",
        url: "https://www.webtoons.com/en/"
    },
    {
        id: "mangaplus",
        type: "Manga",
        title: "MANGA Plus by Shueisha",
        author: "Various creators",
        genre: "Manga Library",
        audience: "Teens & Adults",
        lang: "English",
        rights: "Official reader",
        summary: "Browse officially published manga and check which chapters are available to read.",
        source: "MANGA Plus",
        url: "https://mangaplus.shueisha.co.jp/"
    },
    {
        id: "spy-family",
        type: "Manga",
        title: "SPY x FAMILY",
        author: "Tatsuya Endo",
        genre: "Comedy",
        audience: "Teens & Adults",
        lang: "English",
        rights: "Official reader",
        summary: "A spy creates a fake family for a mission, unaware that his wife and daughter have secrets of their own.",
        source: "MANGA Plus",
        url: "https://mangaplus.shueisha.co.jp/"
    },
    {
        id: "jujutsu-kaisen",
        type: "Manga",
        title: "Jujutsu Kaisen",
        author: "Gege Akutami",
        genre: "Action",
        audience: "Adults",
        lang: "English",
        rights: "Official reader",
        summary: "A student enters the dangerous world of curses and sorcerers.",
        source: "MANGA Plus",
        url: "https://mangaplus.shueisha.co.jp/",
        note: "Contains supernatural violence."
    },
    {
        id: "chainsaw-man",
        type: "Manga",
        title: "Chainsaw Man",
        author: "Tatsuki Fujimoto",
        genre: "Action",
        audience: "Adults",
        lang: "English",
        rights: "Official reader",
        summary: "A young devil hunter gains terrifying new powers and becomes involved in dangerous battles.",
        source: "MANGA Plus",
        url: "https://mangaplus.shueisha.co.jp/",
        note: "Strong violence and mature themes."
    }
];


/* ---------- Styling helpers ---------- */

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
    var externalSearchId = 0;
    var externalTimer = null;

    function loadSaved() {
        try {
            return JSON.parse(localStorage.getItem(SAVE_KEY)) || [];
        } catch (error) {
            return [];
        }
    }

    function storeSaved() {
        try {
            localStorage.setItem(SAVE_KEY, JSON.stringify(saved));
        } catch (error) {
            // The library still works if browser storage is unavailable.
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

    /* ---------- Filters ---------- */

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
            var typeMatches =
                activeType === "All" || item.type === activeType;

            if (typeMatches && genres.indexOf(item.genre) === -1) {
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

    /* ---------- Existing library cards ---------- */

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

        var heart = el("button", "heart");
        var isSaved = saved.indexOf(item.id) !== -1;

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

    /* ---------- External search result cards ---------- */

    function makeExternalCard(item) {
        var card = el("article", "story");
        var cover = el("div", "cover no-image");

        cover.style.backgroundColor = "#6251a8";

        var coverText = el("div", "cover-text");
        coverText.appendChild(
            el("span", "cover-title", item.title)
        );

        cover.appendChild(coverText);

        var body = el("div", "story-body");

        body.appendChild(
            el("div", "story-meta", item.author || "Author unknown")
        );

        var badges = el("div", "badges");
        badges.appendChild(
            el("span", "badge plain", item.source)
        );

        body.appendChild(badges);

        body.appendChild(
            el("p", "story-summary", item.description)
        );

        body.appendChild(
            el("span", "story-source", "External catalogue: " + item.source)
        );

        var link = el("a", "read-btn", item.button || "View book");

        link.href = item.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";

        body.appendChild(link);
        card.appendChild(cover);
        card.appendChild(body);

        return card;
    }

    function addPlatformSearch(query, name, domain) {
        var card = el("article", "story");
        var body = el("div", "story-body");

        body.appendChild(
            el("div", "story-meta", name)
        );

        body.appendChild(
            el("p", "story-summary",
                'Search "' + query + '" on ' + name + "."
            )
        );

        var link = el("a", "read-btn", "Search " + name);

        link.href =
            "https://www.google.com/search?q=" +
            encodeURIComponent("site:" + domain + " " + query);

        link.target = "_blank";
        link.rel = "noopener noreferrer";

        body.appendChild(link);
        card.appendChild(body);

        return card;
    }

    async function searchExternalBooks(query, requestId) {
        var endpoints = [
            {
                source: "Google Books",
                url: "https://www.googleapis.com/books/v1/volumes?q=" +
                    encodeURIComponent(query) +
                    "&maxResults=8&printType=books"
            },
            {
                source: "Open Library",
                url: "https://openlibrary.org/search.json?q=" +
                    encodeURIComponent(query) +
                    "&fields=key,title,author_name,first_publish_year" +
                    "&limit=8&lang=en"
            }
        ];

        var responses = await Promise.allSettled(
            endpoints.map(function (endpoint) {
                return fetch(endpoint.url).then(function (response) {
                    if (!response.ok) {
                        throw new Error("Catalogue request failed");
                    }

                    return response.json();
                });
            })
        );

        if (requestId !== externalSearchId) return;

        var results = [];
        var seen = new Set();

        responses.forEach(function (response, index) {
            if (response.status !== "fulfilled") return;

            var data = response.value;

            if (index === 0) {
                (data.items || []).forEach(function (book) {
                    var info = book.volumeInfo || {};

                    if (!info.title) return;

                    var key = info.title.toLowerCase();

                    if (seen.has(key)) return;
                    seen.add(key);

                    results.push({
                        title: info.title,
                        author: (info.authors || ["Author unknown"]).join(", "),
                        description: info.description ||
                            "Book catalogue entry. Check the source for reading availability.",
                        source: "Google Books",
                        url: info.infoLink || "https://books.google.com/",
                        button: "View book details"
                    });
                });
            } else {
                (data.docs || []).forEach(function (book) {
                    if (!book.title || !book.key) return;

                    var key = book.title.toLowerCase();

                    if (seen.has(key)) return;
                    seen.add(key);

                    results.push({
                        title: book.title,
                        author: (book.author_name || ["Author unknown"]).join(", "),
                        description: "Book listing" +
                            (book.first_publish_year
                                ? " · First published " + book.first_publish_year
                                : "") +
                            ". Check whether a readable edition is available.",
                        source: "Open Library",
                        url: "https://openlibrary.org" + book.key,
                        button: "View book listing"
                    });
                });
            }
        });

        if (requestId !== externalSearchId) return;

        var heading = el(
            "p",
            "empty",
            results.length
                ? "More results from external book catalogues"
                : "No book results found in the connected catalogues."
        );

        grid.appendChild(heading);

        results.forEach(function (item) {
            grid.appendChild(makeExternalCard(item));
        });

        grid.appendChild(
            addPlatformSearch(query, "WEBTOON", "webtoons.com")
        );

        grid.appendChild(
            addPlatformSearch(query, "MANGA Plus", "mangaplus.shueisha.co.jp")
        );

        grid.appendChild(
            addPlatformSearch(query, "BedReads", "bedreads.net")
        );

        grid.appendChild(
            addPlatformSearch(query, "Wattpad", "wattpad.com")
        );
    }

    /* ---------- Render and search ---------- */

    async function render() {
        var requestId = ++externalSearchId;
        var query = search.value.trim();

        if (externalTimer) {
            clearTimeout(externalTimer);
            externalTimer = null;
        }

        grid.innerHTML = "";

        var lowerQuery = query.toLowerCase();

        var list = ITEMS.filter(function (item) {
            var typeMatches =
                activeType === "All" || item.type === activeType;

            var genreMatches =
                activeGenre === "All" || item.genre === activeGenre;

            var searchableText = (
                item.title + " " +
                (item.titleKo || "") + " " +
                item.author + " " +
                item.genre + " " +
                item.summary
            ).toLowerCase();

            var textMatches =
                !lowerQuery ||
                searchableText.indexOf(lowerQuery) !== -1;

            var savedMatches =
                !onlySaved || saved.indexOf(item.id) !== -1;

            return typeMatches &&
                genreMatches &&
                textMatches &&
                savedMatches &&
                matchesAudience(item);
        });

        list.forEach(function (item) {
            grid.appendChild(
                makeCard(item, ITEMS.indexOf(item))
            );
        });

        if (onlySaved) {
            if (!list.length) {
                grid.appendChild(
                    el("p", "empty", "You have not saved any matching titles.")
                );
            }
            return;
        }

        if (query.length < 3) {
            if (!list.length) {
                grid.appendChild(
                    el("p", "empty", "Type at least 3 characters to search.")
                );
            }
            return;
        }

        var status = el(
            "p",
            "empty",
            "Searching external book catalogues..."
        );

        grid.appendChild(status);

        externalTimer = setTimeout(async function () {
            try {
                await searchExternalBooks(query, requestId);
            } catch (error) {
                if (requestId !== externalSearchId) return;

                grid.appendChild(
                    el(
                        "p",
                        "empty",
                        "External search is unavailable right now. Try again later."
                    )
                );

                grid.appendChild(
                    addPlatformSearch(query, "WEBTOON", "webtoons.com")
                );

                grid.appendChild(
                    addPlatformSearch(query, "MANGA Plus", "mangaplus.shueisha.co.jp")
                );

                grid.appendChild(
                    addPlatformSearch(query, "BedReads", "bedreads.net")
                );
            } finally {
                if (requestId === externalSearchId && status.parentNode) {
                    status.remove();
                }
            }
        }, 350);
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
        "Peerva library could not start. Check that these HTML IDs exist: " +
        "#stories, #story-search, #tabs, #audience-chips, #chips, #saved-toggle."
    );
}
