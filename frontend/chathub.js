const API_URL = "https://parva-backend-49br.onrender.com";

const currentUser = JSON.parse(localStorage.getItem("chathubUser"));

const usernameElement = document.getElementById("username");
const usersContainer = document.getElementById("users");
const search = document.getElementById("search");
const logout = document.getElementById("logout");

let allUsers = [];
let unreadCounts = {};


/* =========================
   BADGE STYLE
========================= */

// Added from here so you don't have to edit your CSS file. Move it there if you like.
const badgeStyle = document.createElement("style");
badgeStyle.textContent = `
    .user-info {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1;
        min-width: 0;
    }
    .unread-badge {
        background: #25d366;
        color: #fff;
        font-size: 12px;
        font-weight: 700;
        min-width: 20px;
        height: 20px;
        padding: 0 6px;
        border-radius: 10px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
    }
`;
document.head.appendChild(badgeStyle);


/* =========================
   HELPERS
========================= */

function getToken() {
    return localStorage.getItem("token");
}

function clearSession() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("chathubUser");
    localStorage.removeItem("chatWith");
}


/* =========================
   CHECK LOGIN
========================= */

// No saved user or no token means the person is not properly signed in
if (!currentUser || !getToken()) {
    clearSession();
    window.location.href = "signin.html";
} else {
    usernameElement.textContent = currentUser.username;
}


/* =========================
   LOAD USERS
========================= */

async function loadUsers() {
    usersContainer.innerHTML = "<p>Loading users... (the server may take a moment to wake up)</p>";

    try {
        const response = await fetch(`${API_URL}/users`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${getToken()}`
            }
        });

        // Token is invalid or expired
        if (response.status === 401 || response.status === 403) {
            clearSession();
            window.location.href = "signin.html";
            return;
        }

        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }

        const users = await response.json();

        if (!Array.isArray(users)) {
            throw new Error("Server did not return a users array.");
        }

        allUsers = users;

        // Get the unread counts first so the badges show on the first draw
        await refreshUnread(true);

        displayUsers();

    } catch (error) {
        console.error("Could not load users:", error);

        usersContainer.innerHTML = `
            <p>
                Could not load users.
                <br>
                Please try again.
            </p>
        `;
    }
}


/* =========================
   UNREAD COUNTS
========================= */

// Asks the server how many unread messages there are from each person
async function refreshUnread(skipRedraw = false) {
    try {
        const response = await fetch(`${API_URL}/unread`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${getToken()}`
            }
        });

        if (response.status === 401 || response.status === 403) {
            clearSession();
            window.location.href = "signin.html";
            return;
        }

        if (!response.ok) {
            return;
        }

        const counts = await response.json();

        const changed = JSON.stringify(counts) !== JSON.stringify(unreadCounts);
        unreadCounts = counts;

        // Only redraw when something changed, so the list doesn't flicker
        if (changed && !skipRedraw && allUsers.length > 0) {
            displayUsers();
        }

    } catch (error) {
        console.error("Could not load unread counts:", error);
    }
}


/* =========================
   DISPLAY USERS
========================= */

function displayUsers() {
    const searchText = search.value.toLowerCase().trim();

    const filteredUsers = allUsers.filter(user => {
        // MongoDB IDs are strings, so compare them as strings (not numbers)
        if (String(user.id) === String(currentUser.id)) {
            return false;
        }

        return (user.username || "").toLowerCase().includes(searchText);
    });

    if (filteredUsers.length === 0) {
        usersContainer.innerHTML = "<p>No students found.</p>";
        return;
    }

    usersContainer.innerHTML = "";

    filteredUsers.forEach(user => {
        const userElement = document.createElement("div");
        userElement.className = "user";

        const info = document.createElement("div");
        info.className = "user-info";

        const name = document.createElement("span");
        name.className = "user-name";
        name.textContent = user.username;

        info.appendChild(name);

        const unread = unreadCounts[String(user.id)] || 0;

        if (unread > 0) {
            const badge = document.createElement("span");
            badge.className = "unread-badge";
            badge.textContent = unread > 99 ? "99+" : String(unread);
            info.appendChild(badge);
        }

        const button = document.createElement("button");
        button.className = "chat-button";
        button.textContent = "Chat";

        button.addEventListener("click", () => {
            startChat(user);
        });

        userElement.appendChild(info);
        userElement.appendChild(button);
        usersContainer.appendChild(userElement);
    });
}


/* =========================
   SEARCH USERS
========================= */

// Filters the list already loaded, so it does not call the server on every keystroke
search.addEventListener("input", displayUsers);


/* =========================
   START CHAT
========================= */

function startChat(user) {
    localStorage.setItem(
        "chatWith",
        JSON.stringify({
            id: user.id,
            username: user.username
        })
    );

    window.location.href = "chat.html";
}


/* =========================
   LOGOUT
========================= */

logout.addEventListener("click", () => {
    const confirmed = confirm("Are you sure you want to log out?");

    if (!confirmed) {
        return;
    }

    clearSession();
    window.location.href = "signin.html";
});


/* =========================
   START
========================= */

if (currentUser && getToken()) {
    loadUsers();
}


/* =========================
   AUTO REFRESH BADGES
========================= */

setInterval(() => {
    if (currentUser && getToken() && !document.hidden) {
        refreshUnread();
    }
}, 5000);
