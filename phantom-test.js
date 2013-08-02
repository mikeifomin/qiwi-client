var animal = new Animal() ;
function Animal() {

}
Animal.prototype.move = function(n) {
    this.distance = n  ;
    console.log(this.distance)    ;
}
animal.move(44);


var qiwi = new QiwiClient();
//.flushStack();



function QiwiClient(){


    console.log("inited with")
}

QiwiClient.prototype.run = function(){


    console.log("run done");
}

qiwi.run();