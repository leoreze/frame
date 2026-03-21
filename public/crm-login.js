const form = document.getElementById('crmLoginForm');
const errorBox = document.getElementById('loginError');

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorBox.classList.add('hidden');
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());
  payload.user = String(payload.user || payload.username || '').trim();
  payload.password = String(payload.password || '');

  try {
    const response = await fetch('/api/crm/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || 'Falha ao autenticar.');
    window.location.href = '/crm-frame';
  } catch (error) {
    errorBox.textContent = error.message || 'Falha ao autenticar.';
    errorBox.classList.remove('hidden');
  }
});
