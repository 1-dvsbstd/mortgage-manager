(() => {
  const VIEW_KEY = 'mortgage-manager-view-v1';
  const views = {
    current: { label:'Current', eyebrow:'Today', title:'Your position now', subtitle:'Your mortgage, equity, overpayments and progress from today.' },
    upcoming: { label:'Upcoming', eyebrow:'Next', title:'Deal planning', subtitle:'Your fixed-deal timeline, projected position and next mortgage decision.' },
    future: { label:'Future', eyebrow:'Later', title:'Long-term planning', subtitle:'What your selected overpayment could mean for your home and next move.' },
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const money = (value) => new Intl.NumberFormat('en-GB', { style:'currency', currency:'GBP', maximumFractionDigits:0 }).format(Math.max(0, Number(value)||0));

  function savedView(){ try{ const value=localStorage.getItem(VIEW_KEY); return views[value]?value:'current'; }catch(_){ return 'current'; } }
  function saveView(value){ try{ localStorage.setItem(VIEW_KEY,value); }catch(_){} }

  function makeNav(className){
    const nav=document.createElement('nav'); nav.className=className; nav.setAttribute('aria-label','Mortgage Manager sections');
    nav.innerHTML=Object.entries(views).map(([key,meta])=>`<button type="button" data-app-view="${key}" aria-controls="view-${key}"><span>${meta.label}</span></button>`).join('');
    return nav;
  }

  function makeView(key,meta){
    const section=document.createElement('section'); section.id=`view-${key}`; section.className=`app-view app-view-${key}`; section.dataset.view=key; section.setAttribute('aria-labelledby',`view-${key}-title`);
    section.innerHTML=`<header class="app-view-heading"><div><p class="eyebrow">${meta.eyebrow}</p><h1 id="view-${key}-title">${meta.title}</h1></div><p>${meta.subtitle}</p></header><div class="app-view-content"></div>`;
    return section;
  }

  function cardifyFeature(element,kind){ if(!element)return; element.classList.add('panel','temporal-feature-card',`temporal-feature-${kind}`); }

  function ensureFutureAssumption(){
    const future=$('.app-view-future .app-view-content'); if(!future)return;
    let panel=document.getElementById('futureOverpaymentAssumption');
    if(!panel){
      panel=document.createElement('section'); panel.id='futureOverpaymentAssumption'; panel.className='future-overpayment-assumption';
      panel.innerHTML=`<div class="future-assumption-copy"><div><span class="future-assumption-label">Planning with</span><strong id="futureExtraSummary">£0/month extra</strong></div><p>Future projections follow the What-if amount from Current.</p></div><div class="future-assumption-controls" aria-label="Future extra overpayment assumption"><button type="button" data-future-extra="0">£0</button><button type="button" data-future-extra="50">£50</button><button type="button" data-future-extra="100">£100</button><button type="button" data-future-extra="250">£250</button><button type="button" data-future-extra="500">£500</button><label>Custom £<input id="futureExtraInput" type="number" min="0" step="10" inputmode="decimal"></label></div>`;
      future.insertAdjacentElement('afterbegin',panel);
      panel.addEventListener('click',(event)=>{ const button=event.target.closest('[data-future-extra]'); if(!button||!window.MortgageStore)return; MortgageStore.set({scenarioExtra:Math.max(0,Number(button.dataset.futureExtra)||0)}); });
      $('#futureExtraInput',panel)?.addEventListener('input',(event)=>{ if(window.MortgageStore) MortgageStore.set({scenarioExtra:Math.max(0,Number(event.target.value)||0)}); });
    }
    renderFutureAssumption();
  }

  function renderFutureAssumption(){
    const panel=document.getElementById('futureOverpaymentAssumption'); if(!panel)return;
    const extra=Math.max(0,Number(window.MortgageStore?.get?.().scenarioExtra)||0), summary=document.getElementById('futureExtraSummary'), input=document.getElementById('futureExtraInput');
    if(summary) summary.textContent=`${money(extra)}/month extra`;
    if(input&&document.activeElement!==input) input.value=String(extra);
    panel.querySelectorAll('[data-future-extra]').forEach((button)=>button.classList.toggle('active',Number(button.dataset.futureExtra)===extra));
  }

  function ensureCurrentOverpaymentPanel(){
    const current=$('.app-view-current .app-view-content'); if(!current)return;
    let panel=document.getElementById('currentOverpaymentPanel');
    if(!panel){
      panel=document.createElement('section'); panel.id='currentOverpaymentPanel'; panel.className='panel current-overpayment-panel';
      panel.innerHTML=`<div class="current-overpayment-heading"><div><p class="eyebrow">Regular overpayment</p><h2>What you already pay extra</h2><p>Your saved monthly overpayment and the benefit it is already creating.</p></div></div><div class="current-overpayment-body"></div>`;
      const home=$('.home-panel',current); if(home) home.insertAdjacentElement('afterend',panel); else current.appendChild(panel);
    }
    const body=$('.current-overpayment-body',panel), savings=document.getElementById('currentSavingsSummary'), control=document.querySelector('.current-overpay-control');
    if(savings&&savings.parentElement!==body) body.appendChild(savings);
    if(control){ control.classList.remove('source-fields-only'); if(control.parentElement!==body) body.appendChild(control); }
  }

  function makeHomeGlance(){
    const home=$('.home-panel'); if(!home||home.dataset.glanceReady==='true') return;
    home.dataset.glanceReady='true'; home.dataset.expandableDisabled='true'; home.classList.add('home-glance-card'); home.classList.remove('expandable-card'); home.removeAttribute('tabindex'); home.removeAttribute('aria-expanded');
    home.querySelector('[data-expand-card]')?.remove(); home.querySelector('.expand-hint')?.remove();
    const detail=$('.expand-detail',home), value=$('.home-value',home), stats=$('.home-stats',home), legend=$('.ownership-legend',home);
    if(stats && value) value.insertAdjacentElement('afterend',stats);
    if(legend && stats) stats.insertAdjacentElement('afterend',legend);
    if(detail) detail.classList.add('home-glance-source');
  }

  function refineExpandableCues(){
    const labels={ mortgage:'More · repayment breakdown', overpayment:'More · compare overpayment levels', trajectory:'More · yearly balances and milestones' };
    document.querySelectorAll('[data-expandable-card]').forEach((card)=>{
      card.querySelector('[data-expand-card]')?.classList.add('legacy-expand-cta');
      const hint=card.querySelector('.expand-hint'); const key=card.dataset.expandableCard;
      if(hint&&labels[key]) hint.textContent=labels[key];
    });
  }

  function relocateCurrentFeatures(){
    const current=$('.app-view-current .app-view-content'); if(!current)return;
    ensureCurrentOverpaymentPanel(); makeHomeGlance();
    const scenario=$('.scenario-panel'), chart=$('.chart-panel'), progress=document.getElementById('personalProgress');
    if(scenario&&scenario.parentElement!==current) current.appendChild(scenario);
    if(chart&&chart.parentElement!==current) current.appendChild(chart);
    if(progress&&progress.parentElement!==current) current.appendChild(progress);
  }

  function makeUpcomingSection(className, eyebrow, title){
    const section=document.createElement('section');
    section.className=`panel upcoming-section ${className}`;
    section.innerHTML=`<div class="upcoming-section-heading"><p class="eyebrow">${eyebrow}</p><h2>${title}</h2></div><div class="upcoming-section-body"></div>`;
    return section;
  }

  function refineUpcomingLayout(){
    const upcoming=$('.app-view-upcoming .app-view-content'), next=$('.next-panel');
    if(!upcoming||!next||next.dataset.sectionsReady==='true') return;
    const summary=document.getElementById('dealPlannerSummary');
    const milestone=document.getElementById('dealPlannerMilestone');
    const rates=$('.deal-planner-rates',next);
    if(!summary||!milestone||!rates) return;

    next.dataset.sectionsReady='true';
    next.classList.remove('panel','expandable-card');
    next.classList.add('upcoming-workspace');
    next.removeAttribute('tabindex'); next.removeAttribute('aria-expanded');
    next.querySelector('[data-expand-card]')?.remove(); next.querySelector('.expand-hint')?.remove();
    document.getElementById('dealForecast')?.setAttribute('hidden','');

    const timeline=makeUpcomingSection('upcoming-timeline','Deal timeline','Your current fix');
    const timelineBody=$('.upcoming-section-body',timeline);
    const eventTitle=document.getElementById('nextEventTitle'), eventText=document.getElementById('nextEventText'), track=$('.timeline-track',next), labels=$('.timeline-labels',next);
    [eventTitle,eventText,track,labels].forEach((node)=>{ if(node) timelineBody.appendChild(node); });

    const position=makeUpcomingSection('upcoming-position','At deal end','Projected position');
    const positionBody=$('.upcoming-section-body',position);
    const plannerHeading=$('.deal-planner-heading',next), plannerMissing=document.getElementById('dealPlannerMissing');
    if(plannerHeading) positionBody.appendChild(plannerHeading);
    if(plannerMissing) positionBody.appendChild(plannerMissing);
    positionBody.appendChild(summary);

    const action=makeUpcomingSection('upcoming-action','Next milestone','What could improve your position');
    $('.upcoming-section-body',action).appendChild(milestone);

    const rateSection=makeUpcomingSection('upcoming-rates','Rate scenarios','What your next payment could look like');
    const rateBody=$('.upcoming-section-body',rateSection);
    const rateSubhead=$('.deal-planner-subhead',rates); if(rateSubhead) rateSubhead.remove();
    const rateGrid=document.getElementById('dealPlannerRateGrid'); if(rateGrid) rateBody.appendChild(rateGrid);
    const note=$('.deal-planner-note',next); if(note) rateBody.appendChild(note);

    const interestBox=$('.interest-box',next);
    const interest=makeUpcomingSection('upcoming-interest','Supporting context','Interest remaining');
    if(interestBox) $('.upcoming-section-body',interest).appendChild(interestBox);

    const shell=document.createElement('div'); shell.className='upcoming-sections';
    [timeline,position,action,rateSection,interest].forEach((section)=>shell.appendChild(section));
    next.appendChild(shell);

    const oldDetail=$('.expand-detail',next), oldPlanner=document.getElementById('dealEndPlanner');
    if(oldDetail) oldDetail.hidden=true;
    if(oldPlanner) oldPlanner.hidden=true;
  }

  function relocateUpcomingFeatures(){
    const upcoming=$('.app-view-upcoming .app-view-content'); if(!upcoming)return;
    const next=$('.next-panel'); if(next&&next.parentElement!==upcoming) upcoming.appendChild(next);
    const sourceMarket=$('.hero-panel .market-block'); if(sourceMarket) sourceMarket.classList.add('market-source-only');
    refineUpcomingLayout();
  }

  function mergeFuturePlanning(){
    const planner=document.getElementById('nextHomePlanner'), cost=document.getElementById('propertyCostComparison');
    if(!planner||!cost) return;
    if(planner.tagName==='DETAILS') planner.open=true;
    const body=$('.next-home-body',planner);
    if(body && cost.parentElement!==body){
      cost.classList.remove('panel','temporal-feature-card','temporal-feature-cost-comparison');
      cost.classList.add('future-cost-inline');
      const timeline=$('.next-home-timeline',body);
      if(timeline) timeline.insertAdjacentElement('afterend',cost); else body.appendChild(cost);
    }
    const settings=$('.next-home-settings',planner); if(settings?.tagName==='DETAILS') settings.open=true;
    const history=document.getElementById('homeValueHistory'); if(history?.tagName==='DETAILS') history.open=true;
  }

  function relocateFutureFeatures(){
    const future=$('.app-view-future .app-view-content'); if(!future)return; ensureFutureAssumption();
    const home=document.getElementById('homeProjection'), planner=document.getElementById('nextHomePlanner'), cost=document.getElementById('propertyCostComparison');
    if(home){ cardifyFeature(home,'home-projection'); if(home.parentElement!==future) future.appendChild(home); }
    if(planner){ cardifyFeature(planner,'next-home'); planner.open=true; if(planner.parentElement!==future) future.appendChild(planner); }
    if(cost && !planner){ cardifyFeature(cost,'cost-comparison'); if(cost.parentElement!==future) future.appendChild(cost); }
    mergeFuturePlanning();
  }

  function restoreProfileSettings(profileSettings,originParent,originNext){ if(!profileSettings||!originParent||originParent.contains(profileSettings))return; if(originNext&&originNext.parentElement===originParent) originParent.insertBefore(profileSettings,originNext); else originParent.appendChild(profileSettings); }

  function mountProfileSettingsInSetup(){
    const backdrop=$('.personal-backdrop'), modal=$('.personal-modal',backdrop||document), profileSettings=$('.projection-assumptions');
    if(!backdrop||!modal||!profileSettings||modal.contains(profileSettings))return;
    const originParent=profileSettings.parentElement, originNext=profileSettings.nextElementSibling, section=document.createElement('div');
    section.className='personal-section personal-home-profile-section'; section.innerHTML='<h3>Home profile</h3><p>Purchase details, improvements and valuation assumptions used by the Future projections.</p><div class="personal-home-profile-host"></div>';
    const mortgageForm=$('.personal-form',modal); if(mortgageForm) mortgageForm.insertAdjacentElement('afterend',section); else modal.appendChild(section);
    $('.personal-home-profile-host',section).appendChild(profileSettings); profileSettings.open=true;
    const restoreSoon=()=>requestAnimationFrame(()=>{ if(!document.body.contains(backdrop)) restoreProfileSettings(profileSettings,originParent,originNext); });
    backdrop.addEventListener('click',restoreSoon,true);
  }

  function wireSetupProfileSettings(){
    const button=document.getElementById('personalDataButton');
    if(button&&!button.dataset.profileSettingsWired){ button.dataset.profileSettingsWired='true'; button.addEventListener('click',()=>requestAnimationFrame(mountProfileSettingsInSetup)); }
    setTimeout(mountProfileSettingsInSetup,520);
  }

  function organiseViews(){ relocateFutureFeatures(); relocateCurrentFeatures(); relocateUpcomingFeatures(); refineExpandableCues(); wireSetupProfileSettings(); }

  function buildShell(){
    const main=$('.app-shell'), topbar=$('.topbar',main), footer=$('.footer',main); if(!main||!topbar||!footer||$('.app-view-shell',main))return;
    const topNav=makeNav('app-section-nav app-section-nav-top'); topbar.classList.add('topbar-with-nav');
    const actions=$('.topbar-actions',topbar)||$('.save-status',topbar); if(actions) topbar.insertBefore(topNav,actions); else topbar.appendChild(topNav);
    const shell=document.createElement('div'); shell.className='app-view-shell'; Object.entries(views).forEach(([key,meta])=>shell.appendChild(makeView(key,meta))); footer.insertAdjacentElement('beforebegin',shell);
    const current=$('.app-view-current .app-view-content',shell), upcoming=$('.app-view-upcoming .app-view-content',shell);
    const hero=$('.hero-panel',main), home=$('.home-panel',main), next=$('.next-panel',main), edit=$('.edit-panel',main), dashboardGrid=$('.dashboard-grid',main);
    if(hero) current.appendChild(hero); if(home) current.appendChild(home); if(edit) current.appendChild(edit); if(next) upcoming.appendChild(next);
    organiseViews(); if(dashboardGrid&&!dashboardGrid.children.length) dashboardGrid.remove();
    const bottomNav=makeNav('app-section-nav app-section-nav-bottom'); document.body.appendChild(bottomNav);
    document.querySelectorAll('[data-app-view]').forEach((button)=>button.addEventListener('click',()=>activateView(button.dataset.appView,true)));
    activateView(savedView(),false); setTimeout(organiseViews,320); setTimeout(organiseViews,720);
  }

  function closeExpandedCards(){ document.querySelectorAll('.expandable-card.is-expanded').forEach((card)=>{ card.classList.remove('is-expanded'); card.setAttribute('aria-expanded','false'); }); document.body.classList.remove('card-open'); document.querySelector('.card-backdrop')?.remove(); }

  function activateView(key,userInitiated){
    if(!views[key]) key='current'; closeExpandedCards(); organiseViews();
    document.querySelectorAll('.app-view').forEach((view)=>{ const active=view.dataset.view===key; view.hidden=!active; view.classList.toggle('is-active',active); });
    document.querySelectorAll('[data-app-view]').forEach((button)=>{ const active=button.dataset.appView===key; button.classList.toggle('is-active',active); if(active) button.setAttribute('aria-current','page'); else button.removeAttribute('aria-current'); });
    document.body.dataset.appView=key;
    if(userInitiated){ saveView(key); window.scrollTo({top:0,behavior:'smooth'}); }
    requestAnimationFrame(()=>window.dispatchEvent(new Event('resize')));
  }

  if(window.MortgageStore?.subscribe) MortgageStore.subscribe((next,previous)=>{ if(next.scenarioExtra!==previous.scenarioExtra) requestAnimationFrame(renderFutureAssumption); });
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>requestAnimationFrame(buildShell),{once:true}); else requestAnimationFrame(buildShell);
})();