var webserver = require("webserver");
var system = require('system');
var log = require("./log");
log.debug("server module loaded");


function Server(bind){
    log.debug("server constructor start execute");
    this.COMMAND_FUNCTION_NAME_SIGNATURE = "command_" ;
    if (!bind && this.hasOwnProperty("config")){
        if (this.config.hasOwnProperty("bind")){
            this.serverBind = this.config.bind;
        }

    }
    this.serverBind = this.serverBind || "127.0.0.1:5030";
    this.serverHandler = webserver.create();
}

Server.prototype.runServer = function(){
//    console.log(this.serverBind);
    log.debug("Try to run server at", this.serverBind);
    this.serverHandler.listen(this.serverBind, (function(self){
        var f = function(req, res){
            self.requestHeader.call(self, req, res);
        }
        return f;
    })(this));
}

Server.prototype.urlParse = function(url){
    var pattern = "^(([^:/\\?#]+):)?(//(([^:/\\?#]*)(?::([^/\\?#]*))?))?([^\\?#]*)(\\?([^#]*))?(#(.*))?$";
    var rx = new RegExp(pattern);
    var parts = rx.exec(url);
    var resultURL = {};
    resultURL.href = parts[0] || "";
    resultURL.protocol = parts[1] || "";
    resultURL.host = parts[4] || "";
    resultURL.hostname = parts[5] || "";
    resultURL.port = parts[6] || "";
    resultURL.pathname = parts[7] || "/";
    resultURL.search = parts[8] || "";
    resultURL.hash = parts[10] || "";
    return resultURL
}

Server.prototype.requestHeader = function(req, res){
    log.debug("Got server request ", req.url);
    var url = this.urlParse(req.url);

    var property = this.COMMAND_FUNCTION_NAME_SIGNATURE + url.pathname.slice(1).replace("/","_");
    log.debug("Try to find function ", property);
    if (typeof this[property] == "function") {
        try{
            log.debug("Found ", property);
            res.statusCode = 200;
            res.setHeader("Content-Type", "text/html;charset=utf-8");
            var result = this[property].call(this, req, res, url);

            if (typeof result == "string"){
                log.debug("Function `" + property + "` returned string, so closing and send to client response ",result);
                res.write(result);
                res.close();
            } else if (result === undefined) {
                log.debug("Function `" + property + "` returned undefined, so waiting `res.close()` from `" + property);
            } else {
                log.warning("Function `" + property + "` returned not string! close request using `res.close()`", result);
                res.write(result);
                res.close();
            }

        } catch (error){
            log.error("Function `" + property + "` return error " + error.name, error);
            res.statusCode = 500;
            res.write("internal error");
            res.close();
        }

    } else {
        log.warning("For url " + req.url +" not found function `" + property + "`");
        res.statusCode = 404;
        res.write("command not found");
        res.close();
    }
}




Server.prototype.command_screenshot = function (req,res,url,name){
    log.debug("Rendered screenshot function")
    if (this.page) {
        this.renderIndex = this.renderIndex || 0;
        this.renderIndex++;
        var filename = 'render/' + (name?name:"img" + this.renderIndex + ".png");
        log.notice("Rendered to " + filename);
        this.page.render(filename);
        return "file save at " + filename;


    } else {
        log.critical("Webpage object not found in class!");
        return "page not loaded";
    }
}

Server.prototype.command_sys = function (req,res,url,name){
    log.debug("Return `system` var",system);
    return JSON.stringify(system);
}


Server.prototype.command_dump = function (req,res,url,name){
    log.debug("Return `this` var",this);
    return JSON.stringify(this);

}

Server.prototype.command_ls = function(req,res,url){
    log.debug("Return list of available commands");
    var html = ""
    var obj = this;
    var commandList = Array()
    for(var property in obj) {
        if(typeof obj[property] == "function") {
            if (property.indexOf(this.COMMAND_FUNCTION_NAME_SIGNATURE)==0){
                var commandName = property.slice(this.COMMAND_FUNCTION_NAME_SIGNATURE.length);
                commandList.push(commandName);
                html += "<li>";
                html += "<a href='http://" + this.serverBind + '/' + commandName + "'>" + commandName + "<a/>";
                html += "</li>";

            }
        }
    }
    log.debug("Total " + commandList.length + " commands ", commandList)
    html = "<ul>" + html +"</ul>"
    return html

}

module.exports = Server;