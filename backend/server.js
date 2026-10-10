const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

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

if (!JWT_SECRET) {
    console.error("JWT_SECRET is not set. Add it in your Render environment variables.");
    process.exit(1);
}

if (!MONGO_URI) {
    console.error("MONGO_URI is not set. Add it in your Render environment variables.");
    process.exit(1);
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
        text: { type: String, required: true }
    },
    { timestamps: true }
);

messageSchema.index({ senderId: 1, receiverId: 1, createdAt: 1 });

const User = mongoose.model("User", userSchema);
const Message = mongoose.model("Message", messageSchema);


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

    } catch (error) {
        console.error("Send message error:", error);
        res.status(500).json({ message: "Something went wrong." });
    }
});


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
