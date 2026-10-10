const API_URL = "https://parva-backend-49br.onrender.com";

const currentUser = JSON.parse(localStorage.getItem("chathubUser"));

const usernameElement = document.getElementById("username");
const usersContainer = document.getElementById("users");
const search = document.getElementById("search");
const logout = document.getElementById("logout");

let allUsers = [];


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

        const name = document.createElement("span");
        name.className = "user-name";
        name.textContent = user.username;

        const button = document.createElement("button");
        button.className = "chat-button";
        button.textContent = "Chat";

        button.addEventListener("click", () => {
            startChat(user);
        });

        userElement.appendChild(name);
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
