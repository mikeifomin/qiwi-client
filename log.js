var Log = function (param, level) {
    this.timestamp = new Date();
}
Log.prototype._argumentsToMsg = function () {
    var argumentsArray = Array.prototype.slice.call(arguments, 0);
    var msg = argumentsArray[0];

    if (argumentsArray.length > 1) {
        msg += JSON.stringify(argumentsArray.slice(1));
    }
    return msg
}

Log.prototype.standartOutput = function (level, msg) {
    var timestamp = new Date();
    timestamp = timestamp - this.timestamp;
    console.log(timestamp + ": " + level + ">> " + msg);
}


Log.prototype.debug = function () {
    // то что реально нужно только автору кода (или человеку который
    // вдруг полезет в исходники что-то там править)
    var level = "DEBUG";
    return this.standartOutput(level, this._argumentsToMsg.apply(this, arguments));
}

Log.prototype.info = function () {
//    то, что может понадобиться техническому специалисту для
//    локализации проблемы и написания качественого bug-report.
    var level = "INFO";
    return this.standartOutput(level, this._argumentsToMsg.apply(this, arguments));

}

Log.prototype.notice = function () {
    //  то, что может понадобиться пользователю, но не обязательно
    var level = "NOTICE";
    return this.standartOutput(level, this._argumentsToMsg.apply(this, arguments));

}

Log.prototype.warning = function () {
//    то, что таки есть смысл читать, но можно не читать, если не
//    хочется
    var level = "WARNING";
    return this.standartOutput(level, this._argumentsToMsg.apply(this, arguments));

}

Log.prototype.error = function () {
//    с этим нужо че-то делать, но можно потерпеть (недолго ;)
    var level = "ERROR";
    return this.standartOutput(level, this._argumentsToMsg.apply(this, arguments));
}

Log.prototype.critical = function () {
//   если с этим ничего не сделать, то будет хуже
    var level = "CRITICAL";
    return this.standartOutput(level, this._argumentsToMsg.apply(this, arguments));
}

Log.prototype.alert = function () {
//    хуже, о котром говорили на уровне critical уже наступило
    var level = "ALERT";
    return this.standartOutput(level, this._argumentsToMsg.apply(this, arguments));

}

Log.prototype.emerg = function () {
//    "Приплыли".  За такого рода сообщением обычно следует экстреный
//    выход из программы.
    var level = "EMERG";
    return this.standartOutput(level, this._argumentsToMsg.apply(this, arguments));

}

module.exports = Log;
