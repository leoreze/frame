
const menuToggle = document.querySelector('.menu-toggle');
const siteNav = document.getElementById('site-nav');
if (menuToggle && siteNav) {
  menuToggle.addEventListener('click', () => {
    const isOpen = siteNav.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', String(isOpen));
  });
  siteNav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
    siteNav.classList.remove('open');
    menuToggle.setAttribute('aria-expanded', 'false');
  }));
}
const reveals = document.querySelectorAll('.reveal');
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.16 });
reveals.forEach(el => observer.observe(el));
const leadForm = document.getElementById('inlineLeadForm');
if (leadForm) {
  leadForm.addEventListener('submit', function (e) {
    e.preventDefault();
    const nome = document.getElementById('nome')?.value?.trim() || '';
    const email = document.getElementById('email')?.value?.trim() || '';
    const empresa = document.getElementById('empresa')?.value?.trim() || '';
    const objetivo = document.getElementById('objetivo')?.value?.trim() || '';
    const texto = `Olá, vim pela página da FRAME.\n\nNome: ${nome}\nEmail: ${email}\nEmpresa: ${empresa}\nObjetivo: ${objetivo}`;
    window.open(`https://wa.me/5516981511992?text=${encodeURIComponent(texto)}`, '_blank');
  });
}
