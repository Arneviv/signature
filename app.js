// --- KONFIGURASJON ---
// Legg PDF i /public/document.pdf i Vercel-prosjektet, eller endre URL her.
const PDF_URL  = "document.pdf";   // relativ til domenet/prosjektet
const ENDPOINT = "public_html/api";  // ditt POST-endepunkt
// ---------------------

// Elementer
const frame     = document.getElementById('pdfFrame');
const bar       = document.getElementById('bar');
const pdfWrap   = document.getElementById('pdfWrap');
const hint      = document.getElementById('hint');
const signPanel = document.getElementById('signPanel');
const canvas    = document.getElementById('sig');
const wrap      = document.getElementById('sigWrap');
const statusEl  = document.getElementById('status');
const clearBtn  = document.getElementById('clearBtn');
const sendBtn   = document.getElementById('sendBtn');
const downloadBtn = document.getElementById('downloadBtn');
const fullName  = document.getElementById('fullName');

// Sett PDF-kilde
frame.src = PDF_URL;

// Progressbar ved scrolling
function clamp(n,min,max){return Math.max(min, Math.min(max, n));}
function onScroll(){
  const start = pdfWrap.offsetTop;
  const end = start + pdfWrap.offsetHeight - window.innerHeight;
  const pct = clamp( (window.scrollY - start) / (end - start || 1), 0, 1);
  bar.style.width = (pct*100).toFixed(1) + "%";
}
addEventListener('scroll', onScroll, {passive:true});
addEventListener('resize', onScroll);
onScroll();

// Hint-knapp som scroller til signatur
hint.addEventListener('click', () => signPanel.scrollIntoView({behavior:'smooth', block:'start'}));
const io = new IntersectionObserver((entries)=>{
  entries.forEach(e=>{
    hint.style.display = e.isIntersecting ? 'none' : 'flex';
  });
}, {threshold: .2});
io.observe(signPanel);

// Signatur-canvas
const ctx = canvas.getContext('2d', { willReadFrequently: false });
let drawing = false, last = null, hasInk = false;

function resizeCanvas(){
  const rect = wrap.getBoundingClientRect();
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(180 * dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0,0, canvas.width, canvas.height);
  ctx.fillStyle = "#aaa";
  ctx.font = "12px system-ui";
  ctx.fillText("Signér her", 10, 18);
  hasInk = false;
  updateButtons();
}
function ptFromEvent(ev){
  const r = canvas.getBoundingClientRect();
  if(ev.touches && ev.touches[0]){
    return { x: ev.touches[0].clientX - r.left, y: ev.touches[0].clientY - r.top };
  } else {
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  }
}
function startDraw(ev){
  ev.preventDefault();
  drawing = true;
  last = ptFromEvent(ev);
  if (canvas.setPointerCapture && ev.pointerId !== undefined) {
    try { canvas.setPointerCapture(ev.pointerId); } catch {}
  }
}
function moveDraw(ev){
  if(!drawing) return;
  ev.preventDefault();
  const p = ptFromEvent(ev);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(last.x, last.y);
  ctx.lineTo(p.x, p.y);
  ctx.stroke();
  last = p;
  hasInk = true;
  updateButtons();
}
function endDraw(){
  if(!drawing) return;
  drawing = false;
  last = null;
  updateButtons();
}

// Input-hendelser
if(window.PointerEvent){
  canvas.addEventListener('pointerdown', startDraw);
  canvas.addEventListener('pointermove', moveDraw);
  addEventListener('pointerup', endDraw);
  addEventListener('pointercancel', endDraw);
} else {
  canvas.addEventListener('mousedown', startDraw);
  addEventListener('mousemove', moveDraw);
  addEventListener('mouseup', endDraw);
  canvas.addEventListener('touchstart', startDraw, {passive:false});
  canvas.addEventListener('touchmove', moveDraw, {passive:false});
  canvas.addEventListener('touchend', endDraw);
  canvas.addEventListener('touchcancel', endDraw);
}

addEventListener('resize', resizeCanvas);
resizeCanvas();

// Kontroller
function updateButtons(){ sendBtn.disabled = !hasInk; }

clearBtn.addEventListener('click', ()=>{
  resizeCanvas();
  statusEl.textContent = "Klar for signering";
  statusEl.className = "meta";
});

downloadBtn.addEventListener('click', ()=>{
  if(!hasInk){ alert("Ingen signatur å laste ned."); return; }
  const url = canvas.toDataURL("image/png");
  const n = (fullName.value || "signatur").trim().replace(/\s+/g,'_') || 'signatur';
  const a = document.createElement('a');
  a.href = url;
  a.download = `${n}_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
});

sendBtn.addEventListener('click', async ()=>{
  if(!hasInk){ return; }
  sendBtn.disabled = true;
  statusEl.textContent = "Sender…";
  statusEl.className = "meta";
  try{
    const signaturePng = canvas.toDataURL("image/png");
    const payload = {
      docUrl: PDF_URL,
      fullName: fullName.value || null,
      signedAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
      signaturePng
    };
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(payload)
    });
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    statusEl.textContent = "Signatur sendt ✅";
    statusEl.className = "meta ok";
  }catch(err){
    console.error(err);
    statusEl.textContent = "Kunne ikke sende. Last ned PNG og prøv igjen.";
    statusEl.className = "meta err";
    sendBtn.disabled = false;
  }
});

// Enter for å sende
fullName.addEventListener('keydown', (e)=>{
  if(e.key === 'Enter' && !sendBtn.disabled) sendBtn.click();
});

