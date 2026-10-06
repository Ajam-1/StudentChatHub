const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();

/* =========================
   CONFIG
========================= */

const PORT = process.env.PORT || 5000;
const HOST = "0.0.0.0";

const USERS_FILE = path.join(__dirname, "users.json");
const MESSAGES_FILE = path.join(__dirname, "messages.json");


/* =========================
   MIDDLEWARE
========================= */

app.use(cors());

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
   HOME
========================= */

app.get("/", (req, res) => {

    res.json({

        message:
            "Peerva backend is running!",

        status:
            "online"

    });

});


/* =========================
   SIGN UP
========================= */

app.post("/signup", (req, res) => {

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
        users.find(
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
        users.find(
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


    const user = {

        id:
            Date.now(),

        username:
            cleanUsername,

        email:
            cleanEmail,

        password:
            password

    };


    users.push(user);

    saveUsers(users);


    res.status(201).json({

        message:
            "Peerva account created!",

        user

    });

});


/* =========================
   LOGIN
========================= */

app.post("/login", (req, res) => {

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


    const users = getUsers();


    const user =
        users.find(
            user =>
                user.email.toLowerCase() ===
                    String(email)
                        .trim()
                        .toLowerCase() &&

                user.password ===
                    password
        );


    if (!user) {

        return res.status(401).json({

            message:
                "Incorrect email or password."

        });

    }


    res.json({

        message:
            "Login successful!",

        user

    });

});


/* =========================
   GET USERS
========================= */

app.get("/users", (req, res) => {

    const users =
        getUsers();


    const safeUsers =
        users.map(
            user => ({

                id:
                    user.id,

                username:
                    user.username

            })
        );


    res.json(
        safeUsers
    );

});


/* =========================
   GET MESSAGES
========================= */

app.get(
    "/messages/:userId/:otherUserId",
    (req, res) => {

        const userId =
            Number(
                req.params.userId
            );


        const otherUserId =
            Number(
                req.params.otherUserId
            );


        if (
            !userId ||
            !otherUserId
        ) {

            return res.status(400).json({

                message:
                    "Invalid user ID."

            });

        }


        const messages =
            getMessages();


        const conversation =
            messages.filter(
                message => {

                    const sentToOther =
                        Number(
                            message.senderId
                        ) === userId &&

                        Number(
                            message.receiverId
                        ) === otherUserId;


                    const receivedFromOther =
                        Number(
                            message.senderId
                        ) === otherUserId &&

                        Number(
                            message.receiverId
                        ) === userId;


                    return (
                        sentToOther ||
                        receivedFromOther
                    );

                }
            );


        conversation.sort(
            (a, b) =>
                new Date(
                    a.createdAt
                ) -
                new Date(
                    b.createdAt
                )
        );


        res.json(
            conversation
        );

    }
);


/* =========================
   SEND MESSAGE
========================= */

app.post(
    "/messages",
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

            id:
                Date.now(),

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
