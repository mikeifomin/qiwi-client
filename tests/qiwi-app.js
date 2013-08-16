var Qiwi = require("../qiwi");
var log = require("../log");

var config = require("./cnf");
var qiwi = new Qiwi(config);
//console.log(qiwi.super.init());
qiwi.run();
