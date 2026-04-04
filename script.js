const CONFIG = {
  STORAGE_KEY: 'modoSAR',
  DEFAULT_MODE: 'rapido',
  API_URL_GROQ: 'https://api.groq.com/openai/v1/chat/completions',
};

const ENCODED_KEYS = [
  "rdv_q4CwSU8whjfN11saVJytHRojm3QJMhJnKwj8v6dhgDnxMY7gKBwM",
  "rdv_mvDn88ys3casJvuQxiBbHRojm3QJoPzW73eyBu8Dtc9mVO2D09Q3",
  "rdv_uuBMlVuxyFshNSSpgouaHRojm3QJeOcIaoqeZHB68JtNehuYcjzP",
  "rdv_ZwAEelTSOuFXDMCzCyAdHRojm3QJM3IT5whwyc6KYtVXSytIbUWH",
  "rdv_tHcmv4NP8HSTN8Y0uCBGHRojm3QJyE6P0JxZO00XKII62YoCq2aU"
];

// STATE
let state = {
  mode: localStorage.getItem(CONFIG.STORAGE_KEY) || CONFIG.DEFAULT_MODE,
  keyIndex: 0,
  chatHistory: [
    { role: "system", content: "Você é S.A.R, assistente inteligente da Evolution Studio. Seja conciso, útil e especializado em análise visual." }
  ],
  isLoading: false,
  currentImage: null,
};

// DOM
const DOM = {
  sidebar: document.getElementById("sidebar"),
  overlay: document.getElementById("overlay"),
  menuBtn: document.getElementById("menuBtn"),
  clearBtn: document.getElementById("clearBtn"),
  chat: document.getElementById("chat"),
  input: document.getElementById("input"),
  sendBtn: document.getElementById("btn"),
  titleSAR: document.getElementById("tituloSAR"),
  imageBtn: document.getElementById("imageBtn"),
  imageInput: document.getElementById("imageInput"),
  imagePreview: document.getElementById("imagePreview"),
  previewImg: document.getElementById("previewImg"),
  removeImageBtn: document.getElementById("removeImageBtn"),
};

// UTILITIES
function decodeROT15(str) {
  return str.replace(/[a-zA-Z]/g, (c) => {
    const base = c <= 'Z' ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + 15) % 26) + base);
  });
}

function getModeConfig() {
  const modes = {
    rapido: { temperature: 0.2, limit: 40 },
    especialista: { temperature: 0.55, limit: 80 },
    pro: { temperature: 0.9, limit: 395 }
  };
  return modes[state.mode] || modes.rapido;
}

function formatText(txt) {
  return txt
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`(.*?)`/g, "<code>$1</code>")
    .replace(/\n/g, "<br>");
}

// UI
function updateModeUI() {
  document.querySelectorAll(".modo-option").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.modo === state.mode);
  });
  localStorage.setItem(CONFIG.STORAGE_KEY, state.mode);
}

function addMessage(text, role, imageData = null) {
  const msg = document.createElement("div");
  msg.className = `msg ${role}`;

  if (role === "bot") {
    const contentDiv = document.createElement("div");
    msg.appendChild(contentDiv);

    const copyBtn = document.createElement("button");
    copyBtn.className = "copy-btn";
    copyBtn.textContent = "Copiar";
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(text);
      copyBtn.textContent = "✓";
      setTimeout(() => (copyBtn.textContent = "Copiar"), 1200);
    };
    msg.appendChild(copyBtn);

    typeWriter(contentDiv, text);
  } else {
    msg.innerHTML = `<div>${formatText(text)}</div>`;
    if (imageData) {
      const img = document.createElement("img");
      img.src = imageData;
      img.className = "msg-image";
      msg.appendChild(img);
    }
  }

  DOM.chat.appendChild(msg);
  DOM.chat.scrollTop = DOM.chat.scrollHeight;
}

function typeWriter(el, text) {
  const formatted = formatText(text);
  let i = 0;
  let buffer = "";

  function write() {
    if (i >= formatted.length) return;

    if (formatted[i] === "<") {
      let tag = "";
      while (i < formatted.length && formatted[i] !== ">") {
        tag += formatted[i++];
      }
      tag += ">";
      buffer += tag;
      i++;
    } else {
      buffer += formatted[i++];
    }

    el.innerHTML = buffer;
    setTimeout(write, 1);
  }

  write();
}

// SIDEBAR
function initSidebar() {
  DOM.menuBtn.onclick = () => {
    DOM.sidebar.classList.toggle("open");
    DOM.overlay.classList.toggle("show");
  };

  DOM.overlay.onclick = () => {
    DOM.sidebar.classList.remove("open");
    DOM.overlay.classList.remove("show");
  };

  document.querySelectorAll(".modo-option").forEach(btn => {
    btn.onclick = () => {
      state.mode = btn.dataset.modo;
      updateModeUI();
      DOM.sidebar.classList.remove("open");
      DOM.overlay.classList.remove("show");
    };
  });

  updateModeUI();
}

// CLEAR
function initClear() {
  DOM.clearBtn.onclick = () => {
    DOM.chat.innerHTML = '';
    addMessage("Olá! 👋 Sou S.A.R. Você pode enviar mensagens ou imagens para análise.", "bot");
    state.chatHistory = [
      { role: "system", content: "Você é S.A.R, assistente inteligente da Evolution Studio. Seja conciso, útil e especializado em análise visual." }
    ];
    removeImage();
  };
}

// IMAGE
function handleImageSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    state.currentImage = event.target.result;
    DOM.previewImg.src = event.target.result;
    DOM.imagePreview.classList.add("show");
  };
  reader.readAsDataURL(file);
}

function removeImage() {
  state.currentImage = null;
  DOM.imagePreview.classList.remove("show");
  DOM.imageInput.value = '';
}

function initImage() {
  DOM.imageBtn.onclick = () => DOM.imageInput.click();
  DOM.imageInput.onchange = handleImageSelect;
  DOM.removeImageBtn.onclick = removeImage;
}

// API
async function callGroq(messages) {
  const config = getModeConfig();
  const key = decodeROT15(ENCODED_KEYS[state.keyIndex]);
  state.keyIndex = (state.keyIndex + 1) % ENCODED_KEYS.length;

  try {
    const response = await fetch(CONFIG.API_URL_GROQ, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: messages.slice(-config.limit),
        temperature: config.temperature,
        max_tokens: 1024
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("API Error:", errorData);
      return "❌ Erro na API. Tente novamente em alguns segundos.";
    }

    const data = await response.json();
    return data.choices[0].message.content || "Desculpe, não consegui processar.";
  } catch (err) {
    console.error("Fetch error:", err);
    return "❌ Erro de conexão. Verifique sua internet.";
  }
}

// SEND MESSAGE
async function sendMessage() {
  const text = DOM.input.value.trim();
  if (!text && !state.currentImage) return;
  if (state.isLoading) return;

  state.isLoading = true;

  // User message - mostra texto + imagem no chat
  addMessage(text || "📸 Imagem enviada", "user", state.currentImage);
  DOM.input.value = "";

  // Loading indicator
  const loadingMsg = document.createElement("div");
  loadingMsg.className = "msg bot";
  loadingMsg.textContent = "⏳ Processando...";
  DOM.chat.appendChild(loadingMsg);
  DOM.chat.scrollTop = DOM.chat.scrollHeight;

  let messageContent;

  if (state.currentImage) {
    // Se tem imagem, criar prompt inteligente
    messageContent = text 
      ? `Usuário enviou uma imagem e fez esta pergunta: "${text}". Responda analisando a imagem.`
      : `Usuário enviou uma imagem para análise. Descreva em detalhes tudo que você conseguir identificar na imagem: objetos, cores, pessoas, texto, contexto, composição e qualquer detalhe relevante.`;
  } else {
    // Apenas texto
    messageContent = text;
  }

  state.chatHistory.push({
    role: "user",
    content: messageContent
  });

  const response = await callGroq(state.chatHistory);
  loadingMsg.remove();

  addMessage(response, "bot");
  state.chatHistory.push({ role: "assistant", content: response });

  removeImage();
  state.isLoading = false;
}

// INIT
function init() {
  addMessage("Olá! 👋", "bot");

  initSidebar();
  initClear();
  initImage();

  DOM.sendBtn.onclick = sendMessage;
  DOM.input.onkeypress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };
}

document.readyState === "loading"
  ? document.addEventListener("DOMContentLoaded", init)
  : init();
