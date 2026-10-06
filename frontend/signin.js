const API_URL =
    "https://peerva-backend.onrender.com";


const form =
    document.getElementById(
        "signin-form"
    );


const message =
    document.getElementById(
        "message"
    );


form.addEventListener(
    "submit",
    async event => {

        event.preventDefault();


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
            "Signing in...";


        try {

            const response =
                await fetch(
                    `${API_URL}/login`,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({

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
                    "Incorrect email or password.";

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


            localStorage.removeItem(
                "chatWith"
            );


            message.textContent =
                "Login successful!";


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
