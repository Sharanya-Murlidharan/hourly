// Toggle navbar on mobile
const menuToggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('nav');

menuToggle.addEventListener('click', () => {
    nav.classList.toggle('active');
    // Optional: Toggle menu icon (e.g., bars to X)
    // menuToggle.classList.toggle('active');
});

// Add interactivity (e.g., button clicks or filters)
document.querySelectorAll('.category-btn').forEach(button => {
    button.addEventListener('click', () => {
        alert(`Filtering by ${button.textContent}`);
        // Add your filter logic here (e.g., AJAX call to update products)
    });
});

document.querySelector('.discover-btn').addEventListener('click', () => {
    alert('Redirecting to discover page');
    // Add redirect logic (e.g., window.location.href = '/discover')
});

document.querySelector('.view-all-btn').addEventListener('click', () => {
    alert('Viewing all trending products');
    // Add redirect or load more logic
});

document.querySelectorAll('.wishlist-btn').forEach(button => {
    button.addEventListener('click', () => {
        button.classList.toggle('active');
        alert('Added to wishlist!');
        // Add wishlist logic (e.g., API call)
    });
});