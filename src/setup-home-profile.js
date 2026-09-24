(() => {
  const HOME_KEY = 'mortgage-manager-home-projection-v4';
  const LEGACY_HOME_KEY = 'mortgage-manager-home-projection-v3';
  const defaults = { low:1, trend:2.5, high:4, purchasePrice:'', purchaseMonth:'', postcode:'', localAuthority:'', localAuthorityCode:'', propertyType:'', bedrooms:'', improvements:'', recentValue:'' };

  function loadSettings(){
    try {
      const raw = localStorage.getItem(HOME_KEY) || localStorage.getItem(LEGACY_HOME_KEY);
      if(!raw) return { ...defaults };
      const parsed = JSON.parse(raw);
      if(!parsed.purchaseMonth && parsed.purchaseYear) parsed.purchaseMonth = `${parsed.purchaseYear}-01`;
      return { ...defaults, ...parsed };
    } catch(_) { return { ...defaults }; }
  }

  function bridgeInputs(settings){
    const map = {
      projectionPurchasePrice:'purchasePrice', projectionPurchaseMonth:'purchaseMonth', projectionPostcode:'postcode', projectionPropertyType:'propertyType', projectionBedrooms:'bedrooms',
      projectionImprovements:'improvements', projectionRecentValue:'recentValue',
      projectionLowRate:'low', projectionTrendRate:'trend', projectionHighRate:'high',
    };
    Object.entries(map).forEach(([id,key]) => {
      const input = document.getElementById(id);
      if(input) input.value = settings[key] ?? '';
    });
    const trigger = document.getElementById('projectionTrendRate') || document.getElementById('projectionPurchasePrice');
    if(trigger) trigger.dispatchEvent(new Event('input', { bubbles:true }));
  }

  function saveSettings(settings){
    try { localStorage.setItem(HOME_KEY, JSON.stringify(settings)); } catch(_) {}
    bridgeInputs(settings);
    document.dispatchEvent(new CustomEvent('home-profile-settings-updated', { detail:{ ...settings } }));
  }

  function isolateLegacyControls(){
    const legacy = document.querySelector('.projection-assumptions');
    if(!legacy || legacy.dataset.setupIsolated === 'true') return;
    legacy.dataset.setupIsolated = 'true';
    legacy.classList.remove('projection-assumptions');
    legacy.classList.add('projection-assumptions-internal');
    legacy.hidden = true;
    legacy.style.display = 'none';
  }

  function field(id,label,type='number',step='1',note=''){
    return `<label>${label}<input id="${id}" type="${type}" ${type==='number'?`step="${step}" inputmode="decimal"`:''}>${note?`<span>${note}</span>`:''}</label>`;
  }

  function mount(){
    isolateLegacyControls();
    const modal = document.querySelector('.personal-modal');
    const mortgageForm = modal?.querySelector('.personal-form');
    if(!modal || !mortgageForm || modal.querySelector('.personal-home-profile-section')) return;

    const settings = loadSettings();
    const section = document.createElement('div');
    section.className = 'personal-section personal-home-profile-section';
    section.innerHTML = `
      <h3>Home profile</h3>
      <p>Purchase details and valuation assumptions used by Future projections.</p>
      <div class="projection-controls purchase-controls setup-home-profile-fields">
        ${field('setupHomePurchasePrice','Purchase price (£)','number','1000')}
        ${field('setupHomePurchaseMonth','Month bought','month')}
        <label>Property postcode<input id="setupHomePostcode" type="text" autocomplete="postal-code"><span id="setupHomePostcodeNote">Used for local house-price data</span></label>
        <label>Property type<select id="setupHomePropertyType"><option value="">Select property type</option><option value="detached">Detached</option><option value="semi-detached">Semi-detached</option><option value="terraced">Terraced</option><option value="flat">Flat / maisonette</option></select><span>Used to make local sold-price comparisons more relevant.</span></label>
        ${field('setupHomeBedrooms','Bedrooms','number','1','Used to refine comparable properties')}
        ${field('setupHomeImprovements','Value added by improvements (£)','number','1000','Optional')}
        ${field('setupHomeRecentValue','Recent valuation / estimate (£)','number','1000','Optional; overrides the modelled value today')}
        ${field('setupHomeLowRate','Low growth (%)','number','0.1')}
        ${field('setupHomeTrendRate','Trend growth (%)','number','0.1')}
        ${field('setupHomeHighRate','High growth (%)','number','0.1')}
      </div>`;
    mortgageForm.insertAdjacentElement('afterend', section);

    const refs = {
      purchasePrice: section.querySelector('#setupHomePurchasePrice'),
      purchaseMonth: section.querySelector('#setupHomePurchaseMonth'),
      postcode: section.querySelector('#setupHomePostcode'),
      propertyType: section.querySelector('#setupHomePropertyType'),
      bedrooms: section.querySelector('#setupHomeBedrooms'),
      improvements: section.querySelector('#setupHomeImprovements'),
      recentValue: section.querySelector('#setupHomeRecentValue'),
      low: section.querySelector('#setupHomeLowRate'),
      trend: section.querySelector('#setupHomeTrendRate'),
      high: section.querySelector('#setupHomeHighRate'),
    };
    Object.entries(refs).forEach(([key,input]) => { if(input) input.value = settings[key] ?? ''; });
    const postcodeNote=section.querySelector('#setupHomePostcodeNote');
    let resolvedAuthority=settings.localAuthority || '';
    let resolvedAuthorityCode=settings.localAuthorityCode || '';
    if(postcodeNote && resolvedAuthority) postcodeNote.textContent=`${resolvedAuthority} · local house-price area`;

    const resolvePostcode=async()=>{
      const postcode=(refs.postcode?.value || '').trim().toUpperCase();
      if(!postcode){
        resolvedAuthority='';
        resolvedAuthorityCode='';
        if(postcodeNote) postcodeNote.textContent='Used for local house-price data';
        return;
      }
      if(postcodeNote) postcodeNote.textContent='Checking postcode…';
      try{
        const response=await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`,{cache:'no-store'});
        if(!response.ok) throw new Error('Postcode not found');
        const data=await response.json();
        const result=data?.result;
        if(!result?.admin_district) throw new Error('Local authority unavailable');
        refs.postcode.value=result.postcode || postcode;
        resolvedAuthority=result.admin_district;
        resolvedAuthorityCode=result.codes?.admin_district || '';
        if(postcodeNote) postcodeNote.textContent=`${resolvedAuthority} · local house-price area`;
      }catch(_){
        resolvedAuthority='';
        resolvedAuthorityCode='';
        if(postcodeNote) postcodeNote.textContent='Could not match this postcode — check it and try again';
      }
    };
    refs.postcode?.addEventListener('blur',resolvePostcode);
    refs.postcode?.addEventListener('change',resolvePostcode);

    const persist = () => {
      const next = {
        purchasePrice: refs.purchasePrice?.value || '',
        purchaseMonth: refs.purchaseMonth?.value || '',
        postcode: (refs.postcode?.value || '').trim().toUpperCase(),
        localAuthority: resolvedAuthority,
        localAuthorityCode: resolvedAuthorityCode,
        propertyType: refs.propertyType?.value || '',
        bedrooms: refs.bedrooms?.value || '',
        improvements: refs.improvements?.value || '',
        recentValue: refs.recentValue?.value || '',
        low: Number(refs.low?.value || defaults.low),
        trend: Number(refs.trend?.value || defaults.trend),
        high: Number(refs.high?.value || defaults.high),
      };
      saveSettings(next);
    };

    modal.querySelector('[data-action="save"]')?.addEventListener('click', persist);
  }

  isolateLegacyControls();
  setTimeout(isolateLegacyControls, 250);
  setTimeout(isolateLegacyControls, 700);

  const button = document.getElementById('personalDataButton');
  if(button) button.addEventListener('click', () => requestAnimationFrame(mount));
  document.addEventListener('mortgage-setup-opened', () => requestAnimationFrame(mount));
})();