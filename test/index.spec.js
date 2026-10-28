const { Entry, EntryType, Group, Vault } = require("buttercup");
const { parse } = require("csv-parse/sync");
const { exportVaultToCSV, exportVaultToCSVTable } = require("../source/index.js");

const UUID_REXP = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

function parseCSV(csv) {
    return parse(csv, { columns: true });
}

function setup() {
    const vault = (this.vault = new Vault());
    const mailGroup = vault.createGroup("Mail");
    mailGroup
        .createEntry("Hotmail")
        .setProperty("username", "test@hotmail.com")
        .setProperty("password", "abc123")
        .setProperty("URL", "https://login.live.com")
        .setProperty("Secret", "value");
    mailGroup
        .createEntry("Yahoo")
        .setProperty("username", "test@yahoo.com")
        .setProperty("password", "123abc")
        .setProperty("Pin", "1234");
    mailGroup
        .createGroup("General")
        .createEntry("Home PC")
        .setProperty("username", "test")
        .setProperty("password", "passw0rd");
}

describe("exportVaultToCSV", function () {
    beforeEach(function () {
        setup.call(this);
    });

    it("contains the correct number of lines", function () {
        // 7 lines expected:
        // - 3 lines for entries
        // - 1 line for heading
        // - 2 lines for groups
        // - 1 line for trailing line-ending
        return expect(exportVaultToCSV(this.vault)).to.eventually.satisfy(
            (csv) => csv.split("\n").length === 7,
        );
    });

    it("contains titles, usernames and passwords of entries", function () {
        return exportVaultToCSV(this.vault).then((output) => {
            const items = parseCSV(output);
            items.forEach((item) => {
                expect(item).to.have.property("title").that.is.a("string");
                expect(item).to.have.property("username").that.is.a("string");
                expect(item).to.have.property("password").that.is.a("string");
            });
        });
    });

    it("contains entry IDs", function () {
        return exportVaultToCSV(this.vault).then((output) => {
            const items = parseCSV(output);
            items.forEach((item) => {
                if (item["!type"] !== "entry") return;
                expect(item).to.have.property("id").that.matches(UUID_REXP);
            });
        });
    });

    it("contains group IDs and titles", function () {
        return exportVaultToCSV(this.vault).then((output) => {
            const items = parseCSV(output);
            items.forEach((item) => {
                expect(item).to.have.property("!group_id").that.matches(UUID_REXP);
                expect(item).to.have.property("!group_name").that.is.a("string");
            });
        });
    });

    it("contains group hierarchy", function () {
        return exportVaultToCSV(this.vault).then((output) => {
            const items = parseCSV(output).map((item) => `${item["!type"]} ${item["!group_name"]}`);
            expect(items).to.contain("group Mail");
            expect(items).to.contain("group General");
        });
    });

    it("contains entry types (#64)", function () {
        const group = this.vault.findGroupsByTitle("Mail")[0];
        const note = group.createEntry("Note");
        note.setAttribute(Entry.Attributes.FacadeType, EntryType.Note);
        note.setProperty("note", "Line 1\nLine 2");
        return exportVaultToCSV(this.vault).then((output) => {
            const items = parseCSV(output);
            const types = items
                .filter((item) => item["!type"] === "entry")
                .reduce((output, item) => ({ ...output, [item.title]: item["!entry_type"] }), {});
            expect(types).to.deep.equal({
                Hotmail: EntryType.Login,
                Yahoo: EntryType.Login,
                "Home PC": EntryType.Login,
                Note: EntryType.Note,
            });
            const noteItem = items.find((item) => item.title === "Note");
            expect(noteItem.note).to.equal("Line 1\nLine 2");
            items
                .filter((item) => item["!type"] === "group")
                .forEach((item) => {
                    expect(item["!entry_type"]).to.equal("");
                });
        });
    });

    it("contains entry attributes as JSON, without the type and attachments", function () {
        const entry = this.vault.findEntriesByProperty("title", "Hotmail")[0];
        entry.setAttribute(Entry.Attributes.FacadeType, EntryType.Website);
        entry.setAttribute(`${Entry.Attributes.FieldTypePrefix}Secret`, "note");
        entry.setAttribute(Entry.Attributes.Tags, "mail,personal");
        entry.setAttribute(`${Entry.Attributes.AttachmentPrefix}abc`, "{}");
        return exportVaultToCSV(this.vault).then((output) => {
            const items = parseCSV(output);
            const item = items.find((item) => item.title === "Hotmail");
            expect(item["!entry_type"]).to.equal(EntryType.Website);
            const attributes = JSON.parse(item["!attributes"]);
            expect(attributes).to.include({
                [`${Entry.Attributes.FieldTypePrefix}Secret`]: "note",
                [Entry.Attributes.Tags]: "mail,personal",
            });
            expect(attributes).to.not.have.property(Entry.Attributes.FacadeType);
            expect(attributes).to.not.have.property(`${Entry.Attributes.AttachmentPrefix}abc`);
            const home = items.find((item) => item.title === "Home PC");
            expect(home).to.have.property("!attributes").that.is.a("string");
        });
    });
    it("exports fields named like Object.prototype members", function () {
        const names = ["toString", "constructor", "valueOf", "hasOwnProperty"];
        const entry = this.vault.findEntriesByProperty("title", "Hotmail")[0];
        names.forEach((name) => entry.setProperty(name, `${name} value`));
        return exportVaultToCSV(this.vault).then((output) => {
            const items = parseCSV(output);
            const hotmail = items.find((item) => item.title === "Hotmail");
            const yahoo = items.find((item) => item.title === "Yahoo");
            const group = items.find((item) => item["!type"] === "group");
            names.forEach((name) => {
                expect(hotmail[name]).to.equal(`${name} value`);
                // Entries and groups without the field get an empty cell
                expect(yahoo[name]).to.equal("");
                expect(group[name]).to.equal("");
            });
        });
    });

    it("prefixes formula-like values with a quote so spreadsheets show them as text (B-678)", function () {
        const values = {
            equals: '=HYPERLINK("https://example.com")',
            plus: "+1+1",
            minus: "-1+1",
            at: "@SUM(1,1)",
            tab: "\t=1+1",
            cr: "\r=1+1",
            quoted: "'=1+1",
            twoQuotes: "''+1",
        };
        const entry = this.vault.findEntriesByProperty("title", "Hotmail")[0];
        Object.keys(values).forEach((key) => entry.setProperty(key, values[key]));
        entry.setProperty("=field", "name starts with =");
        this.vault.findGroupsByTitle("Mail")[0].setTitle("=group");
        return exportVaultToCSV(this.vault).then((output) => {
            const items = parseCSV(output);
            const hotmail = items.find((item) => item.title === "Hotmail");
            Object.keys(values).forEach((key) => {
                expect(hotmail[key]).to.equal(`'${values[key]}`);
            });
            // Field names (the header) and group titles too
            expect(hotmail["'=field"]).to.equal("name starts with =");
            expect(items.map((item) => item["!group_name"])).to.include("'=group");
        });
    });

    it("leaves out the Trash and everything in it (B-679)", function () {
        this.vault.createGroup("Trash").setAttribute(Group.Attribute.Role, "trash");
        const mail = this.vault.findGroupsByTitle("Mail")[0];
        const deleted = mail.createEntry("Deleted").setProperty("password", "deleted-secret");
        const deletedGroup = mail.createGroup("Old");
        deletedGroup.createEntry("In deleted group").setProperty("password", "group-secret");
        deleted.delete();
        deletedGroup.delete();
        const trash = this.vault.getTrashGroup();
        expect(deleted.isInTrash()).to.equal(true);
        expect(trash.getGroups().map((group) => group.getTitle())).to.deep.equal(["Old"]);
        return exportVaultToCSV(this.vault).then((output) => {
            expect(output).to.not.contain("secret");
            const items = parseCSV(output);
            const titles = items.map(
                (item) => `${item["!type"]} ${item["!group_name"] || item.title}`,
            );
            expect(titles).to.have.members([
                "group Mail",
                "group General",
                "entry Hotmail",
                "entry Yahoo",
                "entry Home PC",
            ]);
            const groupIDs = items.map((item) => item["!group_id"]);
            expect(groupIDs).to.not.include(trash.id);
            expect(groupIDs).to.not.include(deletedGroup.id);
        });
    });

    it("writes fields named like a system column under an escaped name (B-680)", function () {
        const names = [
            "id",
            "!type",
            "!group_id",
            "!group_name",
            "!group_parent",
            "!entry_type",
            "!attributes",
            "!other",
            "\\id",
            "\\",
        ];
        const entry = this.vault.findEntriesByProperty("title", "Hotmail")[0];
        names.forEach((name) => entry.setProperty(name, `value of ${name}`));
        entry.setProperty("identity", "not reserved");
        return exportVaultToCSV(this.vault).then((output) => {
            const [header] = parse(output);
            expect(header.filter((name) => name === "!type")).to.have.lengthOf(1);
            expect(header.filter((name) => name === "id")).to.have.lengthOf(1);
            const items = parseCSV(output);
            const hotmail = items.find((item) => item.title === "Hotmail");
            names.forEach((name) => {
                expect(hotmail[`\\${name}`]).to.equal(`value of ${name}`);
            });
            expect(hotmail.identity).to.equal("not reserved");
            // The system columns keep their own values
            expect(hotmail["!type"]).to.equal("entry");
            expect(hotmail.id).to.equal(entry.id);
            expect(hotmail["!group_id"]).to.equal(entry.getGroup().id);
            expect(hotmail["!group_name"]).to.equal("");
            expect(hotmail["!group_parent"]).to.equal("");
            expect(hotmail["!entry_type"]).to.equal(EntryType.Login);
            expect(hotmail["!attributes"]).to.not.contain("value of");
        });
    });

    it("leaves values that can't start a formula unchanged (B-678)", function () {
        const values = ["'text", "a=b", "1-2", "", "' =1", '{"json":1}'];
        const entry = this.vault.findEntriesByProperty("title", "Hotmail")[0];
        values.forEach((value, index) => entry.setProperty(`plain${index}`, value));
        return exportVaultToCSV(this.vault).then((output) => {
            const hotmail = parseCSV(output).find((item) => item.title === "Hotmail");
            values.forEach((value, index) => {
                expect(hotmail[`plain${index}`]).to.equal(value);
            });
            expect(hotmail.password).to.equal("abc123");
        });
    });
});

describe("exportVaultToCSVTable", function () {
    beforeEach(function () {
        setup.call(this);
    });

    it("outputs an array", function () {
        const output = exportVaultToCSVTable(this.vault);
        expect(output).to.be.an("array");
    });

    it("contains the correct number of lines", function () {
        const output = exportVaultToCSVTable(this.vault);
        expect(output).to.have.lengthOf(3 + 2 + 1); // 3 entries, 2 groups, 1 heading
    });

    it("starts with the system headings", function () {
        const [heading] = exportVaultToCSVTable(this.vault);
        expect(heading.slice(0, 6)).to.deep.equal([
            "!type",
            "!group_id",
            "!group_name",
            "!group_parent",
            "!entry_type",
            "!attributes",
        ]);
    });
});
