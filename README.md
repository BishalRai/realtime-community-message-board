# 📋 Bulletin — Realtime Community Message Board

A dynamic, cloud-connected community message board built with vanilla JavaScript and Google Firebase. Users can post messages, like posts, and delete them — all in real time across every connected browser.

---

## 🌐 Live Demo

- **Primary:** https://cloud-sevices-week4.web.app
- **Alternate:** https://cloud-sevices-week4.firebaseapp.com

---

## ✨ Features

- 📡 **Real-time updates** — new posts appear instantly for all users via Firestore `onSnapshot()`
- ✍️ **Post messages** — up to 280 characters, with server-set timestamps
- ❤️ **Like posts** — atomic server-side counter increments (race-condition safe)
- 🗑️ **Delete posts** — removes from the cloud for everyone immediately
- 📊 **Live stats** — post count derived from the live Firestore stream
- 🔒 **Firestore security rules** — server-enforced validation on create/update/delete

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML, CSS, Vanilla JavaScript (ES Modules) |
| Database | Google Firebase Firestore (NoSQL, real-time) |
| Hosting | Firebase Hosting (CDN, HTTPS) |
| Auth | None (anonymous, rule-based access) |

---

## 📁 Project Structure

```
realtime-community-message-board/
├── index.html          # Main HTML shell
├── app.js              # Firebase logic — Firestore reads/writes
├── style.css           # Styling
├── firebase.json       # Firebase Hosting config
├── .firebaserc         # Firebase project alias
└── README.md
```

---

## ☁️ Firebase Operations

| Operation | Firestore API | Description |
|-----------|--------------|-------------|
| Stream posts | `onSnapshot()` | Pushes every DB change live to the UI |
| Create post | `addDoc()` + `serverTimestamp()` | Server sets the canonical timestamp |
| Delete post | `deleteDoc()` | Removes from cloud for all users |
| Like / Unlike | `updateDoc()` + `increment(±1)` | Atomic server-side counter |

---

## 🚀 Local Setup

### Prerequisites

- [Node.js](https://nodejs.org/) (v16 or later)
- A Google Firebase account

### 1. Clone the repository

```bash
git clone https://github.com/BishalRai/realtime-community-message-board.git
cd realtime-community-message-board
```

### 2. Install Firebase CLI

```bash
npm install -g firebase-tools
```

### 3. Log in to Firebase

```bash
firebase login
```

### 4. Open locally

Just open `index.html` directly in a browser — no build step required. It connects to the live Firestore database immediately.

---

## 🔥 Firestore Security Rules

Go to **Firebase Console → Firestore Database → Rules** and publish the following:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /posts/{postId} {
      allow read: if true;
      allow create: if request.resource.data.text.size() <= 280;
      allow delete: if true;
      allow update: if request.resource.data.keys().hasAll(['likes'])
                    && request.resource.data.size() == resource.data.size();
    }
  }
}
```

---

## 📦 Deployment

### First-time deploy

```bash
firebase init hosting
# Public directory: .
# Single-page app: No
# GitHub auto-deploy: No
# Overwrite index.html: No

firebase deploy --only hosting
```

### Subsequent deploys

```bash
firebase deploy --only hosting
```

The site updates globally in ~30 seconds.

---

## 📄 License

MIT — free to use and modify.
