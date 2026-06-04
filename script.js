
document.addEventListener("DOMContentLoaded", () => {
    const toggle = document.querySelector(".nav-toggle");
    const links = document.querySelector(".nav-links");

    toggle.addEventListener("click", () => {
    links.classList.toggle("open");
    toggle.classList.toggle("active");
    });

    links.querySelectorAll("a").forEach((a) =>
    a.addEventListener("click", () => {
        links.classList.remove("open");
        toggle.classList.remove("active");
    }),
    );
});