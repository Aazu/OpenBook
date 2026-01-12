
/**
 * OpenBooks — REST-backed demo
 * Frontend: static HTML/CSS/JS
 * Backend: Node.js + Express (REST API) + Multer (uploads) + JSON file DB
 *
 * Run:
 *   cd server
 *   npm install
 *   npm start
 * Then open: http://localhost:3000/
 */

const API_BASE = ""; // same origin (server serves the client)

function $(id){ return document.getElementById(id); }

function escapeHtml(s){
  return String(s??"").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function fmtDate(ms){
  const d = new Date(ms);
  return d.toLocaleString(undefined, {year:"numeric",month:"short",day:"2-digit",hour:"2-digit",minute:"2-digit"});
}

async function api(path, opts={}){
  const res = await fetch(API_BASE + path, {
    headers: { "Accept":"application/json", ...(opts.headers||{}) },
    ...opts
  });
  if (!res.ok){
    let msg = `${res.status} ${res.statusText}`;
    try{ const j = await res.json(); msg = j.error || j.message || msg; }catch{}
    throw new Error(msg);
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return res.text();
}

async function apiPostJSON(path, body){
  return api(path, {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify(body)
  });
}

async function apiUploadPost(formData){
  const res = await fetch(API_BASE + "/api/posts", { method:"POST", body: formData });
  if (!res.ok){
    let msg = `${res.status} ${res.statusText}`;
    try{ const j = await res.json(); msg = j.error || j.message || msg; }catch{}
    throw new Error(msg);
  }
  return res.json();
}

async function getActiveUser(){
  return api("/api/auth/me");
}
async function setActiveUser(userId){
  return apiPostJSON("/api/auth/switch", { userId });
}
async function updateMe({name, role}){
  return apiPostJSON("/api/auth/update", { name, role });
}
async function listUsers(){ return api("/api/users"); }
async function addCreator(name){ return apiPostJSON("/api/users", { name, role:"creator" }); }
async function deleteUser(id){ return api("/api/users/"+encodeURIComponent(id), {method:"DELETE"}); }

async function listPosts(){ return api("/api/posts"); }
async function adminToggleStatus(postId){ return apiPostJSON(`/api/admin/posts/${encodeURIComponent(postId)}/status`, {}); }
async function adminDeletePost(postId){ return api(`/api/admin/posts/${encodeURIComponent(postId)}`, {method:"DELETE"}); }

async function like(postId){ return apiPostJSON(`/api/posts/${encodeURIComponent(postId)}/like`, {}); }
async function rate(postId, rating){ return apiPostJSON(`/api/posts/${encodeURIComponent(postId)}/rate`, { rating }); }
async function comment(postId, text){ return apiPostJSON(`/api/posts/${encodeURIComponent(postId)}/comments`, { text }); }

function highlightNav(){
  const here = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  document.querySelectorAll(".nav a").forEach(a=>{
    const href = (a.getAttribute("href")||"").toLowerCase();
    if (href.endsWith(here)) a.classList.add("active");
  });
}

async function renderTopPill(){
  try{
    const u = await getActiveUser();
    const el = $("activeUserPill");
    if (el) el.textContent = `${u.name} • ${u.role}`;
  }catch(e){
    const el = $("activeUserPill");
    if (el) el.textContent = "Offline • API not running";
  }
}

document.addEventListener("DOMContentLoaded", async ()=>{
  highlightNav();
  await renderTopPill();
  const page = document.body.getAttribute("data-page");
  if (page === "index") initConsumer();
  if (page === "creator") initCreator();
  if (page === "admin") initAdmin();
  if (page === "settings") initSettings();
  if (page === "status") initStatus();
});

// Consumer
async function initConsumer(){
  const q = $("q");
  const grid = $("grid");
  const count = $("count");
  const kpiPosts = $("kpiPosts");
  const kpiCreators = $("kpiCreators");
  const kpiLikes = $("kpiLikes");
  const kpiAvg = $("kpiAvg");
  const chipRecent = $("chipRecent");
  const chipRating = $("chipRating");
  const btnResetDb = $("btnResetDb");

  let sortBy = "recent";
  let cachedPosts = [];
  let me = null;

  async function load(){
    me = await getActiveUser();
    cachedPosts = (await listPosts()).filter(p=>p.status==="published");
  }

  function computeKpis(posts){
    kpiPosts.textContent = String(posts.length);
    kpiCreators.textContent = String(new Set(posts.map(p=>p.creator_name)).size);
    kpiLikes.textContent = String(posts.reduce((a,p)=>a+Number(p.like_count||0),0));
    const avgAll = posts.length ? (posts.reduce((a,p)=>a+Number(p.rating_avg||0),0)/posts.length) : 0;
    kpiAvg.textContent = avgAll ? avgAll.toFixed(1) : "—";
  }

  function filterSort(){
    const query = (q?.value||"").trim().toLowerCase();
    let filtered = cachedPosts;
    if (query){
      filtered = cachedPosts.filter(p=>{
        const hay = `${p.title} ${p.creator_name} ${p.caption} ${p.location} ${(p.tags||[]).join(" ")} ${(p.people||[]).join(" ")}`.toLowerCase();
        return hay.includes(query);
      });
    }
    if (sortBy==="rating"){
      filtered = [...filtered].sort((a,b)=>(b.rating_avg-a.rating_avg)||(b.rating_count-a.rating_count)||(b.created_at-a.created_at));
    } else {
      filtered = [...filtered].sort((a,b)=>b.created_at-a.created_at);
    }
    return filtered;
  }

  function render(){
    const filtered = filterSort();
    count.textContent = `${filtered.length} photos`;

    grid.innerHTML = filtered.map(p=>`
      <div class="card" role="button" tabindex="0" data-open="${escapeHtml(p.id)}">
        <div class="thumb"><img loading="lazy" src="${escapeHtml(p.image_url)}" alt="${escapeHtml(p.title)}"></div>
        <div class="cardBody">
          <div class="titleRow"><div class="cardTitle" title="${escapeHtml(p.title)}">${escapeHtml(p.title)}</div></div>
          <div class="cardMeta">by ${escapeHtml(p.creator_name)} • ${escapeHtml(fmtDate(p.created_at))}</div>
          <div class="stats">
            <span>★ ${p.rating_count ? p.rating_avg.toFixed(1) : "—"} (${p.rating_count})</span>
            <span>💬 ${p.comment_count||0}</span>
            <span>♥ ${p.like_count||0}</span>
          </div>
          <div class="tags">${(p.tags||[]).slice(0,4).map(t=>`<span class="tag">#${escapeHtml(t)}</span>`).join("")}</div>
        </div>
      </div>
    `).join("");

    grid.querySelectorAll("[data-open]").forEach(el=>{
      el.addEventListener("click", ()=> openModal(el.getAttribute("data-open")));
      el.addEventListener("keydown", (e)=>{ if(e.key==="Enter") openModal(el.getAttribute("data-open")); });
    });
  }

  // Modal
  const back = $("modalBack");
  back?.addEventListener("click", (e)=>{ if(e.target === back) closeModal(); });
  $("btnCloseModal")?.addEventListener("click", closeModal);

  async function openModal(id){
    const p = cachedPosts.find(x=>x.id===id) || (await api(`/api/posts/${encodeURIComponent(id)}`));
    $("mTitle").textContent = p.title;
    $("mMeta").textContent = `by ${p.creator_name} • ${fmtDate(p.created_at)}`;
    $("mImg").src = p.image_url;
    $("mCaption").textContent = p.caption || "No caption";
    $("mLocation").textContent = p.location || "No location";
    $("mPeople").textContent = (p.people||[]).join(", ") || "None";
    $("mTags").innerHTML = (p.tags||[]).map(t=>`<span class="tag">#${escapeHtml(t)}</span>`).join(" ");
    $("mRating").textContent = p.rating_count ? `${p.rating_avg.toFixed(1)} (${p.rating_count})` : "—";

    // like
    const likeBtn = $("btnLike");
    likeBtn.classList.toggle("on", !!p.liked_by_me);
    likeBtn.innerHTML = `♥ ${p.like_count||0} Like`;
    likeBtn.onclick = async ()=>{
      const updated = await like(p.id);
      // refresh cache item
      cachedPosts = cachedPosts.map(x=>x.id===p.id?updated:x);
      likeBtn.classList.toggle("on", !!updated.liked_by_me);
      likeBtn.innerHTML = `♥ ${updated.like_count||0} Like`;
      $("mRating").textContent = updated.rating_count ? `${updated.rating_avg.toFixed(1)} (${updated.rating_count})` : "—";
      await load(); computeKpis(cachedPosts); render();
      // refresh comments list
      const full = await api(`/api/posts/${encodeURIComponent(p.id)}`);
      renderComments(full);
    };

    // rating buttons
    const stars = $("starBtns");
    stars.innerHTML = [1,2,3,4,5].map(n=>`<button class="starBtn ${n<= (p.my_rating||0) ? "on":""}" data-rate="${n}">★</button>`).join("");
    stars.querySelectorAll("[data-rate]").forEach(b=>{
      b.addEventListener("click", async ()=>{
        const updated = await rate(p.id, Number(b.getAttribute("data-rate")));
        cachedPosts = cachedPosts.map(x=>x.id===p.id?updated:x);
        await openModal(p.id);
        await load(); computeKpis(cachedPosts); render();
      });
    });

    renderComments(p);
    // post comment
    const cInput = $("commentText");
    cInput.value = "";
    $("btnComment").onclick = async ()=>{
      const t = (cInput.value||"").trim();
      if (!t) return;
      const updated = await comment(p.id, t);
      cachedPosts = cachedPosts.map(x=>x.id===p.id?updated:x);
      await openModal(p.id);
      await load(); computeKpis(cachedPosts); render();
    };

    back.classList.add("show");
  }

  function renderComments(p){
    const list = $("mComments");
    list.innerHTML = (p.comments||[]).length ? p.comments.map(c=>`
      <div class="comment">
        <div class="who">${escapeHtml(c.who)} • ${escapeHtml(fmtDate(c.at))}</div>
        <div>${escapeHtml(c.text)}</div>
      </div>
    `).join("") : `<div class="note">No comments yet.</div>`;
  }

  function closeModal(){ back.classList.remove("show"); }

  q?.addEventListener("input", ()=>render());
  chipRecent?.addEventListener("click", ()=>{
    sortBy="recent"; chipRecent.classList.add("active"); chipRating.classList.remove("active"); render();
  });
  chipRating?.addEventListener("click", ()=>{
    sortBy="rating"; chipRating.classList.add("active"); chipRecent.classList.remove("active"); render();
  });

  btnResetDb?.addEventListener("click", async ()=>{
    await api("/api/admin/reset", {method:"POST"});
    await renderTopPill();
    await load();
    computeKpis(cachedPosts);
    render();
  });

  await load();
  computeKpis(cachedPosts);
  render();
}

// Creator
async function initCreator(){
  const me = await getActiveUser();
  const msg = $("msg");
  const roleWarn = $("roleWarn");
  if (me.role !== "creator" && me.role !== "admin"){
    roleWarn.style.display="block";
  }

  const file = $("file");
  const preview = $("preview");
  const title = $("title");
  const caption = $("caption");
  const locationEl = $("location");
  const people = $("people");
  const tags = $("tags");
  const upload = $("btnUpload");
  const btnReset = $("btnReset");

  let chosenFile = null;

  file.addEventListener("change", async ()=>{
    msg.className="msg"; msg.textContent="";
    chosenFile = file.files?.[0] || null;
    if (!chosenFile){ preview.innerHTML = `<span class="note">Preview</span>`; return; }
    const url = URL.createObjectURL(chosenFile);
    preview.innerHTML = `<img src="${url}" alt="preview" style="width:100%;height:100%;object-fit:cover;display:block">`;
  });

  upload.addEventListener("click", async ()=>{
    msg.className="msg"; msg.textContent="";
    if (me.role !== "creator" && me.role !== "admin"){
      msg.classList.add("err");
      msg.textContent="You are in Consumer role. Go to Settings → switch role to Creator to upload.";
      return;
    }
    if (!chosenFile){
      msg.classList.add("err"); msg.textContent="Please choose an image first.";
      return;
    }

    const fd = new FormData();
    fd.append("image", chosenFile);
    fd.append("title", (title.value||"Untitled").trim() || "Untitled");
    fd.append("caption", (caption.value||"").trim());
    fd.append("location", (locationEl.value||"").trim());
    fd.append("people", (people.value||"").trim());
    fd.append("tags", (tags.value||"").trim());

    try{
      await apiUploadPost(fd);
      msg.classList.add("ok");
      msg.textContent="Uploaded ✓ Go to Consumer Portal to see it.";
      file.value=""; chosenFile=null;
      preview.innerHTML = `<span class="note">Preview</span>`;
      title.value=""; caption.value=""; locationEl.value=""; people.value=""; tags.value="";
      await renderMyUploads();
    }catch(e){
      msg.classList.add("err");
      msg.textContent = "Upload failed: " + e.message;
    }
  });

  btnReset?.addEventListener("click", async ()=>{
    await api("/api/admin/reset", {method:"POST"});
    await renderTopPill();
    msg.className="msg ok"; msg.textContent="Reset done.";
    await renderMyUploads();
  });

  async function renderMyUploads(){
    const wrap = $("myUploads");
    const posts = (await listPosts()).filter(p=>p.creator_name===me.name).slice(0,12);
    wrap.innerHTML = posts.length ? posts.map(p=>`
      <div class="miniCard">
        <div class="thumb"><img src="${escapeHtml(p.image_url)}" alt="${escapeHtml(p.title)}"></div>
        <div class="cardBody">
          <div class="cardTitle">${escapeHtml(p.title)}</div>
          <div class="cardMeta">${escapeHtml(fmtDate(p.created_at))}</div>
        </div>
      </div>
    `).join("") : `<div class="note">No uploads yet.</div>`;
  }

  await renderMyUploads();
}

// Admin
async function initAdmin(){
  const me = await getActiveUser();
  const warn = $("adminWarn");
  if (me.role !== "admin") warn.style.display="block";

  const usersT = $("usersTbody");
  const postsT = $("postsTbody");
  const newName = $("newCreatorName");
  const btnAdd = $("btnAddCreator");
  const msg = $("msgAdmin");
  const btnReset = $("btnResetAdmin");

  async function render(){
    const users = await listUsers();
    usersT.innerHTML = users.map(x=>`
      <tr>
        <td>${escapeHtml(x.name)}</td>
        <td>${escapeHtml(x.role)}</td>
        <td>
          <button class="btn" data-act="setActive" data-id="${escapeHtml(x.id)}">Switch</button>
          <button class="btn" data-act="deleteUser" data-id="${escapeHtml(x.id)}">Delete</button>
        </td>
      </tr>
    `).join("");

    const posts = await listPosts();
    postsT.innerHTML = posts.map(p=>`
      <tr>
        <td>${escapeHtml(p.title)}</td>
        <td>${escapeHtml(p.creator_name)}</td>
        <td>${escapeHtml(p.status)}</td>
        <td>★ ${p.rating_count ? p.rating_avg.toFixed(1) : "—"} • ♥ ${p.like_count||0} • 💬 ${p.comment_count||0}</td>
        <td>
          <button class="btn" data-act="toggleStatus" data-id="${escapeHtml(p.id)}">${p.status==="published"?"Unpublish":"Publish"}</button>
          <button class="btn" data-act="deletePost" data-id="${escapeHtml(p.id)}">Delete</button>
        </td>
      </tr>
    `).join("");

    usersT.querySelectorAll("button[data-act]").forEach(b=>{
      b.addEventListener("click", async ()=>{
        msg.className="msg"; msg.textContent="";
        const act = b.getAttribute("data-act");
        const id = b.getAttribute("data-id");
        try{
          if (act==="setActive"){
            await setActiveUser(id);
            await renderTopPill();
            msg.className="msg ok"; msg.textContent="Switched active user.";
          }
          if (act==="deleteUser"){
            await deleteUser(id);
            msg.className="msg ok"; msg.textContent="User deleted.";
          }
          await render();
        }catch(e){
          msg.className="msg err"; msg.textContent=e.message;
        }
      });
    });

    postsT.querySelectorAll("button[data-act]").forEach(b=>{
      b.addEventListener("click", async ()=>{
        msg.className="msg"; msg.textContent="";
        const act = b.getAttribute("data-act");
        const id = b.getAttribute("data-id");
        try{
          if (act==="toggleStatus"){
            await adminToggleStatus(id);
            msg.className="msg ok"; msg.textContent="Post status updated.";
          }
          if (act==="deletePost"){
            await adminDeletePost(id);
            msg.className="msg ok"; msg.textContent="Post deleted.";
          }
          await render();
        }catch(e){
          msg.className="msg err"; msg.textContent=e.message;
        }
      });
    });
  }

  btnAdd?.addEventListener("click", async ()=>{
    msg.className="msg"; msg.textContent="";
    if (me.role !== "admin"){
      msg.className="msg err"; msg.textContent="Only admin can add creators. Switch role in Settings first.";
      return;
    }
    const name = (newName.value||"").trim();
    if (!name){ msg.className="msg err"; msg.textContent="Enter a creator name."; return; }
    try{
      await addCreator(name);
      newName.value="";
      msg.className="msg ok"; msg.textContent="Creator added.";
      await render();
    }catch(e){
      msg.className="msg err"; msg.textContent=e.message;
    }
  });

  btnReset?.addEventListener("click", async ()=>{
    await api("/api/admin/reset", {method:"POST"});
    await renderTopPill();
    msg.className="msg ok"; msg.textContent="Reset done.";
    await render();
  });

  await render();
}

// Settings
async function initSettings(){
  const me = await getActiveUser();
  $("curName").value = me.name;
  $("curRole").value = me.role;

  const msg = $("msgSettings");
  $("btnSaveSettings").addEventListener("click", async ()=>{
    msg.className="msg"; msg.textContent="";
    const name = $("curName").value.trim() || "User";
    const role = $("curRole").value;
    try{
      await updateMe({name, role});
      await renderTopPill();
      msg.className="msg ok"; msg.textContent="Saved ✓";
    }catch(e){
      msg.className="msg err"; msg.textContent=e.message;
    }
  });

  const sel = $("switchUser");
  const users = await listUsers();
  sel.innerHTML = users.map(x=>`<option value="${escapeHtml(x.id)}">${escapeHtml(x.name)} (${escapeHtml(x.role)})</option>`).join("");
  sel.value = me.id;

  $("btnSwitchUser").addEventListener("click", async ()=>{
    msg.className="msg"; msg.textContent="";
    try{
      await setActiveUser(sel.value);
      await renderTopPill();
      const me2 = await getActiveUser();
      $("curName").value = me2.name;
      $("curRole").value = me2.role;
      msg.className="msg ok"; msg.textContent="Switched active user.";
    }catch(e){
      msg.className="msg err"; msg.textContent=e.message;
    }
  });
}

// Status
async function initStatus(){
  const me = await getActiveUser();
  const stats = await api("/api/status");
  $("statusUser").textContent = `${me.name} (${me.role})`;
  $("statusPosts").textContent = String(stats.posts);
  $("statusUsers").textContent = String(stats.users);
  $("statusStorage").textContent = stats.db_size_human;

  const tbody = $("svcTbody");
  tbody.innerHTML = stats.services.map(s=>`
    <tr>
      <td><span class="badgeDot"><span class="dot ${escapeHtml(s.dot||"")}"></span>${escapeHtml(s.name)}</span></td>
      <td>${escapeHtml(s.state)}</td>
      <td class="muted">${escapeHtml(s.note||"")}</td>
    </tr>
  `).join("");

  $("btnClearStorage").textContent = "Reset server DB";
  $("btnClearStorage").addEventListener("click", async ()=>{
    await api("/api/admin/reset", {method:"POST"});
    location.reload();
  });

  $("btnExport").addEventListener("click", async ()=>{
    const dump = await api("/api/admin/export");
    const blob = new Blob([JSON.stringify(dump,null,2)], {type:"application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "openbooks_server_dump.json";
    a.click();
    URL.revokeObjectURL(a.href);
  });
}
