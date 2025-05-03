// Basic form validation
document.querySelector('form').addEventListener('submit', function(e) {
    e.preventDefault();
    const password = document.querySelectorAll('input[type="password"]')[0].value;
    const confirmPassword = document.querySelectorAll('input[type="password"]')[1].value;

    if (password !== confirmPassword) {
        alert('Passwords do not match!');
    } else {
        alert('SignUp successful!');
        // Add your form submission logic here
        this.reset();
    }
});