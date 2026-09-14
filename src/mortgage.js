window.MortgageMath = (() => {
  function amortize(balance, annualRate, monthlyPayment) {
    const principal = Number(balance) || 0;
    const rate = Number(annualRate) || 0;
    const payment = Number(monthlyPayment) || 0;
    const monthlyRate = rate / 100 / 12;

    if (principal <= 0) {
      return { months: 0, interest: 0, annualPoints: [0] };
    }

    if (payment <= principal * monthlyRate) {
      return { months: Infinity, interest: Infinity, annualPoints: [principal] };
    }

    let remaining = principal;
    let interestPaid = 0;
    let months = 0;
    const annualPoints = [principal];

    while (remaining > 0.01 && months < 1200) {
      const interest = remaining * monthlyRate;
      const capital = payment - interest;

      if (capital <= 0) {
        return { months: Infinity, interest: Infinity, annualPoints };
      }

      interestPaid += interest;
      remaining -= Math.min(remaining, capital);
      months += 1;

      if (months % 12 === 0 || remaining <= 0.01) {
        annualPoints.push(Math.max(0, remaining));
      }
    }

    return { months, interest: interestPaid, annualPoints };
  }

  function compare(balance, annualRate, monthlyPayment, monthlyOverpayment) {
    const base = amortize(balance, annualRate, monthlyPayment);
    const accelerated = amortize(
      balance,
      annualRate,
      monthlyPayment + monthlyOverpayment
    );

    return {
      base,
      accelerated,
      monthsSaved:
        Number.isFinite(base.months) && Number.isFinite(accelerated.months)
          ? Math.max(0, base.months - accelerated.months)
          : 0,
      interestSaved:
        Number.isFinite(base.interest) && Number.isFinite(accelerated.interest)
          ? Math.max(0, base.interest - accelerated.interest)
          : 0,
    };
  }

  return { amortize, compare };
})();
