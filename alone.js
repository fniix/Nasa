// Are We Alone — Excel/CSV analyzer with a *new* visualization model (bubble + sunburst)
(function(){
  // CDN libs expected in HTML: xlsx (SheetJS), PapaParse, Plotly
  // Reuse background fx if present
  const $ = (sel)=>document.querySelector(sel);
  const $$ = (sel)=>[...document.querySelectorAll(sel)];

  // --- Normalizers (lean copy from main site) ---
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
  function toNum(v){ if(v==null||v==="") return null; const n=Number(String(v).replace(",",".")); return Number.isFinite(n)?n:null; }
  function toYear(v){ if(v==null||v==="") return null; const m=String(v).match(/\d{4}/); return m?parseInt(m[0],10):null; }
  function normalizeRow(r){
    const pl_name = getAny(r, ["pl_name","name","planet","PL_NAME","Name","kepler_name","kepoi_name","koi_name","الاسم","الكوكب"]);
    const pl_orbper  = toNum(getAny(r, ["pl_orbper","period","PL_ORBPER","koi_period","orbital_period","الفترة","الفترة (يوم)"]));
    const pl_rade    = toNum(getAny(r, ["pl_rade","radius","PL_RADE","koi_prad","earth_radius","نصف القطر","نصف القطر (أرضي)"]));
    const disc_year  = toYear(getAny(r, ["disc_year","year","DISC_YEAR","Year","سنة الاكتشاف"]));
    const hostname = getAny(r, ["hostname","host_star","HOSTNAME","Star","النجم المضيف","النجم","koi_targetname"]);
    const discoverymethod = getAny(r, ["discoverymethod","method","DISCOVERYMETHOD","Method","طريقة الاكتشاف","الطريقة","koi_disposition"]);
    return { pl_name, pl_orbper, pl_rade, disc_year, hostname, discoverymethod };
  }

  // --- File parsing (CSV or XLSX) ---
  async function readFile(file){
    const name = file.name.toLowerCase();
    if (name.endsWith(".csv")){
      const text = await file.text();
      const parsed = Papa.parse(text, { header:true, dynamicTyping:true, skipEmptyLines:true });
      return parsed.data.map(normalizeRow);
    } else if (name.endsWith(".xlsx") || name.endsWith(".xls")){
      const data = new Uint8Array(await file.arrayBuffer());
      const wb = XLSX.read(data, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet, { defval:"" });
      return json.map(normalizeRow);
    } else {
      throw new Error("Please upload CSV or Excel (.xlsx/.xls) file");
    }
  }

  // --- KPIs ---
  function calcKPIs(rows){
    const total = rows.length;
    const named = rows.filter(r=>r.pl_name).length;
    const withYear = rows.filter(r=>Number.isFinite(r.disc_year)).length;
    const small = rows.filter(r=>Number.isFinite(r.pl_rade) && r.pl_rade<=1.5).length;
    return { total, named, withYear, small };
  }
  function renderKPIs(k){
    $("#kpi_total").textContent = k.total;
    $("#kpi_named").textContent = k.named;
    $("#kpi_year").textContent = k.withYear;
    $("#kpi_small").textContent = k.small;
  }

  // --- NEW MODEL VIS: Bubble chart (Period vs Radius, bubble size ~ radius, color ~ year bin) ---
  function bubbleChart(rows){
    const data = rows.filter(r => Number.isFinite(r.pl_orbper) && Number.isFinite(r.pl_rade) && Number.isFinite(r.disc_year));
    const bins = (y)=> y<2000?'90s': (y<2010?'00s': (y<2020?'10s':'20s'));
    const trace = {
      type:'scatter',
      mode:'markers',
      x: data.map(r=>r.pl_orbper),
      y: data.map(r=>r.pl_rade),
      text: data.map(r=> (r.pl_name||'Unknown') + (r.hostname?` • ${r.hostname}`:'')),
      hovertemplate:'<b>%{text}</b><br>Period: %{x:.2f} d<br>Radius: %{y:.2f} R⊕<extra></extra>',
      marker: {
        size: data.map(r=> Math.max(8, Math.min(28, (r.pl_rade||1)*6))),
        sizemode:'diameter',
        opacity: .88,
        color: data.map(r=> bins(r.disc_year)),
      }
    };
    const layout = {
      paper_bgcolor:'rgba(0,0,0,0)', plot_bgcolor:'rgba(0,0,0,0)',
      margin:{l:50,r:10,b:40,t:10},
      xaxis:{ title:'Orbital period (days) — log', type:'log', color:'#cdd3ff', gridcolor:'#394067' },
      yaxis:{ title:'Radius (R⊕)', color:'#cdd3ff', gridcolor:'#394067' },
      showlegend:false
    };
    Plotly.react('bubblePlot', [trace], layout, {displayModeBar:false});
  }

  // --- NEW MODEL VIS: Sunburst by Method → Year (binned) ---
  function sunburst(rows){
    const data = rows.filter(r=> (r.discoverymethod||'') && Number.isFinite(r.disc_year));
    const labels = ['All'];
    const parents = [''];
    const values = [data.length];

    const byMethod = {};
    data.forEach(r=> {
      const m = r.discoverymethod||'Other';
      const yb = (r.disc_year<2000?'90s': (r.disc_year<2010?'00s': (r.disc_year<2020?'10s':'20s')));
      const key = m + '|' + yb;
      byMethod[m] = byMethod[m]||0;
      byMethod[key] = (byMethod[key]||0) + 1;
    });
    Object.keys(byMethod).forEach(k=>{
      if(!k.includes('|')){
        labels.push(k); parents.push('All'); values.push(byMethod[k]);
      }
    });
    Object.keys(byMethod).forEach(k=>{
      if(k.includes('|')){
        const [m,yb] = k.split('|');
        labels.push(yb); parents.push(m); values.push(byMethod[k]);
      }
    });

    const trace = { type:'sunburst', labels, parents, values, leaf:{opacity:0.9}, branchvalues:'total' };
    const layout = { paper_bgcolor:'rgba(0,0,0,0)', margin:{l:0,r:0,b:0,t:0} };
    Plotly.react('sunburst', [trace], layout, {displayModeBar:false});
  }

  // --- Wiring ---
  function attachDrop(){
    const dz = $(".dropzone");
    const inp = $("#fileInput");
    const btnFileLabel = document.querySelector('.btn-file');
    const handle = async (file)=>{
      $(".status").textContent = "Parsing…";
      try{
        const rows = await readFile(file);
        const clean = rows.filter(r=>r.pl_name || r.pl_rade || r.pl_orbper || r.disc_year);
        window.AWA_ROWS = clean;
        renderKPIs(calcKPIs(clean));
        bubbleChart(clean);
        sunburst(clean);
        $(".status").textContent = `Loaded ${clean.length} rows ✅`;
      }catch(err){
        $(".status").textContent = "Failed: " + err.message;
        console.error(err);
      }
    };
    dz.addEventListener('dragover', (e)=>{ e.preventDefault(); dz.classList.add('dragover'); });
    dz.addEventListener('dragleave', ()=> dz.classList.remove('dragover'));
    dz.addEventListener('drop', (e)=>{
      e.preventDefault(); dz.classList.remove('dragover');
      if(e.dataTransfer.files && e.dataTransfer.files[0]) handle(e.dataTransfer.files[0]);
    });
    inp.addEventListener('change', ()=> {
      if(inp.files[0]){
        btnFileLabel.setAttribute('data-filename', inp.files[0].name);
        btnFileLabel.style.borderColor = 'var(--accent)';
        handle(inp.files[0]);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', attachDrop);
})();