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


        if (
            !username ||
            !email ||
            !password
        ) {

            message.textContent =
                "Please fill in all fields.";

            return;

        }


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

                        body:
                            JSON.stringify({
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


            /*
                Do NOT save a login token here.

                The user must sign in.
            */

            localStorage.removeItem(
                "peervaToken"
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


            message.textContent =
                "Account created! Redirecting to sign in...";


            setTimeout(
                () => {

                    window.location.href =
                        "signin.html";

                },
                1000
            );


        } catch (error) {

            console.error(
                "Peerva signup error:",
                error
            );


            message.textContent =
                "Could not connect to Peerva.";

        }

    }
);
