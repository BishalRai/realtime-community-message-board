/**
 * Bulletin — Live Community Board
 * Real-time Firebase Firestore integration
 *
 * Firestore security rules needed (paste in Firebase Console → Firestore → Rules):
 * ─────────────────────────────────────────────────────────────
 * rules_version = '2';
 * service cloud.firestore {
 *   match /databases/{database}/documents {
 *     match /posts/{postId} {
 *       allow read: if true;
 *       allow create: if request.resource.data.text.size() <= 280;
 *       allow delete: if true;
 *       allow update: if request.resource.data.keys().hasAll(['likes']) && request.resource.data.size() == resource.data.size();
 *     }
 *   }
 * }
 * ─────────────────────────────────────────────────────────────
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
  updateDoc,
  increment
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

// ── Firebase config ─────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyAnSGl8BMrWsb-9vX9mmU_jA6EK-R1R3Oc",
  authDomain:        "cloud-sevices-week4.firebaseapp.com",
  projectId:         "cloud-sevices-week4",
  storageBucket:     "cloud-sevices-week4.firebasestorage.app",
  messagingSenderId: "614333121051",
  appId:             "1:614333121051:web:d7fe8d85cf914bbe1daebe"
};

const _app = initializeApp(firebaseConfig);
let db = getFirestore(_app);
let unsubscribe = null;
let allPosts    = [];
let activeFilter = "all";
let activeSort = "new";
let selectedTag = "general";
const likedPosts = new Set(JSON.parse(localStorage.getItem("likedPosts") || "[]"));

// ── Helpers ─────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const avatarColors = [
  ["#fde8d8","#c84b1f"], ["#d8e8fd","#1f5ec8"], ["#d8fde8","#1fc84b"],
  ["#fdd8fd","#c81fc8"], ["#fdfdd8","#c8c81f"], ["#d8fdfd","#1fc8c8"]
];
function getAvatarColor(name) {
  let h = 0;
  for (let c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return avatarColors[h % avatarColors.length];
}
function initials(name) {
  return name.split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase();
}
function timeAgo(ts) {
  if (!ts) return "just now";
  const secs = Math.floor((Date.now() - ts.toMillis()) / 1000);
  if (secs < 10) return "just now";
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs/60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs/3600)}h ago`;
  return ts.toDate().toLocaleDateString("en-GB", { day:"numeric", month:"short" });
}

function showToast(msg, duration = 2400) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), duration);
}

function setLive(state) {
  const dot = document.querySelector(".live-dot");
  const lbl = $("liveLabel");
  dot.classList.remove("on","err");
  if (state === "on")  { dot.classList.add("on");  lbl.textContent = "live"; }
  if (state === "err") { dot.classList.add("err"); lbl.textContent = "error"; }
  if (state === "wait"){ lbl.textContent = "connecting…"; }
}

// ── Render ──────────────────────────────────────────────────────
function renderPosts(posts, flash = null) {
  const board = $("board");
  const skel  = $("skeleton");
  if (skel) skel.remove();

  let filtered = activeFilter === "all"
    ? posts
    : posts.filter(p => p.tag === activeFilter);

  if (activeSort === "old") filtered = [...filtered].reverse();

  if (filtered.length === 0) {
    board.innerHTML = `<p class="empty-state">No messages yet — be the first.</p>`;
    return;
  }

  board.innerHTML = filtered.map(p => {
    const [bgC, fgC] = getAvatarColor(p.name || "A");
    const isLiked = likedPosts.has(p.id);
    return `
    <article class="post-card${p.id === flash ? " new-flash" : ""}" data-id="${p.id}">
      <div class="card-top">
        <div class="author-row">
          <div class="avatar" style="background:${bgC};color:${fgC}">${initials(p.name || "Anon")}</div>
          <div>
            <div class="author-name">${escHtml(p.name || "Anonymous")}</div>
            <div class="post-time">${timeAgo(p.createdAt)}</div>
          </div>
        </div>
        <div class="card-actions">
          <span class="tag-pill ${p.tag || "general"}">${p.tag || "general"}</span>
          <button class="delete-btn" data-id="${p.id}" title="Delete">✕</button>
        </div>
      </div>
      <div class="card-body">${escHtml(p.text)}</div>
      <div class="card-footer">
        <button class="like-btn${isLiked ? " liked" : ""}" data-id="${p.id}">
          <span class="like-icon">${isLiked ? "♥" : "♡"}</span>
          <span>${p.likes || 0}</span>
        </button>
        <span class="post-id">#${p.id.slice(0,6)}</span>
      </div>
    </article>`;
  }).join("");

  // Bind buttons
  board.querySelectorAll(".delete-btn").forEach(btn => {
    btn.addEventListener("click", () => deletePost(btn.dataset.id));
  });
  board.querySelectorAll(".like-btn").forEach(btn => {
    btn.addEventListener("click", () => toggleLike(btn.dataset.id));
  });
}

function escHtml(str) {
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function updateStats(posts) {
  // Today's posts
  const midnight = new Date(); midnight.setHours(0,0,0,0);
  const todayPosts = posts.filter(p => p.createdAt && p.createdAt.toMillis() >= midnight.getTime());
  $("totalPosts").textContent = todayPosts.length;

  // Unique authors
  const authors = new Set(posts.map(p => p.name).filter(Boolean));
  $("totalAuthors").textContent = authors.size;

  // Top tag
  const tagCount = {};
  posts.forEach(p => { if (p.tag) tagCount[p.tag] = (tagCount[p.tag] || 0) + 1; });
  const topTag = Object.entries(tagCount).sort((a,b) => b[1]-a[1])[0];
  $("latestTag").textContent = topTag ? topTag[0] : "—";
}

// ── Firestore ops ────────────────────────────────────────────────
async function addPost() {
  const name = $("nameInput").value.trim() || "Anonymous";
  const text = $("msgInput").value.trim();
  const err  = $("composeError");

  if (!text) { err.textContent = "Message cannot be empty."; return; }
  if (text.length > 280) { err.textContent = "Too long (max 280 chars)."; return; }
  err.textContent = "";

  const btn = $("postBtn");
  btn.classList.add("loading");
  btn.querySelector(".btn-text").textContent = "Posting…";

  try {
    const ref = await addDoc(collection(db, "posts"), {
      name,
      text,
      tag: selectedTag,
      likes: 0,
      createdAt: serverTimestamp()
    });
    $("msgInput").value = "";
    $("charCount").textContent = "0 / 280";
    showToast("Posted ✓");
    // Flash the new card when it arrives
    window.__pendingFlash = ref.id;
  } catch (e) {
    err.textContent = "Error posting: " + e.message;
  } finally {
    btn.classList.remove("loading");
    btn.querySelector(".btn-text").textContent = "Post";
  }
}

async function deletePost(id) {
  try {
    await deleteDoc(doc(db, "posts", id));
    showToast("Deleted");
  } catch(e) {
    showToast("Could not delete: " + e.message);
  }
}

async function toggleLike(id) {
  const post = allPosts.find(p => p.id === id);
  if (!post) return;

  if (likedPosts.has(id)) {
    likedPosts.delete(id);
    await updateDoc(doc(db, "posts", id), { likes: increment(-1) });
  } else {
    likedPosts.add(id);
    await updateDoc(doc(db, "posts", id), { likes: increment(1) });
  }
  localStorage.setItem("likedPosts", JSON.stringify([...likedPosts]));
}

// ── Real-time listener ───────────────────────────────────────────
function startListening() {
  const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));

  unsubscribe = onSnapshot(q, (snapshot) => {
    setLive("on");
    allPosts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    const flash = window.__pendingFlash || null;
    window.__pendingFlash = null;

    renderPosts(allPosts, flash);
    updateStats(allPosts);
  }, (err) => {
    console.error("Snapshot error:", err);
    setLive("err");
    showToast("Connection lost. Refresh to reconnect.");
  });
}



// ── UI wiring ────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  // Post button
  $("postBtn").addEventListener("click", addPost);

  // Enter to post (Ctrl/Cmd+Enter in textarea)
  $("msgInput").addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") addPost();
  });

  // Char count
  $("msgInput").addEventListener("input", () => {
    const len = $("msgInput").value.length;
    $("charCount").textContent = `${len} / 280`;
    $("charCount").style.color = len > 260 ? "var(--tag-alert)" : "";
  });

  // Tag selection
  document.querySelectorAll(".tag-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tag-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      selectedTag = btn.dataset.tag;
    });
  });

  // Filter
  document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeFilter = btn.dataset.filter;
      renderPosts(allPosts);
    });
  });

  // Sort
  $("sortSelect").addEventListener("change", e => {
    activeSort = e.target.value;
    renderPosts(allPosts);
  });

  // Auto-refresh time labels every 30s
  setInterval(() => {
    document.querySelectorAll(".post-time").forEach((el, i) => {
      const post = allPosts[i];
      if (post) el.textContent = timeAgo(post.createdAt);
    });
  }, 30_000);

  startListening();
});
