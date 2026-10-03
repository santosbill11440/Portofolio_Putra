import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
    sendEmailVerification, sendPasswordResetEmail, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
    getFirestore, doc, setDoc, getDoc, getDocs, addDoc, collection,
    query, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "ISI_API_KEY",
    authDomain: "ISI.firebaseapp.com",
    projectId: "ISI",
    appId: "ISI"
};

const cloudReady = !firebaseConfig.apiKey.startsWith("ISI");
let auth, db;
if (cloudReady) {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
}

const $ = id => document.getElementById(id);
let currentUser = null;
const canUseCloud = () => cloudReady && currentUser && currentUser.emailVerified;

const drawer = $("drawer"), overlay = $("overlay");
const pages = document.querySelectorAll(".page");
const navItems = document.querySelectorAll(".nav-item");

function closeAll() {
    drawer.classList.remove("open");
    document.querySelectorAll(".modal").forEach(m => m.classList.remove("show"));
    overlay.classList.remove("show");
}
function openDrawer() { drawer.classList.add("open"); overlay.classList.add("show"); }
function openModal(id) { closeAll(); $(id).classList.add("show"); overlay.classList.add("show"); }
function showPage(id) {
    pages.forEach(p => p.classList.toggle("active", p.id === id));
    navItems.forEach(n => n.classList.toggle("active", n.dataset.page === id));
    closeAll();
    window.scrollTo({ top: 0, behavior: "smooth" });
}

$("menuBtn").onclick = openDrawer;
$("closeBtn").onclick = closeAll;
overlay.onclick = closeAll;
document.querySelectorAll("[data-close]").forEach(b => b.onclick = closeAll);
document.addEventListener("keydown", e => { if (e.key === "Escape") closeAll(); });
navItems.forEach(n => n.onclick = () => showPage(n.dataset.page));
document.querySelectorAll("[data-goto]").forEach(b => b.onclick = () => showPage(b.dataset.goto));

$("authBtn").onclick = () => { renderAuth(); openModal("authModal"); };
$("reportBtn").onclick = () => { openModal("reportModal"); loadReports(); };
$("settingsLoginBtn").onclick = () => { renderAuth(); openModal("authModal"); };
$("settingsReportBtn").onclick = () => { openModal("reportModal"); loadReports(); };

function authMsg(t) { $("authMsg").textContent = t; }
function friendlyError(e) {
    const map = {
        "auth/email-already-in-use": "Email sudah terdaftar, silakan Masuk.",
        "auth/invalid-email": "Format email tidak valid.",
        "auth/weak-password": "Kata sandi minimal 6 karakter.",
        "auth/invalid-credential": "Email atau kata sandi salah.",
        "auth/too-many-requests": "Terlalu banyak percobaan, silakan tunggu."
    };
    return map[e.code] || "Terjadi kesalahan: " + e.code;
}

function renderAuth() {
    authMsg("");
    const accEl = $("settingsAccStatus");
    if (!cloudReady) {
        $("authForm").hidden = false; $("authAccount").hidden = true;
        authMsg("Firebase belum dikonfigurasi.");
        accEl.textContent = "Firebase belum dikonfigurasi";
        return;
    }
    $("authForm").hidden = !!currentUser;
    $("authAccount").hidden = !currentUser;
    $("authBtn").textContent = currentUser ? "Akun" : "Masuk";
    if (currentUser) {
        $("accEmail").textContent = currentUser.email;
        $("accStatus").textContent = currentUser.emailVerified
            ? "Email terverifikasi"
            : "Belum terverifikasi. Silakan cek email Anda.";
        accEl.textContent = currentUser.emailVerified
            ? `Masuk sebagai ${currentUser.email}`
            : `Masuk sebagai ${currentUser.email} (belum verifikasi)`;
    } else {
        accEl.textContent = "Belum masuk";
    }
}

$("registerBtn").onclick = async () => {
    if (!cloudReady) return renderAuth();
    try {
        const cred = await createUserWithEmailAndPassword(auth, $("email").value.trim(), $("password").value);
        await sendEmailVerification(cred.user);
        authMsg("Akun berhasil dibuat. Tautan verifikasi telah dikirim ke email Anda.");
    } catch (e) { authMsg(friendlyError(e)); }
};
$("loginBtn").onclick = async () => {
    if (!cloudReady) return renderAuth();
    try {
        await signInWithEmailAndPassword(auth, $("email").value.trim(), $("password").value);
    } catch (e) { authMsg(friendlyError(e)); }
};
$("resetBtn").onclick = async () => {
    if (!cloudReady) return renderAuth();
    try {
        await sendPasswordResetEmail(auth, $("email").value.trim());
        authMsg("Tautan atur ulang kata sandi telah dikirim.");
    } catch (e) { authMsg(friendlyError(e)); }
};
$("resendBtn").onclick = async () => {
    try { await sendEmailVerification(currentUser); authMsg("Email verifikasi dikirim ulang."); }
    catch (e) { authMsg(friendlyError(e)); }
};
$("checkBtn").onclick = async () => {
    await currentUser.reload();
    currentUser = auth.currentUser;
    renderAuth();
    loadUserRating(); loadReports();
};
$("logoutBtn").onclick = () => signOut(auth);

if (cloudReady) {
    onAuthStateChanged(auth, user => {
        currentUser = user;
        renderAuth();
        loadUserRating(); loadReports(); loadRatingSummary(); loadProfileName();
    });
} else {
    loadProfileName();
}

async function loadProfileName() {
    if (canUseCloud()) {
        const snap = await getDoc(doc(db, "profiles", currentUser.uid));
        $("displayName").value = snap.exists() ? (snap.data().name || "") : "";
    } else {
        $("displayName").value = localStorage.getItem("guestName") || "";
    }
}
$("saveProfile").onclick = async () => {
    const name = $("displayName").value.trim();
    const msg = $("profileMsg");
    if (!name) { msg.textContent = "Silakan isi nama terlebih dahulu."; return; }
    try {
        if (canUseCloud()) {
            await setDoc(doc(db, "profiles", currentUser.uid), { name, updatedAt: serverTimestamp() });
            msg.textContent = "Profil tersimpan di akun Anda.";
        } else {
            localStorage.setItem("guestName", name);
            msg.textContent = "Tersimpan lokal. Masuk dengan akun terverifikasi agar tersimpan permanen.";
        }
    } catch (e) { msg.textContent = "Gagal menyimpan: " + e.code; }
};

let selected = 0;
const starBtns = document.querySelectorAll("#stars button");
function paintStars() { starBtns.forEach(b => b.classList.toggle("on", Number(b.dataset.v) <= selected)); }
starBtns.forEach(b => b.onclick = () => { selected = Number(b.dataset.v); paintStars(); });

async function loadUserRating() {
    if (canUseCloud()) {
        const snap = await getDoc(doc(db, "ratings", currentUser.uid));
        if (snap.exists()) { selected = snap.data().value; $("ratingComment").value = snap.data().comment || ""; }
    } else {
        const local = JSON.parse(localStorage.getItem("guestRating") || "null");
        if (local) { selected = local.value; $("ratingComment").value = local.comment || ""; }
    }
    paintStars();
}
$("ratingSubmit").onclick = async () => {
    const msg = $("ratingMsg");
    if (!selected) { msg.textContent = "Silakan pilih bintang terlebih dahulu."; return; }
    const data = { value: selected, comment: $("ratingComment").value.trim() };
    try {
        if (canUseCloud()) {
            await setDoc(doc(db, "ratings", currentUser.uid), { ...data, email: currentUser.email, updatedAt: serverTimestamp() });
            msg.textContent = "Terima kasih, penilaian tersimpan di akun Anda.";
        } else {
            localStorage.setItem("guestRating", JSON.stringify(data));
            msg.textContent = "Tersimpan lokal. Masuk dengan akun terverifikasi agar tersimpan permanen.";
        }
        loadRatingSummary();
    } catch (e) { msg.textContent = "Gagal menyimpan: " + e.code; }
};
async function loadRatingSummary() {
    const el = $("ratingSummary");
    if (!cloudReady) { el.textContent = ""; return; }
    try {
        const snap = await getDocs(collection(db, "ratings"));
        if (snap.empty) { el.textContent = "Belum ada penilaian."; return; }
        let sum = 0; snap.forEach(d => sum += d.data().value);
        el.textContent = `Rata-rata ${(sum / snap.size).toFixed(1)} dari 5, berdasarkan ${snap.size} pengguna`;
    } catch { el.textContent = ""; }
}

const esc = s => s.replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));

$("reportSubmit").onclick = async () => {
    const text = $("reportText").value.trim();
    const msg = $("reportMsg");
    if (!text) { msg.textContent = "Silakan isi laporan terlebih dahulu."; return; }
    const data = { type: $("reportType").value, text };
    try {
        if (canUseCloud()) {
            await addDoc(collection(db, "reports"), { ...data, uid: currentUser.uid, email: currentUser.email, createdAt: serverTimestamp() });
            msg.textContent = "Laporan terkirim ke akun Anda.";
        } else {
            const list = JSON.parse(localStorage.getItem("guestReports") || "[]");
            list.unshift({ ...data, createdAt: Date.now() });
            localStorage.setItem("guestReports", JSON.stringify(list));
            msg.textContent = "Tersimpan lokal (belum masuk/terverifikasi).";
        }
        $("reportText").value = "";
        loadReports();
    } catch (e) { msg.textContent = "Gagal mengirim: " + e.code; }
};
async function loadReports() {
    const ul = $("reportList");
    let items = [];
    try {
        if (canUseCloud()) {
            const snap = await getDocs(query(collection(db, "reports"), where("uid", "==", currentUser.uid)));
            snap.forEach(d => { const x = d.data(); items.push({ ...x, createdAt: x.createdAt ? x.createdAt.toMillis() : Date.now() }); });
        } else {
            items = JSON.parse(localStorage.getItem("guestReports") || "[]");
        }
    } catch {}
    items.sort((a, b) => b.createdAt - a.createdAt);
    ul.innerHTML = items.length
        ? items.map(i => `<li><b>${esc(i.type)}</b>: ${esc(i.text)}<small>${new Date(i.createdAt).toLocaleString("id-ID")}</small></li>`).join("")
        : "<li>Belum ada laporan.</li>";
}

$("clearLocalBtn").onclick = () => {
    ["guestRating", "guestReports", "guestName"].forEach(k => localStorage.removeItem(k));
    $("clearMsg").textContent = "Data lokal telah dihapus.";
};

loadUserRating();
loadReports();
loadRatingSummary();