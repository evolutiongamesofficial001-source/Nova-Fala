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

/* ================= VERIFICADO ================= */

const usuariosVerificados = [
    "Macedo",
    "Evolution Studio Official",
    "João Antônio"
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

function carregarUsuariosExistentes() {
    if (cacheUsuariosExistentes) return Promise.resolve(cacheUsuariosExistentes);
    return db.ref("posts").orderByChild("user").once("value").then(snap => {
        let nomes = new Set();
        snap.forEach(child => {
            if (child.val().user) nomes.add(child.val().user.toLowerCase());
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
    }
});

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
        let post = {
            user: user,
            text: texto,
            likes: 0,
            time: Date.now(),
            photoBase64: fotoBase64 || null,
            poll: pollData || null
        };

        db.ref("posts/" + id).set(post);

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
        previewImg.src = "";

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
        el.className = "comment";
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
                    <span class="emoji">❤️</span> ${p.likes || 0}
                </button>

                <button onclick="comentar('${id}','${p.user}')">
                    <span class="emoji">💬</span> comentar
                </button>

                ${p.user === user ? `
                <button onclick="editarPost('${id}')">
                    <span class="emoji">✎</span> Editar
                </button>
                <button onclick="deletarPost('${id}')">
                    <span class="emoji">🗑️</span> Deletar
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
            let img = document.createElement("img");
            img.src = p.photoBase64;
            img.onclick = () => abrirImagem(p.photoBase64);
            document.getElementById("img-" + id).appendChild(img);
        }

        carregarComentarios(id, document.getElementById("c" + id), p.user);
    });
}

/* ================= FEED ================= */

function carregarFeed() {
    feed.innerHTML = "";

    // Mostrar loading
    const loadingEl = document.getElementById("feedLoading");
    if (loadingEl) { loadingEl.style.display = "flex"; }

    db.ref("posts")
        .orderByChild("time")
        .limitToLast(15)
        .once("value", snap => {
            // Esconder loading
            if (loadingEl) { loadingEl.style.display = "none"; }

            let posts = [];
            snap.forEach(child => {
                posts.push({ id: child.key, data: child.val() });
            });

            posts.sort((a, b) => b.data.time - a.data.time);

            // Pré-buscar fotos de perfil de todos de uma vez para maior velocidade
            let nomesUnicos = [...new Set(posts.map(p => p.data.user).filter(Boolean))];
            let fotosPromise = Promise.all(
                nomesUnicos.map(nome =>
                    db.ref("fotosPerfil/" + nome).once("value").then(s => [nome, s.val()])
                )
            ).then(entries => Object.fromEntries(entries));

            fotosPromise.then(fotosMap => {
                posts.forEach(p => renderPost(p.id, p.data, fotosMap));
            });
        });

    db.ref("posts").on("child_changed", snap => {
        let id = snap.key;
        let p = snap.val();
        let btn = document.getElementById("like-" + id);
        if (btn) btn.innerHTML = `<span class="emoji">❤️</span> ${p.likes || 0}`;
    });
}

/* ================= AÇÕES ================= */

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

function abrirSAR() {
    fecharMenu();
    setTimeout(() => { location.href = "IA.html"; }, 200);
}

function abrirchat() {
    fecharMenu();
    setTimeout(() => { location.href = "chat.html"; }, 200);
}

function abrirverificar() {
    fecharMenu();
    setTimeout(() => { location.href = "verificado.html"; }, 200);
}
/* ================= TEMA ================= */

function atualizarBotoesAtivos() {
    document.getElementById("btnEscuro").classList.remove("ativo");
    document.getElementById("btnClaro").classList.remove("ativo");

    let tema = localStorage.getItem("tema") || "escuro";
    if (tema === "claro") {
        document.getElementById("btnClaro").classList.add("ativo");
    } else {
        document.getElementById("btnEscuro").classList.add("ativo");
    }
}

function setTema(tipo) {
    localStorage.setItem("tema", tipo);

    if (tipo === "claro") {
        document.body.classList.add("claro");
    } else {
        document.body.classList.remove("claro");
    }

    atualizarBotoesAtivos();
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

/* ================= ENQUETE — RENDER ================= */

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

/* ================= ENQUETE — LIMPAR QUANDO EXPIRAR ================= */

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

/* ================= ENQUETE — VOTAR ================= */
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

/* ================= BUSCA DE USUÁRIOS ================= */

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

/* ================= NOTIFICAÇÕES ================= */

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
    return { comentario: "💬", resposta: "↩️", mencao: "📣", chat: "✉️" }[tipo] || "🔔";
}

function textoNotif(n) {
    let nome = `<span class="notif-nome">@${n.de}</span>`;
    if (n.tipo === "comentario") return `${nome} comentou no seu post`;
    if (n.tipo === "resposta")   return `${nome} respondeu seu comentário`;
    if (n.tipo === "mencao")     return `${nome} mencionou você`;
    if (n.tipo === "chat")       return `${nome} enviou uma mensagem`;
    return `${nome} interagiu com você`;
}

let notifNaoLidas = 0;
let notifPainelAberto = false;

function atualizarBadge(total) {
    let badge = document.getElementById("notifBadge");
    if (!badge) return;
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

            // ====== AUTO-DISMISS: ao visualizar, marcar como lida ======
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
/* ================= INIT ================= */

postText.addEventListener("input", () => {
    contador.innerText = postText.value.length + " / 1000";
});

setTema(localStorage.getItem("tema") || "escuro");
escutarNotificacoes();
carregarBloqueados();
carregarUsuariosExistentes(); // pré-carregar para @menções
carregarFeed();