// phantomjs code to log in to Amazon
// based on the code from this Stackoverflow answer: http://stackoverflow.com/questions/9246438/how-to-submit-a-form-using-phantomjs
// I'm injecting jQuery so this assumes you have jquery in your project directory

var page = new WebPage(), testindex = 0, loadInProgress = false;
page.settings.userAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_8_2) AppleWebKit/537.11 (KHTML, like Gecko) Chrome/23.0.1271.6 Safari/537.11";
var execFile = require("child_process").execFile;

var balance = 0;
var screenshot = 1;
function img(){
    page.render("img/st"+screenshot+".png")
    screenshot++;
}


var step_timeout;
var iterationStop = false;
var invoiceList = {};

page.onResourceReceived = function(response) {
    if (response.url == "https://visa.qiwi.com/person/state.action"){
        checkBalance();
    } else {
        clearTimeout(step_timeout);
        step_timeout = setTimeout(nextStep, 2000);
        iterationStop = false;
    }

};
page.onLoadFinished = function(status) {
    console.log('Status: ' + status);
    nextStep()
    // Do other things here...
};
page.onConsoleMessage = function(msg, lineNum, sourceId) {
    console.log('CONSOLE: ' + msg + ' (from line #' + lineNum + ' in "' + sourceId + '")');
};

function checkBalance(){
    var balance_ = page.evaluate(function(){
        return $("#profileBalance .ui-selectmenu-text").html()
    });
    if (balance != balance_){
        balance = balance_;
        steps.push(checkPayments);
    }
//    console.log(balance);
}

function checkPayments(){
    page.open("https://visa.qiwi.com/order/list.action?type=2",function(){
        console.log("_WEB_3932188989 "+ invoiceList['_WEB_3932188989']);
        var result = page.evaluate(function(invoiceList){
            var newInvoice = {};
            var newInvoiceCount = 0;
            function scan_change(arr,state){

                for (var i=0;i<arr.length;i++){

                    var record = {
                        creation:$(".orderCreationDate",arr[i]).text(),
                        account:$(".from",arr[i]).text().replace(/^\s+|\s+$/g, ''),
                        transaction:$(".transaction",arr[i]).text().replace(/^\s+|\s+$/g, ''),
                        comment:$(".CommentWrap",arr[i]).text().replace(/^\s+|\s+$/g, ''),
                        amount:$(".amount",arr[i]).text(),
                        state:state
                    }

                    if (invoiceList[record.transaction] == undefined || invoiceList[record.transaction].state != record.state){

                        newInvoice[record.transaction] = record;
                        newInvoiceCount++;
                    }

                }
            }



            scan_change($(".orders .ordersLine.CANCELED"),"cancel");
            scan_change($(".orders .ordersLine.PAID"),"paid");
            scan_change($(".orders .ordersLine.NOT_PAID"),"pay-wait");

            return [newInvoiceCount,newInvoice]

        },invoiceList);

        var newInvoiceCount = result[0];
        var newInvoice = result[1];

        if (newInvoiceCount){
            jsonifyed = JSON.stringify(newInvoice);
            result = ""
            for (var i=0;i<jsonifyed.length;i++) {
                result +=  jsonifyed.charCodeAt(i)<255?jsonifyed[i]:"";
            }
            console.log(result)
            execFile("C:\\Python27\\python.exe", ["C:\\Users\\mike\\Dropbox\\prj\\payfail\\qiwi.py",result ], null, function (err, stdout, stderr) {
                console.log("execFileSTDOUT:", JSON.stringify(stdout));
                console.log("execFileSTDERR:", JSON.stringify(stderr));
            })
        }
        invoiceList = newInvoice;

    })
}

function invoice(to,amount,comment){


    page.open("https://visa.qiwi.com/order/form.action",function(){

        page.evaluate(function(to,amount,comment){
            $(".createBill form #currency-select").val("RUB");
            $(".createBill form #to").val(to);
            $(".createBill form #value").val(amount);
            $(".createBill form #comment").val(comment);
            $(".createBill form #value").keyup();
        },to,amount,comment);

        img();

        page.evaluate(function(){
            $(".createBill form button").click();
        });
    })
}

function cash(to,amount,comment){

//    comment = comment | Math.random().toString(36).substring(7);
    page.open("https://visa.qiwi.com/payment/transfer/form.action",function(){
        img()
        page.evaluate(function(to,amount,comment){
//            $(".createBill form #currency-select").val("RUB");
            $("form.payment_frm #account").val(to).keyup();
            $("form.payment_frm .fixedRub").val(amount).keyup();
            $("form.payment_frm .cont_comment input").val(comment).keyup();



            $("form.payment_frm .payment_frm_ac button").click();

        },to,amount,comment);
        img()
    })


}
function cash_confirm(){
    page.evaluate(function(){
        $("form.payment-confirm_frm button.orangeBtn").click();

    });
    img();


}

function nextStep(){


    if (steps.length){

        next_step = steps.shift();

        if (typeof next_step == "function"){

            lastResult = next_step();
        } else {
            lastResult = next_step.fn(next_step.arg)
        }

    }

    if (steps.length == 0){
        iterationStop = true;
    }

}

var lastResult;

var steps = [
    function() {
        page.open("https://qiwi.ru/main.action");
    },

    function() {
        page.evaluate(function() {
            $('#phone').val('+79213349533');
            $('#password').val('xteZ4Vp');
            $('.auth-wrap form .submit').click()
        });
    },
    function(){
        console.log("login")
    }
]




var server = require('webserver').create();
var service = server.listen('127.0.0.1:7000', function(request, response) {

    param = request.url.split("%3A");
    console.log(param);
    if (param[0] == "/invoice"){
        account = param[1].replace("%2B",'+');
        console.log(account);
        amount = param[2];
        comment = param[3];

        steps.push(function(){
            invoice(account,amount,comment);

        });
        steps.push({arg:{resp:response}, fn:function (args_){
            result = page.evaluate(function(){
                return $('#content .resultPage h2').text()
            })
            img();

            console.log("args" + args_);
            console.log(result);

            if (result == "Счет успешно выставлен"){
                args_.resp.write('ok');
                args_.resp.close()
            } else {
                args_.resp.write('bad');
                args_.resp.close()
            }


        }})





    } else if (param[0] == "/cashback"){
        account = param[1].replace("%2B",'+');
        amount = param[2];
        comment = param[3]
        is_check = param[4];
        payment_date =  param[5];
        steps.push(function(){
            cash(account,amount,comment);
            img();

        });
        steps.push(function(){
            cash_confirm();
            img();
        });

        steps.push({arg:{resp:response}, fn:function (args_){
            result = page.evaluate(function(){
                return $('#content .resultPage h2').text()
            })
            img();
            console.log("args" + args_);
            console.log(result);
            if (result == "Операция прошла успешно"){
                args_.resp.write('ok');
                args_.resp.close()
            } else {
                args_.resp.write('bad');
                args_.resp.close()
            }


        }})



    } else if (param[0] == "/stat"){

        response.write(steps.length);
        response.close();

    } else {
        response.statusCode = 404;
        response.write('<html><body>Not supported</body></html>');
        response.close();
    }


});

var glob_interval = setInterval(function(){
//    console.log(" - " + iterationStop + " length:" + steps.length );
    if (steps.length!=0 && iterationStop){
        nextStep();
    }

},100)

//
//interval = setInterval(function() {
//  if (!loadInProgress && typeof steps[testindex] == "function") {
//    console.log("step " + (testindex + 1));
//    steps[testindex]();
//    page.render("images/step" + (testindex + 1) + ".png");
//    testindex++;
//  }
//  if (typeof steps[testindex] != "function") {
//
//
//  }
//}, 5000);

nextStep();