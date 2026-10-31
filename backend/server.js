

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


  
    
