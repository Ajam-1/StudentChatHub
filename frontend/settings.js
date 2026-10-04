// =========================
// PROFILE PICTURE
// =========================

const changeProfile = document.querySelector("#change-profile");
const profileInput = document.querySelector("#profile-input");
const profilePreview = document.querySelector("#profile-preview");

changeProfile.addEventListener("click", () => {
    profileInput.click();
});

profileInput.addEventListener("change", () => {

    const file = profileInput.files[0];

    if (!file) return;

    const imageURL = URL.createObjectURL(file);

    profilePreview.src = imageURL;
});


// =========================
// WALLPAPER
// =========================

const changeWallpaper =
    document.querySelector("#change-wallpaper");

const wallpaperInput =
    document.querySelector("#wallpaper-input");

const removeWallpaper =
    document.querySelector("#remove-wallpaper");


changeWallpaper.addEventListener("click", () => {
    wallpaperInput.click();
});


wallpaperInput.addEventListener("change", () => {

    const file = wallpaperInput.files[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = function () {

        localStorage.setItem(
            "chatWallpaper",
            reader.result
        );

        alert("Wallpaper changed successfully!");

    };

    reader.readAsDataURL(file);

});


removeWallpaper.addEventListener("click", () => {

    localStorage.removeItem("chatWallpaper");

    alert("Wallpaper removed!");

});


// =========================
// THEME
// =========================

const themeSelect =
    document.querySelector("#theme-select");


themeSelect.addEventListener("change", () => {

    const theme = themeSelect.value;

    localStorage.setItem(
        "chatTheme",
        theme
    );

    applyTheme(theme);

});


function applyTheme(theme) {

    if (theme === "dark") {

        document.body.classList.add("dark");

    } else {

        document.body.classList.remove("dark");

    }

}


// Load saved theme

const savedTheme =
    localStorage.getItem("chatTheme") || "light";

themeSelect.value = savedTheme;

applyTheme(savedTheme);


// =========================
// LOGOUT
// =========================

const logout =
    document.querySelector("#logout");


logout.addEventListener("click", () => {

    const confirmLogout =
        confirm("Are you sure you want to log out?");

    if (confirmLogout) {

        localStorage.clear();

        window.location.href = "login.html";
    }

});
