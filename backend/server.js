const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const webpush = require("web-push");

const app = express();

/* =========================================================
   PEERVA CONFIG
   Requires Node.js 18+ (native fetch)
========================================================= */

const PORT = process.env.PORT || 5000;
const HOST = "0.0.0.0";
const JWT_SECRET = process.env.JWT_SECRET;
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || "peerva";

const VAPID_PUBLIC = process.env.VAPID_PUBLIC;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE;
const VAPID_EMAIL = process.env.VAPID_EMAIL || "mailto:admin@peerva.app";
const CHAT_PAGE_URL = process.env.CHAT_PAGE_URL || "/studentchat.html";

const ANIME_ADMIN_KEY = process.env.ANIME_ADMIN_KEY || "";

if (!JWT_SECRET) {
    console.error("Missing JWT_SECRET environment variable.");
    process.exit(1);
}

if (!MONGO_URI) {
    console.error("Missing MONGO_URI or MONGODB_URI environment variable.");
    process.exit(1);
}

let pushEnabled = false;

if (VAPID_PUBLIC && VAPID_PRIVATE) {
    try {
        webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
        pushEnabled = true;
    } catch (error) {
        console.error("VAPID setup failed; push notifications disabled:", error.message);
    }
} else {
    console.warn("Push notifications disabled: VAPID keys are not configured.");
}

/* =========================================================
   MIDDLEWARE
========================================================= */

app.use(cors({
    origin: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-anime-admin-key"]
}));

app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    next();
});

/* =========================================================
   DATABASE MODELS — CHAT HUB
========================================================= */

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, trim: true },
    usernameLower: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true }
}, { timestamps: true });

const messageSchema = new mongoose.Schema({
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    receiverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true, maxlength: 5000 },
    read: { type: Boolean, default: false }
}, { timestamps: true });

messageSchema.index({ senderId: 1, receiverId: 1, createdAt: 1 });
messageSchema.index({ receiverId: 1, read: 1 });

const subscriptionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    endpoint: { type: String, required: true, unique: true },
    keys: {
        p256dh: { type: String, required: true },
        auth: { type: String, required: true }
    }
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model("User", userSchema);
const Message = mongoose.models.Message || mongoose.model("Message", messageSchema);
const Subscription = mongoose.models.Subscription || mongoose.model("Subscription", subscriptionSchema);

/* =========================================================
   DATABASE MODELS — PEERVA ANIME
========================================================= */

const animeEpisodeSchema = new mongoose.Schema({
    animeId: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        index: true
    },

    anilistId: {
        type: Number,
        default: null,
        index: true
    },

    animeTitle: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
    },

    poster: {
        type: String,
        default: ""
    },

    season: {
        type: Number,
        default: 1,
        min: 1
    },

    episodeNumber: {
        type: Number,
        required: true,
        min: 1
    },

    episodeTitle: {
        type: String,
        default: "",
        maxlength: 200
    },

    durationMinutes: {
        type: Number,
        default: null,
        min: 1
    },

    videoUrl: {
        type: String,
        required: true,
        trim: true
    },

    subtitlesUrl: {
        type: String,
        default: ""
    },

    language: {
        type: String,
        default: "sub",
        enum: ["sub", "dub", "both", "other"]
    },

    sourceName: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },

    sourceType: {
        type: String,
        default: "direct",
        enum: ["direct", "embed"]
    },

    description: {
        type: String,
        default: "",
        maxlength: 3000
    },

    authorised: {
        type: Boolean,
        default: false,
        required: true
    }

}, { timestamps: true });

animeEpisodeSchema.index(
    {
        animeId: 1,
        season: 1,
        episodeNumber: 1,
        language: 1,
        sourceName: 1
    },
    { unique: true }
);

const AnimeEpisode = mongoose.models.AnimeEpisode ||
    mongoose.model("AnimeEpisode", animeEpisodeSchema);

/* =========================================================
   SHARED HELPERS
========================================================= */

function safeUser(user) {
    return {
        id: user._id,
        username: user.username,
        email: user.email
    };
}

function formatMessage(message) {
    return {
        id: message._id,
        senderId: message.senderId,
        receiverId: message.receiverId,
        text: message.text,
        createdAt: message.createdAt
    };
}

function requireDatabase(req, res, next) {
    if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({
            success: false,
            message: "Database is connecting. Please try again shortly."
        });
    }

    next();
}

function authenticateToken(req, res, next) {
    const header = req.headers.authorization;

    if (!header) {
        return res.status(401).json({
            message: "You must sign in first."
        });
    }

    const parts = header.split(" ");

    if (parts.length !== 2 || parts[0] !== "Bearer") {
        return res.status(401).json({
            message: "Invalid authentication format."
        });
    }

    try {
        req.user = jwt.verify(parts[1], JWT_SECRET);
        next();
    } catch {
        return res.status(401).json({
            message: "Your login session has expired. Please sign in again."
        });
    }
}

function requireAnimeAdmin(req, res, next) {
    if (!ANIME_ADMIN_KEY) {
        return res.status(503).json({
            success: false,
            message: "Anime episode management is not configured. Set ANIME_ADMIN_KEY in Render."
        });
    }

    if (req.headers["x-anime-admin-key"] !== ANIME_ADMIN_KEY) {
        return res.status(403).json({
            success: false,
            message: "Not authorised."
        });
    }

    next();
}

function validHttpUrl(value, optional = false) {
    if (optional && !value) return true;

    try {
        const parsed = new URL(value);

        return parsed.protocol === "https:" || parsed.protocol === "http:";
    } catch {
        return false;
    }
}

async function pushToUser(userId, title, body) {
    if (!pushEnabled) return;

    const subscriptions = await Subscription.find({ userId });

    const payload = JSON.stringify({
        title,
        body: String(body).length > 100
            ? String(body).slice(0, 97) + "..."
            : String(body),
        url: CHAT_PAGE_URL
    });

    await Promise.all(subscriptions.map(async sub => {
        try {
            await webpush.sendNotification(
                {
                    endpoint: sub.endpoint,
                    keys: sub.keys
                },
                payload
            );
        } catch (error) {
            if (error.statusCode === 404 || error.statusCode === 410) {
                await Subscription.deleteOne({
                    endpoint: sub.endpoint
                });
            } else {
                console.error(
                    "Push notification error:",
                    error.statusCode || error.message
                );
            }
        }
    }));
}

/* =========================================================
   HOME / HEALTH
========================================================= */

app.get("/", (req, res) => {
    res.json({
        message: "Peerva backend is running!",
        status: "online",
        database: mongoose.connection.readyState === 1
            ? mongoose.connection.name
            : "not connected",
        services: ["ChatHub", "Peerva Anime"]
    });
});

app.get("/health", (req, res) => {
    const connected = mongoose.connection.readyState === 1;

    res.status(connected ? 200 : 503).json({
        status: connected ? "ok" : "database not connected"
    });
});

/* =========================================================
   CHAT HUB — SIGN UP
========================================================= */

app.post("/signup", requireDatabase, async (req, res) => {
    try {
        const { username, email, password } = req.body || {};

        if (!username || !email || !password) {
            return res.status(400).json({
                message: "All fields are required."
            });
        }

        const cleanUsername = String(username).trim();
        const cleanEmail = String(email).trim().toLowerCase();

        if (cleanUsername.length < 3 || cleanUsername.length > 30) {
            return res.status(400).json({
                message: "Username must be between 3 and 30 characters."
            });
        }

        if (String(password).length < 6) {
            return res.status(400).json({
                message: "Password must be at least 6 characters."
            });
        }

        const existing = await User.findOne({
            $or: [
                { email: cleanEmail },
                { usernameLower: cleanUsername.toLowerCase() }
            ]
        });

        if (existing) {
            return res.status(400).json({
                message: existing.email === cleanEmail
                    ? "Email already exists."
                    : "Username already exists."
            });
        }

        const user = await User.create({
            username: cleanUsername,
            usernameLower: cleanUsername.toLowerCase(),
            email: cleanEmail,
            password: await bcrypt.hash(String(password), 10)
        });

        return res.status(201).json({
            message: "Peerva account created! Please sign in.",
            user: safeUser(user)
        });

    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({
                message: "Email or username already exists."
            });
        }

        console.error("Signup error:", error);

        return res.status(500).json({
            message: "Something went wrong while creating your account."
        });
    }
});

/* =========================================================
   CHAT HUB — LOGIN / CURRENT USER
========================================================= */

app.post("/login", requireDatabase, async (req, res) => {
    try {
        const { email, password } = req.body || {};

        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required."
            });
        }

        const cleanEmail = String(email).trim().toLowerCase();

        const user = await User.findOne({
            email: cleanEmail
        });

        if (!user || !(await bcrypt.compare(String(password), user.password))) {
            return res.status(401).json({
                message: "Incorrect email or password."
            });
        }

        const token = jwt.sign({
            id: String(user._id),
            username: user.username,
            email: user.email
        }, JWT_SECRET, {
            expiresIn: "7d"
        });

        return res.json({
            message: "Login successful!",
            token,
            user: safeUser(user)
        });

    } catch (error) {
        console.error("Login error:", error);

        return res.status(500).json({
            message: "Something went wrong while signing in."
        });
    }
});

app.get("/me", requireDatabase, authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                message: "User no longer exists."
            });
        }

        return res.json({
            user: safeUser(user)
        });

    } catch (error) {
        console.error("Me error:", error);

        return res.status(500).json({
            message: "Something went wrong."
        });
    }
});

/* =========================================================
   CHAT HUB — USERS / PRIVATE MESSAGES
========================================================= */

app.get("/users", requireDatabase, authenticateToken, async (req, res) => {
    try {
        const users = await User.find({
            _id: { $ne: req.user.id }
        })
            .select("username")
            .sort({ username: 1 });

        return res.json(users.map(user => ({
            id: user._id,
            username: user.username
        })));

    } catch (error) {
        console.error("Users error:", error);

        return res.status(500).json({
            message: "Something went wrong."
        });
    }
});

app.get(
    "/messages/:userId/:otherUserId",
    requireDatabase,
    authenticateToken,
    async (req, res) => {
        try {
            const { userId, otherUserId } = req.params;

            if (
                !mongoose.isValidObjectId(userId) ||
                !mongoose.isValidObjectId(otherUserId)
            ) {
                return res.status(400).json({
                    message: "Invalid user ID."
                });
            }

            if (String(userId) !== String(req.user.id)) {
                return res.status(403).json({
                    message: "You cannot access another user's conversation."
                });
            }

            const conversation = await Message.find({
                $or: [
                    {
                        senderId: userId,
                        receiverId: otherUserId
                    },
                    {
                        senderId: otherUserId,
                        receiverId: userId
                    }
                ]
            }).sort({
                createdAt: 1
            });

            return res.json(conversation.map(formatMessage));

        } catch (error) {
            console.error("Get messages error:", error);

            return res.status(500).json({
                message: "Something went wrong."
            });
        }
    }
);

app.post("/messages", requireDatabase, authenticateToken, async (req, res) => {
    try {
        const { receiverId, text } = req.body || {};

        if (!receiverId || !text) {
            return res.status(400).json({
                message: "Receiver and message are required."
            });
        }

        if (!mongoose.isValidObjectId(receiverId)) {
            return res.status(400).json({
                message: "Invalid receiver."
            });
        }

        const cleanText = String(text).trim();

        if (!cleanText) {
            return res.status(400).json({
                message: "Message cannot be empty."
            });
        }

        if (cleanText.length > 5000) {
            return res.status(400).json({
                message: "Message is too long."
            });
        }

        if (String(req.user.id) === String(receiverId)) {
            return res.status(400).json({
                message: "You cannot message yourself."
            });
        }

        const receiver = await User.findById(receiverId);

        if (!receiver) {
            return res.status(404).json({
                message: "Receiver not found."
            });
        }

        const newMessage = await Message.create({
            senderId: req.user.id,
            receiverId,
            text: cleanText
        });

        res.status(201).json({
            message: "Message sent!",
            data: formatMessage(newMessage)
        });

        pushToUser(receiverId, req.user.username, cleanText).catch(error => {
            console.error("Push notification failed:", error.message);
        });

    } catch (error) {
        console.error("Send message error:", error);

        return res.status(500).json({
            message: "Something went wrong."
        });
    }
});

app.get("/unread", requireDatabase, authenticateToken, async (req, res) => {
    try {
        const counts = await Message.aggregate([
            {
                $match: {
                    receiverId: new mongoose.Types.ObjectId(String(req.user.id)),
                    read: false
                }
            },
            {
                $group: {
                    _id: "$senderId",
                    count: { $sum: 1 }
                }
            }
        ]);

        const result = {};

        counts.forEach(item => {
            result[String(item._id)] = item.count;
        });

        return res.json(result);

    } catch (error) {
        console.error("Unread error:", error);

        return res.status(500).json({
            message: "Something went wrong."
        });
    }
});

app.post("/messages/read", requireDatabase, authenticateToken, async (req, res) => {
    try {
        const { otherUserId } = req.body || {};

        if (!otherUserId || !mongoose.isValidObjectId(otherUserId)) {
            return res.status(400).json({
                message: "Invalid user."
            });
        }

        await Message.updateMany(
            {
                senderId: otherUserId,
                receiverId: req.user.id,
                read: false
            },
            {
                $set: { read: true }
            }
        );

        return res.sendStatus(200);

    } catch (error) {
        console.error("Mark read error:", error);

        return res.status(500).json({
            message: "Something went wrong."
        });
    }
});

/* =========================================================
   CHAT HUB — PUSH NOTIFICATIONS
========================================================= */

app.get("/push/public-key", (req, res) => {
    if (!pushEnabled) {
        return res.status(503).json({
            message: "Push notifications are not enabled."
        });
    }

    return res.json({
        publicKey: VAPID_PUBLIC
    });
});

app.post("/subscribe", requireDatabase, authenticateToken, async (req, res) => {
    try {
        const { subscription } = req.body || {};

        if (
            !subscription ||
            !subscription.endpoint ||
            !subscription.keys ||
            !subscription.keys.p256dh ||
            !subscription.keys.auth
        ) {
            return res.status(400).json({
                message: "Invalid subscription."
            });
        }

        await Subscription.findOneAndUpdate(
            {
                endpoint: subscription.endpoint
            },
            {
                userId: req.user.id,
                endpoint: subscription.endpoint,
                keys: {
                    p256dh: subscription.keys.p256dh,
                    auth: subscription.keys.auth
                }
            },
            {
                upsert: true,
                new: true,
                setDefaultsOnInsert: true
            }
        );

        return res.sendStatus(201);

    } catch (error) {
        console.error("Subscribe error:", error);

        return res.status(500).json({
            message: "Something went wrong."
        });
    }
});

app.post("/unsubscribe", requireDatabase, authenticateToken, async (req, res) => {
    try {
        const { endpoint } = req.body || {};

        if (!endpoint) {
            return res.status(400).json({
                message: "Endpoint is required."
            });
        }

        await Subscription.deleteOne({
            endpoint,
            userId: req.user.id
        });

        return res.sendStatus(200);

    } catch (error) {
        console.error("Unsubscribe error:", error);

        return res.status(500).json({
            message: "Something went wrong."
        });
    }
});

/* =========================================================
   PEERVA ANIME — ANILIST METADATA PROVIDER

   AniList supplies anime information and artwork.
   It does NOT supply playable video streams.
========================================================= */

const ANILIST_URL = "https://graphql.anilist.co";

async function aniListRequest(query, variables = {}) {
    const response = await fetch(ANILIST_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        body: JSON.stringify({
            query,
            variables
        })
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok || payload.errors) {
        const message = payload.errors?.[0]?.message ||
            `AniList request failed (${response.status}).`;

        const error = new Error(message);
        error.status = response.status || 502;

        throw error;
    }

    return payload.data;
}

const MEDIA_FIELDS = `
    id
    idMal
    title { romaji english native }
    description(asHtml: false)
    episodes
    duration
    status
    season
    seasonYear
    format
    genres
    averageScore
    popularity
    siteUrl
    isAdult
    coverImage { extraLarge large medium color }
    bannerImage
    nextAiringEpisode { airingAt timeUntilAiring episode }
`;

function normaliseMedia(media) {
    if (!media) return null;

    return {
        id: media.id,
        idMal: media.idMal,

        title: media.title?.english ||
            media.title?.romaji ||
            media.title?.native ||
            "Unknown title",

        titles: media.title,

        description: media.description || "",

        episodes: media.episodes,
        duration: media.duration,
        status: media.status,
        season: media.season,
        seasonYear: media.seasonYear,
        format: media.format,

        genres: media.genres || [],

        score: media.averageScore,
        popularity: media.popularity,

        siteUrl: media.siteUrl,
        isAdult: media.isAdult,

        poster: media.coverImage?.extraLarge ||
            media.coverImage?.large ||
            media.coverImage?.medium ||
            "",

        coverColor: media.coverImage?.color || null,
        banner: media.bannerImage || "",

        nextAiringEpisode: media.nextAiringEpisode || null
    };
}

/* =========================================================
   ANIME SEARCH
   Example: /api/anime/search?q=Bleach
========================================================= */

app.get("/api/anime/search", async (req, res) => {
    try {
        const search = String(req.query.q || "").trim();

        if (search.length < 2) {
            return res.status(400).json({
                success: false,
                message: "Enter at least two characters to search."
            });
        }

        const query = `
            query ($search: String) {
                Page(page: 1, perPage: 20) {
                    media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
                        ${MEDIA_FIELDS}
                    }
                }
            }
        `;

        const data = await aniListRequest(query, {
            search
        });

        const anime = (data.Page.media || [])
            .filter(item => !item.isAdult)
            .map(normaliseMedia);

        return res.json({
            success: true,
            anime
        });

    } catch (error) {
        console.error("AniList search error:", error.message);

        return res.status(error.status || 502).json({
            success: false,
            message: "Anime search is temporarily unavailable."
        });
    }
});

/* =========================================================
   TRENDING ANIME
========================================================= */

app.get("/api/anime/trending", async (req, res) => {
    try {
        const query = `
            query {
                Page(page: 1, perPage: 24) {
                    media(type: ANIME, sort: TRENDING_DESC, isAdult: false) {
                        ${MEDIA_FIELDS}
                    }
                }
            }
        `;

        const data = await aniListRequest(query);

        return res.json({
            success: true,
            anime: (data.Page.media || []).map(normaliseMedia)
        });

    } catch (error) {
        console.error("AniList trending error:", error.message);

        return res.status(error.status || 502).json({
            success: false,
            message: "Could not load trending anime."
        });
    }
});

/* =========================================================
   POPULAR ANIME
========================================================= */

app.get("/api/anime/popular", async (req, res) => {
    try {
        const query = `
            query {
                Page(page: 1, perPage: 24) {
                    media(type: ANIME, sort: POPULARITY_DESC, isAdult: false) {
                        ${MEDIA_FIELDS}
                    }
                }
            }
        `;

        const data = await aniListRequest(query);

        return res.json({
            success: true,
            anime: (data.Page.media || []).map(normaliseMedia)
        });

    } catch (error) {
        console.error("AniList popular error:", error.message);

        return res.status(error.status || 502).json({
            success: false,
            message: "Could not load popular anime."
        });
    }
});

/* =========================================================
   ANIME DETAILS BY ANILIST ID
========================================================= */

app.get("/api/anime/details/:animeId", async (req, res) => {
    try {
        const id = Number(req.params.animeId);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid anime ID."
            });
        }

        const query = `
            query ($id: Int) {
                Media(id: $id, type: ANIME) {
                    ${MEDIA_FIELDS}

                    relations {
                        edges {
                            relationType

                            node {
                                id
                                type
                                title { romaji english }
                                format
                                coverImage { large }
                            }
                        }
                    }
                }
            }
        `;

        const data = await aniListRequest(query, {
            id
        });

        if (!data.Media || data.Media.isAdult) {
            return res.status(404).json({
                success: false,
                message: "Anime not found."
            });
        }

        const anime = normaliseMedia(data.Media);

        anime.relations = (data.Media.relations?.edges || [])
            .filter(edge => edge.node?.type === "ANIME")
            .map(edge => ({
                relation: edge.relationType,
                id: edge.node.id,

                title: edge.node.title?.english ||
                    edge.node.title?.romaji,

                format: edge.node.format,
                poster: edge.node.coverImage?.large || ""
            }));

        return res.json({
            success: true,
            anime
        });

    } catch (error) {
        console.error("AniList details error:", error.message);

        return res.status(error.status || 502).json({
            success: false,
            message: "Could not load anime details."
        });
    }
});

/* =========================================================
   PEERVA ANIME — AUTHORISED EPISODE CATALOGUE

   These routes do not scrape third-party streaming sites.
========================================================= */

/*
  GET /api/anime

  Returns anime for which Peerva has at least one
  authorised episode source.
*/

app.get("/api/anime", requireDatabase, async (req, res) => {
    try {
        const catalogue = await AnimeEpisode.aggregate([
            {
                $match: {
                    authorised: true
                }
            },

            {
                $sort: {
                    animeTitle: 1,
                    season: 1,
                    episodeNumber: 1
                }
            },

            {
                $group: {
                    _id: "$animeId",

                    animeId: {
                        $first: "$animeId"
                    },

                    anilistId: {
                        $first: "$anilistId"
                    },

                    title: {
                        $first: "$animeTitle"
                    },

                    poster: {
                        $first: "$poster"
                    },

                    description: {
                        $first: "$description"
                    },

                    episodeCount: {
                        $sum: 1
                    },

                    latestUpdate: {
                        $max: "$updatedAt"
                    }
                }
            },

            {
                $sort: {
                    title: 1
                }
            }
        ]);

        return res.json({
            success: true,
            anime: catalogue
        });

    } catch (error) {
        console.error("Stored anime catalogue error:", error);

        return res.status(500).json({
            success: false,
            message: "Could not load Peerva's available episode catalogue."
        });
    }
});

/* =========================================================
   GET ANIME EPISODES
   Example: /api/anime/bleach/episodes
========================================================= */

app.get("/api/anime/:animeId/episodes", requireDatabase, async (req, res) => {
    try {
        const animeId = String(req.params.animeId)
            .trim()
            .toLowerCase();

        const episodes = await AnimeEpisode.find({
            animeId,
            authorised: true
        })
            .select(
                "animeId anilistId animeTitle poster season episodeNumber episodeTitle durationMinutes language sourceName description"
            )
            .sort({
                season: 1,
                episodeNumber: 1
            })
            .lean();

        return res.json({
            success: true,
            episodes
        });

    } catch (error) {
        console.error("Anime episodes error:", error);

        return res.status(500).json({
            success: false,
            message: "Could not load episodes."
        });
    }
});

/* =========================================================
   GET EPISODE STREAMS

   Example:
   /api/anime/bleach/episode/1/streams?season=1
========================================================= */

app.get(
    "/api/anime/:animeId/episode/:episodeNumber/streams",
    requireDatabase,
    async (req, res) => {
        try {
            const animeId = String(req.params.animeId)
                .trim()
                .toLowerCase();

            const episodeNumber = Number(req.params.episodeNumber);

            const season = Math.max(
                1,
                Number(req.query.season) || 1
            );

            if (!Number.isInteger(episodeNumber) || episodeNumber < 1) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid episode number."
                });
            }

            const streams = await AnimeEpisode.find({
                animeId,
                season,
                episodeNumber,
                authorised: true
            })
                .select(
                    "animeTitle episodeTitle season episodeNumber durationMinutes videoUrl subtitlesUrl language sourceName sourceType"
                )
                .lean();

            return res.json({
                success: true,
                animeId,
                season,
                episodeNumber,
                streams
            });

        } catch (error) {
            console.error("Anime streams error:", error);

            return res.status(500).json({
                success: false,
                message: "Could not load episode sources."
            });
        }
    }
);

/* =========================================================
   ADD AUTHORISED ANIME EPISODES

   POST /api/anime/admin/episodes

   Header:
   x-anime-admin-key: your ANIME_ADMIN_KEY

   Example JSON:

   {
       "animeId": "bleach",
       "anilistId": 269,
       "animeTitle": "Bleach",
       "poster": "https://...",
       "season": 1,
       "episodeNumber": 1,
       "episodeTitle": "The Day I Became a Shinigami",
       "durationMinutes": 24,
       "videoUrl": "https://your-authorised-provider.example/embed/...",
       "subtitlesUrl": "",
       "language": "sub",
       "sourceName": "My licensed provider",
       "sourceType": "embed",
       "authorised": true
   }
========================================================= */

app.post(
    "/api/anime/admin/episodes",
    requireDatabase,
    requireAnimeAdmin,
    async (req, res) => {
        try {
            const body = req.body || {};

            const required = [
                "animeId",
                "animeTitle",
                "episodeNumber",
                "videoUrl",
                "sourceName"
            ];

            for (const field of required) {
                if (body[field] === undefined || body[field] === "") {
                    return res.status(400).json({
                        success: false,
                        message: `${field} is required.`
                    });
                }
            }

            if (
                !validHttpUrl(body.videoUrl) ||
                !validHttpUrl(body.subtitlesUrl, true) ||
                !validHttpUrl(body.poster, true)
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Video, subtitle and poster fields must be valid HTTP or HTTPS URLs."
                });
            }

            if (body.authorised !== true) {
                return res.status(400).json({
                    success: false,
                    message: "Only streams you are authorised to distribute or embed can be added."
                });
            }

            const episodeNumber = Number(body.episodeNumber);

            const season = Math.max(
                1,
                Number(body.season) || 1
            );

            if (!Number.isInteger(episodeNumber) || episodeNumber < 1) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid episode number."
                });
            }

            const language = [
                "sub",
                "dub",
                "both",
                "other"
            ].includes(body.language)
                ? body.language
                : "sub";

            const sourceType = [
                "direct",
                "embed"
            ].includes(body.sourceType)
                ? body.sourceType
                : "direct";

            const episode = await AnimeEpisode.findOneAndUpdate(
                {
                    animeId: String(body.animeId)
                        .trim()
                        .toLowerCase(),

                    season,
                    episodeNumber,
                    language,
                    sourceName: String(body.sourceName).trim()
                },

                {
                    $set: {
                        anilistId: Number(body.anilistId) || null,

                        animeTitle: String(body.animeTitle).trim(),

                        poster: body.poster || "",

                        episodeTitle: body.episodeTitle || "",

                        durationMinutes: Number(body.durationMinutes) || null,

                        videoUrl: body.videoUrl,

                        subtitlesUrl: body.subtitlesUrl || "",

                        language,

                        sourceName: String(body.sourceName).trim(),

                        sourceType,

                        description: body.description || "",

                        authorised: true
                    }
                },

                {
                    upsert: true,
                    new: true,
                    runValidators: true
                }
            );

            return res.status(201).json({
                success: true,
                message: "Authorised episode source saved.",
                episode
            });

        } catch (error) {
            console.error("Add anime episode error:", error);

            return res.status(500).json({
                success: false,
                message: "Could not save episode source."
            });
        }
    }
);

/* =========================================================
   DELETE AN ANIME EPISODE SOURCE

   DELETE /api/anime/admin/episodes/:id
========================================================= */

app.delete(
    "/api/anime/admin/episodes/:id",
    requireDatabase,
    requireAnimeAdmin,
    async (req, res) => {
        try {
            if (!mongoose.isValidObjectId(req.params.id)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid episode ID."
                });
            }

            const removed = await AnimeEpisode.findByIdAndDelete(
                req.params.id
            );

            if (!removed) {
                return res.status(404).json({
                    success: false,
                    message: "Episode source not found."
                });
            }

            return res.json({
                success: true,
                message: "Episode source removed."
            });

        } catch (error) {
            console.error("Delete anime episode error:", error);

            return res.status(500).json({
                success: false,
                message: "Could not remove episode source."
            });
        }
    }
);


/* =========================================================
   PEERVA ANIME — ANIMEDOC PROVIDER
   Search, trending, catalogue and episode information.

   API key stays on the backend.
========================================================= */

const ANIMEDOC_API_URL = "https://api.animedoc.cloud";
const ANIMEDOC_API_KEY = process.env.ANIMEDOC_API_KEY || "";

async function animeDocRequest(path, options = {}) {
    if (!ANIMEDOC_API_KEY) {
        const error = new Error(
            "AnimeDoc is not configured. Add ANIMEDOC_API_KEY to Render."
        );
        error.status = 503;
        throw error;
    }

    const response = await fetch(
        `${ANIMEDOC_API_URL}${path}`,
        {
            ...options,
            headers: {
                "X-API-Key": ANIMEDOC_API_KEY,
                "Accept": "application/json",
                ...(options.headers || {})
            },
            signal: AbortSignal.timeout(20000)
        }
    );

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
        const error = new Error(
            payload.detail ||
            payload.message ||
            payload.error ||
            `AnimeDoc returned HTTP ${response.status}.`
        );

        error.status = response.status;
        throw error;
    }

    return payload;
}

function sendAnimeDocError(res, error) {
    console.error("AnimeDoc error:", error.message);

    return res.status(error.status || 502).json({
        success: false,
        message: error.message || "AnimeDoc is temporarily unavailable."
    });
}

/* =========================================================
   ANIMEDOC SEARCH

   GET /api/animedoc/search?q=naruto&page=1
========================================================= */

app.get("/api/animedoc/search", async (req, res) => {
    try {
        const keyword = String(req.query.q || "").trim();

        const page = Math.max(
            1,
            Math.min(100, Number(req.query.page) || 1)
        );

        const perPage = Math.max(
            1,
            Math.min(20, Number(req.query.perPage) || 15)
        );

        if (keyword.length < 2) {
            return res.status(400).json({
                success: false,
                message: "Enter at least two characters."
            });
        }

        const payload = await animeDocRequest(
            "/api/v2/anime/search/",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    keyword,
                    page,
                    perPage,
                    subjectType: 0
                })
            }
        );

        return res.json({
            success: true,
            provider: "AnimeDoc",
            data: payload.data || null
        });

    } catch (error) {
        return sendAnimeDocError(res, error);
    }
});

/* =========================================================
   ANIMEDOC TRENDING

   GET /api/animedoc/trending?page=0&perPage=12
========================================================= */

app.get("/api/animedoc/trending", async (req, res) => {
    try {
        const page = Math.max(
            0,
            Math.min(100, Number(req.query.page) || 0)
        );

        const perPage = Math.max(
            1,
            Math.min(20, Number(req.query.perPage) || 12)
        );

        const params = new URLSearchParams({
            page: String(page),
            perPage: String(perPage)
        });

        const payload = await animeDocRequest(
            `/api/v2/anime/trending/?${params}`
        );

        return res.json({
            success: true,
            provider: "AnimeDoc",
            data: payload.data || null
        });

    } catch (error) {
        return sendAnimeDocError(res, error);
    }
});

/* =========================================================
   ANIMEDOC ANIME SECTION

   GET /api/animedoc/section
========================================================= */

app.get("/api/animedoc/section", async (req, res) => {
    try {
        const params = new URLSearchParams({
            id: "anime"
        });

        if (req.query.sort) {
            params.set("sort", String(req.query.sort));
        }

        if (req.query.genre) {
            params.set("genre", String(req.query.genre));
        }

        if (req.query.year) {
            params.set("year", String(req.query.year));
        }

        const payload = await animeDocRequest(
            `/api/v2/anime/section/?${params}`
        );

        return res.json({
            success: true,
            provider: "AnimeDoc",
            data: payload.data || null
        });

    } catch (error) {
        return sendAnimeDocError(res, error);
    }
});

/* =========================================================
   ANIMEDOC ANIME DETAILS

   GET /api/animedoc/details?detailPath=...
========================================================= */

app.get("/api/animedoc/details", async (req, res) => {
    try {
        const detailPath = String(
            req.query.detailPath || ""
        ).trim();

        if (!detailPath || detailPath.length > 300) {
            return res.status(400).json({
                success: false,
                message: "A valid AnimeDoc detailPath is required."
            });
        }

        const params = new URLSearchParams({
            detailPath
        });

        const payload = await animeDocRequest(
            `/api/v2/anime/detail/?${params}`
        );

        return res.json({
            success: true,
            provider: "AnimeDoc",
            data: payload.data || null
        });

    } catch (error) {
        return sendAnimeDocError(res, error);
    }
});

/* =========================================================
   ANIMEDOC PLAYBACK STATUS

   Playback source access is not enabled until the
   relevant distribution and embedding rights are verified.
========================================================= */

app.get("/api/animedoc/playback-status", (req, res) => {
    return res.json({
        success: true,
        provider: "AnimeDoc",
        playbackEnabled: false,
        message:
            "AnimeDoc catalogue integration is available. " +
            "Public episode playback requires confirmation of " +
            "the relevant distribution and embedding permissions."
    });
});

/* =========================================================
   ERROR HANDLING
========================================================= */

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Route not found.",
        path: req.originalUrl
    });
});

app.use((error, req, res, next) => {
    console.error("Unhandled server error:", error);

    if (res.headersSent) {
        return next(error);
    }

    res.status(500).json({
        success: false,
        message: "An unexpected server error occurred."
    });
});

/* =========================================================
   START SERVER
========================================================= */

async function startServer() {
    try {
        await mongoose.connect(MONGO_URI, {
            dbName: DB_NAME,
            serverSelectionTimeoutMS: 15000
        });

        console.log(`MongoDB connected: ${mongoose.connection.name}`);

        app.listen(PORT, HOST, () => {
            console.log(`Peerva backend listening on ${HOST}:${PORT}`);
            console.log("ChatHub routes are enabled.");
            console.log("Peerva Anime routes are enabled.");
            console.log("AniList metadata provider is enabled.");

            console.log(
                `Anime episode management: ${
                    ANIME_ADMIN_KEY
                        ? "enabled"
                        : "disabled (set ANIME_ADMIN_KEY)"
                }`
            );
        });

    } catch (error) {
        console.error("Could not start Peerva backend:", error);
        process.exit(1);
    }
}

startServer();

module.exports = app;
