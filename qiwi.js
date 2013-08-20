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
    log.debug("Execute run method");
    this.page = webpage.create();
    this.page.settings.userAgent = 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/28.0.1500.95 Safari/537.36';

    log.debug("Inherit super methods from server parent");
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

    if (this.config.invoice || this.config.report) {
        // TODO: what about `this`?  use javascript closure!
        this.page.onResourceReceived = this.ResourceWatcherForCheckBalance
    }

    this.page.onLoadFinished = (function (self) {
        return function (status) {

            if (status == "success") {
                log.debug('Event onLoadFinished success, go `nextStep()`');
                self.nextStep();
            } else {
                log.warning("Event onLoadFinished NOT success ", status)
            }
        }
    })(this);

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


QiwiClient.prototype.push = function (fn) {

    var params = Array.prototype.slice.call(arguments, 1);
    log.debug("Push ASYNC job to stack params and fn", params, fn);

    this.stack.push({
        func: fn,
        params: params,
        sync: false
    })

}
QiwiClient.prototype.push_sync = function (fn) {
    var params = Array.prototype.slice.call(arguments, 1);

    log.debug("Push SYNC job to stack params and func", params, fn);

    this.stack.push({
        func: fn,
        params: params,
        sync: true
    })
}

QiwiClient.prototype.nextStep = function () {
    log.debug('Execute `nextStep()`');
    if (this.stack.length > 0) {
        var currentJob = this.stack.shift();

        log.debug("Shift " + (currentJob.sync ? "SYNC" : "ASYNC") + " job from stack ", currentJob.func);

        // execute function (with params) from stack
        this.lastResult = currentJob.func.apply(this, currentJob.params);
        this.command_screenshot();
        this.lastJob = currentJob;
        if (currentJob.sync) {
            this.nextStep();
        } else {
            this.waitLoading = true;
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
    log.debug('this.page ', this.page);
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

    var result = this.page.evaluate(function (formData, selector, submitSelector) {
//        console.log("Js code run ");
//        console.log($.toString().slice(0,20));
        var form = $(selector);
        for (var fieldKey in formData) {
            var value = formData[fieldKey];
            $(fieldKey, form).val(value).keyup();
            console.log("field: "+ fieldKey + " = "+ value);
        }

        var submitControl = $(submitSelector, form);
//        console.log("value parameter of submit button DOM element: " + submitControl.val());
        submitControl.click();
//        return form;

    }, formData, selector, submitSelector);
//    if (result){
//        result = result.toString().slice(0,200)
//    }
//    log.debug("Browser say: ", result)
}


QiwiClient.prototype.doLogin = function () {
    log.notice("Login with ", this.config.login);
    this.push(function () {
        this.page.open(this.base_URL + this.login_URL)
    });

    this.push_sync(
        this.submit,
        {
            "#phone": this.config.login,
            "#password": this.config.password
        },
        "#userMenu"
    );
    this.push(function () {
        this.ajaxWaitingTimer = setInterval((function (self) {
            return function(){

                var result = self.page.evaluate(function(){
//                    var passwd = "none";
                    var account  = "" ;
                    try{
                        var passwd = $("form #password").html();
                        var account = $("#profileBalance").text();
                    } catch (e){

                    }
                    return account;
                })

                   if (result.search("Баланс")){
                        log.notice("Auth success!") ;
                        clearInterval(self.ajaxWaitingTimer);
                        self.nextStep();

                    }
            }
       })(this) ,100)

    })

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

QiwiClient.prototype.command_stack = function () {
    var result = "Stack length = " + this.stack.length + " ";
    log.notice(result);
    for (var i = 0; i < this.stack.length; i++) {
        var item = this.stack[i];
        var functionSignature = item.func.toString().slice(0, 100);
        var obj = {fn: functionSignature, params: JSON.stringify(item.params), sync: item.sync};
        result += "\r\n Element " + i;
        result += JSON.stringify(obj, null, 2)
    }
    return result
}

inherit(QiwiClient, Server);

module.exports = QiwiClient;