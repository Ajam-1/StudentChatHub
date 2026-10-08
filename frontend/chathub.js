
const API_URL =
    "https://peerva-backend.onrender.com";

const currentUser =
    JSON.parse(
        localStorage.getItem("chathubUser")
    );

const usernameElement =
    document.getElementById("username");

const usersContainer =
    document.getElementById("users");

const search =
    document.getElementById("search");

const logout =
    document.getElementById("logout");


/* =========================
   CHECK LOGIN
========================= */

if (!currentUser) {

    window.location.href =
        "signin.html";
}


/* =========================
   SHOW CURRENT USER
========================= */

if (currentUser) {

    usernameElement.textContent =
        currentUser.username;
}


/* =========================
   GET TOKEN
========================= */

function getToken() {

    return localStorage.getItem("token");
}


/* =========================
   LOAD USERS
========================= */

async function loadUsers() {

    usersContainer.innerHTML = `
        <p>Loading users...</p>
    `;


    const token =
        getToken();


    /*
     * The backend requires authentication.
     *
     * Send the JWT with the request.
     */

    if (!token) {

        usersContainer.innerHTML = `
            <p>
                Your session has expired.
                Please sign in again.
            </p>
        `;

        return;
    }


    try {

        const response =
            await fetch(
                `${API_URL}/users`,
                {
                    method: "GET",

                    headers: {
                        Authorization:
                            `Bearer ${token}`
                    }
                }
            );


        /*
         * Token is invalid/expired.
         */

        if (
            response.status === 401 ||
            response.status === 403
        ) {

            localStorage.removeItem(
                "token"
            );

            localStorage.removeItem(
                "chathubUser"
            );

            localStorage.removeItem(
                "chatWith"
            );

            window.location.href =
                "signin.html";

            return;
        }


        if (!response.ok) {

            throw new Error(
                `Server returned ${response.status}`
            );
        }


        const users =
            await response.json();


        console.log(
            "Users received:",
            users
        );


        if (!Array.isArray(users)) {

            throw new Error(
                "Server did not return a users array."
            );
        }


        displayUsers(users);


    } catch (error) {

        console.error(
            "Could not load users:",
            error
        );


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

function displayUsers(users) {

    const searchText =
        search.value
            .toLowerCase()
            .trim();


    const filteredUsers =
        users.filter(user => {

            /*
             * Never display the
             * currently logged-in user.
             */

            if (
                Number(user.id) ===
                Number(currentUser.id)
            ) {

                return false;
            }


            return (
                user.username || ""
            )
                .toLowerCase()
                .includes(searchText);
        });


    if (
        filteredUsers.length === 0
    ) {

        usersContainer.innerHTML = `
            <p>
                No students found.
            </p>
        `;

        return;
    }


    usersContainer.innerHTML = "";


    filteredUsers.forEach(user => {

        const userElement =
            document.createElement("div");

        userElement.className =
            "user";


        const name =
            document.createElement("span");

        name.className =
            "user-name";

        name.textContent =
            user.username;


        const button =
            document.createElement("button");

        button.className =
            "chat-button";

        button.textContent =
            "Chat";


        /*
         * IMPORTANT:
         *
         * Store the EXACT user ID
         * returned by the backend.
         */

        button.addEventListener(
            "click",
            () => {

                startChat(user);
            }
        );


        userElement.appendChild(
            name
        );

        userElement.appendChild(
            button
        );


        usersContainer.appendChild(
            userElement
        );

    });
}


/* =========================
   SEARCH USERS
========================= */

search.addEventListener(
    "input",
    loadUsers
);


/* =========================
   START CHAT
========================= */

function startChat(user) {

    /*
     * Save ONLY the selected person.
     *
     * chat.js will read this later.
     */

    localStorage.setItem(
        "chatWith",
        JSON.stringify({

            id:
                user.id,

            username:
                user.username
        })
    );


    window.location.href =
        "chat.html";
}


/* =========================
   LOGOUT
========================= */

logout.addEventListener(
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
);


/* =========================
   START
========================= */

if (currentUser) {

    loadUsers();
}

