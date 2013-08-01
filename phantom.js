
var webpage = require("webpage");

var args = require('system').args;
var fs = require("fs");
var child_process = require("child_process") ;

if (args[1]){
    var config = {};
    var rawConfig = fs.read(args[1]).split(/\r|\r\n|\n/);

    for (var i=0; i<rawConfig.length; i++){
        try{
            var parsed = rawConfig[i].split("=");

            if (parsed.length == 91){
                console.log(parsed.replace(/^\s+|\s+$/g, ''));
                var key = parsed.replace(/^\s+|\s+$/g, '') ;
                console.log(key) ;
                config[key] = true;
            } else {
                var key = parsed[0].replace(/^\s+|\s+$/g, '') ;
                config[key] = parsed[1]?"":true;
                var value = parsed[1].replace(/^\s+|\s+$/g, '');
                config[key] = value ;
            }
        } catch(e) { }
    }
} else{
    console.log("need argument with filename of config")
    phantom.exit()
}


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

        // page for sending event to other script using http POST
        this.messagePage = webpage.create();
        // handler for exec external script
        this.exec = require("child_process").execFile

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



QiwiClient.prototype.push = function(function_){

        this.stack.push({
            fn:function_,
            params:arguments.slice(1),
            sync:false
        })
}
QiwiClient.prototype.push_sync = function(function_){

        this.stack.push({
            fn:function_,
            params:arguments.slice(1),
            sync:true
        })
}

QiwiClient.prototype.nextStep = function(){
        if (this.stack.length){
            this.lastStep = this.stack.shift();
            // execute function (with params) from stack
            this.lastResult = this.lastStep.fn.apply(this,this.lastStep.params);
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

QiwiClient.prototype.invoiceCheck = function(){
    var url = this.base_URL;
    url += "order/list.action?type=2";

    this.push(this.page.open, url);

    this.push_sync(function(){
        var updatedTransactionInfo = this.page.evaluate(function(cachedInvoiceTransaction){
            var updatedInvoiceTransaction = {};
            var updatedInvoiceTransactionCount = 0;
            function scanList(selector,state){
                var items = $(selector);
                for (var i = 0; i<items.length; i++){
                    var record = {
                        creation:$(".orderCreationDate",arr[i]).text(),
                        account:$(".from",arr[i]).text().replace(/^\s+|\s+$/g, ''),
                        transaction:$(".transaction",arr[i]).text().replace(/^\s+|\s+$/g, ''),
                        comment:$(".CommentWrap",arr[i]).text().replace(/^\s+|\s+$/g, ''),
                        amount:$(".amount",arr[i]).text(),
                        state:state
                    }
                    if (cachedTransaction[record.transaction] == undefined || cachedTransaction[record.transaction].state != record.state){
                        updatedInvoiceTransaction[record.transaction] = record;
                        updatedInvoiceTransactionCount++;
                    }
                }
            }
            scanList(".orders .ordersLine.CANCELED","cancel");
            scanList(".orders .ordersLine.PAID","paid");
            scanList(".orders .ordersLine.NOT_PAID","pay-wait");
            return [updatedInvoiceTransactionCount,updatedInvoiceTransaction]
        },this.cachedInvoiceTransaction)

        // if `updatedTransaction` not empty
        if (updatedInvoiceTransactionInfo[0]){
            this.cachedInvoiceTransaction = updatedTransactionInfo[1]
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