
const API_URL = "https://peerva-backend.onrender.com";

/* =========================
   ELEMENTS
========================= */

const chatList = document.getElementById("chat-list");
const messagesContainer = document.getElementById("messages");
const messageForm = document.getElementById("message-form");
const messageInput = document.getElementById("message-input");
const currentName = document.getElementById("current-name");

/* =========================
   USER / STATE
========================= */

let currentUser = null;
let selectedUser = null;

/* =========================
   GET SAVED USER
========================= */

function getSavedUser() {
    try {
        const saved =
            localStorage.getItem("user") ||
            localStorage.getItem("chathubUser");

        if (!saved) {
            return null;
        }

        return JSON.parse(saved);
    } catch (error) {
        console.error("Could not read saved user:", error);
        return null;
    }
}

/* =========================
   AUTH TOKEN
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
        headers.Authorization = `Bearer ${token}`;
    }

    if (includeJSON) {
        headers["Content-Type"] = "application/json";
    }

    return headers;
}

/* =========================
   CHECK LOGIN
========================= */

function checkLogin() {
    currentUser = getSavedUser();

    if (!currentUser) {
        window.location.href = "signin.html";
        return false;
    }

    return true;
}

/* =========================
   GET USER ID
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
   LOAD USERS
========================= */

async function loadUsers() {
    try {
        chatList.innerHTML = `
            <div class="loading">
                Loading users...
            </div>
        `;

        const response = await fetch(`${API_URL}/users`, {
            method: "GET",
            headers: authHeaders()
        });

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                handleAuthError();
                return;
            }

            throw new Error(`Users request failed: ${response.status}`);
        }

        const users = await response.json();

        if (!Array.isArray(users)) {
            throw new Error("Invalid users response");
        }

        const myId = getCurrentUserId();

        /*
         * IMPORTANT:
         * Only remove the currently logged-in account.
         *
         * Do NOT hard-code user IDs.
         * Do NOT assume the first/second user is the recipient.
         */
        const otherUsers = users.filter(user => {
            const userId = Number(
                user.id ??
                user._id ??
                user.userId
            );

            return userId !== myId;
        });

        renderUsers(otherUsers);

    } catch (error) {
        console.error("Error loading users:", error);

        chatList.innerHTML = `
            <div class="error-message">
                Could not load users.
                <br>
                <button onclick="loadUsers()">Try Again</button>
            </div>
        `;
    }
}

/* =========================
   RENDER USERS
========================= */

function renderUsers(users) {
    chatList.innerHTML = "";

    if (users.length === 0) {
        chatList.innerHTML = `
            <div class="empty-users">
                No other users are available.
            </div>
        `;
        return;
    }

    users.forEach(user => {
        const userId = Number(
            user.id ??
            user._id ??
            user.userId
        );

        const username =
            user.username ||
            user.name ||
            "Unknown User";

        const userElement = document.createElement("button");

        userElement.type = "button";
        userElement.className = "chat-user";

        /*
         * Store the REAL database ID on this element.
         *
         * This is what prevents:
         * User A -> User B
         * accidentally becoming
         * User A -> User C
         */
        userElement.dataset.userId = String(userId);

        userElement.innerHTML = `
            <div class="user-avatar">
                ${escapeHTML(username.charAt(0).toUpperCase())}
            </div>

            <div class="user-info">
                <span class="user-name">
                    ${escapeHTML(username)}
                </span>
            </div>
        `;

        userElement.addEventListener("click", () => {
            selectUser({
                id: userId,
                username: username
            });
        });

        chatList.appendChild(userElement);
    });
}

/* =========================
   SELECT USER
========================= */

function selectUser(user) {
    const userId = Number(user.id);

    if (!Number.isFinite(userId)) {
        console.error("Invalid selected user ID:", user);
        return;
    }

    selectedUser = {
        id: userId,
        username: user.username || "Unknown User"
    };

    /*
     * Save the selected recipient.
     * This is NOT the logged-in user.
     */
    sessionStorage.setItem(
        "peervaSelectedUser",
        JSON.stringify(selectedUser)
    );

    currentName.textContent = selectedUser.username;

    highlightSelectedUser(userId);

    loadMessages();
}

/* =========================
   HIGHLIGHT SELECTED USER
========================= */

function highlightSelectedUser(userId) {
    const users = document.querySelectorAll(".chat-user");

    users.forEach(element => {
        const elementId = Number(element.dataset.userId);

        element.classList.toggle(
            "active",
            elementId === Number(userId)
        );
    });
}

/* =========================
   RESTORE SELECTED USER
========================= */

function restoreSelectedUser() {
    try {
        const saved = sessionStorage.getItem("peervaSelectedUser");

        if (!saved) {
            return;
        }

        const user = JSON.parse(saved);

        if (!user || !user.id) {
            return;
        }

        selectUser({
            id: Number(user.id),
            username: user.username
        });

    } catch (error) {
        console.error("Could not restore selected user:", error);
    }
}

/* =========================
   LOAD MESSAGES
========================= */

async function loadMessages() {
    if (!currentUser || !selectedUser) {
        return;
    }

    const myId = getCurrentUserId();
    const otherUserId = Number(selectedUser.id);

    if (!Number.isFinite(myId) || !Number.isFinite(otherUserId)) {
        console.error("Invalid message IDs:", {
            myId,
            otherUserId
        });
        return;
    }

    try {
        messagesContainer.innerHTML = `
            <div class="loading-messages">
                Loading messages...
            </div>
        `;

        /*
         * The URL contains:
         *
         * logged-in user ID
         * selected recipient ID
         *
         * The backend checks both directions:
         *
         * me -> them
         * them -> me
         */
        const response = await fetch(
            `${API_URL}/messages/${encodeURIComponent(myId)}/${encodeURIComponent(otherUserId)}`,
            {
                method: "GET",
                headers: authHeaders()
            }
        );

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                handleAuthError();
                return;
            }

            throw new Error(
                `Messages request failed: ${response.status}`
            );
        }

        const messages = await response.json();

        if (!Array.isArray(messages)) {
            throw new Error("Invalid messages response");
        }

        renderMessages(messages);

    } catch (error) {
        console.error("Error loading messages:", error);

        messagesContainer.innerHTML = `
            <div class="error-message">
                Could not load messages.
                <br>
                <button onclick="loadMessages()">Try Again</button>
            </div>
        `;
    }
}

/* =========================
   RENDER MESSAGES
========================= */

function renderMessages(messages) {
    messagesContainer.innerHTML = "";

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

    const myId = getCurrentUserId();

    messages.forEach(message => {
        const senderId = Number(
            message.senderId ??
            message.sender ??
            message.from
        );

        const text =
            message.text ??
            message.message ??
            "";

        const messageElement = document.createElement("div");

        /*
         * A message belongs to ME only when the senderId
         * exactly matches my account ID.
         *
         * We do NOT use the selected user's ID to determine
         * whether a message is mine.
         */
        if (senderId === myId) {
            messageElement.className = "message sent";
        } else {
            messageElement.className = "message received";
        }

        messageElement.innerHTML = `
            <div class="message-bubble">
                ${escapeHTML(String(text))}
            </div>
        `;

        messagesContainer.appendChild(messageElement);
    });

    scrollMessagesToBottom();
}

/* =========================
   SEND MESSAGE
========================= */

async function sendMessage(event) {
    event.preventDefault();

    if (!currentUser) {
        alert("Please sign in again.");
        return;
    }

    if (!selectedUser) {
        alert("Select a person to chat with first.");
        return;
    }

    const text = messageInput.value.trim();

    if (!text) {
        return;
    }

    const receiverId = Number(selectedUser.id);

    if (!Number.isFinite(receiverId)) {
        console.error(
            "Invalid receiver ID:",
            selectedUser
        );

        alert("Could not identify this user.");
        return;
    }

    /*
     * Prevent sending a message to yourself.
     */
    const myId = getCurrentUserId();

    if (receiverId === myId) {
        alert("You cannot send a message to yourself.");
        return;
    }

    try {
        messageInput.disabled = true;

        /*
         * VERY IMPORTANT:
         *
         * We DO NOT send:
         *
         * senderId: myId
         *
         * The backend gets the sender from the JWT.
         *
         * We ONLY send:
         *
         * receiverId
         * text
         *
         * This prevents the browser from accidentally
         * using another person's ID as the sender.
         */
        const response = await fetch(`${API_URL}/messages`, {
            method: "POST",

            headers: authHeaders(true),

            body: JSON.stringify({
                receiverId: receiverId,
                text: text
            })
        });

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                handleAuthError();
                return;
            }

            let errorMessage = "Could not send message.";

            try {
                const errorData = await response.json();

                if (errorData.message) {
                    errorMessage = errorData.message;
                }

            } catch {
                // Ignore JSON parsing errors.
            }

            throw new Error(errorMessage);
        }

        /*
         * Clear the input only after the server
         * successfully accepted the message.
         */
        messageInput.value = "";

        /*
         * Reload the current conversation.
         */
        await loadMessages();

    } catch (error) {
        console.error("Error sending message:", error);

        alert(error.message || "Could not send message.");

    } finally {
        messageInput.disabled = false;
        messageInput.focus();
    }
}

/* =========================
   AUTH ERROR
========================= */

function handleAuthError() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("chathubUser");

    sessionStorage.removeItem("peervaSelectedUser");

    window.location.href = "signin.html";
}

/* =========================
   HTML ESCAPE
========================= */

function escapeHTML(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/* =========================
   SCROLL
========================= */

function scrollMessagesToBottom() {
    messagesContainer.scrollTop =
        messagesContainer.scrollHeight;
}

/* =========================
   ENTER KEY
========================= */

if (messageInput) {
    messageInput.addEventListener("keydown", event => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();

            if (messageForm) {
                messageForm.requestSubmit();
            }
        }
    });
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
   INITIALIZE
========================= */

async function initializeChat() {
    if (!checkLogin()) {
        return;
    }

    await loadUsers();

    /*
     * Restore the conversation only after users
     * have been loaded.
     */
    restoreSelectedUser();
}

/* =========================
   START
========================= */

initializeChat();

/* =========================
   AUTO REFRESH
========================= */

/*
 * Refresh messages every 3 seconds while a chat
 * is selected.
 *
 * This does NOT change the selected recipient.
 */
setInterval(() => {
    if (selectedUser && currentUser) {
        loadMessages();
    }
}, 3000);

