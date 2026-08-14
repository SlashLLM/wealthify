/* ── Utilities ── */
const $  = id => document.getElementById(id);
const fmt  = n => Math.abs(Math.round(n)).toLocaleString('en-NZ');
const clean = v => parseFloat(String(v).replace(/[^0-9.]/g,'')) || 0;

const CASH_CAP = 20000;
let calculatorNewRate = 4.79;
const DEFAULT_CASH_PCT = 0.90;

/* ── Finance helpers ── */
function pmt(P, rAnn, years){
  const r = rAnn/100/12, n = years*12;
  if(r===0) return P/n;
  return P*r/(1-Math.pow(1+r,-n));
}
function totalInterest(P, rAnn, years){
  return pmt(P,rAnn,years)*years*12 - P;
}

/* ── Animated counter ── */
const anims = {};
function animate(id, target){
  const el=$(id); if(!el) return;
  const from = anims[id]??0;
  anims[id] = target;
  const t0=performance.now(), dur=480;
  (function tick(now){
    const p=Math.min(1,(now-t0)/dur);
    const e=1-Math.pow(1-p,3);
    el.textContent = fmt(from+(target-from)*e);
    if(p<1) requestAnimationFrame(tick);
  })(t0);
}

/* ── Slider fill ── */
function setFill(r){
  const p=(r.value-r.min)/(r.max-r.min)*100;
  r.style.setProperty('--p',p+'%');
}

/* ═══════════════════ CHART ═══════════════════ */
let curYearly=[], newYearly=[], hoverYr=null;

function computeYearly(P, rAnn, term){
  const r=rAnn/100/12, n=term*12;
  const mpmt = r===0 ? P/n : P*r/(1-Math.pow(1+r,-n));
  let bal=P, cum=0;
  const out=[0];
  for(let y=0;y<term;y++){
    for(let m=0;m<12;m++){
      const ip=bal*r;
      cum+=ip;
      bal=Math.max(0,bal-(mpmt-ip));
    }
    out.push(cum);
  }
  return out;
}

function drawChart(){
  const canvas=$('savingsChart');
  if(!canvas) return;
  const ctx=canvas.getContext('2d');
  const dpr=window.devicePixelRatio||1;
  const W=canvas.offsetWidth||500;
  const H=canvas.offsetHeight||210;

  canvas.width=W*dpr;
  canvas.height=H*dpr;
  ctx.scale(dpr,dpr);
  ctx.clearRect(0,0,W,H);

  if(curYearly.length<2) return;

  const n=curYearly.length-1;
  const pL=60,pR=16,pT=10,pB=28;
  const cW=W-pL-pR, cH=H-pT-pB;
  const maxV=Math.max(curYearly[n],1);

  const xp=i=>pL+(i/n)*cW;
  const yp=v=>pT+cH*(1-Math.min(v,maxV)/maxV);

  /* ── Grid lines & Y labels ── */
  ctx.font=`500 10px 'Plus Jakarta Sans',sans-serif`;
  ctx.textAlign='right';
  for(let i=0;i<=4;i++){
    const v=maxV*(1-i/4);
    const y=pT+(i/4)*cH;
    ctx.beginPath();
    ctx.strokeStyle='#E4E9F0';
    ctx.lineWidth=1;
    ctx.moveTo(pL,y);
    ctx.lineTo(W-pR,y);
    ctx.stroke();
    ctx.fillStyle='#8B9AAD';
    const lbl=v>=1e6?'$'+(v/1e6).toFixed(1)+'M':v>=1000?'$'+Math.round(v/1000)+'k':'$0';
    ctx.fillText(lbl,pL-5,y+3.5);
  }

  /* ── X-axis labels ── */
  ctx.textAlign='center';
  ctx.fillStyle='#8B9AAD';
  const xstep=n<=10?2:n<=20?5:5;
  for(let i=0;i<=n;i+=xstep){
    ctx.fillText(i+'y',xp(i),H-4);
  }
  if(n%xstep!==0) ctx.fillText(n+'y',xp(n),H-4);

  /* ── Savings fill area ── */
  if(curYearly[n]>newYearly[n]){
    ctx.beginPath();
    ctx.moveTo(xp(0),yp(curYearly[0]));
    for(let i=1;i<=n;i++) ctx.lineTo(xp(i),yp(curYearly[i]));
    for(let i=n;i>=0;i--) ctx.lineTo(xp(i),yp(newYearly[i]));
    ctx.closePath();
    ctx.fillStyle='rgba(22,193,114,0.09)';
    ctx.fill();

    /* Savings label at midpoint */
    const mid=Math.floor(n*0.5);
    const savMid=curYearly[mid]-newYearly[mid];
    const gapPx=Math.abs(yp(newYearly[mid])-yp(curYearly[mid]));
    if(gapPx>28 && savMid>0){
      const midY=(yp(curYearly[mid])+yp(newYearly[mid]))/2;
      ctx.save();
      ctx.fillStyle='rgba(14,158,92,0.75)';
      ctx.font=`600 10.5px 'Plus Jakarta Sans',sans-serif`;
      ctx.textAlign='center';
      ctx.fillText('$'+fmt(savMid)+' saved',xp(mid),midY+4);
      ctx.restore();
    }
  }

  /* ── Current rate line: dashed, muted navy ── */
  ctx.beginPath();
  ctx.setLineDash([5,3]);
  ctx.moveTo(xp(0),yp(curYearly[0]));
  for(let i=1;i<=n;i++) ctx.lineTo(xp(i),yp(curYearly[i]));
  ctx.strokeStyle='rgba(11,31,58,0.38)';
  ctx.lineWidth=2;
  ctx.stroke();
  ctx.setLineDash([]);

  /* ── New rate line: solid green ── */
  ctx.beginPath();
  ctx.moveTo(xp(0),yp(newYearly[0]));
  for(let i=1;i<=n;i++) ctx.lineTo(xp(i),yp(newYearly[i]));
  ctx.strokeStyle='#16C172';
  ctx.lineWidth=2.5;
  ctx.stroke();

  /* ── End-of-line labels ── */
  const endX=xp(n)+4;
  if(endX<W-pR+10){
    // skip if too close to edge
  } else {
    // end labels would overflow — skip
  }

  /* ── Hover crosshair ── */
  if(hoverYr!==null && hoverYr>=0 && hoverYr<=n){
    const hx=xp(hoverYr);
    ctx.beginPath();
    ctx.setLineDash([3,3]);
    ctx.moveTo(hx,pT);
    ctx.lineTo(hx,pT+cH);
    ctx.strokeStyle='rgba(11,31,58,0.18)';
    ctx.lineWidth=1;
    ctx.stroke();
    ctx.setLineDash([]);

    [[curYearly,'rgba(11,31,58,0.5)'],[newYearly,'#16C172']].forEach(([d,col])=>{
      const v=d[hoverYr]??0;
      ctx.beginPath();
      ctx.arc(hx,yp(v),4.5,0,Math.PI*2);
      ctx.fillStyle='#fff';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(hx,yp(v),4.5,0,Math.PI*2);
      ctx.strokeStyle=col;
      ctx.lineWidth=2;
      ctx.stroke();
    });
  }
}

/* ── Chart hover interaction ── */
const chartCanvas=$('savingsChart');
const tooltip=$('chTooltip');

function onChartMove(e){
  const rect=chartCanvas.getBoundingClientRect();
  const mx=(e.touches?e.touches[0].clientX:e.clientX)-rect.left;
  const pL=60,pR=16;
  const cW=rect.width-pL-pR;
  const n=curYearly.length-1;
  if(n<1) return;
  hoverYr=Math.max(0,Math.min(n,Math.round((mx-pL)/cW*n)));
  drawChart();

  const savings=(curYearly[hoverYr]||0)-(newYearly[hoverYr]||0);
  if(savings>0 && hoverYr>0){
    const frac=(pL+(hoverYr/n)*cW)/rect.width;
    tooltip.style.left=(frac*100)+'%';
    tooltip.style.display='block';
    tooltip.textContent='Year '+hoverYr+': $'+fmt(savings)+' saved';
  } else {
    tooltip.style.display='none';
  }
}
chartCanvas.addEventListener('mousemove',onChartMove);
chartCanvas.addEventListener('mouseleave',()=>{
  hoverYr=null;
  tooltip.style.display='none';
  drawChart();
});

/* ══════════════ MAIN RECALCULATION ══════════════ */
function recalc(){
  const bal   = clean($('balNum').value);
  const rate  = clean($('rateNum').value);
  const term  = Math.max(1,Math.round(clean($('termNum').value)));
  const newR  = calculatorNewRate;
  const cashP = DEFAULT_CASH_PCT;

  if(!bal||!rate||!term) return;

  const payCur   = pmt(bal,rate,term);
  const payNew   = pmt(bal,newR,term);
  const intSaved = Math.max(0,totalInterest(bal,rate,term)-totalInterest(bal,newR,term));
  const moSaved  = Math.max(0,payCur-payNew);
  const cashback = Math.min(bal*cashP/100, CASH_CAP);

  /* Animate numbers */
  animate('moSave',moSaved);
  animate('intSave',intSaved);
  animate('cashVal',cashback);

  /* Sub-line */
  $('pmSub').textContent = moSaved>0
    ? `back in your pocket every month — $${fmt(intSaved)} over ${term} yrs total`
    : 'Adjust the rates to see your potential saving';

  /* Chart title */
  $('chartTitle').textContent=
    `Cumulative interest — ${rate}% vs ${newR}% over ${term} years`;

  /* Recompute chart data */
  curYearly=computeYearly(bal,rate,term);
  newYearly=computeYearly(bal,newR,term);
  drawChart();

  reportHeight();
}

/* ── Slider ↔ number field sync ── */
function linkSlider(numId,rangeId,isMoney,dp){
  const num=$(numId), rng=$(rangeId);
  setFill(rng);
  rng.addEventListener('input',()=>{
    const v=clean(rng.value);
    num.value=isMoney?v.toLocaleString('en-NZ'):(dp?v.toFixed(dp):String(v));
    setFill(rng); recalc();
  });
  num.addEventListener('input',()=>{
    const v=clean(num.value);
    if(v>=clean(rng.min)&&v<=clean(rng.max)){rng.value=v;setFill(rng);}
    recalc();
  });
  num.addEventListener('blur',()=>{
    const v=clean(num.value);
    num.value=isMoney?v.toLocaleString('en-NZ'):(dp?v.toFixed(dp):String(v));
  });
}
linkSlider('balNum','balRange',true,0);
linkSlider('rateNum','rateRange',false,2);
linkSlider('termNum','termRange',false,0);

/* ── Lead modal ── */
function leadApiUrl(){
  return '/api/leads';
}

function configApiUrl(){
  return '/api/config';
}

let appConfigPromise = null;
let bankOptions = [];

function buildBankOptionsHtml(){
  return bankOptions.map(b=>`<option value="${b.name.replace(/"/g,'&quot;')}">${b.name}</option>`).join('');
}

function populateBankSelects(banks){
  bankOptions = Array.isArray(banks) ? banks : [];
  const opts = buildBankOptionsHtml();
  const placeholder = '<option value="" disabled selected>Select your bank</option>';
  const calcVal = $('bankSelect').value;
  const gateVal = $('gBank').value;
  $('bankSelect').innerHTML = placeholder + opts;
  $('gBank').innerHTML = placeholder + opts;
  if(calcVal && bankOptions.some(b=>b.name===calcVal)) $('bankSelect').value = calcVal;
  if(gateVal && bankOptions.some(b=>b.name===gateVal)) $('gBank').value = gateVal;
}

function syncBankSelects(fromId){
  const src = $(fromId);
  const otherId = fromId === 'bankSelect' ? 'gBank' : 'bankSelect';
  $(otherId).value = src.value;
}

function loadAppConfig(){
  if(appConfigPromise) return appConfigPromise;
  appConfigPromise = (async ()=>{
    try{
      const res=await fetch(configApiUrl());
      const data=await res.json();
      if(res.ok && data.calculatorNewRate != null){
        const n=Number(data.calculatorNewRate);
        if(Number.isFinite(n) && n>0) calculatorNewRate = n;
      }
      if(res.ok && Array.isArray(data.banks)){
        populateBankSelects(data.banks);
      }
    }catch(err){
      console.warn('Calculator rate unavailable:', err.message);
    }
  })();
  return appConfigPromise;
}

let addressAutocompleteReady = false;
let addressInputListenerReady = false;
let googlePlacesLoadPromise = null;
const ADDRESS_AUTOCOMPLETE_MIN = 10;

function loadGoogleMapsBootstrap(key){
  return new Promise((resolve,reject)=>{
    if(window.google?.maps?.importLibrary){
      resolve();
      return;
    }
    const cb='_wfyGmapsReady'+Date.now();
    window[cb]=()=>{ delete window[cb]; resolve(); };
    const script=document.createElement('script');
    script.src=`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&callback=${cb}`;
    script.async=true;
    script.onerror=()=>{ delete window[cb]; reject(new Error('Failed to load Google Maps')); };
    document.head.appendChild(script);
  });
}

function loadGooglePlaces(){
  if(googlePlacesLoadPromise) return googlePlacesLoadPromise;
  googlePlacesLoadPromise = (async ()=>{
    const res=await fetch(configApiUrl());
    const data=await res.json();
    if(!res.ok) throw new Error(data.error||'Address lookup unavailable');
    const key=data.googlePlacesApiKey;
    if(!key) throw new Error('Address lookup unavailable');
    await loadGoogleMapsBootstrap(key);
    await google.maps.importLibrary('places');
  })();
  return googlePlacesLoadPromise;
}

function bumpPacZIndex(){
  document.querySelectorAll('.pac-container').forEach(el=>{ el.style.zIndex='10000'; });
}

function initAddressAutocomplete(){
  if(addressAutocompleteReady) return;
  const input=$('gAddress');
  if(!input || input.value.trim().length < ADDRESS_AUTOCOMPLETE_MIN) return;
  const Autocomplete=window.google?.maps?.places?.Autocomplete;
  if(!Autocomplete) return;
  const ac=new Autocomplete(input,{
    componentRestrictions:{country:'nz'},
    fields:['formatted_address'],
    types:['address'],
  });
  ac.addListener('place_changed',()=>{
    const place=ac.getPlace();
    if(place.formatted_address) input.value=place.formatted_address;
  });
  addressAutocompleteReady=true;
}

function setupAddressAutocompleteInput(){
  if(addressInputListenerReady) return;
  const input=$('gAddress');
  if(!input) return;
  input.addEventListener('input',()=>{
    if(!addressAutocompleteReady && input.value.trim().length >= ADDRESS_AUTOCOMPLETE_MIN){
      initAddressAutocomplete();
    }
    bumpPacZIndex();
  });
  input.addEventListener('focus', bumpPacZIndex);
  addressInputListenerReady=true;
}

async function ensureAddressAutocomplete(){
  try{
    await loadGooglePlaces();
    setupAddressAutocompleteInput();
    if($('gAddress').value.trim().length >= ADDRESS_AUTOCOMPLETE_MIN){
      initAddressAutocomplete();
    }
  }catch(err){
    console.warn('Address autocomplete unavailable:',err.message);
    showGateError('gateErrorStep2','Address suggestions unavailable — you can still type your address manually.');
  }
}

function requireHttpOrigin(errorElId){
  if(location.protocol!=='file:') return true;
  showGateError(errorElId,'This form needs a local server. Run npm run dev, then open http://localhost:3000');
  return false;
}

function showGateError(elId, message){
  const el=$(elId);
  if(!message){
    el.textContent='';
    el.classList.remove('show');
    return;
  }
  el.textContent=message;
  el.classList.add('show');
}

let leadStep1Rate = null;
let leadStep1Term = null;

function resetLeadModal(){
  $('gateFormWrap').style.display='block';
  $('gateFormStep2').style.display='none';
  $('gateThank').style.display='none';
  showGateError('gateError','');
  showGateError('gateErrorStep2','');
  $('leadForm').reset();
  $('leadForm2').reset();
  $('gBank').value = $('bankSelect').value;
  $('leadFormNext').disabled=false;
  $('leadFormNext').textContent='Next';
  $('leadFormSubmit').disabled=false;
  $('leadFormSubmit').textContent='Submit';
  leadStep1Rate = null;
  leadStep1Term = null;
}

function openLeadModal(){
  resetLeadModal();
  $('gLoanBal').value=$('balNum').value;
  $('gBank').value=$('bankSelect').value;
  $('leadModal').classList.add('open');
  $('leadModal').setAttribute('aria-hidden','false');
  $('gFullName').focus();
  loadGooglePlaces().catch(()=>{});
  reportHeight();
}

function closeLeadModal(){
  $('leadModal').classList.remove('open');
  $('leadModal').setAttribute('aria-hidden','true');
  reportHeight();
}

$('openLeadModal').addEventListener('click',openLeadModal);

$('bankSelect').addEventListener('change',()=>{
  if($('gateFormStep2').style.display!=='none') syncBankSelects('bankSelect');
});
$('gBank').addEventListener('change',()=>syncBankSelects('gBank'));

$('leadModal').addEventListener('click',e=>{
  if(e.target===$('leadModal')) closeLeadModal();
});

document.addEventListener('keydown',e=>{
  if(e.key==='Escape' && $('leadModal').classList.contains('open')) closeLeadModal();
});

$('leadForm').addEventListener('submit',async e=>{
  e.preventDefault();
  showGateError('gateError','');
  const nm=$('gFullName'), em=$('gEmail'), ph=$('gPhone');
  const full_name=nm.value.trim();
  const email=em.value.trim();
  const phone=ph.value.trim();
  const nmOk=full_name.length>=2;
  const emOk=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const phOk=phone.replace(/\D/g,'').length>=8;
  nm.classList.toggle('err',!nmOk);
  em.classList.toggle('err',!emOk);
  ph.classList.toggle('err',!phOk);
  if(!nmOk||!emOk||!phOk) return;
  if(!requireHttpOrigin('gateError')) return;

  const current_rate = clean($('rateNum').value);
  const years_remaining = Math.max(1, Math.round(clean($('termNum').value)));
  const loan_balance = clean($('balNum').value);
  if(!current_rate || !years_remaining || !loan_balance){
    showGateError('gateError','Please complete the calculator fields first.');
    return;
  }

  const btn=$('leadFormNext');
  btn.disabled=true;
  btn.textContent='Saving…';

  try{
    const bank_name = $('bankSelect').value.trim() || undefined;
    const res=await fetch(leadApiUrl(),{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        step:1,
        full_name,
        email,
        phone,
        current_rate,
        years_remaining,
        loan_balance,
        ...(bank_name ? { bank_name } : {}),
      }),
    });
    const data=await res.json();
    if(!res.ok) throw new Error(data.error||'Something went wrong. Please try again.');

    leadStep1Rate = current_rate;
    leadStep1Term = years_remaining;
    $('gateFormWrap').style.display='none';
    $('gateFormStep2').style.display='block';
    $('gLoanBal').value=$('balNum').value;
    $('gBank').value=$('bankSelect').value;
    await ensureAddressAutocomplete();
    $('gAddress').focus();
  }catch(err){
    showGateError('gateError',err.message||'Something went wrong. Please try again.');
  }finally{
    btn.disabled=false;
    btn.textContent='Next';
  }
});

$('leadForm2').addEventListener('submit',async e=>{
  e.preventDefault();
  showGateError('gateErrorStep2','');
  const addr=$('gAddress'), bal=$('gLoanBal'), bank=$('gBank');
  const property_address=addr.value.trim();
  const loan_balance=clean(bal.value);
  const bank_name=bank.value.trim();
  const full_name=$('gFullName').value.trim();
  const email=$('gEmail').value.trim();
  const phone=$('gPhone').value.trim();
  const nmOk=full_name.length>=2;
  const addrOk=property_address.length>0;
  const balOk=loan_balance>0;
  const bankOk=bank_name.length>0;
  const emOk=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const phOk=phone.replace(/\D/g,'').length>=8;
  addr.classList.toggle('err',!addrOk);
  bal.classList.toggle('err',!balOk);
  bank.classList.toggle('err',!bankOk);
  if(!nmOk||!addrOk||!balOk||!bankOk||!emOk||!phOk) return;
  if(!requireHttpOrigin('gateErrorStep2')) return;

  const btn=$('leadFormSubmit');
  btn.disabled=true;
  btn.textContent='Submitting…';

  try{
    const res=await fetch(leadApiUrl(),{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        step:2,
        full_name,
        email,
        phone,
        property_address,
        loan_balance,
        bank_name,
        current_rate: leadStep1Rate ?? clean($('rateNum').value),
        years_remaining: leadStep1Term ?? Math.max(1, Math.round(clean($('termNum').value))),
      }),
    });
    const data=await res.json();
    if(!res.ok) throw new Error(data.error||'Something went wrong. Please try again.');

    $('gateFormStep2').style.display='none';
    $('gateThank').style.display='block';
    $('sentBanner').classList.add('show');
    $('booking').classList.add('show');
    setTimeout(reportHeight,300);
  }catch(err){
    showGateError('gateErrorStep2',err.message||'Something went wrong. Please try again.');
    btn.disabled=false;
    btn.textContent='Submit';
  }
});

/* ── Height reporting to parent ── */
function reportHeight(){
  try{
    const h=Math.max(document.body.scrollHeight,document.documentElement.scrollHeight);
    window.parent.postMessage({type:'rc-resize',height:h},'*');
  }catch(e){}
}

/* ── Resize observer for chart ── */
if(typeof ResizeObserver!=='undefined'){
  new ResizeObserver(()=>drawChart()).observe($('savingsChart'));
}

/* ── Init ── */
loadAppConfig().then(()=>recalc());
window.addEventListener('load',()=>setTimeout(reportHeight,300));
