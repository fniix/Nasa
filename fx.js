// نجوم متحركة + شهب تتبع المؤشر + كواكب تتحرك نحو الصاروخ
(function(){
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const starsCanvas = document.getElementById('bgStars');
  const trailsCanvas = document.getElementById('bgTrails');
  if(!starsCanvas || !trailsCanvas) return;
  const sctx = starsCanvas.getContext('2d');
  const tctx = trailsCanvas.getContext('2d');

  let W,H;
  function resize(){
    W = starsCanvas.width = window.innerWidth * devicePixelRatio;
    H = starsCanvas.height = window.innerHeight * devicePixelRatio;
    trailsCanvas.width = W; trailsCanvas.height = H;
  }
  window.addEventListener('resize', resize); resize();

  // نجوم
  const COUNT = Math.min(420, Math.floor((W*H)/16000));
  const stars = Array.from({length: COUNT}, () => ({
    x: Math.random()*W, y: Math.random()*H, z: Math.random()*0.7 + 0.3, tw: Math.random()*Math.PI*2
  }));

  // No mouse-following trail — removed per request
  // Occasional shooting meteors
  let shooting=[];
  function spawnShooting(){
    const y = Math.random()*H*0.6;
    shooting.push({ x: -80, y, vx: (3.5+Math.random()*2)*devicePixelRatio, vy:(1+Math.random()*1.2)*devicePixelRatio });
    if(!reduceMotion) setTimeout(spawnShooting, 2800 + Math.random()*3200);
  }
  if(!reduceMotion) setTimeout(spawnShooting, 2000);

  function draw(){
    // نجوم
    sctx.clearRect(0,0,W,H);
    stars.forEach(s=>{
      s.tw += 0.03;
      const a = 0.55 + Math.sin(s.tw)*0.25;
      sctx.globalAlpha = a;
      sctx.fillStyle = '#ffffff';
      sctx.beginPath();
      sctx.arc(s.x, s.y, (s.z*1.2), 0, Math.PI*2);
      sctx.fill();
      if(!reduceMotion){
        s.x += 0.03*s.z*devicePixelRatio;
        if(s.x>W) s.x=0, s.y=Math.random()*H;
      }
    });
    sctx.globalAlpha = 1;

    // مسح خفيف لذيول
    tctx.fillStyle = 'rgba(8,10,20,0.10)';
    tctx.fillRect(0,0,W,H);

    // Shooting meteors
    shooting.forEach((p, idx)=>{
      p.x += p.vx; p.y += p.vy;
      const grad = tctx.createLinearGradient(p.x-120, p.y-60, p.x, p.y);
      grad.addColorStop(0, 'rgba(124,92,255,0)');
      grad.addColorStop(1, 'rgba(124,92,255,.9)');
      tctx.strokeStyle = grad;
      tctx.lineWidth = 2;
      tctx.beginPath();
      tctx.moveTo(p.x-120, p.y-60); tctx.lineTo(p.x, p.y); tctx.stroke();
      if(p.x>W+150 || p.y>H+90) shooting.splice(idx,1);
    });

    requestAnimationFrame(draw);
  }
  draw();

  // كواكب تتحرك قليلًا باتجاه الصاروخ عند المرور على المساحة
  const art = document.getElementById('heroArt');
  const rocket = document.getElementById('rocket');
  const p1 = document.querySelector('.planet-1');
  const p2 = document.querySelector('.planet-2');
  if(art && rocket && p1 && p2 && !reduceMotion){
    function attract(){
      const rb = rocket.getBoundingClientRect();
      const rcx = (rb.left + rb.right)/2;
      const rcy = (rb.top + rb.bottom)/2;
      [p1,p2].forEach((el,i)=>{
        const b = el.getBoundingClientRect();
        const cx = (b.left + b.right)/2;
        const cy = (b.top + b.bottom)/2;
        const dx = (rcx - cx)*0.06, dy = (rcy - cy)*0.06;
        el.style.transform = `translate(${dx}px, ${dy}px)`;
      });
    }
    art.addEventListener('mousemove', attract);
    art.addEventListener('mouseleave', ()=>{ p1.style.transform=''; p2.style.transform=''; });
  }
})();