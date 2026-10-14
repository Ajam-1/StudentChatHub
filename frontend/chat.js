const API_URL = "https://parva-backend-49br.onrender.com";

/* =========================
   ELEMENTS
========================= */

const messagesContainer = document.getElementById("messages");
const messageForm = document.getElementById("message-form");
const messageInput = document.getElementById("message-input");
const currentName = document.getElementById("current-name");
const attachButton = document.getElementById("attach");


/* =========================
   USER / STATE
========================= */

let currentUser = null;
let chatWith = null;
let isLoadingMessages = false;
let lastReceivedCount = -1;
let isSending = false;

// Files chosen with the + button, waiting to be sent
let attachedFiles = [];

const MAX_FILES = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB each


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

function formatFileSize(bytes) {
    if (bytes < 1024) {
        return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Turns a server file path into a full, safe URL (only http/https allowed)
function safeFileUrl(url) {
    if (!url) {
        return "";
    }

    try {
        const full = new URL(String(url), API_URL);

        if (full.protocol === "http:" || full.protocol === "https:") {
            return full.href;
        }
    } catch (error) {
        console.error("Bad file URL:", url);
    }

    return "";
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
   PUSH NOTIFICATIONS
========================= */

function pushSupported() {
    return (
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window
    );
}

// Converts the server's public key into the format the browser needs
function urlBase64ToUint8Array(base64) {
    const padding = "=".repeat((4 - (base64.length % 4)) % 4);
    const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from([...raw].map(character => character.charCodeAt(0)));
}

// Registers the service worker, subscribes this device, and tells the server about it
async function subscribeToPush() {
    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
        const keyResponse = await fetch(`${API_URL}/push/public-key`);

        if (!keyResponse.ok) {
            throw new Error("Notifications are not available on the server yet.");
        }

        const { publicKey } = await keyResponse.json();

        subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey)
        });
    }

    // Always send it to the server, so this device is linked to whoever is signed in now
    const response = await fetch(`${API_URL}/subscribe`, {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify({ subscription })
    });

    if (response.status === 401 || response.status === 403) {
        handleAuthError();
        return;
    }

    if (!response.ok) {
        throw new Error("Could not save your notification settings.");
    }
}

function setupNotificationButton() {
    if (!pushSupported()) {
        return;
    }

    // Already allowed: quietly keep this device subscribed
    if (Notification.permission === "granted") {
        subscribeToPush().catch(error => {
            console.error("Push setup failed:", error);
        });
        return;
    }

    // The user blocked notifications, so there is nothing we can ask
    if (Notification.permission === "denied") {
        return;
    }

    const button = document.createElement("button");
    button.id = "enable-notifications";
    button.type = "button";
    button.textContent = "Enable notifications";

    // Browsers only allow the permission popup after a click
    button.addEventListener("click", async () => {
        button.disabled = true;

        try {
            const permission = await Notification.requestPermission();

            if (permission !== "granted") {
                button.disabled = false;
                return;
            }

            await subscribeToPush();
            button.remove();

        } catch (error) {
            console.error("Could not enable notifications:", error);
            alert(error.message || "Could not enable notifications.");
            button.disabled = false;
        }
    });

    const header = currentName ? currentName.parentElement : null;
    (header || document.body).appendChild(button);
}


/* =========================
   ATTACHMENTS (+ BUTTON)
========================= */

// Hidden file picker, created here so chat.html does not need to change
const fileInput = document.createElement("input");
fileInput.type = "file";
fileInput.id = "fileInput";
fileInput.multiple = true;
fileInput.accept = "image/*,.pdf,.doc,.docx,.txt";
fileInput.hidden = true;

// Preview strip that shows chosen files above the message box
const attachPreview = document.createElement("div");
attachPreview.id = "attachPreview";
attachPreview.className = "attach-preview";

if (messageForm) {
    messageForm.parentNode.insertBefore(attachPreview, messageForm);
    messageForm.appendChild(fileInput);
}

function renderAttachPreview() {
    attachPreview.innerHTML = "";

    attachedFiles.forEach((file, index) => {
        const chip = document.createElement("div");
        chip.className = "attach-chip";

        if (file.type.startsWith("image/")) {
            const image = document.createElement("img");
            const previewUrl = URL.createObjectURL(file);

            image.src = previewUrl;
            image.alt = file.name;
            image.onload = () => URL.revokeObjectURL(previewUrl);

            chip.appendChild(image);
        }

        const name = document.createElement("span");
        name.textContent = `${file.name} (${formatFileSize(file.size)})`;
        chip.appendChild(name);

        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.textContent = "✕";
        removeButton.title = "Remove";
        removeButton.addEventListener("click", () => {
            attachedFiles.splice(index, 1);
            renderAttachPreview();
        });
        chip.appendChild(removeButton);

        attachPreview.appendChild(chip);
    });
}

function clearAttachments() {
    attachedFiles = [];
    renderAttachPreview();
}

if (attachButton) {
    // The + button opens the file picker
    attachButton.addEventListener("click", () => {
        fileInput.click();
    });
}

fileInput.addEventListener("change", () => {
    for (const file of fileInput.files) {
        if (attachedFiles.length >= MAX_FILES) {
            alert(`You can attach up to ${MAX_FILES} files at once.`);
            break;
        }

        if (file.size > MAX_FILE_SIZE) {
            alert(`${file.name} is too large (max ${formatFileSize(MAX_FILE_SIZE)}).`);
            continue;
        }

        attachedFiles.push(file);
    }

    // Lets the user pick the same file again later
    fileInput.value = "";
    renderAttachPreview();
});


/* =========================
   MARK MESSAGES AS READ
========================= */

// Tells the server the user has seen this conversation, so the unread badge disappears
async function markAsRead() {
    if (!chatWith) {
        return;
    }

    try {
        await fetch(`${API_URL}/messages/read`, {
            method: "POST",
            headers: authHeaders(true),
            body: JSON.stringify({ otherUserId: toId(chatWith.id) })
        });
    } catch (error) {
        console.error("Could not mark messages as read:", error);
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

        // Only mark as read while the user is actually looking at the chat
        const received = messages.filter(message => {
            const senderId = toId(message.senderId ?? message.sender ?? message.from);
            return senderId !== myId;
        }).length;

        if (!document.hidden && received !== lastReceivedCount) {
            lastReceivedCount = received;
            markAsRead();
        }

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

// Builds the picture or download link for one attachment
function createAttachmentElement(attachment) {
    const url = safeFileUrl(attachment.url ?? attachment.path ?? attachment.fileUrl);

    if (!url) {
        return null;
    }

    const name = String(attachment.name ?? attachment.originalName ?? attachment.filename ?? "file");
    const type = String(attachment.type ?? attachment.mimetype ?? attachment.mimeType ?? "");

    const wrapper = document.createElement("div");
    wrapper.className = "message-attachment";

    if (type.startsWith("image/")) {
        const link = document.createElement("a");
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";

        const image = document.createElement("img");
        image.src = url;
        image.alt = name;
        image.loading = "lazy";

        link.appendChild(image);
        wrapper.appendChild(link);
        return wrapper;
    }

    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.className = "file-link";
    link.textContent = `📎 ${name}`;

    wrapper.appendChild(link);
    return wrapper;
}

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
        const attachments = Array.isArray(message.attachments) ? message.attachments : [];

        const messageElement = document.createElement("div");

        // A message is "sent" only when the sender is me
        messageElement.className =
            senderId === myId ? "message sent" : "message received";

        const bubble = document.createElement("div");
        bubble.className = "message-bubble";

        // Attachments first, then the text under them
        attachments.forEach(attachment => {
            const element = createAttachmentElement(attachment);

            if (element) {
                bubble.appendChild(element);
            }
        });

        if (text) {
            const textElement = document.createElement("div");
            textElement.className = "message-text";

            // textContent prevents users from injecting HTML into the chat
            textElement.textContent = String(text);

            bubble.appendChild(textElement);
        }

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

    // Stops double sends while a message (or upload) is in progress
    if (isSending) {
        return;
    }

    if (!currentUser) {
        alert("Please sign in again.");
        return;
    }

    if (!chatWith) {
        alert("No chat selected.");
        return;
    }

    const text = messageInput.value.trim();

    // A message needs text, files, or both
    if (!text && attachedFiles.length === 0) {
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
        isSending = true;
        messageInput.disabled = true;

        if (attachButton) {
            attachButton.disabled = true;
        }

        let options;

        if (attachedFiles.length > 0) {
            // With files: send as FormData (the browser sets the Content-Type itself)
            const formData = new FormData();
            formData.append("receiverId", receiverId);
            formData.append("text", text);

            attachedFiles.forEach(file => {
                formData.append("files", file);
            });

            options = {
                method: "POST",
                headers: authHeaders(),
                body: formData
            };
        } else {
            // Text only: same JSON request as before
            options = {
                method: "POST",
                headers: authHeaders(true),
                body: JSON.stringify({ receiverId, text })
            };
        }

        // The backend uses the token to know who the sender is
        const response = await fetch(`${API_URL}/messages`, options);

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
        clearAttachments();

        await loadMessages();
        scrollMessagesToBottom();

    } catch (error) {
        console.error("Error sending message:", error);
        alert(error.message || "Could not send message.");
    } finally {
        isSending = false;
        messageInput.disabled = false;

        if (attachButton) {
            attachButton.disabled = false;
        }

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
    setupNotificationButton();

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
