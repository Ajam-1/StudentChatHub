=========================================================================================
server.js
==========================================================================================

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const webpush = require("web-push");

const app = express();

/* =========================
   CONFIG
========================= */

const PORT = process.env.PORT || 5000;
const HOST = "0.0.0.0";

const JWT_SECRET = process.env.JWT_SECRET;
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

// Forces the database name so users are never saved into the default "test" database
const DB_NAME = process.env.DB_NAME || "peerva";

// Push notification keys (add these in your Render environment variables)
const VAPID_PUBLIC = process.env.VAPID_PUBLIC;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE;
const VAPID_EMAIL = process.env.VAPID_EMAIL || "mailto:you@example.com";

// Page that opens when someone taps a notification. Change if your chat page lives elsewhere.
const CHAT_PAGE_URL = process.env.CHAT_PAGE_URL || "/studentchat.html";

if (!JWT_SECRET) {
    console.error("JWT_SECRET is not set. Add it in your Render environment variables.");
    process.exit(1);
}

if (!MONGO_URI) {
    console.error("MONGO_URI is not set. Add it in your Render environment variables.");
    process.exit(1);
}

// The server still runs without push keys, it just won't send notifications
let pushEnabled = false;

if (VAPID_PUBLIC && VAPID_PRIVATE) {
    try {
        webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
        pushEnabled = true;
    } catch (error) {
        console.error("Invalid VAPID keys, push notifications disabled:", error.message);
    }
} else {
    console.warn("VAPID_PUBLIC / VAPID_PRIVATE not set. Push notifications are disabled.");
}


/* =========================
   MIDDLEWARE
========================= */

app.use(
    cors({
        origin: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"]
    })
);

app.use(express.json({ limit: "100kb" }));


/* =========================
   DATABASE MODELS
========================= */

const userSchema = new mongoose.Schema(
    {
        username: { type: String, required: true, trim: true },
        usernameLower: { type: String, required: true, unique: true },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },
        password: { type: String, required: true }
    },
    { timestamps: true }
);

const messageSchema = new mongoose.Schema(
    {
        senderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        receiverId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        text: { type: String, required: true },
        // false = the receiver has not opened this message yet
        read: { type: Boolean, default: false }
    },
    { timestamps: true }
);

messageSchema.index({ senderId: 1, receiverId: 1, createdAt: 1 });
messageSchema.index({ receiverId: 1, read: 1 });

const subscriptionSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },
        endpoint: { type: String, required: true, unique: true },
        keys: {
            p256dh: { type: String, required: true },
            auth: { type: String, required: true }
        }
    },
    { timestamps: true }
);

const User = mongoose.model("User", userSchema);
const Message = mongoose.model("Message", messageSchema);
const Subscription = mongoose.model("Subscription", subscriptionSchema);


/* =========================
   HELPERS
========================= */

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

// Stops requests from hanging if the database is not connected
function requireDatabase(req, res, next) {
    if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({
            message: "Server is starting up. Please try again in a few seconds."
        });
    }
    next();
}

// Sends a push notification to every device a user has subscribed
async function pushToUser(userId, title, body) {
    if (!pushEnabled) return;

    const subs = await Subscription.find({ userId });
    console.log(`Push: found ${subs.length} device(s) for user ${userId}`);

    const payload = JSON.stringify({
        title,
        body: body.length > 100 ? body.slice(0, 97) + "..." : body,
        url: CHAT_PAGE_URL
    });

    await Promise.all(
        subs.map(async sub => {
            try {
                await webpush.sendNotification(
                    { endpoint: sub.endpoint, keys: sub.keys },
                    payload
                );
            } catch (error) {
                // Subscription expired or was revoked, so remove it
                if (error.statusCode === 404 || error.statusCode === 410) {
                    await Subscription.deleteOne({ endpoint: sub.endpoint });
                } else {
                    console.error("Push error:", error.statusCode || error.message);
                }
            }
        })
    );
}


/* =========================
   AUTHENTICATION
========================= */

function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ message: "You must sign in first." });
    }

    const parts = authHeader.split(" ");

    if (parts.length !== 2 || parts[0] !== "Bearer") {
        return res.status(401).json({ message: "Invalid authentication format." });
    }

    try {
        req.user = jwt.verify(parts[1], JWT_SECRET);
        next();
    } catch (error) {
        return res.status(401).json({
            message: "Your login session has expired. Please sign in again."
        });
    }
}


/* =========================
   HOME AND HEALTH
========================= */

app.get("/", (req, res) => {
    res.json({
        message: "Peerva backend is running!",
        status: "online",
        database:
            mongoose.connection.readyState === 1
                ? mongoose.connection.name
                : "not connected"
    });
});

app.get("/health", (req, res) => {
    const connected = mongoose.connection.readyState === 1;
    res.status(connected ? 200 : 503).json({
        status: connected ? "ok" : "database not connected"
    });
});


/* =========================
   SIGN UP
========================= */

app.post("/signup", requireDatabase, async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ message: "All fields are required." });
        }

        const cleanUsername = String(username).trim();
        const cleanEmail = String(email).trim().toLowerCase();

        if (cleanUsername.length < 3) {
            return res.status(400).json({
                message: "Username must be at least 3 characters."
            });
        }

        if (String(password).length < 6) {
            return res.status(400).json({
                message: "Password must be at least 6 characters."
            });
        }

        const emailExists = await User.findOne({ email: cleanEmail });

        if (emailExists) {
            return res.status(400).json({ message: "Email already exists." });
        }

        const usernameExists = await User.findOne({
            usernameLower: cleanUsername.toLowerCase()
        });

        if (usernameExists) {
            return res.status(400).json({ message: "Username already exists." });
        }

        const hashedPassword = await bcrypt.hash(String(password), 10);

        const user = await User.create({
            username: cleanUsername,
            usernameLower: cleanUsername.toLowerCase(),
            email: cleanEmail,
            password: hashedPassword
        });

        console.log("New user saved:", user.email, "in database:", mongoose.connection.name);

        res.status(201).json({
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

        res.status(500).json({
            message: "Something went wrong while creating your account."
        });
    }
});


/* =========================
   LOGIN
========================= */

app.post("/login", requireDatabase, async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required."
            });
        }

        const cleanEmail = String(email).trim().toLowerCase();

        const user = await User.findOne({ email: cleanEmail });

        if (!user) {
            console.log("Login failed: no user found for", cleanEmail);
            return res.status(401).json({
                message: "Incorrect email or password."
            });
        }

        const passwordCorrect = await bcrypt.compare(
            String(password),
            user.password
        );

        if (!passwordCorrect) {
            console.log("Login failed: wrong password for", cleanEmail);
            return res.status(401).json({
                message: "Incorrect email or password."
            });
        }

        const token = jwt.sign(
            {
                id: user._id,
                username: user.username,
                email: user.email
            },
            JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.json({
            message: "Login successful!",
            token,
            user: safeUser(user)
        });

    } catch (error) {
        console.error("Login error:", error);

        res.status(500).json({
            message: "Something went wrong while signing in."
        });
    }
});


/* =========================
   GET CURRENT USER
========================= */

app.get("/me", requireDatabase, authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ message: "User no longer exists." });
        }

        res.json({ user: safeUser(user) });

    } catch (error) {
        console.error("Me error:", error);
        res.status(500).json({ message: "Something went wrong." });
    }
});


/* =========================
   GET USERS
========================= */

app.get("/users", requireDatabase, authenticateToken, async (req, res) => {
    try {
        const users = await User.find({
            _id: { $ne: req.user.id }
        }).select("username");

        res.json(
            users.map(user => ({
                id: user._id,
                username: user.username
            }))
        );

    } catch (error) {
        console.error("Users error:", error);
        res.status(500).json({ message: "Something went wrong." });
    }
});


/* =========================
   GET MESSAGES
========================= */

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
                return res.status(400).json({ message: "Invalid user ID." });
            }

            if (userId !== String(req.user.id)) {
                return res.status(403).json({
                    message: "You cannot access another user's conversation."
                });
            }

            const conversation = await Message.find({
                $or: [
                    { senderId: userId, receiverId: otherUserId },
                    { senderId: otherUserId, receiverId: userId }
                ]
            }).sort({ createdAt: 1 });

            res.json(conversation.map(formatMessage));

        } catch (error) {
            console.error("Get messages error:", error);
            res.status(500).json({ message: "Something went wrong." });
        }
    }
);


/* =========================
   SEND MESSAGE
========================= */

app.post("/messages", requireDatabase, authenticateToken, async (req, res) => {
    try {
        const { receiverId, text } = req.body;

        if (!receiverId || !text) {
            return res.status(400).json({
                message: "Receiver and message are required."
            });
        }

        if (!mongoose.isValidObjectId(receiverId)) {
            return res.status(400).json({ message: "Invalid receiver." });
        }

        const cleanText = String(text).trim();

        if (!cleanText) {
            return res.status(400).json({ message: "Message cannot be empty." });
        }

        if (cleanText.length > 5000) {
            return res.status(400).json({ message: "Message is too long." });
        }

        if (String(req.user.id) === String(receiverId)) {
            return res.status(400).json({
                message: "You cannot message yourself."
            });
        }

        const receiver = await User.findById(receiverId);

        if (!receiver) {
            return res.status(404).json({ message: "Receiver not found." });
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

        // Notify the receiver after replying, so sending is never slowed down or broken by push
        pushToUser(receiverId, req.user.username, cleanText).catch(error => {
            console.error("Push notification failed:", error.message);
        });

    } catch (error) {
        console.error("Send message error:", error);
        res.status(500).json({ message: "Something went wrong." });
    }
});


/* =========================
   UNREAD MESSAGES
========================= */

// Returns how many unread messages the signed-in user has from each person
// Example: { "6acaaf...": 3, "6bd012...": 1 }
app.get("/unread", requireDatabase, authenticateToken, async (req, res) => {
    try {
        const counts = await Message.aggregate([
            {
                $match: {
                    receiverId: new mongoose.Types.ObjectId(String(req.user.id)),
                    read: false
                }
            },
            { $group: { _id: "$senderId", count: { $sum: 1 } } }
        ]);

        const result = {};

        counts.forEach(item => {
            result[String(item._id)] = item.count;
        });

        res.json(result);

    } catch (error) {
        console.error("Unread error:", error);
        res.status(500).json({ message: "Something went wrong." });
    }
});

// Marks every message from one person to the signed-in user as read
app.post("/messages/read", requireDatabase, authenticateToken, async (req, res) => {
    try {
        const { otherUserId } = req.body;

        if (!otherUserId || !mongoose.isValidObjectId(otherUserId)) {
            return res.status(400).json({ message: "Invalid user." });
        }

        await Message.updateMany(
            { senderId: otherUserId, receiverId: req.user.id, read: false },
            { $set: { read: true } }
        );

        res.sendStatus(200);

    } catch (error) {
        console.error("Mark read error:", error);
        res.status(500).json({ message: "Something went wrong." });
    }
});


/* =========================
   PUSH NOTIFICATIONS
========================= */

// The frontend fetches this so you don't have to paste the key into your code
app.get("/push/public-key", (req, res) => {
    if (!pushEnabled) {
        return res.status(503).json({ message: "Push notifications are not enabled." });
    }
    res.json({ publicKey: VAPID_PUBLIC });
});

app.post("/subscribe", requireDatabase, authenticateToken, async (req, res) => {
    try {
        const { subscription } = req.body;

        if (
            !subscription ||
            !subscription.endpoint ||
            !subscription.keys ||
            !subscription.keys.p256dh ||
            !subscription.keys.auth
        ) {
            return res.status(400).json({ message: "Invalid subscription." });
        }

        // The user comes from the login token, not from the request body
        await Subscription.findOneAndUpdate(
            { endpoint: subscription.endpoint },
            {
                userId: req.user.id,
                endpoint: subscription.endpoint,
                keys: {
                    p256dh: subscription.keys.p256dh,
                    auth: subscription.keys.auth
                }
            },
            { upsert: true }
        );

        res.sendStatus(201);

    } catch (error) {
        console.error("Subscribe error:", error);
        res.status(500).json({ message: "Something went wrong." });
    }
});

// Call this on logout so the device stops getting that user's notifications
app.post("/unsubscribe", requireDatabase, authenticateToken, async (req, res) => {
    try {
        const { endpoint } = req.body;

        if (!endpoint) {
            return res.status(400).json({ message: "Endpoint is required." });
        }

        await Subscription.deleteOne({ endpoint, userId: req.user.id });

        res.sendStatus(200);

    } catch (error) {
        console.error("Unsubscribe error:", error);
        res.status(500).json({ message: "Something went wrong." });
    }
});


/* ==========================================
   PEERVA ANIME API — ADD-ON
   Keeps existing Peerva routes unchanged
========================================== */

const animeEpisodeSchema = new mongoose.Schema(
  {
    animeId: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
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
    videoUrl: {
      type: String,
      required: true,
      trim: true
    },
    subtitlesUrl: {
      type: String,
      default: ""
    },
    description: {
      type: String,
      default: "",
      maxlength: 3000
    }
  },
  { timestamps: true }
);

animeEpisodeSchema.index(
  {
    animeId: 1,
    season: 1,
    episodeNumber: 1
  },
  { unique: true }
);

const AnimeEpisode = mongoose.model(
  "AnimeEpisode",
  animeEpisodeSchema
);

// Check that a supplied URL is HTTP or HTTPS.
function isValidAnimeUrl(value, optional = false) {
  if (optional && !value) return true;

  try {
    const url = new URL(value);
    return url.protocol === "https:" ||
           url.protocol === "http:";
  } catch {
    return false;
  }
}

// Public catalogue: list anime titles.
app.get("/api/anime", requireDatabase, async (req, res) => {
  try {

    const anime = await AnimeEpisode.aggregate([
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
          title: { $first: "$animeTitle" },
          poster: { $first: "$poster" },
          description: { $first: "$description" },
          episodeCount: { $sum: 1 },
          latestUpdate: { $max: "$updatedAt" }
        }
      },
      { $sort: { title: 1 } }
    ]);

    res.json({ success: true, anime });
  } catch (error) {
    console.error("Anime catalogue error:", error);
    res.status(500).json({
      success: false,
      message: "Could not load the anime catalogue."
    });
  }
});

// Public episodes for one anime.
app.get("/api/anime/:animeId/episodes", requireDatabase, async (req, res) => {
  try {

    const animeId = String(req.params.animeId)
      .trim()
      .toLowerCase();

    const episodes = await AnimeEpisode.find({ animeId })
      .select(
        "animeId animeTitle poster season episodeNumber episodeTitle videoUrl subtitlesUrl description"
      )
      .sort({ season: 1, episodeNumber: 1 })
      .lean();

    res.json({ success: true, episodes });
  } catch (error) {
    console.error("Anime episodes error:", error);
    res.status(500).json({
      success: false,
      message: "Could not load episodes."
    });
  }
});

/*
 * MUSE ASIA / YOUTUBE DATA API INTEGRATION
 *
 * Searches only the official Muse Asia YouTube channel. The API key stays
 * on the backend and is never sent to the browser.
 *
 * Render environment variable:
 *   YOUTUBE_API_KEY=your_youtube_data_api_v3_key
 * Optional:
 *   MUSE_ASIA_CHANNEL_ID=UCGbshtvS9t-8CW11W7TooQg
 *
 * regionCode=NG asks YouTube for videos available in Nigeria. YouTube and
 * Muse Asia may still change title-by-title availability or embedding rules.
 */

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";
const MUSE_ASIA_CHANNEL_ID =
  process.env.MUSE_ASIA_CHANNEL_ID || "UCGbshtvS9t-8CW11W7TooQg";
const museAsiaCache = new Map();
const museAsiaRateLimits = new Map();
const MUSE_ASIA_CACHE_TTL_MS = 10 * 60 * 1000;
const MUSE_ASIA_REQUEST_LIMIT = 25;
const MUSE_ASIA_WINDOW_MS = 60 * 1000;

function checkMuseAsiaRateLimit(req, res, next) {
  const key = req.ip || req.socket?.remoteAddress || "unknown";
  const now = Date.now();
  const current = museAsiaRateLimits.get(key);

  if (!current || now - current.startedAt >= MUSE_ASIA_WINDOW_MS) {
    museAsiaRateLimits.set(key, { startedAt: now, count: 1 });
    return next();
  }

  if (current.count >= MUSE_ASIA_REQUEST_LIMIT) {
    return res.status(429).json({
      success: false,
      message: "Too many anime searches. Please wait a minute and try again."
    });
  }

  current.count += 1;
  next();
}

async function searchMuseAsiaVideos(searchTerm) {
  const cleanTerm = String(searchTerm || "").trim();
  const cacheKey = cleanTerm.toLowerCase() || "__latest__";
  const cached = museAsiaCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    const error = new Error("YouTube Data API is not configured on the Peerva server.");
    error.statusCode = 503;
    throw error;
  }

  const url = new URL(`${YOUTUBE_API_BASE}/search`);
  url.search = new URLSearchParams({
    part: "snippet",
    channelId: MUSE_ASIA_CHANNEL_ID,
    type: "video",
    maxResults: "25",
    order: cleanTerm ? "relevance" : "date",
    regionCode: "NG",
    videoEmbeddable: "true",
    videoSyndicated: "true",
    safeSearch: "moderate",
    key: apiKey
  }).toString();
  if (cleanTerm) url.searchParams.set("q", cleanTerm);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      const apiMessage = result?.error?.message || `YouTube API returned HTTP ${response.status}.`;
      const error = new Error(apiMessage);
      error.statusCode = response.status === 403 ? 502 : response.status;
      throw error;
    }

    const videos = (result.items || [])
      .filter(item => item?.id?.videoId && item?.snippet?.channelId === MUSE_ASIA_CHANNEL_ID)
      .map(item => ({
        videoId: item.id.videoId,
        title: item.snippet.title || "Untitled video",
        description: item.snippet.description || "",
        publishedAt: item.snippet.publishedAt || null,
        channelTitle: item.snippet.channelTitle || "Muse Asia",
        thumbnail:
          item.snippet.thumbnails?.high?.url ||
          item.snippet.thumbnails?.medium?.url ||
          item.snippet.thumbnails?.default?.url || "",
        watchUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(item.id.videoId)}`,
        embedUrl: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(item.id.videoId)}`
      }));

    const data = {
      success: true,
      source: "Muse Asia official YouTube channel",
      channelId: MUSE_ASIA_CHANNEL_ID,
      regionCode: "NG",
      query: cleanTerm,
      totalResults: videos.length,
      videos
    };

    museAsiaCache.set(cacheKey, {
      data,
      expiresAt: Date.now() + MUSE_ASIA_CACHE_TTL_MS
    });

    return data;
  } finally {
    clearTimeout(timeout);
  }
}

// Search official Muse Asia videos, or list recent uploads when q is omitted.
app.get(
  "/api/museasia/videos",
  checkMuseAsiaRateLimit,
  async (req, res) => {
    const searchTerm = String(req.query.q || "").trim();

    if (searchTerm && (searchTerm.length < 2 || searchTerm.length > 100)) {
      return res.status(400).json({
        success: false,
        message: "Enter an anime title between 2 and 100 characters."
      });
    }

    try {
      const data = await searchMuseAsiaVideos(searchTerm);
      res.json(data);
    } catch (error) {
      console.error("Muse Asia search error:", error.message);
      res.status(error.statusCode || 502).json({
        success: false,
        message: error.statusCode === 503
          ? error.message
          : "Could not search Muse Asia right now. Check the YouTube API key and try again."
      });
    }
  }
);

// Management routes require a valid Peerva login.
// Set ADMIN_EMAIL in Render to restrict management to your account.
function requireAnimeAdmin(req, res, next) {
  if (typeof authenticateToken !== "function") {
    return res.status(500).json({
      success: false,
      message: "Authentication is not configured."
    });
  }

  authenticateToken(req, res, () => {
    const adminEmail = String(process.env.ADMIN_EMAIL || "")
      .trim()
      .toLowerCase();

    const userEmail = String(
      req.user?.email || req.user?.user?.email || ""
    ).trim().toLowerCase();

    if (!adminEmail) {
      return res.status(503).json({
        success: false,
        message: "Anime management is not configured."
      });
    }

    if (!userEmail || userEmail !== adminEmail) {
      return res.status(403).json({
        success: false,
        message: "Only the Peerva anime administrator can do this."
      });
    }

    next();
  });
}

// Add an episode.
app.post(
  "/api/anime/episodes",
  requireAnimeAdmin,
  requireDatabase,
  async (req, res) => {
    try {

      const {
        animeId,
        animeTitle,
        poster = "",
        season = 1,
        episodeNumber,
        episodeTitle = "",
        videoUrl,
        subtitlesUrl = "",
        description = ""
      } = req.body || {};

      if (
        !animeId ||
        !animeTitle ||
        !videoUrl ||
        !Number.isInteger(Number(season)) ||
        Number(season) < 1 ||
        !Number.isInteger(Number(episodeNumber)) ||
        Number(episodeNumber) < 1
      ) {
        return res.status(400).json({
          success: false,
          message: "Provide animeId, animeTitle, videoUrl, a valid season, and episodeNumber."
        });
      }

      if (
        !isValidAnimeUrl(videoUrl) ||
        !isValidAnimeUrl(poster, true) ||
        !isValidAnimeUrl(subtitlesUrl, true)
      ) {
        return res.status(400).json({
          success: false,
          message: "Video, poster, and subtitle links must be valid HTTP or HTTPS URLs."
        });
      }

      const episode = await AnimeEpisode.create({
        animeId: String(animeId).trim().toLowerCase(),
        animeTitle: String(animeTitle).trim(),
        poster: String(poster).trim(),
        season: Number(season),
        episodeNumber: Number(episodeNumber),
        episodeTitle: String(episodeTitle).trim(),
        videoUrl: String(videoUrl).trim(),
        subtitlesUrl: String(subtitlesUrl).trim(),
        description: String(description).trim()
      });

      res.status(201).json({
        success: true,
        message: "Anime episode added successfully.",
        episode
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message: "That anime season and episode already exist."
        });
      }

      console.error("Add anime episode error:", error);
      res.status(500).json({
        success: false,
        message: "Could not add the episode."
      });
    }
  }
);

// Delete an episode by its MongoDB ID.
app.delete(
  "/api/anime/episodes/:id",
  requireAnimeAdmin,
  requireDatabase,
  async (req, res) => {
    try {

      if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid episode ID."
        });
      }

      const deleted = await AnimeEpisode.findByIdAndDelete(
        req.params.id
      );

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: "Episode not found."
        });
      }

      res.json({
        success: true,
        message: "Episode deleted successfully."
      });
    } catch (error) {
      console.error("Delete anime episode error:", error);
      res.status(500).json({
        success: false,
        message: "Could not delete the episode."
      });
    }
  }
);

/* END PEERVA ANIME API ADD-ON */

/* =========================
   404 AND ERROR HANDLING
========================= */

app.use((req, res) => {
    res.status(404).json({ message: "Route not found." });
});

app.use((error, req, res, next) => {
    console.error("Unhandled error:", error);
    res.status(500).json({ message: "Something went wrong." });
});

process.on("unhandledRejection", reason => {
    console.error("Unhandled promise rejection:", reason);
});


/* =========================
   START SERVER
========================= */

mongoose
    .connect(MONGO_URI, {
        dbName: DB_NAME,
        serverSelectionTimeoutMS: 15000
    })
    .then(() => {
        console.log("MongoDB connected to database:", mongoose.connection.name);

        app.listen(PORT, HOST, () => {
            console.log(`Peerva backend running on ${HOST}:${PORT}`);
        });
    })
    .catch(error => {
        console.error("MongoDB connection error:", error);
        process.exit(1);
    });

==========================================================================================
anime.html
==========================================================================================

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#101010">
  <title>Peerva Anime — Discover Anime</title>
  <meta name="description" content="Discover anime, explore genres, follow airing schedules and watch authorised episodes on Peerva Anime.">
  <link rel="icon" type="image/png" href="images/peerva-icon.png">

  <style>
    :root {
      --bg: #101010;
      --panel: #1b1b1b;
      --panel2: #242424;
      --text: #f5f5f5;
      --muted: #aaa;
      --accent: #ff633e;
      --border: #303030;
    }

    * { box-sizing: border-box; }

    html { scroll-behavior: smooth; }

    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: Arial, Helvetica, sans-serif;
    }

    button, input, select { font: inherit; }
    button { cursor: pointer; }
    a { color: inherit; text-decoration: none; }

    .navbar {
      position: sticky;
      top: 0;
      z-index: 20;
      min-height: 68px;
      padding: 12px 5%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      background: #141414f5;
      border-bottom: 1px solid var(--border);
      backdrop-filter: blur(12px);
    }

    .logo {
      font-size: 23px;
      font-weight: 900;
      letter-spacing: -1px;
      white-space: nowrap;
    }

    .logo span { color: var(--accent); }

    .nav-links {
      display: flex;
      align-items: center;
      gap: 20px;
      font-size: 14px;
      color: #ccc;
    }

    .nav-links a:hover { color: var(--accent); }

    .search {
      width: min(290px, 32vw);
      padding: 11px 13px;
      border: 1px solid #383838;
      border-radius: 9px;
      outline: none;
      background: #242424;
      color: white;
    }

    .search:focus { border-color: var(--accent); }

    main {
      width: min(1250px, 92%);
      margin: auto;
    }

    .hero {
      margin-top: 25px;
      min-height: 290px;
      padding: 36px;
      border: 1px solid #47312b;
      border-radius: 18px;
      background:
        radial-gradient(ellipse at 85% 20%, #ff633e32, transparent 42%),
        linear-gradient(120deg, #30201c, #171717 70%);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      overflow: hidden;
    }

    .hero-copy { max-width: 650px; }

    .eyebrow {
      color: var(--accent);
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 3px;
      text-transform: uppercase;
    }

    .hero h1 {
      margin: 15px 0;
      font-size: clamp(36px, 5vw, 60px);
      line-height: 1.04;
      letter-spacing: -2px;
    }

    .hero p {
      max-width: 550px;
      color: #ccc;
      line-height: 1.7;
    }

    .hero-art {
      font-size: clamp(70px, 12vw, 140px);
      user-select: none;
    }

    .button {
      display: inline-flex;
      justify-content: center;
      align-items: center;
      gap: 8px;
      padding: 11px 16px;
      border: 0;
      border-radius: 8px;
      background: var(--accent);
      color: white;
      font-weight: 700;
      font-size: 13px;
    }

    .button:hover { background: #e94e2b; }

    .button.secondary {
      background: #303030;
      border: 1px solid #444;
    }

    .button.secondary:hover { background: #3b3b3b; }

    .section-heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin: 35px 0 18px;
    }

    .section-heading h2 {
      margin: 0;
      font-size: 23px;
    }

    .section-heading p {
      color: var(--muted);
      margin: 7px 0 0;
      font-size: 13px;
    }

    .tabs, .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 9px;
      margin-bottom: 18px;
    }

    .tab, .filter {
      padding: 9px 14px;
      border: 1px solid #373737;
      border-radius: 30px;
      background: #202020;
      color: #ccc;
      font-size: 13px;
    }

    .tab.active, .filter.active,
    .tab:hover, .filter:hover {
      background: var(--accent);
      border-color: var(--accent);
      color: white;
    }

    .status {
      margin: 16px 0;
      padding: 13px 15px;
      background: #1d1d1d;
      border: 1px solid var(--border);
      border-radius: 10px;
      color: #bbb;
      font-size: 13px;
      line-height: 1.6;
    }

    .status.error {
      color: #ffb6a5;
      border-color: #704034;
    }

    .anime-grid {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 18px;
    }

    .anime-card {
      min-width: 0;
      overflow: hidden;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: var(--panel);
      transition: transform .2s, border-color .2s;
    }

    .anime-card:hover {
      transform: translateY(-4px);
      border-color: #754438;
    }

    .poster {
      height: 245px;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #252525;
      overflow: hidden;
    }

    .poster img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .poster-fallback {
      font-size: 50px;
    }

    .score, .format-tag {
      position: absolute;
      top: 8px;
      padding: 6px 8px;
      background: #101010df;
      border-radius: 6px;
      font-size: 10px;
      font-weight: bold;
    }

    .score { right: 8px; }
    .format-tag { left: 8px; }

    .card-content { padding: 12px; }

    .card-content h3 {
      font-size: 14px;
      line-height: 1.45;
      margin: 0 0 8px;
      min-height: 40px;
    }

    .meta {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.6;
      min-height: 37px;
    }

    .card-actions {
      display: flex;
      gap: 7px;
      margin-top: 11px;
    }

    .card-actions .button {
      flex: 1;
      padding: 9px 5px;
      font-size: 11px;
      min-width: 0;
    }

    .empty {
      display: none;
      padding: 40px 15px;
      text-align: center;
      color: var(--muted);
      grid-column: 1 / -1;
    }

    .pagination {
      display: flex;
      justify-content: center;
      gap: 12px;
      align-items: center;
      margin: 25px 0;
    }

    .pagination span {
      color: var(--muted);
      font-size: 13px;
    }

    .player-section {
      display: none;
      margin-top: 35px;
      padding: 20px;
      border: 1px solid var(--border);
      border-radius: 14px;
      background: var(--panel);
      scroll-margin-top: 85px;
    }

    .player-section.show { display: block; }

    .player-section h2 { margin-top: 0; }

    .player-section video {
      display: block;
      width: 100%;
      max-height: 650px;
      background: #000;
      border-radius: 10px;
    }

    .player-section .youtube-player {
      display: block;
      width: 100%;
      aspect-ratio: 16 / 9;
      border: 0;
      border-radius: 10px;
      background: #000;
    }

    .player-info {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 14px;
      margin-top: 14px;
    }

    .player-info p {
      color: var(--muted);
      font-size: 13px;
      line-height: 1.6;
    }

    .details-section {
      display: none;
      margin-top: 20px;
      padding: 20px;
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 14px;
    }

    .details-section.show { display: block; }

    .details-layout {
      display: flex;
      gap: 20px;
      align-items: flex-start;
    }

    .details-layout img {
      width: 145px;
      border-radius: 8px;
    }

    .details-layout p {
      color: #c4c4c4;
      line-height: 1.7;
      font-size: 14px;
    }

    .details-layout a { color: var(--accent); }

    .airing-list {
      display: grid;
      gap: 10px;
    }

    .airing-item {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 13px;
      border: 1px solid var(--border);
      background: var(--panel);
      border-radius: 9px;
    }

    .airing-item small { color: var(--muted); }

    footer {
      margin-top: 50px;
      padding: 28px 5%;
      border-top: 1px solid var(--border);
      color: var(--muted);
      text-align: center;
      font-size: 13px;
      line-height: 1.8;
    }

    @media (max-width: 1050px) {
      .anime-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
      .poster { height: 230px; }
    }

    @media (max-width: 760px) {
      .navbar {
        padding: 12px 4%;
        flex-wrap: wrap;
        gap: 12px;
      }

      .nav-links {
        order: 3;
        width: 100%;
        justify-content: center;
      }

      .search { width: 48%; }
      .hero { padding: 25px; }
      .hero-art { display: none; }

      .anime-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
      }

      .poster { height: 205px; }
    }

    @media (max-width: 520px) {
      .logo { font-size: 20px; }
      .nav-links { gap: 15px; font-size: 13px; }

      .anime-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .poster { height: 230px; }

      .hero { min-height: 240px; }
      .details-layout img { width: 105px; }
      .details-layout { gap: 12px; }
    }

    @media (max-width: 350px) {
      .poster { height: 180px; }
      .card-content { padding: 9px; }
    }
  
    .search-form { display:flex; gap:8px; align-items:center; }
    .search-form .search { width:min(290px,32vw); }
    .search-form button { white-space:nowrap; }
    .anime-card .poster { cursor:pointer; }
    .anime-card .poster img { transition:transform .2s; }
    .anime-card:hover .poster img { transform:scale(1.04); }
    .catalogue-note { color:var(--muted); font-size:13px; line-height:1.7; }
    @media (max-width:760px) {
      .search-form { width:100%; order:4; }
      .search-form .search { width:100%; flex:1; }
    }
  </style>
</head>
<body>
  <header class="navbar">
    <a class="logo" href="anime.html">PEERVA<span> ANIME</span></a>
    <nav class="nav-links">
      <a href="#home">Home</a>
      <a href="#catalogue">Latest</a>
      <a href="https://www.youtube.com/@MuseAsia" target="_blank" rel="noopener noreferrer">Muse Asia ↗</a>
      <a href="index.html">Peerva</a>
    </nav>
    <form id="searchForm" class="search-form">
      <input id="searchInput" class="search" type="search" maxlength="100" placeholder="Search anime on Muse Asia…" aria-label="Search anime on Muse Asia">
      <button class="button" type="submit">Search</button>
    </form>
  </header>

  <main>
    <section class="hero" id="home">
      <div class="hero-copy">
        <div class="eyebrow">Official Muse Asia videos</div>
        <h1>Your next anime<br>starts here.</h1>
        <p>Discover official anime uploads from Muse Asia and watch available videos inside Peerva using YouTube's embedded player.</p>
        <button class="button" id="exploreBtn" type="button">Explore videos →</button>
      </div>
      <div class="hero-art" aria-hidden="true">⛩️</div>
    </section>

    <section id="catalogue">
      <div class="section-heading">
        <div>
          <h2 id="sectionTitle">Latest Muse Asia uploads</h2>
          <p id="resultCount">Connecting to Muse Asia…</p>
        </div>
      </div>

      <p class="catalogue-note">Peerva searches Muse Asia's official YouTube channel. The results are filtered for videos YouTube lists as available in Nigeria. Catalogue and playback availability can change by title.</p>

      <div class="status" id="status" role="status">Loading official Muse Asia uploads…</div>
      <div class="anime-grid" id="animeGrid"></div>
      <div class="empty" id="emptyMessage">
        <h3>No videos found</h3>
        <p>Try searching for another anime title.</p>
      </div>
    </section>

    <section class="details-section" id="details">
      <button class="button secondary" id="closeDetails" type="button">✕ Close details</button>
      <div class="details-layout" style="margin-top:18px">
        <img id="detailsPoster" src="" alt="Anime thumbnail">
        <div>
          <h2 id="detailsTitle"></h2>
          <p id="detailsMeta"></p>
          <p id="detailsDescription"></p>
          <a id="detailsLink" href="https://www.youtube.com/@MuseAsia" target="_blank" rel="noopener noreferrer">Open Muse Asia ↗</a>
          <p id="detailsAiring">Muse Asia does not provide a complete public airing schedule through this search.</p>
          <div id="detailsActions" class="card-actions"></div>
        </div>
      </div>
    </section>

    <section class="player-section" id="player">
      <h2 id="playerTitle">Peerva Video Player</h2>
      <iframe id="youtubePlayer" class="youtube-player" title="Official Muse Asia anime video" hidden
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
      <div class="player-info">
        <div>
          <strong id="episodeTitle">Choose an available video</strong>
          <p id="playerDescription">This player embeds the selected video from Muse Asia's official YouTube channel.</p>
        </div>
        <a id="openOnYoutube" class="button secondary" href="https://www.youtube.com/@MuseAsia" target="_blank" rel="noopener noreferrer">Open on YouTube ↗</a>
      </div>
      <div class="status" id="playerNotice">If a video cannot play, YouTube may have restricted it in your location or disabled embedding.</div>
    </section>

    <div class="status">Anime videos are provided by Muse Asia's official YouTube channel. Peerva does not download, copy, or re-host those videos. Playback and territory restrictions are controlled by YouTube and the rights holders.</div>
  </main>

  <footer>
    <strong>PEERVA ANIME</strong><br>
    Discover official anime uploads and watch on YouTube.<br>
    <a href="https://www.youtube.com/@MuseAsia" target="_blank" rel="noopener noreferrer">Visit Muse Asia ↗</a>
  </footer>

  <script>
    "use strict";

    const PEERVA_BACKEND = "https://peerva-backend.onrender.com";
    const MUSE_ASIA_CHANNEL_URL = "https://www.youtube.com/@MuseAsia";
    const $ = id => document.getElementById(id);
    const grid = $("animeGrid");
    const state = { videos: [], requestNumber: 0, search: "" };

    function setStatus(message, isError = false) {
      const box = $("status");
      box.textContent = message;
      box.classList.toggle("error", isError);
      box.style.display = "block";
    }

    function validVideoId(value) {
      return typeof value === "string" && /^[A-Za-z0-9_-]{11}$/.test(value);
    }

    function formatDate(value) {
      if (!value) return "Date unavailable";
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? "Date unavailable" :
        date.toLocaleDateString(undefined, { year:"numeric", month:"short", day:"numeric" });
    }

    function animeTitleFromVideo(title) {
      return String(title || "Anime video")
        .replace(/\s*[\[(](?:english\s*)?(?:sub|dub|1080p|720p)[^\])]*[\])]/ig, "")
        .replace(/\s*[-–|:]\s*(?:full\s*)?(?:episode|ep\.?|#)\s*\d+.*$/i, "")
        .replace(/\s+(?:episode|ep\.?)\s*\d+.*$/i, "")
        .replace(/\s*\(official[^)]*\)\s*/ig, "")
        .trim() || String(title || "Anime video");
    }

    function openPlayer(video) {
      if (!video || !validVideoId(video.videoId)) return;
      const frame = $("youtubePlayer");
      frame.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.videoId)}?autoplay=1&rel=0&playsinline=1`;
      frame.title = video.title || "Muse Asia anime video";
      frame.hidden = false;
      $("player").classList.add("show");
      $("playerTitle").textContent = animeTitleFromVideo(video.title);
      $("episodeTitle").textContent = video.title || "Muse Asia video";
      $("playerDescription").textContent = `Published ${formatDate(video.publishedAt)} by ${video.channelTitle || "Muse Asia"}.`;
      $("openOnYoutube").href = video.watchUrl || `https://www.youtube.com/watch?v=${encodeURIComponent(video.videoId)}`;
      $("playerNotice").textContent = "Playback is handled by YouTube. If the video is blocked, unavailable, or cannot be embedded, open it on YouTube or choose another video.";
      $("player").scrollIntoView({ behavior:"smooth", block:"start" });
    }

    function openDetails(video) {
      const title = animeTitleFromVideo(video.title);
      $("details").classList.add("show");
      $("detailsPoster").src = video.thumbnail || "";
      $("detailsPoster").hidden = !video.thumbnail;
      $("detailsTitle").textContent = title;
      $("detailsMeta").textContent = `Muse Asia · Published ${formatDate(video.publishedAt)}`;
      $("detailsDescription").textContent = video.description || "No description was provided for this upload.";
      $("detailsLink").href = video.watchUrl || MUSE_ASIA_CHANNEL_URL;
      $("detailsActions").replaceChildren();

      const more = document.createElement("a");
      more.className = "button";
      more.href = `anime-details.html?title=${encodeURIComponent(title)}&poster=${encodeURIComponent(video.thumbnail || "")}`;
      more.textContent = "Find more videos";
      $("detailsActions").appendChild(more);
      $("details").scrollIntoView({ behavior:"smooth", block:"start" });
    }

    function renderVideos(videos) {
      grid.replaceChildren();
      $("emptyMessage").style.display = videos.length ? "none" : "block";
      $("resultCount").textContent = `${videos.length} official video${videos.length === 1 ? "" : "s"} returned`;

      if (!videos.length) {
        $("emptyMessage").querySelector("p").textContent = state.search
          ? "No matching Muse Asia videos were returned for this title in YouTube's Nigeria-region search. Try another title."
          : "No recent Muse Asia videos were returned as available in Nigeria. Try searching for a title or open the official channel.";
        return;
      }

      videos.forEach(video => {
        if (!validVideoId(video.videoId)) return;
        const card = document.createElement("article");
        card.className = "anime-card";

        const poster = document.createElement("div");
        poster.className = "poster";
        const image = document.createElement("img");
        image.src = video.thumbnail || "";
        image.alt = "";
        image.loading = "lazy";
        image.onerror = () => image.remove();
        if (video.thumbnail) poster.appendChild(image);
        else poster.textContent = "⛩️";

        const source = document.createElement("span");
        source.className = "format-tag";
        source.textContent = "MUSE ASIA";
        poster.appendChild(source);

        const content = document.createElement("div");
        content.className = "card-content";
        const title = document.createElement("h3");
        title.textContent = video.title || "Untitled video";
        title.title = title.textContent;
        const meta = document.createElement("div");
        meta.className = "meta";
        meta.textContent = `Published ${formatDate(video.publishedAt)} · ${video.channelTitle || "Muse Asia"}`;
        const actions = document.createElement("div");
        actions.className = "card-actions";

        const watch = document.createElement("button");
        watch.className = "button";
        watch.type = "button";
        watch.textContent = "▶ Watch";
        watch.addEventListener("click", () => openPlayer(video));

        const details = document.createElement("button");
        details.className = "button secondary";
        details.type = "button";
        details.textContent = "More";
        details.addEventListener("click", () => openDetails(video));

        actions.append(watch, details);
        content.append(title, meta, actions);
        card.append(poster, content);
        grid.appendChild(card);
      });
    }

    async function loadVideos(search = "") {
      const requestId = ++state.requestNumber;
      state.search = String(search || "").trim();
      grid.replaceChildren();
      $("emptyMessage").style.display = "none";
      $("sectionTitle").textContent = state.search ? `Search: ${state.search}` : "Latest Muse Asia uploads";
      $("resultCount").textContent = "Loading…";
      setStatus(state.search ? `Searching Muse Asia for “${state.search}”…` : "Loading latest official Muse Asia uploads…");

      try {
        const endpoint = `${PEERVA_BACKEND}/api/museasia/videos${state.search ? `?q=${encodeURIComponent(state.search)}` : ""}`;
        const response = await fetch(endpoint);
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.message || `Peerva backend returned HTTP ${response.status}.`);
        if (requestId !== state.requestNumber) return;

        state.videos = Array.isArray(result.videos) ? result.videos : [];
        renderVideos(state.videos);
        setStatus(state.videos.length
          ? `Loaded ${state.videos.length} videos from Muse Asia's official channel. YouTube filters results for Nigeria (NG).`
          : "No videos were returned. This can happen when no matching Muse Asia uploads are available in Nigeria.");
      } catch (error) {
        if (requestId !== state.requestNumber) return;
        console.error("Muse Asia catalogue error:", error);
        state.videos = [];
        renderVideos([]);
        setStatus(error.message, true);
      }
    }

    $("searchForm").addEventListener("submit", event => {
      event.preventDefault();
      loadVideos($("searchInput").value);
      $("catalogue").scrollIntoView({ behavior:"smooth", block:"start" });
    });

    $("exploreBtn").addEventListener("click", () => {
      $("catalogue").scrollIntoView({ behavior:"smooth", block:"start" });
    });

    $("closeDetails").addEventListener("click", () => {
      $("details").classList.remove("show");
    });

    loadVideos();
  </script>
</body>
</html>


==========================================================================================
anime-details.html
==========================================================================================


<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#111927">
  <title>Anime Details — Peerva Anime</title>
  <meta name="description" content="Explore anime details on Peerva Anime.">
  <link rel="icon" type="image/png" href="images/peerva-icon.png">


    
<style>
  :root {
    --bg: #101010;
    --panel: #1b1b1b;
    --panel2: #242424;
    --text: #f5f5f5;
    --muted: #aaa;
    --accent: #ff633e;
    --border: #303030;
  }

  * { box-sizing: border-box; }

  html { scroll-behavior: smooth; }

  body {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font-family: Arial, Helvetica, sans-serif;
  }

  button, input, select { font: inherit; }
  button { cursor: pointer; }
  a { color: inherit; text-decoration: none; }

  .navbar {
    position: sticky;
    top: 0;
    z-index: 20;
    min-height: 68px;
    padding: 12px 5%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    background: #141414f5;
    border-bottom: 1px solid var(--border);
    backdrop-filter: blur(12px);
  }

  .logo {
    font-size: 23px;
    font-weight: 900;
    letter-spacing: -1px;
    white-space: nowrap;
  }

  .logo span { color: var(--accent); }

  .nav-links {
    display: flex;
    align-items: center;
    gap: 20px;
    font-size: 14px;
    color: #ccc;
  }

  .nav-links a:hover { color: var(--accent); }

  main {
    width: min(1250px, 92%);
    margin: auto;
  }

  .banner {
    height: 320px;
    position: relative;
    overflow: hidden;
    background:
      radial-gradient(ellipse at 80% 20%, #ff633e35, transparent 45%),
      linear-gradient(120deg, #30201c, #171717);
  }

  .banner img {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
    object-position: center 30%;
  }

  .banner::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(
      to bottom,
      #10101020,
      #10101055 65%,
      var(--bg)
    );
    pointer-events: none;
  }

  .hero {
    display: grid;
    grid-template-columns: 215px minmax(0, 1fr);
    gap: 30px;
    position: relative;
    z-index: 2;
    margin-top: -115px;
  }

  .poster-column { min-width: 0; }

  .poster {
    display: block;
    width: 100%;
    aspect-ratio: 2 / 3;
    object-fit: cover;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--panel2);
  }

  .poster-buttons {
    display: grid;
    gap: 9px;
    margin-top: 14px;
  }

  .button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 11px 16px;
    min-height: 42px;
    border: 0;
    border-radius: 8px;
    background: var(--accent);
    color: white;
    font-size: 13px;
    font-weight: 700;
    text-align: center;
  }

  .button:hover { background: #e94e2b; }

  .button.secondary {
    background: #303030;
    border: 1px solid #444;
    color: white;
  }

  .button.secondary:hover { background: #3b3b3b; }

  .button:disabled {
    cursor: not-allowed;
    opacity: .5;
  }

  .details {
    min-width: 0;
    padding-top: 115px;
  }

  .eyebrow {
    color: var(--accent);
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 3px;
    text-transform: uppercase;
  }

  h1 {
    margin: 15px 0;
    font-size: clamp(30px, 4.5vw, 48px);
    line-height: 1.1;
    letter-spacing: -1.5px;
  }

  .description {
    color: #ccc;
    font-size: 14px;
    line-height: 1.8;
    white-space: pre-line;
  }

  .source {
    margin-top: 20px;
    color: var(--muted);
    font-size: 12px;
  }

  .stats {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
    margin-top: 25px;
  }

  .stat {
    padding: 14px;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 10px;
    min-width: 0;
  }

  .stat-label {
    display: block;
    margin-bottom: 8px;
    color: var(--muted);
    font-size: 11px;
  }

  .stat-value {
    font-size: 14px;
    font-weight: 700;
    overflow-wrap: anywhere;
  }

  .section {
    margin-top: 28px;
    padding: 22px;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 12px;
  }

  .section h2 {
    margin: 0 0 17px;
    font-size: 21px;
  }

  .genres {
    display: flex;
    flex-wrap: wrap;
    gap: 9px;
  }

  .genre {
    padding: 9px 13px;
    background: #242424;
    border: 1px solid #373737;
    border-radius: 30px;
    color: #ddd;
    font-size: 12px;
  }

  .genre:hover {
    background: var(--accent);
    border-color: var(--accent);
    color: white;
  }

  .airing-box {
    color: #ccc;
    font-size: 14px;
    line-height: 1.9;
    white-space: pre-line;
  }

  .action-row {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 18px;
  }

  .status {
    margin-top: 20px;
    padding: 13px 15px;
    background: #1d1d1d;
    border: 1px solid var(--border);
    border-radius: 10px;
    color: #bbb;
    font-size: 13px;
    line-height: 1.7;
  }

  .status.error {
    color: #ffb6a5;
    border-color: #704034;
  }

  .loading {
    padding: 65px 15px;
    color: var(--muted);
    text-align: center;
  }

  .bottom-links {
    display: flex;
    flex-wrap: wrap;
    gap: 18px;
    margin-top: 25px;
    color: var(--muted);
    font-size: 13px;
  }

  .bottom-links a:hover { color: var(--accent); }

  footer {
    margin-top: 50px;
    padding: 28px 5%;
    border-top: 1px solid var(--border);
    color: var(--muted);
    text-align: center;
    font-size: 13px;
    line-height: 1.8;
  }

  [hidden] { display: none !important; }

  @media (max-width: 900px) {
    .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }

  @media (max-width: 700px) {
    .navbar {
      padding: 12px 4%;
      flex-wrap: wrap;
      gap: 12px;
    }

    .nav-links {
      order: 3;
      width: 100%;
      justify-content: center;
      gap: 17px;
    }

    .banner { height: 245px; }

    .hero {
      grid-template-columns: 125px minmax(0, 1fr);
      gap: 17px;
      margin-top: -75px;
    }

    .details { padding-top: 78px; }
    .eyebrow { letter-spacing: 2px; }
    h1 { font-size: clamp(24px, 5vw, 34px); }
    .description { font-size: 13px; line-height: 1.7; }
    .section { padding: 17px; }
    .poster-buttons .button { padding: 10px 5px; font-size: 11px; }
  }

  @media (max-width: 420px) {
    .logo { font-size: 20px; }
    .nav-links { font-size: 12px; gap: 13px; }
    .hero { grid-template-columns: 100px minmax(0, 1fr); gap: 13px; }
    .details { padding-top: 76px; }
    .stats { gap: 8px; }
    .stat { padding: 10px; }
    .stat-value { font-size: 12px; }
  }

  .provider-episodes {
    margin-top: 18px;
    padding: 16px;
    background: #171717;
    border: 1px solid var(--border);
    border-radius: 12px;
  }

  .provider-episodes h3 {
    margin: 0 0 8px;
    font-size: 17px;
  }

  .episode-help {
    margin: 0 0 14px;
    color: var(--muted);
    font-size: 12px;
    line-height: 1.6;
  }

  .episode-list {
    display: grid;
    gap: 9px;
  }

  .episode-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 11px;
    background: #222;
    border: 1px solid #333;
    border-radius: 9px;
  }

  .episode-meta { min-width: 0; }
  .episode-number { color: var(--accent); font-weight: 700; font-size: 12px; }
  .episode-title {
    margin-top: 4px;
    color: var(--text);
    font-size: 13px;
    overflow-wrap: anywhere;
  }

  .episode-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
    flex-shrink: 0;
  }

  .episode-actions button {
    padding: 8px 11px;
    color: #fff;
    background: var(--accent);
    border: 0;
    border-radius: 7px;
    font-size: 12px;
    font-weight: 700;
  }

  .episode-actions button.secondary-track {
    background: #3a3a3a;
  }

  .episode-actions button:disabled {
    opacity: .45;
    cursor: not-allowed;
  }

  @media (max-width: 520px) {
    .episode-row { align-items: flex-start; flex-direction: column; }
    .episode-actions { width: 100%; }
  }



  .muse-search {
    display: flex;
    gap: 10px;
    margin: 18px 0;
  }
  .muse-search input {
    flex: 1;
    min-width: 0;
    padding: 12px 14px;
    color: var(--text);
    background: #242424;
    border: 1px solid #444;
    border-radius: 8px;
  }
  .episode-row { align-items: center; }
  .episode-thumb {
    width: 145px;
    aspect-ratio: 16 / 9;
    object-fit: cover;
    border-radius: 7px;
    background: #111;
    flex-shrink: 0;
  }
  .episode-meta { flex: 1; }
  .episode-actions a {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 8px 11px;
    color: #fff;
    background: #383838;
    border-radius: 7px;
    font-size: 12px;
    font-weight: 700;
  }
  @media (max-width: 520px) {
    .muse-search { flex-direction: column; }
    .episode-row { align-items: flex-start; }
    .episode-thumb { width: 100%; max-width: 230px; }
    .episode-actions { width: 100%; }
  }

</style>
</head>
<body>
  <header class="navbar">
    <a class="logo" href="anime.html">PEERVA<span> ANIME</span></a>
    <nav class="nav-links">
      <a href="anime.html">Explore Anime</a>
      <a href="index.html">Peerva Home</a>
      <a href="https://www.youtube.com/@MuseAsia" target="_blank" rel="noopener noreferrer">Muse Asia ↗</a>
    </nav>
  </header>

  <div class="banner" id="banner"><img id="bannerImage" alt="" hidden></div>

  <main>
    <div id="loading" class="loading">Searching Muse Asia's official YouTube channel…</div>

    <div id="pageContent" hidden>
      <section class="hero">
        <aside class="poster-column">
          <img id="poster" class="poster" alt="Anime video thumbnail" hidden>
          <div class="poster-buttons">
            <button id="watchButton" class="button" type="button" disabled>▶ Watch on Peerva</button>
            <a id="officialLink" class="button secondary" href="https://www.youtube.com/@MuseAsia" target="_blank" rel="noopener noreferrer">Open Muse Asia ↗</a>
          </div>
        </aside>

        <div class="details">
          <div class="eyebrow">Peerva Anime · Official uploads</div>
          <h1 id="animeTitle">Anime</h1>
          <div id="description" class="description">
            Search results from Muse Asia's official YouTube channel.
          </div>
          <p class="source">Videos are supplied by Muse Asia through YouTube. Availability and embedding depend on the rights and settings for each video.</p>
          <div class="stats">
            <div class="stat"><span class="stat-label">Source</span><span class="stat-value">Muse Asia</span></div>
            <div class="stat"><span class="stat-label">Video results</span><span class="stat-value" id="episodes">—</span></div>
            <div class="stat"><span class="stat-label">Region filter</span><span class="stat-value">Nigeria</span></div>
            <div class="stat"><span class="stat-label">Latest upload</span><span class="stat-value" id="year">—</span></div>
          </div>
        </div>
      </section>

      <section class="section">
        <h2>Find anime on Muse Asia</h2>
        <form id="searchForm" class="muse-search">
          <input id="searchInput" type="search" maxlength="100" placeholder="Enter an anime title…" required>
          <button class="button" type="submit">Search</button>
        </form>
        <p class="episode-help">Peerva searches only Muse Asia's official YouTube channel and asks YouTube to return videos available in Nigeria. Search results do not guarantee that a video will play; YouTube can apply additional restrictions.</p>
      </section>

      <section class="section">
        <h2>Available episodes and videos</h2>
        <div id="episodeStatus" class="status" role="status">Loading official Muse Asia videos…</div>
        <div id="episodeList" class="episode-list"></div>
      </section>

      <section class="section">
        <h2>Watch on Peerva</h2>
        <div id="watchStatus" class="status" role="status">Choose an official Muse Asia video below.</div>
        <div id="videoArea" hidden>
          <iframe id="youtubePlayer" title="Official Muse Asia anime video" hidden
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerpolicy="strict-origin-when-cross-origin" allowfullscreen
            style="width:100%;aspect-ratio:16/9;border:0;background:#000;border-radius:8px;margin-top:18px"></iframe>
        </div>
      </section>
    </div>

    <div id="errorBox" class="status error" hidden>
      Could not load this anime. Return to the catalogue and try again.
    </div>

    <div class="bottom-links">
      <a href="anime.html">← Back to anime catalogue</a>
      <a href="index.html">Back to Peerva</a>
    </div>
  </main>

  <footer>
    <strong>PEERVA ANIME</strong><br>
    Official anime videos from Muse Asia's YouTube channel.<br>
    Video availability is controlled by YouTube and the rights holder.
  </footer>

  <script>
    "use strict";

    const PEERVA_BACKEND = "https://peerva-backend.onrender.com";
    const MUSE_ASIA_CHANNEL_URL = "https://www.youtube.com/@MuseAsia";
    const $ = id => document.getElementById(id);
    const params = new URLSearchParams(window.location.search);
    let currentVideos = [];

    function showError(message) {
      $("loading").hidden = true;
      $("pageContent").hidden = true;
      $("errorBox").hidden = false;
      $("errorBox").textContent = message;
    }

    function validVideoId(value) {
      return typeof value === "string" && /^[A-Za-z0-9_-]{11}$/.test(value);
    }

    function formatDate(value) {
      if (!value) return "Date unavailable";
      const date = new Date(value);
      return Number.isNaN(date.getTime())
        ? "Date unavailable"
        : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    }

    function playVideo(video) {
      if (!video || !validVideoId(video.videoId)) return;

      const frame = $("youtubePlayer");
      frame.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.videoId)}?autoplay=1&rel=0&playsinline=1`;
      frame.title = video.title || "Muse Asia anime video";
      frame.hidden = false;
      $("videoArea").hidden = false;
      $("watchStatus").textContent = `Playing: ${video.title}. If YouTube reports that the video is unavailable, it may be restricted in your country or embedding may be disabled.`;
      $("videoArea").scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function renderVideos(videos) {
      const list = $("episodeList");
      list.replaceChildren();
      currentVideos = videos;

      $("episodes").textContent = String(videos.length);
      $("watchButton").disabled = videos.length === 0;

      if (!videos.length) {
        $("episodeStatus").textContent = "No Muse Asia videos were returned for this title in the Nigeria region search. This may be because the title is not on the channel or its licensing does not cover Nigeria.";
        $("watchStatus").textContent = "No playable video was found. You can still open Muse Asia's official channel.";
        return;
      }

      $("episodeStatus").textContent = `${videos.length} official Muse Asia video${videos.length === 1 ? "" : "s"} found. Select one to play.`;
      const latest = videos.map(video => video.publishedAt).filter(Boolean).sort().at(-1);
      $("year").textContent = latest ? new Date(latest).getFullYear() : "—";

      if (videos[0].thumbnail) {
        $("poster").src = videos[0].thumbnail;
        $("poster").alt = `${$("animeTitle").textContent} thumbnail`;
        $("poster").hidden = false;
        $("bannerImage").src = videos[0].thumbnail;
        $("bannerImage").hidden = false;
      }

      videos.forEach((video, index) => {
        if (!validVideoId(video.videoId)) return;

        const row = document.createElement("article");
        row.className = "episode-row";

        const image = document.createElement("img");
        image.className = "episode-thumb";
        image.loading = "lazy";
        image.alt = "";
        image.src = video.thumbnail || "";

        const meta = document.createElement("div");
        meta.className = "episode-meta";

        const number = document.createElement("div");
        number.className = "episode-number";
        number.textContent = `MUSE ASIA VIDEO ${index + 1}`;

        const title = document.createElement("div");
        title.className = "episode-title";
        title.textContent = video.title || "Untitled video";

        const date = document.createElement("div");
        date.className = "episode-help";
        date.textContent = `Published: ${formatDate(video.publishedAt)}`;

        meta.append(number, title, date);

        const actions = document.createElement("div");
        actions.className = "episode-actions";

        const play = document.createElement("button");
        play.type = "button";
        play.textContent = "▶ Play";
        play.addEventListener("click", () => playVideo(video));

        const youtube = document.createElement("a");
        youtube.href = video.watchUrl || `https://www.youtube.com/watch?v=${encodeURIComponent(video.videoId)}`;
        youtube.target = "_blank";
        youtube.rel = "noopener noreferrer";
        youtube.textContent = "YouTube ↗";

        actions.append(play, youtube);
        row.append(image, meta, actions);
        list.append(row);
      });

      $("watchButton").onclick = () => playVideo(currentVideos[0]);
      $("watchStatus").textContent = "Choose an episode or video to start watching.";
    }

    async function searchMuseAsia(title) {
      const cleanTitle = String(title || "").trim();
      if (cleanTitle.length < 2 || cleanTitle.length > 100) {
        throw new Error("The anime title is missing or invalid. Open this page using anime-details.html?title=Anime%20Name.");
      }

      $("loading").hidden = false;
      $("loading").textContent = `Searching Muse Asia for “${cleanTitle}”…`;
      $("errorBox").hidden = true;
      $("pageContent").hidden = false;
      $("animeTitle").textContent = cleanTitle;
      $("searchInput").value = cleanTitle;
      document.title = `${cleanTitle} — Peerva Anime`;
      $("officialLink").href = MUSE_ASIA_CHANNEL_URL;
      $("description").textContent = `Official YouTube search results for ${cleanTitle} from Muse Asia. Only videos returned by YouTube's Nigeria-region search are listed.`;
      $("information").textContent = "Source: Muse Asia official YouTube channel\nPlayback: YouTube embedded player\nRegion filter: Nigeria (NG)\nAvailability: Depends on each title's licence and YouTube settings.";
      $("nextEpisode").textContent = "Muse Asia's YouTube channel does not provide a complete public episode schedule through this search.";
      $("genres").textContent = "Genre information is not supplied by the Muse Asia channel search.";
      $("score").textContent = "Not provided";
      $("format").textContent = "Official YouTube uploads";
      $("episodes").textContent = "…";
      $("year").textContent = "—";
      $("loading").hidden = true;

      const response = await fetch(`${PEERVA_BACKEND}/api/museasia/videos?q=${encodeURIComponent(cleanTitle)}`);
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.message || `Peerva backend returned HTTP ${response.status}.`);
      }

      renderVideos(Array.isArray(result.videos) ? result.videos : []);
    }

    $("searchForm").addEventListener("submit", event => {
      event.preventDefault();
      const title = $("searchInput").value.trim();
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set("title", title);
      nextUrl.searchParams.delete("id");
      window.history.replaceState({}, "", nextUrl);
      searchMuseAsia(title).catch(error => {
        console.error("Muse Asia search failed:", error);
        showError(error.message);
      });
    });

    const initialTitle = params.get("title") || params.get("name") || params.get("q") || "";
    const suppliedPoster = params.get("poster");
    if (suppliedPoster) {
      try {
        const posterUrl = new URL(suppliedPoster);
        if (posterUrl.protocol === "https:") {
          $("poster").src = posterUrl.toString();
          $("poster").hidden = false;
        }
      } catch (_) { /* Ignore invalid optional poster URLs. */ }
    }

    searchMuseAsia(initialTitle).catch(error => {
      console.error("Peerva Muse Asia details error:", error);
      showError(error.message);
    });
  </script>
</body>
</html>
