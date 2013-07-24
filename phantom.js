
var casper = require('casper').create();
var webpage = require("webpage");

function Page


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
            params:params,
            sync:false
        })
}
QiwiClient.prototype.push_sync = function(function_,params){
    // TODO: make push sync and async!
        this.stack.push({
            fn:function_,
            params:params,
            sync:true
        })
}

QiwiClient.prototype.nextStep = function(){
        if (this.stack.length){
            this.lastStep = this.stack.shift();
            // execute function (with params) from stack
            this.lastResult = this.lastStep.fn(this.lastStep.params);
            if (this.lastStep.sync){
                this.nextStep();
            }
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

QiwiClient.prototype._startFinishDateFormat = function(){
    var result;
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


    result +=  "&start=" + formatedStartDate;
    result +=  "&finish=" + formatedFinishDate;

    return result;

}


QiwiClient.prototype.reportCheck = function(startDate, endDate){
    var url = this.base_URL;
    url += "report/list.action?daterange=true";
    url +=  this._startFinishDateFormat();

    this.push(this.page.open, url);

    this.push_sync(function(){
        var updatedTransactionInfo = this.page.evaluate(function(cachedTransaction){
            var updatedTransaction = {};
            var updatedTransactionCount = 0;
            function scanList(selector,state){
                var items = $(selector);
                for (var i = 0; i<items.length; i++){
                    var record = {
                        transaction:$(".transaction",item[i]).text(),
                        date: $(".date",item[i]).text(),
                        time: $(".time",item[i]).text(),
                        income: $(".income .cash",item[i]).text(),
                        outcome: $(".expenditure .cash",item[i]).text(),
                        comment: $(".comment",item[i]).text(),
                        commentFull: $(".ProvWithComment",item[i]).text(),
                        state:state
                    }
                    if (cachedTransaction[record.transaction] == undefined || cachedTransaction[record.transaction].state != record.state){
                        updatedTransaction[record.transaction] = record;
                        updatedTransactionCount++;
                    }
                }
            }
            scanList(".orders .ordersLine.ERROR","err");
            scanList(".orders .ordersLine.SUCCESS","ok");
            return [updatedTransactionCount,updatedTransaction]
        },this.cachedTransaction)

        // if `updatedTransaction` not empty
        if (updatedTransactionInfo[0]){
            this.cachedTransaction = updatedTransactionInfo[1]
        }
    })
}


function Server(host,password){
    this.host = typeof host !== "undefined" ? host: "localhost";
    this.port = typeof port !== "undefined" ? post: 28009;

}

Server.prototype.command = function(login,password){

    this.login = login;
    this.password = password;



}