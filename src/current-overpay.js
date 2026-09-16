(() => {
  if (!window.MortgageMath) return;
  const originalAmortize = window.MortgageMath.amortize;
  window.MortgageMath.compare = (balance, annualRate, monthlyPayment, hypotheticalExtra) => {
    const state = window.MortgageStore?.get?.();
    const currentExtra = Math.max(0, Number(state?.currentOverpayment ?? document.getElementById('currentOverpayment')?.value) || 0);
    const whatIfExtra = Math.max(0, Number(hypotheticalExtra) || 0);
    const basePayment = Math.max(0, Number(monthlyPayment) || 0) + currentExtra;
    const base = originalAmortize(balance, annualRate, basePayment);
    const accelerated = originalAmortize(balance, annualRate, basePayment + whatIfExtra);
    return {
      base,
      accelerated,
      monthsSaved: Number.isFinite(base.months) && Number.isFinite(accelerated.months) ? Math.max(0, base.months - accelerated.months) : 0,
      interestSaved: Number.isFinite(base.interest) && Number.isFinite(accelerated.interest) ? Math.max(0, base.interest - accelerated.interest) : 0,
    };
  };
})();
