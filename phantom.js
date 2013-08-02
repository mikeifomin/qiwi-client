var args = require('system').args;
var Qiwi = require("./qiwi");

main();
function main(){
    if (args[1]){
        var config = require("./"+args[1]);

    } else{
        var config = require("./cnf")
    }

    var qiwi = new Qiwi(config);
    qiwi.run();
}
