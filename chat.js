const API_URL = "http://localhost:5000";


/* =========================
   ELEMENTS
========================= */

const chatList =
    document.getElementById("chat-list");


const messagesContainer =
    document.getElementById("messages");


const messageForm =
    document.getElementById("message-form");


const messageInput =
    document.getElementById("message-input");


const currentName =
    document.getElementById("current-name");


const currentAvatar =
    document.getElementById("current-avatar");


const usernameElement =
    document.getElementById("username");


const profileAvatar =
    document.querySelector(".profile-avatar");


const searchInput =
    document.getElementById("user-search");


const newChatButton =
    document.getElementById("new-chat");


const logoutButton =
    document.getElementById("logout");


const emojiButton =
    document.getElementById("emoji");


const attachButton =
    document.getElementById("attach");



/* =========================
   STATE
========================= */

let currentUser = null;

let selectedUser = null;

let users = [];



/* =========================
   GET CURRENT USER
========================= */

function getLoggedInUser() {

    /*
        Use chathubUser first because
        signup and signin both save it.
    */

    let savedUser =
        localStorage.getItem(
            "chathubUser"
        );


    /*
        Also support the "user" key.
    */

    if (!savedUser) {

        savedUser =
            localStorage.getItem(
                "user"
            );

    }


    if (!savedUser) {

        window.location.href =
            "signin.html";

        return null;

    }


    try {

        return JSON.parse(
            savedUser
        );

    } catch (error) {

        console.error(
            "Invalid user data:",
            error
        );


        localStorage.removeItem(
            "user"
        );


        localStorage.removeItem(
            "chathubUser"
        );


        window.location.href =
            "signin.html";


        return null;

    }

}



/* =========================
   LOAD CURRENT USER
========================= */

function loadCurrentUser() {

    currentUser =
        getLoggedInUser();


    if (!currentUser) {

        return false;

    }


    usernameElement.textContent =
        currentUser.username;


    const firstLetter =
        currentUser.username
            .charAt(0)
            .toUpperCase();


    profileAvatar.textContent =
        firstLetter;


    return true;

}



/* =========================
   LOAD USERS
========================= */

async function loadUsers() {

    try {

        const response =
            await fetch(
                `${API_URL}/users`
            );


        if (!response.ok) {

            throw new Error(
                "Could not load users."
            );

        }


        users =
            await response.json();


        /*
            Don't show the logged-in
            user in their own chat list.
        */

        const otherUsers =
            users.filter(
                user =>
                    Number(user.id) !==
                    Number(currentUser.id)
            );


        renderUsers(
            otherUsers
        );


        /*
            IMPORTANT:
            Check which user was clicked
            on the previous page.
        */

        openSavedChat(
            otherUsers
        );


    } catch (error) {

        console.error(
            "User loading error:",
            error
        );


        chatList.innerHTML = `
            <div class="chat-error">
                Could not load users.
            </div>
        `;

    }

}



/* =========================
   RENDER USERS
========================= */

function renderUsers(userList) {

    chatList.innerHTML = "";


    if (userList.length === 0) {

        chatList.innerHTML = `
            <div class="chat-empty">
                No other users yet.
            </div>
        `;

        return;

    }


    userList.forEach(
        user => {

            const chatUser =
                document.createElement(
                    "div"
                );


            chatUser.className =
                "chat-user";


            chatUser.dataset.id =
                user.id;


            chatUser.dataset.name =
                user.username;


            const firstLetter =
                user.username
                    .charAt(0)
                    .toUpperCase();


            chatUser.innerHTML = `

                <div class="avatar">
                    ${escapeHTML(firstLetter)}
                </div>

                <div class="chat-info">

                    <h3>
                        ${escapeHTML(
                            user.username
                        )}
                    </h3>

                    <p>
                        No messages yet.
                    </p>

                </div>

                <span class="time"></span>

            `;


            chatUser.addEventListener(
                "click",
                () => {

                    selectUser(
                        user
                    );

                }
            );


            chatList.appendChild(
                chatUser
            );

        }
    );

}



/* =========================
   OPEN SAVED CHAT
========================= */

function openSavedChat(
    userList
) {

    const savedChat =
        localStorage.getItem(
            "chatWith"
        );


    if (!savedChat) {

        /*
            No selected person yet.
        */

        return;

    }


    try {

        const chatUser =
            JSON.parse(
                savedChat
            );


        const user =
            userList.find(
                item =>
                    Number(item.id) ===
                    Number(chatUser.id)
            );


        if (user) {

            selectUser(
                user
            );

        }


    } catch (error) {

        console.error(
            "Could not open saved chat:",
            error
        );


        localStorage.removeItem(
            "chatWith"
        );

    }

}



/* =========================
   SELECT USER
========================= */

async function selectUser(
    user
) {

    selectedUser =
        user;


    /*
        Save current conversation.
    */

    localStorage.setItem(
        "chatWith",
        JSON.stringify({
            id: user.id,
            username: user.username
        })
    );


    /*
        Update header.
    */

    currentName.textContent =
        user.username;


    currentAvatar.textContent =
        user.username
            .charAt(0)
            .toUpperCase();


    /*
        Mark active chat.
    */

    document
        .querySelectorAll(
            ".chat-user"
        )
        .forEach(
            chat => {

                chat.classList.remove(
                    "active"
                );

            }
        );


    const selectedElement =
        document.querySelector(
            `.chat-user[data-id="${user.id}"]`
        );


    if (selectedElement) {

        selectedElement.classList.add(
            "active"
        );

    }


    /*
        Load messages.
    */

    await loadMessages();


    messageInput.focus();

}



/* =========================
   LOAD MESSAGES
========================= */

async function loadMessages() {

    if (
        !currentUser ||
        !selectedUser
    ) {

        return;

    }


    try {

        const response =
            await fetch(
                `${API_URL}/messages/${currentUser.id}/${selectedUser.id}`
            );


        if (!response.ok) {

            throw new Error(
                "Could not load messages."
            );

        }


        const messages =
            await response.json();


        renderMessages(
            messages
        );


    } catch (error) {

        console.error(
            "Message loading error:",
            error
        );


        messagesContainer.innerHTML = `
            <div class="message-error">
                Could not load messages.
            </div>
        `;

    }

}



/* =========================
   RENDER MESSAGES
========================= */

function renderMessages(
    messages
) {

    messagesContainer.innerHTML = "";


    const date =
        document.createElement(
            "div"
        );


    date.className =
        "date";


    date.textContent =
        "Today";


    messagesContainer.appendChild(
        date
    );


    if (messages.length === 0) {

        const empty =
            document.createElement(
                "div"
            );


        empty.className =
            "empty-chat";


        empty.textContent =
            `Start a conversation with ${selectedUser.username}.`;


        messagesContainer.appendChild(
            empty
        );


        return;

    }


    messages.forEach(
        message => {

            createMessage(
                message
            );

        }
    );


    scrollToBottom();

}



/* =========================
   CREATE MESSAGE
========================= */

function createMessage(
    message
) {

    const isSent =
        Number(message.senderId) ===
        Number(currentUser.id);


    const messageElement =
        document.createElement(
            "div"
        );


    messageElement.className =
        `message ${
            isSent
                ? "sent"
                : "received"
        }`;


    /*
        Received avatar.
    */

    if (!isSent) {

        const avatar =
            document.createElement(
                "div"
            );


        avatar.className =
            "message-avatar avatar";


        avatar.textContent =
            selectedUser.username
                .charAt(0)
                .toUpperCase();


        messageElement.appendChild(
            avatar
        );

    }


    const content =
        document.createElement(
            "div"
        );


    content.className =
        "message-content";


    const text =
        document.createElement(
            "p"
        );


    text.textContent =
        message.text;


    const time =
        document.createElement(
            "span"
        );


    time.textContent =
        formatMessageTime(
            message.createdAt
        );


    content.appendChild(
        text
    );


    content.appendChild(
        time
    );


    messageElement.appendChild(
        content
    );


    messagesContainer.appendChild(
        messageElement
    );

}



/* =========================
   SEND MESSAGE
========================= */

async function sendMessage(
    text
) {

    if (!selectedUser) {

        alert(
            "Select a student before sending a message."
        );

        return;

    }


    const cleanText =
        text.trim();


    if (!cleanText) {

        return;

    }


    if (cleanText.length > 5000) {

        alert(
            "Message is too long."
        );

        return;

    }


    try {

        const response =
            await fetch(
                `${API_URL}/messages`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        senderId:
                            currentUser.id,

                        receiverId:
                            selectedUser.id,

                        text:
                            cleanText

                    })
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            alert(
                data.message ||
                "Could not send message."
            );

            return;

        }


        messageInput.value = "";


        await loadMessages();


        updatePreview(
            selectedUser.id,
            cleanText,
            formatMessageTime(
                data.data.createdAt
            )
        );


        messageInput.focus();


    } catch (error) {

        console.error(
            "Send message error:",
            error
        );


        alert(
            "Could not connect to ChatHub."
        );

    }

}



/* =========================
   MESSAGE FORM
========================= */

messageForm.addEventListener(
    "submit",
    event => {

        event.preventDefault();


        sendMessage(
            messageInput.value
        );

    }
);



/* =========================
   ENTER TO SEND
========================= */

messageInput.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Enter" &&
            !event.shiftKey
        ) {

            event.preventDefault();


            messageForm.requestSubmit();

        }

    }
);



/* =========================
   SEARCH
========================= */

searchInput.addEventListener(
    "input",
    function () {

        const search =
            this.value
                .toLowerCase()
                .trim();


        document
            .querySelectorAll(
                ".chat-user"
            )
            .forEach(
                chat => {

                    const name =
                        chat.dataset.name
                            .toLowerCase();


                    if (
                        name.includes(
                            search
                        )
                    ) {

                        chat.style.display =
                            "flex";

                    } else {

                        chat.style.display =
                            "none";

                    }

                }
            );

    }
);



/* =========================
   UPDATE PREVIEW
========================= */

function updatePreview(
    userId,
    text,
    time
) {

    const chat =
        document.querySelector(
            `.chat-user[data-id="${userId}"]`
        );


    if (!chat) {

        return;

    }


    const preview =
        chat.querySelector(
            ".chat-info p"
        );


    const timeElement =
        chat.querySelector(
            ".time"
        );


    if (preview) {

        preview.textContent =
            text;

    }


    if (timeElement) {

        timeElement.textContent =
            time;

    }

}



/* =========================
   MESSAGE TIME
========================= */

function formatMessageTime(
    dateString
) {

    if (!dateString) {

        return "";

    }


    const date =
        new Date(
            dateString
        );


    return date.toLocaleTimeString(
        [],
        {
            hour: "2-digit",
            minute: "2-digit"
        }
    );

}



/* =========================
   AUTO REFRESH
========================= */

setInterval(
    async () => {

        if (
            currentUser &&
            selectedUser
        ) {

            await loadMessages();

        }

    },
    2000
);



/* =========================
   SCROLL
========================= */

function scrollToBottom() {

    messagesContainer.scrollTop =
        messagesContainer.scrollHeight;

}



/* =========================
   EMOJI
========================= */

emojiButton.addEventListener(
    "click",
    () => {

        const emojis = [
            "😀",
            "😂",
            "😍",
            "😎",
            "🔥",
            "❤️",
            "👍",
            "👋",
            "🎉",
            "🚀"
        ];


        const emoji =
            emojis[
                Math.floor(
                    Math.random() *
                    emojis.length
                )
            ];


        messageInput.value +=
            emoji;


        messageInput.focus();

    }
);



/* =========================
   ATTACHMENT
========================= */

attachButton.addEventListener(
    "click",
    () => {

        alert(
            "File attachments will be added later."
        );

    }
);



/* =========================
   NEW CHAT
========================= */

newChatButton.addEventListener(
    "click",
    () => {

        searchInput.focus();

    }
);



/* =========================
   LOGOUT
========================= */

logoutButton.addEventListener(
    "click",
    () => {

        const confirmed =
            confirm(
                "Are you sure you want to log out?"
            );


        if (!confirmed) {

            return;

        }


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
);



/* =========================
   ESCAPE HTML
========================= */

function escapeHTML(
    value
) {

    const div =
        document.createElement(
            "div"
        );


    div.textContent =
        value;


    return div.innerHTML;

}



/* =========================
   START
========================= */

async function startChat() {

    const loggedIn =
        loadCurrentUser();


    if (!loggedIn) {

        return;

    }


    await loadUsers();

}


startChat();