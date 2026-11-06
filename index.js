const firebaseConfig = {
    databaseURL: "https://contaevilution-default-rtdb.firebaseio.com/"
};

const palavrasProibidas = [
    "prostituta",
    "vagabunda",
    "transar",
    "pedofilia",
    "fuder",
    "foder",
    "buceta",
    "nazismo",
    "nazista",
    "hitler",
    "pedofilo",
    "suicidio"
];

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

const fotoDB = firebase.initializeApp({
    databaseURL: "https://bigtrio-ip-default-rtdb.firebaseio.com/"
}, "fotos").database();

const db3 = firebase.initializeApp({
    databaseURL: "https://qwhsb-1577d-default-rtdb.firebaseio.com/"
}, "extra").database();

/* ================= VERIFICADO ================= */

const usuariosVerificados = [
    "Macedo",
    "Evolution Studio Official",
    "João Antônio",
    "Mariel Lunardrine",
    "petrus"
];

function usuarioVerificado(nome) {
    return usuariosVerificados.includes(nome);
}

/* ================= FILTRO DE PALAVRAS ================= */

function verificarPalavras(texto) {
    let lower = texto.toLowerCase();
    for (let palavra of palavrasProibidas) {
        if (lower.includes(palavra.toLowerCase())) {
            return palavra;
        }
    }
    return null;
}

/* ================= PERFIL ================= */

function abrirPerfil(nome) {
    localStorage.setItem("perfil", nome);
    location.href = "user.html";
}

function abrirMeuPerfil() {
    localStorage.setItem("perfil", user);
    location.href = "user.html";
}

/* ================= LOGIN ================= */

function salvarUsuario(u) {
    localStorage.setItem("user", u);
    sessionStorage.setItem("user", u);

    let d = new Date();
    d.setTime(d.getTime() + (30 * 24 * 60 * 60 * 1000));
    document.cookie = "user=" + u + ";expires=" + d.toUTCString() + ";path=/";
}

function pegarCookie(nome) {
    let match = document.cookie.match(new RegExp('(^| )' + nome + '=([^;]+)'));
    return match ? match[2] : null;
}

let user =
    localStorage.getItem("user") ||
    sessionStorage.getItem("user") ||
    pegarCookie("user");

if (user) {
    salvarUsuario(user);
} else {
    location.replace("login.html");
}

/* ================= SISTEMA DE BLOQUEIO ================= */

let usuariosBloqueados = new Set();

function carregarBloqueados() {
    let nomeKey = user.replace(/[.#$[\]]/g, '_');
    db.ref("bloqueados/" + nomeKey).once("value").then(snap => {
        usuariosBloqueados.clear();
        if (snap.exists()) {
            snap.forEach(child => {
                usuariosBloqueados.add(child.key);
            });
        }
    });
}

function estaBloqueado(nome) {
    let nomeKey = nome.replace(/[.#$[\]]/g, '_');
    return usuariosBloqueados.has(nomeKey);
}

function bloquearUsuario(nome) {
    customConfirm(`Deseja bloquear @${nome}?\nEle não poderá mais comentar nos seus posts nem enviar mensagens.`).then(ok => {
        if (!ok) return;
        let nomeKey = user.replace(/[.#$[\]]/g, '_');
        let bloqueadoKey = nome.replace(/[.#$[\]]/g, '_');
        db.ref("bloqueados/" + nomeKey + "/" + bloqueadoKey).set(true).then(() => {
            usuariosBloqueados.add(bloqueadoKey);
            alert(`@${nome} foi bloqueado.`);
        });
    });
}

function desbloquearUsuario(nome) {
    customConfirm(`Deseja desbloquear @${nome}?`).then(ok => {
        if (!ok) return;
        let nomeKey = user.replace(/[.#$[\]]/g, '_');
        let bloqueadoKey = nome.replace(/[.#$[\]]/g, '_');
        db.ref("bloqueados/" + nomeKey + "/" + bloqueadoKey).remove().then(() => {
            usuariosBloqueados.delete(bloqueadoKey);
            alert(`@${nome} foi desbloqueado.`);
        });
    });
}

// Verifica se o usuário logado está bloqueado pelo dono do post
function estaBlockeadoPor(donoPost, callback) {
    let donoKey = donoPost.replace(/[.#$[\]]/g, '_');
    let userKey = user.replace(/[.#$[\]]/g, '_');
    db.ref("bloqueados/" + donoKey + "/" + userKey).once("value").then(snap => {
        callback(snap.exists());
    });
}

/* ================= PROMPT / CONFIRM ================= */

let promptResolve = null;
let confirmResolve = null;

function customPrompt(msg) {
    return new Promise(res => {
        promptResolve = res;
        document.getElementById("promptText").innerText = msg;
        document.getElementById("promptInput").value = "";
        document.getElementById("customPrompt").style.display = "flex";
    });
}

function fecharPrompt(v) {
    document.getElementById("customPrompt").style.display = "none";
    if (promptResolve) {
        promptResolve(v ? v.trim() : null);
        promptResolve = null;
    }
}

function customConfirm(msg) {
    return new Promise(res => {
        confirmResolve = res;
        document.getElementById("confirmText").innerText = msg;
        document.getElementById("customConfirm").style.display = "flex";
    });
}

function fecharConfirm(v) {
    document.getElementById("customConfirm").style.display = "none";
    if (confirmResolve) {
        confirmResolve(v);
        confirmResolve = null;
    }
}

/* ================= UI ================= */

function abrirPost() {
    document.getElementById("postPopup").style.display = "block";
    document.getElementById("overlay").style.display = "block";

    setTimeout(() => {
        document.getElementById("postPopup").style.bottom = "0";
    }, 10);
}

function fecharPost() {
    document.getElementById("overlay").style.display = "none";
    document.getElementById("postPopup").style.bottom = "-420px";

    setTimeout(() => {
        document.getElementById("postPopup").style.display = "none";
    }, 300);
}

function abrirImagem(src) {
    document.getElementById("viewer").style.display = "flex";
    document.getElementById("viewerImg").src = src;
}

function fecharImagem() {
    document.getElementById("viewer").style.display = "none";
    document.getElementById("viewerImg").src = "";
}

/* ================= TEXTO ================= */

// Cache de usuários existentes para validar @menções
let cacheUsuariosExistentes = null;
const storyNomesOriginais = new Set();

function carregarUsuariosExistentes() {
    if (cacheUsuariosExistentes) return Promise.resolve(cacheUsuariosExistentes);
    return db.ref("posts").orderByChild("user").once("value").then(snap => {
        let nomes = new Set();
        snap.forEach(child => {
            if (child.val().user) {
                nomes.add(child.val().user.toLowerCase());
                storyNomesOriginais.add(child.val().user);
            }
        });
        cacheUsuariosExistentes = nomes;
        return nomes;
    });
}

function linkificar(texto, usuariosValidos) {
    // Links clicáveis
    let result = texto.replace(
        /(https?:\/\/[^\s]+)/g,
        '<a href="$1" target="_blank" style="color:#4da6ff">$1</a>'
    );

    // @menções — só destaca se o usuário existir
    // Regex: captura @nome até o fim da palavra (sem espaços)
    result = result.replace(
        /@([A-Za-zÀ-ÿ0-9_.]+)/g,
        (match, nome) => {
            let nomeCheck = nome.toLowerCase();
            // Se temos cache e o usuário é válido, ou não temos cache (permissivo)
            if (!usuariosValidos || usuariosValidos.has(nomeCheck)) {
                return `<span class="mencao" onclick="abrirPerfil('${nome}')">${match}</span>`;
            }
            // Usuário não existe: renderiza como texto normal
            return match;
        }
    );
    return result;
}

// Versão async que carrega usuários antes de linkificar
function linkificarAsync(texto) {
    return carregarUsuariosExistentes().then(usuarios => linkificar(texto, usuarios));
}

/* ================= IMAGEM ================= */

function comprimirImagem(file) {
    return new Promise(resolve => {
        let img = new Image();
        let reader = new FileReader();

        reader.onload = e => img.src = e.target.result;

        img.onload = () => {
            let canvas = document.createElement("canvas");
            let max = 800;
            let scale = Math.min(max / img.width, max / img.height, 1);

            canvas.width = img.width * scale;
            canvas.height = img.height * scale;

            let ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            resolve(canvas.toDataURL("image/jpeg", 0.4));
        };

        reader.readAsDataURL(file);
    });
}

/* ================= ENQUETE ================= */

let fotoBase64 = null;
let pollAtiva = false;

const uploadVisual = document.getElementById("uploadVisual");
const previewImg = document.getElementById("previewImg");
const fotoInput = document.getElementById("fotoInput");
const postText = document.getElementById("postText");
const contador = document.getElementById("contador");

function togglePoll() {
    pollAtiva = !pollAtiva;
    document.getElementById("pollOptions").style.display = pollAtiva ? "block" : "none";
    document.getElementById("pollTimeBox").style.display = pollAtiva ? "block" : "none";
}

function resetarPoll() {
    pollAtiva = false;
    document.getElementById("pollOptions").style.display = "none";
    document.getElementById("pollTimeBox").style.display = "none";
    document.querySelectorAll(".pollInput").forEach(i => i.value = "");
}

fotoInput.addEventListener("change", () => {
    const file = fotoInput.files[0];

    if (file) {
        uploadVisual.innerText = "✅ Foto selecionada";
        uploadVisual.classList.add("selected");
        document.getElementById("spoilerLabel").style.display = "flex";
        document.getElementById("sensitiveLabel").style.display = "flex";

        const reader = new FileReader();
        reader.onload = e => {
            previewImg.src = e.target.result;
            previewImg.style.display = "block";
        };
        reader.readAsDataURL(file);
    } else {
        uploadVisual.innerText = "📷 Escolher foto";
        uploadVisual.classList.remove("selected");
        previewImg.style.display = "none";
        document.getElementById("spoilerLabel").style.display = "none";
        document.getElementById("spoilerCheck").checked = false;
        document.getElementById("sensitiveLabel").style.display = "none";
        document.getElementById("sensitiveCheck").checked = false;
    }
});

/* ================= S.A.R (IA) EM POSTS E COMENTÁRIOS ================= */
// Rota 15 da API. Ajuste aqui se a rota/host for diferente.
const SAR_API_URL = "/15";
const SAR_API_KEY = "rdv_tHcmv4NP8HSTN8Y0uCBGHRojm3QJyE6P0JxZO00XKII62YoCq2aU"; // <-- COLOQUE SUA CHAVE AQUI
const SAR_NOME = "S.A.R";
const SAR_REGEX = /(^|[^\w])@sar(?![\w])/i;

function mencionouSAR(texto) {
    return SAR_REGEX.test(texto || "");
}

function mostrarSARPensando(postId) {
    let tentativas = 0;
    let el = null;
    function tentar() {
        let box = document.getElementById("c" + postId);
        if (box) {
            el = document.createElement("div");
            el.className = "comment sar-comment sar-pensando";
            el.innerHTML = `<span class="square-snake" role="status"><span aria-hidden="true">█</span><span aria-hidden="true">▓</span><span aria-hidden="true">▒</span><span aria-hidden="true">░</span><span class="sr-only">Loading</span></span> <span><b style="color:#1da1f2;">@${SAR_NOME}</b> está pensando...</span>`;
            box.appendChild(el);
        } else if (++tentativas < 10) {
            setTimeout(tentar, 500);
        }
    }
    tentar();
    return () => { if (el) el.remove(); tentativas = 99; };
}

async function chamarAPISAR(pergunta, contexto) {
    const res = await fetch(SAR_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensagem: pergunta, contexto: contexto || "", usuario: user })
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const tipo = res.headers.get("content-type") || "";
    if (tipo.includes("application/json")) {
        const d = await res.json();
        return d.resposta || d.response || d.reply || d.text || d.message || "";
    }
    return await res.text();
}

// Responde como comentário, igual o Grok no X
async function responderComoSAR(postId, texto, contextoPost) {
    if (user === SAR_NOME) return;
    const pergunta = texto.replace(/@sar\b/ig, "").trim() || "Comente sobre este post.";
    const parar = mostrarSARPensando(postId);
    let resposta = "";
    try {
        resposta = (await chamarAPISAR(pergunta, contextoPost)).trim();
    } catch (e) {
        console.error("S.A.R:", e);
        resposta = "Não consegui responder agora. Tente novamente em instantes.";
    }
    parar();
    if (!resposta) return;

    db.ref("comments/" + postId).push({
        user: SAR_NOME,
        text: resposta,
        ia: true,
        time: Date.now()
    });

    db.ref("posts/" + postId + "/user").once("value").then(snap => {
        let dono = snap.val();
        if (dono && dono !== SAR_NOME) {
            enviarNotificacao(dono, {
                tipo: "comentario",
                de: SAR_NOME,
                postId: postId,
                texto: resposta.substring(0, 80),
                time: Date.now()
            });
        }
    });
}

/* ================= POST ================= */

function postar() {
    let texto = postText.value.trim();

    // Verificar palavras proibidas
    let palavraErrada = verificarPalavras(texto);
    if (palavraErrada) {
        alert("❌ Palavra inapropriada detectada: " + palavraErrada);
        return;
    }

    let file = fotoInput.files[0];

    if (texto === "" && !file && !pollAtiva) return;

    // Montar dados da enquete
    let pollData = null;

    if (pollAtiva) {
        let inputs = document.querySelectorAll(".pollInput");
        let opcoes = [];

        inputs.forEach(i => {
            let v = i.value.trim();
            if (v) opcoes.push({ text: v, votos: 0 });
        });

        if (opcoes.length < 2) {
            alert("A enquete precisa de pelo menos 2 opções.");
            return;
        }

        let select = document.getElementById("pollTime");
        let tempo = parseInt(select.value);

        if (isNaN(tempo) || tempo <= 0) {
            alert("Defina um tempo válido para a enquete.");
            return;
        }

        pollData = {
            opcoes: opcoes,
            votosPorUsuario: {},
            expiraEm: Date.now() + tempo
        };
    }

    let id = db.ref("posts").push().key;

    function salvarPost() {
        let isSpoiler = document.getElementById("spoilerCheck") && document.getElementById("spoilerCheck").checked;
        let isSensitive = document.getElementById("sensitiveCheck") && document.getElementById("sensitiveCheck").checked;
        let post = {
            user: user,
            text: texto,
            likes: 0,
            time: Date.now(),
            photoBase64: fotoBase64 || null,
            spoiler: (fotoBase64 && isSpoiler) ? true : null,
            sensivel: (fotoBase64 && isSensitive) ? true : null,
            poll: pollData || null
        };

        db.ref("posts/" + id).set(post);

        if (mencionouSAR(texto)) responderComoSAR(id, texto, "");

        // Detectar @menções no post
        let mencoes = extrairMencoes(texto);
        mencoes.forEach(nome => {
            if (nome !== user) {
                enviarNotificacao(nome, {
                    tipo: "mencao",
                    de: user,
                    postId: id,
                    texto: texto.substring(0, 80),
                    time: Date.now()
                });
            }
        });

        postText.value = "";
        fotoInput.value = "";
        contador.innerText = "0 / 1000";
        fotoBase64 = null;
        uploadVisual.innerText = "📷 Escolher foto";
        uploadVisual.classList.remove("selected");
        previewImg.style.display = "none";
        document.getElementById("spoilerLabel").style.display = "none";
        document.getElementById("spoilerCheck").checked = false;
        document.getElementById("sensitiveLabel").style.display = "none";
        document.getElementById("sensitiveCheck").checked = false;
        previewImg.src = "";

        let spoilerEl = document.getElementById("spoilerCheck");
        if (spoilerEl) spoilerEl.checked = false;
        let spoilerLbl = document.getElementById("spoilerLabel");
        if (spoilerLbl) spoilerLbl.style.display = "none";
        resetarPoll();
        fecharPost();
        carregarFeed();
    }

    if (file) {
        if (!file.type.startsWith("image/")) {
            alert("Apenas imagens são permitidas.");
            return;
        }

        comprimirImagem(file).then(base64 => {
            fotoBase64 = base64;
            salvarPost();
        });
    } else {
        salvarPost();
    }
}

/* ================= LIKE ================= */

function curtir(id) {
    db.ref("posts/" + id + "/likedBy/" + user).once("value").then(snap => {
        let btn = document.getElementById("like-" + id);

        if (snap.exists()) {
            db.ref("posts/" + id + "/likedBy/" + user).remove();
            db.ref("posts/" + id + "/likes").transaction(n => Math.max((n || 1) - 1, 0));

            if (btn) btn.classList.remove("liked");
        } else {
            db.ref("posts/" + id + "/likedBy/" + user).set(true);
            db.ref("posts/" + id + "/likes").transaction(n => (n || 0) + 1);

            if (btn) {
                soltarCoracoes(btn);
                btn.classList.add("liked");
                setTimeout(() => btn.classList.remove("liked"), 400);
            }
        }
    });
}

/* ================= COMENTÁRIOS ================= */
async function comentar(id, donoPost) {
    // Verificar se o usuário logado está bloqueado pelo dono do post
    if (donoPost && donoPost !== user) {
        let bloqueado = await new Promise(res => estaBlockeadoPor(donoPost, res));
        if (bloqueado) {
            alert("❌ Você foi bloqueado por este usuário e não pode comentar.");
            return;
        }
    }

    let c = await customPrompt("Comentário:");
    if (!c) return;

    // Buscar dono do post para notificar
    db.ref("posts/" + id + "/user").once("value").then(snap => {
        let donoPosts = snap.val();
        if (donoPosts && donoPosts !== user) {
            enviarNotificacao(donoPosts, {
                tipo: "comentario",
                de: user,
                postId: id,
                texto: c.substring(0, 80),
                time: Date.now()
            });
        }
    });

    // Detectar @menções no comentário
    let mencoes = extrairMencoes(c);
    mencoes.forEach(nome => {
        if (nome !== user) {
            enviarNotificacao(nome, {
                tipo: "mencao",
                de: user,
                postId: id,
                texto: c.substring(0, 80),
                time: Date.now()
            });
        }
    });

    db.ref("comments/" + id).push({
        user: user,
        text: c,
        time: Date.now()
    });

    if (mencionouSAR(c)) {
        db.ref("posts/" + id + "/text").once("value").then(s => responderComoSAR(id, c, s.val() || ""));
    }
}

async function responder(postId, commentId, donoPost) {
    // Verificar se o usuário logado está bloqueado pelo dono do post
    if (donoPost && donoPost !== user) {
        let bloqueado = await new Promise(res => estaBlockeadoPor(donoPost, res));
        if (bloqueado) {
            alert("❌ Você foi bloqueado por este usuário e não pode responder.");
            return;
        }
    }

    let r = await customPrompt("Responder:");
    if (!r) return;

    // Buscar dono do comentário para notificar
    db.ref("comments/" + postId + "/" + commentId + "/user").once("value").then(snap => {
        let donoComentario = snap.val();
        if (donoComentario && donoComentario !== user) {
            enviarNotificacao(donoComentario, {
                tipo: "resposta",
                de: user,
                postId: postId,
                texto: r.substring(0, 80),
                time: Date.now()
            });
        }
    });

    // Detectar @menções na resposta
    let mencoes = extrairMencoes(r);
    mencoes.forEach(nome => {
        if (nome !== user) {
            enviarNotificacao(nome, {
                tipo: "mencao",
                de: user,
                postId: postId,
                texto: r.substring(0, 80),
                time: Date.now()
            });
        }
    });

    db.ref("replies/" + postId + "/" + commentId).push({
        user: user,
        text: r,
        time: Date.now()
    });
}

function carregarComentarios(id, div, donoPost) {
    /*
     * Abordagem sem listener .on() para respostas:
     * - Comentários chegam via .on("child_added") — cada um é adicionado ao DOM diretamente,
     *   sem reconstruir nada. Nunca chamamos div.innerHTML = "".
     * - Respostas existentes são buscadas com .once() e adicionadas ao rDiv do comentário.
     * - Novas respostas são ouvidas com .on("child_added") num rDiv estável (não destruído).
     * - Sets garantem que nenhum comentário ou resposta é inserido duas vezes.
     */
    let comentariosVistosIds = new Set();
    let respostasVistasMap = {};   // cid -> Set de reply keys
    let todosComentarios = [];     // para controle do "ver todos"
    let modoExpandido = false;
    let totalComentarios = 0;
    let btnVerTodos = null;

    function criarElComentario(c, cid) {
        let el = document.createElement("div");
        el.className = "comment" + (c.ia ? " sar-comment" : "");
        el.dataset.cid = cid;
        el.id = "comment-el-" + cid;

        let bloqueioBtn = "";
        if (donoPost === user && c.user !== user) {
            bloqueioBtn = `<button onclick="bloquearUsuario('${c.user}')" style="background:#1a0e0e;border:1px solid #3d1515;color:#e05555;font-size:10px;padding:3px 8px;border-radius:12px;margin-left:6px;cursor:pointer;">🚫 Bloquear</button>`;
        }

        el.innerHTML = `
            <span class="comment-user" onclick="abrirPerfil('${c.user}')">@${c.user}${usuarioVerificado(c.user) ? ' ✔️' : ''}</span> <span class="comment-text">${linkificar(c.text)}</span>
            ${bloqueioBtn}
            <br>
            <button onclick="responder('${id}','${cid}','${donoPost}')">Responder</button>
            <div id="r${cid}"></div>
        `;
        return el;
    }

    function atualizarVisibilidade() {
        // Mostra/oculta comentários baseado em modoExpandido
        todosComentarios.forEach((cid, idx) => {
            let el = document.getElementById("comment-el-" + cid);
            if (!el) return;
            el.style.display = (modoExpandido || idx < 3) ? "" : "none";
        });

        // Botão "ver todos"
        if (btnVerTodos) btnVerTodos.remove();
        btnVerTodos = null;

        if (totalComentarios > 3 && !modoExpandido) {
            btnVerTodos = document.createElement("button");
            btnVerTodos.className = "btn-ver-todos-comentarios";
            btnVerTodos.innerHTML = `··· ver todos ${totalComentarios} comentários`;
            btnVerTodos.onclick = () => { modoExpandido = true; atualizarVisibilidade(); };
            div.appendChild(btnVerTodos);
        }
    }

    function iniciarListenerRespostas(cid, rDiv) {
        if (!respostasVistasMap[cid]) respostasVistasMap[cid] = new Set();
        let vistas = respostasVistasMap[cid];

        db.ref("replies/" + id + "/" + cid)
            .orderByChild("time")
            .on("child_added", snap => {
                if (vistas.has(snap.key)) return;
                vistas.add(snap.key);
                let r = snap.val();
                let rel = document.createElement("div");
                rel.className = "reply";
                rel.dataset.rid = snap.key;
                rel.innerHTML = `↳ <span class="reply-user" onclick="abrirPerfil('${r.user}')">@${r.user}</span> <span class="comment-text">${linkificar(r.text)}</span>`;
                rDiv.appendChild(rel);
            });
    }

    db.ref("comments/" + id).orderByChild("time").on("child_added", snap => {
        if (comentariosVistosIds.has(snap.key)) return;
        comentariosVistosIds.add(snap.key);

        let c = snap.val();
        let cid = snap.key;
        totalComentarios++;
        todosComentarios.push(cid);

        let el = criarElComentario(c, cid);
        // Inserir antes do botão "ver todos" se existir
        if (btnVerTodos && div.contains(btnVerTodos)) {
            div.insertBefore(el, btnVerTodos);
        } else {
            div.appendChild(el);
        }

        if (btnVerTodos && div.contains(btnVerTodos)) {
            div.insertBefore(el, btnVerTodos);
        } else {
            div.appendChild(el);
        }

        // Ocultar se não expandido e índice >= 3
        if (!modoExpandido && todosComentarios.length > 3) {
            el.style.display = "none";
        }

        atualizarVisibilidade();

        // Iniciar listener de respostas direto no rDiv estável
        let rDiv = document.getElementById("r" + cid);
        if (rDiv) iniciarListenerRespostas(cid, rDiv);
    });
}

/* ================= RENDER ================= */

let feed = document.getElementById("feed");

function renderSpoilerImg(container, src) {
    // Wrapper relativo para posicionar o overlay
    let wrapper = document.createElement("div");
    wrapper.style.cssText = "position:relative;display:inline-block;width:100%;";

    let img = document.createElement("img");
    img.src = src;
    img.style.cssText = "width:100%;border-radius:10px;display:block;filter:blur(18px) brightness(0.55);transition:filter 0.4s ease;";

    // Overlay com botão
    let overlay = document.createElement("div");
    overlay.style.cssText = "position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;border-radius:10px;cursor:pointer;";

    let icon = document.createElement("div");
    icon.style.cssText = "filter:drop-shadow(0 2px 6px #000a);";
    icon.innerHTML = '<svg class="monkey-sprite" width="40" height="40"><use href="#sprite-monkey"/></svg>';

    let btn = document.createElement("button");
    btn.innerText = "⚠️ Spoiler";
    btn.style.cssText = "background:rgba(245,158,11,0.18);border:1.5px solid #f59e0b;color:#f59e0b;font-size:13px;font-weight:700;padding:8px 22px;border-radius:20px;cursor:pointer;letter-spacing:0.5px;backdrop-filter:blur(4px);transition:background 0.2s;margin:0;";
    btn.onmouseenter = () => btn.style.background = "rgba(245,158,11,0.32)";
    btn.onmouseleave = () => btn.style.background = "rgba(245,158,11,0.18)";

    let revealed = false;
    function revelar(e) {
        e.stopPropagation();
        if (revealed) { abrirImagem(src); return; }
        revealed = true;
        img.style.filter = "none";
        overlay.style.display = "none";
    }

    overlay.onclick = revelar;
    btn.onclick = revelar;

    overlay.appendChild(icon);
    overlay.appendChild(btn);
    wrapper.appendChild(img);
    wrapper.appendChild(overlay);
    container.appendChild(wrapper);
}

function renderSensitiveImg(container, src) {
    let wrapper = document.createElement("div");
    wrapper.style.cssText = "position:relative;display:inline-block;width:100%;";

    let img = document.createElement("img");
    img.src = src;
    img.style.cssText = "width:100%;border-radius:10px;display:block;filter:blur(28px) brightness(0.45);transition:filter 0.4s ease;";

    let overlay = document.createElement("div");
    overlay.style.cssText = "position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;border-radius:10px;cursor:pointer;background:rgba(20,0,0,0.15);";

    let icon = document.createElement("div");
    icon.style.cssText = "filter:drop-shadow(0 2px 6px #000a);";
    icon.innerHTML = '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#e05555" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';

    let label = document.createElement("div");
    label.style.cssText = "font-size:12px;color:#e0a0a0;text-align:center;max-width:240px;line-height:1.5;";
    label.innerText = "Esta imagem pode conter conteúdo sensível.";

    let btn = document.createElement("button");
    btn.innerText = "Ver mesmo assim";
    btn.style.cssText = "background:rgba(224,85,85,0.18);border:1.5px solid #e05555;color:#ff8a8a;font-size:13px;font-weight:700;padding:8px 22px;border-radius:20px;cursor:pointer;letter-spacing:0.5px;backdrop-filter:blur(4px);transition:background 0.2s;margin:0;";
    btn.onmouseenter = () => btn.style.background = "rgba(224,85,85,0.32)";
    btn.onmouseleave = () => btn.style.background = "rgba(224,85,85,0.18)";

    let revealed = false;
    function revelar(e) {
        e.stopPropagation();
        if (revealed) { abrirImagem(src); return; }
        revealed = true;
        img.style.filter = "none";
        overlay.style.display = "none";
    }

    overlay.onclick = revelar;
    btn.onclick = revelar;

    overlay.appendChild(icon);
    overlay.appendChild(label);
    overlay.appendChild(btn);
    wrapper.appendChild(img);
    wrapper.appendChild(overlay);
    container.appendChild(wrapper);
}

function renderPost(id, p, fotosMap) {
    // Não renderizar se já existir
    if (document.getElementById("post-" + id)) return;

    let div = document.createElement("div");
    div.className = "post";
    div.id = "post-" + id;

    // Adiciona ANTES do async para garantir a ordem
    feed.appendChild(div);

    // Usar foto do mapa pré-carregado se disponível, senão buscar individualmente
    let fotoPromise = (fotosMap && fotosMap[p.user] !== undefined)
        ? Promise.resolve(fotosMap[p.user])
        : db.ref("fotosPerfil/" + p.user).once("value").then(s => s.val());

    Promise.all([
        db.ref("posts/" + id + "/likedBy/" + user).once("value"),
        fotoPromise
    ]).then(([snap, fotoUrl]) => {
        let isLiked = snap.exists();

        const badgeVerificado = `
            <span class="verificado">
            <svg viewBox="0 0 24 24" aria-label="Verificado">
            <path fill="#0095F6" d="M22 12l-2.2-2.2.5-3-3-.5L15 3l-3 1-3-1-2.3 3.3-3 .5.5 3L2 12l2.2 2.2-.5 3 3 .5L9 21l3-1 3 1 2.3-3.3 3-.5-.5-3z"/>
            <path fill="#fff" d="M9.5 12.5l2 2 4-4-1.2-1.2-2.8 2.8-0.8-0.8z"/>
            </svg>
            </span>`;

        let avatarHtml = fotoUrl
            ? `<img class="feed-avatar" src="${fotoUrl}" onclick="abrirPerfil('${p.user}')" alt="${p.user}">`
            : `<div class="feed-avatar-placeholder" onclick="abrirPerfil('${p.user}')">
                <svg viewBox="0 0 24 24" fill="white" width="22" height="22" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                </svg>
               </div>`;

        div.innerHTML = `
            <div class="post-header">
                ${avatarHtml}
                <div class="user" onclick="abrirPerfil('${p.user}')">
                    @${p.user}${usuarioVerificado(p.user) ? badgeVerificado : ''}
                </div>
            </div>
            <div class="text" id="text-${id}">${linkificar(p.text)}</div>
            <div id="img-${id}"></div>
            <div id="poll-${id}"></div>

            <div class="actions">
                <button id="like-${id}" onclick="curtir('${id}')"
                    style="${isLiked ? 'color:#ff6b81;border-color:#2a1a1e;' : ''}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="${isLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="emoji" style="margin-right:4px;"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> ${p.likes || 0}
                </button>

                <button onclick="comentar('${id}','${p.user}')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="emoji" style="margin-right:4px;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> comentar
                </button>

                ${p.user === user ? `
                <button onclick="editarPost('${id}')">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Editar
                </button>
                <button onclick="deletarPost('${id}')">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg> Deletar
                </button>` : ""}
            </div>

            <div id="c${id}" class="comment-box"></div>
        `;

        // Render enquete
        if (p.poll) {
            renderEnquete(id, p.poll);
        }

        // Render imagem
        if (p.photoBase64) {
            let container = document.getElementById("img-" + id);
            if (p.sensivel) {
                renderSensitiveImg(container, p.photoBase64);
            } else if (p.spoiler) {
                renderSpoilerImg(container, p.photoBase64);
            } else {
                let img = document.createElement("img");
                img.src = p.photoBase64;
                img.onclick = () => abrirImagem(p.photoBase64);
                container.appendChild(img);
            }
        }

        carregarComentarios(id, document.getElementById("c" + id), p.user);
    });
}
function carregarFeed() {
    carregarFeedFiltrado();
}

function deletarPost(id) {
    customConfirm("Deseja deletar este post?").then(ok => {
        if (!ok) return;

        db.ref("posts/" + id).remove();
        db.ref("comments/" + id).remove();
        db.ref("replies/" + id).remove();
        fotoDB.ref("fotos/" + id).remove();

        carregarFeed();
    });
}
async function editarPost(id) {
    let atual = document.getElementById("text-" + id).innerText;
    let novo = await customPrompt("Editar post:\n\n" + atual);

    if (novo) {
        let palavraErrada = verificarPalavras(novo);
        if (palavraErrada) {
            alert("❌ Palavra inapropriada: " + palavraErrada);
            return;
        }
        db.ref("posts/" + id + "/text").set(novo);
        document.getElementById("text-" + id).innerHTML = linkificar(novo);
    }
}

function logout() {
    customConfirm("Deseja sair da conta?").then(ok => {
        if (!ok) return;

        localStorage.removeItem("user");
        sessionStorage.removeItem("user");
        document.cookie = "user=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;";
        location.href = "login.html";
    });
}
function abrirMenu() {
    document.getElementById("menuOverlay").style.display = "block";
    document.getElementById("menuLateral").style.left = "0";
}

function fecharMenu() {
    document.getElementById("menuOverlay").style.display = "none";
    document.getElementById("menuLateral").style.left = "-260px";
}

function abrirConfig() {
    fecharMenu();
    document.getElementById("configOverlay").style.display = "block";
    document.getElementById("configBox").style.bottom = "0";
}

function fecharConfig() {
    document.getElementById("configOverlay").style.display = "none";
    document.getElementById("configBox").style.bottom = "-300px";
}

function abrirchat() {
    fecharMenu();
    setTimeout(() => { location.href = "chat.html"; }, 200);
}

function abrirverificar() {
    fecharMenu();
    setTimeout(() => { location.href = "verificado.html"; }, 200);
}
/* ================= PARTÍCULAS DE LIKE ================= */
function soltarCoracoes(botao) {
    let rect = botao.getBoundingClientRect();

    for (let i = 0; i < 6; i++) {
        let heart = document.createElement("div");
        heart.className = "heart-particle";
        heart.innerText = "❤️";

        heart.style.position = "fixed";
        heart.style.left = (rect.left + rect.width / 2 + (Math.random() * 20 - 10)) + "px";
        heart.style.top = (rect.top + window.scrollY) + "px";

        document.body.appendChild(heart);
        setTimeout(() => heart.remove(), 1000);
    }
}
function renderEnquete(postId, poll) {
    let container = document.getElementById("poll-" + postId);
    if (!container) return;
    container.innerHTML = "";

    let pollDiv = document.createElement("div");
    pollDiv.className = "pollBox";

    // Timer
    let restante = poll.expiraEm - Date.now();
    let tempoEl = document.createElement("div");
    tempoEl.style.cssText = "font-size:12px;color:#888;margin-bottom:6px;";

    if (restante <= 0) {
        tempoEl.innerText = "⛔ Enquete encerrada";
    } else {
        let min = Math.floor(restante / 60000);
        tempoEl.innerText = "⏳ " + min + " min restantes";
    }
    pollDiv.appendChild(tempoEl);

    let total = poll.opcoes.reduce((s, o) => s + o.votos, 0);
    let votoAtual = (poll.votosPorUsuario && poll.votosPorUsuario[user] != null)
        ? poll.votosPorUsuario[user]
        : undefined;
    let encerrada = Date.now() > poll.expiraEm;

    poll.opcoes.forEach((op, index) => {
        let porcentagem = total ? Math.round((op.votos / total) * 100) : 0;
        let isVotada = votoAtual === index;

        let btn = document.createElement("button");
        btn.className = "pollBtn" + (isVotada ? " voted" : "");
        btn.dataset.index = index;

        btn.style.setProperty("--pct", porcentagem + "%");

        btn.innerHTML = `
            <span class="poll-label">${op.text}</span>
            <span class="poll-pct">${porcentagem}%</span>
        `;

        if (encerrada) {
            btn.disabled = true;
            btn.style.opacity = "0.6";
        } else {
            btn.onclick = () => votarEnquete(postId, index);
        }

        pollDiv.appendChild(btn);
    });

    container.appendChild(pollDiv);

    if (restante > 0) {
        setTimeout(() => limparEnqueteExpirada(postId), restante);
    }
}

function limparEnqueteExpirada(postId) {
    db.ref("posts/" + postId + "/poll/expiraEm").once("value").then(snap => {
        if (!snap.exists()) return;
        let expiraEm = snap.val();

        if (Date.now() < expiraEm) return;

        db.ref("posts/" + postId + "/poll").remove().then(() => {
            let container = document.getElementById("poll-" + postId);
            if (container) container.innerHTML = "";
        });
    });
}

function votarEnquete(postId, index) {
    let ref = db.ref("posts/" + postId);

    ref.transaction(post => {
        if (!post || !post.poll) return post;
        if (Date.now() > post.poll.expiraEm) return post;

        if (!post.poll.votosPorUsuario) post.poll.votosPorUsuario = {};

        let votoAnterior = (post.poll.votosPorUsuario && post.poll.votosPorUsuario[user] != null)
            ? post.poll.votosPorUsuario[user]
            : undefined;

        if (votoAnterior === index) {
            post.poll.opcoes[index].votos = Math.max((post.poll.opcoes[index].votos || 1) - 1, 0);
            post.poll.votosPorUsuario[user] = null;

        } else if (votoAnterior !== undefined) {
            post.poll.opcoes[votoAnterior].votos = Math.max((post.poll.opcoes[votoAnterior].votos || 1) - 1, 0);
            post.poll.opcoes[index].votos = (post.poll.opcoes[index].votos || 0) + 1;
            post.poll.votosPorUsuario[user] = index;

        } else {
            post.poll.opcoes[index].votos = (post.poll.opcoes[index].votos || 0) + 1;
            post.poll.votosPorUsuario[user] = index;
        }

        return post;
    }).then(result => {
        if (!result.committed) return;
        let poll = result.snapshot.val().poll;
        if (!poll) return;

        let btn = document.querySelector(`#poll-${postId} .pollBtn[data-index="${index}"]`);
        if (btn) {
            btn.classList.add("poll-pulse");
            setTimeout(() => btn.classList.remove("poll-pulse"), 350);
        }

        renderEnquete(postId, poll);
    });
}
function abrirBusca() {
    document.getElementById("buscaOverlay").style.display = "block";
    document.getElementById("buscaBox").style.display = "block";
    setTimeout(() => document.getElementById("buscaInput").focus(), 100);
}

function fecharBusca() {
    document.getElementById("buscaOverlay").style.display = "none";
    document.getElementById("buscaBox").style.display = "none";
    document.getElementById("buscaInput").value = "";
    document.getElementById("buscaResultados").innerHTML = `<div style="color:#555;font-size:13px;text-align:center;">Digite para buscar...</div>`;
}

let buscaTimer = null;

function buscarUsuarios(query) {
    clearTimeout(buscaTimer);
    let resultados = document.getElementById("buscaResultados");

    query = query.trim().toLowerCase();

    if (!query) {
        resultados.innerHTML = `<div style="color:#555;font-size:13px;text-align:center;">Digite para buscar...</div>`;
        return;
    }

    resultados.innerHTML = `<div style="color:#555;font-size:13px;text-align:center;">Buscando...</div>`;

    buscaTimer = setTimeout(() => {
        db.ref("posts").orderByChild("user").once("value").then(snap => {
            let usuariosUnicos = new Set();
            snap.forEach(child => {
                let nome = child.val().user;
                if (nome) usuariosUnicos.add(nome);
            });

            let encontrados = [...usuariosUnicos].filter(nome =>
                nome.toLowerCase().includes(query)
            );

            if (encontrados.length === 0) {
                resultados.innerHTML = `<div style="color:#555;font-size:13px;text-align:center;">Nenhum usuário encontrado.</div>`;
                return;
            }

            resultados.innerHTML = "";

            let promises = encontrados.slice(0, 10).map(nome =>
                Promise.all([
                    db.ref("fotosPerfil/" + nome).once("value"),
                    db.ref("bios/" + nome).once("value")
                ]).then(([fotoSnap, bioSnap]) => ({ nome, foto: fotoSnap.val(), bio: bioSnap.val() }))
            );

            Promise.all(promises).then(lista => {
                lista.forEach(({ nome, foto, bio }) => {
                    let el = document.createElement("div");
                    el.className = "busca-resultado";
                    el.onclick = () => { fecharBusca(); abrirPerfil(nome); };

                    let avatarHtml = foto
                        ? `<img class="busca-avatar" src="${foto}" alt="${nome}">`
                        : `<div class="busca-avatar-placeholder">${nome.charAt(0).toUpperCase()}</div>`;

                    let bioHtml = bio
                        ? `<div style="font-size:12px;color:#777;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px;">${bio}</div>`
                        : "";

                    el.innerHTML = `
                        ${avatarHtml}
                        <div>
                            <div style="font-weight:bold;color:#2ee6a6;font-size:14px;">@${nome}</div>
                            ${bioHtml}
                        </div>
                    `;
                    resultados.appendChild(el);
                });
            });
        });
    }, 300);
}
function extrairMencoes(texto) {
    let matches = texto.match(/@([A-Za-zÀ-ÿ0-9_.]+)/g) || [];
    return matches.map(m => m.replace('@', '').trim()).filter(Boolean);
}
function enviarNotificacao(destinatario, dados) {
    let nomeKey = destinatario.replace(/[.#$[\]]/g, '_');
    db.ref("notificacoes/" + nomeKey).push(dados);
}

function tempoRelativo(ts) {
    let diff = Date.now() - ts;
    if (diff < 60000)    return "agora";
    if (diff < 3600000)  return Math.floor(diff / 60000) + " min atrás";
    if (diff < 86400000) return Math.floor(diff / 3600000) + "h atrás";
    return Math.floor(diff / 86400000) + "d atrás";
}

function iconeNotif(tipo) {
    return { comentario: "💬", resposta: "↩️", mencao: "📣", chat: "✉️", story_tag: "🏷️" }[tipo] || "🔔";
}

function textoNotif(n) {
    let nome = `<span class="notif-nome">@${n.de}</span>`;
    if (n.tipo === "comentario") return `${nome} comentou no seu post`;
    if (n.tipo === "resposta")   return `${nome} respondeu seu comentário`;
    if (n.tipo === "mencao")     return `${nome} mencionou você`;
    if (n.tipo === "chat")       return `${nome} enviou uma mensagem`;
    if (n.tipo === "story_tag")  return `${nome} marcou você em um story`;
    return `${nome} interagiu com você`;
}

let notifNaoLidas = 0;
let notifPainelAberto = false;

function atualizarBadge(total) {
    let badge = document.getElementById("notifBadge");
    if (!badge) return;
    if (localStorage.getItem('notifSilenciada') === '1') {
        badge.style.display = "none";
        return;
    }
    if (total > 0) {
        badge.style.display = "flex";
        badge.innerText = total > 99 ? "99+" : total;
        badge.classList.add("pulse");
        setTimeout(() => badge.classList.remove("pulse"), 400);
    } else {
        badge.style.display = "none";
    }
}

function escutarNotificacoes() {
    if (!user) return;
    let nomeKey = user.replace(/[.#$[\]]/g, '_');
    let ref = db.ref("notificacoes/" + nomeKey);

    ref.on("child_added", snap => {
        let n = snap.val();
        if (!n.lida) {
            notifNaoLidas++;
            atualizarBadge(notifNaoLidas);
            if (notifPainelAberto) renderNotificacoes();
        }
    });
}

function renderNotificacoes() {
    let lista = document.getElementById("notifLista");
    if (!lista) return;
    lista.innerHTML = `<div class="notif-vazia">Carregando...</div>`;

    let nomeKey = user.replace(/[.#$[\]]/g, '_');
    db.ref("notificacoes/" + nomeKey).orderByChild("time").limitToLast(30).once("value").then(snap => {
        let notifs = [];
        snap.forEach(child => notifs.push({ id: child.key, ...child.val() }));
        notifs.reverse();

        if (notifs.length === 0) {
            lista.innerHTML = `<div class="notif-vazia">Sem notificações ainda 🙂</div>`;
            return;
        }

        lista.innerHTML = "";
        notifs.forEach(n => {
            let el = document.createElement("div");
            el.className = "notif-item" + (!n.lida ? " nao-lida" : "");
            el.innerHTML = `
                <div class="notif-icon">${iconeNotif(n.tipo)}</div>
                <div class="notif-corpo">
                    <div class="notif-texto">${textoNotif(n)}</div>
                    ${n.texto ? `<div style="font-size:11px;color:#555;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">"${n.texto}"</div>` : ''}
                    <div class="notif-tempo">${tempoRelativo(n.time)}</div>
                </div>
            `;
            
            if (!n.lida) {
                let observer = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            // Marcar como lida no Firebase
                            db.ref("notificacoes/" + nomeKey + "/" + n.id + "/lida").set(true);
                            el.classList.remove("nao-lida");
                            observer.disconnect();
                        }
                    });
                }, { threshold: 0.5 });
                observer.observe(el);
            }

            if (n.postId) {
                el.onclick = () => {
                    fecharNotificacoes();
                    let postEl = document.getElementById("post-" + n.postId);
                    if (postEl) postEl.scrollIntoView({ behavior: "smooth", block: "center" });
                };
            }
            lista.appendChild(el);
        });

        // Atualizar badge após render
        db.ref("notificacoes/" + nomeKey).orderByChild("lida").equalTo(false).once("value").then(s => {
            notifNaoLidas = s.numChildren();
            atualizarBadge(notifNaoLidas);
        });
    });
}

function marcarTodasLidas() {
    let nomeKey = user.replace(/[.#$[\]]/g, '_');
    db.ref("notificacoes/" + nomeKey).once("value").then(snap => {
        let updates = {};
        snap.forEach(child => {
            if (!child.val().lida) {
                updates[child.key + "/lida"] = true;
            }
        });
        if (Object.keys(updates).length > 0) {
            db.ref("notificacoes/" + nomeKey).update(updates).then(() => {
                notifNaoLidas = 0;
                atualizarBadge(0);
                renderNotificacoes();
            });
        }
    });
}

function toggleNotificacoes() {
    if (notifPainelAberto) {
        fecharNotificacoes();
    } else {
        abrirNotificacoes();
    }
}

function abrirNotificacoes() {
    document.getElementById("notifOverlay").style.display = "block";
    document.getElementById("notifPanel").style.display = "block";
    notifPainelAberto = true;
    renderNotificacoes();
}

function fecharNotificacoes() {
    document.getElementById("notifOverlay").style.display = "none";
    document.getElementById("notifPanel").style.display = "none";
    notifPainelAberto = false;
}
function notificarChat(destinatario, mensagem) {
    if (destinatario && destinatario !== user) {
        enviarNotificacao(destinatario, {
            tipo: "chat",
            de: user,
            texto: mensagem.substring(0, 80),
            time: Date.now()
        });
    }
}
postText.addEventListener("input", () => {
    contador.innerText = postText.value.length + " / 1000";
});

escutarNotificacoes();
carregarBloqueados();
carregarUsuariosExistentes(); // pré-carregar para @menções
carregarFeed();

let feedTabAtual = 'foryou';
let followingList = new Set();

function setFeedTab(tab) {
    feedTabAtual = tab;
    document.querySelectorAll('.feed-tab').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + tab).classList.add('active');
    carregarFeedFiltrado();
}

function carregarFollowing(callback) {
    let nomeKey = user.replace(/[.#$[\]]/g, '_');
    db.ref('seguindo/' + nomeKey).once('value').then(snap => {
        followingList.clear();
        if (snap.exists()) {
            snap.forEach(child => followingList.add(child.key));
        }
        if (callback) callback();
    });
}

function carregarFeedFiltrado() {
    feed.innerHTML = '';
    const loadingEl = document.getElementById('feedLoading');
    if (loadingEl) loadingEl.style.display = 'flex';

    db.ref('posts')
        .orderByChild('time')
        .limitToLast(50)
        .once('value', snap => {
            if (loadingEl) loadingEl.style.display = 'none';

            let posts = [];
            snap.forEach(child => {
                posts.push({ id: child.key, data: child.val() });
            });

            posts.sort((a, b) => b.data.time - a.data.time);

            // Filtrar por tab
            if (feedTabAtual === 'following') {
                posts = posts.filter(p => followingList.has(p.data.user) || p.data.user === user);
            } else if (feedTabAtual === 'foryou') {
                // Ranqueia por relevância: recência + engajamento + afinidade
                // com autores e hashtags que o usuário já curtiu, e prioridade
                // leve para quem ele segue.
                let interesses = calcularInteresses(posts);
                posts = posts
                    .map(p => ({ ...p, _score: calcularScoreForYou(p, interesses) }))
                    .sort((a, b) => b._score - a._score);
            }
            // 'all' mostra tudo em ordem cronológica

            let nomesUnicos = [...new Set(posts.map(p => p.data.user).filter(Boolean))];
            let fotosPromise = Promise.all(
                nomesUnicos.map(nome =>
                    db.ref('fotosPerfil/' + nome).once('value').then(s => [nome, s.val()])
                )
            ).then(entries => Object.fromEntries(entries));

            fotosPromise.then(fotosMap => {
                if (posts.length === 0) {
                    feed.innerHTML = '<div style="text-align:center;color:#555;padding:40px 20px;font-size:14px;">Nenhum post aqui ainda.</div>';
                    return;
                }
                posts.forEach(p => renderPost(p.id, p.data, fotosMap));
            });
        });

    db.ref('posts').on('child_changed', snap => {
        let id = snap.key;
        let p = snap.val();
        let btn = document.getElementById('like-' + id);
        if (btn) btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="margin-right:4px;"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> ${p.likes || 0}`;
    });
}

function toggleHashtagInfo() {
    let box = document.getElementById('hashtagInfoBox');
    box.style.display = box.style.display === 'none' ? 'block' : 'none';
}

/* ================= USUÁRIOS BLOQUEADOS (PAINEL) ================= */

function abrirBloqueadosPanel() {
    fecharMenu();
    fecharConfig();
    document.getElementById('bloqueadosOverlay').style.display = 'block';
    document.getElementById('bloqueadosBox').style.display = 'block';
    renderBloqueadosLista();
}

function fecharBloqueadosPanel() {
    document.getElementById('bloqueadosOverlay').style.display = 'none';
    document.getElementById('bloqueadosBox').style.display = 'none';
}

function renderBloqueadosLista() {
    let lista = document.getElementById('bloqueadosLista');
    lista.innerHTML = '';

    if (usuariosBloqueados.size === 0) {
        lista.innerHTML = '<div style="color:#555;font-size:13px;text-align:center;padding:10px 0;">Você não bloqueou ninguém ainda.</div>';
        return;
    }

    usuariosBloqueados.forEach(nomeKey => {
        let item = document.createElement('div');
        item.style.cssText = 'display:flex;align-items:center;justify-content:space-between;background:#161616;border:1px solid #222;border-radius:10px;padding:10px 12px;';
        item.innerHTML = `
            <span style="font-size:13px;color:#ddd;">@${nomeKey}</span>
            <button onclick="desbloquearUsuario('${nomeKey}')" style="background:#1c1c1c;border:1px solid #333;color:#1da1f2;font-size:12px;padding:6px 10px;border-radius:8px;cursor:pointer;">Desbloquear</button>
        `;
        lista.appendChild(item);
    });
}

/* ================= SOBRE ================= */

function abrirSobre() {
    fecharMenu();
    fecharConfig();
    document.getElementById('sobreOverlay').style.display = 'block';
    document.getElementById('sobreBox').style.display = 'block';
}

function fecharSobre() {
    document.getElementById('sobreOverlay').style.display = 'none';
    document.getElementById('sobreBox').style.display = 'none';
}

/* ================= SILENCIAR NOTIFICAÇÕES ================= */

function atualizarBotaoSilenciar() {
    let btn = document.getElementById('btnSilenciarTexto');
    if (!btn) return;
    let silenciado = localStorage.getItem('notifSilenciada') === '1';
    btn.innerText = silenciado ? 'Ativar notificações' : 'Silenciar notificações';
}

function toggleSilenciarNotificacoes() {
    let silenciado = localStorage.getItem('notifSilenciada') === '1';
    if (silenciado) {
        localStorage.removeItem('notifSilenciada');
    } else {
        localStorage.setItem('notifSilenciada', '1');
        let badge = document.getElementById('notifBadge');
        if (badge) badge.style.display = 'none';
    }
    atualizarBotaoSilenciar();
}

/* ================= ALGORITMO "FOR YOU" ================= */

function extrairHashtags(texto) {
    if (!texto) return [];
    let matches = texto.match(/#[a-zA-Z0-9À-ÿ_]+/g) || [];
    return matches.map(h => h.toLowerCase());
}

function calcularInteresses(posts) {
    let autoresCurtidos = {};
    let hashtagsCurtidas = {};

    posts.forEach(p => {
        let curtiuEsse = p.data.likedBy && p.data.likedBy[user];
        if (curtiuEsse) {
            autoresCurtidos[p.data.user] = (autoresCurtidos[p.data.user] || 0) + 1;
            extrairHashtags(p.data.text).forEach(h => {
                hashtagsCurtidas[h] = (hashtagsCurtidas[h] || 0) + 1;
            });
        }
    });

    return { autoresCurtidos, hashtagsCurtidas };
}

function calcularScoreForYou(p, interesses) {
    let horasDesdePost = (Date.now() - p.data.time) / 3600000;
    let scoreRecencia = Math.max(0, 48 - horasDesdePost) * 0.8;
    let scoreEngajamento = Math.log((p.data.likes || 0) + 1) * 4;
    let scoreAutor = (interesses.autoresCurtidos[p.data.user] || 0) * 8;
    let scoreSeguindo = followingList.has(p.data.user) ? 6 : 0;

    let scoreHashtag = 0;
    extrairHashtags(p.data.text).forEach(h => {
        scoreHashtag += (interesses.hashtagsCurtidas[h] || 0) * 5;
    });

    return scoreRecencia + scoreEngajamento + scoreAutor + scoreSeguindo + scoreHashtag;
}

document.addEventListener('DOMContentLoaded', () => {
    atualizarBotaoSilenciar();
    carregarFollowing(() => iniciarStories());
});

/* ================= STORIES (24h) ================= */
// OPCIONAL: sem URL, os stories ficam no Firebase (vídeo até 50 MB). Com a URL do stories-drive.gs, vão para o Google Drive.
const STORY_DRIVE_URL = "COLE_AQUI_A_URL_DO_APPS_SCRIPT";

const STORY_MAX_VIDEO_SEG = 90;                 // 1min30
const STORY_MAX_BYTES     = 200 * 1024 * 1024;  // 200 MB
const STORY_DURACAO_MS    = 24 * 60 * 60 * 1000;
const STORY_FOTO_MS       = 6000;
const STORY_MAX_FB        = 50 * 1024 * 1024;   // vídeo máx. no modo sem Drive (Firebase)
const STORY_CHUNK         = 500000;             // caracteres base64 por pedaço
const storyMidiaCache     = {};

const $s = id => document.getElementById(id);
const storyKey = n => n.replace(/[.#$[\]]/g, '_');
const storyUrlFoto    = id => `https://lh3.googleusercontent.com/d/${encodeURIComponent(id)}=w1600`;
const storyUrlFotoAlt = id => `https://drive.google.com/uc?export=view&id=${encodeURIComponent(id)}`;
const storyUrlVideo   = id => `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`;
const storyUrlPreview = id => `https://drive.google.com/file/d/${encodeURIComponent(id)}/preview`;

let storiesPorUsuario = {};   // nome -> [story] (só quem eu sigo + eu)
let storyFila = [];           // ordem de exibição na barra
let storyFotos = {};          // cache de fotos de perfil
let storiesRef = null;
let storyEd = null;           // estado do editor
let storyVw = null;           // estado do visualizador

/* ---------- helpers ---------- */

function storyConfigurado() { return /^https:\/\//.test(STORY_DRIVE_URL); }

function storyVistos() {
    try { return JSON.parse(localStorage.getItem('storiesVistos') || '{}'); } catch (e) { return {}; }
}
function storyMarcarVisto(id) {
    const v = storyVistos();
    if (v[id]) return;
    v[id] = Date.now();
    try { localStorage.setItem('storiesVistos', JSON.stringify(v)); } catch (e) {}
}
function storyTemNovo(nome) {
    const v = storyVistos();
    return (storiesPorUsuario[nome] || []).some(s => !v[s.id]);
}

function storyFormatarHora(ts, f) {
    const d = new Date(ts);
    const h = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    if (f === 1) return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + h;
    return h;
}
function storyFormatarDur(seg) {
    seg = Math.round(seg);
    return Math.floor(seg / 60) + ':' + String(seg % 60).padStart(2, '0');
}

function storyAvatarEl(nome, cls) {
    const foto = storyFotos[nome];
    let el;
    if (foto) { el = document.createElement('img'); el.src = foto; el.alt = nome; }
    else { el = document.createElement('div'); el.textContent = nome.charAt(0).toUpperCase(); }
    el.className = cls;
    return el;
}

/* ---------- Drive (via Apps Script) ---------- */

async function storyDrive(payload) {
    const r = await fetch(STORY_DRIVE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // evita preflight CORS
        body: JSON.stringify(payload)
    });
    const j = await r.json();
    if (!j.ok) throw new Error(j.erro || 'erro no Drive');
    return j;
}
function storyDriveDelete(id) {
    if (storyConfigurado() && id) storyDrive({ action: 'delete', id }).catch(() => {});
}

async function storyUploadDrive(blob, nome, onProg) {
    const init = await storyDrive({
        action: 'init', nome, mime: blob.type, size: blob.size, origin: location.origin
    });
    return new Promise((ok, err) => {
        const x = new XMLHttpRequest();
        x.open('PUT', init.uploadUrl);
        x.upload.onprogress = e => { if (e.lengthComputable) onProg(Math.round(e.loaded / e.total * 100)); };
        x.onload = () => {
            if (x.status >= 200 && x.status < 300) {
                try { ok(JSON.parse(x.responseText).id); }
                catch (e) { err(new Error('resposta inválida do Drive')); }
            } else err(new Error('o Drive respondeu ' + x.status));
        };
        x.onerror = () => err(new Error('falha de rede ao enviar para o Drive'));
        x.send(blob);
    });
}

/* ---------- modo sem Drive: salva no Firebase ---------- */

function storyLerBase64(blob) {
    return new Promise((ok, err) => {
        const r = new FileReader();
        r.onload = () => ok(String(r.result).split(',')[1] || '');
        r.onerror = () => err(new Error('não consegui ler o arquivo'));
        r.readAsDataURL(blob);
    });
}

async function storyUploadFirebase(blob, id, onProg) {
    const b64 = await storyLerBase64(blob);
    const ref = fotoDB.ref('storyMidia/' + storyKey(user) + '/' + id);
    const n = Math.ceil(b64.length / STORY_CHUNK);
    for (let k = 0; k < n; k++) {
        await ref.child(String(k)).set(b64.slice(k * STORY_CHUNK, (k + 1) * STORY_CHUNK));
        onProg(Math.round((k + 1) / n * 100));
    }
    return n;
}

async function storyCarregarFb(s) {
    if (storyMidiaCache[s.id]) return storyMidiaCache[s.id];
    const snap = await fotoDB.ref('storyMidia/' + storyKey(s.user) + '/' + s.id).once('value');
    const partes = [];
    snap.forEach(c => { partes[Number(c.key)] = c.val(); });
    if (!partes.length) throw new Error('mídia não encontrada');
    const r = await fetch('data:' + (s.mime || 'application/octet-stream') + ';base64,' + partes.join(''));
    return (storyMidiaCache[s.id] = URL.createObjectURL(await r.blob()));
}

function storyApagarMidiaFb(nome, id) {
    fotoDB.ref('storyMidia/' + storyKey(nome) + '/' + id).remove().catch(() => {});
}

function storyComprimirFoto(url) {
    return new Promise((ok, err) => {
        const i = new Image();
        i.onload = () => {
            const max = 1440, s = Math.min(max / i.naturalWidth, max / i.naturalHeight, 1);
            const c = document.createElement('canvas');
            c.width = Math.round(i.naturalWidth * s);
            c.height = Math.round(i.naturalHeight * s);
            const ctx = c.getContext('2d');
            ctx.fillStyle = '#000'; ctx.fillRect(0, 0, c.width, c.height);
            ctx.drawImage(i, 0, 0, c.width, c.height);
            c.toBlob(b => b ? ok(b) : err(new Error('falha ao comprimir a foto')), 'image/jpeg', 0.85);
        };
        i.onerror = () => err(new Error('não consegui ler a foto'));
        i.src = url;
    });
}

/* ---------- barra de stories ---------- */

function iniciarStories() {
    if (storiesRef) return;
    renderStoriesBar();
    storiesRef = db.ref('stories');
    let t = null;
    storiesRef.on('value', snap => {
        clearTimeout(t);
        t = setTimeout(() => processarStories(snap), 150);
    });
}

function processarStories(snap) {
    const agora = Date.now();
    const mapa = {};

    snap.forEach(userSnap => {
        userSnap.forEach(s => {
            const d = s.val();
            if (!d || !d.user) return;
            if (!(d.expira > agora)) {                       // passou de 24h → apaga
                s.ref.remove().catch(() => {});
                if (d.fb) storyApagarMidiaFb(d.user, s.key);
                if (d.user === user) storyDriveDelete(d.driveId);
                return;
            }
            // só vejo story de quem eu sigo (e os meus)
            if (d.user !== user && !followingList.has(d.user)) return;
            if (d.user !== user && estaBloqueado(d.user)) return;
            (mapa[d.user] = mapa[d.user] || []).push({ id: s.key, ...d });
        });
    });

    // limpa "vistos" antigos
    const v = storyVistos(), lim = agora - 2 * STORY_DURACAO_MS;
    Object.keys(v).forEach(k => { if (v[k] < lim) delete v[k]; });
    try { localStorage.setItem('storiesVistos', JSON.stringify(v)); } catch (e) {}

    // ignora quem me bloqueou
    const outros = Object.keys(mapa).filter(n => n !== user);
    Promise.all(outros.map(n => new Promise(r => estaBlockeadoPor(n, b => r(b ? n : null)))))
        .then(bloq => {
            bloq.filter(Boolean).forEach(n => delete mapa[n]);
            Object.values(mapa).forEach(l => l.sort((a, b) => a.criado - b.criado));
            storiesPorUsuario = mapa;

            const nomes = [user, ...Object.keys(mapa).filter(n => n !== user)];
            return Promise.all(nomes.filter(n => !(n in storyFotos)).map(n =>
                db.ref('fotosPerfil/' + storyKey(n)).once('value')
                    .then(s => { storyFotos[n] = s.val() || null; })
                    .catch(() => { storyFotos[n] = null; })
            ));
        })
        .then(renderStoriesBar);
}

function renderStoriesBar() {
    const bar = $s('storiesBar');
    if (!bar) return;
    const ultimo = n => storiesPorUsuario[n][storiesPorUsuario[n].length - 1].criado;
    const outros = Object.keys(storiesPorUsuario)
        .filter(n => n !== user)
        .sort((a, b) => (storyTemNovo(b) - storyTemNovo(a)) || (ultimo(b) - ultimo(a)));

    storyFila = [...(storiesPorUsuario[user] ? [user] : []), ...outros];

    bar.innerHTML = '';
    bar.appendChild(storyItem(user, true));
    outros.forEach(n => bar.appendChild(storyItem(n, false)));
    bar.style.display = 'flex';
}

function storyItem(nome, meu) {
    const tem = !!storiesPorUsuario[nome];
    const el = document.createElement('div');
    el.className = 'story-item';

    const anel = document.createElement('div');
    anel.className = 'story-ring ' + (tem ? (storyTemNovo(nome) ? 'novo' : 'visto') : 'vazio');
    anel.appendChild(storyAvatarEl(nome, 'story-avatar'));

    if (meu) {
        const add = document.createElement('span');
        add.className = 'story-add';
        add.textContent = '+';
        add.title = 'Novo story';
        add.addEventListener('click', e => { e.stopPropagation(); storyEscolherArquivo(); });
        anel.appendChild(add);
    }
    el.appendChild(anel);

    const lbl = document.createElement('div');
    lbl.className = 'story-nome';
    lbl.textContent = meu ? 'Seu story' : nome;
    el.appendChild(lbl);

    el.addEventListener('click', () => tem ? abrirStoryViewer(nome) : (meu && storyEscolherArquivo()));
    return el;
}

/* ---------- overlays (texto, hora, marcação) ---------- */

function criarOverlay(ov, editor) {
    const el = document.createElement('div');
    el.className = 'ov ov-' + ov.t;
    el.style.left = ov.x + '%';
    el.style.top = ov.y + '%';

    const label = document.createElement('span');
    label.className = 'ov-label';
    label.textContent = ov.t === 'texto' ? ov.v
        : ov.t === 'hora' ? storyFormatarHora(ov.v, ov.f)
        : '@' + ov.v;
    el.appendChild(label);

    if (!editor) {
        if (ov.t === 'tag') {
            el.classList.add('clicavel');
            el.addEventListener('click', e => { e.stopPropagation(); abrirPerfil(ov.v); });
        }
        return el;
    }

    const x = document.createElement('button');
    x.className = 'ov-x';
    x.textContent = '✕';
    x.addEventListener('pointerdown', e => e.stopPropagation());
    x.addEventListener('click', e => {
        e.stopPropagation();
        storyEd.ov.splice(storyEd.ov.indexOf(ov), 1);
        storyEditorRender();
    });
    el.appendChild(x);

    storyArrastar(el, ov, $s('seFrame'), () => {
        if (ov.t === 'texto') storyEditarTexto(ov);
        else if (ov.t === 'hora') { ov.f = ov.f === 1 ? 0 : 1; label.textContent = storyFormatarHora(ov.v, ov.f); }
    });
    return el;
}

function storyArrastar(el, ov, frame, onTap) {
    let id = null, mov = false, sx = 0, sy = 0;
    el.addEventListener('pointerdown', e => {
        id = e.pointerId; mov = false; sx = e.clientX; sy = e.clientY;
        el.setPointerCapture(id);
        e.preventDefault();
    });
    el.addEventListener('pointermove', e => {
        if (e.pointerId !== id) return;
        if (!mov && Math.hypot(e.clientX - sx, e.clientY - sy) < 6) return;
        mov = true;
        const r = frame.getBoundingClientRect();
        ov.x = Math.min(96, Math.max(4, (e.clientX - r.left) / r.width * 100));
        ov.y = Math.min(96, Math.max(4, (e.clientY - r.top) / r.height * 100));
        el.style.left = ov.x + '%';
        el.style.top = ov.y + '%';
    });
    el.addEventListener('pointerup', e => {
        if (e.pointerId !== id) return;
        id = null;
        if (!mov && onTap) onTap();
    });
    el.addEventListener('pointercancel', () => { id = null; });
}

/* ---------- editor ---------- */

function storyEscolherArquivo() {
    $s('storyFile').click();
}

$s('storyFile').addEventListener('change', async e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;

    const tipo = f.type.startsWith('video/') ? 'video' : f.type.startsWith('image/') ? 'foto' : null;
    if (!tipo) { alert('Escolha uma foto ou um vídeo.'); return; }
    if (f.size > STORY_MAX_BYTES) { alert('Arquivo muito grande (máximo 200 MB).'); return; }
    if (tipo === 'video' && !storyConfigurado() && f.size > STORY_MAX_FB) {
        alert('Sem o Google Drive configurado, o vídeo pode ter até ' + Math.round(STORY_MAX_FB / 1048576) + ' MB. Esse tem ' + Math.round(f.size / 1048576) + ' MB.');
        return;
    }

    const url = URL.createObjectURL(f);
    try {
        const meta = await storyLerMeta(url, tipo);
        if (tipo === 'video' && meta.dur > STORY_MAX_VIDEO_SEG + 0.3) {
            URL.revokeObjectURL(url);
            alert(`O vídeo tem ${storyFormatarDur(meta.dur)} e o máximo é 1:30.`);
            return;
        }
        abrirStoryEditor(f, tipo, url, meta);
    } catch (err) {
        URL.revokeObjectURL(url);
        alert('Não consegui abrir esse arquivo. Se for vídeo, tente em MP4.');
    }
});

function storyLerMeta(url, tipo) {
    return new Promise((ok, err) => {
        if (tipo === 'foto') {
            const i = new Image();
            i.onload = () => ok({ w: i.naturalWidth, h: i.naturalHeight, dur: 0 });
            i.onerror = err; i.src = url;
        } else {
            const v = document.createElement('video');
            v.preload = 'metadata';
            v.onloadedmetadata = () => v.videoWidth ? ok({ w: v.videoWidth, h: v.videoHeight, dur: v.duration }) : err();
            v.onerror = err; v.src = url;
        }
    });
}

function abrirStoryEditor(file, tipo, url, meta) {
    storyEd = {
        file, tipo, url, w: meta.w, h: meta.h, dur: meta.dur,
        hora: file.lastModified || Date.now(),   // hora em que a foto/vídeo foi feito
        ov: [], enviando: false
    };
    const frame = $s('seFrame');
    frame.innerHTML = '';
    frame.style.setProperty('--ar', meta.w / meta.h);

    let m;
    if (tipo === 'video') {
        m = document.createElement('video');
        m.muted = true; m.loop = true; m.autoplay = true; m.playsInline = true;
    } else m = document.createElement('img');
    m.className = 'story-media';
    m.src = url;
    frame.appendChild(m);

    $s('seInfo').textContent = tipo === 'video'
        ? `Vídeo ${storyFormatarDur(meta.dur)} de 1:30 · aparece inteiro, sem cortes`
        : 'Toque nos botões para adicionar texto, hora ou marcar alguém';
    storyProgresso(null);
    $s('storyEditor').style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function fecharStoryEditor() {
    if (!storyEd || storyEd.enviando) return;
    const v = $s('seFrame').querySelector('video');
    if (v) { v.pause(); v.removeAttribute('src'); }
    URL.revokeObjectURL(storyEd.url);
    $s('seFrame').innerHTML = '';
    $s('storyEditor').style.display = 'none';
    storyFecharTags();
    document.body.style.overflow = '';
    storyEd = null;
}

function storyEditorRender() {
    const frame = $s('seFrame');
    frame.querySelectorAll('.ov').forEach(n => n.remove());
    storyEd.ov.forEach(o => frame.appendChild(criarOverlay(o, true)));
}

function storyEditarTexto(ov) {
    const p = customPrompt('Texto do story');
    $s('promptInput').value = ov ? ov.v : '';
    p.then(t => {
        if (!t) return;
        t = t.slice(0, 120);
        if (ov) ov.v = t;
        else storyEd.ov.push({ t: 'texto', v: t, x: 50, y: 40 + (storyEd.ov.length % 5) * 8 });
        storyEditorRender();
    });
}
function storyAddTexto() { if (storyEd) storyEditarTexto(null); }

function storyAddHora() {
    if (!storyEd) return;
    if (storyEd.ov.some(o => o.t === 'hora')) return;
    storyEd.ov.push({ t: 'hora', v: storyEd.hora, f: 0, x: 50, y: 12 });
    storyEditorRender();
}

/* marcar alguém */
function storyAbrirTags() {
    if (!storyEd) return;
    $s('storyTagPicker').style.display = 'block';
    $s('tpBusca').value = '';
    carregarUsuariosExistentes().then(() => storyFiltrarTags(''));
}
function storyFecharTags() { $s('storyTagPicker').style.display = 'none'; }

function storyFiltrarTags(q) {
    q = (q || '').trim().toLowerCase();
    const jaMarcados = new Set(storyEd.ov.filter(o => o.t === 'tag').map(o => o.v));
    const todos = [...new Set([...followingList, ...storyNomesOriginais])].filter(n => n && n !== user);
    todos.sort((a, b) => (followingList.has(b) - followingList.has(a)) || a.localeCompare(b));

    const lista = $s('tpLista');
    lista.innerHTML = '';
    const achados = todos.filter(n => !jaMarcados.has(n) && n.toLowerCase().includes(q)).slice(0, 40);
    if (!achados.length) {
        lista.innerHTML = '<div class="tp-vazio">Ninguém encontrado.</div>';
        return;
    }
    achados.forEach(n => {
        const row = document.createElement('div');
        row.className = 'tp-row';
        const av = document.createElement('div');
        av.className = 'sv-av';
        av.appendChild(storyAvatarEl(n, 'story-avatar'));
        const nome = document.createElement('span');
        nome.textContent = '@' + n;
        row.append(av, nome);
        row.addEventListener('click', () => {
            const k = storyEd.ov.filter(o => o.t === 'tag').length;
            storyEd.ov.push({ t: 'tag', v: n, x: 50, y: 70 + (k % 4) * 7 });
            storyFecharTags();
            storyEditorRender();
        });
        lista.appendChild(row);
    });
}

function storyProgresso(p, msg) {
    const box = $s('seProgresso');
    if (p === null) { box.style.display = 'none'; return; }
    box.style.display = 'flex';
    $s('seProgMsg').textContent = msg || `Enviando… ${p}%`;
    $s('seProgBar').style.width = p + '%';
}

async function publicarStory() {
    if (!storyEd || storyEd.enviando) return;

    for (const o of storyEd.ov) {
        if (o.t !== 'texto') continue;
        const palavra = verificarPalavras(o.v);
        if (palavra) { alert('❌ Palavra inapropriada detectada: ' + palavra); return; }
    }

    const e = storyEd;
    e.enviando = true;
    $s('sePublicar').disabled = true;
    storyProgresso(0, 'Preparando…');

    try {
        const blob = e.tipo === 'foto' ? await storyComprimirFoto(e.url) : e.file;
        const ext = e.tipo === 'foto' ? 'jpg' : ((e.file.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4');
        const arquivo = `story_${storyKey(user)}_${Date.now()}.${ext}`;

        const id = db.ref('stories/' + storyKey(user)).push().key;
        const usaDrive = storyConfigurado();
        let driveId = null, partes = null;
        if (usaDrive) {
            driveId = await storyUploadDrive(blob, arquivo, p => storyProgresso(p));
            storyProgresso(100, 'Finalizando…');
            await storyDrive({ action: 'done', id: driveId });
        } else {
            partes = await storyUploadFirebase(blob, id, p => storyProgresso(p));
        }

        const ov = e.ov.map(o => {
            const base = { t: o.t, v: o.v, x: Math.round(o.x * 10) / 10, y: Math.round(o.y * 10) / 10 };
            if (o.t === 'hora') base.f = o.f || 0;
            return base;
        });

        const agora = Date.now();
        await db.ref('stories/' + storyKey(user) + '/' + id).set({
            user, tipo: e.tipo, driveId: driveId || null,
            fb: usaDrive ? null : true, mime: usaDrive ? null : (blob.type || null), partes,
            ar: Math.round(e.w / e.h * 10000) / 10000,
            dur: e.tipo === 'video' ? Math.round(e.dur) : 0,
            ov, criado: agora, expira: agora + STORY_DURACAO_MS
        });

        ov.filter(o => o.t === 'tag').forEach(o => {
            enviarNotificacao(o.v, { tipo: 'story_tag', de: user, time: Date.now() });
        });

        e.enviando = false;
        $s('sePublicar').disabled = false;
        fecharStoryEditor();
    } catch (err) {
        console.error('Story:', err);
        e.enviando = false;
        $s('sePublicar').disabled = false;
        storyProgresso(null);
        alert('Não foi possível publicar o story: ' + err.message);
    }
}

/* ---------- visualizador ---------- */

function abrirStoryViewer(nome) {
    const u = storyFila.indexOf(nome);
    if (u < 0) return;
    storyVw = { fila: storyFila.slice(), u, i: 0, lista: [], tok: 0, raf: 0, pausado: false, carregando: false };
    $s('storyViewer').style.display = 'block';
    document.body.style.overflow = 'hidden';
    storyCarregarUsuario(u);
}

function storyCarregarUsuario(u) {
    storyVw.u = u;
    storyVw.lista = storiesPorUsuario[storyVw.fila[u]] || [];
    const vistos = storyVistos();
    const i = storyVw.lista.findIndex(s => !vistos[s.id]);
    storyVw.i = i < 0 ? 0 : i;
    if (!storyVw.lista.length) { storyProximo(); return; }
    storyMostrar();
}

function fecharStoryViewer() {
    if (!storyVw) return;
    cancelAnimationFrame(storyVw.raf);
    storyVw.tok++;
    storyLimparMidia();
    $s('storyViewer').style.display = 'none';
    document.body.style.overflow = '';
    storyVw = null;
    renderStoriesBar();
}

function storyLimparMidia() {
    const frame = $s('svFrame');
    const v = frame.querySelector('video');
    if (v) { v.pause(); v.removeAttribute('src'); v.load(); }
    frame.innerHTML = '';
}

function storyBarras() {
    const box = $s('svBars');
    box.innerHTML = '';
    storyVw.barEls = storyVw.lista.map((_, k) => {
        const b = document.createElement('div');
        b.className = 'sv-bar';
        const i = document.createElement('i');
        i.style.width = k < storyVw.i ? '100%' : '0';
        b.appendChild(i);
        box.appendChild(b);
        return i;
    });
}
function storyBarra(p) {
    const b = storyVw.barEls[storyVw.i];
    if (b) b.style.width = Math.min(100, p * 100) + '%';
}

function storyMostrar() {
    const vw = storyVw;
    const s = vw.lista[vw.i];
    cancelAnimationFrame(vw.raf);
    const tok = ++vw.tok;
    const vivo = () => storyVw && storyVw.tok === tok;

    storyLimparMidia();
    vw.elapsed = 0; vw.video = null; vw.pausado = false; vw.carregando = true; vw.dur = STORY_FOTO_MS;
    $s('storyViewer').classList.remove('fb');
    storyBarras();

    $s('svNome').textContent = s.user;
    $s('svTempo').textContent = tempoRelativo(s.criado);
    const av = $s('svAvatar');
    av.innerHTML = '';
    av.appendChild(storyAvatarEl(s.user, 'story-avatar'));
    $s('svDel').style.display = s.user === user ? 'flex' : 'none';
    $s('svSpin').style.display = 'block';
    storyMarcarVisto(s.id);

    const frame = $s('svFrame');
    frame.className = 'story-frame';
    frame.style.setProperty('--ar', s.ar || 0.5625);

    const pronto = () => {
        if (!vivo() || !vw.carregando) return;
        vw.carregando = false;
        $s('svSpin').style.display = 'none';
        vw.last = performance.now();
        vw.raf = requestAnimationFrame(storyTick);
    };

    const montar = src => {
        if (!vivo()) return;
        if (s.tipo === 'video') {
            const v = document.createElement('video');
            v.className = 'story-media';
            v.playsInline = true;
            v.preload = 'auto';
            v.src = src;
            vw.video = v;
            v.onplaying = pronto;
            v.onended = () => { if (vivo()) storyProximo(); };
            v.onerror = () => {
                if (!vivo()) return;
                if (s.fb) { vw.video = null; vw.dur = 1500; pronto(); }
                else storyFallbackIframe(s, tok, pronto);
            };
            frame.appendChild(v);
            v.play().catch(() => { v.muted = true; v.play().catch(() => {}); });
            if (!s.fb) setTimeout(() => { if (vivo() && vw.carregando) storyFallbackIframe(s, tok, pronto); }, 10000);
        } else {
            const img = new Image();
            img.className = 'story-media';
            let tentou = false;
            img.onload = () => { if (vivo()) pronto(); };
            img.onerror = () => {
                if (!vivo()) return;
                if (!tentou && !s.fb) { tentou = true; img.src = storyUrlFotoAlt(s.driveId); }
                else { vw.dur = 1500; pronto(); }
            };
            img.src = src;
            frame.appendChild(img);
        }
        (s.ov || []).forEach(o => frame.appendChild(criarOverlay(o, false)));
    };

    if (s.fb) storyCarregarFb(s).then(montar).catch(() => { if (vivo()) { vw.dur = 1500; pronto(); } });
    else montar(s.tipo === 'video' ? storyUrlVideo(s.driveId) : storyUrlFoto(s.driveId));
}

// Se o <video> do Drive não tocar, usa o player do próprio Drive (mostra o vídeo inteiro também)
function storyFallbackIframe(s, tok, pronto) {
    const vw = storyVw;
    if (!vw || vw.tok !== tok) return;
    const frame = $s('svFrame');
    const m = frame.querySelector('video');
    if (m) { m.onerror = null; m.onended = null; m.pause(); m.remove(); }
    const f = document.createElement('iframe');
    f.className = 'story-media';
    f.src = storyUrlPreview(s.driveId);
    f.allow = 'autoplay; fullscreen';
    frame.prepend(f);
    frame.classList.add('fb');
    $s('storyViewer').classList.add('fb');
    vw.video = null;
    vw.elapsed = 0;
    vw.dur = (Math.max(10, s.dur || 30) + 3) * 1000;
    vw.carregando = true;
    pronto();
}

function storyTick(now) {
    const vw = storyVw;
    if (!vw) return;
    const dt = now - vw.last;
    vw.last = now;
    if (!vw.carregando && !vw.pausado) {
        let p;
        if (vw.video) p = vw.video.duration ? vw.video.currentTime / vw.video.duration : 0;
        else { vw.elapsed += dt; p = vw.elapsed / vw.dur; }
        storyBarra(p);
        if (!vw.video && p >= 1) { storyProximo(); return; }
    }
    vw.raf = requestAnimationFrame(storyTick);
}

function storyPausar(p) {
    const vw = storyVw;
    if (!vw) return;
    vw.pausado = p;
    vw.last = performance.now();
    if (vw.video) { if (p) vw.video.pause(); else vw.video.play().catch(() => {}); }
}

function storyProximo() {
    const vw = storyVw;
    if (!vw) return;
    if (vw.i < vw.lista.length - 1) { vw.i++; storyMostrar(); }
    else if (vw.u < vw.fila.length - 1) storyCarregarUsuario(vw.u + 1);
    else fecharStoryViewer();
}

function storyAnterior() {
    const vw = storyVw;
    if (!vw) return;
    if (vw.i > 0) { vw.i--; storyMostrar(); }
    else if (vw.u > 0) storyCarregarUsuario(vw.u - 1);
    else storyMostrar();
}

function storyAbrirPerfilAtual() {
    const s = storyVw && storyVw.lista[storyVw.i];
    if (s) abrirPerfil(s.user);
}

async function storyApagar() {
    const vw = storyVw;
    const s = vw && vw.lista[vw.i];
    if (!s || s.user !== user) return;
    storyPausar(true);
    const ok = await customConfirm('Apagar este story?');
    if (!storyVw) return;
    if (!ok) { storyPausar(false); return; }

    db.ref('stories/' + storyKey(user) + '/' + s.id).remove();
    storyDriveDelete(s.driveId);
    if (s.fb) storyApagarMidiaFb(s.user, s.id);
    vw.lista.splice(vw.i, 1);
    if (!vw.lista.length) { fecharStoryViewer(); return; }
    if (vw.i >= vw.lista.length) vw.i = vw.lista.length - 1;
    storyMostrar();
}

// toque curto = navega · segurar = pausa
(function () {
    [['svPrev', () => storyAnterior()], ['svNext', () => storyProximo()]].forEach(([id, acao]) => {
        const z = $s(id);
        let tm = null, pausou = false;
        const soltar = () => { clearTimeout(tm); if (pausou) { pausou = false; storyPausar(false); } };
        z.addEventListener('pointerdown', () => {
            pausou = false;
            tm = setTimeout(() => { pausou = true; storyPausar(true); }, 220);
        });
        z.addEventListener('pointerup', () => {
            const foiPausa = pausou;
            soltar();
            if (!foiPausa) acao();
        });
        z.addEventListener('pointerleave', soltar);
        z.addEventListener('pointercancel', soltar);
    });
    document.addEventListener('keydown', e => {
        if (!storyVw) return;
        if (e.key === 'Escape') fecharStoryViewer();
        else if (e.key === 'ArrowRight') storyProximo();
        else if (e.key === 'ArrowLeft') storyAnterior();
    });
})();
