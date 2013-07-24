/**
 * Created with JetBrains WebStorm.
 * User: mike
 * Date: 24.07.13
 * Time: 17:08
 * To change this template use File | Settings | File Templates.
 */
var fs = require("fs");

var cnf = fs.read("./ra.cnf");
console.log(cnf)