(function(){
  var STATE = {
    data: [], rows: [], columns: [],
    search: '', term: 12, sort: 'rate-asc', view: 'card',
    expanded: {}, compare: []
  };
  var MONEY_PRINCIPAL = 500000, MONEY_MONTHS = 300;

  function monthlyPayment(annualRatePct){
    var r = (annualRatePct/100)/12;
    if (!r) return MONEY_PRINCIPAL / MONEY_MONTHS;
    var pow = Math.pow(1+r, MONEY_MONTHS);
    return MONEY_PRINCIPAL * r * pow / (pow - 1);
  }
  function fmtMoney(n){ return '$' + Math.round(n).toLocaleString('en-NZ'); }
  function fmtRate(n){ return (n === 0 ? '0.00' : n.toFixed(2)) + '%'; }
  function esc(s){ return String(s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }

  function columnLabel(termInMonths, term){
    if (termInMonths === null) return 'Variable';
    return term.replace(' months','mo').replace(' month','mo').replace(' years','yr').replace(' year','yr');
  }

  function buildColumns(data){
    var seen = {};
    data.forEach(function(inst){
      inst.products.forEach(function(p){
        p.rates.forEach(function(r){
          var key = r.termInMonths === null ? 'null' : r.termInMonths;
          if (!(key in seen)) seen[key] = { termInMonths: r.termInMonths, term: r.term };
        });
      });
    });
    var cols = Object.keys(seen).map(function(k){ return seen[k]; });
    cols.sort(function(a,b){
      var av = a.termInMonths === null ? -1 : a.termInMonths;
      var bv = b.termInMonths === null ? -1 : b.termInMonths;
      return av - bv;
    });
    return cols;
  }

  function bestRateForInstitution(inst, termInMonths){
    var best = null;
    inst.products.forEach(function(p){
      p.rates.forEach(function(r){
        if (r.termInMonths === termInMonths && r.rate > 0){
          if (best === null || r.rate < best.rate) best = { rate: r.rate, productName: p.name };
        }
      });
    });
    return best;
  }

  function overallBestForTerm(data, termInMonths){
    var results = [];
    data.forEach(function(inst){
      var b = bestRateForInstitution(inst, termInMonths);
      if (b) results.push({ instName: inst.name, instId: inst.id, rate: b.rate, productName: b.productName });
    });
    results.sort(function(a,b){ return a.rate - b.rate; });
    return results;
  }

  function renderTermPills(){
    var wraps = [document.getElementById('termPills'), document.getElementById('leadTermPills')];
    wraps.forEach(function(wrap, wIdx){
      wrap.innerHTML = '';
      STATE.columns.forEach(function(col){
        var active = col.termInMonths === STATE.term;
        var btn = document.createElement('button');
        btn.className = 'pill';
        btn.textContent = columnLabel(col.termInMonths, col.term);
        btn.style.background = active ? '#16C172' : (wIdx === 1 ? 'rgba(255,255,255,.08)' : '#F0F3F7');
        btn.style.color = active ? '#fff' : (wIdx === 1 ? 'rgba(255,255,255,.6)' : '#5B6B82');
        btn.onclick = function(){ STATE.term = col.termInMonths; render(); };
        wrap.appendChild(btn);
      });
    });
  }

  function renderLeaderboard(){
    var best = overallBestForTerm(STATE.data, STATE.term).slice(0,3);
    var wrap = document.getElementById('leaderboard');
    wrap.innerHTML = '';
    var medalColors = ['#16C172','#0FB5BA','#6B8CFF'];
    var medalLabels = ['Best rate','2nd lowest','3rd lowest'];
    if (!best.length){
      wrap.innerHTML = '<div style="grid-column:1/-1;color:rgba(255,255,255,.4);font-size:var(--text-ui);padding:20px 0">No lender currently offers this term.</div>';
      return;
    }
    best.forEach(function(b, i){
      var mp = monthlyPayment(b.rate);
      var card = document.createElement('div');
      card.style.cssText = 'background:'+(i===0?'linear-gradient(160deg,#0E9E5C,#0B7A46)':'#0F2740')+';border-radius:18px;padding:24px;position:relative;overflow:hidden;animation:slideUp .4s ease '+(i*0.05)+'s both;border:1px solid '+(i===0?'rgba(22,193,114,.4)':'rgba(255,255,255,.06)');
      card.innerHTML =
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">'+
          '<span style="font-size:var(--text-tiny-sm);font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:'+(i===0?'rgba(255,255,255,.85)':medalColors[i])+'">'+medalLabels[i]+'</span>'+
          (i===0 ? '<span style="background:rgba(255,255,255,.22);color:#fff;font-size:var(--text-tiny);font-weight:800;padding:3px 8px;border-radius:100px">★ TOP PICK</span>' : '')+
        '</div>'+
        '<div style="font-size:var(--text-ui-md);font-weight:800;color:#fff;margin-bottom:2px;letter-spacing:-.3px">'+esc(b.instName)+'</div>'+
        '<div style="font-size:var(--text-dense-sm);color:rgba(255,255,255,.55);margin-bottom:16px">'+esc(b.productName)+'</div>'+
        '<div style="display:flex;align-items:baseline;gap:8px;margin-bottom:6px">'+
          '<span style="font-size:38px;font-weight:800;color:#fff;letter-spacing:-1.5px;line-height:1">'+fmtRate(b.rate)+'</span>'+
        '</div>'+
        '<div style="font-size:var(--text-dense-sm);color:rgba(255,255,255,.5)">'+fmtMoney(mp)+'/mo on $500k · 25yrs</div>';
      wrap.appendChild(card);
    });
  }

  function matchesSearch(inst){
    if (!STATE.search) return true;
    var q = STATE.search.toLowerCase();
    if (inst.name.toLowerCase().indexOf(q) !== -1) return true;
    return inst.products.some(function(p){ return p.name.toLowerCase().indexOf(q) !== -1; });
  }

  function getFilteredSorted(){
    var list = STATE.data.filter(matchesSearch).map(function(inst){
      var best = bestRateForInstitution(inst, STATE.term);
      return { inst: inst, best: best };
    });
    list.sort(function(a,b){
      if (STATE.sort === 'name-asc') return a.inst.name.localeCompare(b.inst.name);
      var ar = a.best ? a.best.rate : Infinity;
      var br = b.best ? b.best.rate : Infinity;
      if (ar === br) return a.inst.name.localeCompare(b.inst.name);
      return STATE.sort === 'rate-desc' ? br - ar : ar - br;
    });
    return list;
  }

  function inCompare(instId){ return STATE.compare.some(function(c){ return c.instId === instId; }); }

  function toggleCompare(inst, best){
    if (inCompare(inst.id)){
      STATE.compare = STATE.compare.filter(function(c){ return c.instId !== inst.id; });
    } else {
      if (STATE.compare.length >= 3) return;
      STATE.compare.push({ instId: inst.id, instName: inst.name, best: best });
    }
    renderCompareTray();
    renderCards();
  }

  window.clearCompare = function(){ STATE.compare = []; renderCompareTray(); renderCards(); };

  function renderCompareTray(){
    var tray = document.getElementById('compareTray');
    var count = STATE.compare.length;
    document.getElementById('compareCount').textContent = count;
    var col = STATE.columns.filter(function(c){return c.termInMonths===STATE.term})[0];
    document.getElementById('compareTermLabel').textContent = col ? columnLabel(col.termInMonths, col.term) : '';
    tray.style.bottom = count > 0 ? '0' : '-220px';
    var row = document.getElementById('compareRow');
    row.innerHTML = '';
    STATE.compare.forEach(function(c){
      var div = document.createElement('div');
      div.style.cssText = 'background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:14px 16px;display:flex;align-items:center;justify-content:space-between';
      var rateStr = c.best ? fmtRate(c.best.rate) : '—';
      var mpStr = c.best ? fmtMoney(monthlyPayment(c.best.rate))+'/mo' : 'not offered';
      div.innerHTML =
        '<div><div style="font-size:var(--text-tab);font-weight:700;color:#fff">'+esc(c.instName)+'</div>'+
        '<div style="font-size:var(--text-label);color:rgba(255,255,255,.4);margin-top:2px">'+mpStr+'</div></div>'+
        '<div style="display:flex;align-items:center;gap:10px">'+
          '<span style="font-size:var(--text-h3);font-weight:800;color:#16C172;letter-spacing:-.5px">'+rateStr+'</span>'+
          '<button data-remove="'+esc(c.instId)+'" style="background:none;border:none;color:rgba(255,255,255,.35);cursor:pointer;font-size:var(--text-ui-md);padding:0 2px">✕</button>'+
        '</div>';
      row.appendChild(div);
    });
    row.querySelectorAll('[data-remove]').forEach(function(btn){
      btn.onclick = function(){
        var id = btn.getAttribute('data-remove');
        STATE.compare = STATE.compare.filter(function(c){ return c.instId !== id; });
        renderCompareTray(); renderCards();
      };
    });
  }

  function productRatesRow(product){
    var cellsByMonth = {};
    product.rates.forEach(function(r){ cellsByMonth[r.termInMonths === null ? 'null' : r.termInMonths] = r.rate; });
    return cellsByMonth;
  }

  function renderExpandedTable(inst){
    var wrap = document.createElement('div');
    wrap.style.cssText = 'margin-top:14px;border-top:1px solid #E4E9F0;padding-top:14px';
    var table = document.createElement('div');
    table.className = 'table-scroll';
    table.style.cssText = 'overflow-x:auto';
    var minima = {};
    STATE.columns.forEach(function(col){
      var key = col.termInMonths === null ? 'null' : col.termInMonths;
      var vals = [];
      inst.products.forEach(function(p){
        p.rates.forEach(function(r){ if ((r.termInMonths===null?'null':r.termInMonths)===key && r.rate>0) vals.push(r.rate); });
      });
      minima[key] = vals.length ? Math.min.apply(null, vals) : null;
    });
    var html = '<table style="border-collapse:collapse;width:100%;min-width:560px;font-size:var(--text-dense-sm)">';
    html += '<tr><td style="padding:6px 10px 6px 0;color:#8B9AAD;font-weight:700;font-size:var(--text-tiny-sm);text-transform:uppercase;letter-spacing:.05em">Product</td>';
    STATE.columns.forEach(function(col){
      html += '<td style="padding:6px 10px;color:#8B9AAD;font-weight:700;font-size:var(--text-tiny-sm);text-transform:uppercase;text-align:right">'+columnLabel(col.termInMonths,col.term)+'</td>';
    });
    html += '</tr>';
    inst.products.forEach(function(p){
      var cells = productRatesRow(p);
      html += '<tr style="border-top:1px solid #F0F3F7"><td style="padding:8px 10px 8px 0;font-weight:600;color:#0B1F3A;white-space:nowrap">'+esc(p.name)+'</td>';
      STATE.columns.forEach(function(col){
        var key = col.termInMonths === null ? 'null' : col.termInMonths;
        var v = cells[key];
        if (v === undefined){
          html += '<td style="padding:8px 10px;text-align:right;color:#D3DAE3">—</td>';
        } else {
          var isBest = minima[key] !== null && v === minima[key];
          html += '<td style="padding:8px 10px;text-align:right;font-weight:'+(isBest?'800':'600')+';color:'+(isBest?'#0E9E5C':'#1A2433')+'">'+
            (isBest ? '<span style="background:rgba(22,193,114,.12);border-radius:6px;padding:2px 7px">'+fmtRate(v)+'</span>' : fmtRate(v))+
          '</td>';
        }
      });
      html += '</tr>';
    });
    html += '</table>';
    table.innerHTML = html;
    wrap.appendChild(table);
    return wrap;
  }

  function renderCards(){
    var list = getFilteredSorted();
    var wrap = document.getElementById('cardsView');
    var empty = document.getElementById('emptyState');
    document.getElementById('resultMeta').textContent = list.length + (list.length === 1 ? ' lender' : ' lenders') + ' · sorted by ' + (STATE.sort === 'name-asc' ? 'name' : (STATE.sort === 'rate-desc' ? 'rate (high to low)' : 'rate (low to high)'));
    wrap.innerHTML = '';
    empty.style.display = list.length ? 'none' : 'block';

    list.forEach(function(item, idx){
      var inst = item.inst, best = item.best;
      var isExpanded = !!STATE.expanded[inst.id];
      var isCompared = inCompare(inst.id);
      var card = document.createElement('div');
      card.className = 'card';
      card.style.cssText = 'background:#fff;border:1.5px solid '+(isCompared?'#16C172':'#E4E9F0')+';border-radius:16px;padding:20px;animation:fadein .3s ease '+(Math.min(idx,10)*0.02)+'s both';
      var rateBlock = best
        ? '<span style="font-size:30px;font-weight:800;color:#0B1F3A;letter-spacing:-1px;line-height:1">'+fmtRate(best.rate)+'</span><div style="font-size:var(--text-label);color:#8B9AAD;margin-top:4px">'+fmtMoney(monthlyPayment(best.rate))+'/mo on $500k</div>'
        : '<span style="font-size:var(--text-h3);font-weight:700;color:#C4CDD6">Not offered</span>';
      card.innerHTML =
        '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:14px">'+
          '<div>'+
            '<div style="font-size:var(--text-ui);font-weight:800;color:#0B1F3A;letter-spacing:-.3px">'+esc(inst.name)+'</div>'+
            '<div style="font-size:var(--text-caption);color:#8B9AAD;margin-top:3px">'+inst.products.length+' product'+(inst.products.length>1?'s':'')+(best?' · '+esc(best.productName):'')+'</div>'+
          '</div>'+
          '<button class="cmp-btn" data-cmp="'+esc(inst.id)+'" style="flex-shrink:0;border:1.5px solid '+(isCompared?'#16C172':'#E4E9F0')+';background:'+(isCompared?'#16C172':'#fff')+';color:'+(isCompared?'#fff':'#5B6B82')+';border-radius:8px;padding:6px 12px;font-size:var(--text-label);font-weight:700;cursor:pointer">'+(isCompared?'✓ Added':'+ Compare')+'</button>'+
        '</div>'+
        '<div style="margin-bottom:14px">'+rateBlock+'</div>'+
        '<button data-expand="'+esc(inst.id)+'" style="width:100%;background:#F6F8FB;border:none;border-radius:9px;padding:9px;font-size:var(--text-dense-sm);font-weight:700;color:#5B6B82;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px">'+
          (isExpanded ? 'Hide all rates' : 'View all rates')+
          '<svg class="chev '+(isExpanded?'open':'')+'" width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1l4 4 4-4" stroke="#5B6B82" stroke-width="1.6" fill="none"/></svg>'+
        '</button>';
      if (isExpanded) card.appendChild(renderExpandedTable(inst));
      wrap.appendChild(card);
    });

    wrap.querySelectorAll('[data-expand]').forEach(function(btn){
      btn.onclick = function(){
        var id = btn.getAttribute('data-expand');
        STATE.expanded[id] = !STATE.expanded[id];
        renderCards();
      };
    });
    wrap.querySelectorAll('[data-cmp]').forEach(function(btn){
      btn.onclick = function(){
        var id = btn.getAttribute('data-cmp');
        var item = list.filter(function(l){ return l.inst.id === id; })[0];
        if (item) toggleCompare(item.inst, item.best);
      };
    });
  }

  function renderTable(){
    var list = getFilteredSorted();
    document.getElementById('resultMeta').textContent = list.length + (list.length === 1 ? ' lender' : ' lenders') + ' · sorted by ' + (STATE.sort === 'name-asc' ? 'name' : (STATE.sort === 'rate-desc' ? 'rate (high to low)' : 'rate (low to high)'));
    var el = document.getElementById('ratesTable');
    var html = '<thead><tr style="background:#F6F8FB">'+
      '<th style="text-align:left;padding:12px 16px;font-size:var(--text-micro);font-weight:700;color:#8B9AAD;text-transform:uppercase;letter-spacing:.06em">Lender</th>'+
      '<th style="text-align:left;padding:12px 16px;font-size:var(--text-micro);font-weight:700;color:#8B9AAD;text-transform:uppercase;letter-spacing:.06em">Product</th>'+
      '<th style="text-align:right;padding:12px 16px;font-size:var(--text-micro);font-weight:700;color:#8B9AAD;text-transform:uppercase;letter-spacing:.06em">Rate</th>'+
      '<th style="text-align:right;padding:12px 16px;font-size:var(--text-micro);font-weight:700;color:#8B9AAD;text-transform:uppercase;letter-spacing:.06em">Est. /mo</th>'+
      '<th></th>'+
      '</tr></thead><tbody>';
    if (!list.length){
      el.innerHTML = html + '</tbody>';
      document.getElementById('emptyState').style.display = 'block';
      return;
    }
    document.getElementById('emptyState').style.display = 'none';
    list.forEach(function(item){
      var inst = item.inst, best = item.best;
      var isCompared = inCompare(inst.id);
      html += '<tr style="border-top:1px solid #F0F3F7">'+
        '<td style="padding:12px 16px;font-weight:700;color:#0B1F3A">'+esc(inst.name)+'</td>'+
        '<td style="padding:12px 16px;color:#5B6B82">'+(best ? esc(best.productName) : '—')+'</td>'+
        '<td style="padding:12px 16px;text-align:right;font-weight:800;color:'+(best?'#0B1F3A':'#C4CDD6')+'">'+(best?fmtRate(best.rate):'Not offered')+'</td>'+
        '<td style="padding:12px 16px;text-align:right;color:#8B9AAD">'+(best?fmtMoney(monthlyPayment(best.rate)):'—')+'</td>'+
        '<td style="padding:12px 16px;text-align:right"><button data-cmp="'+esc(inst.id)+'" style="border:1.5px solid '+(isCompared?'#16C172':'#E4E9F0')+';background:'+(isCompared?'#16C172':'#fff')+';color:'+(isCompared?'#fff':'#5B6B82')+';border-radius:7px;padding:5px 10px;font-size:var(--text-micro);font-weight:700;cursor:pointer">'+(isCompared?'✓':'+ Compare')+'</button></td>'+
        '</tr>';
    });
    html += '</tbody>';
    el.innerHTML = html;
    el.querySelectorAll('[data-cmp]').forEach(function(btn){
      btn.onclick = function(){
        var id = btn.getAttribute('data-cmp');
        var item = list.filter(function(l){ return l.inst.id === id; })[0];
        if (item) toggleCompare(item.inst, item.best);
      };
    });
  }

  function render(){
    renderTermPills();
    renderLeaderboard();
    if (STATE.view === 'card') { renderCards(); } else { renderTable(); }
    renderCompareTray();
  }

  function init(json){
    STATE.data = json.data;
    STATE.columns = buildColumns(json.data);
    STATE.term = STATE.columns.some(function(c){return c.termInMonths===12}) ? 12 : STATE.columns[0].termInMonths;

    var totalProducts = 0;
    json.data.forEach(function(i){ totalProducts += i.products.length; });
    document.getElementById('heroInstCount').textContent = json.data.length;
    document.getElementById('heroProdCount').textContent = totalProducts;
    var lowest = overallBestForTerm(json.data, 12)[0];
    document.getElementById('heroLowest').textContent = lowest ? fmtRate(lowest.rate) : '—';

    var d = new Date(json.lastUpdated);
    document.getElementById('liveLabel').textContent = 'Live · updated ' + d.toLocaleString('en-NZ', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
    document.getElementById('lastUpdatedFoot').textContent = 'Last synced ' + d.toLocaleString('en-NZ', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
    document.getElementById('termsOfUse').textContent = json.termsOfUse || '';

    document.getElementById('searchInput').addEventListener('input', function(e){ STATE.search = e.target.value; render(); });
    document.getElementById('sortSelect').addEventListener('change', function(e){ STATE.sort = e.target.value; render(); });
    document.getElementById('viewCardBtn').addEventListener('click', function(){ setView('card'); });
    document.getElementById('viewTableBtn').addEventListener('click', function(){ setView('table'); });

    render();
  }

  function setView(v){
    STATE.view = v;
    document.getElementById('cardsView').style.display = v === 'card' ? 'grid' : 'none';
    document.getElementById('tableView').style.display = v === 'table' ? 'block' : 'none';
    document.getElementById('viewCardBtn').style.background = v === 'card' ? '#0B1F3A' : 'transparent';
    document.getElementById('viewCardBtn').style.color = v === 'card' ? '#fff' : '#5B6B82';
    document.getElementById('viewTableBtn').style.background = v === 'table' ? '#0B1F3A' : 'transparent';
    document.getElementById('viewTableBtn').style.color = v === 'table' ? '#fff' : '#5B6B82';
    render();
  }

  function parseLenientJson(text){
    var fixed = text.replace(/([{,]\s*)([A-Za-z_$][A-Za-z0-9_$]*)\s*:/g, '$1"$2":');
    return JSON.parse(fixed);
  }

  fetch('/rates/rates.json').then(function(r){ return r.text(); }).then(parseLenientJson).then(init).catch(function(err){
    document.getElementById('cardsView').innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px;color:#8B9AAD">Could not load rate data. Please refresh.</div>';
    console.error(err);
  });
})();
