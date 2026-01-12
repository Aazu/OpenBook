
const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const multer = require("multer");
const { nanoid } = require("nanoid");

const app = express();
const PORT = process.env.PORT || 3000;

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const UPLOAD_DIR = path.join(ROOT, "uploads");
const DB_FILE = path.join(DATA_DIR, "db.json");

// Provider switches (coursework demo):
// STORAGE_PROVIDER = 'local' | 'azureblob'   (default: local)
// DB_PROVIDER      = 'file'  | 'cosmos'      (default: file)
const STORAGE_PROVIDER = (process.env.STORAGE_PROVIDER || "local").toLowerCase();
const DB_PROVIDER = (process.env.DB_PROVIDER || "file").toLowerCase();

let azureUpload = null;
let cosmos = null;
if (STORAGE_PROVIDER === "azureblob") {
  azureUpload = require("./azure_storage");
}
if (DB_PROVIDER === "cosmos") {
  cosmos = require("./cosmos_db");
}


if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));

// Serve uploads and client

// Ensure DB is loaded before handling requests
app.use(async (req, res, next) => {
  // wait briefly if startup is still loading
  let tries = 0;
  while (!db && tries < 50) { // ~1s
    await new Promise(r => setTimeout(r, 20));
    tries++;
  }
  if (!db) return res.status(503).json({ error: "DB not ready yet. Please refresh." });
  next();
});

app.use("/uploads", express.static(UPLOAD_DIR, { maxAge: "1d" }));
app.use("/", express.static(path.join(ROOT, "..", "client"), { maxAge: 0 }));

// Very simple "session": current user id stored in db.json (demo only)
async function loadDB() {
  if (DB_PROVIDER === "cosmos") {
    const meta = await cosmos.getById("meta", "meta");
    const users = await cosmos.query("SELECT * FROM c WHERE c.type='user'");
    const posts = await cosmos.query("SELECT * FROM c WHERE c.type='post'");
    const likes = await cosmos.query("SELECT * FROM c WHERE c.type='like'");
    const ratings = await cosmos.query("SELECT * FROM c WHERE c.type='rating'");
    const comments = await cosmos.query("SELECT * FROM c WHERE c.type='comment'");
    return {
      activeUserId: meta?.activeUserId || (users[0]?.id || "u_consumer"),
      users, posts, likes, ratings, comments
    };
  }
  if (!fs.existsSync(DB_FILE)) return null;
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}
async function saveDB(db) {
  if (DB_PROVIDER === "cosmos") {
    // Upsert meta
    await cosmos.upsert({ id: "meta", type: "meta", activeUserId: db.activeUserId });
    // Bulk upsert (simple loop for coursework demo)
    for (const u of db.users) await cosmos.upsert({ ...u, type: "user" });
    for (const p of db.posts) await cosmos.upsert({ ...p, type: "post" });
    for (const x of db.likes) await cosmos.upsert({ ...x, type: "like", id: x.id || `${x.postId}:${x.userId}` });
    for (const x of db.ratings) await cosmos.upsert({ ...x, type: "rating", id: x.id || `${x.postId}:${x.userId}` });
    for (const x of db.comments) await cosmos.upsert({ ...x, type: "comment" });
    return;
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf8");
}
async function seedDB() {
  const now = Date.now();
  const db = {
    activeUserId: "u_consumer",
    users: [
      { id: "u_admin", name: "Admin", role: "admin" },
      { id: "u_creator", name: "Creator", role: "creator" },
      { id: "u_consumer", name: "Consumer", role: "consumer" },
      { id: "u_john", name: "John Doe", role: "creator" },
      { id: "u_jane", name: "Jane Smith", role: "creator" },
      { id: "u_sarah", name: "Sarah Johnson", role: "creator" }
    ],
    posts: [],
    likes: [],        // { postId, userId, at }
    ratings: [],      // { postId, userId, rating, at }
    comments: []      // { id, postId, who, text, at }
  };

  const seedPosts = [
    { title:"Golden Hour in Santorini", image_url:"https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=1200", creator_name:"John Doe", tags:["sunset","travel"], caption:"Soft blue hour over white rooftops.", location:"Santorini, Greece", people:["John"] },
    { title:"Mountain Serenity", image_url:"https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200", creator_name:"Jane Smith", tags:["mountains","nature"], caption:"Quiet clouds hugging the peaks.", location:"Himalayas, Nepal", people:["Jane"] },
    { title:"Urban Reflections", image_url:"https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=1200", creator_name:"Sarah Johnson", tags:["city","night"], caption:"Rainy streets, neon reflections.", location:"New York, USA", people:["Sarah"] },
    { title:"Blooming Paradise", image_url:"https://images.unsplash.com/photo-1499002238440-d264edd596ec?w=1200", creator_name:"Sarah Johnson", tags:["flowers","nature"], caption:"Spring colors everywhere.", location:"Kyoto, Japan", people:["Sarah"] },
    { title:"Ocean Dreams", image_url:"https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=1200", creator_name:"John Doe", tags:["beach","ocean"], caption:"Waves + golden light.", location:"Algarve, Portugal", people:["John"] },
    { title:"Forest Whispers", image_url:"https://images.unsplash.com/photo-1448375240586-882707db888b?w=1200", creator_name:"Jane Smith", tags:["forest","trees"], caption:"Mist between tall trees.", location:"Scotland", people:["Jane"] },
    { title:"Desert Sunset", image_url:"https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=1200", creator_name:"John Doe", tags:["desert","sunset"], caption:"Clean lines of dunes.", location:"Dubai, UAE", people:["John"] },
    { title:"Northern Lights", image_url:"https://images.unsplash.com/photo-1483347756197-71ef80e95f73?w=1200", creator_name:"Sarah Johnson", tags:["aurora","night","nature"], caption:"A sky that doesn’t look real.", location:"Iceland", people:["Sarah"] }
  ].map((p, i) => ({
    id: nanoid(),
    title: p.title,
    image_url: p.image_url,
    creator_name: p.creator_name,
    caption: p.caption,
    location: p.location,
    people: p.people,
    tags: p.tags,
    created_at: now - (i+1)*3600*1000,
    status: "published"
  }));
  db.posts = seedPosts;

  // seed some ratings and comments
  const seedRatings = [4.8,4.9,4.6,4.7,4.9,4.5,4.8,5.0];
  db.ratings = seedPosts.map((p,i)=>({ postId:p.id, userId:"seed", rating:seedRatings[i], at: now }));
  db.comments = seedPosts.filter((_,i)=>i%2===1).map((p)=>({ id:nanoid(), postId:p.id, who:"Consumer", text:"Love this!", at: now-10000 }));

  await await saveDB(db);
  return db;
}

let db;
(async ()=>{
  db = await loadDB();
  if (!db) db = await seedDB();
})();

function getMe(req){
  const me = db.users.find(u=>u.id===db.activeUserId) || db.users[0];
  return me;
}

function summarizePost(p, me){
  const likes = db.likes.filter(x=>x.postId===p.id);
  const ratings = db.ratings.filter(x=>x.postId===p.id);
  const comments = db.comments.filter(x=>x.postId===p.id).sort((a,b)=>b.at-a.at).slice(0, 25);
  const avg = ratings.length ? ratings.reduce((a,b)=>a+Number(b.rating||0),0)/ratings.length : 0;
  const myRating = ratings.find(x=>x.userId===me.id)?.rating || 0;
  return {
    ...p,
    like_count: likes.length,
    liked_by_me: likes.some(x=>x.userId===me.id),
    rating_avg: avg,
    rating_count: ratings.length,
    my_rating: myRating,
    comment_count: db.comments.filter(x=>x.postId===p.id).length,
    comments
  };
}

// ---- Auth (demo) ----
app.get("/api/auth/me", (req, res) => {
  const me = getMe(req);
  res.json(me);
});

app.post("/api/auth/switch", async (req, res) => {
  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: "userId is required" });
  const u = db.users.find(x=>x.id===userId);
  if (!u) return res.status(404).json({ error: "User not found" });
  db.activeUserId = userId;
  await saveDB(db);
  res.json(u);
});

app.post("/api/auth/update", async (req, res) => {
  const me = getMe(req);
  const { name, role } = req.body || {};
  if (!name || !role) return res.status(400).json({ error: "name and role are required" });
  const allowed = new Set(["consumer","creator","admin"]);
  if (!allowed.has(role)) return res.status(400).json({ error: "Invalid role" });
  me.name = String(name).slice(0, 60);
  me.role = role;
  await saveDB(db);
  res.json(me);
});

// ---- Users ----
app.get("/api/users", (req,res)=> res.json(db.users));

app.post("/api/users", async (req,res)=>{
  const me = getMe(req);
  if (me.role !== "admin") return res.status(403).json({ error: "Admin only" });
  const { name, role } = req.body || {};
  if (!name) return res.status(400).json({ error: "name is required" });
  const r = role || "creator";
  const allowed = new Set(["consumer","creator","admin"]);
  if (!allowed.has(r)) return res.status(400).json({ error: "Invalid role" });
  const user = { id: nanoid(), name: String(name).slice(0,60), role: r };
  db.users.unshift(user);
  await saveDB(db);
  res.status(201).json(user);
});

app.delete("/api/users/:id", async (req,res)=>{
  const me = getMe(req);
  if (me.role !== "admin") return res.status(403).json({ error: "Admin only" });
  const id = req.params.id;
  if (id === "u_admin") return res.status(400).json({ error: "Cannot delete seeded admin" });
  db.users = db.users.filter(u=>u.id!==id);
  if (db.activeUserId === id) db.activeUserId = "u_consumer";
  await saveDB(db);
  res.json({ ok:true });
});

// ---- Posts ----
app.get("/api/posts", (req,res)=>{
  const me = getMe(req);
  const list = db.posts
    .map(p=>summarizePost(p, me))
    .sort((a,b)=>b.created_at-a.created_at);
  res.json(list);
});

app.get("/api/posts/:id", (req,res)=>{
  const me = getMe(req);
  const p = db.posts.find(x=>x.id===req.params.id);
  if (!p) return res.status(404).json({ error: "Post not found" });
  res.json(summarizePost(p, me));
});

// Upload (Creator/Admin only) — accepts image file + metadata fields
const upload = multer(
  STORAGE_PROVIDER === "azureblob"
    ? { storage: multer.memoryStorage(), limits: { fileSize: 6 * 1024 * 1024 } }
    : {
        storage: multer.diskStorage({
          destination: (req, file, cb) => cb(null, UPLOAD_DIR),
          filename: (req, file, cb) => {
            const safe = (file.originalname || "upload").replace(/[^a-zA-Z0-9._-]+/g, "_");
            cb(null, `${Date.now()}_${nanoid(8)}_${safe}`);
          }
        }),
        limits: { fileSize: 6 * 1024 * 1024 }
      }
);

app.post("/api/posts", upload.single("image"), async (req,res)=>{
  const me = getMe(req);
  if (!(me.role === "creator" || me.role === "admin")) return res.status(403).json({ error: "Creator/Admin only" });
  if (!req.file) return res.status(400).json({ error: "image file is required" });

  const title = String(req.body.title || "Untitled").slice(0, 120);
  const caption = String(req.body.caption || "").slice(0, 800);
  const location = String(req.body.location || "").slice(0, 120);
  const people = String(req.body.people || "").split(",").map(s=>s.trim()).filter(Boolean).slice(0, 10);
  const tags = String(req.body.tags || "").split(",").map(s=>s.trim()).filter(Boolean).slice(0, 12);

  let imageUrl;
  if (STORAGE_PROVIDER === 'azureblob') {
    imageUrl = await azureUpload.uploadBufferToBlob(req.file.originalname, req.file.buffer, req.file.mimetype);
  } else {
    imageUrl = `/uploads/${req.file.filename}`;
  }

  const post = {
    id: nanoid(),
    title,
    image_url: imageUrl,
    creator_name: me.name,
    caption,
    location,
    people,
    tags,
    created_at: Date.now(),
    status: "published"
  };
  db.posts.unshift(post);
  await saveDB(db);
  res.status(201).json(summarizePost(post, me));
});

// Like / rate / comment
app.post("/api/posts/:id/like", async (req,res)=>{
  const me = getMe(req);
  const id = req.params.id;
  const p = db.posts.find(x=>x.id===id);
  if (!p) return res.status(404).json({ error: "Post not found" });

  const idx = db.likes.findIndex(x=>x.postId===id && x.userId===me.id);
  if (idx>=0) db.likes.splice(idx,1);
  else db.likes.unshift({ postId:id, userId:me.id, at: Date.now() });

  await saveDB(db);
  res.json(summarizePost(p, me));
});

app.post("/api/posts/:id/rate", async (req,res)=>{
  const me = getMe(req);
  const id = req.params.id;
  const p = db.posts.find(x=>x.id===id);
  if (!p) return res.status(404).json({ error: "Post not found" });

  const r = Number(req.body?.rating);
  if (!Number.isFinite(r) || r<1 || r>5) return res.status(400).json({ error: "rating must be 1-5" });

  const idx = db.ratings.findIndex(x=>x.postId===id && x.userId===me.id);
  const obj = { postId:id, userId:me.id, rating:r, at: Date.now() };
  if (idx>=0) db.ratings[idx]=obj; else db.ratings.unshift(obj);

  await saveDB(db);
  res.json(summarizePost(p, me));
});

app.post("/api/posts/:id/comments", async (req,res)=>{
  const me = getMe(req);
  const id = req.params.id;
  const p = db.posts.find(x=>x.id===id);
  if (!p) return res.status(404).json({ error: "Post not found" });

  const text = String(req.body?.text || "").trim();
  if (!text) return res.status(400).json({ error: "text is required" });
  db.comments.unshift({ id:nanoid(), postId:id, who: me.name, text: text.slice(0, 500), at: Date.now() });

  await saveDB(db);
  res.json(summarizePost(p, me));
});

// ---- Admin endpoints ----
app.post("/api/admin/reset", async (req,res)=>{
  db = await seedDB();
  res.json({ ok:true });
});

app.post("/api/admin/posts/:id/status", async (req,res)=>{
  const me = getMe(req);
  if (me.role !== "admin") return res.status(403).json({ error: "Admin only" });
  const p = db.posts.find(x=>x.id===req.params.id);
  if (!p) return res.status(404).json({ error: "Post not found" });
  p.status = p.status === "published" ? "hidden" : "published";
  await saveDB(db);
  res.json({ ok:true, status:p.status });
});

app.delete("/api/admin/posts/:id", async (req,res)=>{
  const me = getMe(req);
  if (me.role !== "admin") return res.status(403).json({ error: "Admin only" });
  const id = req.params.id;
  db.posts = db.posts.filter(p=>p.id!==id);
  db.likes = db.likes.filter(x=>x.postId!==id);
  db.ratings = db.ratings.filter(x=>x.postId!==id);
  db.comments = db.comments.filter(x=>x.postId!==id);
  await saveDB(db);
  res.json({ ok:true });
});

app.get("/api/admin/export", (req,res)=>{
  const me = getMe(req);
  if (me.role !== "admin") return res.status(403).json({ error: "Admin only" });
  res.json(db);
});

// ---- Status ----
app.get("/api/status", (req,res)=>{
  let size = 0;
  if (DB_PROVIDER !== 'cosmos') {
    const stat = fs.statSync(DB_FILE);
    size = stat.size;
  }
  const human = (n)=>{
    const u=["B","KB","MB","GB"];
    let i=0; let x=n;
    while (x>=1024 && i<u.length-1){ x/=1024; i++; }
    return `${x.toFixed(i===0?0:2)} ${u[i]}`;
  };
  res.json({
    users: db.users.length,
    posts: db.posts.length,
    db_size_bytes: size,
    db_size_human: human(size),
    services: [
      {name:"Static Web Hosting (Express static)", state:"OK", dot:""},
      {name:"REST API Endpoint (Express)", state:"OK", dot:""},
      {name:"Object Storage (local disk uploads/)", state:"OK", dot:""},
      {name:"Database (JSON file db.json)", state:"OK", dot:""},
      {name:"Caching Layer", state:"WARN", dot:"warn", note:"Not enabled. In cloud use CDN + Redis."},
      {name:"Auth & Roles", state:"WARN", dot:"warn", note:"Demo-only. Use JWT/OAuth in cloud."},
      {name:"CDN / Dynamic DNS", state:"WARN", dot:"warn", note:"Not enabled locally. In cloud use CDN + traffic routing."},
    ]
  });
});

// SPA-ish fallback: serve consumer portal
app.get("*", (req,res)=>{
  res.sendFile(path.join(ROOT, "..", "client", "index.html"));
});

app.listen(PORT, ()=>{
  console.log(`OpenBooks server running on http://localhost:${PORT}`);
});
