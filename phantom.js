
var casper = require('casper').create();

function QiwiClient(){
        this.base_URL = "https://https://visa.qiwi.com/"
        this.login_URL = "payment/main.action"
        this.invoice_URL = "order/form.action"
        this.invoice_list_URL = "order/list.action?type=2"
        this.pay_URL = "/payment/transfer/form.action"
        this.report_URL = "report/list.action?daterange=true&start=22.06.2013&finish=22.07.2013"


}

QiwiClient.prototype.doLogin = function(login,password){
    this.login = login ;
    this.password = password  ;


}

QiwiClient.prototype.makePay = function(account,amount,comment,cb){

}

QiwiClient.prototype.makeInvoice = function(account,amount,comment,cb){

}

QiwiClient.prototype.getInvoiceList = function(startDate, endDate){

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