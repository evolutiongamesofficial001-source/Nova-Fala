/* =====================================================================
   STORIES — fotos/vídeos que duram 24h, visíveis só para quem você segue
   Mídia fica no Supabase Storage. Metadados ficam no Firebase (db).
   ===================================================================== */

/* ---------- CONFIG SUPABASE ---------- */
// Preencha com os dados do seu projeto Supabase.
const SUPABASE_URL = "https://xtnzuxdocisjivpezamp.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_02upIohbM1UyEGBGj-7HgA_kRwCxpio";
// Nome do bucket criado no Supabase Storage (Storage > Buckets).
// Se você deu outro nome ao bucket, troque aqui.
const SUPABASE_BUCKET = "stories";

const STORY_DURACAO_MS = 24 * 60 * 60 * 1000; // 24 horas
const STORY_TEMPO_IMAGEM_MS = 6000; // tempo que cada foto fica na tela

/* ---------- SUPABASE STORAGE (via REST, sem SDK) ---------- */

function supabaseUpload(path, fileOrBlob, contentType) {
    return fetch(`${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${path}`, {
        method: "POST",
        headers: {
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": "Bearer " + SUPABASE_ANON_KEY,
            "Content-Type": contentType || fileOrBlob.type || "application/octet-stream",
            "x-upsert": "true"
        },
        body: fileOrBlob
    }).then(r => {
        if (!r.ok) throw new Error("Falha ao enviar arquivo para o Supabase (" + r.status + ")");
        return `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${path}`;
    });
}

function supabaseDelete(paths) {
    if (!paths || !paths.length) return Promise.resolve();
    return fetch(`${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}`, {
        method: "DELETE",
        headers: {
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": "Bearer " + SUPABASE_ANON_KEY,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ prefixes: paths })
    }).catch(() => {});
}

/* ---------- ESTADO ---------- */

let storiesPorUsuario = {};   // { nomeUsuario: [ {id, data}, ... ] }
let storiesOrdemUsuarios = []; // ordem de exibição na barra
let storiesVistasSet = new Set(JSON.parse(localStorage.getItem("storiesVistas") || "[]"));

let storyViewerUsuarios = [];
let storyViewerIdxUsuario = 0;
let storyViewerIdxStory = 0;
let storyViewerTimer = null;
let storyViewerProgressStart = 0;

/* ---------- CARREGAR / LIMPAR EXPIRADOS ---------- */

function carregarStories() {
    db.ref("stories").once("value").then(snap => {
        let agora = Date.now();
        let expirados = [];
        let ativos = [];

        snap.forEach(child => {
            let data = child.val();
            let id = child.key;
            if (!data.expiresAt || data.expiresAt <= agora) {
                expirados.push({ id, data });
            } else {
                ativos.push({ id, data });
            }
        });

        // limpeza best-effort dos expirados (não bloqueia a renderização)
        if (expirados.length) {
            let paths = expirados.filter(e => e.data.storagePath).map(e => e.data.storagePath);
            supabaseDelete(paths);
            expirados.forEach(e => db.ref("stories/" + e.id).remove());
        }

        // filtrar: só o próprio usuário + quem eu sigo
        ativos = ativos.filter(s => s.data.user === user || followingList.has(s.data.user));

        storiesPorUsuario = {};
        ativos.forEach(s => {
            if (!storiesPorUsuario[s.data.user]) storiesPorUsuario[s.data.user] = [];
            storiesPorUsuario[s.data.user].push(s);
        });
        Object.values(storiesPorUsuario).forEach(lista => lista.sort((a, b) => a.data.createdAt - b.data.createdAt));

        let outros = Object.keys(storiesPorUsuario).filter(u => u !== user);
        outros.sort((a, b) => {
            let ta = storiesPorUsuario[a][storiesPorUsuario[a].length - 1].data.createdAt;
            let tb = storiesPorUsuario[b][storiesPorUsuario[b].length - 1].data.createdAt;
            return tb - ta;
        });

        storiesOrdemUsuarios = outros;
        renderStoriesBar();
    });
}

function usuarioTemStoryNaoVista(nome) {
    let lista = storiesPorUsuario[nome] || [];
    return lista.some(s => !storiesVistasSet.has(s.id));
}

/* ---------- RENDER DA BARRA ---------- */

function renderStoriesBar() {
    let bar = document.getElementById("storiesBar");
    if (!bar) return;
    bar.innerHTML = "";

    // item do próprio usuário
    let temStoryPropria = !!(storiesPorUsuario[user] && storiesPorUsuario[user].length);
    let selfItem = document.createElement("div");
    selfItem.className = "story-item";
    selfItem.innerHTML = `
        <div class="story-ring ${temStoryPropria ? (usuarioTemStoryNaoVista(user) ? "" : "seen") : "self-empty"}">
            <div class="story-avatar-wrap" id="storyAvatar-self">
                <span>${user.charAt(0).toUpperCase()}</span>
                <div class="story-add-badge" onclick="event.stopPropagation();abrirCriarStory()">+</div>
            </div>
        </div>
        <span>Seu story</span>
    `;
    selfItem.onclick = () => {
        if (temStoryPropria) abrirStoryViewer(user);
        else abrirCriarStory();
    };
    bar.appendChild(selfItem);
    carregarAvatarStory(user, "storyAvatar-self");

    storiesOrdemUsuarios.forEach(nome => {
        let item = document.createElement("div");
        item.className = "story-item";
        let naoVista = usuarioTemStoryNaoVista(nome);
        item.innerHTML = `
            <div class="story-ring ${naoVista ? "" : "seen"}">
                <div class="story-avatar-wrap" id="storyAvatar-${cssId(nome)}">
                    <span>${nome.charAt(0).toUpperCase()}</span>
                </div>
            </div>
            <span>${nome}</span>
        `;
        item.onclick = () => abrirStoryViewer(nome);
        bar.appendChild(item);
        carregarAvatarStory(nome, "storyAvatar-" + cssId(nome));
    });
}

function cssId(nome) {
    return nome.replace(/[^a-zA-Z0-9]/g, "_");
}

function carregarAvatarStory(nome, elId) {
    db.ref("fotosPerfil/" + nome).once("value").then(snap => {
        if (snap.exists()) {
            let el = document.getElementById(elId);
            if (el) el.innerHTML = `<img src="${snap.val()}">`;
        }
    });
}

/* ---------- CRIAR STORY (EDITOR) ---------- */

let storyArquivo = null;
let storyTipoMidia = null; // 'image' | 'video'
let storyStickers = []; // {id, type, text, xPct, yPct}
let storySeq = 0;

function abrirCriarStory() {
    document.getElementById("storyInput").click();
}

document.getElementById("storyInput").addEventListener("change", () => {
    let file = document.getElementById("storyInput").files[0];
    if (!file) return;

    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
        alert("Selecione uma foto ou um vídeo.");
        return;
    }

    storyArquivo = file;
    storyTipoMidia = file.type.startsWith("video/") ? "video" : "image";
    storyStickers = [];

    let stage = document.getElementById("storyEditorStage");
    stage.querySelectorAll(":scope > img, :scope > video, .story-sticker").forEach(el => el.remove());

    let url = URL.createObjectURL(file);
    let mediaEl;
    if (storyTipoMidia === "image") {
        mediaEl = document.createElement("img");
        mediaEl.id = "storyEditorMedia";
        mediaEl.src = url;
    } else {
        mediaEl = document.createElement("video");
        mediaEl.id = "storyEditorMedia";
        mediaEl.src = url;
        mediaEl.controls = false;
        mediaEl.muted = true;
        mediaEl.autoplay = true;
        mediaEl.loop = true;
        mediaEl.playsInline = true;
    }
    stage.insertBefore(mediaEl, stage.firstChild);

    // overlays (texto/hora/temperatura/localização) só fazem sentido em foto
    document.querySelector(".story-editor-toolbar").style.display = storyTipoMidia === "image" ? "flex" : "none";

    document.getElementById("storyEditor").classList.add("open");
    document.getElementById("storyInput").value = "";
});

function fecharStoryEditor() {
    document.getElementById("storyEditor").classList.remove("open");
    let media = document.getElementById("storyEditorMedia");
    if (media) media.remove();
    document.querySelectorAll("#storyEditorStage .story-sticker").forEach(el => el.remove());
    storyArquivo = null;
    storyStickers = [];
}

/* ---- stickers ---- */

function criarStickerDOM(sticker) {
    let stage = document.getElementById("storyEditorStage");
    let el = document.createElement("div");
    el.className = "story-sticker";
    el.dataset.id = sticker.id;
    el.style.left = sticker.xPct + "%";
    el.style.top = sticker.yPct + "%";
    el.style.transform = "translate(-50%,-50%)";
    el.innerHTML = `${sticker.text}<div class="sticker-remove" onclick="event.stopPropagation();removerSticker('${sticker.id}')">✕</div>`;
    tornarArrastavel(el, sticker);
    stage.appendChild(el);
}

function tornarArrastavel(el, sticker) {
    let arrastando = false;

    el.addEventListener("pointerdown", e => {
        arrastando = true;
        el.classList.add("dragging");
        el.setPointerCapture(e.pointerId);
    });

    el.addEventListener("pointermove", e => {
        if (!arrastando) return;
        let stage = document.getElementById("storyEditorStage");
        let rect = stage.getBoundingClientRect();
        let xPct = ((e.clientX - rect.left) / rect.width) * 100;
        let yPct = ((e.clientY - rect.top) / rect.height) * 100;
        xPct = Math.max(2, Math.min(98, xPct));
        yPct = Math.max(4, Math.min(96, yPct));
        sticker.xPct = xPct;
        sticker.yPct = yPct;
        el.style.left = xPct + "%";
        el.style.top = yPct + "%";
    });

    let soltar = () => { arrastando = false; el.classList.remove("dragging"); };
    el.addEventListener("pointerup", soltar);
    el.addEventListener("pointercancel", soltar);
}

function removerSticker(id) {
    storyStickers = storyStickers.filter(s => s.id !== id);
    let el = document.querySelector(`.story-sticker[data-id="${id}"]`);
    if (el) el.remove();
}

function adicionarStickerTexto() {
    customPrompt("Digite o texto:").then(texto => {
        if (!texto) return;
        let sticker = { id: "st" + (++storySeq), type: "text", text: texto, xPct: 50, yPct: 50 };
        storyStickers.push(sticker);
        criarStickerDOM(sticker);
    });
}

function adicionarStickerHora() {
    let agora = new Date();
    let texto = "🕐 " + agora.getHours().toString().padStart(2, "0") + ":" + agora.getMinutes().toString().padStart(2, "0");
    let sticker = { id: "st" + (++storySeq), type: "time", text: texto, xPct: 50, yPct: 15 };
    storyStickers.push(sticker);
    criarStickerDOM(sticker);
}

function adicionarStickerTemperatura() {
    if (!navigator.geolocation) {
        alert("Localização não disponível neste dispositivo.");
        return;
    }
    let loadingId = "st" + (++storySeq);
    let sticker = { id: loadingId, type: "temp", text: "🌡️ ...", xPct: 50, yPct: 25 };
    storyStickers.push(sticker);
    criarStickerDOM(sticker);

    navigator.geolocation.getCurrentPosition(pos => {
        let { latitude, longitude } = pos.coords;
        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`)
            .then(r => r.json())
            .then(d => {
                let temp = d && d.current_weather ? Math.round(d.current_weather.temperature) : null;
                let texto = temp !== null ? `🌡️ ${temp}°C` : "🌡️ indisponível";
                atualizarTextoSticker(loadingId, texto);
            })
            .catch(() => atualizarTextoSticker(loadingId, "🌡️ indisponível"));
    }, () => {
        atualizarTextoSticker(loadingId, "🌡️ indisponível");
    });
}

function adicionarStickerLocalizacao() {
    if (!navigator.geolocation) {
        alert("Localização não disponível neste dispositivo.");
        return;
    }
    let loadingId = "st" + (++storySeq);
    let sticker = { id: loadingId, type: "location", text: "📍 ...", xPct: 50, yPct: 85 };
    storyStickers.push(sticker);
    criarStickerDOM(sticker);

    navigator.geolocation.getCurrentPosition(pos => {
        let { latitude, longitude } = pos.coords;
        fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=pt`)
            .then(r => r.json())
            .then(d => {
                let cidade = d.city || d.locality || d.principalSubdivision || "";
                let texto = cidade ? `📍 ${cidade}` : "📍 indisponível";
                atualizarTextoSticker(loadingId, texto);
            })
            .catch(() => atualizarTextoSticker(loadingId, "📍 indisponível"));
    }, () => {
        atualizarTextoSticker(loadingId, "📍 indisponível");
    });
}

function atualizarTextoSticker(id, texto) {
    let sticker = storyStickers.find(s => s.id === id);
    if (sticker) sticker.text = texto;
    let el = document.querySelector(`.story-sticker[data-id="${id}"]`);
    if (el) el.innerHTML = `${texto}<div class="sticker-remove" onclick="event.stopPropagation();removerSticker('${id}')">✕</div>`;
}

/* ---- publicar ---- */

function publicarStory() {
    if (!storyArquivo) return;

    let btn = document.getElementById("btnPublicarStory");
    let loading = document.getElementById("storyEditorLoading");
    btn.disabled = true;
    loading.classList.add("show");

    let id = db.ref("stories").push().key;
    let extensao = (storyArquivo.name.split(".").pop() || (storyTipoMidia === "video" ? "mp4" : "jpg")).toLowerCase();
    let path = `${user}/${id}.${extensao}`;

    let preparar;
    if (storyTipoMidia === "image" && storyStickers.length > 0) {
        preparar = bakeImagemComStickers();
    } else {
        preparar = Promise.resolve(storyArquivo);
    }

    preparar
        .then(blob => supabaseUpload(path, blob, storyTipoMidia === "image" ? "image/jpeg" : storyArquivo.type))
        .then(mediaUrl => {
            let agora = Date.now();
            return db.ref("stories/" + id).set({
                user: user,
                mediaType: storyTipoMidia,
                mediaUrl: mediaUrl,
                storagePath: path,
                createdAt: agora,
                expiresAt: agora + STORY_DURACAO_MS
            });
        })
        .then(() => {
            btn.disabled = false;
            loading.classList.remove("show");
            fecharStoryEditor();
            carregarStories();
        })
        .catch(err => {
            console.error(err);
            btn.disabled = false;
            loading.classList.remove("show");
            alert("Não foi possível publicar o story. Tente novamente.");
        });
}

function bakeImagemComStickers() {
    return new Promise((resolve, reject) => {
        let mediaEl = document.getElementById("storyEditorMedia");
        let img = new Image();
        img.onload = () => {
            let canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            let ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            let stageRect = mediaEl.getBoundingClientRect();
            let escala = canvas.width / stageRect.width;

            storyStickers.forEach(sticker => {
                let fontSize = 20 * escala;
                ctx.font = `700 ${fontSize}px system-ui, sans-serif`;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";

                let x = (sticker.xPct / 100) * canvas.width;
                let y = (sticker.yPct / 100) * canvas.height;

                let paddingX = 10 * escala, paddingY = 6 * escala;
                let largura = ctx.measureText(sticker.text).width;

                ctx.fillStyle = "rgba(0,0,0,0.35)";
                ctx.beginPath();
                ctx.roundRect(
                    x - largura / 2 - paddingX,
                    y - fontSize / 2 - paddingY,
                    largura + paddingX * 2,
                    fontSize + paddingY * 2,
                    10 * escala
                );
                ctx.fill();

                ctx.shadowColor = "rgba(0,0,0,0.6)";
                ctx.shadowBlur = 6 * escala;
                ctx.fillStyle = "#fff";
                ctx.fillText(sticker.text, x, y);
                ctx.shadowBlur = 0;
            });

            canvas.toBlob(blob => resolve(blob), "image/jpeg", 0.92);
        };
        img.onerror = reject;
        img.src = mediaEl.src;
    });
}

/* ---------- VIEWER ---------- */

function abrirStoryViewer(nomeInicial) {
    storyViewerUsuarios = [user, ...storiesOrdemUsuarios].filter(u => storiesPorUsuario[u] && storiesPorUsuario[u].length);
    let idx = storyViewerUsuarios.indexOf(nomeInicial);
    if (idx === -1) idx = 0;
    storyViewerIdxUsuario = idx;

    let lista = storiesPorUsuario[nomeInicial] || [];
    let primeiraNaoVista = lista.findIndex(s => !storiesVistasSet.has(s.id));
    storyViewerIdxStory = primeiraNaoVista !== -1 ? primeiraNaoVista : 0;

    document.getElementById("storyViewer").classList.add("open");
    renderStoryAtual();
}

function fecharStoryViewer() {
    document.getElementById("storyViewer").classList.remove("open");
    pausarStoryTimer();
    let stage = document.getElementById("storyMediaStage");
    let media = stage.querySelector("img, video");
    if (media) media.remove();
    renderStoriesBar();
}

function usuarioAtualViewer() {
    return storyViewerUsuarios[storyViewerIdxUsuario];
}

function renderStoryAtual() {
    pausarStoryTimer();

    let nome = usuarioAtualViewer();
    let lista = storiesPorUsuario[nome];
    if (!lista || !lista[storyViewerIdxStory]) {
        fecharStoryViewer();
        return;
    }
    let story = lista[storyViewerIdxStory];

    // marcar como vista
    storiesVistasSet.add(story.id);
    localStorage.setItem("storiesVistas", JSON.stringify([...storiesVistasSet]));

    // header
    document.getElementById("storyViewerName").innerText = nome;
    document.getElementById("storyViewerTime").innerText = tempoRelativoStory(story.data.createdAt);
    document.getElementById("storyViewerDelete").style.display = nome === user ? "block" : "none";

    let avatarEl = document.getElementById("storyViewerAvatar");
    avatarEl.innerHTML = `<span>${nome.charAt(0).toUpperCase()}</span>`;
    db.ref("fotosPerfil/" + nome).once("value").then(snap => {
        if (snap.exists()) avatarEl.innerHTML = `<img src="${snap.val()}">`;
    });

    // progresso
    let row = document.getElementById("storyProgressRow");
    row.innerHTML = lista.map((_, i) =>
        `<div class="story-progress-track"><div class="story-progress-fill ${i < storyViewerIdxStory ? "filled" : ""}" id="storyProgFill-${i}"></div></div>`
    ).join("");

    // mídia
    let stage = document.getElementById("storyMediaStage");
    stage.querySelectorAll("img, video").forEach(el => el.remove());

    let mediaEl;
    if (story.data.mediaType === "video") {
        mediaEl = document.createElement("video");
        mediaEl.src = story.data.mediaUrl;
        mediaEl.autoplay = true;
        mediaEl.playsInline = true;
        mediaEl.muted = false;
        mediaEl.controls = false;
        mediaEl.onended = () => storyProximo();
        mediaEl.onloadedmetadata = () => {
            iniciarProgresso(storyViewerIdxStory, (mediaEl.duration || 15) * 1000);
        };
    } else {
        mediaEl = document.createElement("img");
        mediaEl.src = story.data.mediaUrl;
        iniciarProgresso(storyViewerIdxStory, STORY_TEMPO_IMAGEM_MS);
    }
    stage.insertBefore(mediaEl, stage.firstChild);
}

function iniciarProgresso(idx, duracaoMs) {
    let fill = document.getElementById("storyProgFill-" + idx);
    if (!fill) return;
    storyViewerProgressStart = Date.now();

    fill.style.transition = "none";
    fill.style.width = "0%";
    requestAnimationFrame(() => {
        fill.style.transition = `width ${duracaoMs}ms linear`;
        fill.style.width = "100%";
    });

    storyViewerTimer = setTimeout(() => storyProximo(), duracaoMs);
}

function pausarStoryTimer() {
    if (storyViewerTimer) {
        clearTimeout(storyViewerTimer);
        storyViewerTimer = null;
    }
}

function storyProximo() {
    let nome = usuarioAtualViewer();
    let lista = storiesPorUsuario[nome] || [];

    if (storyViewerIdxStory < lista.length - 1) {
        storyViewerIdxStory++;
        renderStoryAtual();
    } else if (storyViewerIdxUsuario < storyViewerUsuarios.length - 1) {
        storyViewerIdxUsuario++;
        storyViewerIdxStory = 0;
        renderStoryAtual();
    } else {
        fecharStoryViewer();
    }
}

function storyAnterior() {
    if (storyViewerIdxStory > 0) {
        storyViewerIdxStory--;
        renderStoryAtual();
    } else if (storyViewerIdxUsuario > 0) {
        storyViewerIdxUsuario--;
        let listaAnterior = storiesPorUsuario[usuarioAtualViewer()] || [];
        storyViewerIdxStory = Math.max(0, listaAnterior.length - 1);
        renderStoryAtual();
    }
}

function excluirStoryAtual() {
    let nome = usuarioAtualViewer();
    if (nome !== user) return;
    let lista = storiesPorUsuario[nome];
    let story = lista[storyViewerIdxStory];

    customConfirm("Excluir este story?").then(ok => {
        if (!ok) return;
        pausarStoryTimer();
        db.ref("stories/" + story.id).remove();
        if (story.data.storagePath) supabaseDelete([story.data.storagePath]);
        storyProximo();
        carregarStories();
    });
}

function tempoRelativoStory(timestamp) {
    let diffMin = Math.floor((Date.now() - timestamp) / 60000);
    if (diffMin < 1) return "agora";
    if (diffMin < 60) return diffMin + "min";
    let diffH = Math.floor(diffMin / 60);
    return diffH + "h";
}
