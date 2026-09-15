(() => {
  const current = document.getElementById('currentOverpayment');
  const display = document.getElementById('currentOverpayDisplay');
  const money = (value) => new Intl.NumberFormat('en-GB', { style:'currency', currency:'GBP', maximumFractionDigits:0 }).format(Math.max(0, Number(value)||0));
  const key = 'mortgage-manager-current-overpayment-v1';
  if (current) {
    try { const saved = localStorage.getItem(key); if (saved !== null) current.value = saved; } catch (_) {}
    const sync = () => {
      const value = Math.max(0, Number(current.value)||0);
      if (display) display.textContent = `${money(value)}/month`;
      try { localStorage.setItem(key, String(value)); } catch (_) {}
      document.getElementById('customExtra')?.dispatchEvent(new Event('input', { bubbles:true }));
    };
    current.addEventListener('input', sync);
    sync();
  }

  const dealDetail = document.querySelector('.next-panel .expand-detail');
  if (dealDetail && !document.getElementById('dealMarketCompare')) {
    const block = document.createElement('div');
    block.id = 'dealMarketCompare';
    block.className = 'deal-market-compare';
    block.innerHTML = `
      <div class="deep-heading"><div><p class="eyebrow">Rate comparison</p><h2>Your rate vs indicative market averages</h2></div><span class="source-date">Moneyfacts · 1 Sep 2026</span></div>
      <div class="market-comparison">
        <div class="market-current"><span>Your rate</span><strong id="dealYourRate">—</strong><small id="dealLtvBand">—</small></div>
        <div><span>Avg 2-year fix</span><strong id="deal2yRate">—</strong><small id="deal2yPayment">—</small></div>
        <div><span>Avg 5-year fix</span><strong id="deal5yRate">—</strong><small id="deal5yPayment">—</small></div>
      </div>`;
    dealDetail.insertAdjacentElement('afterbegin', block);
  }

  const copyRates = () => {
    const map = [
      ['marketCurrentRate','dealYourRate'],['marketLtvBand','dealLtvBand'],['market2yRate','deal2yRate'],['market2yPayment','deal2yPayment'],['market5yRate','deal5yRate'],['market5yPayment','deal5yPayment']
    ];
    map.forEach(([from,to]) => { const a=document.getElementById(from), b=document.getElementById(to); if(a&&b) b.textContent=a.textContent; });
  };
  copyRates();
  const observer = new MutationObserver(copyRates);
  ['marketCurrentRate','marketLtvBand','market2yRate','market2yPayment','market5yRate','market5yPayment'].forEach((id)=>{ const el=document.getElementById(id); if(el) observer.observe(el,{childList:true,characterData:true,subtree:true}); });
})();