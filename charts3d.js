// Plotly 3D charts + EXTRA 2D analytics (non-breaking)
(function(){
  // ===== helpers =====
  function fmt(n){ return (n==null||isNaN(n)) ? null : n; }
  function exists(id){ return !!document.getElementById(id); }
  function by(arr, key){ return arr.reduce((m,r)=>{ const k=r[key]??'—'; (m[k]=m[k]||[]).push(r); return m; },{}); }
  function clamp(n,min,max){ return Math.max(min, Math.min(max,n)); }

  // ===== existing charts (kept as-is) =====
  function scatter3d(rows){
    const x=[],y=[],z=[],text=[],color=[];
    rows.forEach(r=>{
      const ox=fmt(r.pl_orbper), ry=fmt(r.pl_rade), zy=fmt(r.disc_year);
      if(ox!=null && ry!=null && zy!=null){
        x.push(ox); y.push(ry); z.push(zy);
        text.push(`${r.pl_name||'Unknown'} | ${r.discoverymethod||'-'}`);
        color.push(r.discoverymethod||'Other');
      }
    });
    if(!exists('scatter3d')) return;
    const trace={type:'scatter3d',mode:'markers',x,y,z,text,
      marker:{size:y.map(v=>Math.max(3,Math.min(14,v*2))),color,opacity:.9,line:{width:.5,color:'rgba(255,255,255,.25)'}},
      hovertemplate:'<b>%{text}</b><br>Period: %{x:.2f} d<br>Radius: %{y:.2f} R⊕<br>Year: %{z}<extra></extra>'};
    const layout={paper_bgcolor:'rgba(0,0,0,0)',plot_bgcolor:'rgba(0,0,0,0)',margin:{l:0,r:0,b:0,t:0},
      scene:{xaxis:{title:'Period (d)',type:'log',color:'#cdd3ff',gridcolor:'#394067'},
             yaxis:{title:'Radius (R⊕)',color:'#cdd3ff',gridcolor:'#394067'},
             zaxis:{title:'Year',color:'#cdd3ff',gridcolor:'#394067'},bgcolor:'rgba(0,0,0,0)'}};
    Plotly.react('scatter3d',[trace],layout,{displayModeBar:false});
  }

  function surface3d(rows){
    if(!exists('surface3d')) return;
    const yset=new Set(), mset=new Set();
    rows.forEach(r=>{ if(r.disc_year!=null)yset.add(r.disc_year); mset.add(r.discoverymethod||'Other'); });
    const years=[...yset].sort((a,b)=>a-b), methods=[...mset].sort((a,b)=>a.localeCompare(b));
    const iy=new Map(years.map((v,i)=>[v,i])), im=new Map(methods.map((v,i)=>[v,i]));
    const Z=Array.from({length:methods.length},()=>Array(years.length).fill(0));
    rows.forEach(r=>{ const y=r.disc_year, m=r.discoverymethod||'Other'; if(iy.has(y)&&im.has(m)) Z[im.get(m)][iy.get(y)]++; });
    const data=[{type:'surface',x:years,y:methods,z:Z,colorscale:'Viridis',showscale:true,opacity:.97}];
    const layout={paper_bgcolor:'rgba(0,0,0,0)',plot_bgcolor:'rgba(0,0,0,0)',margin:{l:0,r:0,b:0,t:0},
      scene:{xaxis:{title:'Year',color:'#cdd3ff',gridcolor:'#394067'},
             yaxis:{title:'Method',color:'#cdd3ff',gridcolor:'#394067'},
             zaxis:{title:'Count',color:'#cdd3ff',gridcolor:'#394067'},bgcolor:'rgba(0,0,0,0)'}};
    Plotly.react('surface3d',data,layout,{displayModeBar:false});
  }

  function corr(valsA, valsB){
    const pairs = [];
    for(let i=0;i<valsA.length;i++){
      const a=valsA[i], b=valsB[i];
      if(Number.isFinite(a) && Number.isFinite(b)) pairs.push([a,b]);
    }
    if(pairs.length<2) return 0;
    const xs=pairs.map(p=>p[0]), ys=pairs.map(p=>p[1]);
    const mx=xs.reduce((a,b)=>a+b,0)/xs.length, my=ys.reduce((a,b)=>a+b,0)/ys.length;
    let num=0, dx=0, dy=0;
    for(let i=0;i<pairs.length;i++){ const x=xs[i]-mx, y=ys[i]-my; num+=x*y; dx+=x*x; dy+=y*y; }
    return (dx===0||dy===0)?0:(num/Math.sqrt(dx*dy));
  }

  function correlationSurface3d(rows){
    if(!exists('corr3d')) return;
    const cols = ['pl_orbper','pl_rade','disc_year'];
    const methSet = new Set(['All']);
    rows.forEach(r=> methSet.add(r.discoverymethod||'Other'));
    const methods = Array.from(methSet);

    function buildFor(method){
      const filtered = method==='All' ? rows : rows.filter(r => (r.discoverymethod||'Other')===method);
      const dataCols = cols.map(c => filtered.map(r => r[c]));
      const Z = cols.map((_,i)=> cols.map((__,j)=> corr(dataCols[i], dataCols[j])));
      return Z;
    }

    const z0 = buildFor('All');
    const data = [{
      type:'surface', x: cols, y: cols, z: z0,
      colorscale:'RdBu', reversescale:true, zmin:-1, zmax:1, showscale:true, opacity:.98
    }];
    const layout = {
      paper_bgcolor:'rgba(0,0,0,0)', plot_bgcolor:'rgba(0,0,0,0)',
      margin:{l:0,r:0,b:0,t:20},
      scene:{
        xaxis:{title:'Feature', color:'#cdd3ff', gridcolor:'#394067', tickmode:'array', ticktext:cols, tickvals:cols},
        yaxis:{title:'Feature', color:'#cdd3ff', gridcolor:'#394067', tickmode:'array', ticktext:cols, tickvals:cols},
        zaxis:{title:'Correlation', color:'#cdd3ff', gridcolor:'#394067'},
        bgcolor:'rgba(0,0,0,0)'
      },
      updatemenus:[{
        x:0, y:1.15, xanchor:'left', yanchor:'top', bgcolor:'rgba(20,28,55,.9)', bordercolor:'#232a4b',
        buttons: methods.map(m => ({
          args: [ { z: [ buildFor(m) ] } ],
          label: m, method:'restyle'
        })),
        direction:'down', showactive:true
      }]
    };
    Plotly.react('corr3d', data, layout, {displayModeBar:false});
  }

  // ===== NEW CHARTS =====

  // 1) Histogram of planet radii (by discovery method)
  function histRadius(rows){
    if(!exists('histRadius')) return;
    const groups = by(rows.filter(r=>fmt(r.pl_rade)!=null), 'discoverymethod');
    const traces = Object.entries(groups).slice(0,6).map(([m,arr])=> ({
      type:'histogram',
      x: arr.map(r=>r.pl_rade),
      name: m,
      opacity: 0.75,
      nbinsx: 40,
      hovertemplate: '%{y} planets in bin<br>Radius ~ %{x}<extra>'+m+'</extra>'
    }));
    const layout={barmode:'overlay', paper_bgcolor:'rgba(0,0,0,0)', plot_bgcolor:'rgba(0,0,0,0)',
      margin:{l:30,r:10,b:40,t:10},
      xaxis:{title:'Radius (R⊕)', color:'#cdd3ff', gridcolor:'#394067'},
      yaxis:{title:'Count', color:'#cdd3ff', gridcolor:'#394067'}
    };
    Plotly.react('histRadius', traces, layout, {displayModeBar:false});
  }

  // 2) Box plot radius by method (distribution insight)
  function boxByMethod(rows){
    if(!exists('boxByMethod')) return;
    const groups = by(rows.filter(r=>fmt(r.pl_rade)!=null), 'discoverymethod');
    const traces = Object.entries(groups).map(([m,arr])=> ({
      type:'box',
      y: arr.map(r=>r.pl_rade),
      name: m,
      boxmean: true,
      hovertemplate: m+'<br>R⊕: %{y}<extra></extra>'
    }));
    const layout = {
      paper_bgcolor:'rgba(0,0,0,0)', plot_bgcolor:'rgba(0,0,0,0)',
      margin:{l:30,r:10,b:40,t:10},
      yaxis:{title:'Radius (R⊕)', color:'#cdd3ff', gridcolor:'#394067'},
      xaxis:{title:'Method', color:'#cdd3ff', gridcolor:'#394067'}
    };
    Plotly.react('boxByMethod', traces, layout, {displayModeBar:false});
  }

  // 3) Cumulative discoveries over time
  function cumulativeLine(rows){
    if(!exists('cumLine')) return;
    const perYear = new Map();
    rows.forEach(r=>{ const y=r.disc_year; if(Number.isFinite(y)) perYear.set(y,(perYear.get(y)||0)+1); });
    const years = [...perYear.keys()].sort((a,b)=>a-b);
    let cum=0; const yVals=[], cVals=[];
    years.forEach(y=>{ cum += perYear.get(y); yVals.push(y); cVals.push(cum); });
    const trace={ type:'scatter', mode:'lines+markers', x:yVals, y:cVals, hovertemplate:'Year %{x}<br>Cumulative: %{y}<extra></extra>' };
    const layout={paper_bgcolor:'rgba(0,0,0,0)', plot_bgcolor:'rgba(0,0,0,0)', margin:{l:30,r:10,b:40,t:10},
      xaxis:{title:'Year', color:'#cdd3ff', gridcolor:'#394067'}, yaxis:{title:'Cumulative planets', color:'#cdd3ff', gridcolor:'#394067'}};
    Plotly.react('cumLine',[trace],layout,{displayModeBar:false});
  }

  // 4) Heatmap: year vs radius bins
  function heatYearRadius(rows){
    if(!exists('heatYearRadius')) return;
    const data = rows.filter(r=>Number.isFinite(r.disc_year) && Number.isFinite(r.pl_rade));
    if(!data.length){ Plotly.react('heatYearRadius',[],{}); return; }
    const minY = Math.min(...data.map(r=>r.disc_year));
    const maxY = Math.max(...data.map(r=>r.disc_year));
    const years = Array.from({length:(maxY-minY+1)}, (_,i)=>minY+i);
    const bins = []; // 0-1,1-2,...,9-10,10+
    for(let b=0;b<=10;b++) bins.push(b);
    const Z = Array.from({length:bins.length}, ()=> Array(years.length).fill(0));
    data.forEach(r=>{
      const y = r.disc_year;
      const rad = r.pl_rade;
      const bi = rad>=10 ? 10 : clamp(Math.floor(rad),0,10);
      const yi = y-minY;
      Z[bi][yi]++;
    });
    const labels = bins.map(b=> b===10 ? '≥10' : `${b}-${b+1}`);
    const trace={type:'heatmap', x: years, y: labels, z: Z, colorscale:'Viridis'};
    const layout={paper_bgcolor:'rgba(0,0,0,0)', plot_bgcolor:'rgba(0,0,0,0)', margin:{l:60,r:10,b:40,t:10},
      xaxis:{title:'Year', color:'#cdd3ff', gridcolor:'#394067'},
      yaxis:{title:'Radius bin (R⊕)', color:'#cdd3ff', gridcolor:'#394067'}};
    Plotly.react('heatYearRadius',[trace],layout,{displayModeBar:false});
  }

  // 5) Parallel coordinates for quick multivariate scan
  function parallelCoords(rows){
    if(!exists('parallelCoords')) return;
    const data = rows.filter(r=>Number.isFinite(r.pl_orbper)&&Number.isFinite(r.pl_rade)&&Number.isFinite(r.disc_year));
    if(!data.length){ Plotly.react('parallelCoords',[],{}); return; }
    const orb = data.map(r=>r.pl_orbper);
    const rad = data.map(r=>r.pl_rade);
    const year= data.map(r=>r.disc_year);
    const meth= data.map(r=>r.discoverymethod||'Other');
    const dims=[
      {label:'Period (d)', values: orb, tickformat:'.2f'},
      {label:'Radius (R⊕)', values: rad, tickformat:'.2f'},
      {label:'Year', values: year}
    ];
    const trace = {
      type:'parcoords',
      dimensions:dims,
      line:{color: year, colorscale:'Electric'}
    };
    const layout={paper_bgcolor:'rgba(0,0,0,0)', plot_bgcolor:'rgba(0,0,0,0)', margin:{l:20,r:10,b:10,t:10}};
    Plotly.react('parallelCoords',[trace],layout,{displayModeBar:false});
  }

  // public APIs
  window.draw3DCharts = function(rows){ try{ scatter3d(rows||[]); surface3d(rows||[]); correlationSurface3d(rows||[]);}catch(e){console.error(e);} };
  window.drawMoreCharts = function(rows){ try{ histRadius(rows||[]); boxByMethod(rows||[]); cumulativeLine(rows||[]); heatYearRadius(rows||[]); parallelCoords(rows||[]);}catch(e){console.error(e);} };
  // first run if globals exist
  if(window.FILTERED){ window.drawMoreCharts(window.FILTERED); }
})();