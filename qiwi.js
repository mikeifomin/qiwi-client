var webpage = require("webpage");
var child_process = require("child_process");
var Server = require("./server");
var log = require('./log');

function inherit(Child, Parent) {
    var F = function () {
    };
    F.prototype = Parent.prototype;
    var f = new F();
    for (var prop in Child.prototype) f[prop] = Child.prototype[prop];
    Child.prototype = f;
    Child.prototype.super = Parent.prototype;
}

function QiwiClient(config) {

    this.config = config;

    this.base_URL = "https://visa.qiwi.com/"
    this.login_URL = "payment/main.action"
    this.invoice_URL = "order/form.action"
    this.invoice_list_URL = "order/list.action?type=2"
    this.pay_URL = "/payment/transfer/form.action"
    this.report_URL = "report/list.action?daterange=true&start=22.06.2013&finish=22.07.2013"

    this.stack = [];
    this.is_run = false;
    log.debug("Qiwi constructor with config ", this.config)
}

QiwiClient.prototype.run = function () {
    log.notice("Start QIWI watcher");
    this.page = webpage.create();
    this.page.settings.userAgent = 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/28.0.1500.95 Safari/537.36';

//    log.debug("Inherit super methods from server parent");
    this.super.constructor.apply(this);
    this.super.runServer.apply(this);

    // TODO: what if stack of will full jobs like add invoice? This causes that `reportCheck` on `invoiceCheck` will not done while jobs ended.
    // this watcher for situation while two transaction(for example: incoming 100 and outcoming 100 )
    // in one moment come and cash on account not changed.
    // And for detect invoice change state that not affected cash on account
    this._watchDogInterval = setInterval(
        (function (self) {
//            log.debug("self ",self);
            //self.watchDog.call(self) ;

        })(this),
        this.config.timeoutCheck || 1000 * 60 * 10
    )
    this._stackWatcherInterval = 100;
    this.accountBalance = undefined;

    // watch for change balance if in settings set invoice or report watcher
    if (this.config.invoice || this.config.report) {
        // TODO: what about `this`?  use javascript closure!
        this.page.onResourceReceived = this.ResourceWatcherForCheckBalance
    }

    this.page.onLoadFinished1 = (function (self) {
        return function (status) {

            if (status == "success") {
                log.debug('Event onLoadFinished success, go `nextStep()`');
                self.nextStep();
            } else {
                log.warning("Event onLoadFinished NOT success ", status)
            }
        }
    })(this);
    this.page.onConsoleMessage = function(msg, lineNum, sourceId) {
        log.debug('CONSOLE: ' + msg + ' (from line #' + lineNum + ' in "' + sourceId + '")');
    };
    this.pageLoaded = false;

    this.page.onLoadFinished = (function(self){
        return function(status) {
            self.pageLoaded = true;
            log.notice("pageLoaded = ",self.pageLoaded)
        }
    })(this);
    this.page.onLoadStarted = (function(self){
        return function(status) {
            self.pageLoaded = false;
            log.notice("pageLoaded = ",self.pageLoaded)
        }
    })(this) ;



    log.debug("First of all add to stack login job");
    this.doLogin();

    log.notice("Start execute stack jobs using `nextStep()`");
    this.nextStep();
}

QiwiClient.prototype.ResourceWatcherForCheckBalance = function (response) {
    if (response.url == "https://visa.qiwi.com/person/state.action") {
        log.debug("Page request accout state");
        var balance = this.page.getRawBalance.call(this);

        if (this.accountBalance.join("") != balance.join("")) {
            log.notice("Account balance is changed", balance)
            this.onBalanceChange();
        }
    }
}

QiwiClient.prototype.getRawBalance = function(){
    var balance = this.page.evalute(function () {

        // get raw string "    233 597,72 RUB      "
        var balance = $("#profileBalance .ui-selectmenu-text").text();

        // parse to array like this ["233597", "72", "RUB"]
        balance = balance.replace(/[^0-9,A-Z]/g, "").match(/[0-9]+|[A-Z]+/g);

        return balance;
    })
    log.notice("Current balance is ",balance);
    return balance;
}

QiwiClient.prototype.watchDog = function () {
    this.onBalanceChange();
}

QiwiClient.prototype.onBalanceChange = function () {
    if (this.config.invoice) {
        this.invoiceCheck();
    }
    if (this.config.report) {
        this.reportCheck();
    }
}

QiwiClient.prototype.flushStack = function () {
    this.stack = [];
}


QiwiClient.prototype.add = function (fn, done_signature, err_signature, err_fn) {
    /* done may be
      function that return true if go next job
      string - css path like #enyID.any-class
      string - pain text pattern seek contain="text to seek"


      fn maybe
      function
      object with params and function like {fn:function(key1,key3){console.log("hi")},param:[key1,key2]}
    */

    var func = null;
    var params = [];
    if (typeof fn == "object" && fn.hasOwnProperty("params") && fn.hasOwnProperty("fn") ){
        // fn == {fn:function(param1,param2){},params:[param1,param2]}
        if (typeof fn.fn == "function"){
            func = fn.fn;
            params = fn.params;
            if (!(params instanceof Array)){
                params = [params];
            }
        } else {
            log.warning("Wrong format job", fn)  ;
            return;
        }


    } else if (typeof fn == "function") {
        func = fn;
    }


    var check_done_fn = null;
    var check_done_fn_params = [];

    if (typeof done_signature  ==  typeof "String"){

        check_done_fn = function (sinature) {


            return this.page.content.search(sinature) != -1
        }
        check_done_fn_params = [done_signature];
    } else if (typeof done_signature == "function"){
        check_done_fn = done_signature;
        check_done_fn_params = [];

    } else if (typeof done_signature == "object" && done_signature.hasOwnProperty("params") && done_signature.hasOwnProperty("fn") ){
        // done == {fn:function(param1,param2){},params:[param1,param2]}
        if (typeof done_signature.fn == "function"){
           check_done_fn = done_signature;
        }
        check_done_fn_params = [];


    } else if (done_signature === true){
        // sync function
        check_done_fn = true;
    }

    var check_err_fn = null;
    var check_err_fn_params = [];

    if  (typeof err_signature == "string") {

    } else if (typeof err_signature == "function") {

    } else if (typeof err_signature == "object" && err_signature.hasOwnProperty("params") && err_signature.hasOwnProperty("fn") ){

    }

    var err_fn = null;
    if (typeof err_fn == "function"){

    }

    var stackObj = {
        func: func,
        params: params,
        check_done_fn: check_done_fn,
        check_done_fn_params: check_done_fn_params,

        check_err_fn: check_err_fn,
        check_err_fn_params: check_err_fn_params,

        err_fn:err_fn


    }
    this.stack.push(stackObj)

}

QiwiClient.prototype.nextStep = function (isRepeatStep) {
    log.debug('Execute `nextStep()`');
    if (this.stack.length > 0) {
        var cj = this.stack.shift();
        this.currentJob = cj;

        // execute function (with params) from stack
        this.lastResult = cj.func.apply(this, cj.params);

        if (cj.check_fn === true) {
            this.nextStep();
        } else {
            this._resultWatcher = setInterval((function (self) {
                return function () {
                    log.debug("resultWatcher execute ",self.page.content.length);
                    if (self.pageLoaded === false){
                        log.debug("page not loaded ",self.pageLoaded );
                        return;
                    }
                    var cj = self.currentJob;
                    log.debug("do job ",cj );

                    var checkResult = cj.check_done_fn.apply(self,cj.check_done_fn_params);
                    var errResult = false;
                    if (typeof cj.check_err_fn == "function"){
                        errResult = cj.check_err_fn.apply(self,cj.check_err_fn_params);
                    }
                    if (errResult === true){
                        log.warning('Error is happend');

                        cj.err_fn.apply(self,cj.err_fn_params);
                    } else if (checkResult === true){
                         log.debug('Result is ok')
                    } else {
                        log.debug("no result(err or ok) detected");
                        return                                     ;
                    }
                    log.debug("clear interval and go nextStep()")   ;
                    clearInterval(self._resultWastcher);
                    self.nextStep();

                }
            } )(this), 200);
        }

    } else {
        this._stackWatcher = setInterval((function (self) {
            return function () {
                if (self.stack.length > 0){
                    log.debug("stackWatcher detect stack not empty, so execute `nextStep()`") ;
                    clearInterval(self._stackWatcher);
                    self.nextStep();
                }
            };
        })(this),this._stackWatcherInterval);
        log.debug("Stack empty, watcher checked every " + this._stackWatcherInterval + " miliseconds")
    }
}

QiwiClient.prototype.open = function (url) {
    log.debug('try to open ', url);
    this.page.open(url, (function (self) {
        var f = function (status) {
            self.nextStep();
        }
        return f;
    })(this));
}

QiwiClient.prototype.submit = function (formData, selector, submitSelector) {
    var submitSelector = submitSelector || "[value=submit]" ;
    log.debug("Submit form ", formData, selector, submitSelector);
//    this.page.includeJs("http://ajax.googleapis.com/ajax/libs/jquery/1.7.2/jquery.min.js")
    var result = this.page.evaluate(function (formData, selector, submitSelector) {

        try{
//            var form = document.querySelectorAll(selector);
            var form = $(selector);
            console.log(form);
            console.log(formData);
            for (var fieldKey in formData) {
                var value = formData[fieldKey];
                $(fieldKey, form).val(value).keyup();
                console.log("field: "+ fieldKey + " = "+ value);
            }
            var submitControl = $(submitSelector, form);
            submitControl.click();
            return form;
        } catch (e){
            return e;
        }
    }, formData, selector, submitSelector);
    log.debug("Submit return ", result);
}
QiwiClient.prototype.openUrl = function (url){
        this.page.open(url);
}

QiwiClient.prototype.doLogin = function () {
    log.notice("Login with ", this.config.login);

    this.add(
        {
            fn:this.page.open,
            params:this.base_URL + this.login_URL
        },
        "id=\"password\"");

    this.add(
        {
            fn: this.submit,
            params: [{
                        "#phone": this.config.login,
                        "#password": this.config.password
                    },
                    "#userMenu"
                    ]
        },
        "id=\"profileLogin\"","class=\"errorMessageBlock\""
    );
//    this.add(function () {
//        this.ajaxWaitingTimer = setInterval((function (self) {
//            return function(){
//
//                var result = self.page.evaluate(function(){
////                    var passwd = "none";
//                    var account  = "" ;
//                    try{
//                        var passwd = $("form #password").html();
//                        var account = $("#profileBalance").text();
//                    } catch (e){
//
//                    }
//                    return account;
//                })
//
//                   if (result.search("Баланс")){
//                        log.notice("Auth success!") ;
//                        clearInterval(self.ajaxWaitingTimer);
//                        self.nextStep();
//
//                    }
//            }
//       })(this) ,100)
//
//    })

}


QiwiClient.prototype.makePay = function (account, amount, comment, cb) {

}

QiwiClient.prototype.command_invoice = function (req, res, argv) {
    var account = argv[0].replace("%2B","+");
    var amount = argv[1];
    var comment = argv[2]||"";

    this.push(function  () {
    this.page.open(this.base_URL + this.invoice_URL,function () {
        log.warning("loaded");
        } );
        log.debug(this.base_URL + this.invoice_URL);
    } )
        ;

    this.push_sync(
        this.submit,
        {
            "#to": account,
            "#value": amount,
            "#comment": comment

        },
        ".createBill form"
    );

    this.push(function(){
        log.debug("check invoice");
        this.invoiceCheckInterval = setInterval((function (self) {
             return function(){
                 var result = self.page.evaluate(function(){

                     return $(".resultPage").text()
                 })
                 if (result){
                     if (result.search("успешно")) {
//                         log.notice(result);
                          clearInterval(self.invoiceCheckInterval);
                         log.notice("invoice done");
                     }
                     else if (result.search("ошибка")) {

                     } else {
                         log.warning("make invoice FAIL");
                     }
                 }



             }


            ;
        } )(this),100)

    })


//    this.push(this.)
//    this.makeInvoice.call(this,)
}

QiwiClient.prototype.makeInvoice = function (account, amount, comment, cb) {

}


QiwiClient.prototype._startFinishDateFormat = function () {
    var result;
    var d = new Date();
    var formatedFinishDate = d.getDate() + '.' + (d.getMonth() + 1) + "." + d.getFullYear();

    var d = new Date();
    if (!this.isNotFirstRunFlag) {
        d.setMonth(d.getMonth() - 2);
        this.isNotFirstRunFlag = true;
    } else {
        d.setDate(d.getDate() - 1);
    }
    var formatedStartDate = d.getDate() + '.' + (d.getMonth() + 1) + "." + d.getFullYear();


    result += "&start=" + formatedStartDate;
    result += "&finish=" + formatedFinishDate;

    return result;

}


QiwiClient.prototype.reportCheck = function (startDate, endDate) {
    var url = this.base_URL;
    url += "report/list.action?daterange=true";
    url += this._startFinishDateFormat();

    this.push(this.open, url);

    this.push_sync(function () {
        var updatedTransactionInfo = this.page.evaluate(function (cachedTransaction) {
            var updatedTransaction = {};
            var updatedTransactionCount = 0;

            function scanList(selector, state) {
                var items = $(selector);
                for (var i = 0; i < items.length; i++) {
                    var record = {
                        transaction: $(".transaction", item[i]).text(),
                        date: $(".date", item[i]).text(),
                        time: $(".time", item[i]).text(),
                        income: $(".income .cash", item[i]).text(),
                        outcome: $(".expenditure .cash", item[i]).text(),
                        comment: $(".comment", item[i]).text(),
                        commentFull: $(".ProvWithComment", item[i]).text(),
                        state: state
                    }
                    if (cachedTransaction[record.transaction] == undefined || cachedTransaction[record.transaction].state != record.state) {
                        updatedTransaction[record.transaction] = record;
                        updatedTransactionCount++;
                    }
                }
            }

            scanList(".orders .ordersLine.ERROR", "err");
            scanList(".orders .ordersLine.SUCCESS", "ok");
            return [updatedTransactionCount, updatedTransaction]
        }, this.cachedTransaction)

        // if `updatedTransaction` not empty
        if (updatedTransactionInfo[0]) {
            this.cachedTransaction = updatedTransactionInfo[1];

        }
    })
}


QiwiClient.prototype.invoiceCheck = function () {
    var url = this.base_URL;
    url += "order/list.action?type=2";

    this.push(this.open, url);

    this.push_sync(function () {
        var updatedTransactionInfo = this.page.evaluate(function (cachedInvoiceTransaction) {
            var updatedInvoiceTransaction = {};
            var updatedInvoiceTransactionCount = 0;

            function scanList(selector, state) {
                var items = $(selector);
                for (var i = 0; i < items.length; i++) {
                    var record = {
                        creation: $(".orderCreationDate", arr[i]).text(),
                        account: $(".from", arr[i]).text().replace(/^\s+|\s+$/g, ''),
                        transaction: $(".transaction", arr[i]).text().replace(/^\s+|\s+$/g, ''),
                        comment: $(".CommentWrap", arr[i]).text().replace(/^\s+|\s+$/g, ''),
                        amount: $(".amount", arr[i]).text(),
                        state: state
                    }
                    if (cachedTransaction[record.transaction] == undefined || cachedTransaction[record.transaction].state != record.state) {
                        updatedInvoiceTransaction[record.transaction] = record;
                        updatedInvoiceTransactionCount++;
                    }
                }
            }

            scanList(".orders .ordersLine.CANCELED", "cancel");
            scanList(".orders .ordersLine.PAID", "paid");
            scanList(".orders .ordersLine.NOT_PAID", "pay-wait");
            return [updatedInvoiceTransactionCount, updatedInvoiceTransaction]
        }, this.cachedInvoiceTransaction)

        // if `updatedTransaction` not empty
        if (updatedTransactionInfo[0]) {

            //  TODO:update or assign
            this.cachedInvoiceTransaction.update(updatedTransactionInfo[1]);
            //this.cachedInvoiceTransaction = updatedTransactionInfo[1];

            if (this.config.invoice) {
                this.sendToExternal(this.config.invoice, updatedTransactionInfo[1])

            }
        }
    })
}

QiwiClient.prototype.sendToExternal = function (address, data) {

    // page for sending event to other script using http POST
    this.messagePage = this.messagePage || webpage.create();
    // handler for exec external script
    this.exec = this.exec || child_process.execFile;
    var payload = "payload=" + encodeURI(JSON.stringify(data));
    if (address.search("http://") == -1) {
        var parsed = address.split(/\W+/);
        this.exec(parsed[0], parsed.splice(1).append(payload), null, function (err, stdout, stderr) {
            if (stdout.search("ok")) {

            } else {
                log.debug("error ")
            }

        })

    } else {

        this.messagePage.open(address, "post", payload, (function (status) {
            if (status == "success") {
                if (this.content.search("ok")) {
                    log.debug("message send, ok resive");
                }

            } else {
                log.debug("status is not success on ")
            }
        }).call(this.messagePage))
    }
}

QiwiClient.prototype.command_next = function () {
    this.nextStep();
    return "ok, go next";
}
QiwiClient.prototype.command_stack = function () {
    var result = "Stack length = " + this.stack.length + " ";
    log.notice(result);
    for (var i = 0; i < this.stack.length; i++) {
        var item = this.stack[i];
        for  (var j in item) {
            if (typeof item[j] == "function"){
                item[j] = item[j].toString().slice(0, 100);
            }
        }
        var functionSignature = item.func.toString().slice(0, 100);
        var obj = {func: functionSignature, params: JSON.stringify(item.params), sync: item.sync};
        result += "\r\n Element " + i;
//        result += JSON.stringify(obj, null, 2)
        result += JSON.stringify(item, null, 2)
    }
    return result
}

inherit(QiwiClient, Server);

module.exports = QiwiClient;