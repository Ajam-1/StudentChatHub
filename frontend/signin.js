const API_URL = "https://parva-backend-49br.onrender.com";

const form = document.getElementById("signin-form");
const message = document.getElementById("message");
const submitBtn = form.querySelector("button[type='submit']");

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value.trim().toLowerCase();
    const password = document.getElementById("password").value;

    if (!email || !password) {
        message.textContent = "Please enter your email and password.";
        return;
    }

    if (submitBtn) submitBtn.disabled = true;
    message.textContent = "Signing in... (the server may take a moment to wake up)";

    try {
        const response = await fetch(`${API_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });

        let data = {};
        try {
            data = await response.json();
        } catch {
            // response wasn't JSON
        }

        // LOGIN FAILED
        if (!response.ok) {
            message.textContent = data.message || "Incorrect email or password.";
            return;
        }

        // CHECK TOKEN
        if (!data.token || !data.user) {
            console.error("Invalid login response:", data);
            message.textContent = "Login failed. The server did not return a valid session.";
            return;
        }

        // SAVE SESSION
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));

        // Kept for compatibility with your existing Peerva pages
        localStorage.setItem("chathubUser", JSON.stringify(data.user));

        // Remove old chat selection
        localStorage.removeItem("chatWith");

        message.textContent = "Login successful!";

        setTimeout(() => {
            window.location.href = "studentchat.html";
        }, 500);

    } catch (error) {
        console.error("Peerva connection error:", error);
        message.textContent = "Could not connect to Peerva. Please try again.";
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
});
