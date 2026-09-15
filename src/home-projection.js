(() => {
  const $ = (id) => document.getElementById(id);
  const STORAGE_KEY = 'mortgage-manager-home-projection-v4';
  const defaults = { low: 1, trend: 2.5, high: 4, purchasePrice: '', purchaseMonth: '', improvements: '', recentValue: '' };
  let settings = { ...defaults };

  const money = (value) => new Intl.NumberFormat('en-GB', { style:'currency', currency:'GBP', maximumFractionDigits:0 }).format(Math.max(0, Number(value)||0));
  const clamp = (value,min,max,fallback) => Number.isFinite(value) ? Math.min(max,Math.max(min,value)) : fallback;
  const projectedValue = (start, annualRate, years) => start * Math.pow(1 + annualRate/100, Math.max(0,years));

  function loadSettings(){
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('mortgage-manager-home-projection-v3');
      if (raw) {
        const old = JSON.parse(raw);
        if (!old.purchaseMonth && old.purchaseYear) old.purchaseMonth = `${old.purchaseYear}-01`;
        settings = { ...defaults, ...old };
      }
    } catch(error){ console.warn('Could not load home projection assumptions.', error); }
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
    section.id='homeProjection';
    section.className='home-projection simplified';
    section.innerHTML=`
      <div class="deep-heading projection-heading"><div><p class="eyebrow">Home value</p><h2>From what you paid to what it might be worth later</h2></div><span class="source-date">Estimate, not a valuation</span></div>
      <div class="projection-core-grid">
        <div class="projection-core-card"><span>Bought for</span><strong id="projectionPurchase">Add purchase details</strong><small id="projectionPurchaseNote">Purchase price and date give the estimate a factual starting point.</small></div>
        <div class="projection-core-card current-estimate"><span>Estimated value today</span><strong id="projectionCurrentEstimate">—</strong><small id="projectionCurrentNote">—</small><button type="button" id="useCurrentEstimate" class="projection-use-button">Use for dashboard</button></div>
        <div class="projection-core-card future-estimate"><span>Estimated value when mortgage-free</span><strong id="projectionFutureValue">—</strong><small id="projectionFutureNote">—</small></div>
        <div class="projection-core-card"><span>Your projected share</span><strong id="projectionShareValue">—</strong><small id="projectionShareNote">—</small></div>
      </div>
      <p class="projection-plain-note" id="projectionPlainNote">Add purchase details to anchor the estimate to something you know.</p>
      <details class="projection-assumptions">
        <summary>Estimate settings</summary>
        <div class="projection-controls purchase-controls">
          <label>Purchase price (£)<input id="projectionPurchasePrice" type="number" min="0" step="1000" inputmode="decimal"></label>
          <label>Month bought<input id="projectionPurchaseMonth" type="month"></label>
          <label>Value added by improvements (£)<input id="projectionImprovements" type="number" min="0" step="1000" inputmode="decimal"><span>Optional: extension, major renovation, etc.</span></label>
          <label>Recent valuation / estimate (£)<input id="projectionRecentValue" type="number" min="0" step="1000" inputmode="decimal"><span>Optional: takes priority for today's estimate</span></label>
          <label>Low growth<input id="projectionLowRate" type="number" min="-5" max="10" step="0.1" inputmode="decimal"><span>% per year</span></label>
          <label>Trend growth<input id="projectionTrendRate" type="number" min="-5" max="10" step="0.1" inputmode="decimal"><span>% per year</span></label>
          <label>High growth<input id="projectionHighRate" type="number" min="-5" max="12" step="0.1" inputmode="decimal"><span>% per year</span></label>
        </div>
        <p class="deep-note">If you add a recent valuation or agent estimate, that becomes the starting value today. Otherwise the model grows your purchase price from the month you bought and adds any improvement value you enter. Local comparable sales are not included yet.</p>
      </details>`;
    detail.appendChild(section);

    const fields={projectionPurchasePrice:'purchasePrice',projectionPurchaseMonth:'purchaseMonth',projectionImprovements:'improvements',projectionRecentValue:'recentValue',projectionLowRate:'low',projectionTrendRate:'trend',projectionHighRate:'high'};
    Object.entries(fields).forEach(([id,key])=>{ if($(id)) $(id).value=settings[key] ?? ''; });
    Object.keys(fields).forEach((id)=>$(id).addEventListener('input',()=>{
      settings.purchasePrice=$('projectionPurchasePrice').value;
      settings.purchaseMonth=$('projectionPurchaseMonth').value;
      settings.improvements=$('projectionImprovements').value;
      settings.recentValue=$('projectionRecentValue').value;
      settings.low=clamp(+$('projectionLowRate').value,-5,10,defaults.low);
      settings.trend=clamp(+$('projectionTrendRate').value,-5,10,defaults.trend);
      settings.high=clamp(+$('projectionHighRate').value,-5,12,defaults.high);
      saveSettings(); render();
    }));
    $('useCurrentEstimate').addEventListener('click',(event)=>{
      event.stopPropagation();
      const estimate=Number($('useCurrentEstimate').dataset.value||0);
      if(!estimate||!$('homeValue')) return;
      $('homeValue').value=Math.round(estimate);
      $('homeValue').dispatchEvent(new Event('input',{bubbles:true}));
      $('useCurrentEstimate').textContent='Using this estimate';
      setTimeout(()=>{if($('useCurrentEstimate'))$('useCurrentEstimate').textContent='Use for dashboard';},1400);
    });
  }

  function render(){
    ensureUI();
    if(!$('homeProjection')||!window.MortgageMath) return;
    const savedHomeValue=+$('homeValue')?.value||0;
    const ownership=Math.min(100,Math.max(0,+$('ownership')?.value||0));
    const balance=+$('balance')?.value||0, rate=+$('rate')?.value||0, payment=+$('payment')?.value||0, extra=+$('customExtra')?.value||0;
    const result=MortgageMath.compare(balance,rate,payment,extra);
    const months=Number.isFinite(result.accelerated.months)?result.accelerated.months:result.base.months;
    const yearsToPayoff=Number.isFinite(months)?months/12:0;

    const purchasePrice=Math.max(0,Number(settings.purchasePrice)||0);
    const purchaseMonth=settings.purchaseMonth||'';
    const improvements=Math.max(0,Number(settings.improvements)||0);
    const recentValue=Math.max(0,Number(settings.recentValue)||0);
    const validPurchase=purchasePrice>0 && purchaseMonth;

    let modelledToday=0;
    if(validPurchase) modelledToday=projectedValue(purchasePrice,settings.trend,yearsSince(purchaseMonth))+improvements;
    const estimatedToday=recentValue || modelledToday || savedHomeValue;

    $('projectionPurchase').textContent=validPurchase?`${money(purchasePrice)} · ${new Intl.DateTimeFormat('en-GB',{month:'short',year:'numeric'}).format(new Date(`${purchaseMonth}-01T12:00:00`))}`:'Add purchase details';
    $('projectionPurchaseNote').textContent=validPurchase?'Used as the historical anchor for the estimate.':'Purchase price and date give the estimate a factual starting point.';

    if(!estimatedToday){
      $('projectionCurrentEstimate').textContent='—'; $('projectionCurrentNote').textContent='Add purchase details, a recent estimate, or a dashboard property value.';
      $('projectionFutureValue').textContent='—'; $('projectionFutureNote').textContent=''; $('projectionShareValue').textContent='—'; $('projectionShareNote').textContent='';
      $('projectionPlainNote').textContent='Add purchase details to anchor the estimate to something you know.'; $('useCurrentEstimate').style.display='none'; return;
    }

    $('projectionCurrentEstimate').textContent=money(estimatedToday);
    $('useCurrentEstimate').dataset.value=String(estimatedToday); $('useCurrentEstimate').style.display='inline-flex';
    $('projectionCurrentNote').textContent=recentValue
      ? 'Using your recent valuation / estimate.'
      : validPurchase
        ? `Modelled from purchase price at ${settings.trend.toFixed(1)}% annual growth${improvements?` plus ${money(improvements)} improvements`:''}.`
        : 'Using the property value saved in the dashboard.';

    if(!Number.isFinite(months)){ $('projectionFutureValue').textContent='—'; $('projectionFutureNote').textContent='A valid repayment path is needed.'; return; }
    const trendFuture=projectedValue(estimatedToday,settings.trend,yearsToPayoff);
    const lowFuture=projectedValue(estimatedToday,settings.low,yearsToPayoff);
    const highFuture=projectedValue(estimatedToday,settings.high,yearsToPayoff);
    const shareFuture=trendFuture*ownership/100;
    const year=projectionYear(months);
    $('projectionFutureValue').textContent=money(trendFuture);
    $('projectionFutureNote').textContent=`Centre estimate for ${year}; rough range ${money(lowFuture)}–${money(highFuture)}.`;
    $('projectionShareValue').textContent=money(shareFuture);
    $('projectionShareNote').textContent=`${ownership.toFixed(ownership%1?1:0)}% of the centre estimate.`;
    $('projectionPlainNote').textContent=recentValue
      ? `Using your ${money(recentValue)} recent estimate today → about ${money(trendFuture)} by ${year}.`
      : validPurchase
        ? `${money(purchasePrice)} at purchase → about ${money(estimatedToday)} today → about ${money(trendFuture)} by ${year}.`
        : `Using the saved ${money(savedHomeValue)} property estimate → about ${money(trendFuture)} by ${year}.`;
  }

  loadSettings();
  document.addEventListener('input',(event)=>{ if(event.target.matches('#homeValue,#ownership,#balance,#rate,#payment,#customExtra,#extraSlider,#currentOverpayment')) requestAnimationFrame(render); });
  document.addEventListener('click',(event)=>{ if(event.target.closest('#overpayButtons')) requestAnimationFrame(render); });
  render();
})();