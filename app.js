// ====== API Config ======
let API = { base: "", dataPath: "/predictions", predictPath: "/predict" };
function saveApiConfig(){
  API.base = document.querySelector("#apiBase").value.trim();
  API.dataPath = document.querySelector("#apiDataPath").value.trim() || "/predictions";
  API.predictPath = document.querySelector("#apiPredictPath").value.trim() || "/predict";
  localStorage.setItem("api_cfg", JSON.stringify(API));
  alert("API settings saved ✅");
}
function loadApiConfig(){
  const raw = localStorage.getItem("api_cfg");
  if(raw){ try{ API = JSON.parse(raw) }catch{} }
  document.querySelector("#apiBase").value = API.base || "";
  document.querySelector("#apiDataPath").value = API.dataPath || "/predictions";
  document.querySelector("#apiPredictPath").value = API.predictPath || "/predict";
}
function apiUrl(path){
  if(!API.base) return path;
  return API.base.replace(/\/+$/,"") + (path.startsWith("/")? path : "/"+path);
}

// ====== Global State ======
let ALL_ROWS = [];
let FILTERED = [];
let yearChart;
let currentApodBlob;

// ====== Utils ======
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
function createEl(tag, attrs={}, children=[]) {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([k,v])=> {
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else el.setAttribute(k,v);
  });
  (Array.isArray(children)?children:[children]).forEach(c=> c && el.appendChild(c));
  return el;
}
function debounce(fn, ms=150){
  let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), ms); };
}
function toCSV(rows){
  if(!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  rows.forEach(r => {
    const line = headers.map(h => {
      const val = r[h] ?? "";
      const s = (""+val).replace(/"/g,'""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    }).join(",");
    lines.push(line);
  });
  return lines.join("\n");
}
function download(filename, blob){
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ====== Tooltips ======
const tooltipTpl = $("#tooltipTpl");
let tipEl;
function attachTooltips(){
  const targets = $$("[data-tip], .hint");
  targets.forEach(t => {
    t.addEventListener("mouseenter", () => {
      const tip = t.dataset.tip || t.getAttribute("data-tip") || t.title || "";
      if(!tip) return;
      tipEl = tooltipTpl.content.firstElementChild.cloneNode(true);
      tipEl.textContent = tip;
      document.body.appendChild(tipEl);
      const rect = t.getBoundingClientRect();
      tipEl.style.top = (rect.bottom + 8 + window.scrollY) + "px";
      tipEl.style.left = (rect.left + window.scrollX) + "px";
    });
    t.addEventListener("mouseleave", () => tipEl && tipEl.remove());
  });
}

// ====== Theming & Lang ======
function applyTheme(theme){
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("theme", theme);
}
function initTheme(){
  const saved = localStorage.getItem("theme");
  if(saved) applyTheme(saved);
  $("#themeToggle").addEventListener("click", () => {
    const t = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    applyTheme(t);
  });
}
function initLang(){
  // Keep English only per user request
  document.documentElement.lang = 'en';
  document.documentElement.dir = 'ltr';
  const btn = $('#langToggle');
  if(btn) btn.style.display = 'none';
}



// ====== APOD ======
async function fetchAPOD(){
  const key = $("#apiKey").value.trim() || "DEMO_KEY";
  let date = $("#apodDate").value;
  if (date && /^\d{2}\/\d{2}\/\d{4}$/.test(date)) {
    const [mm, dd, yyyy] = date.split("/");
    date = `${yyyy}-${mm}-${dd}`;
  }
  const params = new URLSearchParams({ api_key: key });
  if(date) params.set("date", date);
  const url = `https://api.nasa.gov/planetary/apod?${params.toString()}`;
  const container = $("#apodResult");

  container.classList.add("shimmer");
  container.innerHTML = `<div class="apod-skel"></div><div class="apod-meta"><div class="line"></div><div class="line half"></div></div>`;
  currentApodBlob = null;
  $("#saveApodBtn").disabled = true;

  try{
    const r = await fetch(url, { mode: "cors" });
    if(!r.ok){
      const t = await r.text().catch(()=> "");
      throw new Error(`APOD request failed (${r.status}) ${t || ""}`);
    }
    const data = await r.json();

    let mediaEl;
    if(data.media_type === "image"){
      mediaEl = createEl("img", { src: data.url, alt: data.title || "" });
      const rb = await fetch(data.url);
      currentApodBlob = await rb.blob();
      $("#saveApodBtn").disabled = false;
    }else if(data.media_type === "video"){
      mediaEl = createEl("iframe", { src: data.url, allowfullscreen: "true" });
    }else{
      mediaEl = createEl("div", { text: "Unsupported media type" });
    }

    const meta = createEl("div", { class:"apod-meta" }, [
      createEl("h3", { text: data.title || "Untitled" }),
      createEl("div", { class:"meta", text: data.date || "" }),
      createEl("p", { text: data.explanation || "" }),
    ]);

    container.classList.remove("shimmer");
    container.replaceChildren(mediaEl, meta);
  }catch(err){
    container.classList.remove("shimmer");
    container.innerHTML = `<span style="color:#ff7b7b">Load failed: ${err.message}</span>`;
    console.error("APOD error detail:", err);
  }
}
function initAPOD(){
  $("#loadApodBtn").addEventListener("click", fetchAPOD);
  $("#saveApodBtn").addEventListener("click", () => {
    if(!currentApodBlob) return;
    download("apod.jpg", currentApodBlob);
  });
}

// ====== CSV Load & Normalize ======
function normalizeKeyName(s){
  return String(s || "")
    .replace(/\uFEFF/g, "")
    .replace(/\u00A0/g, " ")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^\p{L}\p{N}_]/gu, "");
}
function getAny(obj, keys) {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k];
  }
  const dict = {};
  for (const kk of Object.keys(obj)) { dict[normalizeKeyName(kk)] = obj[kk]; }
  for (const k of keys) {
    const nk = normalizeKeyName(k);
    if (dict[nk] !== undefined && dict[nk] !== null && dict[nk] !== "") return dict[nk];
  }
  return null;
}
function normalizeRow(r){
  const pl_name = getAny(r, ["pl_name","name","planet","PL_NAME","Name","الكوكب","الاسم","kepler_name","kepoi_name","koi_name"]);
  let pl_orbper  = getAny(r, ["pl_orbper","period","PL_ORBPER","koi_period","orbital_period","الفترة","الفترة (يوم)"]);
  let pl_rade    = getAny(r, ["pl_rade","radius","PL_RADE","koi_prad","earth_radius","نصف القطر","نصف القطر (أرضي)"]);
  let disc_year  = getAny(r, ["disc_year","year","DISC_YEAR","Year","سنة الاكتشاف","Year"]);
  const hostname = getAny(r, ["hostname","host_star","HOSTNAME","Star","النجم المضيف","النجم","koi_targetname"]);
  const discoverymethod = getAny(r, ["discoverymethod","method","DISCOVERYMETHOD","Method","طريقة الاكتشاف","الطريقة","koi_disposition"]);

  const toNum = v => { if(v==null||v==="") return null; const n=Number(String(v).replace(",",".")); return Number.isFinite(n)?n:null; };
  const toYear = v => { if(v==null||v==="") return null; const m=String(v).match(/\d{4}/); return m?parseInt(m[0],10):null; };

  return { pl_name, pl_orbper: toNum(pl_orbper), pl_rade: toNum(pl_rade), disc_year: toYear(disc_year), hostname, discoverymethod };
}
function smartParse(text){
  let res = Papa.parse(text, { header:true, dynamicTyping:true, skipEmptyLines:true });
  const isBad = res.data.length && Object.keys(res.data[0]||{}).length <= 1;
  if (!isBad) return res;
  res = Papa.parse(text, { header:true, dynamicTyping:true, skipEmptyLines:true, delimiter: ";" });
  if (res.data.length && Object.keys(res.data[0]||{}).length > 1) return res;
  return Papa.parse(text, { header:true, dynamicTyping:true, skipEmptyLines:true, delimiter: "\t" });
}
function parseCSVFile(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try{
        const text = reader.result;
        const res = smartParse(text);
        const rows = res.data.map(normalizeRow);
        resolve(rows);
      }catch(err){ reject(err); }
    };
    reader.onerror = reject;
    reader.readAsText(file, "utf-8");
  });
}

// ====== API Data Load ======
async function loadFromAPI(){
  const url = apiUrl(API.dataPath);
  try{
    const r = await fetch(url, { headers: { "Accept": "application/json" } });
    if(!r.ok) throw new Error("API request failed: " + r.status);
    let data = await r.json();
    if (data && data.data && Array.isArray(data.data)) data = data.data;
    if(!Array.isArray(data)) throw new Error("Expected JSON array from API");
    ALL_ROWS = data.map(normalizeRow);
    sortState = { key:null, dir:1 };
    applyFilters();
    alert("تم تحميل البيانات من API ✅");
  }catch(err){
    alert("فشل تحميل البيانات من API: " + err.message);
    console.error("API load error:", err);
  }
}

// ====== Render Table & Filters ======
let sortState = { key: null, dir: 1 };
function renderTable(rows){
  const tbody = $("#dataTable tbody");
  tbody.innerHTML = "";
  const frag = document.createDocumentFragment();
  rows.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.pl_name ?? ""}</td>
      <td>${r.pl_orbper ?? ""}</td>
      <td>${r.pl_rade ?? ""}</td>
      <td>${r.disc_year ?? ""}</td>
      <td>${r.hostname ?? ""}</td>
      <td>${r.discoverymethod ?? ""}</td>
    `;
    frag.appendChild(tr);
  });
  tbody.appendChild(frag);
  $("#summary").textContent = `Rows: ${rows.length} of ${ALL_ROWS.length}`;
}
function groupByYear(rows){
  const m = new Map();
  rows.forEach(r => {
    const y = r.disc_year;
    if(y == null) return;
    m.set(y, (m.get(y)||0)+1);
  });
  const years = [...m.keys()].sort((a,b)=>a-b);
  return { years, counts: years.map(y => m.get(y)) };
}
function drawYearChart(rows){
  const {years, counts} = groupByYear(rows);
  const ctx = $("#yearChart").getContext("2d");
  if(yearChart) yearChart.destroy();

  yearChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: years,
      datasets: [{
        label: "Planets discovered",
        data: counts,
        backgroundColor: "rgba(124,92,255,0.6)",
        borderColor: "rgba(124,92,255,0.95)",
        borderWidth: 1.5
      }]
    },
    options: {
      responsive: true,
      animation: { duration: 400 },
      scales: {
        x: { ticks: { color: "#cdd3ff" }, title: { display: true, text: "Year", color:"#cdd3ff" } },
        y: { beginAtZero: true, ticks: { color: "#cdd3ff" }, title: { display: true, text: "Count", color:"#cdd3ff" } }
      },
      plugins: {
        legend: { labels: { color: "#e7ebff" } },
        tooltip: { callbacks: { label: (ctx) => `عدد: ${ctx.parsed.y}` } }
      }
    }
  });
}
function applyFilters(){
  const nameQ = $("#searchName").value.trim().toLowerCase();
  const minR = parseFloat($("#minRadius").value);
  const maxR = parseFloat($("#maxRadius").value);
  const minY = parseInt($("#minYear").value, 10);
  const maxY = parseInt($("#maxYear").value, 10);

  FILTERED = ALL_ROWS.filter(r => {
    const nameOk = !nameQ || (r.pl_name && r.pl_name.toLowerCase().includes(nameQ));
    const rOk = (isNaN(minR) || (r.pl_rade ?? Infinity) >= minR) &&
                (isNaN(maxR) || (r.pl_rade ?? -Infinity) <= maxR);
    const yOk = (isNaN(minY) || (r.disc_year ?? Infinity) >= minY) &&
                (isNaN(maxY) || (r.disc_year ?? -Infinity) <= maxY);
    return nameOk && rOk && yOk;
  });

  if(sortState.key){
    const key = sortState.key, dir = sortState.dir;
    FILTERED.sort((a,b)=>{
      const av = a[key] ?? "";
      const bv = b[key] ?? "";
      if(typeof av === "number" && typeof bv === "number"){
        return (av - bv) * dir;
      }
      return (""+av).localeCompare(""+bv, "ar", { numeric:true }) * dir;
    });
  }

  renderTable(FILTERED);
  drawYearChart(FILTERED);
  if (window.draw3DCharts) window.draw3DCharts(FILTERED);
}
function attachSorting(){
  $$("#dataTable thead th").forEach(th => {
    th.addEventListener("click", () => {
      const key = th.getAttribute("data-key");
      if(sortState.key === key) sortState.dir *= -1;
      else { sortState.key = key; sortState.dir = 1; }
      $$("#dataTable thead th .sort-ind").forEach(s => s.textContent = "↕");
      th.querySelector(".sort-ind").textContent = sortState.dir === 1 ? "↑" : "↓";
      applyFilters();
    });
  });
}

// ====== Predict ======
async function sendPredict(){
  const body = {
    pl_orbper: parseFloat($("#in_orbper").value),
    pl_rade: parseFloat($("#in_rade").value),
    disc_year: parseInt($("#in_year").value, 10),
    discoverymethod: $("#in_method").value.trim() || null,
  };
  const result = $("#predictResult");
  result.innerHTML = "<div class='muted'>Sending…</div>";
  try{
    const r = await fetch(apiUrl(API.predictPath), {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept":"application/json" },
      body: JSON.stringify(body),
    });
    if(!r.ok) throw new Error("Predict request failed: " + r.status);
    const data = await r.json();
    const prob = data.prob !== undefined ? (data.prob * 100).toFixed(2) + "%" : "—";
    result.innerHTML = `
      <div><b>Label:</b> ${data.label ?? "—"}</div>
      <div><b>Probability:</b> ${prob}</div>
      <pre style="margin-top:8px; white-space:pre-wrap">${JSON.stringify(data, null, 2)}</pre>
    `;
  }catch(err){
    result.innerHTML = `<div style="color:#ff7b7b">Prediction failed: ${err.message}</div>`;
    console.error("predict error:", err);
  }
}

// ====== Events ======
function initDataUI(){
  $("#csvInput").addEventListener("change", async (e)=>{
    const file = e.target.files?.[0];
    if(!file) return;
    ALL_ROWS = await parseCSVFile(file);
    sortState = { key: null, dir: 1 };
    applyFilters();
    if (window.draw3DCharts) window.draw3DCharts(window.FILTERED || ALL_ROWS || []);
    if (window.drawMoreCharts) window.drawMoreCharts(window.FILTERED || ALL_ROWS || []);
  });
  $("#loadSampleBtn").addEventListener("click", async ()=>{
    const r = await fetch("./sample_exoplanets.csv");
    const csv = await r.text();
    const parsed = smartParse(csv);
    ALL_ROWS = parsed.data.map(normalizeRow);
    sortState = { key:null, dir:1 };
    applyFilters();
  });
  $("#loadFromAPI").addEventListener("click", loadFromAPI);

  $("#searchName").addEventListener("input", debounce(applyFilters, 120));
  $("#minRadius").addEventListener("input", debounce(applyFilters, 120));
  $("#maxRadius").addEventListener("input", debounce(applyFilters, 120));
  $("#minYear").addEventListener("input", debounce(applyFilters, 120));
  $("#maxYear").addEventListener("input", debounce(applyFilters, 120));

  $("#resetFilters").addEventListener("click", ()=>{
    ["searchName","minRadius","maxRadius","minYear","maxYear"].forEach(id => $("#"+id).value = "");
    sortState = { key: null, dir: 1 };
    $$("#dataTable thead th .sort-ind").forEach(s => s.textContent = "↕");
    applyFilters();
  });

  $("#exportBtn").addEventListener("click", ()=>{
    if(!FILTERED.length){ alert("No results to export"); return; }
    const csv = toCSV(FILTERED);
    const blob = new Blob([csv], {type:"text/csv;charset=utf-8;"});
    download("Star Navigators-filtered_exoplanets.csv", blob);
  });
}

window.addEventListener("DOMContentLoaded", () => {
  loadApiConfig();
  initTheme();
  initLang();
  attachTooltips();
  initAPOD();
  initDataUI();
  attachSorting();
  $("#saveApiCfg").addEventListener("click", saveApiConfig);
  $("#predictBtn").addEventListener("click", sendPredict);

  // Auto-load sample data on first load
  if ((window.ALL_ROWS||[]).length === 0) {
    fetch("./sample_exoplanets.csv")
      .then(r => r.text())
      .then(csv => {
        const parsed = smartParse(csv);
        ALL_ROWS = parsed.data.map(normalizeRow);
        sortState = { key:null, dir:1 };
        applyFilters();
      })
      .catch(()=>{});
  }

});
