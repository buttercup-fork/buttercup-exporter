# Buttercup Exporter
> Export Buttercup vaults

**CodeKunde fork** of [buttercup/buttercup-exporter](https://github.com/buttercup/buttercup-exporter), from 1.1.0. It isn't on npm; the apps install it from git. See the [changelog](CHANGELOG.md).

[![Buttercup](images/buttercup-slim.svg)](https://buttercup.codekunde.net) [![Tests](https://github.com/buttercup-fork/buttercup-exporter/actions/workflows/test.yml/badge.svg)](https://github.com/buttercup-fork/buttercup-exporter/actions/workflows/test.yml)

## About
This library provides methods to allow you to export [Buttercup](https://buttercup.codekunde.net) vaults to CSV.

Install from GitHub:

```shell
npm install github:buttercup-fork/buttercup-exporter --save
```

Requires NodeJS 22 or later.

## Usage
Require the exporter method and pass a vault instance to it:

```javascript
const fs = require("fs");
const { Vault, init } = require("buttercup");
const { exportVaultToCSV } = require("@buttercup/exporter");

init();

const vault = new Vault();
vault.createGroup("General")
    .createEntry("email")
        .setProperty("username", "test@mail.com")
        .setProperty("password", "passw0rd");

exportVaultToCSV(vault).then(csv => {
    fs.writeFileSync("./test.csv", csv);
});
```

`exportVaultToCSV` takes the vault instance as the only parameter and returns a `Promise`.

## CSV format

The first row is the header. Each following row is a group or an entry, set by the `!type` column (`group` or `entry`). The Trash and everything in it are not exported:

| Column | Groups | Entries |
|--------|--------|---------|
| `!group_id` | The group's ID | The ID of the group the entry is in |
| `!group_name` | The group's title | Empty |
| `!group_parent` | The parent group's ID, or `0` for a root group | Empty |
| `!entry_type` | Empty | The entry type: `login`, `website`, `credit_card`, `note` or `ssh_key` |
| `!attributes` | Empty | The entry's attributes as JSON (field value types, field order, tags, password-change time etc.), or empty. The entry type is in `!entry_type`, and attachment references are left out since the CSV doesn't carry attachments |
| `id` | Empty | The entry's ID |

Every other column is an entry property (`title`, `username`, `password`, `url`, custom fields...). Each entry only fills the properties it has, so the rest of its row is empty.

A cell that a spreadsheet would run as a formula (one starting with `=`, `+`, `-`, `@`, a tab or a carriage return, after any number of `'`) is written with one extra `'` in front, so it is shown as text. This applies to every cell, including the header and group titles. A reader removes exactly one leading `'` from such a cell to get the original value. `exportVaultToCSVTable` returns the values without this escaping.

[@buttercup/importer](https://github.com/buttercup-fork/buttercup-importer)'s Buttercup CSV importer reads this format back. `!entry_type` and `!attributes` were added in this fork; CSVs without them still import, as login entries.
