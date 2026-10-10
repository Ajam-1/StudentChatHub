const API_URL = "https://parva-backend-49br.onrender.com";

/* =========================
   ELEMENTS
========================= */

const messagesContainer = document.getElementById("messages");
const messageForm = document.getElementById("message-form");
const messageInput = document.getElementById("message-input");
const currentName = document.getElementById("current-name");


/* =========================
   USER / STATE
========================= */

let currentUser = null;
let chatWith = null;
let isLoadingMessages = false;


/* =========================
   HELPERS
========================= */

// MongoDB IDs are strings (like "6acaaf5fc0180e6dc7f363ad"), so always compare them as strings.
function toId(value) {
    if (value === undefined || value === null) {
        return "";
    }

    // Handles populated objects like { _id: "..." } just in case
    if (typeof value === "object") {
        return String(value._id ?? value.id ?? "");
    }

    return String(value);
}

function getToken() {
    return localStorage.getItem("token");
}

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

function getCurrentUser() {
    try {
        const savedUser = localStorage.getItem("chathubUser");
        return savedUser ? JSON.parse(savedUser) : null;
    } catch (error) {
        console.error("Could not read current user:", error);
        return null;
    }
}

function getCurrentUserId() {
    if (!currentUser) {
        return "";
    }

    return toId(currentUser.id ?? currentUser._id ?? currentUser.userId);
}

function getChatPartner() {
    try {
        const savedChat = localStorage.getItem("chatWith");

        if (!savedChat) {
            console.error("No chatWith user was found.");
            return null;
        }

        const user = JSON.parse(savedChat);

        if (!user) {
            return null;
        }

        const userId = toId(user.id ?? user._id ?? user.userId);

        if (!userId) {
            console.error("Invalid chatWith ID:", user);
            return null;
        }

        return {
            id: userId,
            username: user.username || user.name || "Unknown User"
        };
    } catch (error) {
        console.error("Could not read chatWith:", error);
        return null;
    }
}

function handleAuthError() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("chathubUser");
    localStorage.removeItem("chatWith");

    window.location.href = "signin.html";
}

function scrollMessagesToBottom() {
    if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}


/* =========================
   CHECK LOGIN
========================= */

function checkLogin() {
    currentUser = getCurrentUser();

    if (!currentUser || !getToken()) {
        handleAuthError();
        return false;
    }

    return true;
}


/* =========================
   SHOW CHAT PARTNER
========================= */

function showChatPartner() {
    if (currentName && chatWith) {
        currentName.textContent = chatWith.username;
    }
}


/* =========================
   LOAD MESSAGES
========================= */

async function loadMessages() {
    if (!currentUser || !chatWith) {
        return;
    }

    // Avoid overlapping requests if the server is slow
    if (isLoadingMessages) {
        return;
    }

    const myId = getCurrentUserId();
    const otherUserId = toId(chatWith.id);

    if (!myId || !otherUserId) {
        console.error("Missing IDs:", { myId, otherUserId });
        return;
    }

    if (myId === otherUserId) {
        console.error("Current user and chat partner have the same ID.");
        return;
    }

    isLoadingMessages = true;

    try {
        const response = await fetch(
            `${API_URL}/messages/${encodeURIComponent(myId)}/${encodeURIComponent(otherUserId)}`,
            {
                method: "GET",
                headers: authHeaders()
            }
        );

        if (response.status === 401 || response.status === 403) {
            handleAuthError();
            return;
        }

        if (!response.ok) {
            throw new Error(`Messages request failed: ${response.status}`);
        }

        const messages = await response.json();

        if (!Array.isArray(messages)) {
            throw new Error("Server returned an invalid messages list.");
        }

        renderMessages(messages);

    } catch (error) {
        console.error("Could not load messages:", error);

        if (!messagesContainer.children.length) {
            messagesContainer.innerHTML = `
                <div class="error-message">
                    Could not load messages.
                    <br>
                    <button onclick="loadMessages()">Try Again</button>
                </div>
            `;
        }
    } finally {
        isLoadingMessages = false;
    }
}


/* =========================
   RENDER MESSAGES
========================= */

function renderMessages(messages) {
    if (!messagesContainer) {
        return;
    }

    const wasAtBottom =
        messagesContainer.scrollHeight -
        messagesContainer.scrollTop -
        messagesContainer.clientHeight < 100;

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
        const senderId = toId(message.senderId ?? message.sender ?? message.from);
        const text = message.text ?? message.message ?? "";

        const messageElement = document.createElement("div");

        // A message is "sent" only when the sender is me
        messageElement.className =
            senderId === myId ? "message sent" : "message received";

        const bubble = document.createElement("div");
        bubble.className = "message-bubble";

        // textContent prevents users from injecting HTML into the chat
        bubble.textContent = String(text);

        messageElement.appendChild(bubble);
        messagesContainer.appendChild(messageElement);
    });

    if (wasAtBottom) {
        scrollMessagesToBottom();
    }
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

    if (!chatWith) {
        alert("No chat selected.");
        return;
    }

    const text = messageInput.value.trim();

    if (!text) {
        return;
    }

    const senderId = getCurrentUserId();
    const receiverId = toId(chatWith.id);

    if (!senderId) {
        alert("Your account could not be identified.");
        return;
    }

    if (!receiverId) {
        alert("The selected user could not be identified.");
        return;
    }

    if (senderId === receiverId) {
        alert("You cannot send a message to yourself.");
        return;
    }

    try {
        messageInput.disabled = true;

        // The backend uses the token to know who the sender is
        const response = await fetch(`${API_URL}/messages`, {
            method: "POST",
            headers: authHeaders(true),
            body: JSON.stringify({ receiverId, text })
        });

        if (response.status === 401 || response.status === 403) {
            handleAuthError();
            return;
        }

        if (!response.ok) {
            let errorMessage = "Could not send message.";

            try {
                const errorData = await response.json();

                if (errorData.message) {
                    errorMessage = errorData.message;
                }
            } catch (error) {
                console.error("Could not read error response:", error);
            }

            throw new Error(errorMessage);
        }

        messageInput.value = "";

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
   ENTER TO SEND
========================= */

if (messageInput) {
    messageInput.addEventListener("keydown", event => {
        // Enter sends, Shift + Enter makes a new line
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();

            if (messageForm) {
                messageForm.requestSubmit();
            }
        }
    });
}

if (messageForm) {
    messageForm.addEventListener("submit", sendMessage);
}


/* =========================
   INITIALIZE CHAT
========================= */

async function initializeChat() {
    if (!checkLogin()) {
        return;
    }

    chatWith = getChatPartner();

    if (!chatWith) {
        alert("Please select a student to chat with.");
        window.location.href = "studentchat.html";
        return;
    }

    if (getCurrentUserId() === toId(chatWith.id)) {
        console.error("Invalid chat: user selected themselves.");
        localStorage.removeItem("chatWith");
        window.location.href = "studentchat.html";
        return;
    }

    showChatPartner();

    await loadMessages();
}

initializeChat();


/* =========================
   AUTO REFRESH
========================= */

setInterval(() => {
    if (currentUser && chatWith && !document.hidden) {
        loadMessages();
    }
}, 3000);
