const API_URL = "https://peerva-backend.onrender.com";

const form = document.getElementById("signin-form");
const message = document.getElementById("message");

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document
        .getElementById("email")
        .value
        .trim()
        .toLowerCase();

    const password = document
        .getElementById("password")
        .value;

    // Clear old message
    message.textContent = "Signing in...";

    if (!email || !password) {
        message.textContent = "Please enter your email and password.";
        return;
    }

    try {
        const response = await fetch(`${API_URL}/login`, {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                email,
                password
            })
        });

        const data = await response.json();

        // =========================
        // LOGIN FAILED
        // =========================

        if (!response.ok) {
            message.textContent =
                data.message ||
                "Incorrect email or password.";

            return;
        }

        // =========================
        // CHECK TOKEN
        // =========================

        if (!data.token || !data.user) {
            console.error("Invalid login response:", data);

            message.textContent =
                "Login failed. The server did not return a valid session.";

            return;
        }

        // =========================
        // SAVE JWT TOKEN
        // =========================

        localStorage.setItem(
            "token",
            data.token
        );

        // =========================
        // SAVE USER
        // =========================

        localStorage.setItem(
            "user",
            JSON.stringify(data.user)
        );

        // Keep this for compatibility
        // with your existing Peerva pages.
        localStorage.setItem(
            "chathubUser",
            JSON.stringify(data.user)
        );

        // =========================
        // REMOVE OLD CHAT
        // =========================

        localStorage.removeItem("chatWith");

        // =========================
        // SUCCESS
        // =========================

        message.textContent = "Login successful!";

        setTimeout(() => {
            window.location.href = "studentchat.html";
        }, 500);

    } catch (error) {

        console.error(
            "Peerva connection error:",
            error
        );

        message.textContent =
            "Could not connect to Peerva. Please try again.";
    }
});
