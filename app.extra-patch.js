
/* === Minimal hook to draw EXTRA charts (non-breaking) === */
(function(){
  // If charts file defined window.drawMoreCharts, call it after filters apply
  const origApply = window.applyFilters;
  if (typeof origApply === 'function'){
    window.applyFilters = function(){
      const res = origApply.apply(this, arguments);
      try {
        if (typeof window.drawMoreCharts === 'function') window.drawMoreCharts(window.FILTERED||[]);
      } catch(e){ console.error(e); }
      return res;
    };
  } else {
    // fallback: try once on DOM ready
    document.addEventListener('DOMContentLoaded', ()=>{
      try{ if(window.drawMoreCharts) window.drawMoreCharts(window.FILTERED||[]);}catch(e){}
    });
  }
})();