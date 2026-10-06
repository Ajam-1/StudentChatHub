const API_URL =
    "https://peerva-backend.onrender.com";


const form =
    document.getElementById(
        "signup-form"
    );


const message =
    document.getElementById(
        "message"
    );


form.addEventListener(
    "submit",
    async event => {

        event.preventDefault();


        const username =
            document
                .getElementById("username")
                .value
                .trim();


        const email =
            document
                .getElementById("email")
                .value
                .trim()
                .toLowerCase();


        const password =
            document
                .getElementById("password")
                .value;


        message.textContent =
            "Creating account...";


        try {

            const response =
                await fetch(
                    `${API_URL}/signup`,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({

                            username,
                            email,
                            password

                        })
                    }
                );


            const data =
                await response.json();


            if (!response.ok) {

                message.textContent =
                    data.message ||
                    "Could not create account.";

                return;

            }


            localStorage.setItem(
                "user",
                JSON.stringify(
                    data.user
                )
            );


            localStorage.setItem(
                "chathubUser",
                JSON.stringify(
                    data.user
                )
            );


            message.textContent =
                "Account created!";


            setTimeout(
                () => {

                    window.location.href =
                        "studentchat.html";

                },
                500
            );


        } catch (error) {

            console.error(
                "Peerva connection error:",
                error
            );


            message.textContent =
                "Could not connect to Peerva.";

        }

    }
);
