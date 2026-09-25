# Mortgage Manager — Market benchmark data

Offline V1 uses a small, manually maintained benchmark snapshot rather than a whole-market mortgage product feed.

## Source

Source: **Bank of England Database — quoted household interest rates**.

The Bank of England states that reproduction of data in its Database is subject to the **UK Open Government Licence**, which allows free and flexible reuse.

Current series used by Mortgage Manager:

| Planning band | 2-year fixed | 5-year fixed |
| --- | --- | --- |
| 75% LTV | IUMBV34 | IUMBV42 |
| 95% LTV | IUM2WTL | IUM5WTL |

The app uses the 75% benchmark for LTV at or below 75%. Above 75%, the 95% benchmark is used as a deliberately conservative planning proxy. This avoids inventing five-year figures for intermediate LTV bands where a directly comparable Bank of England series is not included in the feed.

These rates are market reference data only. They are not product recommendations, personalised offers, eligibility checks or a whole-market comparison.

## Update cadence

Update `public/market-rates.json` **monthly**, after the Bank of England has published the latest monthly quoted-rate observation. Aim to refresh the app snapshot by the **10th calendar day of each month** when new data are available.

When updating:

1. Confirm the latest observation date for all four series.
2. Update the two 75% and two 95% values.
3. Set `sourceAsOf` to the observation date.
4. Set `publishedForApp` to the date the app snapshot was updated.
5. Do not mix observation months in one published snapshot unless this is explicitly noted.
6. Run `npm test` before publishing.

## Attribution

Display attribution as **Bank of England** with the observation date. Do not use Bank of England branding or imply endorsement.

## Product boundary

Mortgage Manager combines the benchmark locally with the user's own mortgage figures. User mortgage data is not sent to the Bank of England or included in the market-data request.
