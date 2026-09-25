window.MortgageMath = (() => {
  function amortize(balance, annualRate, monthlyPayment) {
    const principal = Math.max(0, Number(balance) || 0);
    const rate = Math.max(0, Number(annualRate) || 0);
    const payment = Math.max(0, Number(monthlyPayment) || 0);
    const monthlyRate = rate / 100 / 12;

    if (principal <= 0) {
      return {
        months: 0,
        interest: 0,
        totalPaid: 0,
        monthlyPoints: [0],
        annualPoints: [0],
      };
    }

    if (payment <= principal * monthlyRate) {
      return {
        months: Infinity,
        interest: Infinity,
        totalPaid: Infinity,
        monthlyPoints: [principal],
        annualPoints: [principal],
      };
    }

    let remaining = principal;
    let interestPaid = 0;
    let totalPaid = 0;
    let months = 0;
    const monthlyPoints = [principal];
    const annualPoints = [principal];

    while (remaining > 0.01 && months < 1200) {
      const interest = remaining * monthlyRate;
      const capital = payment - interest;

      if (capital <= 0) {
        return {
          months: Infinity,
          interest: Infinity,
          totalPaid: Infinity,
          monthlyPoints,
          annualPoints,
        };
      }

      const capitalPaid = Math.min(remaining, capital);
      const actualPayment = interest + capitalPaid;

      interestPaid += interest;
      totalPaid += actualPayment;
      remaining -= capitalPaid;
      months += 1;
      monthlyPoints.push(Math.max(0, remaining));

      if (months % 12 === 0 || remaining <= 0.01) {
        annualPoints.push(Math.max(0, remaining));
      }
    }

    return { months, interest: interestPaid, totalPaid, monthlyPoints, annualPoints };
  }

  function storedRegularOverpayment() {
    try {
      return Math.max(0, Number(window.MortgageStore?.get?.().currentOverpayment) || 0);
    } catch (_) {
      return 0;
    }
  }

  function compare(balance, annualRate, scheduledPayment, hypotheticalExtra, regularOverpayment) {
    const regular = regularOverpayment === undefined
      ? storedRegularOverpayment()
      : Math.max(0, Number(regularOverpayment) || 0);
    const extra = Math.max(0, Number(hypotheticalExtra) || 0);
    const basePayment = Math.max(0, Number(scheduledPayment) || 0) + regular;

    const base = amortize(balance, annualRate, basePayment);
    const accelerated = amortize(balance, annualRate, basePayment + extra);

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
