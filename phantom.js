
var casper = require('casper').create();
var webpage = require("webpage");


function QiwiClient(login,password){
        this.base_URL = "https://visa.qiwi.com/"
        this.login_URL = "payment/main.action"
        this.invoice_URL = "order/form.action"
        this.invoice_list_URL = "order/list.action?type=2"
        this.pay_URL = "/payment/transfer/form.action"
        this.report_URL = "report/list.action?daterange=true&start=22.06.2013&finish=22.07.2013"

        this.stack = [];
        this.is_run = false;
        this.watchDogTimeout = 4000;

        this.page = webpage.create();
        this.accountBalance = undefined;
        this.page.onResourceReceived = function(response) {
            if (response.url == "https://visa.qiwi.com/person/state.action"){
                var balance = this.page.evalute(function(){

                            // get raw string "    233 597,72 RUB      "
                            var balance = $("#profileBalance .ui-selectmenu-text").text();

                            // parse to array like this ["233597", "72", "RUB"]
                            balance = balance.replace(/[^0-9,A-Z]/g,"").match(/[0-9]+|[A-Z]+/g);

                            return balance;
                        })
                if (this.accountBalance.join("") != balance.join("")){
                    this.onBalanceChange();
                }
            }
        }
        this.page.onLoadFinished = function (status){
            if (status == "success"){
                this.nextStep();
            }
        }

}
QiwiClient.prototype.flushStack = function(){
    this.stack = [];
}


QiwiClient.prototype.push = function(function_,params){
    // TODO: make push sync and async!
        this.stack.push({
            fn:function_,
            params:params
        })
}

QiwiClient.prototype.nextStep = function(){
        if (this.stack.length){
            this.lastStep = this.stack.shift();
            // execute function (with params) from stack
            this.lastResult = this.lastStep.fn(this.lastStep.params);
        }
}

QiwiClient.prototype.submit = function(formData, selector, submitSelector){

    var result = this.page.evaluate(function(formData, selector,submitSelector){
                    var form = $(formData);
                    for (var fieldKey in formData) {
                            var value = formData[fieldKey];
                            $(fieldKey,form).val(value).keyup();
                        }
                    if (!submitSelector){
                        submitSelector = "[value=submit]"
                    }
                    $(submitSelector,form).click();
                },formData, selector, submitSelector)
}


QiwiClient.prototype.doLogin = function(){

    this.push(function(){
        this.page.open(this.base_URL + this.login_URL)
    });

    this.push(
        this.submit,
        {
            "#phone":this.login,
            "#password":this.password
        },
        "#userMenu"
    );

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

QiwiClient.prototype.reportCheck = function(startDate, endDate){


    var d = new Date();
    var formatedFinishDate = d.getDate() + '.' + (d.getMonth() + 1) + "." + d.getFullYear();

    var d = new Date();
    if (!this.isNotFirstRunFlag){
        d.setMonth(d.getMonth() - 2);
        this.isNotFirstRunFlag = true;
    } else {
        d.setDate(d.getDate() - 1);
    }
    var formatedStartDate = d.getDate() + '.' + (d.getMonth() + 1) + "." + d.getFullYear();

    var url = this.base_URL;
    url += "report/list.action?daterange=true";
    url +=  "&start=" + formatedStartDate;
    url +=  "&finish=" + formatedFinishDate;

    this.push(this.page.open, url);




}



QiwiClient.prototype.onBalanceChange = function(startDate, endDate){

}




function Server(host,password){
    this.host = typeof host !== "undefined" ? host: "localhost";
    this.port = typeof port !== "undefined" ? post: 28009;

}

Server.prototype. = function(login,password){

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