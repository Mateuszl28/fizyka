// Konta uczniów i nauczycieli + zapisywanie postępu (Firebase Auth + Firestore).
// Używane przez: stronę główną (index.html), panel nauczyciela (panel.html) i prezentacje.
import { FIREBASE_CONFIG } from './firebase-config.js';

const V = '10.12.2';
const DOMENA = 'uczniowie.fizyka.invalid'; // sztuczna domena: uczniowie nie podają adresu e-mail
export const HUB = 'https://mateuszl28.github.io/fizyka/';
export const configured = !!(FIREBASE_CONFIG && FIREBASE_CONFIG.apiKey && !/^WKLEJ/.test(FIREBASE_CONFIG.apiKey));

let fb = null;
async function load(){
  if (!configured) throw new Error('Logowanie nie jest jeszcze skonfigurowane.');
  if (fb) return fb;
  const [appM, A, F] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`)]);
  const app = appM.initializeApp(FIREBASE_CONFIG);
  fb = {A, F, auth:A.getAuth(app), db:F.getFirestore(app)};
  return fb;
}

/* ---------- pomocnicze ---------- */
export const czyscLogin = s => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/\s+/g, '.');
export const czyscKod = s => s.trim().toUpperCase().replace(/\s+/g, '');
const email = (kod, login) => `${login}--${kod.toLowerCase()}@${DOMENA}`;
const BLEDY = {
  'auth/email-already-in-use':'Taki login jest już zajęty w tej klasie. Wybierz inny.',
  'auth/invalid-credential':'Nieprawidłowe dane logowania. Sprawdź kod klasy, login i hasło.',
  'auth/wrong-password':'Nieprawidłowe hasło.',
  'auth/user-not-found':'Nie ma takiego konta. Sprawdź kod klasy i login.',
  'auth/weak-password':'Hasło musi mieć co najmniej 6 znaków.',
  'auth/invalid-email':'Nieprawidłowy login albo adres e-mail.',
  'auth/too-many-requests':'Zbyt wiele prób. Odczekaj chwilę i spróbuj ponownie.',
  'auth/network-request-failed':'Brak połączenia z internetem.',
  'permission-denied':'Brak uprawnień do tej operacji.'
};
export const komunikat = e => BLEDY[e && e.code] || (e && e.message) || 'Coś poszło nie tak. Spróbuj ponownie.';

/* ---------- konto ---------- */
let profil = null;
export const aktualnyProfil = () => profil;

async function wczytajProfil(uid){
  const {F, db} = fb;
  const u = await F.getDoc(F.doc(db, 'users', uid));
  if (u.exists()) return {uid, ...u.data()};
  const t = await F.getDoc(F.doc(db, 'teachers', uid));
  if (t.exists()) return {uid, ...t.data()};
  return {uid, role:'unknown'};
}

export async function naZmianeKonta(cb){
  if (!configured) { cb(null); return; }
  const {A, auth} = await load();
  A.onAuthStateChanged(auth, async u => {
    if (!u) { profil = null; cache = null; cb(null); return; }
    try { profil = await wczytajProfil(u.uid); } catch(e) { profil = {uid:u.uid, role:'unknown'}; }
    cb(profil);
  });
}

export async function zarejestrujUcznia(kod, login, haslo){
  kod = czyscKod(kod); login = czyscLogin(login);
  if (!/^[A-Z0-9-]{3,16}$/.test(kod)) throw new Error('Kod klasy ma 3–16 znaków: litery, cyfry i myślniki.');
  if (!/^[a-z0-9._-]{3,24}$/.test(login)) throw new Error('Login ma 3–24 znaki: litery bez polskich znaków, cyfry, kropki i myślniki.');
  const {A, F, auth, db} = await load();
  const kl = await F.getDoc(F.doc(db, 'classes', kod));
  if (!kl.exists()) throw new Error('Nie ma klasy o takim kodzie. Zapytaj nauczyciela o kod.');
  const {teacherUid, name} = kl.data();
  const cred = await A.createUserWithEmailAndPassword(auth, email(kod, login), haslo);
  const uid = cred.user.uid;
  await F.setDoc(F.doc(db, 'users', uid), {role:'student', login, classCode:kod, className:name || kod, teacherUid, createdAt:F.serverTimestamp()});
  await F.setDoc(F.doc(db, 'progress', uid), {uid, login, classCode:kod, teacherUid, decks:{}, updatedAt:F.serverTimestamp()}, {merge:true});
  profil = await wczytajProfil(uid);
  return profil;
}

export async function zalogujUcznia(kod, login, haslo){
  kod = czyscKod(kod); login = czyscLogin(login);
  const {A, auth} = await load();
  await A.signInWithEmailAndPassword(auth, email(kod, login), haslo);
}

export async function zarejestrujNauczyciela(adres, haslo, imie){
  const {A, F, auth, db} = await load();
  const cred = await A.createUserWithEmailAndPassword(auth, adres.trim(), haslo);
  await F.setDoc(F.doc(db, 'teachers', cred.user.uid), {role:'teacher', name:imie.trim(), email:adres.trim(), createdAt:F.serverTimestamp()});
  profil = await wczytajProfil(cred.user.uid);
  return profil;
}

export async function zalogujNauczyciela(adres, haslo){
  const {A, auth} = await load();
  await A.signInWithEmailAndPassword(auth, adres.trim(), haslo);
}

export async function resetHaslaNauczyciela(adres){
  const {A, auth} = await load();
  await A.sendPasswordResetEmail(auth, adres.trim());
}

export async function wyloguj(){ const {A, auth} = await load(); await A.signOut(auth); }

/* ---------- postęp ucznia ---------- */
let cache = null;
export async function mojPostep(){
  if (!profil || profil.role !== 'student') return null;
  const {F, db} = await load();
  const d = await F.getDoc(F.doc(db, 'progress', profil.uid));
  cache = d.exists() ? d.data() : {decks:{}};
  return cache;
}

const sesja = {};
export async function zapisz(deck, ev){
  if (!profil || profil.role !== 'student') return;
  const {F, db} = await load();
  if (!cache) await mojPostep();
  const stare = (cache.decks && cache.decks[deck]) || {};
  const d = {lastSeen:F.serverTimestamp()};
  let tdiff = 0;
  if (ev.type === 'wyzwanie') { d.wyzwania = F.arrayUnion(ev.id); d.wyzwaniaTotal = ev.total; }
  else if (ev.type === 'quiz') {
    d.quizLast = ev.score; d.quizAnswered = ev.answered; d.quizTotal = ev.total;
    if (ev.answered === ev.total && ev.score > (stare.quizBest ?? -1)) d.quizBest = ev.score;
  }
  else if (ev.type === 'trening') {
    tdiff = ev.good - (sesja[deck] || 0); sesja[deck] = ev.good;
    if (tdiff > 0) d.treningPoprawne = F.increment(tdiff);
    if (ev.best > (stare.treningBest || 0)) d.treningBest = ev.best;
  }
  else if (ev.type === 'krzyzowka') d.krzyzowka = true;
  else if (ev.type === 'gra') { d.gra = true; if (ev.mistakes < (stare.graBledy ?? 999)) d.graBledy = ev.mistakes; }
  else return;
  await F.setDoc(F.doc(db, 'progress', profil.uid), {uid:profil.uid, login:profil.login, classCode:profil.classCode, teacherUid:profil.teacherUid, updatedAt:F.serverTimestamp(), decks:{[deck]:d}}, {merge:true});
  const n = cache.decks[deck] = cache.decks[deck] || {};
  if (ev.type === 'wyzwanie') { n.wyzwania = [...new Set([...(n.wyzwania || []), ev.id])]; n.wyzwaniaTotal = ev.total; }
  ['quizLast', 'quizAnswered', 'quizTotal', 'quizBest', 'treningBest', 'krzyzowka', 'gra', 'graBledy'].forEach(k => { if (k in d) n[k] = d[k]; });
  if (tdiff > 0) n.treningPoprawne = (n.treningPoprawne || 0) + tdiff;
}

/* ---------- nauczyciel ---------- */
const losowe = n => Array.from({length:n}, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random()*32)]).join('');
export async function utworzKlase(nazwa){
  const {F, db} = await load();
  const pref = czyscKod(nazwa).replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'KL';
  for (let i = 0; i < 6; i++) {
    const kod = `${pref}-${losowe(4)}`;
    const ref = F.doc(db, 'classes', kod);
    if ((await F.getDoc(ref)).exists()) continue;
    await F.setDoc(ref, {name:nazwa.trim(), teacherUid:profil.uid, createdAt:F.serverTimestamp()});
    return kod;
  }
  throw new Error('Nie udało się wygenerować kodu klasy. Spróbuj ponownie.');
}
export async function mojeKlasy(){
  const {F, db} = await load();
  const q = F.query(F.collection(db, 'classes'), F.where('teacherUid', '==', profil.uid));
  return (await F.getDocs(q)).docs.map(d => ({kod:d.id, ...d.data()})).sort((a, b) => a.name.localeCompare(b.name, 'pl'));
}
export async function usunKlase(kod){ const {F, db} = await load(); await F.deleteDoc(F.doc(db, 'classes', kod)); }
export async function uczniowieKlasy(kod){
  const {F, db} = await load();
  const q = F.query(F.collection(db, 'progress'), F.where('teacherUid', '==', profil.uid), F.where('classCode', '==', kod));
  return (await F.getDocs(q)).docs.map(d => d.data()).sort((a, b) => a.login.localeCompare(b.login, 'pl'));
}
export async function usunUcznia(uid){
  const {F, db} = await load();
  await F.deleteDoc(F.doc(db, 'progress', uid));
  await F.deleteDoc(F.doc(db, 'users', uid));
}

/* ---------- integracja z prezentacją ---------- */
if (typeof window !== 'undefined' && window.FIZYKA_DECK && configured) {
  const deck = window.FIZYKA_DECK;
  const st = document.createElement('style');
  st.textContent = '.fz-konto{font:600 12px var(--f-body,system-ui);padding:5px 10px;border-radius:999px;border:1px solid var(--line,#ccd);color:var(--ink,#123);text-decoration:none;white-space:nowrap;display:inline-flex;align-items:center;gap:6px}.fz-konto i{width:7px;height:7px;border-radius:50%;background:var(--muted,#888)}.fz-konto.on i{background:var(--good,#2a8)}';
  document.head.appendChild(st);
  const a = document.createElement('a'); a.className = 'fz-konto'; a.href = HUB + '#konto'; a.innerHTML = '<i></i><span>Zaloguj się, by zapisywać wyniki</span>';
  const host = document.querySelector('.topr'); if (host) host.prepend(a);
  window.addEventListener('fizyka:postep', e => { if (profil && profil.role === 'student') zapisz(deck, e.detail).catch(console.error); });
  naZmianeKonta(async p => {
    if (p && p.role === 'student') {
      a.classList.add('on'); a.querySelector('span').textContent = `${p.login} · zapisuję postęp`; a.title = 'Klasa ' + p.classCode;
      try { const pr = await mojPostep(); const w = (pr.decks && pr.decks[deck] && pr.decks[deck].wyzwania) || []; window.dispatchEvent(new CustomEvent('fizyka:przywroc', {detail:{wyzwania:w}})); } catch(e) { console.error(e); }
    } else if (p && p.role === 'teacher') { a.classList.add('on'); a.querySelector('span').textContent = 'nauczyciel: ' + (p.name || p.email); a.href = HUB + 'panel.html'; }
    else { a.classList.remove('on'); a.querySelector('span').textContent = 'Zaloguj się, by zapisywać wyniki'; a.href = HUB + '#konto'; }
  }).catch(console.error);
}
