(() => {
  const canvas = document.getElementById('chart');
  if (!canvas || !window.MortgageMath) return;

  let resizeFrame = null;

  const themeColour = (name, fallback) => {
    const value=getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value||fallback;
  };
  const palette = () => ({
    grid:'rgba(64,54,45,.055)',
    gridSoft:'rgba(64,54,45,.022)',
    label:themeColour('--muted','#777d80'),
    scheduled:'rgba(125,139,145,.60)',
    current:themeColour('--theme-hero-ink','#31554d'),
    selected:themeColour('--positive','#4f806d'),
    equity:themeColour('--accent','#b58a5b'),
    marker:'rgba(155,102,59,.24)',
    markerText:themeColour('--accent-strong','#8b603d'),
    hover:'rgba(64,54,45,.18)',
    dotRing:themeColour('--surface','#f3ede5'),
  });

  const money = (value) => new Intl.NumberFormat('en-GB', {
    style:'currency', currency:'GBP', maximumFractionDigits:0,
  }).format(Math.max(0, Number(value) || 0));
  const compactMoney = (value) => {
    const n = Math.max(0, Number(value) || 0);
    return n >= 1000 ? `£${Math.round(n / 1000)}k` : money(n);
  };

  const homeTrend = () => {
    try {
      const settings = JSON.parse(localStorage.getItem('mortgage-manager-home-projection-v4') || '{}');
      const n = Number(settings.trend);
      return Number.isFinite(n) ? n : 2.5;
    } catch (_) { return 2.5; }
  };

  const values = () => {
    const state = window.MortgageStore?.get?.() || {};
    return {
      balance:Number(state.balance)||0,
      rate:Number(state.rate)||0,
      payment:Number(state.payment)||0,
      regular:Number(state.currentOverpayment)||0,
      homeValue:Number(state.homeValue)||0,
      ownership:Math.min(100,Math.max(0,Number(state.ownership)||0)),
      extra:Number(state.scenarioExtra)||0,
      fixedEnd:state.fixedEnd||'',
    };
  };

  function dateAt(months){ const d=new Date(); d.setDate(1); d.setMonth(d.getMonth()+months); return d; }
  function monthsUntil(value){
    if(!value) return null;
    const [year,month]=String(value).split('-').map(Number); if(!year||!month) return null;
    const now=new Date(); return (year-now.getFullYear())*12+(month-1-now.getMonth());
  }
  function formatPointDate(months){ return new Intl.DateTimeFormat('en-GB',{month:'short',year:'numeric'}).format(dateAt(months)); }
  function pointAt(points,month){ if(!points?.length) return 0; return points[Math.min(Math.max(0,month),points.length-1)]??0; }

  function makeEquityPoints(v,mortgagePoints,maxMonths){
    if(!v.homeValue||!v.ownership) return [];
    const trend=homeTrend(), owned=v.ownership/100, points=[];
    for(let month=0;month<=maxMonths;month+=1){
      const home=v.homeValue*Math.pow(1+trend/100,month/12);
      points.push(Math.max(0,home*owned-pointAt(mortgagePoints,month)));
    }
    return points;
  }

  function ensureReadout(){
    let readout=document.getElementById('chartReadout');
    const wrap=canvas.closest('.chart-wrap');
    const stage=canvas.closest('.trajectory-chart-stage');
    if(!readout){
      readout=document.createElement('div');
      readout.id='chartReadout';
      readout.className='chart-readout trajectory-payoff';
      readout.setAttribute('aria-live','polite');
    }
    if(stage&&wrap&&readout.parentElement!==stage) stage.insertBefore(readout,wrap);
    else if(stage&&wrap&&readout.nextElementSibling!==wrap) stage.insertBefore(readout,wrap);
    return readout;
  }

  function yearTicks(maxMonths,cssWidth){
    const years=Math.max(1,maxMonths/12), maxTicks=cssWidth<420?5:cssWidth<620?6:8;
    const step=Math.max(1,Math.ceil(years/Math.max(1,maxTicks-1)))*12;
    const ticks=[{month:0,label:String(dateAt(0).getFullYear())}];
    for(let m=step;m<maxMonths;m+=step) ticks.push({month:m,label:String(dateAt(m).getFullYear())});
    const final={month:maxMonths,label:String(dateAt(maxMonths).getFullYear())};
    if(!ticks.length||maxMonths-ticks[ticks.length-1].month>Math.max(6,step*.35)) ticks.push(final); else ticks[ticks.length-1]=final;
    return ticks;
  }

  function pathsFor(v){
    const scheduled=MortgageMath.amortize(v.balance,v.rate,Math.max(0,Number(v.payment)||0));
    const basePayment=Math.max(0,Number(v.payment)||0);
    const currentPayment=basePayment+Math.max(0,Number(v.regular)||0);
    const current=MortgageMath.amortize(v.balance,v.rate,currentPayment);
    const selected=MortgageMath.amortize(v.balance,v.rate,basePayment+Math.max(0,Number(v.extra)||0));
    return {scheduled,current,selected};
  }

  function render(){
    const C=palette();
    const v=values(), {scheduled,current,selected}=pathsFor(v);
    if(!scheduled?.monthlyPoints?.length||!current?.monthlyPoints?.length||!selected?.monthlyPoints?.length) return;
    const container=canvas.parentElement, rectWidth=Math.floor(container?.getBoundingClientRect().width||0); if(rectWidth<80) return;
    const cssWidth=Math.max(280,rectWidth), compact=cssWidth<520;
    const workspace=container.closest('.trajectory-workspace');
    const rail=workspace?.querySelector('.trajectory-scenario-controls');
    const railHeight=Math.floor(rail?.getBoundingClientRect().height||0);
    const proportional=Math.round(cssWidth*.43);
    const desktopFill=railHeight>0?Math.max(310,railHeight-58):330;
    const cssHeight=compact?270:Math.max(320,Math.min(410,Math.max(proportional,desktopFill)));
    const dpr=Math.min(window.devicePixelRatio||1,3);
    canvas.style.width='100%'; canvas.style.height=`${cssHeight}px`; canvas.width=Math.floor(cssWidth*dpr); canvas.height=Math.floor(cssHeight*dpr);
    const ctx=canvas.getContext('2d'); if(!ctx) return;
    ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,cssWidth,cssHeight);

    const pad={left:compact?52:62,right:compact?18:26,top:compact?18:12,bottom:compact?48:44};
    const width=Math.max(1,cssWidth-pad.left-pad.right), height=Math.max(1,cssHeight-pad.top-pad.bottom);
    const maxMonths=Math.max(scheduled.monthlyPoints.length,current.monthlyPoints.length,selected.monthlyPoints.length)-1||1;
    const equity=makeEquityPoints(v,selected.monthlyPoints,maxMonths);
    const maxValue=Math.max(scheduled.monthlyPoints[0]||0,current.monthlyPoints[0]||0,selected.monthlyPoints[0]||0,equity.length?Math.max(...equity):0,1);
    const xFor=(month)=>pad.left+width*(month/maxMonths);
    const yFor=(value)=>pad.top+height*(1-Math.max(0,value)/maxValue);

    ctx.font='11px system-ui'; ctx.textBaseline='middle';
    const ySteps=3;
    for(let i=0;i<=ySteps;i+=1){
      const y=pad.top+(height*i)/ySteps;
      ctx.strokeStyle=C.grid; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(pad.left,y); ctx.lineTo(pad.left+width,y); ctx.stroke();
      ctx.fillStyle=C.label; ctx.textAlign='right'; ctx.fillText(compactMoney(maxValue*(1-i/ySteps)),pad.left-10,y);
    }

    const ticks=yearTicks(maxMonths,cssWidth); ctx.textBaseline='alphabetic'; ctx.font=compact?'10px system-ui':'11px system-ui';
    ticks.forEach(({month,label},index)=>{
      const x=xFor(month);
      if(index>0&&index<ticks.length-1){ ctx.strokeStyle=C.gridSoft; ctx.beginPath(); ctx.moveTo(x,pad.top); ctx.lineTo(x,pad.top+height); ctx.stroke(); }
      ctx.fillStyle=C.label; ctx.textAlign=index===0?'left':index===ticks.length-1?'right':'center'; ctx.fillText(label,x,cssHeight-17);
    });

    const drawLine=(points,colour,lineWidth,dash=[],opacity=1)=>{
      if(!points?.length) return;
      ctx.save(); ctx.globalAlpha=opacity; ctx.strokeStyle=colour; ctx.lineWidth=lineWidth; ctx.lineJoin='round'; ctx.lineCap='round'; ctx.setLineDash(dash); ctx.beginPath();
      points.forEach((value,month)=>{ const x=xFor(Math.min(month,maxMonths)), y=yFor(value); month===0?ctx.moveTo(x,y):ctx.lineTo(x,y); });
      ctx.stroke(); ctx.restore();
    };
    if(equity.length){
      ctx.save();
      const fill=ctx.createLinearGradient(0,pad.top,0,pad.top+height);
      fill.addColorStop(0,'rgba(181,138,91,.11)');
      fill.addColorStop(1,'rgba(181,138,91,.015)');
      ctx.beginPath();
      equity.forEach((value,month)=>{
        const x=xFor(Math.min(month,maxMonths)),y=yFor(value);
        month===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
      });
      ctx.lineTo(xFor(maxMonths),pad.top+height);
      ctx.lineTo(xFor(0),pad.top+height);
      ctx.closePath();
      ctx.fillStyle=fill;
      ctx.fill();
      ctx.restore();
    }
    const hasWhatIf=Math.max(0,Number(v.extra)||0)>.01;
    drawLine(scheduled.monthlyPoints,C.scheduled,compact?1.05:1.15,[5,6],.58);
    drawLine(current.monthlyPoints,C.current,compact?(hasWhatIf?1.8:2.7):(hasWhatIf?2.0:3.0),[],hasWhatIf?.70:1);
    if(hasWhatIf) drawLine(selected.monthlyPoints,C.selected,compact?3.25:3.65,[],1);
    drawLine(equity,C.equity,compact?1.45:1.6,[8,6],.88);

    const fixed=monthsUntil(v.fixedEnd);
    if(fixed!==null&&fixed>=0&&fixed<=maxMonths){
      const x=xFor(fixed); ctx.save(); ctx.setLineDash([3,5]); ctx.strokeStyle=C.markerText; ctx.globalAlpha=.42; ctx.lineWidth=1.15; ctx.beginPath(); ctx.moveTo(x,pad.top+17); ctx.lineTo(x,pad.top+height); ctx.stroke(); ctx.restore();
      const label='Fix ends';
      ctx.font=compact?'9px system-ui':'10px system-ui';
      const tw=ctx.measureText(label).width, pillW=tw+12, pillH=18;
      const pillX=Math.max(pad.left+2,Math.min(pad.left+width-pillW-2,x-pillW/2));
      const pillY=Math.max(0,pad.top-1);
      ctx.save();
      ctx.fillStyle='rgba(250,247,241,.90)';
      ctx.beginPath(); ctx.roundRect(pillX,pillY,pillW,pillH,9); ctx.fill();
      ctx.fillStyle=C.markerText; ctx.globalAlpha=1; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(label,pillX+pillW/2,pillY+pillH/2+.5);
      ctx.restore();
    }

    const readout=ensureReadout();
    const currentPayoff=Math.max(0,current.monthlyPoints.length-1);
    const selectedPayoff=Math.max(0,selected.monthlyPoints.length-1);
    const savedMonths=Math.max(0,currentPayoff-selectedPayoff);
    const savedYears=Math.floor(savedMonths/12),savedRemainder=savedMonths%12;
    const savedDuration=savedYears&&savedRemainder?`${savedYears}y ${savedRemainder}m`:savedYears?`${savedYears}y`:`${savedRemainder}m`;
    const selectedDate=formatPointDate(selectedPayoff);
    const currentDate=formatPointDate(currentPayoff);
    readout.innerHTML=hasWhatIf
      ? `<span><strong>${money(v.extra)}/month</strong> reaches mortgage-free <b>${selectedDate}</b> — ${savedDuration} earlier than your current plan.</span>`
      : `<span>Your current plan reaches mortgage-free <b>${currentDate}</b>.</span>`;
  }

  const schedule=()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>requestAnimationFrame(render));};
  if(window.MortgageStore?.subscribe) window.MortgageStore.subscribe(schedule);
  document.addEventListener('input',(e)=>{if(e.target.matches('#projectionTrendRate'))schedule();});
  window.addEventListener('resize',schedule); window.addEventListener('orientationchange',()=>setTimeout(render,180)); window.addEventListener('pageshow',schedule);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(render,80);});
  if('ResizeObserver' in window&&canvas.parentElement)new ResizeObserver(schedule).observe(canvas.parentElement);
  schedule();
})();