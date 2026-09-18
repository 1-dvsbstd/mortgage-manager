# Mortgage Manager — Offline Edition

Mortgage Manager is a private, local-first mortgage planning app for Windows.

It helps you understand your mortgage balance, payoff date, overpayment impact, equity, LTV, fixed-deal end and future payment scenarios without creating an account or uploading your mortgage figures.

## Start the app

1. Extract the Mortgage Manager ZIP to a folder on your PC.
2. Double-click **Start Mortgage Manager.bat**.
3. A small terminal window will open and your browser will launch Mortgage Manager automatically.
4. Keep the terminal window open while you use Mortgage Manager.
5. When finished, close the terminal window or press **Ctrl+C** in it.

No Git, Python, Node.js or other software is required.

## First setup

On first launch, enter the figures from your latest mortgage statement:

- current mortgage balance
- monthly payment
- current interest rate
- fixed-rate end date, if applicable
- estimated property value
- your household's ownership share, if less than 100%

You can change these later from **Setup & data**.

## Where your data is stored

Your mortgage figures are stored by your web browser on this device.

Mortgage Manager does not require an account and does not upload your mortgage figures to a cloud account.

The app has two modes:

- **Offline** — calculations use information already saved on your device.
- **Online** — Mortgage Manager may fetch a small dated market-rate benchmark file. Your mortgage figures remain local and are combined with the benchmark in your browser.

## Backup your data

Open **Setup & data → Backup & restore** and choose **Export backup**.

Keep the downloaded JSON file somewhere safe. You can use **Restore backup** to move your Mortgage Manager data to another browser/device or recover after clearing browser data.

## Updating Mortgage Manager

If you receive a newer version, keep a backup of your current data first. Replace the old app files with the newer version, then launch Mortgage Manager normally. Your browser-stored data should remain available when you continue to use the same localhost address and browser profile.

## Market benchmarks

Online mode uses dated Bank of England quoted household mortgage-rate benchmark data. These are planning references, not personalised mortgage offers or a whole-market mortgage comparison.

Product fees, eligibility, lender criteria and actual available deals may differ substantially.

## Important

Mortgage Manager is an illustrative planning tool, not financial advice. Mortgage and property projections depend on the figures and assumptions you enter and may differ from lender statements, valuations and actual future outcomes.

Always check important financial decisions against your lender, broker or other appropriate professional information.

## Windows security prompt

Windows may warn you before running a downloaded `.bat` or PowerShell script. The launcher only starts a web server bound to **localhost (127.0.0.1)** so the app can run in your browser. It does not expose the server to other computers on your network.

If you do not want to run the included launcher, the files can also be served by any local static web server of your choice.
