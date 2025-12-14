const form = document.getElementById('volunteerForm');
const statusEl = document.getElementById('status');


function getCheckedValues(name) {
return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map(el => el.value);
}


function validate() {
statusEl.textContent = '';
statusEl.className = 'status';
const required = ['firstName','lastName','email','availability'];
for (const id of required) {
const el = document.getElementById(id);
if (!el.value.trim()) {
el.focus();
statusEl.textContent = 'Please complete all required fields.';
statusEl.classList.add('err');
return false;
}
}
const consent = document.getElementById('consent');
if (!consent.checked) {
consent.focus();
statusEl.textContent = 'Please agree to be contacted.';
statusEl.classList.add('err');
return false;
}
const email = document.getElementById('email').value.trim();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
document.getElementById('email').focus();
statusEl.textContent = 'Please enter a valid email address.';
statusEl.classList.add('err');
return false;
}
if (getCheckedValues('interests').length === 0) {
statusEl.textContent = 'Select at least one area of interest.';
statusEl.classList.add('err');
return false;
}
return true;
}


form.addEventListener('submit', async (e) => {
e.preventDefault();
if (!validate()) return;


const payload = {
firstName: document.getElementById('firstName').value.trim(),
lastName: document.getElementById('lastName').value.trim(),
email: document.getElementById('email').value.trim(),
phone: document.getElementById('phone').value.trim(),
age: document.getElementById('age').value.trim(),
location: document.getElementById('location').value.trim(),
skills: document.getElementById('skills').value.trim(),
interests: getCheckedValues('interests'),
availability: document.getElementById('availability').value,
startDate: document.getElementById('startDate').value,
message: document.getElementById('message').value.trim(),
consent: document.getElementById('consent').checked,
submittedAt: new Date().toISOString()
};


statusEl.textContent = 'Submitting…';
statusEl.className = 'status';


try {
await fetch('YOUR_APPS_SCRIPT_WEB_APP_URL_HERE', {
method: 'POST',
mode: 'no-cors',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify(payload)
});
form.reset();
statusEl.textContent = 'Thank you! Your application was submitted.';
statusEl.classList.add('ok');
} catch (err) {
console.error(err);
statusEl.textContent = 'Something went wrong. Please try again later or email us directly.';
statusEl.classList.add('err');
}
});