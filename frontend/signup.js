const API_URL = "https://peerva-backend.onrender.com";

const form = document.getElementById("signup-form");
const message = document.getElementById("message");
const submitBtn = form.querySelector("button[type='submit']");

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const username = document.getElementById("username").value.trim();
  const email = document.getElementById("email").value.trim().toLowerCase();
  const password = document.getElementById("password").value;

  if (!username || !email || !password) {
    message.textContent = "Please fill in all fields.";
    return;
  }

  if (password.length < 6) {
    message.textContent = "Password must be at least 6 characters.";
    return;
  }

  submitBtn.disabled = true;
  message.textContent = "Creating account... (the server may take a moment to wake up)";

  try {
    const response = await fetch(`${API_URL}/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password }),
    });

    let data = {};
    try {
      data = await response.json();
    } catch {
      // response wasn't JSON
    }

    if (!response.ok || !data.user) {
      message.textContent = data.message || "Could not create account.";
      return;
    }

    localStorage.setItem("user", JSON.stringify(data.user));
    localStorage.setItem("chathubUser", JSON.stringify(data.user));

    message.textContent = "Account created!";
    setTimeout(() => {
      window.location.href = "studentchat.html";
    }, 500);
  } catch (error) {
    console.error("Peerva connection error:", error);
    message.textContent = "Could not connect to Peerva. Please try again.";
  } finally {
    submitBtn.disabled = false;
  }
});
