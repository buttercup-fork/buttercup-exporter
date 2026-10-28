# Buttercup Exporter Changelog

## Unreleased (codekunde fork)

 * **Tooling**: installs from `github:buttercup-fork/buttercup-exporter`; CI runs on branch pushes only (plus manual runs); `husky`, `lint-staged` and `npm-run-all` are replaced or dropped (`npm-run-all2`; `npm run format` formats), dev dependencies updated (`chai` 6, `chai-as-promised` 8, `mocha` 12.0.3), `npm audit` clean

 * **Feature**:
   * [importer#64](https://github.com/buttercup/buttercup-importer/issues/64) / [importer#60](https://github.com/buttercup/buttercup-importer/issues/60) CSV exports keep each entry's type (new `!entry_type` column) and its attributes (new `!attributes` column, as JSON: field value types such as multi-line notes and OTP, field order, tags, password-change time). Re-importing used to turn every entry into a login and show a website's URL as a custom field. Attachment references are left out, since the CSV doesn't carry attachments. The format is documented in the README
 * Entries are read straight from the `Entry` API (`getProperty`, `getAttribute`, `getType`) instead of through `createEntryFacade`, so the exporter no longer loads `buttercup` itself, which is ESM-only since core 7. The `buttercup` peer dependency is now `>= 6.0.0`
 * **Security**:
   * Cells a spreadsheet would run as a formula (starting with `=`, `+`, `-`, `@`, a tab or a carriage return, after any number of `'`) are written with one extra `'` in front, so Excel, LibreOffice and Google Sheets show them as text. Before, text that came into an entry from a web page (the browser extension's save prompt takes the title from the page) could become a live formula when the export was opened in a spreadsheet, next to every password in the file. The importer removes the `'` again, so values come back unchanged. `exportVaultToCSVTable` still returns the raw values (B-678)
 * **Bugfix**:
   * Exporting failed for the whole vault ("Invalid Casting Value: returned value must return a string ... got undefined") when any entry had a field named like an `Object.prototype` member (`toString`, `constructor`, `valueOf`, ...): every row without that field read the inherited function. Rows now only use their own fields. The specs use core `b550ed7`, which accepts these field names
   * The export left the Trash in: deleted entries were written with their passwords, and after a re-import they came back as live entries in an ordinary group named "Trash". The Trash and everything in it are now left out (B-679)
 * `csv-stringify` 5 → 6 (its sync API replaces `pify`, which is dropped)
 * Requires NodeJS 22 or later. Tests run on 22 and 24 in GitHub/Forgejo Actions (Travis removed), against the core fork; coverage uses `c8` (still 100%) instead of `nyc`; `prettier` 1 → 3, `mocha` 12, `csv-parse` replaces `csvjson` in the specs, and `sinon` (unused) is dropped. `npm audit`: 0 vulnerabilities

## v1.1.0
_2020-07-11_

 * **Bugfix**:
   * Importing exporter would fail due to `init` version in core

## v1.0.0
_2020-05-19_

 * New export format
 * Group hierarchy

## v0.1.0
_2018-07-28_

 * Initial release
