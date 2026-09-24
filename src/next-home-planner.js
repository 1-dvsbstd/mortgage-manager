(() => {
  const $ = (id) => document.getElementById(id);
  const STORAGE_KEY = 'mortgage-manager-next-home-v1';
  const HOME_KEY = 'mortgage-manager-home-projection-v4';
  const HPI_KEY = 'mortgage-manager-local-hpi-v1';
  const defaults = {
    householdIncome: '',
    savings: '',
    cashBuffer: '',
    saleCosts: '',
    purchaseCosts: '',
    borrowingMultiple: 4.5,
  };
  let settings = { ...defaults };

  const money = (value) => new Intl.NumberFormat('en-GB', {
    style:'currency', currency:'GBP', maximumFractionDigits:0,
  }).format(Math.max(0, Number(value)||0));

  function load(){
    try {
      const parsed=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
      if(parsed && typeof parsed==='object') settings={...defaults,...parsed};
    } catch(_) {}
  }

  function save(){
    try { localStorage.setItem(STORAGE_KEY,JSON.stringify(settings)); } catch(_) {}
  }

  function homeSettings(){
    try { return JSON.parse(localStorage.getItem(HOME_KEY)||'{}') || {}; }
    catch(_) { return {}; }
  }

  function trendRate(){
    const home=homeSettings();
    const n=Number(home.trend);
    return Number.isFinite(n)?n:2.5;
  }

  function regionSlug(value){
    return String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' and ').replace(/['’]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  }

  function currentEstimatedHomeValue(fallback){
    const home=homeSettings();
    const recent=Math.max(0,Number(home.recentValue)||0);
    if(recent) return recent;
    const purchasePrice=Math.max(0,Number(home.purchasePrice)||0);
    const purchaseMonth=String(home.purchaseMonth||'').slice(0,7);
    const slug=regionSlug(home.localAuthority||'');
    if(purchasePrice&&purchaseMonth&&slug&&home.propertyType){
      try{
        const cache=JSON.parse(localStorage.getItem(HPI_KEY)||'{}') || {};
        const model=cache[`${slug}|${home.propertyType}|${purchaseMonth}`];
        if(model?.multiplier>0){
          return purchasePrice*Number(model.multiplier)+Math.max(0,Number(home.improvements)||0);
        }
      }catch(_){}
    }
    return Math.max(0,Number(fallback)||0);
  }

  function projectedHomeValue(value, annualRate, years){
    return Math.max(0,Number(value)||0) * Math.pow(1 + annualRate/100, Math.max(0,years));
  }

  function balanceAt(points, month){
    if(!Array.isArray(points)||!points.length) return 0;
    return points[Math.min(Math.max(0,month),points.length-1)] ?? 0;
  }

  function state(){ return window.MortgageStore?.get?.() || {}; }

  function ensureUI(){
    if($('nextHomePlanner')) return;
    const detail=document.querySelector('.home-panel .expand-detail');
    if(!detail) return;

    const section=document.createElement('details');
    section.id='nextHomePlanner';
    section.className='next-home-planner';
    section.innerHTML=`
      <summary><span><strong>Next-home planner</strong><small>What your current plan could mean if you moved</small></span></summary>
      <div class="next-home-body">
        <div class="next-home-heading"><div><p class="eyebrow">What could we do next?</p><h2>Turn your future equity into a rough next-home budget</h2></div><span class="source-date">Planning estimate</span></div>

        <div class="next-home-results">
          <div><span>Usable home equity</span><strong id="nextHomeEquity">—</strong><small id="nextHomeEquityNote">—</small></div>
          <div><span>Illustrative borrowing</span><strong id="nextHomeBorrowing">—</strong><small id="nextHomeBorrowingNote">—</small></div>
          <div class="primary"><span>Approx. next-home budget</span><strong id="nextHomeBudget">—</strong><small id="nextHomeBudgetNote">—</small></div>
        </div>

        <div class="next-home-timeline">
          <div class="next-home-subhead"><div><span>Looking ahead</span><strong>How your budget could change</strong></div></div>
          <div id="nextHomeTimelineRows" class="next-home-timeline-rows"></div>
          <small id="nextHomeTrendNote" class="next-home-trend-note">—</small>
        </div>

        <details class="next-home-settings"><summary>Budget assumptions</summary><div class="next-home-controls">
          <label>Household income (£/year)<input id="nextHomeIncome" type="number" min="0" step="1000" inputmode="decimal"></label>
          <label>Savings available (£)<input id="nextHomeSavings" type="number" min="0" step="1000" inputmode="decimal"></label>
          <label>Cash buffer to keep (£)<input id="nextHomeBuffer" type="number" min="0" step="1000" inputmode="decimal"></label>
          <label>Estimated selling costs (£)<input id="nextHomeSaleCosts" type="number" min="0" step="500" inputmode="decimal"></label>
          <label>Estimated purchase costs (£)<input id="nextHomePurchaseCosts" type="number" min="0" step="500" inputmode="decimal"></label>
          <label>Borrowing multiple<input id="nextHomeMultiple" type="number" min="0" max="10" step="0.1" inputmode="decimal"><span>Planning assumption only; actual lender affordability can differ substantially.</span></label>
        </div></details>

        <p class="next-home-note" id="nextHomeNote">This is a simplified planning estimate, not a lending decision. It does not assess affordability rules, credit commitments, lender stress tests, stamp duty/LTT, scheme redemption rules or eligibility unless you include those costs yourself.</p>
      </div>`;

    const projection=$('homeProjection');
    if(projection) projection.insertAdjacentElement('afterend',section); else detail.appendChild(section);

    const fields={
      nextHomeIncome:'householdIncome', nextHomeSavings:'savings', nextHomeBuffer:'cashBuffer',
      nextHomeSaleCosts:'saleCosts', nextHomePurchaseCosts:'purchaseCosts', nextHomeMultiple:'borrowingMultiple',
    };
    Object.entries(fields).forEach(([id,key])=>{ if($(id)) $(id).value=settings[key] ?? ''; });
    Object.entries(fields).forEach(([id,key])=>$(id)?.addEventListener('input',()=>{
      settings[key]=$(id).value;
      save(); render();
    }));
  }

  function calculateAt(years){
    const mortgage=state();
    const home=currentEstimatedHomeValue(mortgage.homeValue);
    const ownership=Math.min(100,Math.max(0,Number(mortgage.ownership)||0));
    const balance=Math.max(0,Number(mortgage.balance)||0);
    const rate=Math.max(0,Number(mortgage.rate)||0);
    const payment=Math.max(0,Number(mortgage.payment)||0);
    const regular=Math.max(0,Number(mortgage.currentOverpayment)||0);
    const scenarioExtra=Math.max(0,Number(mortgage.scenarioExtra)||0);
    const trend=trendRate();
    const path=window.MortgageMath?.amortize(balance,rate,payment+regular+scenarioExtra);
    const futureHome=projectedHomeValue(home,trend,years);
    const futureMortgage=path?balanceAt(path.monthlyPoints,Math.round(years*12)):balance;
    const shareValue=futureHome*ownership/100;
    const saleCosts=Math.max(0,Number(settings.saleCosts)||0);
    const usableEquity=Math.max(0,shareValue-futureMortgage-saleCosts);
    const savings=Math.max(0,Number(settings.savings)||0);
    const buffer=Math.max(0,Number(settings.cashBuffer)||0);
    const purchaseCosts=Math.max(0,Number(settings.purchaseCosts)||0);
    const availableCash=Math.max(0,usableEquity+savings-buffer-purchaseCosts);
    const income=Math.max(0,Number(settings.householdIncome)||0);
    const multiple=Math.max(0,Number(settings.borrowingMultiple)||0);
    const borrowing=income*multiple;
    const budget=availableCash+borrowing;
    return {futureHome,futureMortgage,shareValue,usableEquity,availableCash,borrowing,budget,trend,scenarioExtra};
  }

  function render(){
    ensureUI();
    if(!$('nextHomePlanner')) return;
    const mortgage=state();
    const now=calculateAt(0);
    const income=Math.max(0,Number(settings.householdIncome)||0);
    const multiple=Math.max(0,Number(settings.borrowingMultiple)||0);
    const savings=Math.max(0,Number(settings.savings)||0);
    const buffer=Math.max(0,Number(settings.cashBuffer)||0);
    const purchaseCosts=Math.max(0,Number(settings.purchaseCosts)||0);

    $('nextHomeEquity').textContent=money(now.usableEquity);
    $('nextHomeEquityNote').textContent=`Your share value less the mortgage${Number(settings.saleCosts)>0?` and ${money(settings.saleCosts)} selling costs`:''}.`;
    $('nextHomeBorrowing').textContent=income?money(now.borrowing):'Add income';
    $('nextHomeBorrowingNote').textContent=income?`${money(income)} household income × ${multiple.toFixed(1)} planning multiple.`:'Add household income under Budget assumptions.';

    if(income || now.availableCash>0){
      $('nextHomeBudget').textContent=money(now.budget);
      const parts=[`${money(now.usableEquity)} usable equity`];
      if(savings) parts.push(`${money(savings)} savings`);
      if(buffer) parts.push(`less ${money(buffer)} buffer`);
      if(purchaseCosts) parts.push(`less ${money(purchaseCosts)} purchase costs`);
      if(income) parts.push(`${money(now.borrowing)} illustrative borrowing`);
      $('nextHomeBudgetNote').textContent=parts.join(' · ');
    } else {
      $('nextHomeBudget').textContent='Add assumptions';
      $('nextHomeBudgetNote').textContent='Enter income and any savings/cost assumptions to build a next-home budget.';
    }

    const horizons=[0,3,5];
    const rows=horizons.map((years)=>({years,...calculateAt(years)}));
    $('nextHomeTimelineRows').innerHTML=rows.map((row)=>{
      const label=row.years===0?'Today':row.years===3?'In 3 years':'In 5 years';
      return `<div class="next-home-timeline-row"><span>${label}</span><strong>${income||row.availableCash>0?money(row.budget):'—'}</strong><small><b>${money(row.usableEquity)}</b> usable equity</small><small><b>${money(row.futureMortgage)}</b> mortgage remaining</small></div>`;
    }).join('');
    $('nextHomeTrendNote').textContent=`Starts from your current property estimate, then uses ${now.trend.toFixed(1)}%/yr forward growth and your current repayment path${now.scenarioExtra>0?` plus ${money(now.scenarioExtra)}/month extra`:''}.`;

    const ownership=Math.min(100,Math.max(0,Number(mortgage.ownership)||0));
    $('nextHomeNote').textContent=ownership<100
      ? 'This is a simplified planning estimate. With shared ownership/shared equity, the amount released on sale can depend on the scheme’s legal redemption rules, so usable equity may differ from this illustration. It is not a lending decision.'
      : 'This is a simplified planning estimate, not a lending decision. It does not assess lender affordability rules, credit commitments, stress tests, taxes or eligibility unless you include relevant costs yourself.';
  }

  load();
  if(window.MortgageStore?.subscribe) MortgageStore.subscribe(()=>requestAnimationFrame(render));
  document.addEventListener('input',(event)=>{ if(event.target.matches('#projectionTrendRate')) requestAnimationFrame(render); });
  render();
})();