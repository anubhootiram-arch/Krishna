import { auth, db } from "./firebase-config.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// APP VARIABLES
let currentUser = null;
let currentProfile = null;
let blockedUsers = [];
let activeChatId = null;
let activePostId = null;

// HTML HELPER
function el(id) {
  return document.getElementById(id);
}

// MESSAGE
function showMessage(id, message) {
  const element = el(id);
  if (element) element.textContent = message;
}

// SAFE TEXT
function safeText(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

// SHOW APP
function showApp() {
  if (el("authSection")) el("authSection").style.display = "none";
  if (el("appSection")) el("appSection").style.display = "block";
}

// SHOW LOGIN
function showAuth() {
  if (el("authSection")) el("authSection").style.display = "block";
  if (el("appSection")) el("appSection").style.display = "none";
}

// SIGNUP
if (el("signupBtn")) {
  el("signupBtn").addEventListener("click", async () => {
    const email = el("email")?.value.trim();
    const password = el("password")?.value;

    if (!email || !password) {
      showMessage("authMessage", "Email aur password bhariye.");
      return;
    }

    try {
      const result = await createUserWithEmailAndPassword(
        auth, email, password
      );

      await setDoc(doc(db, "users", result.user.uid), {
        uid: result.user.uid,
        name: "New User",
        displayName: "New User",
        bio: "",
        photoURL: "",
        createdAt: serverTimestamp()
      });

      showMessage("authMessage", "Account ban gaya!");
    } catch (error) {
      showMessage("authMessage", error.message);
    }
  });
}

// LOGIN
if (el("loginBtn")) {
  el("loginBtn").addEventListener("click", async () => {
    const email = el("email")?.value.trim();
    const password = el("password")?.value;

    if (!email || !password) {
      showMessage("authMessage", "Email aur password bhariye.");
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
      showMessage("authMessage", "Login successful!");
    } catch (error) {
      showMessage("authMessage", error.message);
    }
  });
}

// LOGOUT
if (el("logoutBtn")) {
  el("logoutBtn").addEventListener("click", async () => {
    try {
      await signOut(auth);
    } catch (error) {
      alert(error.message);
    }
  });
}

// LOAD BLOCKED USERS
async function loadBlockedUsers() {
  if (!currentUser) return;

  try {
    const snapshot = await getDocs(
      collection(db, "blocks", currentUser.uid, "blocked")
    );

    blockedUsers = snapshot.docs.map(item => item.id);
  } catch (error) {
    console.error(error);
  }
}

// LOAD PROFILE
async function loadProfile() {
  if (!currentUser) return;

  try {
    const snapshot = await getDoc(doc(db, "users", currentUser.uid));

    currentProfile = snapshot.exists()
      ? snapshot.data()
      : { name: "New User", bio: "" };

    if (el("profileName"))
      el("profileName").textContent = currentProfile.name || "New User";

    if (el("profileBio"))
      el("profileBio").textContent = currentProfile.bio || "";

    if (el("editName"))
      el("editName").value = currentProfile.name || "";

    if (el("editBio"))
      el("editBio").value = currentProfile.bio || "";

  } catch (error) {
    console.error(error);
  }
}

// SAVE PROFILE
if (el("saveProfileBtn")) {
  el("saveProfileBtn").addEventListener("click", async () => {
    if (!currentUser) return;

    const name = el("editName")?.value.trim();
    const bio = el("editBio")?.value.trim();

    if (!name) {
      alert("Name bhariye.");
      return;
    }

    try {
      await updateDoc(doc(db, "users", currentUser.uid), {
        name,
        displayName: name,
        bio
      });

      await updateProfile(currentUser, {
        displayName: name
      });

      await loadProfile();
      alert("Profile save ho gaya!");
    } catch (error) {
      alert(error.message);
    }
  });
}
// CREATE POST
if (el("createPostBtn")) {
  el("createPostBtn").addEventListener("click", async () => {
    if (!currentUser) return;

    const text = el("captionInput")?.value.trim();

    if (!text) {
      alert("Post likhiye.");
      return;
    }

    try {
      await addDoc(collection(db, "posts"), {
        uid: currentUser.uid,
        name: currentProfile?.name || "User",
        text,
        likes: [],
        createdAt: serverTimestamp()
      });

      el("captionInput").value = "";
      await loadPosts();
      alert("Post publish ho gayi!");
    } catch (error) {
      alert(error.message);
    }
  });
}

// LOAD POSTS
async function loadPosts() {
  if (!currentUser || !el("feed")) return;

  try {
    const snapshot = await getDocs(collection(db, "posts"));

    const posts = snapshot.docs
      .map(item => ({ id: item.id, ...item.data() }))
      .filter(post => !blockedUsers.includes(post.uid));

    posts.sort((a, b) =>
      (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
    );

    el("feed").innerHTML = "";

    posts.forEach(post => {
      const card = document.createElement("div");
      card.className = "post-card";

      const name = document.createElement("h3");
      name.textContent = post.name || "User";

      const content = document.createElement("p");
      content.textContent = post.text || "";

      const likeBtn = document.createElement("button");
      const likes = post.likes || [];

      likeBtn.textContent =
        (likes.includes(currentUser.uid) ? "Unlike" : "Like") +
        " (" + likes.length + ")";

      likeBtn.addEventListener("click", () => {
        toggleLike(post.id, likes);
      });

      const commentBtn = document.createElement("button");
      commentBtn.textContent = "Comment";

      commentBtn.addEventListener("click", async () => {
        activePostId = post.id;
        await loadComments(post.id);
        el("commentInput")?.focus();
      });

      card.append(name, content, likeBtn, commentBtn);
      el("feed").appendChild(card);
    });

    if (posts.length === 0) {
      el("feed").textContent = "Abhi koi post nahi hai.";
    }
  } catch (error) {
    console.error("Posts error:", error);
  }
}

// LIKE AND UNLIKE
async function toggleLike(postId, oldLikes) {
  if (!currentUser) return;

  try {
    let likes = [...oldLikes];

    likes = likes.includes(currentUser.uid)
      ? likes.filter(uid => uid !== currentUser.uid)
      : [...likes, currentUser.uid];

    await updateDoc(doc(db, "posts", postId), { likes });
    await loadPosts();
  } catch (error) {
    alert(error.message);
  }
}

// LOAD COMMENTS
async function loadComments(postId) {
  if (!currentUser || !postId) return;

  const list = el("commentList");
  if (!list) return;

  try {
    const snapshot = await getDocs(
      collection(db, "posts", postId, "comments")
    );

    list.innerHTML = "";

    snapshot.forEach(item => {
      const comment = item.data();

      const box = document.createElement("div");
      box.className = "card";

      const name = document.createElement("strong");
      name.textContent = comment.name || "User";

      const text = document.createElement("p");
      text.textContent = comment.text || "";

      box.append(name, text);

      if (comment.uid === currentUser.uid) {
        const deleteBtn = document.createElement("button");
        deleteBtn.textContent = "Delete Comment";

        deleteBtn.addEventListener("click", async () => {
          if (!confirm("Apna comment delete karna chahte hain?")) return;

          try {
            await deleteDoc(
              doc(db, "posts", postId, "comments", item.id)
            );

            await loadComments(postId);
            alert("Comment delete ho gaya!");
          } catch (error) {
            alert(error.message);
          }
        });

        box.appendChild(deleteBtn);
      }

      list.appendChild(box);
    });

    if (snapshot.empty) {
      list.textContent = "Abhi koi comment nahi hai.";
    }
  } catch (error) {
    console.error(error);
    list.textContent = "Comments load nahi ho sake.";
  }
}

// SEND COMMENT
if (el("sendCommentBtn")) {
  el("sendCommentBtn").addEventListener("click", async () => {
    if (!currentUser || !activePostId) {
      alert("Pehle kisi post par Comment dabaiye.");
      return;
    }

    const text = el("commentInput")?.value.trim();

    if (!text) {
      alert("Comment likhiye.");
      return;
    }

    try {
      await addDoc(
        collection(db, "posts", activePostId, "comments"),
        {
          uid: currentUser.uid,
          name: currentProfile?.name || "User",
          text,
          createdAt: serverTimestamp()
        }
      );

      el("commentInput").value = "";
      await loadComments(activePostId);
      alert("Comment publish ho gaya!");
    } catch (error) {
      alert(error.message);
    }
  });
}

// SEARCH USERS
if (el("searchInput")) {
  el("searchInput").addEventListener("input", async () => {
    if (!currentUser) return;

    const searchText = el("searchInput").value.trim().toLowerCase();
    const results = el("searchResults");

    if (!results) return;
    results.innerHTML = "";

    if (!searchText) return;

    try {
      const snapshot = await getDocs(collection(db, "users"));

      snapshot.forEach(item => {
        const user = item.data();

        if (
          item.id !== currentUser.uid &&
          !blockedUsers.includes(item.id) &&
          (user.name || "").toLowerCase().includes(searchText)
        ) {
          const box = document.createElement("div");
          const name = document.createElement("p");
          name.textContent = user.name || "User";

          const blockBtn = document.createElement("button");
          blockBtn.textContent = "Block User";
          blockBtn.addEventListener("click", () => blockUser(item.id));

          const reportBtn = document.createElement("button");
          reportBtn.textContent = "Report User";
          reportBtn.addEventListener("click", () => reportUser(item.id));

          box.append(name, blockBtn, reportBtn);
          results.appendChild(box);
        }
      });

      if (!results.children.length) {
        results.textContent = "Koi user nahi mila.";
      }
    } catch (error) {
      results.textContent = error.message;
    }
  });
}
// BLOCK USER
async function blockUser(uid) {
  if (!currentUser || !uid) return;

  try {
    await setDoc(
      doc(db, "blocks", currentUser.uid, "blocked", uid),
      {
        uid,
        createdAt: serverTimestamp()
      }
    );

    await loadBlockedUsers();
    await loadPosts();
    alert("User block ho gaya.");
  } catch (error) {
    alert(error.message);
  }
}

// UNBLOCK USER
async function unblockUser(uid) {
  if (!currentUser || !uid) return;

  try {
    await deleteDoc(
      doc(db, "blocks", currentUser.uid, "blocked", uid)
    );

    await loadBlockedUsers();
    await loadPosts();
    await loadBlockedList();

    alert("User unblock ho gaya.");
  } catch (error) {
    alert(error.message);
  }
}

// REPORT USER
async function reportUser(uid) {
  if (!currentUser || !uid) return;

  const reason = prompt("Report karne ka reason likhiye:");

  if (!reason || !reason.trim()) return;

  try {
    await addDoc(collection(db, "reports"), {
      reporterUid: currentUser.uid,
      reportedUid: uid,
      reason: reason.trim(),
      createdAt: serverTimestamp()
    });

    alert("Report submit ho gayi.");
  } catch (error) {
    alert(error.message);
  }
}

// LOAD BLOCKED LIST
async function loadBlockedList() {
  if (!currentUser || !el("blockedUsersList")) return;

  await loadBlockedUsers();
  el("blockedUsersList").innerHTML = "";

  if (blockedUsers.length === 0) {
    el("blockedUsersList").textContent =
      "Koi blocked user nahi hai.";
    return;
  }

  blockedUsers.forEach(uid => {
    const box = document.createElement("div");
    const name = document.createElement("p");
    name.textContent = uid;

    const button = document.createElement("button");
    button.textContent = "Unblock";

    button.addEventListener("click", () => {
      unblockUser(uid);
    });

    box.append(name, button);
    el("blockedUsersList").appendChild(box);
  });
}

// BLOCKED USERS BUTTON
if (el("blockedUsersBtn")) {
  el("blockedUsersBtn").addEventListener("click", () => {
    loadBlockedList();
  });
}

// STORIES
async function loadStories() {
  if (!currentUser || !el("stories")) return;

  try {
    const snapshot = await getDocs(collection(db, "stories"));
    el("stories").innerHTML = "";

    snapshot.forEach(item => {
      const story = item.data();

      if (blockedUsers.includes(story.uid)) return;

      const box = document.createElement("div");
      const name = document.createElement("strong");
      const text = document.createElement("p");

      name.textContent = story.name || "User";
      text.textContent = story.text || "";

      box.append(name, text);
      el("stories").appendChild(box);
    });
  } catch (error) {
    console.error("Stories error:", error);
  }
}

// ADD STORY
if (el("addStoryBtn")) {
  el("addStoryBtn").addEventListener("click", async () => {
    if (!currentUser) return;

    const text = prompt("Apni story likhiye:");

    if (!text || !text.trim()) return;

    try {
      await addDoc(collection(db, "stories"), {
        uid: currentUser.uid,
        name: currentProfile?.name || "User",
        text: text.trim(),
        createdAt: serverTimestamp()
      });

      await loadStories();
      alert("Story add ho gayi!");
    } catch (error) {
      alert(error.message);
    }
  });
}

// LOAD CHAT USERS
async function loadChatUsers() {
  if (!currentUser || !el("chatUsers")) return;

  try {
    const snapshot = await getDocs(collection(db, "users"));
    el("chatUsers").innerHTML = "";

    snapshot.forEach(item => {
      if (
        item.id === currentUser.uid ||
        blockedUsers.includes(item.id)
      ) return;

      const user = item.data();
      const button = document.createElement("button");

      button.textContent = user.name || "User";

      button.addEventListener("click", async () => {
        const ids = [currentUser.uid, item.id].sort();
        activeChatId = ids.join("_");
        await loadMessages();
      });

      el("chatUsers").appendChild(button);
    });
  } catch (error) {
    console.error("Chat users error:", error);
  }
}

// LOAD MESSAGES
async function loadMessages() {
  if (!activeChatId || !el("messages")) return;

  try {
    const snapshot = await getDocs(
      collection(db, "chats", activeChatId, "messages")
    );

    el("messages").innerHTML = "";

    const messages = snapshot.docs.map(item => item.data());

    messages.sort((a, b) =>
      (a.createdAt?.seconds || 0) -
      (b.createdAt?.seconds || 0)
    );

    messages.forEach(message => {
      const box = document.createElement("p");

      box.textContent =
        (message.uid === currentUser.uid ? "You: " : "User: ") +
        (message.text || "");

      el("messages").appendChild(box);
    });
  } catch (error) {
    console.error("Messages error:", error);
  }
}

// SEND MESSAGE
if (el("sendMessageBtn")) {
  el("sendMessageBtn").addEventListener("click", async () => {
    if (!currentUser || !activeChatId) {
      alert("Pehle kisi user ko select kijiye.");
      return;
    }

    const text = el("messageInput")?.value.trim();
    if (!text) return;

    try {
      await addDoc(
        collection(db, "chats", activeChatId, "messages"),
        {
          uid: currentUser.uid,
          text,
          createdAt: serverTimestamp()
        }
      );

      el("messageInput").value = "";
      await loadMessages();
    } catch (error) {
      alert(error.message);
    }
  });
}

// ACCOUNT DELETION REQUEST
if (el("deleteAccountBtn")) {
  el("deleteAccountBtn").addEventListener("click", async () => {
    if (!currentUser) return;

    const confirmed = confirm(
      "Kya aap account deletion request bhejna chahte hain?"
    );

    if (!confirmed) return;

    try {
      await setDoc(
        doc(db, "accountDeletionRequests", currentUser.uid),
        {
          uid: currentUser.uid,
          requestedAt: serverTimestamp(),
          status: "pending"
        }
      );

      alert(
        "Request submit ho gayi. Account abhi delete nahi hua hai."
      );
    } catch (error) {
      alert(error.message);
    }
  });
}

// PRIVACY POLICY
if (el("privacyPolicyBtn")) {
  el("privacyPolicyBtn").addEventListener("click", () => {
    if (el("privacyPolicySection")) {
      el("privacyPolicySection").style.display = "block";
    }
  });
}

// TERMS AND CONDITIONS
if (el("termsBtn")) {
  el("termsBtn").addEventListener("click", () => {
    if (el("termsSection")) {
      el("termsSection").style.display = "block";
    }
  });
}

// BACK FROM PRIVACY
if (el("backFromPrivacyBtn")) {
  el("backFromPrivacyBtn").addEventListener("click", () => {
    if (el("privacyPolicySection")) {
      el("privacyPolicySection").style.display = "none";
    }
  });
}

// BACK FROM TERMS
if (el("backFromTermsBtn")) {
  el("backFromTermsBtn").addEventListener("click", () => {
    if (el("termsSection")) {
      el("termsSection").style.display = "none";
    }
  });
}

// NOTIFICATIONS PLACEHOLDER
if (el("notificationsBtn")) {
  el("notificationsBtn").addEventListener("click", () => {
    alert("Notifications feature abhi taiyar nahi hai.");
  });
}

// REELS PLACEHOLDER
if (el("reelsFeed")) {
  el("reelsFeed").textContent =
    "Reels feature abhi taiyar nahi hai.";
}

// DARK THEME
function applyTheme() {
  const savedTheme = localStorage.getItem("pkbaeTheme");

  document.body.classList.toggle(
    "dark-theme",
    savedTheme === "dark"
  );
}

if (el("themeBtn")) {
  el("themeBtn").addEventListener("click", () => {
    const isDark =
      document.body.classList.toggle("dark-theme");

    localStorage.setItem(
      "pkbaeTheme",
      isDark ? "dark" : "light"
    );
  });
}

applyTheme();

// DARK THEME STYLE
const themeStyle = document.createElement("style");

themeStyle.textContent = `
  body.dark-theme {
    background: #121212 !important;
    color: white !important;
  }

  body.dark-theme button,
  body.dark-theme input,
  body.dark-theme textarea,
  body.dark-theme .post-card,
  body.dark-theme .card {
    background: #252525 !important;
    color: white !important;
    border-color: #555 !important;
  }
`;

document.head.appendChild(themeStyle);

// LOAD APP DATA
async function loadAppData() {
  await loadBlockedUsers();
  await loadProfile();
  await loadPosts();
  await loadStories();
  await loadChatUsers();
}

// LOGIN STATE
onAuthStateChanged(auth, async user => {
  currentUser = user;

  if (user) {
    showApp();

    try {
      await loadAppData();
    } catch (error) {
      console.error("App loading error:", error);
    }
  } else {
    currentProfile = null;
    blockedUsers = [];
    activeChatId = null;
    activePostId = null;
    showAuth();
  }
});