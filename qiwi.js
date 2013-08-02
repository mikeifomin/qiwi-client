var webpage = require("webpage");
var child_process = require("child_process");
function log(text, obj){
    var date = new Date()
    try{
        console.log(date.getMilliseconds() + " ->  " + text + "  " + JSON.stringify(obj));

    } catch (e){
        console.log(date.getMilliseconds() + " ->  " + text + "  " + obj);
    }
}

function QiwiClient(config){

    this.config = config;

    this.base_URL = "https://visa.qiwi.com/"
    this.login_URL = "payment/main.action"
    this.invoice_URL = "order/form.action"
    this.invoice_list_URL = "order/list.action?type=2"
    this.pay_URL = "/payment/transfer/form.action"
    this.report_URL = "report/list.action?daterange=true&start=22.06.2013&finish=22.07.2013"

    this.stack = [];
    this.is_run = false;
    log("inited with",this.config)
}

QiwiClient.prototype.run = function(){

    this.page = webpage.create();
    this.page.settings.userAgent = 'YBot';
    this.page.open("http://qiwi.ru") ;

    // TODO: what if stack of will full jobs like add invoice? This causes that `reportCheck` on `invoiceCheck` will not done while jobs ended.
    // this watcher for situation while two transaction(for example: incoming 100 and outcoming 100 )
    // in one moment come and cash on account not changed.
    // And for detect invoice change state that not affected cash on account
    this._watchDogInterval = setInterval(
        (function(self){
            log("self ",self);
            self.watchDog.call(self) ;

        })(this),
        this.config.timeoutCheck || 1000*60*10
    )

    this.accountBalance = undefined;

    if (this.config.invoice || this.config.report){
        // TODO: what about `this`?
        this.page.onResourceReceived = this.ResourceWatcherForCheckBalance
    }

    this.page.onLoadFinished = function (status){
        if (status == "success"){
            this.nextStep();
        }
    }
    this.doLogin();
    log("run done");
}
QiwiClient.prototype.ResourceWatcherForCheckBalance = function(response) {
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


QiwiClient.prototype.watchDog = function(){
    this.onBalanceChange();
}

QiwiClient.prototype.onBalanceChange = function(){
    if (this.config.invoice){
        this.invoiceCheck();
    }
    if (this.config.report){
        this.reportCheck();
    }
}

QiwiClient.prototype.flushStack = function(){
    this.stack = [];
}



QiwiClient.prototype.push = function(function_){
    log("just pushed",function_) ;
    var params = [];
    for (var i=1;i<arguments.length;i++){
        params.push(arguments[i]);
    }

    this.stack.push({
        fn:function_,
        params:params,
        sync:false
    })
}
QiwiClient.prototype.push_sync = function(function_){
    log("just pushed sync",function_);
    var params = [];
    for (var i=1;i<arguments.length;i++){
        params.push(arguments[i]);
    }
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
        this.lastResult = this.lastStep.fn.apply(this,this.lastStep.params);
        if (this.lastStep.sync){
            this.nextStep();
        }
    }
}

QiwiClient.prototype.open = function(url){
       this.page.open(url,function(status){
           log(status);
       });
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
            "#phone":this.config.login,
            "#password":this.config.password
        },
        "#userMenu"
    );


}

QiwiClient.prototype.makePay = function(account,amount,comment,cb){

}

QiwiClient.prototype.makeInvoice = function(account,amount,comment,cb){

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

    this.push(this.open, url);

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
            this.cachedTransaction = updatedTransactionInfo[1];

        }
    })
}



QiwiClient.prototype.invoiceCheck = function(){
    var url = this.base_URL;
    url += "order/list.action?type=2";

    this.push(this.open, url);

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
        if (updatedTransactionInfo[0]){

            //  TODO:update or assign
            this.cachedInvoiceTransaction.update(updatedTransactionInfo[1]);
            //this.cachedInvoiceTransaction = updatedTransactionInfo[1];

            if (this.config.invoice){
                this.sendToExternal(this.config.invoice,updatedTransactionInfo[1] )

            }
        }
    })
}

QiwiClient.prototype.sendToExternal = function(address, data){

    // page for sending event to other script using http POST
    this.messagePage = this.messagePage || webpage.create();
    // handler for exec external script
    this.exec = this.exec || child_process.execFile;
    var payload = "payload=" + encodeURI(JSON.stringify(data)) ;
    if (address.search("http://") == -1){
        var parsed = address.split(/\W+/);
        this.exec(parsed[0],parsed.splice(1).append(payload),null,function(err, stdout, stderr){
            if (stdout.search("ok")){

            } else {
                log("error ")
            }

        })

    } else{

        this.messagePage.open(address,"post",payload,(function(status){
            if (status == "success" ){
                if (this.content.search("ok")){
                    log("message send, ok resive")
                }

            } else {
                log("status is not success on ")
            }
        }).call(this.messagePage))
    }
}

function Server(host,post){
    this.host = typeof host !== "undefined" ? host: "localhost";
    this.port = typeof port !== "undefined" ? post: 28009;

}

Server.prototype.command = function(login,password){
    this.login = login;
    this.password = password;
}
Server.prototype.command_screenshot = function (){

}

module.exports = QiwiClient;