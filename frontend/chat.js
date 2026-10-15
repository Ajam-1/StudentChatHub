const API_URL = "https://parva-backend-49br.onrender.com";

/* =========================
   ELEMENTS
========================= */

const messagesContainer = document.getElementById("messages");
const messageForm = document.getElementById("message-form");
const messageInput = document.getElementById("message-input");
const currentName = document.getElementById("current-name");
const newChatButton = document.querySelector(".new-chat");
const chatList = document.querySelector(".chat-list");
const sidebarSearch = document.querySelector(".search-box input");

// The + button next to the message box.
// If chat.html does not contain it, it is created here so it always shows.
let attachButton = document.getElementById("attach");

if (!attachButton && messageForm && messageInput) {
    attachButton = document.createElement("button");
    attachButton.type = "button";
    attachButton.id = "attach";
    attachButton.className = "attach";
    attachButton.title = "Attach";
    attachButton.setAttribute("aria-label", "Attach a file");
    attachButton.textContent = "+";

    messageInput.parentNode.insertBefore(attachButton, messageInput);
}


/* =========================
   USER / STATE
========================= */

let currentUser = null;
let chatWith = null;
let isLoadingMessages = false;
let lastReceivedCount = -1;
let isSending = false;

// Groups you belong to (loaded from the server)
let groups = [];

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
            username: user.username || user.name || "Unknown User",
            isGroup: user.isGroup === true
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

    // Show the first letter in the header avatar (unless it holds a picture)
    const headerAvatar = document.querySelector(".chat-header .avatar");

    if (headerAvatar && chatWith && !headerAvatar.querySelector("img")) {
        headerAvatar.textContent = chatWith.isGroup ? "👥" : chatWith.username.charAt(0);
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

    if (!chatWith.isGroup && myId === otherUserId) {
        console.error("Current user and chat partner have the same ID.");
        return;
    }

    isLoadingMessages = true;

    try {
        // Groups and one-to-one chats load from different routes
        const messagesUrl = chatWith.isGroup
            ? `${API_URL}/groups/${encodeURIComponent(otherUserId)}/messages`
            : `${API_URL}/messages/${encodeURIComponent(myId)}/${encodeURIComponent(otherUserId)}`;

        const response = await fetch(messagesUrl, {
            method: "GET",
            headers: authHeaders()
        });

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

        // The user switched to another chat while this request was running
        if (!chatWith || toId(chatWith.id) !== otherUserId) {
            return;
        }

        renderMessages(messages);

        // Only mark as read while the user is actually looking at the chat
        const received = messages.filter(message => {
            const senderId = toId(message.senderId ?? message.sender ?? message.from);
            return senderId !== myId;
        }).length;

        if (!chatWith.isGroup && !document.hidden && received !== lastReceivedCount) {
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

        // In group chats, show who sent each message from other people
        if (chatWith && chatWith.isGroup && senderId !== myId) {
            const senderName = document.createElement("div");
            senderName.className = "message-sender";
            senderName.textContent = String(message.senderName ?? message.username ?? "Unknown");
            bubble.appendChild(senderName);
        }

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

    if (!chatWith.isGroup && senderId === receiverId) {
        alert("You cannot send a message to yourself.");
        return;
    }

    if (chatWith.isGroup && attachedFiles.length > 0) {
        alert("Sending files in groups is not available yet. Remove the files and try again.");
        return;
    }

    try {
        isSending = true;
        messageInput.disabled = true;

        if (attachButton) {
            attachButton.disabled = true;
        }

        let options;
        let sendUrl = `${API_URL}/messages`;

        if (chatWith.isGroup) {
            // Group message: the group id goes in the URL
            sendUrl = `${API_URL}/groups/${encodeURIComponent(receiverId)}/messages`;

            options = {
                method: "POST",
                headers: authHeaders(true),
                body: JSON.stringify({ text })
            };
        } else if (attachedFiles.length > 0) {
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
        const response = await fetch(sendUrl, options);

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
   SIDEBAR: CHAT LIST + ADD PEOPLE
========================= */

// Change this if your backend lists users on a different route.
// It should return an array of users, or { users: [...] }.
// It can optionally support ?search=name
const USERS_ENDPOINT = `${API_URL}/users`;

function normalizeUser(raw) {
    if (!raw) {
        return null;
    }

    const id = toId(raw.id ?? raw._id ?? raw.userId);

    if (!id) {
        return null;
    }

    return {
        id,
        username: raw.username || raw.name || "Unknown User",
        isGroup: raw.isGroup === true || Array.isArray(raw.members)
    };
}

// People you have added are saved per account on this device
function contactsKey() {
    return `chathubContacts:${getCurrentUserId()}`;
}

function loadContacts() {
    try {
        const saved = JSON.parse(localStorage.getItem(contactsKey()));

        if (!Array.isArray(saved)) {
            return [];
        }

        return saved.map(normalizeUser).filter(contact => contact && !contact.isGroup);
    } catch (error) {
        console.error("Could not read contacts:", error);
        return [];
    }
}

function saveContacts(list) {
    try {
        localStorage.setItem(contactsKey(), JSON.stringify(list));
    } catch (error) {
        console.error("Could not save contacts:", error);
    }
}

function addContact(user) {
    const person = normalizeUser(user);

    if (!person || person.isGroup || person.id === getCurrentUserId()) {
        return;
    }

    const contacts = loadContacts();

    if (contacts.some(contact => contact.id === person.id)) {
        return;
    }

    contacts.unshift(person);
    saveContacts(contacts);
}

function renderContactList() {
    if (!chatList) {
        return;
    }

    const term = sidebarSearch ? sidebarSearch.value.trim().toLowerCase() : "";
    const contacts = [...groups, ...loadContacts()].filter(contact =>
        contact.username.toLowerCase().includes(term)
    );

    chatList.innerHTML = "";

    if (contacts.length === 0) {
        const empty = document.createElement("div");
        empty.className = "chat-empty";
        empty.textContent = term
            ? "No one found."
            : "No chats yet. Tap + to add someone.";

        chatList.appendChild(empty);
        return;
    }

    const activeId = chatWith ? toId(chatWith.id) : "";

    contacts.forEach(contact => {
        const item = document.createElement("div");
        item.className = contact.id === activeId ? "chat-item active" : "chat-item";
        item.tabIndex = 0;
        item.setAttribute("role", "button");
        item.title = contact.username;

        const avatar = document.createElement("div");
        avatar.className = "avatar";
        avatar.textContent = contact.isGroup ? "👥" : contact.username.charAt(0);

        const info = document.createElement("div");
        info.className = "chat-info";

        const name = document.createElement("strong");
        name.textContent = contact.username;

        info.appendChild(name);
        item.appendChild(avatar);
        item.appendChild(info);

        item.addEventListener("click", () => openChat(contact));

        item.addEventListener("keydown", event => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openChat(contact);
            }
        });

        chatList.appendChild(item);
    });
}

// Switches the message pane to another person without reloading the page
function openChat(person) {
    const partner = normalizeUser(person);

    if (!partner || partner.id === getCurrentUserId()) {
        return;
    }

    if (chatWith && toId(chatWith.id) === partner.id) {
        return;
    }

    chatWith = partner;
    localStorage.setItem("chatWith", JSON.stringify(partner));

    lastReceivedCount = -1;
    isLoadingMessages = false;

    if (messagesContainer) {
        messagesContainer.innerHTML = "";
    }

    clearAttachments();
    showChatPartner();
    renderContactList();
    loadMessages();

    if (messageInput) {
        messageInput.focus();
    }
}


/* ---------- Groups ---------- */

async function loadGroups() {
    if (!currentUser) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/groups`, {
            method: "GET",
            headers: authHeaders()
        });

        if (response.status === 401 || response.status === 403) {
            handleAuthError();
            return;
        }

        if (!response.ok) {
            throw new Error(`Groups request failed: ${response.status}`);
        }

        const data = await response.json();
        const list = Array.isArray(data) ? data : (data.groups || []);

        const nextGroups = list
            .map(normalizeUser)
            .filter(Boolean)
            .map(group => ({ ...group, isGroup: true }));

        // Only redraw the sidebar when something changed
        if (JSON.stringify(nextGroups) !== JSON.stringify(groups)) {
            groups = nextGroups;
            renderContactList();
        }
    } catch (error) {
        console.error("Could not load groups:", error);
    }
}


/* ---------- Add people window ---------- */

let peopleModal = null;
let peopleSearchInput = null;
let peopleResults = null;
let peopleSearchRun = 0;
let peopleSearchTimer = null;

// "chat" = pick one person to chat with, "group" = pick people for a new group
let peopleMode = "chat";
let selectedMembers = new Map();
let groupNameInput = null;
let groupCreateButton = null;

async function fetchUsers(term) {
    const url = term
        ? `${USERS_ENDPOINT}?search=${encodeURIComponent(term)}`
        : USERS_ENDPOINT;

    const response = await fetch(url, {
        method: "GET",
        headers: authHeaders()
    });

    if (response.status === 401 || response.status === 403) {
        handleAuthError();
        return [];
    }

    if (!response.ok) {
        throw new Error(`Users request failed: ${response.status}`);
    }

    const data = await response.json();
    const list = Array.isArray(data) ? data : (data.users || []);
    const myId = getCurrentUserId();
    const lower = term.toLowerCase();

    // Filter again here in case the server ignores ?search=
    return list
        .map(normalizeUser)
        .filter(user =>
            user &&
            user.id !== myId &&
            user.username.toLowerCase().includes(lower)
        );
}

function setPeopleMessage(text) {
    peopleResults.innerHTML = "";

    const message = document.createElement("div");
    message.className = "people-message";
    message.textContent = text;

    peopleResults.appendChild(message);
}

function updateGroupCreateButton() {
    if (!groupCreateButton) {
        return;
    }

    const count = selectedMembers.size;

    groupCreateButton.textContent =
        count > 0 ? `Create group (${count})` : "Create group";
}

function renderPeopleResults(people) {
    peopleResults.innerHTML = "";

    if (people.length === 0) {
        setPeopleMessage("No one found.");
        return;
    }

    const existingIds = loadContacts().map(contact => contact.id);

    people.forEach(person => {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "people-row";

        const avatar = document.createElement("div");
        avatar.className = "avatar";
        avatar.textContent = person.username.charAt(0);

        const name = document.createElement("span");
        name.className = "people-name";
        name.textContent = person.username;

        const tag = document.createElement("span");
        tag.className = "people-tag";

        function refreshTag() {
            if (peopleMode === "group") {
                const selected = selectedMembers.has(person.id);

                row.classList.toggle("selected", selected);
                tag.textContent = selected ? "✓ Added" : "Select";
            } else {
                tag.textContent = existingIds.includes(person.id)
                    ? "In your chats"
                    : "Add";
            }
        }

        refreshTag();

        row.appendChild(avatar);
        row.appendChild(name);
        row.appendChild(tag);

        row.addEventListener("click", () => {
            // Group mode: tap to select or unselect people
            if (peopleMode === "group") {
                if (selectedMembers.has(person.id)) {
                    selectedMembers.delete(person.id);
                } else {
                    selectedMembers.set(person.id, person);
                }

                refreshTag();
                updateGroupCreateButton();
                return;
            }

            // Chat mode: add the person and open the chat
            addContact(person);

            // Clear the sidebar search so the new person is visible
            if (sidebarSearch) {
                sidebarSearch.value = "";
            }

            closeAddPeople();
            openChat(person);
            renderContactList();
        });

        peopleResults.appendChild(row);
    });
}

async function runPeopleSearch(term) {
    const thisRun = ++peopleSearchRun;

    setPeopleMessage("Searching...");

    try {
        const people = await fetchUsers(term);

        // A newer search has started, so ignore this one
        if (thisRun !== peopleSearchRun) {
            return;
        }

        renderPeopleResults(people);
    } catch (error) {
        console.error("Could not load people:", error);

        if (thisRun === peopleSearchRun) {
            setPeopleMessage("Could not load people. Please try again.");
        }
    }
}

async function createGroup() {
    const name = groupNameInput.value.trim();

    if (!name) {
        alert("Give your group a name.");
        groupNameInput.focus();
        return;
    }

    if (selectedMembers.size < 2) {
        alert("Pick at least 2 people for a group.");
        return;
    }

    groupCreateButton.disabled = true;

    try {
        const response = await fetch(`${API_URL}/groups`, {
            method: "POST",
            headers: authHeaders(true),
            body: JSON.stringify({
                name,
                memberIds: [...selectedMembers.keys()]
            })
        });

        if (response.status === 401 || response.status === 403) {
            handleAuthError();
            return;
        }

        if (!response.ok) {
            let errorMessage = "Could not create the group.";

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

        const created = normalizeUser(await response.json());

        if (!created) {
            throw new Error("The server sent back an invalid group.");
        }

        const group = { ...created, isGroup: true };

        groups = [group, ...groups.filter(item => item.id !== group.id)];

        closeAddPeople();
        openChat(group);
        renderContactList();
    } catch (error) {
        console.error("Error creating group:", error);
        alert(error.message || "Could not create the group.");
    } finally {
        groupCreateButton.disabled = false;
    }
}

function setPeopleMode(mode) {
    peopleMode = mode;
    selectedMembers = new Map();

    peopleModal.querySelectorAll(".people-tab").forEach(tab => {
        tab.classList.toggle("active", tab.dataset.mode === mode);
    });

    peopleModal.querySelector(".people-header h3").textContent =
        mode === "group" ? "New group" : "Add people";

    groupNameInput.hidden = mode !== "group";
    groupCreateButton.hidden = mode !== "group";
    groupNameInput.value = "";
    peopleSearchInput.value = "";

    updateGroupCreateButton();
    runPeopleSearch("");
}

function buildAddPeopleModal() {
    peopleModal = document.createElement("div");
    peopleModal.className = "people-modal";
    peopleModal.hidden = true;

    peopleModal.innerHTML = `
        <div class="people-dialog" role="dialog" aria-modal="true" aria-label="Add people">
            <div class="people-header">
                <h3>Add people</h3>
                <button type="button" class="people-close" aria-label="Close">✕</button>
            </div>
            <div class="people-tabs">
                <button type="button" class="people-tab active" data-mode="chat">Chat</button>
                <button type="button" class="people-tab" data-mode="group">New group</button>
            </div>
            <input type="text" class="group-name" placeholder="Group name" maxlength="40" autocomplete="off" hidden>
            <input type="search" class="people-search" placeholder="Search by name" autocomplete="off">
            <div class="people-results"></div>
            <button type="button" class="group-create" hidden>Create group</button>
        </div>
    `;

    peopleSearchInput = peopleModal.querySelector(".people-search");
    peopleResults = peopleModal.querySelector(".people-results");
    groupNameInput = peopleModal.querySelector(".group-name");
    groupCreateButton = peopleModal.querySelector(".group-create");

    peopleModal.querySelector(".people-close").addEventListener("click", closeAddPeople);

    peopleModal.querySelectorAll(".people-tab").forEach(tab => {
        tab.addEventListener("click", () => setPeopleMode(tab.dataset.mode));
    });

    groupCreateButton.addEventListener("click", createGroup);

    // Clicking the dark area outside the window closes it
    peopleModal.addEventListener("click", event => {
        if (event.target === peopleModal) {
            closeAddPeople();
        }
    });

    peopleSearchInput.addEventListener("input", () => {
        clearTimeout(peopleSearchTimer);

        peopleSearchTimer = setTimeout(() => {
            runPeopleSearch(peopleSearchInput.value.trim());
        }, 300);
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && !peopleModal.hidden) {
            closeAddPeople();
        }
    });

    document.body.appendChild(peopleModal);
}

function openAddPeople() {
    if (!peopleModal) {
        buildAddPeopleModal();
    }

    peopleModal.hidden = false;

    // Always start on the "Chat" tab (this also loads the people list)
    setPeopleMode("chat");
    peopleSearchInput.focus();
}

function closeAddPeople() {
    if (peopleModal) {
        peopleModal.hidden = true;
    }
}

// The + in the sidebar opens the Add people window
if (newChatButton) {
    newChatButton.addEventListener("click", openAddPeople);
}

// The sidebar search box filters the people already in your list
if (sidebarSearch) {
    sidebarSearch.addEventListener("input", renderContactList);
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

    addContact(chatWith);
    renderContactList();
    loadGroups();
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

// Pick up new groups you were added to
setInterval(() => {
    if (currentUser && !document.hidden) {
        loadGroups();
    }
}, 15000);
/* Add people window: tabs and group form */
.people-tabs { display: flex; gap: 6px; padding: 4px; background: var(--paper); border-radius: 12px; }
.people-tab { flex: 1; padding: 9px; border-radius: 9px; font-weight: 600; color: var(--muted); }
.people-tab.active { background: var(--white); color: var(--indigo); box-shadow: 0 1px 2px rgba(24, 27, 58, 0.12); }

.group-name {
    width: 100%;
    padding: 12px 16px;
    border-radius: 12px;
    border: 2px solid transparent;
    background: var(--paper);
}
.group-name:focus { outline: none; border-color: var(--indigo); background: var(--white); }
.group-name[hidden] { display: none; }

.people-row.selected { background: #e9eafc; }
.people-row.selected .people-tag { color: var(--green); }

.group-create {
    padding: 13px;
    border-radius: 12px;
    background: var(--indigo);
    color: var(--white);
    font-weight: 600;
}
.group-create:hover { background: var(--indigo-dark); }
.group-create:disabled { opacity: 0.6; cursor: default; }
.group-create[hidden] { display: none; }

/* Sender name inside group messages */
.message-sender { margin-bottom: 2px; font-size: 12px; font-weight: 600; color: var(--indigo); }
