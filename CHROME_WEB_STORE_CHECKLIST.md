# Chrome Web Store Submission Checklist

## Permissions

- `storage`: stores encrypted profiles, site overrides, and local extension settings.
- `activeTab`: allows user-initiated interaction with the active application page.
- `scripting`: injects the content script only after the user clicks Scan page.
- `sidePanel`: hosts the review-before-fill workflow.
- Optional host permissions are limited to supported ATS domains: Workday, SmartRecruiters, Greenhouse, and Personio.
- LinkedIn is not listed in host permissions and is copy-assist only.

## Permission Justification

- The extension needs `storage` because profile data, encryption setup state, first-run consent, and saved site mappings are local-only.
- The extension needs `activeTab` and `scripting` because page scanning and filling happen only after explicit user action on the active tab.
- The extension needs `sidePanel` because the product workflow is review-before-fill in a persistent panel.
- Optional host permissions are requested only for supported ATS domains and only when the user clicks Scan page.

## Compliance Statements

- No backend, account system, sync, telemetry, analytics, or remote error reporting.
- No remote scripts or remotely hosted executable code.
- No job-board scraping, LinkedIn scraping, or LinkedIn automation.
- No mass auto-apply behavior and no automatic form submission.
- No login automation, account creation, CAPTCHA bypass, or assessment automation.
- Sensitive, uncertain, custom, upload, and unsupported fields require review or manual action.

## Release Readiness

- Run `pnpm test`.
- Run `.\node_modules\.bin\tsc.CMD -p tsconfig.json --noEmit`.
- Run `pnpm --filter @job-helper/extension build`.
- Run `pnpm package:extension`.
- Confirm the upload package exists at `release/job-application-autofill-0.1.0.zip`.
- Confirm the package zip contains built extension assets only and no `*.map` files.
- Confirm first-run disclosure appears on a clean install.
- Confirm passphrase setup, profile import, lock, unlock, and export work with `profiles/nestors-kuliks-profile.json`.
- Confirm local generic, Greenhouse, SmartRecruiters, Personio, and Workday fixtures can be scanned and reviewed.
- Confirm supported ATS permissions are requested only after clicking Scan page.
- Confirm LinkedIn shows copy-assist behavior without script injection.
- Confirm Delete data clears profile data, overrides, encryption settings, and first-run consent.

## Upload Steps

- Upload `release/job-application-autofill-0.1.0.zip` in the Chrome Web Store developer dashboard.
- Use `PRIVACY.md` as the source for the privacy policy text.
- In permission explanations, use the permission justification above and emphasize local-only, user-triggered behavior.
