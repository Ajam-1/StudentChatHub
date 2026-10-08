
const API_URL = "https://peerva-backend.onrender.com";

/* =========================
   ELEMENTS
========================= */

const messagesContainer =
    document.getElementById("messages");

const messageForm =
    document.getElementById("message-form");

const messageInput =
    document.getElementById("message-input");

const currentName =
    document.getElementById("current-name");


/* =========================
   USER / STATE
========================= */

let currentUser = null;
let chatWith = null;


/* =========================
   GET CURRENT USER
========================= */

function getCurrentUser() {

    try {

        const savedUser =
            localStorage.getItem("chathubUser");

        if (!savedUser) {
            return null;
        }

        return JSON.parse(savedUser);

    } catch (error) {

        console.error(
            "Could not read current user:",
            error
        );

        return null;
    }
}


/* =========================
   GET CURRENT USER ID
========================= */

function getCurrentUserId() {

    if (!currentUser) {
        return null;
    }

    return Number(
        currentUser.id ??
        currentUser._id ??
        currentUser.userId
    );
}


/* =========================
   GET TOKEN
========================= */

function getToken() {

    return localStorage.getItem("token");
}


/* =========================
   AUTH HEADERS
========================= */

function authHeaders(includeJSON = false) {

    const headers = {};

    const token = getToken();

    if (token) {

        headers.Authorization =
            `Bearer ${token}`;
    }

    if (includeJSON) {

        headers["Content-Type"] =
            "application/json";
    }

    return headers;
}


/* =========================
   CHECK LOGIN
========================= */

function checkLogin() {

    currentUser =
        getCurrentUser();

    if (!currentUser) {

        window.location.href =
            "signin.html";

        return false;
    }

    return true;
}


/* =========================
   GET CHAT PARTNER
========================= */

function getChatPartner() {

    try {

        /*
         * studentchat.js saves the selected
         * person here:
         *
         * localStorage.setItem(
         *     "chatWith",
         *     JSON.stringify(...)
         * );
         */

        const savedChat =
            localStorage.getItem("chatWith");

        if (!savedChat) {

            console.error(
                "No chatWith user was found."
            );

            return null;
        }

        const user =
            JSON.parse(savedChat);

        if (!user) {
            return null;
        }

        const userId =
            Number(
                user.id ??
                user._id ??
                user.userId
            );

        if (!Number.isFinite(userId)) {

            console.error(
                "Invalid chatWith ID:",
                user
            );

            return null;
        }

        return {

            id: userId,

            username:
                user.username ||
                user.name ||
                "Unknown User"
        };

    } catch (error) {

        console.error(
            "Could not read chatWith:",
            error
        );

        return null;
    }
}


/* =========================
   SHOW CHAT PARTNER
========================= */

function showChatPartner() {

    if (!currentName || !chatWith) {
        return;
    }

    currentName.textContent =
        chatWith.username;
}


/* =========================
   LOAD MESSAGES
========================= */

async function loadMessages() {

    if (!currentUser) {
        return;
    }

    if (!chatWith) {
        return;
    }

    const myId =
        getCurrentUserId();

    const otherUserId =
        Number(chatWith.id);


    /* =========================
       VALIDATE IDs
    ========================= */

    if (!Number.isFinite(myId)) {

        console.error(
            "Invalid current user ID:",
            currentUser
        );

        return;
    }


    if (!Number.isFinite(otherUserId)) {

        console.error(
            "Invalid chat partner ID:",
            chatWith
        );

        return;
    }


    /*
     * NEVER allow a user to chat
     * with themselves.
     */

    if (myId === otherUserId) {

        console.error(
            "Current user and chat partner have the same ID.",
            {
                myId,
                otherUserId
            }
        );

        return;
    }


    try {

        /*
         * Do NOT clear the current messages
         * while refreshing every few seconds.
         *
         * This prevents the chat from flashing
         * "Loading..." constantly.
         */

        const response =
            await fetch(
                `${API_URL}/messages/${encodeURIComponent(myId)}/${encodeURIComponent(otherUserId)}`,
                {
                    method: "GET",
                    headers: authHeaders()
                }
            );


        /* =========================
           AUTH ERROR
        ========================= */

        if (
            response.status === 401 ||
            response.status === 403
        ) {

            handleAuthError();

            return;
        }


        if (!response.ok) {

            throw new Error(
                `Messages request failed: ${response.status}`
            );
        }


        const messages =
            await response.json();


        if (!Array.isArray(messages)) {

            throw new Error(
                "Server returned an invalid messages list."
            );
        }


        renderMessages(messages);


    } catch (error) {

        console.error(
            "Could not load messages:",
            error
        );

        /*
         * Only show the error if there
         * are currently no messages.
         */

        if (
            !messagesContainer.children.length
        ) {

            messagesContainer.innerHTML = `
                <div class="error-message">
                    Could not load messages.
                    <br>
                    <button onclick="loadMessages()">
                        Try Again
                    </button>
                </div>
            `;
        }
    }
}


/* =========================
   RENDER MESSAGES
========================= */

function renderMessages(messages) {

    if (!messagesContainer) {
        return;
    }


    /*
     * Remember current scroll position.
     */

    const wasAtBottom =
        messagesContainer.scrollHeight -
        messagesContainer.scrollTop -
        messagesContainer.clientHeight <
        100;


    messagesContainer.innerHTML = "";


    /* =========================
       NO MESSAGES
    ========================= */

    if (messages.length === 0) {

        messagesContainer.innerHTML = `
            <div class="no-messages">
                No messages yet.
                <br>
                Start the conversation.
            </div>
        `;

        return;
    }


    const myId =
        getCurrentUserId();


    messages.forEach(message => {

        /*
         * Support the possible field names
         * returned by the backend.
         */

        const senderId =
            Number(
                message.senderId ??
                message.sender ??
                message.from
            );


        const text =
            message.text ??
            message.message ??
            "";


        const messageElement =
            document.createElement("div");


        /*
         * THIS IS IMPORTANT.
         *
         * A message is "sent" ONLY when
         * senderId === MY actual ID.
         *
         * Otherwise it is received.
         */

        if (senderId === myId) {

            messageElement.className =
                "message sent";

        } else {

            messageElement.className =
                "message received";
        }


        const bubble =
            document.createElement("div");

        bubble.className =
            "message-bubble";

        /*
         * textContent prevents users from
         * injecting HTML into the chat.
         */

        bubble.textContent =
            String(text);


        messageElement.appendChild(
            bubble
        );


        messagesContainer.appendChild(
            messageElement
        );

    });


    /*
     * Scroll down if the user was already
     * near the bottom.
     */

    if (wasAtBottom) {

        scrollMessagesToBottom();
    }
}


/* =========================
   SEND MESSAGE
========================= */

async function sendMessage(event) {

    event.preventDefault();


    /* =========================
       CHECK USER
    ========================= */

    if (!currentUser) {

        alert(
            "Please sign in again."
        );

        return;
    }


    /* =========================
       CHECK CHAT PARTNER
    ========================= */

    if (!chatWith) {

        alert(
            "No chat selected."
        );

        return;
    }


    /* =========================
       GET MESSAGE
    ========================= */

    const text =
        messageInput.value.trim();


    if (!text) {
        return;
    }


    /* =========================
       GET IDs
    ========================= */

    const senderId =
        getCurrentUserId();

    const receiverId =
        Number(chatWith.id);


    /* =========================
       VALIDATE SENDER
    ========================= */

    if (!Number.isFinite(senderId)) {

        console.error(
            "Invalid sender ID:",
            currentUser
        );

        alert(
            "Your account could not be identified."
        );

        return;
    }


    /* =========================
       VALIDATE RECEIVER
    ========================= */

    if (!Number.isFinite(receiverId)) {

        console.error(
            "Invalid receiver ID:",
            chatWith
        );

        alert(
            "The selected user could not be identified."
        );

        return;
    }


    /* =========================
       PREVENT SELF CHAT
    ========================= */

    if (senderId === receiverId) {

        alert(
            "You cannot send a message to yourself."
        );

        return;
    }


    try {

        messageInput.disabled = true;


        /*
         * IMPORTANT:
         *
         * receiverId comes DIRECTLY from
         * localStorage.chatWith.
         *
         * Therefore:
         *
         * Click John
         *    ↓
         * chatWith = John's ID
         *    ↓
         * receiverId = John's ID
         *
         * Click Sarah
         *    ↓
         * chatWith = Sarah's ID
         *    ↓
         * receiverId = Sarah's ID
         */


        const response =
            await fetch(
                `${API_URL}/messages`,
                {
                    method: "POST",

                    headers:
                        authHeaders(true),

                    body:
                        JSON.stringify({

                            /*
                             * The backend should use
                             * the JWT to determine the
                             * sender.
                             */

                            receiverId:
                                receiverId,

                            text:
                                text
                        })
                }
            );


        /* =========================
           AUTH ERROR
        ========================= */

        if (
            response.status === 401 ||
            response.status === 403
        ) {

            handleAuthError();

            return;
        }


        /* =========================
           OTHER ERROR
        ========================= */

        if (!response.ok) {

            let errorMessage =
                "Could not send message.";


            try {

                const errorData =
                    await response.json();


                if (errorData.message) {

                    errorMessage =
                        errorData.message;
                }

            } catch (error) {

                console.error(
                    "Could not read error response:",
                    error
                );
            }


            throw new Error(
                errorMessage
            );
        }


        /* =========================
           CLEAR INPUT
        ========================= */

        messageInput.value = "";


        /* =========================
           LOAD NEW MESSAGE
        ========================= */

        await loadMessages();


    } catch (error) {

        console.error(
            "Error sending message:",
            error
        );

        alert(
            error.message ||
            "Could not send message."
        );


    } finally {

        messageInput.disabled =
            false;

        messageInput.focus();
    }
}


/* =========================
   AUTH ERROR
========================= */

function handleAuthError() {

    localStorage.removeItem(
        "token"
    );

    localStorage.removeItem(
        "user"
    );

    localStorage.removeItem(
        "chathubUser"
    );

    localStorage.removeItem(
        "chatWith"
    );

    window.location.href =
        "signin.html";
}


/* =========================
   SCROLL TO BOTTOM
========================= */

function scrollMessagesToBottom() {

    if (!messagesContainer) {
        return;
    }

    messagesContainer.scrollTop =
        messagesContainer.scrollHeight;
}


/* =========================
   ENTER TO SEND
========================= */

if (messageInput) {

    messageInput.addEventListener(
        "keydown",
        event => {

            /*
             * Enter sends.
             *
             * Shift + Enter creates a
             * new line.
             */

            if (
                event.key === "Enter" &&
                !event.shiftKey
            ) {

                event.preventDefault();


                if (messageForm) {

                    messageForm.requestSubmit();
                }
            }
        }
    );
}


/* =========================
   FORM SUBMIT
========================= */

if (messageForm) {

    messageForm.addEventListener(
        "submit",
        sendMessage
    );
}


/* =========================
   INITIALIZE CHAT
========================= */

async function initializeChat() {

    /*
     * Check logged-in account.
     */

    if (!checkLogin()) {
        return;
    }


    /*
     * Get the EXACT person selected
     * on studentchat.html.
     */

    chatWith =
        getChatPartner();


    /*
     * If there is no selected person,
     * return to the student list.
     */

    if (!chatWith) {

        alert(
            "Please select a student to chat with."
        );

        window.location.href =
            "studentchat.html";

        return;
    }


    /*
     * Make sure we aren't chatting
     * with ourselves.
     */

    if (
        getCurrentUserId() ===
        Number(chatWith.id)
    ) {

        console.error(
            "Invalid chat: user selected themselves."
        );

        localStorage.removeItem(
            "chatWith"
        );

        window.location.href =
            "studentchat.html";

        return;
    }


    /*
     * Show the correct person's name.
     */

    showChatPartner();


    /*
     * Load ONLY the conversation between:
     *
     * currentUser
     *       ↕
     * chatWith
     */

    await loadMessages();
}


/* =========================
   START CHAT
========================= */

initializeChat();


/* =========================
   AUTO REFRESH
========================= */

setInterval(
    () => {

        if (
            currentUser &&
            chatWith
        ) {

            loadMessages();
        }

    },
    3000
);

