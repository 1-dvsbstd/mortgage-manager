(() => {
  const canvas = document.getElementById('chart');
  if (!canvas || !window.MortgageMath) return;

  let hoverMonth = null;
  let pinned = false;
  let resizeFrame = null;

  const C = {
    grid:'rgba(64,54,45,.10)',
    gridSoft:'rgba(64,54,45,.055)',
    label:'#777d80',
    scheduled:'#8a949c',
    current:'#c39b72',
    selected:'#9b663b',
    equity:'#b8aa99',
    marker:'rgba(155,102,59,.48)',
    markerText:'#8b603d',
    hover:'rgba(64,54,45,.24)',
    dotRing:'#f3ede5',
  };

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
    const state = window.MortgageStore?.get?.();
    if (state) return {
      balance:state.balance, rate:state.rate, payment:state.payment,
      regular:state.currentOverpayment, homeValue:state.homeValue,
      ownership:state.ownership, extra:state.scenarioExtra, fixedEnd:state.fixedEnd,
    };
    return {
      balance:+document.getElementById('balance')?.value||0,
      rate:+document.getElementById('rate')?.value||0,
      payment:+document.getElementById('payment')?.value||0,
      regular:0,
      homeValue:+document.getElementById('homeValue')?.value||0,
      ownership:Math.min(100,Math.max(0,+document.getElementById('ownership')?.value||0)),
      extra:Math.max(0,+document.getElementById('customExtra')?.value||0),
      fixedEnd:document.getElementById('fixedEnd')?.value||'',
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
    if(readout) return readout;
    readout=document.createElement('div'); readout.id='chartReadout'; readout.className='chart-readout';
    readout.setAttribute('aria-live','polite'); canvas.insertAdjacentElement('afterend',readout); return readout;
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
    const currentPayment=Math.max(0,Number(v.payment)||0)+Math.max(0,Number(v.regular)||0);
    const current=MortgageMath.amortize(v.balance,v.rate,currentPayment);
    const selected=MortgageMath.amortize(v.balance,v.rate,currentPayment+Math.max(0,Number(v.extra)||0));
    return {scheduled,current,selected};
  }

  function render(){
    const v=values(), {scheduled,current,selected}=pathsFor(v);
    if(!scheduled?.monthlyPoints?.length||!current?.monthlyPoints?.length||!selected?.monthlyPoints?.length) return;
    const container=canvas.parentElement, rectWidth=Math.floor(container?.getBoundingClientRect().width||0); if(rectWidth<80) return;
    const cssWidth=Math.max(280,rectWidth), compact=cssWidth<520, cssHeight=cssWidth<620?270:330, dpr=Math.min(window.devicePixelRatio||1,3);
    canvas.style.width='100%'; canvas.style.height=`${cssHeight}px`; canvas.width=Math.floor(cssWidth*dpr); canvas.height=Math.floor(cssHeight*dpr);
    const ctx=canvas.getContext('2d'); if(!ctx) return;
    ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,cssWidth,cssHeight);

    const pad={left:compact?52:62,right:compact?18:26,top:compact?22:18,bottom:compact?54:50};
    const width=Math.max(1,cssWidth-pad.left-pad.right), height=Math.max(1,cssHeight-pad.top-pad.bottom);
    const maxMonths=Math.max(scheduled.monthlyPoints.length,current.monthlyPoints.length,selected.monthlyPoints.length)-1||1;
    const equity=makeEquityPoints(v,selected.monthlyPoints,maxMonths);
    const maxValue=Math.max(scheduled.monthlyPoints[0]||0,current.monthlyPoints[0]||0,selected.monthlyPoints[0]||0,equity.length?Math.max(...equity):0,1);
    const xFor=(month)=>pad.left+width*(month/maxMonths);
    const yFor=(value)=>pad.top+height*(1-Math.max(0,value)/maxValue);

    ctx.font='11px system-ui'; ctx.textBaseline='middle';
    for(let i=0;i<=4;i+=1){
      const y=pad.top+(height*i)/4;
      ctx.strokeStyle=C.grid; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(pad.left,y); ctx.lineTo(pad.left+width,y); ctx.stroke();
      ctx.fillStyle=C.label; ctx.textAlign='right'; ctx.fillText(compactMoney(maxValue*(1-i/4)),pad.left-10,y);
    }

    const ticks=yearTicks(maxMonths,cssWidth); ctx.textBaseline='alphabetic'; ctx.font=compact?'10px system-ui':'11px system-ui';
    ticks.forEach(({month,label},index)=>{
      const x=xFor(month);
      if(index>0&&index<ticks.length-1){ ctx.strokeStyle=C.gridSoft; ctx.beginPath(); ctx.moveTo(x,pad.top); ctx.lineTo(x,pad.top+height); ctx.stroke(); }
      ctx.fillStyle=C.label; ctx.textAlign=index===0?'left':index===ticks.length-1?'right':'center'; ctx.fillText(label,x,cssHeight-17);
    });

    const drawLine=(points,colour,lineWidth,dash=[])=>{
      if(!points?.length) return;
      ctx.save(); ctx.strokeStyle=colour; ctx.lineWidth=lineWidth; ctx.lineJoin='round'; ctx.lineCap='round'; ctx.setLineDash(dash); ctx.beginPath();
      points.forEach((value,month)=>{ const x=xFor(Math.min(month,maxMonths)), y=yFor(value); month===0?ctx.moveTo(x,y):ctx.lineTo(x,y); });
      ctx.stroke(); ctx.restore();
    };
    drawLine(scheduled.monthlyPoints,C.scheduled,compact?1.7:2,[4,4]);
    drawLine(current.monthlyPoints,C.current,compact?2.2:2.5);
    drawLine(selected.monthlyPoints,C.selected,compact?2.9:3.2);
    drawLine(equity,C.equity,compact?2:2.3,[7,5]);

    const fixed=monthsUntil(v.fixedEnd);
    if(fixed!==null&&fixed>=0&&fixed<=maxMonths){
      const x=xFor(fixed); ctx.save(); ctx.setLineDash([4,5]); ctx.strokeStyle=C.marker; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(x,pad.top); ctx.lineTo(x,pad.top+height); ctx.stroke(); ctx.restore();
      ctx.fillStyle=C.markerText; ctx.font=compact?'9px system-ui':'10px system-ui'; ctx.textAlign=x>cssWidth*.72?'right':'left'; ctx.fillText('Fix ends',x+(x>cssWidth*.72?-5:5),pad.top+13);
    }

    const readout=ensureReadout();
    if(hoverMonth===null){ readout.innerHTML=`<span>${compact?'Tap':'Hover or tap'} the chart to compare scheduled, current and What-if paths.</span>`; return; }
    const month=Math.max(0,Math.min(maxMonths,hoverMonth)), x=xFor(month);
    const sb=pointAt(scheduled.monthlyPoints,month), cb=pointAt(current.monthlyPoints,month), wb=pointAt(selected.monthlyPoints,month), eq=pointAt(equity,month);
    ctx.strokeStyle=C.hover; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(x,pad.top); ctx.lineTo(x,pad.top+height); ctx.stroke();
    const dot=(value,colour)=>{ ctx.fillStyle=colour; ctx.beginPath(); ctx.arc(x,yFor(value),4,0,Math.PI*2); ctx.fill(); ctx.strokeStyle=C.dotRing; ctx.lineWidth=2; ctx.stroke(); };
    dot(sb,C.scheduled); dot(cb,C.current); dot(wb,C.selected); if(equity.length) dot(eq,C.equity);
    const home=v.homeValue>0?v.homeValue*Math.pow(1+homeTrend()/100,month/12):0, ltv=home>0?(wb/home)*100:null;
    readout.innerHTML=`<strong>${formatPointDate(month)}</strong><span>Scheduled only ${money(sb)}</span><span>Current overpayment ${money(cb)}</span><span>Selected What-if ${money(wb)}</span><span>Projected equity ${equity.length?money(eq):'—'}${ltv===null?'':` · ${ltv.toFixed(1)}% projected LTV`}</span>`;
  }

  function monthFromPointer(event){
    const rect=canvas.getBoundingClientRect(), compact=rect.width<520, left=compact?52:62, right=compact?18:26, usable=Math.max(1,rect.width-left-right);
    const p=pathsFor(values()), maxMonths=Math.max(p.scheduled.monthlyPoints.length,p.current.monthlyPoints.length,p.selected.monthlyPoints.length)-1||1;
    return Math.round(Math.min(1,Math.max(0,(event.clientX-rect.left-left)/usable))*maxMonths);
  }

  canvas.addEventListener('pointermove',(e)=>{ if(e.pointerType==='touch'||pinned)return; hoverMonth=monthFromPointer(e); render(); });
  canvas.addEventListener('pointerleave',()=>{ if(!pinned){hoverMonth=null;render();} });
  canvas.addEventListener('pointerup',(e)=>{ if(e.pointerType==='touch'||e.pointerType==='pen'){e.stopPropagation();hoverMonth=monthFromPointer(e);pinned=true;render();} });
  canvas.addEventListener('click',(e)=>{e.stopPropagation();hoverMonth=monthFromPointer(e);pinned=true;render();});
  canvas.addEventListener('dblclick',(e)=>{e.stopPropagation();pinned=false;hoverMonth=null;render();});

  const schedule=()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>requestAnimationFrame(render));};
  if(window.MortgageStore?.subscribe) window.MortgageStore.subscribe(schedule);
  document.addEventListener('input',(e)=>{if(e.target.matches('#projectionTrendRate'))schedule();});
  window.addEventListener('resize',schedule); window.addEventListener('orientationchange',()=>setTimeout(render,180)); window.addEventListener('pageshow',schedule);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(render,80);});
  if('ResizeObserver' in window&&canvas.parentElement)new ResizeObserver(schedule).observe(canvas.parentElement);
  schedule();
})();