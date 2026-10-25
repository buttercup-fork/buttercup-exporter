const { stringify } = require("csv-stringify/sync");

const SYSTEM_HEADINGS = ["!group_id", "!group_name", "!group_parent", "!entry_type", "!attributes"];

// Kept in the `!entry_type` column instead of `!attributes`
const ATTRIBUTE_FACADE_TYPE = "BC_ENTRY_FACADE_TYPE";
// Attachment references point at attachment data a CSV doesn't carry
const ATTRIBUTE_ATTACHMENT_PREFIX = "BC_ENTRY_ATTACHMENT:";
// A cell a spreadsheet would run as a formula: one starting with = + - @, a
// tab or a carriage return, after any number of quotes (B-678)
const FORMULA_CELL = /^'*[=+\-@\t\r]/;

/**
 * Export a vault to Buttercup CSV
 * Every cell a spreadsheet would read as a formula gets one extra `'` in
 * front, so it is shown as text. The importer removes exactly one again, so
 * values come back unchanged (a value that already starts with `'` and then a
 * formula character gets one more, for the same reason)
 * @param {Vault} vault The vault to export
 * @returns {Promise.<String>} The CSV text
 */
function exportVaultToCSV(vault) {
    return Promise.resolve().then(() =>
        stringify(exportVaultToCSVTable(vault).map((row) => row.map(escapeFormulaCell))),
    );
}

/**
 * Prefix a cell that a spreadsheet would read as a formula with `'`
 * @param {String} cell The cell value
 * @returns {String} The value to write
 * @private
 */
function escapeFormulaCell(cell) {
    return FORMULA_CELL.test(cell) ? `'${cell}` : cell;
}

/**
 * Export a vault to a table of rows (the CSV before stringifying). The cells
 * are the raw values: the formula escaping of `exportVaultToCSV` is not
 * applied, so a caller that writes its own CSV from this table must do it
 * @param {Vault} vault The vault to export
 * @returns {Array.<Array.<String>>} Header row, then a row per group and entry
 */
function exportVaultToCSVTable(vault) {
    const groups = [];
    const entries = [];
    const usedKeys = [];
    const csvTable = [];
    // Extract object representations of all groups and entries
    const rootGroups = vault.getGroups();
    rootGroups.forEach((group) => {
        entries.push(...extractGroupEntries(group));
    });
    rootGroups.forEach((group) => {
        groups.push(...extractGroups(group));
    });
    // Record every used key
    entries.forEach((entry) => {
        Object.keys(entry).forEach((entryKey) => {
            if (usedKeys.indexOf(entryKey) === -1) {
                usedKeys.push(entryKey);
            }
        });
    });
    // Create table header
    const tableHeadings = [
        ...SYSTEM_HEADINGS,
        ...usedKeys.filter((prop) => SYSTEM_HEADINGS.includes(prop) === false),
    ];
    csvTable.push(["!type", ...tableHeadings]);
    // Add all groups
    groups.forEach((group) => {
        csvTable.push(["group", ...tableHeadings.map((headingKey) => getCell(group, headingKey))]);
    });
    // Add all entries
    entries.forEach((entry) => {
        csvTable.push(["entry", ...tableHeadings.map((headingKey) => getCell(entry, headingKey))]);
    });
    return csvTable;
}

/**
 * A row's value for a column, or an empty string. Only the row's own
 * properties count: a field named like an Object.prototype member
 * (`toString`, `constructor`...) would otherwise give every row without that
 * field the inherited function
 * @param {Object} row A group or entry row
 * @param {String} key The column
 * @returns {String} The cell value
 * @private
 */
function getCell(row, key) {
    return (Object.hasOwn(row, key) && row[key]) || "";
}

function extractGroups(group) {
    const parent = group.getParentGroup();
    return [
        {
            "!group_id": group.id,
            "!group_name": group.getTitle(),
            "!group_parent": (parent && parent.id) || "0",
        },
        ...group
            .getGroups()
            .map((sub) => extractGroups(sub))
            .reduce((output, result) => [...output, ...result], []),
    ];
}

function extractGroupEntries(group) {
    const items = group.getEntries().map((entry) =>
        Object.assign({}, entry.getProperty(), {
            "!group_id": group.id,
            "!group_name": "",
            "!group_parent": "",
            "!entry_type": entry.getType(),
            "!attributes": serialiseAttributes(entry.getAttribute()),
            id: entry.id,
        }),
    );
    group.getGroups().forEach((subGroup) => {
        items.push(...extractGroupEntries(subGroup));
    });
    return items;
}

/**
 * Serialise an entry's attributes (field types, field order, tags etc.) as
 * JSON, without the entry type and attachment references
 * @param {Object} attributes The entry's attributes
 * @returns {String} JSON, or an empty string when nothing is left
 * @private
 */
function serialiseAttributes(attributes) {
    const output = {};
    Object.keys(attributes)
        .filter(
            (name) =>
                name !== ATTRIBUTE_FACADE_TYPE && !name.startsWith(ATTRIBUTE_ATTACHMENT_PREFIX),
        )
        .forEach((name) => {
            output[name] = attributes[name];
        });
    return Object.keys(output).length > 0 ? JSON.stringify(output) : "";
}

module.exports = {
    exportVaultToCSV,
    exportVaultToCSVTable,
};
