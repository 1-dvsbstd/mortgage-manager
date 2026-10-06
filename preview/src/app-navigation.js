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

  function mergeScenarioIntoTrajectory(){
    const scenario=$('.scenario-panel'), chart=$('.chart-panel');
    if(!scenario||!chart||chart.dataset.whatIfMerged==='true') return;
    chart.dataset.whatIfMerged='true';
    chart.classList.add('trajectory-with-what-if');

    scenario.classList.remove('panel','expandable-card');
    scenario.classList.add('trajectory-what-if');
    scenario.removeAttribute('tabindex');
    scenario.removeAttribute('aria-expanded');
    scenario.querySelector('[data-expand-card]')?.remove();
    scenario.querySelector('.expand-hint')?.remove();

    const scenarioDetail=$('.expand-detail',scenario);
    const trajectoryDetail=$('.trajectory-details',chart);
    if(scenarioDetail && trajectoryDetail){
      scenarioDetail.classList.add('trajectory-scenario-detail');
      trajectoryDetail.appendChild(scenarioDetail);
    }

    const chartWrap=$('.chart-wrap',chart);
    if(chartWrap) chart.insertBefore(scenario,chartWrap);
    else chart.appendChild(scenario);
  }

  function relocateCurrentFeatures(){
    const current=$('.app-view-current .app-view-content');
    const chart=$('.app-view-current .chart-panel');
    if(current&&chart&&chart.parentElement!==current) current.appendChild(chart);
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
    next.removeAttribute('tabindex');
    next.removeAttribute('aria-expanded');
    next.querySelector('[data-expand-card]')?.remove();
    next.querySelector('.expand-hint')?.remove();
    document.getElementById('dealForecast')?.setAttribute('hidden','');

    const timeline=makeUpcomingSection('upcoming-timeline','Remortgage readiness','Your current fix');

    const ratesSection=makeUpcomingSection('upcoming-rates','Rate outlook','What your payment could look like');
    const ratesBody=$('.upcoming-section-body',ratesSection);
    const rateGrid=document.getElementById('dealPlannerRateGrid');
    const rateNote=$('.deal-planner-note',next);
    if(rateGrid) ratesBody.appendChild(rateGrid);
    if(rateNote) ratesBody.appendChild(rateNote);

    const position=makeUpcomingSection('upcoming-position','Deal-end snapshot','Your position at deal end');
    const positionBody=$('.upcoming-section-body',position);
    const plannerMissing=document.getElementById('dealPlannerMissing');
    if(plannerMissing) positionBody.appendChild(plannerMissing);
    positionBody.appendChild(summary);

    const interestBox=$('.interest-box',next);
    if(interestBox){
      interestBox.classList.add('deal-position-interest');
      const label=interestBox.querySelector(':scope > span');
      if(label) label.textContent='Interest remaining on current path';
      summary.appendChild(interestBox);
    }
    milestone.classList.add('deal-position-milestone');
    positionBody.appendChild(milestone);

    if(rates.parentElement) rates.remove();

    const shell=document.createElement('div');
    shell.className='upcoming-sections';
    [timeline,ratesSection,position].forEach((section)=>shell.appendChild(section));
    next.appendChild(shell);

    [...next.children].forEach((child)=>{
      if(child===shell) return;
      child.hidden=true;
      child.classList.add('upcoming-legacy-source');
    });

    const oldDetail=$('.expand-detail',next);
    const oldPlanner=document.getElementById('dealEndPlanner');
    if(oldDetail) oldDetail.hidden=true;
    if(oldPlanner) oldPlanner.hidden=true;
    document.getElementById('dealActionHint')?.remove();
  }

  function relocateUpcomingFeatures(){
    const upcoming=$('.app-view-upcoming .app-view-content');
    if(!upcoming) return;
    if($('.upcoming-sections',upcoming)) return;
    refineUpcomingLayout();
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

  function organiseViews(){ relocateCurrentFeatures(); relocateUpcomingFeatures(); wireSetupProfileSettings(); }

  function buildShell(){
    const shell=$('.app-view-shell');
    if(!shell) return;
    organiseViews();
    requestAnimationFrame(organiseViews);
    setTimeout(organiseViews,240);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>requestAnimationFrame(buildShell),{once:true}); else requestAnimationFrame(buildShell);
})();