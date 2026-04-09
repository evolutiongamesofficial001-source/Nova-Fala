const firebaseConfig={
databaseURL:"https://contaevilution-default-rtdb.firebaseio.com/"
}
const palavrasProibidas = [
"prostituta",
"vagabunda",
"transar",
"pedifilia",
"fuder",
"foder",
"buceta",
"nazismo",
"nazista",
"hitler"
]
firebase.initializeApp(firebaseConfig)
const db=firebase.database()

const fotoDB=firebase.initializeApp({
databaseURL:"https://bigtrio-ip-default-rtdb.firebaseio.com/"
},"fotos").database()

/* ================= LOGIN ================= */

function salvarUsuario(user){
localStorage.setItem("user", user)
sessionStorage.setItem("user", user)

let d=new Date()
d.setTime(d.getTime()+(30*24*60*60*1000))
document.cookie="user="+user+";expires="+d.toUTCString()+";path=/"
}

function pegarCookie(nome){
let match=document.cookie.match(new RegExp('(^| )'+nome+'=([^;]+)'))
return match?match[2]:null
}

let user=
localStorage.getItem("user") ||
sessionStorage.getItem("user") ||
pegarCookie("user")

if(user){
salvarUsuario(user)
}else{
location.replace("login.html")
}

/* ================= PROMPT / CONFIRM ================= */

let promptResolve=null
let confirmResolve=null

function customPrompt(msg){
return new Promise(res=>{
promptResolve=res
promptText.innerText=msg
promptInput.value=""
document.getElementById("customPrompt").style.display="flex"
})
}

function fecharPrompt(v){
document.getElementById("customPrompt").style.display="none"
if(promptResolve){
promptResolve(v ? v.trim() : null)
promptResolve=null
}
}

function customConfirm(msg){
return new Promise(res=>{
confirmResolve=res
confirmText.innerText=msg
document.getElementById("customConfirm").style.display="flex"
})
}

function fecharConfirm(v){
document.getElementById("customConfirm").style.display="none"
if(confirmResolve){
confirmResolve(v)
confirmResolve=null
}
}

/* ================= UI ================= */

function abrirPost(){
overlay.style.display="block"
postPopup.style.bottom="0"
}

function fecharPost(){
overlay.style.display="none"
postPopup.style.bottom="-420px"
}

function abrirImagem(src){
viewer.style.display="flex"
viewerImg.src=src
}

function fecharImagem(){
viewer.style.display="none"
viewerImg.src=""
}

/* ================= TEXTO ================= */

function linkificar(texto){
return texto.replace(
/(https?:\/\/[^\s]+)/g,
'<a href="$1" target="_blank" style="color:#4da6ff">$1</a>'
)
}

/* ================= IMAGEM ================= */

function comprimirImagem(file){
return new Promise(resolve=>{
let img=new Image()
let reader=new FileReader()

reader.onload=e=>img.src=e.target.result

img.onload=()=>{
let canvas=document.createElement("canvas")
let max=800
let scale=Math.min(max/img.width,max/img.height,1)

canvas.width=img.width*scale
canvas.height=img.height*scale

let ctx=canvas.getContext("2d")
ctx.drawImage(img,0,0,canvas.width,canvas.height)

resolve(canvas.toDataURL("image/jpeg",0.4))
}

reader.readAsDataURL(file)
})
}

/* ================= POST ================= */

let fotoBase64=null

function postar(){

let texto=postText.value.trim()
 let palavraErrada = verificarPalavras(texto)

if(palavraErrada){
    alert("❌ Palavra inapropriada detectada: " + palavraErrada)
    return
}
let file=fotoInput.files[0]

if(texto=="" && !file) return

let id=db.ref("posts").push().key

function salvarPost(){

let post={
user:user,
text:texto,
likes:0,
time:Date.now(),
photoBase64:fotoBase64||null
}

db.ref("posts/"+id).set(post)

postText.value=""
fotoInput.value=""
contador.innerText="0 / 1000"

fotoBase64=null

fecharPost()
}

if(file){

if(!file.type.startsWith("image/")){
alert("Apenas imagens")
return
}

comprimirImagem(file).then(base64=>{
fotoBase64=base64
fotoDB.ref("fotos/"+id).set(base64)
salvarPost()
})

}else{
salvarPost()
}

}

/* ================= LIKE (1 POR USUÁRIO) ================= */

function curtir(id){
db.ref("posts/"+id+"/likedBy/"+user).once("value").then(snap=>{
let btn=document.getElementById("like-"+id)

if(snap.exists()){
db.ref("posts/"+id+"/likedBy/"+user).remove()
db.ref("posts/"+id+"/likes").transaction(n=>Math.max((n||1)-1,0))

if(btn){
    btn.classList.remove("liked")
}

}else{
db.ref("posts/"+id+"/likedBy/"+user).set(true)
db.ref("posts/"+id+"/likes").transaction(n=>(n||0)+1)

if(btn){
    btn.classList.add("liked")
}
}
})
}

/* ================= COMENTÁRIOS ================= */

async function comentar(id){
let c=await customPrompt("Comentário:")
if(!c) return

db.ref("comments/"+id).push({
user:user,
text:c
})
}

async function responder(postId,commentId){
let r=await customPrompt("Responder:")
if(!r) return

db.ref("replies/"+postId+"/"+commentId).push({
user:user,
text:r
})
}

function carregarRespostas(postId,commentId,div){
db.ref("replies/"+postId+"/"+commentId)
.on("child_added",snap=>{
let r=snap.val()

let el=document.createElement("div")
el.className="reply"
el.innerText="↳ @"+r.user+" "+r.text

div.appendChild(el)
})
}

function carregarComentarios(id,div){
db.ref("comments/"+id)
.on("child_added",snap=>{
let c=snap.val()
let cid=snap.key

let el=document.createElement("div")
el.className="comment"
el.innerHTML=`
<b>@${c.user}</b> ${linkificar(c.text)}
<br>
<button onclick="responder('${id}','${cid}')">Responder</button>
<div id="r${cid}"></div>
`

div.appendChild(el)

carregarRespostas(id,cid,document.getElementById("r"+cid))
})
}

/* ================= RENDER ================= */

let feed=document.getElementById("feed")

function renderPost(id,p){

let div=document.createElement("div")
div.className="post"
div.id="post-"+id

db.ref("posts/"+id+"/likedBy/"+user).once("value").then(snap=>{
let isLiked=snap.exists()

div.innerHTML=`
<div class="user">@${p.user}</div>
<div class="text" id="text-${id}">${linkificar(p.text)}</div>
<div id="img-${id}"></div>

<div class="actions">
<button id="like-${id}" onclick="curtir('${id}')"
style="${isLiked ? 'color:#ff6b81;border-color:#2a1a1e;' : ''}">
<span class="emoji">❤️</span> ${p.likes||0}
</button>

<button onclick="comentar('${id}')">
<span class="emoji">💬</span> comentar
</button>

${p.user===user ? `
<button onclick="editarPost('${id}')">
<span class="emoji">✏️</span> Editar
</button>
<button onclick="deletarPost('${id}')">
<span class="emoji">🗑️</span> Deletar
</button>
` : ""}
</div>

<div id="c${id}" class="comment-box"></div>
`

feed.prepend(div)

if(p.photoBase64){
let img=document.createElement("img")
img.src=p.photoBase64
img.onclick=()=>abrirImagem(p.photoBase64)
document.getElementById("img-"+id).appendChild(img)
}

carregarComentarios(id,document.getElementById("c"+id))

})
}

/* ================= FEED ================= */

function carregarFeed(){

db.ref("posts")
.orderByChild("time")
.limitToLast(15)
.on("child_added", snap => {
let id=snap.key
let p=snap.val()

if(Date.now()-p.time>5184000000){
db.ref("posts/"+id).remove()
db.ref("comments/"+id).remove()
db.ref("replies/"+id).remove()
fotoDB.ref("fotos/"+id).remove()
return
}

renderPost(id,p)
})

db.ref("posts").on("child_changed",snap=>{
let id=snap.key
let p=snap.val()

let btn=document.getElementById("like-"+id)
if(btn) btn.innerHTML="❤️ "+(p.likes||0)
})
}

/* ================= AÇÕES ================= */

function deletarPost(id){
customConfirm("Deseja deletar este post?")
.then(ok=>{
if(!ok) return

db.ref("posts/"+id).remove()
db.ref("comments/"+id).remove()
db.ref("replies/"+id).remove()
fotoDB.ref("fotos/"+id).remove()

document.getElementById("post-"+id)?.remove()
})
}

async function editarPost(id){
let atual=document.getElementById("text-"+id).innerText

let novo=await customPrompt("Editar post:\n\n"+atual)

if(novo){
db.ref("posts/"+id+"/text").set(novo)
document.getElementById("text-"+id).innerHTML=linkificar(novo)
}
}

function logout(){
customConfirm("Deseja sair da conta?")
.then(ok=>{
if(!ok) return

localStorage.removeItem("user")
sessionStorage.removeItem("user")
document.cookie="user=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;"
location.href="login.html"
})
}

/* ================= INIT ================= */

postText.addEventListener("input",()=>{
contador.innerText=postText.value.length+" / 1000"
})
    
function abrirMenu(){
    menuOverlay.style.display="block"
    menuLateral.style.left="0"
}

function fecharMenu(){
    menuOverlay.style.display="none"
    menuLateral.style.left="-260px"
}

function abrirConfig(){
    fecharMenu()
    configOverlay.style.display="block"
    configBox.style.bottom="0"
}
   
function fecharConfig(){
    configOverlay.style.display="none"
    configBox.style.bottom="-300px"
}

function atualizarBotoesAtivos(){
    document.getElementById('btnEscuro').classList.remove('ativo')
    document.getElementById('btnClaro').classList.remove('ativo')
    
    let tema = localStorage.getItem('tema') || 'escuro'
    if(tema === 'claro'){
        document.getElementById('btnClaro').classList.add('ativo')
    }else{
        document.getElementById('btnEscuro').classList.add('ativo')
    }
}

function setTema(tipo){

    if(tipo==="claro"){
        document.documentElement.style.setProperty('--bg','#f8f9fa')
        document.documentElement.style.setProperty('--card','#ffffff')
        document.documentElement.style.setProperty('--text','#0d1117')
        document.documentElement.style.setProperty('--border','#d0d7de')
        document.documentElement.style.setProperty('--blue','#0969da')
        document.documentElement.style.setProperty('--sub','#57606a')
        
        document.querySelector('header').style.background = '#f6f8fa'
        document.querySelector('header').style.color = '#0969da'
        
        document.querySelectorAll('.logout').forEach(el => {
            el.style.background = '#f3f4f6'
            el.style.color = '#0d1117'
            el.style.borderColor = '#d0d7de'
        })
        
        document.getElementById('postPopup').style.background = '#ffffff'
        document.getElementById('postPopup').style.borderColor = '#d0d7de'
        
        document.getElementById('postText').style.background = '#f6f8fa'
        document.getElementById('postText').style.color = '#0d1117'
        document.getElementById('postText').style.borderColor = '#d0d7de'
        
        document.getElementById('contador').style.color = '#57606a'
        
        document.getElementById('menuLateral').style.background = '#ffffff'
        document.getElementById('menuLateral').style.borderColor = '#d0d7de'
        
        document.querySelectorAll('#menuLateral button').forEach(btn => {
            btn.style.background = '#f3f4f6'
            btn.style.color = '#0d1117'
        })
        
        document.getElementById('configBox').style.background = '#ffffff'
        document.getElementById('configBox').style.borderColor = '#d0d7de'
        
        document.querySelectorAll('.temaOpcoes button').forEach(btn => {
            btn.style.background = '#f3f4f6'
            btn.style.color = '#0d1117'
        })
        
        document.querySelectorAll('.confirmBox').forEach(box => {
            box.style.background = '#ffffff'
            box.style.borderColor = '#d0d7de'
            box.style.color = '#0d1117'
        })
        
        document.querySelectorAll('.confirmBox textarea').forEach(ta => {
            ta.style.background = '#f6f8fa'
            ta.style.color = '#0d1117'
            ta.style.borderColor = '#d0d7de'
        })
        
        document.querySelectorAll('.confirmBtns button').forEach(btn => {
            btn.style.background = '#f3f4f6'
            btn.style.color = '#0d1117'
        })
        
    }else{
        document.documentElement.style.setProperty('--bg','#0b0b0b')
        document.documentElement.style.setProperty('--card','#121212')
        document.documentElement.style.setProperty('--text','#e8e8e8')
        document.documentElement.style.setProperty('--border','#1f1f1f')
        document.documentElement.style.setProperty('--blue','#1da1f2')
        document.documentElement.style.setProperty('--sub','#9e9e9e')
        
        document.querySelector('header').style.background = '#0f0f0f'
        document.querySelector('header').style.color = '#1da1f2'
        
        document.querySelectorAll('.logout').forEach(el => {
            el.style.background = ''
            el.style.color = ''
            el.style.borderColor = ''
        })
        
        document.getElementById('postPopup').style.background = '#111'
        document.getElementById('postPopup').style.borderColor = ''
        
        document.getElementById('postText').style.background = '#0c0c0c'
        document.getElementById('postText').style.color = 'white'
        document.getElementById('postText').style.borderColor = ''
        
        document.getElementById('contador').style.color = ''
        
        document.getElementById('menuLateral').style.background = '#111'
        document.getElementById('menuLateral').style.borderColor = ''
        
        document.querySelectorAll('#menuLateral button').forEach(btn => {
            btn.style.background = ''
            btn.style.color = ''
        })
        
        document.getElementById('configBox').style.background = '#111'
        document.getElementById('configBox').style.borderColor = ''
        
        document.querySelectorAll('.temaOpcoes button').forEach(btn => {
            btn.style.background = ''
            btn.style.color = ''
        })
        
        document.querySelectorAll('.confirmBox').forEach(box => {
            box.style.background = '#121212'
            box.style.borderColor = '#2a2a2a'
            box.style.color = 'white'
        })
        
        document.querySelectorAll('.confirmBox textarea').forEach(ta => {
            ta.style.background = '#0c0c0c'
            ta.style.color = 'white'
            ta.style.borderColor = '#333'
        })
        
        document.querySelectorAll('.confirmBtns button').forEach(btn => {
            btn.style.background = ''
            btn.style.color = ''
        })
    }

    localStorage.setItem("tema", tipo)
    atualizarBotoesAtivos()
}

let temaSalvo = localStorage.getItem("tema")
if(temaSalvo){
    setTema(temaSalvo)
}else{
    atualizarBotoesAtivos()
}
    
function abrirSAR(){
    fecharMenu()
    setTimeout(()=>{
        location.href = "IA.html"
    },200)
}
function verificarPalavras(texto){
let textoLower = texto.toLowerCase()

for(let palavra of palavrasProibidas){
    if(textoLower.includes(palavra)){
        return palavra
    }
}

return null
}

carregarFeed()