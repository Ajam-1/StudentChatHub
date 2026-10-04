const API_URL = "http://localhost:5000";


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

    window.location.href = "signin.html";

}



/* =========================
   SHOW USERNAME
========================= */

if (currentUser) {

    usernameElement.textContent =
        currentUser.username;

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


        const users =
            await response.json();


        displayUsers(users);


    } catch (error) {

        console.error(error);


        usersContainer.innerHTML = `
            <p>
                Could not connect to ChatHub.
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
                Don't show yourself.
            */

            if (
                Number(user.id) ===
                Number(currentUser.id)
            ) {

                return false;

            }


            return user.username
                .toLowerCase()
                .includes(searchText);

        });



    if (filteredUsers.length === 0) {

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



        button.addEventListener(
            "click",
            () => {

                startChat(user);

            }
        );



        userElement.appendChild(name);

        userElement.appendChild(button);


        usersContainer.appendChild(
            userElement
        );

    });

}



/* =========================
   SEARCH
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
        Save the EXACT person clicked.
    */

    localStorage.setItem(
        "chatWith",
        JSON.stringify({
            id: user.id,
            username: user.username
        })
    );


    /*
        Open chat page.
    */

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
