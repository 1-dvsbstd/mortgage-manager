(() => {
  const $ = (id) => document.getElementById(id);
  const STORAGE_KEY = 'mortgage-manager-home-projection-v4';
  const VALUE_HISTORY_KEY = 'mortgage-manager-home-value-history-v1';
  const MORTGAGE_HISTORY_KEY = 'mortgage-manager-mortgage-history-v1';
  const LOCAL_BENCHMARK_KEY = 'mortgage-manager-local-benchmark-v1';
  const LOCAL_HPI_KEY = 'mortgage-manager-local-hpi-v1';
  const ONLINE_MODE_KEY = 'mortgage-manager-online-mode-v1';
  let benchmarkRequestKey='';
  let benchmarkRequest=null;
  let hpiRequestKey='';
  let hpiRequest=null;
  const defaults = { low: 1, trend: 2.5, high: 4, purchasePrice: '', purchaseMonth: '', postcode: '', localAuthority: '', localAuthorityCode: '', propertyType: '', bedrooms: '', improvements: '', recentValue: '' };
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
      <div class="deep-heading projection-heading"><div><p class="eyebrow">Home profile</p><h2>Your property value and equity, five years from now</h2></div><span class="source-date">Estimate, not a valuation</span></div>
      <div class="projection-core-grid">
        <div class="projection-core-card"><span>Bought for</span><strong id="projectionPurchase">Add purchase details</strong><small id="projectionPurchaseNote">Purchase price and date give the estimate a factual starting point.</small></div>
        <div class="projection-core-card current-estimate"><span>Estimated value today</span><strong id="projectionCurrentEstimate">—</strong><small id="projectionCurrentNote">—</small><button type="button" id="useCurrentEstimate" class="projection-use-button">Use for dashboard</button></div>
        <div class="projection-core-card future-estimate"><span>Estimated value in 5 years</span><strong id="projectionFutureValue">—</strong><small id="projectionFutureNote">—</small></div>
        <div class="projection-core-card"><span>Current equity</span><strong id="projectionShareValue">—</strong><small id="projectionShareNote">—</small></div>
      </div>

      <div id="homeProfileRange" class="home-profile-range" hidden>
        <div class="home-profile-range-head"><div><span>Estimated value range</span><strong>Low · centre · high</strong></div><small id="homeProfileRangeNote">Anchored to your home and checked against local sales.</small></div>
        <div class="home-profile-range-values"><div><span>Low</span><strong id="homeRangeLow">—</strong></div><div class="centre"><span>Centre</span><strong id="homeRangeTrend">—</strong></div><div><span>High</span><strong id="homeRangeHigh">—</strong></div></div>
        <small id="homeProfileRangeSource" class="home-profile-range-source"></small>
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
        <label>Property postcode<input id="projectionPostcode" type="text" inputmode="text" autocomplete="postal-code" placeholder="e.g. CF62 7AB"><span>Used for local house-price data.</span></label>
        <label>Property type<select id="projectionPropertyType"><option value="">Select property type</option><option value="detached">Detached</option><option value="semi-detached">Semi-detached</option><option value="terraced">Terraced</option><option value="flat">Flat / maisonette</option></select><span>Used for local sold-price comparisons.</span></label>
        <label>Bedrooms<select id="projectionBedrooms"><option value="">Select bedrooms</option><option value="1">1 bedroom</option><option value="2">2 bedrooms</option><option value="3">3 bedrooms</option><option value="4">4 bedrooms</option><option value="5">5 bedrooms</option><option value="6">6+ bedrooms</option></select><span>Used to refine comparable properties.</span></label>
        <label>Value added by improvements (£)<input id="projectionImprovements" type="number" min="0" step="1000" inputmode="decimal"><span>Optional: extension, major renovation, etc.</span></label>
        <label>Recent valuation / estimate (£)<input id="projectionRecentValue" type="number" min="0" step="1000" inputmode="decimal"><span>Optional: takes priority for today's estimate</span></label>
        <label>Low growth<input id="projectionLowRate" type="number" min="-5" max="10" step="0.1" inputmode="decimal"><span>% per year</span></label>
        <label>Trend growth<input id="projectionTrendRate" type="number" min="-5" max="10" step="0.1" inputmode="decimal"><span>% per year</span></label>
        <label>High growth<input id="projectionHighRate" type="number" min="-5" max="12" step="0.1" inputmode="decimal"><span>% per year</span></label>
      </div><p class="deep-note">A recent valuation or agent estimate takes priority for today's displayed estimate. Otherwise the model grows your purchase price from the month you bought and adds any improvement value you enter. The low/centre/high range is a planning range from your purchase data; local comparable sales are not included yet.</p></details>`;
    detail.appendChild(section);

    const fields={projectionPurchasePrice:'purchasePrice',projectionPurchaseMonth:'purchaseMonth',projectionPostcode:'postcode',projectionPropertyType:'propertyType',projectionBedrooms:'bedrooms',projectionImprovements:'improvements',projectionRecentValue:'recentValue',projectionLowRate:'low',projectionTrendRate:'trend',projectionHighRate:'high'};
    Object.entries(fields).forEach(([id,key])=>{ if($(id)) $(id).value=settings[key] ?? ''; });
    Object.keys(fields).forEach((id)=>$(id).addEventListener('input',()=>{
      settings.purchasePrice=$('projectionPurchasePrice').value; settings.purchaseMonth=$('projectionPurchaseMonth').value;
      settings.postcode=($('projectionPostcode').value||'').trim().toUpperCase();
      settings.propertyType=$('projectionPropertyType').value||'';
      settings.bedrooms=$('projectionBedrooms').value||'';
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

  function normalisePostcode(value){
    const compact=String(value||'').toUpperCase().replace(/\s+/g,'');
    if(compact.length<5) return '';
    return compact.slice(0,-3)+' '+compact.slice(-3);
  }

  function regionSlug(value){
    return String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' and ').replace(/['’]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  }

  function hmlrPropertyTypeLabel(value){
    return ({detached:'Detached','semi-detached':'Semi-Detached',terraced:'Terraced',flat:'Flat/Maisonette'})[value]||'';
  }

  function hpiIndexField(value){
    return ({detached:'housePriceIndexDetached','semi-detached':'housePriceIndexSemiDetached',terraced:'housePriceIndexTerraced',flat:'housePriceIndexFlatMaisonette'})[value]||'';
  }

  function readBenchmarkCache(){
    try{
      const parsed=JSON.parse(localStorage.getItem(LOCAL_BENCHMARK_KEY)||'{}');
      return parsed && typeof parsed==='object' ? parsed : {};
    }catch(_){ return {}; }
  }

  function writeBenchmarkCache(cache){
    try{ localStorage.setItem(LOCAL_BENCHMARK_KEY,JSON.stringify(cache)); }catch(_){}
  }

  function readHpiCache(){
    try{
      const parsed=JSON.parse(localStorage.getItem(LOCAL_HPI_KEY)||'{}');
      return parsed && typeof parsed==='object' ? parsed : {};
    }catch(_){ return {}; }
  }

  function writeHpiCache(cache){
    try{ localStorage.setItem(LOCAL_HPI_KEY,JSON.stringify(cache)); }catch(_){}
  }

  function quantile(sorted,q){
    if(!sorted.length) return 0;
    if(sorted.length===1) return sorted[0];
    const pos=(sorted.length-1)*q, base=Math.floor(pos), rest=pos-base;
    return sorted[base+1]!==undefined ? sorted[base]+rest*(sorted[base+1]-sorted[base]) : sorted[base];
  }

  function extractHmlrItems(data){
    const raw=data?.result?.items || data?.items || [];
    return Array.isArray(raw)?raw:[];
  }

  function extractSale(item){
    const price=Number(item?.pricePaid?._value ?? item?.pricePaid ?? 0);
    const date=String(item?.transactionDate?._value ?? item?.transactionDate ?? '');
    const typeRaw=item?.propertyType?.label ?? item?.propertyType?._label ?? item?.propertyType ?? '';
    const type=typeof typeRaw==='string' ? typeRaw : String(typeRaw?.value||'');
    const postcode=String(item?.propertyAddress?.postcode ?? item?.propertyAddress?.postcode?._value ?? '');
    if(!Number.isFinite(price)||price<=0||!date) return null;
    return {price,date,type,postcode};
  }

  async function fetchHmlrSales(postcode,propertyType){
    const params=new URLSearchParams();
    params.set('propertyAddress.postcode',postcode);
    if(propertyType) params.set('propertyType.label',propertyType);
    params.set('_pageSize','100');
    params.set('_sort','-transactionDate');
    const url='https://landregistry.data.gov.uk/data/ppi/transaction-record.json?'+params.toString();
    const response=await fetch(url,{cache:'no-store',headers:{Accept:'application/json'}});
    if(!response.ok) throw new Error('Land Registry lookup failed');
    const data=await response.json();
    return extractHmlrItems(data).map(extractSale).filter(Boolean);
  }

  async function fetchHmlrDistrictSales(district,propertyType){
    const params=new URLSearchParams();
    params.set('propertyAddress.district',district);
    if(propertyType) params.set('propertyType.label',propertyType);
    params.set('_pageSize','100');
    params.set('_sort','-transactionDate');
    const url='https://landregistry.data.gov.uk/data/ppi/transaction-record.json?'+params.toString();
    const response=await fetch(url,{cache:'no-store',headers:{Accept:'application/json'}});
    if(!response.ok) throw new Error('Land Registry district lookup failed');
    const data=await response.json();
    return extractHmlrItems(data).map(extractSale).filter(Boolean);
  }

  function benchmarkFromSales(sales,areaLabel,propertyTypeLabel,bedrooms){
    const cutoff=new Date();
    cutoff.setFullYear(cutoff.getFullYear()-5);
    let recent=sales.filter((sale)=>{
      const d=new Date(sale.date);
      return Number.isFinite(d.getTime()) && d>=cutoff;
    });
    if(recent.length<3) recent=sales;
    const prices=recent.map((sale)=>sale.price).filter((v)=>Number.isFinite(v)&&v>0).sort((a,b)=>a-b);
    if(!prices.length) return null;
    const dates=recent.map((sale)=>sale.date).filter(Boolean).sort();
    return {
      low:Math.round(quantile(prices,.25)),
      centre:Math.round(quantile(prices,.5)),
      high:Math.round(quantile(prices,.75)),
      count:prices.length,
      areaLabel,
      propertyTypeLabel,
      bedrooms:String(bedrooms||''),
      latestSale:dates[dates.length-1]||'',
      fetchedAt:new Date().toISOString(),
      source:'HM Land Registry Price Paid Data'
    };
  }

  function hpiValue(item,field){
    const raw=item?.[field];
    return Number(raw?._value ?? raw ?? 0);
  }

  function monthDistance(a,b){
    const [ay,am]=String(a||'').slice(0,7).split('-').map(Number);
    const [by,bm]=String(b||'').slice(0,7).split('-').map(Number);
    if(!ay||!am||!by||!bm) return Infinity;
    return Math.abs((ay-by)*12+(am-bm));
  }

  async function fetchLocalHpiModel(){
    const authority=settings.localAuthority||'';
    const slug=regionSlug(authority);
    const field=hpiIndexField(settings.propertyType);
    const purchaseMonth=String(settings.purchaseMonth||'').slice(0,7);
    if(!slug||!field||!purchaseMonth) return null;
    const key=`${slug}|${settings.propertyType}|${purchaseMonth}`;
    const cache=readHpiCache();
    const cached=cache[key];

    const online=(()=>{ try{return localStorage.getItem(ONLINE_MODE_KEY)==='online';}catch(_){return false;} })();
    if(!online) return cached||null;
    if(hpiRequestKey===key && hpiRequest) return hpiRequest;

    hpiRequestKey=key;
    hpiRequest=(async()=>{
      try{
        const purchaseDate=`${purchaseMonth}-01`;
        const params=new URLSearchParams();
        params.set('_pageSize','200');
        params.set('_sort','refPeriodStart');
        params.set('min-refPeriodStart',purchaseDate);
        params.set('_properties',`refMonth,${field}`);
        const url=`https://landregistry.data.gov.uk/data/ukhpi/region/${slug}.json?${params.toString()}`;
        const response=await fetch(url,{cache:'no-store',headers:{Accept:'application/json'}});
        if(!response.ok) throw new Error('UK HPI lookup failed');
        const data=await response.json();
        const items=extractHmlrItems(data).map((item)=>({
          month:String(item?.refMonth?._value ?? item?.refMonth ?? '').slice(0,7),
          index:hpiValue(item,field)
        })).filter((item)=>item.month&&Number.isFinite(item.index)&&item.index>0);
        if(!items.length) return cached||null;
        items.sort((a,b)=>a.month.localeCompare(b.month));
        const purchasePoint=items.reduce((best,item)=>monthDistance(item.month,purchaseMonth)<monthDistance(best?.month,purchaseMonth)?item:best,null);
        const latestPoint=items[items.length-1];
        if(!purchasePoint||!latestPoint||monthDistance(purchasePoint.month,purchaseMonth)>3) return cached||null;
        const result={
          authority,
          propertyType:settings.propertyType,
          purchaseMonth:purchasePoint.month,
          purchaseIndex:purchasePoint.index,
          latestMonth:latestPoint.month,
          latestIndex:latestPoint.index,
          multiplier:latestPoint.index/purchasePoint.index,
          fetchedAt:new Date().toISOString()
        };
        cache[key]=result;
        writeHpiCache(cache);
        requestAnimationFrame(render);
        return result;
      }catch(_){
        return cached||null;
      }finally{
        hpiRequest=null;
      }
    })();
    return hpiRequest;
  }

  function cachedLocalHpiModel(){
    const slug=regionSlug(settings.localAuthority||'');
    const purchaseMonth=String(settings.purchaseMonth||'').slice(0,7);
    if(!slug||!settings.propertyType||!purchaseMonth) return null;
    return readHpiCache()[`${slug}|${settings.propertyType}|${purchaseMonth}`]||null;
  }

  function formatSaleMonth(value){
    if(!value) return '';
    const d=new Date(value);
    if(!Number.isFinite(d.getTime())) return '';
    return new Intl.DateTimeFormat('en-GB',{month:'short',year:'numeric'}).format(d);
  }

  function applyLocalBenchmark(benchmark,estimate=0){
    const range=$('homeProfileRange');
    const note=$('homeProfileRangeNote');
    const source=$('homeProfileRangeSource');
    if(!range||!benchmark) return false;
    const centreEstimate=Math.max(0,Number(estimate)||0);
    const rawCentre=Math.max(1,Number(benchmark.centre)||1);
    const lowRatio=Math.max(.65,Math.min(1,Number(benchmark.low||rawCentre)/rawCentre));
    const highRatio=Math.min(1.45,Math.max(1,Number(benchmark.high||rawCentre)/rawCentre));
    const low=centreEstimate?centreEstimate*lowRatio:benchmark.low;
    const centre=centreEstimate||benchmark.centre;
    const high=centreEstimate?centreEstimate*highRatio:benchmark.high;
    range.hidden=false;
    $('homeRangeLow').textContent=money(low);
    $('homeRangeTrend').textContent=money(centre);
    $('homeRangeHigh').textContent=money(high);
    const typeText=benchmark.propertyTypeLabel ? benchmark.propertyTypeLabel.toLowerCase() : 'matching';
    const bedText=benchmark.bedrooms ? ` · ${benchmark.bedrooms==='6'?'6+':benchmark.bedrooms} bed profile saved` : '';
    const latest=benchmark.latestSale ? ` · latest ${formatSaleMonth(benchmark.latestSale)}` : '';
    if(note) note.textContent=`Estimate anchored to your home; range shaped by ${benchmark.count} ${typeText} sale${benchmark.count===1?'':'s'} in ${benchmark.areaLabel}${latest}${bedText}.`;
    if(source) source.textContent=`Comparable median ${money(benchmark.centre)}. Bedrooms are not recorded in Land Registry Price Paid Data. Contains HM Land Registry data © Crown copyright and database right 2026. Licensed under OGL v3.0.`;
    return true;
  }

  async function refreshLocalBenchmark(){
    const postcode=normalisePostcode(settings.postcode);
    const propertyTypeLabel=hmlrPropertyTypeLabel(settings.propertyType);
    if(!postcode||!propertyTypeLabel) return null;
    const key=`${postcode}|${settings.propertyType}`;
    const cache=readBenchmarkCache();
    const cached=cache[key];
    if(cached) applyLocalBenchmark(cached);

    const online=(()=>{ try{return localStorage.getItem(ONLINE_MODE_KEY)==='online';}catch(_){return false;} })();
    if(!online) return cached||null;
    if(benchmarkRequestKey===key && benchmarkRequest) return benchmarkRequest;

    benchmarkRequestKey=key;
    benchmarkRequest=(async()=>{
      try{
        let sales=await fetchHmlrSales(postcode,propertyTypeLabel);
        let areaLabel=postcode;
        if(sales.length<5 && settings.localAuthority){
          const wider=await fetchHmlrDistrictSales(settings.localAuthority,propertyTypeLabel);
          if(wider.length>sales.length){ sales=wider; areaLabel=settings.localAuthority; }
        }
        const benchmark=benchmarkFromSales(sales,areaLabel,propertyTypeLabel,settings.bedrooms);
        if(!benchmark) return cached||null;
        cache[key]=benchmark;
        writeBenchmarkCache(cache);
        requestAnimationFrame(render);
        return benchmark;
      }catch(_){
        return cached||null;
      }finally{
        benchmarkRequest=null;
      }
    })();
    return benchmarkRequest;
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
    list.innerHTML=rows.slice(-6).reverse().map((row)=>{
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
    const balance=Math.max(0,Number(mortgage.balance)||0), rate=Math.max(0,Number(mortgage.rate)||0), payment=Math.max(0,Number(mortgage.payment)||0), regular=Math.max(0,Number(mortgage.currentOverpayment)||0), scenarioExtra=Math.max(0,Number(mortgage.scenarioExtra)||0);
    const path=MortgageMath.amortize(balance,rate,payment+regular+scenarioExtra);
    const months=path.months;
    const yearsToPayoff=Number.isFinite(months)?months/12:0;
    const purchasePrice=Math.max(0,Number(settings.purchasePrice)||0), purchaseMonth=settings.purchaseMonth||'', improvements=Math.max(0,Number(settings.improvements)||0), recentValue=Math.max(0,Number(settings.recentValue)||0);
    const validPurchase=purchasePrice>0 && purchaseMonth;
    const yearsOwned=validPurchase?yearsSince(purchaseMonth):0;
    const hpiModel=cachedLocalHpiModel();
    let hpiAnchoredToday=0;
    if(validPurchase&&hpiModel?.multiplier>0) hpiAnchoredToday=purchasePrice*hpiModel.multiplier+improvements;
    let fallbackModelToday=0;
    if(validPurchase) fallbackModelToday=projectedValue(purchasePrice,settings.trend,yearsOwned)+improvements;
    const estimatedToday=recentValue || hpiAnchoredToday || fallbackModelToday || savedHomeValue;
    fetchLocalHpiModel();

    if($('projectionPurchasePrice') && !$('projectionPurchasePrice').value && settings.purchasePrice) $('projectionPurchasePrice').value=settings.purchasePrice;
    if($('projectionPurchaseMonth') && !$('projectionPurchaseMonth').value && settings.purchaseMonth) $('projectionPurchaseMonth').value=settings.purchaseMonth;
    if($('projectionPostcode') && !$('projectionPostcode').value && settings.postcode) $('projectionPostcode').value=settings.postcode;
    if($('projectionPropertyType') && !$('projectionPropertyType').value && settings.propertyType) $('projectionPropertyType').value=settings.propertyType;
    if($('projectionBedrooms') && !$('projectionBedrooms').value && settings.bedrooms) $('projectionBedrooms').value=settings.bedrooms;

    $('projectionPurchase').textContent=validPurchase?`${money(purchasePrice)} · ${new Intl.DateTimeFormat('en-GB',{month:'short',year:'numeric'}).format(new Date(`${purchaseMonth}-01T12:00:00`))}`:'Add purchase details';
    $('projectionPurchaseNote').textContent=validPurchase?'Used as the historical anchor for the estimate.':'Purchase price and date give the estimate a factual starting point.';

    const range=$('homeProfileRange');
    const benchmarkKey=`${normalisePostcode(settings.postcode)}|${settings.propertyType||''}`;
    const cachedBenchmark=readBenchmarkCache()[benchmarkKey];
    const hasBenchmark=applyLocalBenchmark(cachedBenchmark,estimatedToday);
    if(!hasBenchmark && validPurchase){
      const lowToday=projectedValue(purchasePrice,settings.low,yearsOwned)+improvements;
      const trendToday=projectedValue(purchasePrice,settings.trend,yearsOwned)+improvements;
      const highToday=projectedValue(purchasePrice,settings.high,yearsOwned)+improvements;
      range.hidden=false;
      $('homeRangeLow').textContent=money(lowToday);
      $('homeRangeTrend').textContent=money(trendToday);
      $('homeRangeHigh').textContent=money(highToday);
      $('homeProfileRangeNote').textContent=settings.postcode&&settings.propertyType
        ? hpiAnchoredToday?'HPI-anchored estimate shown while local comparable sales refresh.':'Saved purchase-model range shown while local market data refreshes.'
        : 'Add postcode and property type in Setup & data to use local sold-price benchmarks.';
      if($('homeProfileRangeSource')) $('homeProfileRangeSource').textContent=hpiAnchoredToday?`Centre uses ${hpiModel.authority} ${hmlrPropertyTypeLabel(settings.propertyType)} UK HPI movement from ${hpiModel.purchaseMonth} to ${hpiModel.latestMonth}.`:'Fallback range uses your saved low / centre / high growth assumptions.';
    } else if(!hasBenchmark) {
      range.hidden=true;
    }
    refreshLocalBenchmark();

    if(!estimatedToday){
      $('projectionCurrentEstimate').textContent='—'; $('projectionCurrentNote').textContent='Add purchase details, a recent estimate, or a dashboard property value.';
      $('projectionFutureValue').textContent='—'; $('projectionFutureNote').textContent=''; $('projectionShareValue').textContent='—'; $('projectionShareNote').textContent='';
      $('projectionPlainNote').textContent='Add purchase details to anchor the estimate to something you know.'; $('useCurrentEstimate').style.display='none'; renderValueHistory(); return;
    }

    $('projectionCurrentEstimate').textContent=money(estimatedToday); $('useCurrentEstimate').dataset.value=String(estimatedToday); $('useCurrentEstimate').style.display='inline-flex';
    $('projectionCurrentNote').textContent=recentValue
      ? 'Using your recent valuation / estimate.'
      : hpiAnchoredToday
        ? `Your purchase price adjusted by ${hmlrPropertyTypeLabel(settings.propertyType)} UK HPI movement in ${hpiModel.authority} from ${hpiModel.purchaseMonth} to ${hpiModel.latestMonth}${improvements?`, plus ${money(improvements)} improvements`:''}.`
        : validPurchase
          ? `Local HPI unavailable; using the fallback ${settings.trend.toFixed(1)}% annual-growth model${improvements?` plus ${money(improvements)} improvements`:''}.`
          : 'Using the property value saved in the dashboard.';

    const ownedValueToday=estimatedToday*ownership/100;
    const equityToday=Math.max(0,ownedValueToday-balance);
    $('projectionShareValue').textContent=money(equityToday);
    $('projectionShareNote').textContent=`${ownership.toFixed(ownership%1?1:0)}% share less ${money(balance)} mortgage remaining.`;
    $('projectionPlainNote').textContent=`Today: about ${money(estimatedToday)} estimated property value and ${money(equityToday)} household equity.`;

    if(!Number.isFinite(months)){ $('projectionFutureValue').textContent='—'; $('projectionFutureNote').textContent='A valid repayment path is needed.'; renderValueHistory(); return; }

    const horizonYears=5, horizonMonths=horizonYears*12;
    const trendFuture=projectedValue(estimatedToday,settings.trend,horizonYears), lowFuture=projectedValue(estimatedToday,settings.low,horizonYears), highFuture=projectedValue(estimatedToday,settings.high,horizonYears);
    const balanceIndex=Math.min(horizonMonths,Math.max(0,path.monthlyPoints.length-1));
    const balanceInFive=Math.max(0,Number(path.monthlyPoints[balanceIndex])||0);
    const ownedValueInFive=trendFuture*ownership/100;
    const equityInFive=Math.max(0,ownedValueInFive-balanceInFive);
    const year=new Date().getFullYear()+horizonYears;
    $('projectionFutureValue').textContent=money(trendFuture); $('projectionFutureNote').textContent=`Centre estimate for ${year}; rough range ${money(lowFuture)}–${money(highFuture)}. Property growth is held constant across overpayment choices.`;
    renderValueHistory();
  }

  loadSettings();
  if(window.MortgageStore?.subscribe) window.MortgageStore.subscribe(()=>requestAnimationFrame(render));
  document.addEventListener('mortgage-history-updated',()=>{ syncPurchaseFromMortgageHistory(); requestAnimationFrame(render); });
  document.addEventListener('home-profile-settings-updated',(event)=>{
    const detail=event.detail;
    if(!detail || typeof detail!=='object') return;
    settings={...settings,...detail};
    saveSettings();
    benchmarkRequestKey=''; benchmarkRequest=null;
    hpiRequestKey=''; hpiRequest=null;
    requestAnimationFrame(render);
  });
  render();
})();
