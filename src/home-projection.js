(() => {
  const $ = (id) => document.getElementById(id);
  const STORAGE_KEY = 'mortgage-manager-home-projection-v4';
  const VALUE_HISTORY_KEY = 'mortgage-manager-home-value-history-v1';
  const MORTGAGE_HISTORY_KEY = 'mortgage-manager-mortgage-history-v1';
  const defaults = { low: 1, trend: 2.5, high: 4, purchasePrice: '', purchaseMonth: '', improvements: '', recentValue: '' };
  let settings = { ...defaults };

  const money = (value) => new Intl.NumberFormat('en-GB', { style:'currency', currency:'GBP', maximumFractionDigits:0 }).format(Math.max(0, Number(value)||0));
  const clamp = (value,min,max,fallback) => Number.isFinite(value) ? Math.min(max,Math.max(min,value)) : fallback;
  const projectedValue = (start, annualRate, years) => start * Math.pow(1 + annualRate/100, Math.max(0,years));
  const monthKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
  const monthLabel = (key) => {
    if (!key) return '—';
    const [year, month] = key.split('-').map(Number);
    if (!year || !month) return '—';
    return new Intl.DateTimeFormat('en-GB',{month:'short',year:'numeric'}).format(new Date(year,month-1,1));
  };

  function currentMortgage(){
    const state=window.MortgageStore?.get?.();
    if(state) return state;
    return {
      balance:+$('balance')?.value||0, rate:+$('rate')?.value||0, payment:+$('payment')?.value||0,
      currentOverpayment:+$('currentOverpayment')?.value||0, homeValue:+$('homeValue')?.value||0,
      ownership:Math.min(100,Math.max(0,+$('ownership')?.value||0)), scenarioExtra:+$('customExtra')?.value||0,
    };
  }

  function loadValueHistory(){
    try {
      const parsed=JSON.parse(localStorage.getItem(VALUE_HISTORY_KEY)||'[]');
      return Array.isArray(parsed)?parsed:[];
    } catch(_){ return []; }
  }

  function saveValueHistory(rows){
    try { localStorage.setItem(VALUE_HISTORY_KEY,JSON.stringify(rows.slice(-120))); } catch(_) {}
  }

  function recordValueCheckpoint(value,source='Dashboard value'){
    const amount=Math.max(0,Number(value)||0);
    if(!amount) return;
    const rows=loadValueHistory();
    const month=monthKey();
    const row={month,value:Math.round(amount),source,savedAt:new Date().toISOString()};
    const index=rows.findIndex((item)=>item.month===month);
    if(index>=0) rows[index]=row; else rows.push(row);
    rows.sort((a,b)=>a.month.localeCompare(b.month));
    saveValueHistory(rows);
    renderValueHistory();
  }

  function syncPurchaseFromMortgageHistory(){
    if(settings.purchasePrice && settings.purchaseMonth) return;
    try {
      const history=JSON.parse(localStorage.getItem(MORTGAGE_HISTORY_KEY)||'null');
      if(!history || typeof history!=='object') return;
      let changed=false;
      if(!settings.purchasePrice && Number(history.purchasePrice)>0){ settings.purchasePrice=String(history.purchasePrice); changed=true; }
      if(!settings.purchaseMonth && history.purchaseDate){ settings.purchaseMonth=String(history.purchaseDate).slice(0,7); changed=true; }
      if(changed) saveSettings();
    } catch(_) {}
  }

  function loadSettings(){
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('mortgage-manager-home-projection-v3');
      if (raw) {
        const old = JSON.parse(raw);
        if (!old.purchaseMonth && old.purchaseYear) old.purchaseMonth = `${old.purchaseYear}-01`;
        settings = { ...defaults, ...old };
      }
    } catch(error){ console.warn('Could not load home projection assumptions.', error); }
    syncPurchaseFromMortgageHistory();
  }

  function saveSettings(){ try{localStorage.setItem(STORAGE_KEY,JSON.stringify(settings));}catch(_){} }

  function yearsSince(monthValue){
    if(!monthValue) return 0;
    const [year,month]=monthValue.split('-').map(Number);
    if(!year||!month) return 0;
    const now=new Date();
    return Math.max(0,(now.getFullYear()-year)+(now.getMonth()-(month-1))/12);
  }

  function projectionYear(months){ const d=new Date(); d.setMonth(d.getMonth()+Math.max(0,months)); return d.getFullYear(); }

  function ensureUI(){
    if($('homeProjection')) return;
    const detail=document.querySelector('.home-panel .expand-detail');
    if(!detail) return;
    const section=document.createElement('section');
    section.id='homeProjection'; section.className='home-projection simplified home-profile';
    section.innerHTML=`
      <div class="deep-heading projection-heading"><div><p class="eyebrow">Home profile</p><h2>Your property value, from purchase to mortgage-free</h2></div><span class="source-date">Estimate, not a valuation</span></div>
      <div class="projection-core-grid">
        <div class="projection-core-card"><span>Bought for</span><strong id="projectionPurchase">Add purchase details</strong><small id="projectionPurchaseNote">Purchase price and date give the estimate a factual starting point.</small></div>
        <div class="projection-core-card current-estimate"><span>Estimated value today</span><strong id="projectionCurrentEstimate">—</strong><small id="projectionCurrentNote">—</small><button type="button" id="useCurrentEstimate" class="projection-use-button">Use for dashboard</button></div>
        <div class="projection-core-card future-estimate"><span>Estimated value when mortgage-free</span><strong id="projectionFutureValue">—</strong><small id="projectionFutureNote">—</small></div>
        <div class="projection-core-card"><span>Your projected share</span><strong id="projectionShareValue">—</strong><small id="projectionShareNote">—</small></div>
      </div>

      <div id="homeProfileRange" class="home-profile-range" hidden>
        <div class="home-profile-range-head"><div><span>Model range today</span><strong>Low · centre · high</strong></div><small id="homeProfileRangeNote">Based on your purchase data.</small></div>
        <div class="home-profile-range-values"><div><span>Low</span><strong id="homeRangeLow">—</strong></div><div class="centre"><span>Centre</span><strong id="homeRangeTrend">—</strong></div><div><span>High</span><strong id="homeRangeHigh">—</strong></div></div>
      </div>

      <p class="projection-plain-note" id="projectionPlainNote">Add purchase details to anchor the estimate to something you know.</p>

      <details class="home-value-history" id="homeValueHistory">
        <summary><span><strong>Value history</strong><small id="homeValueHistorySummary">No saved value checkpoints yet</small></span></summary>
        <div class="home-value-history-body">
          <button type="button" id="saveHomeValueCheckpoint" class="projection-use-button">Save current dashboard value</button>
          <div id="homeValueHistoryList" class="home-value-history-list"></div>
        </div>
      </details>

      <details class="projection-assumptions"><summary>Home profile settings</summary><div class="projection-controls purchase-controls">
        <label>Purchase price (£)<input id="projectionPurchasePrice" type="number" min="0" step="1000" inputmode="decimal"></label>
        <label>Month bought<input id="projectionPurchaseMonth" type="month"></label>
        <label>Value added by improvements (£)<input id="projectionImprovements" type="number" min="0" step="1000" inputmode="decimal"><span>Optional: extension, major renovation, etc.</span></label>
        <label>Recent valuation / estimate (£)<input id="projectionRecentValue" type="number" min="0" step="1000" inputmode="decimal"><span>Optional: takes priority for today's estimate</span></label>
        <label>Low growth<input id="projectionLowRate" type="number" min="-5" max="10" step="0.1" inputmode="decimal"><span>% per year</span></label>
        <label>Trend growth<input id="projectionTrendRate" type="number" min="-5" max="10" step="0.1" inputmode="decimal"><span>% per year</span></label>
        <label>High growth<input id="projectionHighRate" type="number" min="-5" max="12" step="0.1" inputmode="decimal"><span>% per year</span></label>
      </div><p class="deep-note">A recent valuation or agent estimate takes priority for today's displayed estimate. Otherwise the model grows your purchase price from the month you bought and adds any improvement value you enter. The low/centre/high range is a planning range from your purchase data; local comparable sales are not included yet.</p></details>`;
    detail.appendChild(section);

    const fields={projectionPurchasePrice:'purchasePrice',projectionPurchaseMonth:'purchaseMonth',projectionImprovements:'improvements',projectionRecentValue:'recentValue',projectionLowRate:'low',projectionTrendRate:'trend',projectionHighRate:'high'};
    Object.entries(fields).forEach(([id,key])=>{ if($(id)) $(id).value=settings[key] ?? ''; });
    Object.keys(fields).forEach((id)=>$(id).addEventListener('input',()=>{
      settings.purchasePrice=$('projectionPurchasePrice').value; settings.purchaseMonth=$('projectionPurchaseMonth').value;
      settings.improvements=$('projectionImprovements').value; settings.recentValue=$('projectionRecentValue').value;
      settings.low=clamp(+$('projectionLowRate').value,-5,10,defaults.low); settings.trend=clamp(+$('projectionTrendRate').value,-5,10,defaults.trend); settings.high=clamp(+$('projectionHighRate').value,-5,12,defaults.high);
      saveSettings(); render();
    }));

    $('useCurrentEstimate').addEventListener('click',(event)=>{
      event.stopPropagation();
      const estimate=Number($('useCurrentEstimate').dataset.value||0);
      if(!estimate) return;
      if(window.MortgageStore){ window.MortgageStore.set({homeValue:Math.round(estimate)}); window.MortgageStore.applyToDom(['homeValue'],{dispatch:true}); }
      else if($('homeValue')){ $('homeValue').value=Math.round(estimate); $('homeValue').dispatchEvent(new Event('input',{bubbles:true})); }
      recordValueCheckpoint(estimate,'Home profile estimate');
      $('useCurrentEstimate').textContent='Using this estimate';
      setTimeout(()=>{if($('useCurrentEstimate'))$('useCurrentEstimate').textContent='Use for dashboard';},1400);
    });

    $('saveHomeValueCheckpoint').addEventListener('click',(event)=>{
      event.stopPropagation();
      const value=Math.max(0,Number(currentMortgage().homeValue)||0);
      if(!value) return;
      recordValueCheckpoint(value,'Dashboard value');
      const button=$('saveHomeValueCheckpoint');
      button.textContent='Saved this month';
      setTimeout(()=>{ if(button) button.textContent='Save current dashboard value'; },1400);
    });
  }

  function renderValueHistory(){
    const list=$('homeValueHistoryList');
    const summary=$('homeValueHistorySummary');
    if(!list||!summary) return;
    const rows=loadValueHistory();
    if(!rows.length){
      summary.textContent='No saved value checkpoints yet';
      list.innerHTML='<div class="home-value-history-empty">Save a value when you update your estimate to build a simple history over time.</div>';
      return;
    }
    const first=rows[0], latest=rows[rows.length-1];
    const change=latest.value-first.value;
    summary.textContent=`${rows.length} monthly checkpoint${rows.length===1?'':'s'} · latest ${money(latest.value)}`;
    list.innerHTML=rows.slice(-6).reverse().map((row,index)=>{
      const previousIndex=rows.findIndex((item)=>item.month===row.month)-1;
      const previous=previousIndex>=0?rows[previousIndex]:null;
      const delta=previous?row.value-previous.value:null;
      return `<div class="home-value-history-row"><span>${monthLabel(row.month)}</span><strong>${money(row.value)}</strong><small>${row.source||'Saved value'}${delta===null?'':` · ${delta>=0?'+':'−'}${money(Math.abs(delta))}`}</small></div>`;
    }).join('') + (rows.length>1?`<div class="home-value-history-total"><span>Since ${monthLabel(first.month)}</span><strong>${change>=0?'+':'−'}${money(Math.abs(change))}</strong></div>`:'');
  }

  function render(){
    ensureUI(); if(!$('homeProjection')||!window.MortgageMath) return;
    syncPurchaseFromMortgageHistory();
    const mortgage=currentMortgage();
    const savedHomeValue=Math.max(0,Number(mortgage.homeValue)||0);
    const ownership=Math.min(100,Math.max(0,Number(mortgage.ownership)||0));
    const balance=Math.max(0,Number(mortgage.balance)||0), rate=Math.max(0,Number(mortgage.rate)||0), payment=Math.max(0,Number(mortgage.payment)||0), regular=Math.max(0,Number(mortgage.currentOverpayment)||0);
    const path=MortgageMath.amortize(balance,rate,payment+regular);
    const months=path.months;
    const yearsToPayoff=Number.isFinite(months)?months/12:0;
    const purchasePrice=Math.max(0,Number(settings.purchasePrice)||0), purchaseMonth=settings.purchaseMonth||'', improvements=Math.max(0,Number(settings.improvements)||0), recentValue=Math.max(0,Number(settings.recentValue)||0);
    const validPurchase=purchasePrice>0 && purchaseMonth;
    const yearsOwned=validPurchase?yearsSince(purchaseMonth):0;
    let modelledToday=0;
    if(validPurchase) modelledToday=projectedValue(purchasePrice,settings.trend,yearsOwned)+improvements;
    const estimatedToday=recentValue || modelledToday || savedHomeValue;

    if($('projectionPurchasePrice') && !$('projectionPurchasePrice').value && settings.purchasePrice) $('projectionPurchasePrice').value=settings.purchasePrice;
    if($('projectionPurchaseMonth') && !$('projectionPurchaseMonth').value && settings.purchaseMonth) $('projectionPurchaseMonth').value=settings.purchaseMonth;

    $('projectionPurchase').textContent=validPurchase?`${money(purchasePrice)} · ${new Intl.DateTimeFormat('en-GB',{month:'short',year:'numeric'}).format(new Date(`${purchaseMonth}-01T12:00:00`))}`:'Add purchase details';
    $('projectionPurchaseNote').textContent=validPurchase?'Used as the historical anchor for the estimate.':'Purchase price and date give the estimate a factual starting point.';

    const range=$('homeProfileRange');
    if(validPurchase){
      const lowToday=projectedValue(purchasePrice,settings.low,yearsOwned)+improvements;
      const trendToday=projectedValue(purchasePrice,settings.trend,yearsOwned)+improvements;
      const highToday=projectedValue(purchasePrice,settings.high,yearsOwned)+improvements;
      range.hidden=false;
      $('homeRangeLow').textContent=money(lowToday);
      $('homeRangeTrend').textContent=money(trendToday);
      $('homeRangeHigh').textContent=money(highToday);
      $('homeProfileRangeNote').textContent=recentValue
        ? `Purchase-model range; your ${money(recentValue)} recent estimate overrides the centre value used elsewhere.`
        : `Based on ${settings.low.toFixed(1)}%, ${settings.trend.toFixed(1)}% and ${settings.high.toFixed(1)}% annual growth from purchase.`;
    } else {
      range.hidden=true;
    }

    if(!estimatedToday){
      $('projectionCurrentEstimate').textContent='—'; $('projectionCurrentNote').textContent='Add purchase details, a recent estimate, or a dashboard property value.';
      $('projectionFutureValue').textContent='—'; $('projectionFutureNote').textContent=''; $('projectionShareValue').textContent='—'; $('projectionShareNote').textContent='';
      $('projectionPlainNote').textContent='Add purchase details to anchor the estimate to something you know.'; $('useCurrentEstimate').style.display='none'; renderValueHistory(); return;
    }

    $('projectionCurrentEstimate').textContent=money(estimatedToday); $('useCurrentEstimate').dataset.value=String(estimatedToday); $('useCurrentEstimate').style.display='inline-flex';
    $('projectionCurrentNote').textContent=recentValue?'Using your recent valuation / estimate.':validPurchase?`Modelled from purchase price at ${settings.trend.toFixed(1)}% annual growth${improvements?` plus ${money(improvements)} improvements`:''}.`:'Using the property value saved in the dashboard.';

    if(!Number.isFinite(months)){ $('projectionFutureValue').textContent='—'; $('projectionFutureNote').textContent='A valid repayment path is needed.'; renderValueHistory(); return; }

    const trendFuture=projectedValue(estimatedToday,settings.trend,yearsToPayoff), lowFuture=projectedValue(estimatedToday,settings.low,yearsToPayoff), highFuture=projectedValue(estimatedToday,settings.high,yearsToPayoff), shareFuture=trendFuture*ownership/100, year=projectionYear(months);
    $('projectionFutureValue').textContent=money(trendFuture); $('projectionFutureNote').textContent=`Centre estimate for ${year}; rough range ${money(lowFuture)}–${money(highFuture)}.`;
    $('projectionShareValue').textContent=money(shareFuture); $('projectionShareNote').textContent=`${ownership.toFixed(ownership%1?1:0)}% of the centre estimate.`;
    $('projectionPlainNote').textContent=recentValue?`Using your ${money(recentValue)} recent estimate today → about ${money(trendFuture)} by ${year}.`:validPurchase?`${money(purchasePrice)} at purchase → about ${money(estimatedToday)} today → about ${money(trendFuture)} by ${year}.`:`Using the saved ${money(savedHomeValue)} property estimate → about ${money(trendFuture)} by ${year}.`;
    renderValueHistory();
  }

  loadSettings();
  if(window.MortgageStore?.subscribe) window.MortgageStore.subscribe(()=>requestAnimationFrame(render));
  document.addEventListener('mortgage-history-updated',()=>{ syncPurchaseFromMortgageHistory(); requestAnimationFrame(render); });
  render();
})();
