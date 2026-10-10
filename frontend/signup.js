const API_URL = "https://parva-backend-49br.onrender.com";

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

  if (username.length < 3) {
    message.textContent = "Username must be at least 3 characters.";
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

    // The server does not return a login token on signup,
    // so send the user to the sign-in page to log in properly.
    message.textContent = "Account created! Redirecting to sign in...";
    setTimeout(() => {
      window.location.href = "signin.html"; // change if your sign-in page has a different name
    }, 800);
  } catch (error) {
    console.error("Peerva connection error:", error);
    message.textContent = "Could not connect to Peerva. Please try again.";
  } finally {
    submitBtn.disabled = false;
  }
});
