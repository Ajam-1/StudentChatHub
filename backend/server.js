const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();

/* =========================
   CONFIG
========================= */

const PORT = process.env.PORT || 5000;
const HOST = "0.0.0.0";

const JWT_SECRET =
    process.env.JWT_SECRET || "peerva-development-secret";

const USERS_FILE =
    path.join(__dirname, "users.json");

const MESSAGES_FILE =
    path.join(__dirname, "messages.json");


/* =========================
   MIDDLEWARE
========================= */

app.use(
    cors({
        origin: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: [
            "Content-Type",
            "Authorization"
        ]
    })
);

app.use(express.json());


/* =========================
   FILE HELPERS
========================= */

function ensureFile(file, defaultData) {

    if (!fs.existsSync(file)) {

        fs.writeFileSync(
            file,
            JSON.stringify(defaultData, null, 2)
        );

    }

}


function getUsers() {

    ensureFile(USERS_FILE, []);

    try {

        return JSON.parse(
            fs.readFileSync(
                USERS_FILE,
                "utf8"
            )
        );

    } catch (error) {

        console.error(
            "Could not read users.json:",
            error
        );

        return [];

    }

}


function saveUsers(users) {

    fs.writeFileSync(
        USERS_FILE,
        JSON.stringify(
            users,
            null,
            2
        )
    );

}


function getMessages() {

    ensureFile(MESSAGES_FILE, []);

    try {

        return JSON.parse(
            fs.readFileSync(
                MESSAGES_FILE,
                "utf8"
            )
        );

    } catch (error) {

        console.error(
            "Could not read messages.json:",
            error
        );

        return [];

    }

}


function saveMessages(messages) {

    fs.writeFileSync(
        MESSAGES_FILE,
        JSON.stringify(
            messages,
            null,
            2
        )
    );

}


/* =========================
   SAFE USER
========================= */

function safeUser(user) {

    return {
        id: user.id,
        username: user.username,
        email: user.email
    };

}


/* =========================
   AUTH MIDDLEWARE
========================= */

function authenticateToken(req, res, next) {

    const authHeader =
        req.headers.authorization;

    if (!authHeader) {

        return res.status(401).json({
            message:
                "You must sign in first."
        });

    }


    const parts =
        authHeader.split(" ");


    if (
        parts.length !== 2 ||
        parts[0] !== "Bearer"
    ) {

        return res.status(401).json({
            message:
                "Invalid authentication format."
        });

    }


    const token = parts[1];


    try {

        const decoded =
            jwt.verify(
                token,
                JWT_SECRET
            );


        req.user = decoded;

        next();

    } catch (error) {

        return res.status(401).json({
            message:
                "Your login session has expired. Please sign in again."
        });

    }

}


/* =========================
   HOME
========================= */

app.get("/", (req, res) => {

    res.json({
        message:
            "Peerva backend is running!",
        status: "online"
    });

});


/* =========================
   SIGN UP
========================= */

app.post("/signup", async (req, res) => {

    try {

        const {
            username,
            email,
            password
        } = req.body;


        if (
            !username ||
            !email ||
            !password
        ) {

            return res.status(400).json({
                message:
                    "All fields are required."
            });

        }


        const cleanUsername =
            String(username).trim();

        const cleanEmail =
            String(email)
                .trim()
                .toLowerCase();


        if (cleanUsername.length < 3) {

            return res.status(400).json({
                message:
                    "Username must be at least 3 characters."
            });

        }


        if (password.length < 6) {

            return res.status(400).json({
                message:
                    "Password must be at least 6 characters."
            });

        }


        const users = getUsers();


        const emailExists =
            users.some(
                user =>
                    user.email.toLowerCase() ===
                    cleanEmail
            );


        if (emailExists) {

            return res.status(400).json({
                message:
                    "Email already exists."
            });

        }


        const usernameExists =
            users.some(
                user =>
                    user.username.toLowerCase() ===
                    cleanUsername.toLowerCase()
            );


        if (usernameExists) {

            return res.status(400).json({
                message:
                    "Username already exists."
            });

        }


        /*
            Hash the password.
        */

        const hashedPassword =
            await bcrypt.hash(
                password,
                10
            );


        const user = {

            id: Date.now(),

            username:
                cleanUsername,

            email:
                cleanEmail,

            password:
                hashedPassword

        };


        users.push(user);

        saveUsers(users);


        /*
            Do NOT automatically log
            the user in.

            They must sign in.
        */

        res.status(201).json({

            message:
                "Peerva account created! Please sign in.",

            user: safeUser(user)

        });


    } catch (error) {

        console.error(
            "Signup error:",
            error
        );

        res.status(500).json({
            message:
                "Something went wrong while creating your account."
        });

    }

});


/* =========================
   LOGIN
========================= */

app.post("/login", async (req, res) => {

    try {

        const {
            email,
            password
        } = req.body;


        if (
            !email ||
            !password
        ) {

            return res.status(400).json({
                message:
                    "Email and password are required."
            });

        }


        const cleanEmail =
            String(email)
                .trim()
                .toLowerCase();


        const users =
            getUsers();


        const user =
            users.find(
                user =>
                    user.email.toLowerCase() ===
                    cleanEmail
            );


        if (!user) {

            return res.status(401).json({
                message:
                    "Incorrect email or password."
            });

        }


        /*
            Compare the entered password
            with the hashed password.
        */

        const passwordCorrect =
            await bcrypt.compare(
                password,
                user.password
            );


        if (!passwordCorrect) {

            return res.status(401).json({
                message:
                    "Incorrect email or password."
            });

        }


        /*
            Create JWT.
        */

        const token =
            jwt.sign(
                {
                    id: user.id,
                    username: user.username,
                    email: user.email
                },
                JWT_SECRET,
                {
                    expiresIn: "7d"
                }
            );


        res.json({

            message:
                "Login successful!",

            token,

            user:
                safeUser(user)

        });


    } catch (error) {

        console.error(
            "Login error:",
            error
        );

        res.status(500).json({
            message:
                "Something went wrong while signing in."
        });

    }

});


/* =========================
   GET CURRENT USER
========================= */

app.get(
    "/me",
    authenticateToken,
    (req, res) => {

        const users =
            getUsers();


        const user =
            users.find(
                user =>
                    Number(user.id) ===
                    Number(req.user.id)
            );


        if (!user) {

            return res.status(404).json({
                message:
                    "User no longer exists."
            });

        }


        res.json({
            user:
                safeUser(user)
        });

    }
);


/* =========================
   GET USERS
   PROTECTED
========================= */

app.get(
    "/users",
    authenticateToken,
    (req, res) => {

        const users =
            getUsers();


        const safeUsers =
            users
                .filter(
                    user =>
                        Number(user.id) !==
                        Number(req.user.id)
                )
                .map(
                    user =>
                        ({
                            id: user.id,
                            username: user.username
                        })
                );


        res.json(safeUsers);

    }
);


/* =========================
   GET MESSAGES
   PROTECTED
========================= */

app.get(
    "/messages/:userId/:otherUserId",
    authenticateToken,
    (req, res) => {

        const userId =
            Number(req.params.userId);

        const otherUserId =
            Number(req.params.otherUserId);


        if (
            !userId ||
            !otherUserId
        ) {

            return res.status(400).json({
                message:
                    "Invalid user ID."
            });

        }


        /*
            Make sure the logged-in user
            can only request their own
            conversations.
        */

        if (
            userId !==
            Number(req.user.id)
        ) {

            return res.status(403).json({
                message:
                    "You are not allowed to access this conversation."
            });

        }


        const messages =
            getMessages();


        const conversation =
            messages.filter(
                message => {

                    const sentToOther =
                        Number(message.senderId) ===
                            userId &&
                        Number(message.receiverId) ===
                            otherUserId;


                    const receivedFromOther =
                        Number(message.senderId) ===
                            otherUserId &&
                        Number(message.receiverId) ===
                            userId;


                    return (
                        sentToOther ||
                        receivedFromOther
                    );

                }
            );


        conversation.sort(
            (a, b) =>
                new Date(a.createdAt) -
                new Date(b.createdAt)
        );


        res.json(conversation);

    }
);


/* =========================
   SEND MESSAGE
   PROTECTED
========================= */

app.post(
    "/messages",
    authenticateToken,
    (req, res) => {

        const {
            senderId,
            receiverId,
            text
        } = req.body;


        if (
            !senderId ||
            !receiverId ||
            !text
        ) {

            return res.status(400).json({
                message:
                    "Sender, receiver and message are required."
            });

        }


        /*
            Prevent users from pretending
            to be another sender.
        */

        if (
            Number(senderId) !==
            Number(req.user.id)
        ) {

            return res.status(403).json({
                message:
                    "You cannot send messages as another user."
            });

        }


        const cleanText =
            String(text).trim();


        if (!cleanText) {

            return res.status(400).json({
                message:
                    "Message cannot be empty."
            });

        }


        if (cleanText.length > 5000) {

            return res.status(400).json({
                message:
                    "Message is too long."
            });

        }


        const users =
            getUsers();


        const senderExists =
            users.some(
                user =>
                    Number(user.id) ===
                    Number(senderId)
            );


        const receiverExists =
            users.some(
                user =>
                    Number(user.id) ===
                    Number(receiverId)
            );


        if (
            !senderExists ||
            !receiverExists
        ) {

            return res.status(404).json({
                message:
                    "User not found."
            });

        }


        const messages =
            getMessages();


        const newMessage = {

            id: Date.now(),

            senderId:
                Number(senderId),

            receiverId:
                Number(receiverId),

            text:
                cleanText,

            createdAt:
                new Date().toISOString()

        };


        messages.push(
            newMessage
        );


        saveMessages(
            messages
        );


        res.status(201).json({

            message:
                "Message sent!",

            data:
                newMessage

        });

    }
);


/* =========================
   START SERVER
========================= */

app.listen(
    PORT,
    HOST,
    () => {

        console.log(
            `Peerva backend running on ${HOST}:${PORT}`
        );

    }
);
