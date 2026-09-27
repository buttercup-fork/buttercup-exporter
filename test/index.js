const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
const { init } = require("buttercup");

init();

chai.use(chaiAsPromised);

Object.assign(global, {
    expect: chai.expect,
});
