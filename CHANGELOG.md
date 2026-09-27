# Buttercup Exporter Changelog

## Unreleased (codekunde fork)

 * **Feature**:
   * [importer#64](https://github.com/buttercup/buttercup-importer/issues/64) / [importer#60](https://github.com/buttercup/buttercup-importer/issues/60) CSV exports keep each entry's type (new `!entry_type` column) and its attributes (new `!attributes` column, as JSON: field value types such as multi-line notes and OTP, field order, tags, password-change time). Re-importing used to turn every entry into a login and show a website's URL as a custom field. Attachment references are left out, since the CSV doesn't carry attachments. The format is documented in the README
 * Entries are read straight from the `Entry` API (`getProperty`, `getAttribute`, `getType`) instead of through `createEntryFacade`, so the exporter no longer loads `buttercup` itself, which is ESM-only since core 7. The `buttercup` peer dependency is now `>= 6.0.0`
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
