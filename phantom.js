
var casper = require('casper').create();
var webpage = require("webpage");


function QiwiClient(login,password){
        this.base_URL = "https://https://visa.qiwi.com/"
        this.login_URL = "payment/main.action"
        this.invoice_URL = "order/form.action"
        this.invoice_list_URL = "order/list.action?type=2"
        this.pay_URL = "/payment/transfer/form.action"
        this.report_URL = "report/list.action?daterange=true&start=22.06.2013&finish=22.07.2013"

        this.stack = [];
        this.is_run = false;
}
QiwiClient.prototype.flushStack = function(){
    this.stack = [];
}
QiwiClient.prototype.push = function(function_,params){

        this.stack.push({
            fn:function_,
            params:params
        })
}

QiwiClient.prototype.submit = function(query, selector){


}


QiwiClient.prototype.doLogin = function(login,password){

    this.login = login;
    this.password = password;



}

QiwiClient.prototype.makePay = function(account,amount,comment,cb){

}

QiwiClient.prototype.makeInvoice = function(account,amount,comment,cb){

}

QiwiClient.prototype.getInvoiceList = function(startDate, endDate){

}

QiwiClient.prototype.checkInvoiceList = function(startDate, endDate){

}

function Server(host,password){
    this.base_URL = "https://https://visa.qiwi.com/"
    this.login_URL = "payment/main.action"
    this.invoice_URL = "order/form.action"
    this.invoice_list_URL = "order/list.action?type=2"
    this.pay_URL = "/payment/transfer/form.action"
    this.report_URL = "report/list.action?daterange=true&start=22.06.2013&finish=22.07.2013"

    this.stack = [];
    this.is_run = false;
}

Server.prototype.doLogin = function(login,password){

    this.login = login;
    this.password = password;



}


//var casper = require('casper').create();

casper.start('http://casperjs.org/', function() {
    this.echo(this.getTitle());
});

casper.thenOpen('http://phantomjs.org', function() {
    this.echo(this.getTitle());
});
console.log(phantom)   ;
casper.run();