/* ===== الرسم والتوجيه والأحداث وقارئ PDF والتشغيل ===== */
const route = () => location.hash || "#/";

function routeView(h){
  if(h.startsWith("#/s/")) return subjectView(decodeURIComponent(h.slice(4)));

  // رابط مباشر وثابت للمحاضرة داخل التطبيق.
  if(h.startsWith("#/lecture/")){
    return `<div class="empty">جارٍ فتح المحاضرة…</div>`;
  }

  if(me){
    if(h === "#/me") return dashView();
    if(h === "#/notes") return notesView();
    if(h.startsWith("#/note/")) return noteView(h.slice(7));
    if(h === "#/notifs") return notifsView();
    if(h === "#/profile") return profileView();
  }

  if(h === "#/schedule") return scheduleView();
  if(h === "#/news") return newsView();
  if(h === "#/quizzes") return quizzesView();
  if(h.startsWith("#/quiz/")) return quizView(h.slice(7));

  return homeView();
}

function renderChrome(h){
  const nav = $("#nav"), hic = $("#hic");
  const on = ready && session && !pendingCode && !h.startsWith("#/admin");

  if(!on){
    nav.style.display = "none";
    document.body.classList.remove("hasnav");
    hic.innerHTML = "";
    return;
  }

  const items = me
    ? [["#/","🏠","المكتبة"],["#/me","📊","متابعتي"],["#/schedule","🗓","الجدول"],["#/news","📢","الإعلانات"],["#/profile","👤","حسابي"],["#/quizzes","📝","الاختبارات"]]
    : [["#/","🏠","المكتبة"],["#/schedule","🗓","الجدول"],["#/news","📢","الإعلانات"],["#/admin","⚙️","الإدارة"]];

  const active = x =>
    x === "#/"
      ? (h === "#/" || h.startsWith("#/s/"))
      : (h === x || h.startsWith(x + "/"));

  nav.innerHTML = items
    .map(([href, ic, t]) =>
      `<a href="${href}" class="${active(href)?"on":""}"><b>${ic}</b>${t}</a>`
    ).join("");

  nav.style.display = "flex";
  document.body.classList.add("hasnav");

  const u = me ? unreadCount() : 0;

  hic.innerHTML = me
    ? `<a href="#/notes" title="ملاحظاتي">📝</a><a href="#/notifs" title="الإشعارات">🔔${u ? `<span class="badge">${u}</span>` : ""}</a>`
    : "";
}

function render(){
  const h = route(), fa = document.activeElement;
  const fid = fa && ["q","nq","aq"].includes(fa.id) ? fa.id : null;
  const pos = fid ? fa.selectionStart : 0;

  let html;

  if(!ready) html = loadingView();
  else if(pendingCode) html = codeView();
  else if(!session && !h.startsWith("#/admin")) html = authView();
  else if(h.startsWith("#/admin")) html = adminView();
  else if(loadError){
    html = `<div class="empty">${esc(loadError)}<p><button class="btn" data-act="retry">إعادة المحاولة</button></p></div>`;
  }
  else if(session && !isAdmin && !me){
    html = adminErr
      ? `<div class="empty">تعذر تحميل حسابك بسبب الاتصال.<p><button class="btn" data-act="retryadmin">إعادة المحاولة</button></p></div>`
      : incompleteView();
  }
  else{
    html = routeView(h);
  }

  $("#app").innerHTML = html;
  renderChrome(h);

  if(h.startsWith("#/note/")){
    curNoteId = h.slice(7);
  }

  // فتح المحاضرة عند زيارة رابطها المباشر داخل التطبيق.
  // يستعمل openReader الذي يطلب رابط R2 مؤقتًا عند الحاجة.
  if(
    ready &&
    h.startsWith("#/lecture/") &&
    $("#reader").style.display !== "flex"
  ){
    let lectureId = "";

    try{
      lectureId = decodeURIComponent(h.slice("#/lecture/".length));
    }catch(_){}

    const lecture = lectures.find(l => String(l.id) === lectureId);

    if(lecture){
      Promise.resolve().then(() => {
        if(
          route() === h &&
          $("#reader").style.display !== "flex"
        ){
          openReader(lecture);
        }
      });
    }
  }

  if(ready && isAdmin && h.startsWith("#/admin")){
    if(!stats && !statsErr && !statsBusy) loadStats();
    if(!accts && !acctsErr && !acctsBusy) loadAccts();
  }

  if(fid && $("#" + fid)){
    const el = $("#" + fid);
    el.focus();

    try{
      el.setSelectionRange(pos, pos);
    }catch(_){}
  }
}

/* ---------- الأحداث ---------- */
const ACT = {
  tab: t => {
    authTab = t.dataset.id;
    render();
  },

  login: doLogin,
  register: doRegister,
  recover: doRecover,
  logout: doLogout,

  copycode: async () => {
    try{
      await navigator.clipboard.writeText(pendingCode);
      toast("تم نسخ الرمز.");
    }catch(_){
      toast("تعذر النسخ، انسخه يدويًا.","err");
    }
  },

  codedone: () => {
    if(!$("#codeok").checked){
      return toast("أكّد أنك حفظت الرمز أولًا.","err");
    }

    pendingCode = null;
    render();
  },

  enablepush: enablePush,

  pushlater: () => {
    try{
      localStorage.setItem("lib_push_later","1");
    }catch(_){}
    render();
  },

  annclose: t => {
    try{
      localStorage.setItem("lib_ann_seen", t.dataset.id);
    }catch(_){}
    render();
  },

  chip: t => {
    filter = t.dataset.id;
    render();
  },

  done: t => {
    fDone = t.dataset.id;
    render();
  },

  tog: t => setProg(
    t.dataset.id,
    {[t.dataset.k]: !pg(t.dataset.id)[t.dataset.k]}
  ),

  read: t => openReader(lectures.find(l => l.id === t.dataset.id)),
  sharemenu: t => openShareMenu(lectures.find(l => l.id === t.dataset.id)),
  sharecurrent: () => openShareMenu(curLec),
  shareclose: () => closeShareMenu(),
  sharelink: () => shareLectureLink(),
  sharepdf: () => shareLecturePdf(),
  lecnote: t => lecNote(t.dataset.id),

  dtab: t => {
    dashTab = t.dataset.id;
    render();
  },

  newnote: () => newNote(null),
  notedel: t => delNote(t.dataset.id),

  savename: async () => {
    const v = $("#p-name").value.trim();

    if(!v || v.length > 60){
      return toast("الاسم من 1 إلى 60 حرفًا.","err");
    }

    const r = await sb
      .from("profiles")
      .update({display_name:v})
      .eq("user_id", me.user_id);

    if(r.error){
      return toast("تعذر الحفظ: " + r.error.message, "err");
    }

    me.display_name = v;
    toast("تم حفظ الاسم.");
    render();
  },

  savepass: async () => {
    const p = $("#p-pass").value;
    const p2 = $("#p-pass2").value;

    if(p.length < 10){
      return toast("كلمة المرور 10 أحرف على الأقل.","err");
    }

    if(p !== p2){
      return toast("كلمتا المرور غير متطابقتين.","err");
    }

    const r = await sb.auth.updateUser({password:p});

    if(r.error){
      return toast("تعذر التغيير: " + r.error.message, "err");
    }

    $("#p-pass").value = "";
    $("#p-pass2").value = "";
    toast("تم تغيير كلمة المرور.");
  },

  readall: async () => {
    await markRead(notifs.filter(notifOk).map(n => n.id));
    render();
  },

  opennotif: async t => {
    const n = notifs.find(x => x.id === t.dataset.id);
    if(!n) return;

    await markRead([n.id]);

    if(n.link && /^#\//.test(n.link)){
      location.hash = n.link;
    }else{
      render();
    }
  },

  retry: async () => {
    await load();
    render();
  },

  retryadmin: async () => {
    await checkAdmin();
    await loadMe();
    render();
  },

  /* الإدارة */
  adminlogin: doAdminLogin,
  sendotp: sendOtp,
  verifyotp: verifyOtp,

  save: saveLecture,

  cancel: () => {
    editing = null;
    render();
  },

  edit: t => {
    editing = t.dataset.id;
    render();
    scrollTo(0,0);
  },

  del: t => delLecture(t.dataset.id),

  bgsave: () => saveBg(false),

  bgreset: () => {
    if(confirm("إعادة الخلفية إلى الشكل الافتراضي؟")){
      saveBg(true);
    }
  },

  annpost: postAnn,

  anntoggle: t => {
    const a = anns.find(x => String(x.id) === t.dataset.id);
    if(a) annUpdate(a.id, {active:!a.active});
  },

  annpin: t => {
    const a = anns.find(x => String(x.id) === t.dataset.id);
    if(a) annUpdate(a.id, {pinned:!a.pinned});
  },

  anndel: t => delAnn(t.dataset.id),
  pnsend: doPushSend,
  schadd: schedAdd,
  schdel: t => schedDel(t.dataset.id),

  acctreload: () => {
    acctsErr = "";
    accts = null;
    render();
  },

  acctpass: t => acctPass(t.dataset.id),
  acctdel: t => acctDel(t.dataset.id),

  statsreload: () => {
    statsErr = "";
    stats = null;
    render();
  },

  rclose: () => closeReader(),

  rdone: () => {
    if(curLec){
      setProg(
        curLec.id,
        {completed:!pg(curLec.id).completed},
        true
      );
      updateReaderBtn();
    }
  }
};

document.addEventListener("click", e => {
  const t = e.target.closest("[data-act]");
  if(!t) return;

  const f = ACT[t.dataset.act] || QUIZ_ACT[t.dataset.act];
  if(!f) return;

  if(t.tagName === "A") e.preventDefault();

  f(t, e);
});

document.addEventListener("input", e => {
  if(quizOnInput(e)) return;

  const id = e.target.id;

  if(id === "q"){
    q = e.target.value;
    render();
  }
  else if(id === "nq"){
    nq = e.target.value;
    render();
  }
  else if(id === "aq"){
    acctQ = e.target.value;
    render();
  }
  else if(id === "bg-color"){
    colorTouched = true;
  }
  else if(id === "bg-dim"){
    $("#dimv").textContent = e.target.value;
  }
  else if(id === "n-title" || id === "n-body"){
    noteChanged();
  }
});

document.addEventListener("change", e => {
  if(quizOnChange(e)) return;

  const t = e.target, id = t.id;

  if(id === "f-kind"){
    fKind = t.value;
    render();
  }
  else if(id === "f-sem"){
    fSem = t.value;
    render();
  }
  else if(id === "showpw"){
    ["a-pass","a-pass2","pw"].forEach(x => {
      const el = $("#" + x);
      if(el) el.type = t.checked ? "text" : "password";
    });
  }
  else if(id === "n-subj"){
    const sid = t.value;
    const cur = $("#n-lec").value;
    const ls = lectures.filter(l => !sid || l.subject_id === sid);

    $("#n-lec").innerHTML =
      `<option value="">— بدون —</option>` +
      ls.map(l =>
        `<option value="${l.id}" ${l.id===cur?"selected":""}>${esc(l.title)}</option>`
      ).join("");

    if(!ls.some(l => l.id === cur)){
      $("#n-lec").value = "";
    }

    noteChanged();
  }
  else if(id === "n-lec"){
    const l = lectures.find(x => x.id === t.value);

    if(l){
      $("#n-subj").value = l.subject_id;
    }

    noteChanged();
  }
  else if(t.classList && t.classList.contains("pn") && me){
    const k = t.dataset.k, v = t.checked;

    sb.from("profiles")
      .update({[k]:v})
      .eq("user_id", me.user_id)
      .then(r => {
        if(r.error){
          t.checked = !v;
          toast("تعذر الحفظ: " + r.error.message, "err");
        }else{
          me[k] = v;
          toast("تم حفظ الإعداد.");
          renderChrome(route());
        }
      });
  }
});

document.addEventListener("keydown", e => {
  if(
    e.key !== "Enter" ||
    !["a-user","a-pass","a-pass2","a-code"].includes(e.target.id)
  ){
    return;
  }

  if(authTab === "login"){
    doLogin();
  }else if(authTab === "register"){
    doRegister();
  }else{
    doRecover();
  }
});

window.addEventListener("hashchange", () => {
  saveNote();
  quizRouteChange(route());

  q = "";
  nq = "";
  filter = "all";
  fKind = "";
  fSem = "";
  fDone = "";

  render();
  scrollTo(0,0);
});

document.addEventListener("visibilitychange", () => {
  if(document.hidden) saveNote();
});

window.addEventListener("beforeunload", () => {
  saveNote();
});

/* ---------- مشاركة المحاضرات خارج التطبيق ---------- */
let shareLec = null;

function openShareMenu(l){
  if(!l) return toast("تعذر العثور على المحاضرة.", "err");

  shareLec = l;

  const title = $("#sharetitle");
  if(title) title.textContent = "مشاركة: " + l.title;

  const modal = $("#sharemodal");
  if(modal) modal.style.display = "flex";
}

function closeShareMenu(){
  const modal = $("#sharemodal");
  if(modal) modal.style.display = "none";
}

async function copyShareUrl(url){
  try{
    if(navigator.clipboard && navigator.clipboard.writeText){
      await navigator.clipboard.writeText(url);
      toast("تم نسخ رابط المحاضرة. يمكنك لصقه في واتساب أو تيليغرام.");
      return true;
    }
  }catch(_){}

  try{
    const el = document.createElement("textarea");

    el.value = url;
    el.readOnly = true;
    el.style.position = "fixed";
    el.style.opacity = "0";

    document.body.appendChild(el);
    el.select();

    const ok = document.execCommand("copy");
    el.remove();

    if(ok){
      toast("تم نسخ رابط المحاضرة.");
      return true;
    }
  }catch(_){}

  window.prompt("انسخ رابط المحاضرة:", url);
  return false;
}

// مشاركة رابط ثابت داخل التطبيق بدلًا من مشاركة رابط R2 المؤقت.
// عند فتح الرابط، يستخرج التطبيق مسار المحاضرة ويطلب رابط R2 جديدًا.
function buildLectureShareUrl(l){
  const u = new URL(location.href);
  u.hash = "#/lecture/" + encodeURIComponent(String(l.id));
  return u.href;
}

async function shareLectureLink(){
  const l = shareLec;
  if(!l) return;

  const url = buildLectureShareUrl(l);
  closeShareMenu();

  try{
    if(navigator.share){
      await navigator.share({
        title:l.title,
        text:"محاضرة من مكتبة تقنيات المختبرات الطبية: " + l.title + " — يتطلب فتح الرابط تسجيل الدخول إلى التطبيق.",
        url
      });
    }else{
      await copyShareUrl(url);
    }
  }catch(e){
    if(e && e.name === "AbortError") return;
    await copyShareUrl(url);
  }
}

async function shareLecturePdf(){
  const l = shareLec;
  if(!l) return;

  closeShareMenu();

  try{
    // الحصول على رابط صالح للقراءة من Supabase أو R2.
    const url = await lectureUrl(l.file_path, false);

    if(!navigator.share || !window.File || !navigator.canShare){
      const downloadUrl = await lectureUrl(l.file_path, true);

      toast("هذا المتصفح لا يدعم مشاركة PDF مباشرة؛ سيتم فتح رابط الملف.");
      window.open(downloadUrl, "_blank", "noopener");
      return;
    }

    toast("جارٍ تجهيز ملف PDF للمشاركة…");

    const response = await fetch(url);

    if(!response.ok){
      throw new Error("تعذر تنزيل ملف PDF.");
    }

    const blob = await response.blob();

    const safeName =
      String(l.title || "lecture")
        .replace(/[\\/:*?"<>|]+/g, "-")
        .trim()
        .slice(0,100) || "lecture";

    const file = new File(
      [blob],
      safeName + ".pdf",
      {type:"application/pdf"}
    );

    if(!navigator.canShare({files:[file]})){
      throw new Error("المتصفح لا يدعم مشاركة هذا الملف.");
    }

    await navigator.share({
      files:[file],
      title:l.title,
      text:"محاضرة من مكتبة تقنيات المختبرات الطبية: " + l.title
    });

  }catch(e){
    if(e && e.name === "AbortError") return;

    toast(
      "تعذرت مشاركة ملف PDF مباشرة. يمكنك مشاركة رابط المحاضرة داخل التطبيق.",
      "err"
    );

    shareLec = l;
    openShareMenu(l);
  }
}

/* ---------- قارئ PDF ---------- */
let pdfjs = null;

function loadPdfJs(){
  if(pdfjs) return pdfjs;

  pdfjs = new Promise((res, rej) => {
    const s = document.createElement("script");

    s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";

    s.onload = () => {
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

      res(pdfjsLib);
    };

    s.onerror = () => rej(new Error("تعذر تحميل مكتبة قارئ PDF."));

    document.head.appendChild(s);
  });

  return pdfjs;
}

let readerToken = 0;

function updateReaderBtn(){
  const b = $("#rdone");
  if(!b) return;

  b.style.display = me && curLec ? "" : "none";

  if(curLec){
    b.textContent = pg(curLec.id).completed
      ? "✓ مكتملة"
      : "☐ تحديد كمكتملة";
  }
}

function closeReader(){
  readerToken++;
  curLec = null;

  $("#reader").style.display = "none";
  $("#pages").innerHTML = "";
  document.body.style.overflow = "";

  // إذا فُتح القارئ من رابط مباشر، ارجع إلى المكتبة عند إغلاقه
  // حتى لا يعيد render فتح القارئ من الرابط نفسه.
  if(route().startsWith("#/lecture/")){
    location.hash = "#/";
  }

  render();
}

async function openReader(l){
  if(!l) return;

  const tok = ++readerToken;
  const box = $("#pages");

  curLec = l;
  updateReaderBtn();

  if(me){
    setProg(
      l.id,
      {last_opened_at:new Date().toISOString()},
      true
    );
  }

  $("#reader").style.display = "flex";
  $("#rtitle").textContent = l.title;
  $("#rdl").removeAttribute("href");

  box.innerHTML = '<p style="color:#fff">جارٍ فتح الملف…</p>';
  document.body.style.overflow = "hidden";

  let pdfUrl = "";

  try{
    // يختار تلقائيًا رابط Supabase للملفات القديمة
    // أو رابط R2 المؤقت للملفات الجديدة.
    pdfUrl = await lectureUrl(l.file_path, false);

    const downloadUrl = await lectureUrl(l.file_path, true);

    if(tok !== readerToken) return;

    $("#rdl").href = downloadUrl;

    const lib = await loadPdfJs();

    if(tok !== readerToken) return;

    // تعطيل طلبات Range يساعد على قراءة الملفات من روابط
    // R2 المؤقتة دون تكرار طلبات جديدة بعد انتهاء صلاحية الرابط.
    const pdf = await lib.getDocument({
      url:pdfUrl,
      disableRange:true,
      disableStream:true
    }).promise;

    if(tok !== readerToken) return;

    box.innerHTML = "";

    const first = await pdf.getPage(1);

    const w = Math.min(box.clientWidth - 20, 900);

    const ratio = first.getViewport({scale:1});
    const h = w * ratio.height / ratio.width;

    const io = new IntersectionObserver(async ents => {
      for(const en of ents){
        if(!en.isIntersecting) continue;

        io.unobserve(en.target);

        try{
          const n = +en.target.dataset.n;
          const p = await pdf.getPage(n);

          const vp = p.getViewport({scale:1});
          const sc =
            (w / vp.width) *
            Math.min(devicePixelRatio || 1, 2);

          const v2 = p.getViewport({scale:sc});

          const c = document.createElement("canvas");
          c.width = v2.width;
          c.height = v2.height;

          await p.render({
            canvasContext:c.getContext("2d"),
            viewport:v2
          }).promise;

          if(tok === readerToken){
            en.target.style.height = "auto";
            en.target.appendChild(c);
          }
        }catch(e){
          if(tok === readerToken){
            en.target.style.height = "auto";
            en.target.textContent = "تعذر عرض هذه الصفحة.";
          }
        }
      }
    }, {
      root:box,
      rootMargin:"600px"
    });

    for(let i = 1; i <= pdf.numPages; i++){
      const d = document.createElement("div");

      d.className = "pg";
      d.dataset.n = i;
      d.style.width = w + "px";
      d.style.height = h + "px";

      box.appendChild(d);
      io.observe(d);
    }

  }catch(err){
    if(tok !== readerToken) return;

    // لا نستخدم fileUrl مباشرةً لملفات r2:،
    // لأن fileUrl مخصص لمسارات Supabase القديمة.
    const fallbackLink = pdfUrl
      ? `<p><a class="btn" target="_blank" rel="noopener" href="${esc(pdfUrl)}">فتح الملف في صفحة جديدة</a></p>`
      : "";

    box.innerHTML = `
      <div class="empty" style="margin:20px">
        تعذر عرض الملف داخل التطبيق.
        <p>${esc(err?.message || "تحقق من الاتصال بالإنترنت ثم حاول مجددًا.")}</p>
        ${fallbackLink}
      </div>`;
  }
}

/* ---------- التشغيل ---------- */
async function init(){
  sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  try{
    settings = JSON.parse(localStorage.getItem("lib_settings") || "{}");
    applyBg();
  }catch(_){}

  render();

  const s = await sb.auth.getSession();
  session = s.data.session;

  await checkAdmin();

  sb.auth.onAuthStateChange(async (ev, sess) => {
    const prev = session && session.user
      ? session.user.id
      : null;

    session = sess;

    if(
      ev === "INITIAL_SESSION" ||
      ev === "TOKEN_REFRESHED" ||
      ev === "USER_UPDATED" ||
      (
        ev === "SIGNED_IN" &&
        sess &&
        sess.user &&
        sess.user.id === prev
      )
    ){
      return;
    }

    ready = false;
    render();

    stats = null;
    accts = null;
    statsErr = "";
    acctsErr = "";

    await checkAdmin();
    await loadMe();
    await loadQuizzes();

    editing = null;
    ready = true;
    render();

    if(session && !isAdmin){
      logVisit();
    }
  });

  await Promise.all([load(), loadMe()]);
  await loadQuizzes();

  ready = true;
  render();
  logVisit();

  const refresh = async () => {
    if(
      busy ||
      editing ||
      document.hidden ||
      $("#reader").style.display === "flex"
    ){
      return;
    }

    if(route().startsWith("#/note/")) return;

    const a = document.activeElement;

    if(a && /INPUT|TEXTAREA|SELECT/.test(a.tagName)){
      return;
    }

    await load();

    if(me){
      await loadNotifs();
    }

    await loadQuizzes();
    render();
  };

  document.addEventListener("visibilitychange", refresh);
  setInterval(refresh, 90000);
}

init();

if("serviceWorker" in navigator){
  addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
