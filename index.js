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
    "Pedofilo",
    "Suicidio"
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

function usuarioVerificado(nome){
    return usuariosVerificados.includes(nome);
}

/* ================= PERFIL ================= */

function abrirPerfil(nome){
    if(nome === user){
        localStorage.setItem("perfil", user);
    } else {
        localStorage.setItem("perfil", nome);
    }

    location.href = "user.html";
}

function abrirMeuPerfil(){
    localStorage.setItem("perfil", user);
    location.href = "user.html";
}

/* ================= LOGIN ================= */

function salvarUsuario(user) {
    localStorage.setItem("user", user);
    sessionStorage.setItem("user", user);

    let d = new Date();
    d.setTime(d.getTime() + (30 * 24 * 60 * 60 * 1000));
    document.cookie = "user=" + user + ";expires=" + d.toUTCString() + ";path=/";
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

/* ================= PROMPT / CONFIRM ================= */

let promptResolve = null;
let confirmResolve = null;

function customPrompt(msg) {
    return new Promise(res => {
        promptResolve = res;
        promptText.innerText = msg;
        promptInput.value = "";
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
        confirmText.innerText = msg;
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
    postPopup.style.display = "block";
    overlay.style.display = "block";

    setTimeout(() => {
        postPopup.style.bottom = "0";
    }, 10);
}

function fecharPost() {
    overlay.style.display = "none";
    postPopup.style.bottom = "-420px";

    setTimeout(() => {
        postPopup.style.display = "none";
    }, 300);
}

function abrirImagem(src) {
    viewer.style.display = "flex";
    viewerImg.src = src;
}

function fecharImagem() {
    viewer.style.display = "none";
    viewerImg.src = "";
}

/* ================= TEXTO ================= */

function linkificar(texto) {
    return texto.replace(
        /(https?:\/\/[^\s]+)/g,
        '<a href="$1" target="_blank" style="color:#4da6ff">$1</a>'
    );
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
        }

        reader.readAsDataURL(file);
    });
}

/* ================= POST ================= */

let fotoBase64 = null;
const uploadVisual = document.getElementById("uploadVisual");
const previewImg = document.getElementById("previewImg");

fotoInput.addEventListener("change", () => {
    const file = fotoInput.files[0];

    if (file) {
        uploadVisual.innerText = "✅ Foto selecionada";
        uploadVisual.classList.add("selected");

        const reader = new FileReader();
        reader.onload = e => {
            previewImg.src = e.target.result;
            previewImg.style.display = "block";
        }
        reader.readAsDataURL(file);

    } else {
        uploadVisual.innerText = "📷 Escolher foto";
        uploadVisual.classList.remove("selected");
        previewImg.style.display = "none";
    }
});

function postar() {

    let texto = postText.value.trim();
    let palavraErrada = verificarPalavras(texto);

    if (palavraErrada) {
        alert("❌ Palavra inapropriada detectada: " + palavraErrada);
        return;
    }
    let file = fotoInput.files[0];

    if (texto == "" && !file) return;

    let id = db.ref("posts").push().key;

    function salvarPost() {

        let post = {
            user: user,
            text: texto,
            likes: 0,
            time: Date.now(),
            photoBase64: fotoBase64 || null
        }

        db.ref("posts/" + id).set(post);

        postText.value = "";
        fotoInput.value = "";
        contador.innerText = "0 / 1000";
        fotoBase64 = null;

        fecharPost();
        carregarFeed();
    }

    if (file) {

        if (!file.type.startsWith("image/")) {
            alert("Apenas imagens");
            return;
        }

        comprimirImagem(file).then(base64 => {
            fotoBase64 = base64;
            fotoDB.ref("fotos/" + id).set(base64);
            salvarPost();
        })

    } else {
        salvarPost();
    }

}

/* ================= LIKE (1 POR USUÁRIO) ================= */

function curtir(id) {
    db.ref("posts/" + id + "/likedBy/" + user).once("value").then(snap => {
        let btn = document.getElementById("like-" + id);

        if (snap.exists()) {
            db.ref("posts/" + id + "/likedBy/" + user).remove();
            db.ref("posts/" + id + "/likes").transaction(n => Math.max((n || 1) - 1, 0));

            if (btn) {
                btn.classList.remove("liked");
            }

        } else {
            db.ref("posts/" + id + "/likedBy/" + user).set(true);
            db.ref("posts/" + id + "/likes").transaction(n => (n || 0) + 1);

            if (btn) {
                btn.classList.add("liked");
                setTimeout(()=>{
                    btn.classList.remove("liked");
                }, 400);
            }
        }
    });
}

/* ================= COMENTÁRIOS ================= */

async function comentar(id) {
    let c = await customPrompt("Comentário:");
    if (!c) return;

    db.ref("comments/" + id).push({
        user: user,
        text: c
    });
}

async function responder(postId, commentId) {
    let r = await customPrompt("Responder:");
    if (!r) return;

    db.ref("replies/" + postId + "/" + commentId).push({
        user: user,
        text: r
    });
}

function carregarRespostas(postId, commentId, div) {
    db.ref("replies/" + postId + "/" + commentId)
        .on("child_added", snap => {
            let r = snap.val();

            let el = document.createElement("div");
            el.className = "reply";
            el.innerText = "↳ @" + r.user + " " + r.text;

            div.appendChild(el);
        });
}

function carregarComentarios(id, div) {
    db.ref("comments/" + id)
        .on("child_added", snap => {
            let c = snap.val();
            let cid = snap.key;

            let el = document.createElement("div");
            el.className = "comment";
            el.innerHTML = `
            <b>@${c.user}${usuarioVerificado(c.user) ? ' ✔️' : ''}</b> ${linkificar(c.text)}
            <br>
            <button onclick="responder('${id}','${cid}')">Responder</button>
            <div id="r${cid}"></div>
            `;

            div.appendChild(el);
            carregarRespostas(id, cid, document.getElementById("r" + cid));
        });
}

/* ================= RENDER ================= */

let feed = document.getElementById("feed");

function renderPost(id, p) {

    let div = document.createElement("div");
    div.className = "post";
    div.id = "post-" + id;

    db.ref("posts/" + id + "/likedBy/" + user).once("value").then(snap => {
        let isLiked = snap.exists();

        div.innerHTML = `
        <div class="user" onclick="abrirPerfil('${p.user}')">
            @${p.user}${usuarioVerificado(p.user) ? `
<span class="verificado">
<svg viewBox="0 0 24 24" aria-label="Verificado">
<path fill="#0095F6" d="M22 12l-2.2-2.2.5-3-3-.5L15 3l-3 1-3-1-2.3 3.3-3 .5.5 3L2 12l2.2 2.2-.5 3 3 .5L9 21l3-1 3 1 2.3-3.3 3-.5-.5-3z"/>
<path fill="#fff" d="M9.5 12.5l2 2 4-4-1.2-1.2-2.8 2.8-0.8-0.8z"/>
</svg>
</span>
` : ''}
        </div>
        <div class="text" id="text-${id}">${linkificar(p.text)}</div>
        <div id="img-${id}"></div>

        <div class="actions">
        <button id="like-${id}" onclick="curtir('${id}')"
        style="${isLiked ? 'color:#ff6b81;border-color:#2a1a1e;' : ''}">
        <span class="emoji">❤️</span> ${p.likes || 0}
        </button>

        <button onclick="comentar('${id}')">
        <span class="emoji">💬</span> comentar
        </button>

        ${p.user === user ? `
        <button onclick="editarPost('${id}')">
        <span class="emoji">✏️</span> Editar
        </button>
        <button onclick="deletarPost('${id}')">
        <span class="emoji">🗑️</span> Deletar
        </button>
        ` : ""}
        </div>

        <div id="c${id}" class="comment-box"></div>
        `;

        feed.appendChild(div);

        if (p.photoBase64) {
            let img = document.createElement("img");
            img.src = p.photoBase64;
            img.onclick = () => abrirImagem(p.photoBase64);
            document.getElementById("img-" + id).appendChild(img);
        }

        carregarComentarios(id, document.getElementById("c" + id));
    });
}

/* ================= FEED ================= */

function carregarFeed() {
    feed.innerHTML = "";

    db.ref("posts")
        .orderByChild("time")
        .limitToLast(15)
        .once("value", snap => {

            let posts = [];

            snap.forEach(child => {
                posts.push({
                    id: child.key,
                    data: child.val()
                });
            });

            posts.sort((a, b) => b.data.time - a.data.time);

            posts.forEach(p => {
                renderPost(p.id, p.data);
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
    customConfirm("Deseja deletar este post?")
        .then(ok => {
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
        db.ref("posts/" + id + "/text").set(novo);
        document.getElementById("text-" + id).innerHTML = linkificar(novo);
    }
}

function logout() {
    customConfirm("Deseja sair da conta?")
        .then(ok => {
            if (!ok) return;

            localStorage.removeItem("user");
            sessionStorage.removeItem("user");
            document.cookie = "user=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;";
            location.href = "login.html";
        });
}

/* ================= INIT ================= */

postText.addEventListener("input", () => {
    contador.innerText = postText.value.length + " / 1000";
});

function abrirMenu() {
    menuOverlay.style.display = "block";
    menuLateral.style.left = "0";
}

function fecharMenu() {
    menuOverlay.style.display = "none";
    menuLateral.style.left = "-260px";
}

function abrirConfig() {
    fecharMenu();
    configOverlay.style.display = "block";
    configBox.style.bottom = "0";
}

function fecharConfig() {
    configOverlay.style.display = "none";
    configBox.style.bottom = "-300px";
}

function atualizarBotoesAtivos() {
    document.getElementById('btnEscuro').classList.remove('ativo');
    document.getElementById('btnClaro').classList.remove('ativo');

    let tema = localStorage.getItem('tema') || 'escuro';
    if (tema === 'claro') {
        document.getElementById('btnClaro').classList.add('ativo');
    } else {
        document.getElementById('btnEscuro').classList.add('ativo');
    }
}

function setTema(tipo) {
    localStorage.setItem("tema", tipo);
    atualizarBotoesAtivos();
}

let temaSalvo = localStorage.getItem("tema");
if (temaSalvo) {
    setTema(temaSalvo);
} else {
    atualizarBotoesAtivos();
}

function abrirSAR() {
    fecharMenu();
    setTimeout(() => {
        location.href = "IA.html";
    }, 200);
}

function verificarPalavras(texto) {
    let textoLower = texto.toLowerCase();
    for (let palavra of palavrasProibidas) {
        if (textoLower.includes(palavra)) {
            return palavra;
        }
    }
    return null;
}

function soltarCoracoes(botao){
    let rect = botao.getBoundingClientRect();

    for(let i=0;i<6;i++){
        let heart = document.createElement("div");
        heart.className = "heart-particle";
        heart.innerText = "❤️";

        heart.style.left = (rect.left + rect.width/2 + (Math.random()*20-10)) + "px";
        heart.style.top = (rect.top + window.scrollY) + "px";

        document.body.appendChild(heart);

        setTimeout(()=> heart.remove(), 1000);
    }
}

carregarFeed();