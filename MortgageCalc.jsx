// MortgageCalc.jsx — Wealthify interactive calculator (pure SVG charts)
const { useState, useEffect, useRef } = React;
const C = { navy:'#0B1F3A', green:'#16C172', teal:'#0FB5BA', bg:'#F6F8FB', ink:'#1A2433', muted:'#5B6B82', border:'#E4E9F0' };

const fmtNZD = n => '$'+Math.round(n).toLocaleString('en-NZ');
const fmtSI  = n => n>=1e6?`$${(n/1e6).toFixed(1)}m`:`$${Math.round(n/1e3)}k`;
const fmtDate= yrs => { const d=new Date(); d.setMonth(d.getMonth()+Math.round(yrs*12)); return d.toLocaleDateString('en-NZ',{month:'short',year:'numeric'}); };
const fcfg   = f => f==='weekly'?{py:52,lbl:'week'}:f==='fortnightly'?{py:26,lbl:'fortnight'}:{py:12,lbl:'month'};

function amortize(amt,rate,term,py,extra=0){
  if(!amt||!rate||!term||!py) return null;
  const r=rate/100/py, n=term*py;
  const base=r ? amt*r*Math.pow(1+r,n)/(Math.pow(1+r,n)-1) : amt/n;
  let bal=amt, intTotal=0, periods=0;
  const sched=[{y:0,bal:Math.round(amt)}];
  const pmt=base+extra;
  for(let i=1; bal>1&&i<=n*2; i++){
    const ip=bal*r, pp=Math.min(pmt-ip,bal);
    if(pp<=0) break;
    bal-=pp; intTotal+=ip; periods=i;
    if(i%py===0) sched.push({y:+(i/py).toFixed(1),bal:Math.round(bal)});
  }
  if(sched[sched.length-1].bal>1) sched.push({y:+(periods/py).toFixed(1),bal:0});
  return {base, intTotal, totalPaid:amt+intTotal, sched, yrs:periods/py};
}

function mergeSched(a,b){
  const allY=[...new Set([...a.map(d=>d.y),...(b||[]).map(d=>d.y)])].sort((x,y)=>x-y);
  const ma=Object.fromEntries(a.map(d=>[d.y,d.bal]));
  const mb=b?Object.fromEntries(b.map(d=>[d.y,d.bal])):null;
  return allY.map(y=>({year:y, current:ma[y]??null, whatif:mb?(mb[y]??0):undefined}));
}

function AnimNum({val}){
  const [n,setN]=useState(val); const prev=useRef(val); const raf=useRef();
  useEffect(()=>{
    const from=prev.current, to=val, t0=performance.now();
    const tick=now=>{
      const p=Math.min((now-t0)/500,1), e=1-Math.pow(1-p,3);
      setN(from+(to-from)*e);
      p<1?(raf.current=requestAnimationFrame(tick)):(prev.current=to);
    };
    raf.current=requestAnimationFrame(tick);
    return()=>cancelAnimationFrame(raf.current);
  },[val]);
  return <span>${Math.round(n).toLocaleString('en-NZ')}</span>;
}

function Slider({label,value,min,max,step,onChange,fmt}){
  const [local,setLocal]=useState(()=>fmt(value));
  useEffect(()=>{setLocal(fmt(value));},[value]);
  const pct=((value-min)/(max-min))*100;
  const commit=()=>{
    const v=parseFloat(local.replace(/[^0-9.]/g,''));
    const c=isNaN(v)?value:Math.max(min,Math.min(max,v));
    onChange(c); setLocal(fmt(c));
  };
  return(
    <div style={{marginBottom:20}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
        <label style={{fontSize:12,color:C.muted,fontWeight:600}}>{label}</label>
        <input type="text" value={local} onChange={e=>setLocal(e.target.value)} onBlur={commit}
          onKeyDown={e=>e.key==='Enter'&&commit()}
          style={{width:96,textAlign:'right',border:`1px solid ${C.border}`,borderRadius:6,padding:'3px 8px',fontSize:13,fontWeight:700,color:C.ink,outline:'none',background:'white'}}/>
      </div>
      <div style={{position:'relative',height:24,display:'flex',alignItems:'center'}}>
        <div style={{position:'absolute',left:0,right:0,height:4,borderRadius:2,background:C.border}}/>
        <div style={{position:'absolute',left:0,width:`${pct}%`,height:4,borderRadius:2,background:`linear-gradient(90deg,${C.green},${C.teal})`}}/>
        <input type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(+e.target.value)}
          style={{position:'absolute',left:0,right:0,width:'100%',height:24,opacity:0,cursor:'pointer',margin:0,padding:0}}/>
      </div>
    </div>
  );
}

function Inputs({s,set}){
  const [showX,setShowX]=useState(s.extra>0);
  const cfg=fcfg(s.freq);
  return(
    <div style={{padding:'20px 22px'}}>
      <Slider label="Loan Amount" value={s.amt} min={100000} max={2000000} step={5000}
        fmt={v=>'$'+Math.round(v).toLocaleString('en-NZ')} onChange={v=>set({...s,amt:v})}/>
      <Slider label="Interest Rate (% p.a.)" value={s.rate} min={1} max={12} step={0.05}
        fmt={v=>v.toFixed(2)+'%'} onChange={v=>set({...s,rate:v})}/>
      <Slider label="Loan Term" value={s.term} min={5} max={30} step={1}
        fmt={v=>v+' years'} onChange={v=>set({...s,term:v})}/>
      <div style={{marginBottom:20}}>
        <div style={{fontSize:12,color:C.muted,fontWeight:600,marginBottom:8}}>Repayment Frequency</div>
        <div style={{display:'flex',gap:3,background:C.bg,borderRadius:8,padding:3,border:`1px solid ${C.border}`}}>
          {['weekly','fortnightly','monthly'].map(f=>(
            <button key={f} onClick={()=>set({...s,freq:f})} style={{
              flex:1,padding:'7px 4px',borderRadius:6,border:'none',fontSize:11,fontWeight:700,
              cursor:'pointer',transition:'all 0.15s',
              background:s.freq===f?C.navy:'transparent',color:s.freq===f?'white':C.muted
            }}>{f[0].toUpperCase()+f.slice(1)}</button>
          ))}
        </div>
      </div>
      {!showX?(
        <button onClick={()=>setShowX(true)} style={{
          width:'100%',background:'none',border:`1.5px dashed ${C.green}`,
          borderRadius:8,padding:10,cursor:'pointer',color:C.green,fontSize:13,fontWeight:700
        }}>+ Add extra repayments</button>
      ):(
        <Slider label={`Extra per ${cfg.lbl} ($)`} value={s.extra} min={0} max={5000} step={50}
          fmt={v=>'$'+Math.round(v).toLocaleString('en-NZ')} onChange={v=>set({...s,extra:v})}/>
      )}
    </div>
  );
}

function Results({res,s,base}){
  if(!res) return null;
  const cfg=fcfg(s.freq);
  const saved=s.extra>0&&base?base.intTotal-res.intTotal:null;
  const ySaved=s.extra>0&&base?base.yrs-res.yrs:null;
  return(
    <div style={{padding:'18px 22px 8px'}}>
      <div style={{textAlign:'center',background:`linear-gradient(135deg,${C.navy},#162d5a)`,borderRadius:14,padding:'18px 14px',marginBottom:12,color:'white'}}>
        <div style={{fontSize:11,opacity:0.65,letterSpacing:'0.5px',marginBottom:3}}>YOUR {cfg.lbl.toUpperCase()}LY REPAYMENT</div>
        <div style={{fontSize:40,fontWeight:800,letterSpacing:'-1.5px',lineHeight:1.1}}><AnimNum val={res.base}/></div>
        <div style={{fontSize:11,opacity:0.55,marginTop:4}}>{res.yrs.toFixed(1)} year loan · {s.rate.toFixed(2)}% p.a.</div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
        {[
          {l:'Total interest',v:fmtNZD(res.intTotal),c:'#d45a5a'},
          {l:'Total repaid',v:fmtNZD(res.totalPaid),c:C.ink},
          {l:'Loan-free',v:fmtDate(res.yrs),c:C.teal},
          {l:'Interest rate',v:s.rate.toFixed(2)+'%',c:C.navy},
        ].map(({l,v,c})=>(
          <div key={l} style={{background:C.bg,borderRadius:8,padding:'10px 12px',border:`1px solid ${C.border}`}}>
            <div style={{fontSize:10,color:C.muted,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.4px',marginBottom:3}}>{l}</div>
            <div style={{fontSize:15,fontWeight:700,color:c}}>{v}</div>
          </div>
        ))}
      </div>
      {saved>100&&(
        <div style={{background:`${C.green}12`,border:`1px solid ${C.green}40`,borderRadius:10,padding:'11px 14px',marginBottom:12}}>
          <div style={{fontSize:12,fontWeight:700,color:C.green,marginBottom:3}}>Extra repayments boost</div>
          <div style={{fontSize:12,color:C.ink,lineHeight:1.5}}>
            Paying <strong>{fmtNZD(s.extra)}</strong> extra per {cfg.lbl} saves you{' '}
            <strong style={{color:C.green}}>{fmtNZD(saved)}</strong> in interest and clears your loan{' '}
            <strong>{Math.abs(ySaved).toFixed(1)} years</strong> sooner.
          </div>
        </div>
      )}
    </div>
  );
}

// Pure SVG area chart — no external dependencies
function SvgAreaChart({data, showWif}){
  const VW=500, VH=170;
  const pad={t:8,r:8,b:26,l:52};
  const cw=VW-pad.l-pad.r, ch=VH-pad.t-pad.b;
  if(!data||data.length<2) return null;
  const maxYear=Math.max(...data.map(d=>d.year));
  const maxBal=data[0]?.current||1;
  if(!maxYear||!maxBal) return null;
  const px=yr=>(yr/maxYear)*cw;
  const py=bal=>ch-(Math.max(0,Math.min(bal,maxBal))/maxBal)*ch;
  const pts=(key)=>data.filter(d=>d[key]!=null&&typeof d[key]==='number').map(d=>[px(d.year),py(d[key])]);
  const line=(ps)=>ps.length<2?'':'M '+ps.map(p=>p.join(' ')).join(' L ');
  const area=(ps)=>{if(ps.length<2) return ''; const l=ps[ps.length-1],f=ps[0]; return line(ps)+` L ${l[0]} ${ch} L ${f[0]} ${ch} Z`;};
  const curPts=pts('current'), wifPts=showWif?pts('whatif'):[];
  const yStep=maxBal/4;
  const xStep=maxYear<=10?2:maxYear<=20?5:10;
  return(
    <svg width="100%" height={VH} viewBox={`0 0 ${VW} ${VH}`} style={{display:'block'}}>
      <defs>
        <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0B1F3A" stopOpacity="0.15"/><stop offset="95%" stopColor="#0B1F3A" stopOpacity="0"/></linearGradient>
        <linearGradient id="wg2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#16C172" stopOpacity="0.15"/><stop offset="95%" stopColor="#16C172" stopOpacity="0"/></linearGradient>
      </defs>
      <g transform={`translate(${pad.l},${pad.t})`}>
        {[0,1,2,3,4].map(i=>{const yv=yStep*i; const yp=py(yv); return(
          <g key={i}><line x1={0} y1={yp} x2={cw} y2={yp} stroke="#E4E9F0" strokeWidth={1}/><text x={-5} y={yp+4} textAnchor="end" fontSize={9} fill="#5B6B82">{fmtSI(yv)}</text></g>
        );})}
        {Array.from({length:Math.floor(maxYear/xStep)+1},(_,i)=>i*xStep).filter(v=>v<=maxYear).map(v=>(
          <text key={v} x={px(v)} y={ch+18} textAnchor="middle" fontSize={9} fill="#5B6B82">{`Yr ${v}`}</text>
        ))}
        {curPts.length>1&&<path d={area(curPts)} fill="url(#cg)"/>}
        {curPts.length>1&&<path d={line(curPts)} fill="none" stroke="#0B1F3A" strokeWidth={2} strokeLinejoin="round"/>}
        {wifPts.length>1&&<path d={area(wifPts)} fill="url(#wg2)"/>}
        {wifPts.length>1&&<path d={line(wifPts)} fill="none" stroke="#16C172" strokeWidth={2} strokeLinejoin="round" strokeDasharray="6 3"/>}
      </g>
    </svg>
  );
}

// Pure SVG donut chart
function SvgDonut({principal, interest}){
  const total=principal+interest;
  if(total<=0) return null;
  const cx=55,cy=55,ro=50,ri=28;
  const slice=(start,pct,color)=>{
    if(pct<=0) return null;
    if(pct>=0.9999) return <circle cx={cx} cy={cy} r={ro} fill={color} key={color}/>;
    const a1=(start-90)*Math.PI/180, a2=(start+pct*360-90)*Math.PI/180;
    const lg=pct>0.5?1:0;
    const x1o=cx+ro*Math.cos(a1),y1o=cy+ro*Math.sin(a1);
    const x2o=cx+ro*Math.cos(a2),y2o=cy+ro*Math.sin(a2);
    const x1i=cx+ri*Math.cos(a1),y1i=cy+ri*Math.sin(a1);
    const x2i=cx+ri*Math.cos(a2),y2i=cy+ri*Math.sin(a2);
    return <path key={color} d={`M ${x1o} ${y1o} A ${ro} ${ro} 0 ${lg} 1 ${x2o} ${y2o} L ${x2i} ${y2i} A ${ri} ${ri} 0 ${lg} 0 ${x1i} ${y1i} Z`} fill={color}/>;
  };
  const pP=principal/total;
  return(
    <svg width={110} height={110}>
      {slice(0,pP,'#0B1F3A')}
      {slice(pP*360,1-pP,'#d45a5a')}
      <circle cx={cx} cy={cy} r={ri} fill="white"/>
    </svg>
  );
}

function Charts({curRes,wifRes,showWif,amt}){
  if(!curRes) return null;
  const data=mergeSched(curRes.sched, showWif&&wifRes?wifRes.sched:null);
  const activeRes=showWif&&wifRes?wifRes:curRes;
  const pieData=[['Principal',amt,'#0B1F3A'],['Interest',Math.round(activeRes.intTotal),'#d45a5a']];
  return(
    <div style={{padding:'0 22px 20px'}}>
      <div style={{marginBottom:18}}>
        <div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:8}}>
          Balance Over Time{showWif&&wifRes&&' · Current vs What-If'}
        </div>
        <SvgAreaChart data={data} showWif={showWif&&!!wifRes}/>
      </div>
      <div style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:8}}>Principal vs Interest</div>
      <div style={{display:'flex',alignItems:'center',gap:16}}>
        <SvgDonut principal={amt} interest={Math.round(activeRes.intTotal)}/>
        <div>
          {pieData.map(([n,v,c])=>(
            <div key={n} style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
              <div style={{width:10,height:10,borderRadius:2,background:c,flexShrink:0}}/>
              <div>
                <div style={{fontSize:10,color:C.muted}}>{n}</div>
                <div style={{fontSize:13,fontWeight:700,color:C.ink}}>{fmtNZD(v)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

let googlePlacesLoadPromise = null;
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

function loadGooglePlaces(key){
  if(googlePlacesLoadPromise) return googlePlacesLoadPromise;
  googlePlacesLoadPromise = (async ()=>{
    if(!key) throw new Error('Address lookup unavailable');
    await loadGoogleMapsBootstrap(key);
    await window.google.maps.importLibrary('places');
  })();
  return googlePlacesLoadPromise;
}

function MortgageCalc(){
  const dflt={amt:650000,rate:6.5,term:30,freq:'fortnightly',extra:0};
  const [tab,setTab]=useState('current');
  const [cur,setCur]=useState(dflt);
  const [wif,setWif]=useState({...dflt,rate:5.5});
  const cc=fcfg(cur.freq), wc=fcfg(wif.freq);
  const cRes=amortize(cur.amt,cur.rate,cur.term,cc.py,cur.extra);
  const cBase=amortize(cur.amt,cur.rate,cur.term,cc.py,0);
  const wRes=amortize(wif.amt,wif.rate,wif.term,wc.py,wif.extra);
  const wBase=amortize(wif.amt,wif.rate,wif.term,wc.py,0);
  const isCur=tab==='current';
  const s=isCur?cur:wif, set=isCur?setCur:setWif;
  const res=isCur?cRes:wRes, base=isCur?cBase:wBase;
  const diff=cRes&&wRes?cRes.intTotal-wRes.intTotal:null;

  // Modal States
  const [modalOpen, setModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState(1);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [bank, setBank] = useState('');
  const [address, setAddress] = useState('');
  const [loanBal, setLoanBal] = useState('');

  const [banksList, setBanksList] = useState([]);
  const [googleKey, setGoogleKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState('');
  const [errors, setErrors] = useState({});

  const addressInputRef = useRef(null);
  const autocompleteRef = useRef(null);

  useEffect(() => {
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data.banks)) {
          setBanksList(data.banks);
        }
        if (data.googlePlacesApiKey) {
          setGoogleKey(data.googlePlacesApiKey);
        }
      })
      .catch(err => console.warn('Failed to load calculator config:', err));
  }, []);

  const initAutocomplete = async () => {
    if (!googleKey || !addressInputRef.current) return;
    try {
      await loadGooglePlaces(googleKey);
      const Autocomplete = window.google?.maps?.places?.Autocomplete;
      if (!Autocomplete || autocompleteRef.current) return;
      autocompleteRef.current = new Autocomplete(addressInputRef.current, {
        componentRestrictions: { country: 'nz' },
        fields: ['formatted_address'],
        types: ['address'],
      });
      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current.getPlace();
        if (place.formatted_address) {
          setAddress(place.formatted_address);
        }
      });
    } catch (err) {
      console.warn('Autocomplete init failed:', err);
    }
  };

  useEffect(() => {
    if (modalOpen && modalStep === 2 && googleKey) {
      // Small timeout to ensure DOM ref is bound
      setTimeout(initAutocomplete, 50);
    }
    const interval = setInterval(() => {
      const pacs = document.querySelectorAll('.pac-container');
      if (pacs.length > 0) {
        pacs.forEach(el => { el.style.zIndex = '100000'; });
      }
    }, 300);
    return () => clearInterval(interval);
  }, [modalOpen, modalStep, googleKey]);

  const openModal = () => {
    setModalOpen(true);
    setModalStep(1);
    setFullName('');
    setEmail('');
    setPhone('');
    setBank('');
    setAddress('');
    setLoanBal(s.amt.toLocaleString('en-NZ'));
    setErrors({});
    setApiError('');
    setIsSubmitting(false);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setModalOpen(false);
      }
    };
    if (modalOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalOpen]);

  const cleanNum = v => parseFloat(String(v).replace(/[^0-9.]/g, '')) || 0;

  const handleStep1Submit = async (e) => {
    e.preventDefault();
    setApiError('');
    const newErrors = {
      fullName: fullName.trim().length < 2,
      email: !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()),
      phone: phone.replace(/\D/g, '').length < 8,
    };
    setErrors(newErrors);
    if (newErrors.fullName || newErrors.email || newErrors.phone) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 1,
          full_name: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          current_rate: s.rate,
          years_remaining: s.term,
          loan_balance: s.amt,
          source: 'borrowing-capacity-calculator',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit step 1');

      setModalStep(2);
    } catch (err) {
      setApiError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStep2Submit = async (e) => {
    e.preventDefault();
    setApiError('');
    const loanVal = cleanNum(loanBal);
    const newErrors = {
      bank: !bank.trim(),
      address: !address.trim(),
      loanBal: loanVal <= 0,
    };
    setErrors(newErrors);
    if (newErrors.bank || newErrors.address || newErrors.loanBal) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 2,
          full_name: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          property_address: address.trim(),
          loan_balance: loanVal,
          bank_name: bank.trim(),
          current_rate: s.rate,
          years_remaining: s.term,
          source: 'borrowing-capacity-calculator',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit step 2');

      setModalStep(3);
    } catch (err) {
      setApiError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderModal = () => {
    if (!modalOpen) return null;

    return (
      <div 
        onClick={() => setModalOpen(false)}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 100000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          background: 'rgba(11, 31, 58, 0.45)',
          backdropFilter: 'blur(4px)',
        }}
      >
        <div 
          onClick={(e) => e.stopPropagation()}
          style={{
            background: '#fff',
            border: '1.5px solid #E4E9F0',
            borderRadius: '14px',
            padding: '24px',
            width: '100%',
            maxWidth: '420px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 16px 44px rgba(11, 31, 58, 0.10)',
            fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
            color: '#1A2433',
            textAlign: 'left',
          }}
        >
          {modalStep === 1 && (
            <div>
              <h4 style={{ fontSize: 17, fontWeight: 800, color: '#0B1F3A', letterSpacing: '-0.3px', margin: '0 0 5px 0' }}>
                See which bank saves you the most
              </h4>
              <p style={{ fontSize: 13, color: '#5B6B82', marginBottom: 14, marginTop: 0, lineHeight: 1.5 }}>
                Unlock your personalised lender comparison — no obligation.
              </p>
              <div style={{ marginBottom: 16 }}>
                {[
                  'Bank-by-bank rate & repayment table',
                  'Net benefit after cashback & switch costs',
                  'Your simple action plan',
                ].map((item, index) => (
                  <div 
                    key={index}
                    style={{
                      fontSize: 12.5,
                      fontWeight: 500,
                      color: '#1A2433',
                      padding: '4px 0 4px 20px',
                      position: 'relative',
                    }}
                  >
                    <span 
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 9,
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: '#16C172',
                      }}
                    />
                    {item}
                  </div>
                ))}
              </div>

              {apiError && (
                <div style={{
                  marginBottom: 10,
                  padding: '9px 12px',
                  background: 'rgba(229, 72, 77, 0.08)',
                  border: '1px solid rgba(229, 72, 77, 0.25)',
                  borderRadius: 8,
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: '#C53030',
                }}>
                  {apiError}
                </div>
              )}

              <form onSubmit={handleStep1Submit} noValidate>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#0B1F3A', marginBottom: 4 }}>
                    Full name
                  </label>
                  <input 
                    type="text" 
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jane Smith"
                    autoComplete="name"
                    style={{
                      width: '100%',
                      height: 42,
                      border: `1.5px solid ${errors.fullName ? '#E5484D' : '#E4E9F0'}`,
                      boxShadow: errors.fullName ? '0 0 0 3px rgba(229,72,77,.09)' : 'none',
                      borderRadius: 8,
                      padding: '0 12px',
                      fontSize: 14,
                      fontWeight: 500,
                      color: '#0B1F3A',
                      background: '#F6F8FB',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#0B1F3A', marginBottom: 4 }}>
                    Email address
                  </label>
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@email.co.nz"
                    autoComplete="email"
                    style={{
                      width: '100%',
                      height: 42,
                      border: `1.5px solid ${errors.email ? '#E5484D' : '#E4E9F0'}`,
                      boxShadow: errors.email ? '0 0 0 3px rgba(229,72,77,.09)' : 'none',
                      borderRadius: 8,
                      padding: '0 12px',
                      fontSize: 14,
                      fontWeight: 500,
                      color: '#0B1F3A',
                      background: '#F6F8FB',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#0B1F3A', marginBottom: 4 }}>
                    Mobile number
                  </label>
                  <input 
                    type="tel" 
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="021 234 5678"
                    autoComplete="tel"
                    style={{
                      width: '100%',
                      height: 42,
                      border: `1.5px solid ${errors.phone ? '#E5484D' : '#E4E9F0'}`,
                      boxShadow: errors.phone ? '0 0 0 3px rgba(229,72,77,.09)' : 'none',
                      borderRadius: 8,
                      padding: '0 12px',
                      fontSize: 14,
                      fontWeight: 500,
                      color: '#0B1F3A',
                      background: '#F6F8FB',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  style={{
                    width: '100%',
                    height: 46,
                    background: '#16C172',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 700,
                    color: '#fff',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    opacity: isSubmitting ? 0.65 : 1,
                    transition: 'background .15s',
                  }}
                >
                  {isSubmitting ? 'Saving…' : 'Next'}
                </button>
              </form>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginTop: 10, fontSize: 11, color: '#8B9AAD', lineHeight: 1.5 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16C172" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                No spam — one report, then only if you want a call. Your details stay with Wealthify.
              </div>
            </div>
          )}

          {modalStep === 2 && (
            <div>
              <h4 style={{ fontSize: 17, fontWeight: 800, color: '#0B1F3A', letterSpacing: '-0.3px', margin: '0 0 5px 0' }}>
                Almost there
              </h4>
              <p style={{ fontSize: 13, color: '#5B6B82', marginBottom: 14, marginTop: 0, lineHeight: 1.5 }}>
                Tell us about your property so we can prepare your comparison.
              </p>

              {apiError && (
                <div style={{
                  marginBottom: 10,
                  padding: '9px 12px',
                  background: 'rgba(229, 72, 77, 0.08)',
                  border: '1px solid rgba(229, 72, 77, 0.25)',
                  borderRadius: 8,
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: '#C53030',
                }}>
                  {apiError}
                </div>
              )}

              <form onSubmit={handleStep2Submit} noValidate>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#0B1F3A', marginBottom: 4 }}>
                    Current bank
                  </label>
                  <select 
                    value={bank}
                    onChange={(e) => setBank(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      height: 42,
                      border: `1.5px solid ${errors.bank ? '#E5484D' : '#E4E9F0'}`,
                      boxShadow: errors.bank ? '0 0 0 3px rgba(229,72,77,.09)' : 'none',
                      borderRadius: 8,
                      padding: '0 12px',
                      fontSize: 14,
                      fontWeight: 500,
                      color: bank ? '#0B1F3A' : '#8B9AAD',
                      background: '#F6F8FB',
                      outline: 'none',
                      cursor: 'pointer',
                      boxSizing: 'border-box',
                      appearance: 'none',
                      backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238B9AAD' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")",
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 12px center',
                      paddingRight: 32,
                    }}
                  >
                    <option value="" disabled>Select your bank</option>
                    {banksList.map(b => (
                      <option key={b.id} value={b.name}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: 12, position: 'relative' }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#0B1F3A', marginBottom: 4 }}>
                    Property address
                  </label>
                  <input 
                    type="text" 
                    ref={addressInputRef}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="123 Example St, Auckland"
                    autoComplete="off"
                    style={{
                      width: '100%',
                      height: 42,
                      border: `1.5px solid ${errors.address ? '#E5484D' : '#E4E9F0'}`,
                      boxShadow: errors.address ? '0 0 0 3px rgba(229,72,77,.09)' : 'none',
                      borderRadius: 8,
                      padding: '0 12px',
                      fontSize: 14,
                      fontWeight: 500,
                      color: '#0B1F3A',
                      background: '#F6F8FB',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#0B1F3A', marginBottom: 4 }}>
                    Loan balance
                  </label>
                  <input 
                    type="text" 
                    value={loanBal}
                    onChange={(e) => setLoanBal(e.target.value)}
                    placeholder="500,000"
                    inputMode="numeric"
                    autoComplete="off"
                    style={{
                      width: '100%',
                      height: 42,
                      border: `1.5px solid ${errors.loanBal ? '#E5484D' : '#E4E9F0'}`,
                      boxShadow: errors.loanBal ? '0 0 0 3px rgba(229,72,77,.09)' : 'none',
                      borderRadius: 8,
                      padding: '0 12px',
                      fontSize: 14,
                      fontWeight: 500,
                      color: '#0B1F3A',
                      background: '#F6F8FB',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  style={{
                    width: '100%',
                    height: 46,
                    background: '#16C172',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 700,
                    color: '#fff',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    opacity: isSubmitting ? 0.65 : 1,
                    transition: 'background .15s',
                  }}
                >
                  {isSubmitting ? 'Submitting…' : 'Submit'}
                </button>
              </form>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginTop: 10, fontSize: 11, color: '#8B9AAD', lineHeight: 1.5 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16C172" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                No spam — one report, then only if you want a call. Your details stay with Wealthify.
              </div>
            </div>
          )}

          {modalStep === 3 && (
            <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
              <div 
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  background: 'rgba(22, 193, 114, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16C172" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5"/>
                </svg>
              </div>
              <h4 style={{ fontSize: 17, fontWeight: 800, color: '#0B1F3A', margin: '0 0 8px 0', letterSpacing: '-0.3px' }}>
                Thank you for your submission
              </h4>
              <p style={{ fontSize: 13.5, color: '#5B6B82', lineHeight: 1.6, margin: '0 0 20px 0' }}>
                One of our licensed advisers will be in touch shortly to walk you through your personalised lender comparison and answer any questions.
              </p>
              <div style={{ background: '#F6F8FB', border: '1px solid #E4E9F0', borderRadius: 10, padding: '14px 16px', textAlign: 'left' }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: '#8B9AAD', marginBottom: 10 }}>
                  What happens next
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { text: 'We prepare your personalised lender comparison', color: '#16C172' },
                    { text: 'An adviser will reach out within one business day', color: '#0FB5BA' },
                    { text: 'No obligation — free advice, always', color: '#0B1F3A' },
                  ].map((item, index) => (
                    <div key={index} style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                      <div 
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: '50%',
                          background: item.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          marginTop: 1,
                        }}
                      >
                        <svg width="9" height="9" viewBox="0 0 16 16" fill="none">
                          <path d="M3 8.5 L6.5 12 L13 4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                      </div>
                      <span style={{ fontSize: 12.5, color: '#1A2433', fontWeight: 500, lineHeight: 1.4 }}>
                        {item.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return(
    <div style={{fontFamily:"'Plus Jakarta Sans','Inter',sans-serif",color:C.ink,background:'white',borderRadius:16,overflow:'hidden'}}>
      <div style={{display:'flex',borderBottom:`1px solid ${C.border}`}}>
        {[['current','Current scenario'],['whatif','What if?']].map(([id,lbl])=>(
          <button key={id} onClick={()=>setTab(id)} style={{
            flex:1,padding:'14px 20px',border:'none',background:'none',cursor:'pointer',
            fontWeight:700,fontSize:13,fontFamily:'inherit',
            color:tab===id?C.navy:C.muted,
            borderBottom:tab===id?`2.5px solid ${C.green}`:'2.5px solid transparent',
            transition:'all 0.15s'
          }}>{lbl}</button>
        ))}
      </div>
      {diff!==null&&(
        <div style={{
          borderBottom:`1px solid ${Math.abs(diff)>1000?(diff>0?C.green+'40':'#d45a5a40'):C.border}`,
          background:Math.abs(diff)>1000?(diff>0?'#16C17210':'#d45a5a10'):'transparent',
          padding:'8px 22px',fontSize:12,textAlign:'center',color:C.ink
        }}>
          {diff>1000?`What-If saves ${fmtNZD(diff)} in interest vs Current`:
           diff<-1000?`What-If costs ${fmtNZD(-diff)} more in interest`:
           `Scenarios are similar — try adjusting the What-If rate or term`}
        </div>
      )}
      <div style={{display:'grid',gridTemplateColumns:'minmax(240px,2fr) minmax(280px,3fr)'}}>
        <div style={{borderRight:`1px solid ${C.border}`}}><Inputs s={s} set={set}/></div>
        <div style={{overflowY:'auto',maxHeight:660}}>
          <Results res={res} s={s} base={base}/>
          <Charts curRes={cRes} wifRes={wRes} showWif={!isCur} amt={s.amt}/>
        </div>
      </div>
      <div style={{borderTop:`1px solid ${C.border}`,padding:'12px 20px',background:C.bg,display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}>
        <p style={{fontSize:11,color:C.muted,margin:0,flex:1,lineHeight:1.4}}>
          Estimates only. Not financial advice. Consult a licensed NZ financial adviser for personalised guidance.
        </p>
        <div style={{display:'flex',gap:8,flexShrink:0}}>
          <button 
            onClick={openModal}
            style={{padding:'8px 14px',borderRadius:8,border:`1px solid ${C.border}`,background:'white',color:C.navy,fontSize:12,fontWeight:600,cursor:'pointer'}}
          >
            Book a free call
          </button>
          <button 
            onClick={openModal}
            style={{padding:'8px 14px',borderRadius:8,border:'none',background:C.green,color:'white',fontSize:12,fontWeight:700,cursor:'pointer'}}
          >
            Get my plan →
          </button>
        </div>
      </div>
      {renderModal()}
    </div>
  );
}

window.MortgageCalc = MortgageCalc;
