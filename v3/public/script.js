const menuToggle = document.querySelector('.menu-toggle');
const siteNav = document.querySelector('.site-nav');

if (menuToggle && siteNav) {
  menuToggle.addEventListener('click', () => {
    const isOpen = siteNav.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', String(isOpen));
  });

  siteNav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      siteNav.classList.remove('open');
      menuToggle.setAttribute('aria-expanded', 'false');
    });
  });
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

const chatLauncher = document.getElementById('chatLauncher');
const chatWidget = document.getElementById('chatWidget');
const closeChat = document.getElementById('closeChat');
const chatBody = document.getElementById('chatBody');
const optionButtons = document.querySelectorAll('.chat-options button');

function toggleChat(forceState) {
  const shouldOpen = typeof forceState === 'boolean' ? forceState : !chatWidget.classList.contains('open');
  chatWidget.classList.toggle('open', shouldOpen);
  chatWidget.setAttribute('aria-hidden', String(!shouldOpen));
}

chatLauncher?.addEventListener('click', () => toggleChat());
closeChat?.addEventListener('click', () => toggleChat(false));

optionButtons.forEach(button => {
  button.addEventListener('click', () => {
    const userText = button.dataset.reply;
    const userMessage = document.createElement('div');
    userMessage.className = 'user-message';
    userMessage.textContent = userText;
    chatBody.appendChild(userMessage);

    const botMessage = document.createElement('div');
    botMessage.className = 'bot-message';

    if (userText.includes('nova apresentação')) {
      botMessage.textContent = 'Perfeito. A FRAME pode criar pitch deck, apresentação comercial, institucional, board ou keynote. Vá até o formulário e selecione “Criação de apresentação”.';
    } else if (userText.includes('melhorar')) {
      botMessage.textContent = 'Ótimo. Podemos revisar narrativa, estrutura, design e dados de uma apresentação que já existe. No formulário, descreva o material atual e o prazo.';
    } else {
      botMessage.textContent = 'Temos workshops corporativos de 2h, 4h e 8h em storytelling, design de slides e comunicação executiva. No formulário, escolha “Treinamento corporativo”.';
    }

    setTimeout(() => {
      chatBody.appendChild(botMessage);
      chatBody.scrollTop = chatBody.scrollHeight;
    }, 350);
  });
});


const leadFormMain = document.getElementById("leadForm");
if (leadFormMain) leadFormMain.addEventListener("submit", function (e) {
  e.preventDefault();

  const nome = document.getElementById("nome").value.trim();
  const telefone = document.getElementById("telefone").value.trim();
  const email = document.getElementById("email").value.trim();
  const empresa = document.getElementById("empresa").value.trim();
  const tipo = document.getElementById("tipo").value.trim();
  const mensagem = document.getElementById("mensagem").value.trim();

  const numeroWhatsApp = "5516981511992";

  const texto = 
`Olá, vim pelo site da FRAME.

*Nome:* ${nome}
*E-mail:* ${email}
*Telefone:* ${telefone || "Não informado"}
*Empresa:* ${empresa || "Não informado"}
*Tipo de projeto:* ${tipo || "Não informado"}

*Mensagem:*
${mensagem}`;

  const url = `https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(texto)}`;

  window.open(url, "_blank");
});


const formTemplate = document.getElementById("leadTemplateForm");
const downloadTemplate = document.getElementById("downloadTemplate");

if(formTemplate){
  formTemplate.addEventListener("submit", function(e){
    e.preventDefault();

    downloadTemplate.style.display = "block";
    formTemplate.style.display = "none";
  });
}