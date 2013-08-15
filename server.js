var webserver = require("webserver");
var system = require('system');

var log =

function Server(bind){
    this.COMMAND_FUNCTION_NAME_SIGNATURE = "command_" ;
    if (!bind && this.hasOwnProperty("config")){
        if (this.config.hasOwnProperty("bind")){
            this.serverBind = this.config.bind;
        }

    }
    this.serverBind = this.serverBind || "127.0.0.1:5004";
    this.serverHandler = webserver.create();
}

Server.prototype.runServer = function(){
    console.log(this.serverBind);
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

    var url = this.urlParse(req.url);

    var property = this.COMMAND_FUNCTION_NAME_SIGNATURE + url.pathname.slice(1).replace("/","_");
    console.log(this.command_ls);
    if (typeof this[property] == "function") {
        try{
            res.statusCode = 200;
            var result = this[property].call(this, req, res, url);
            if (typeof result == "String"){
                res.write(result);
                res.close();
            }

        } catch (e){
            res.statusCode = 500;
            res.close("error - " + e.name);
        }

    } else {
        res.statusCode = 404;
        res.write("command not found");
        res.close();
    }
}




Server.prototype.command_screenshot = function (req,res,url,name){
    if (this.page) {
        this.renderIndex = this.renderIndex || 0;
        this.renderIndex++;
        var filename = 'render/' + (name?name:"img" + this.renderIndex + ".png");
        this.page.render(filename);
        res.write("file save at " + filename);
    } else {
        res.write('page not loaded');
    }
}

Server.prototype.command_sys = function (req,res,url,name){

    res.write(JSON.stringify(system));

}
Server.prototype.command_dump = function (req,res,url,name){

    res.write(JSON.stringify(this));

}

Server.prototype.command_ls = function(req,res,url){

    res.setHeader("Content-Type", "text/html;charset=utf-8");
    var obj = this;
    res.write("<ul>");
    for(var m in obj) {
        if(typeof obj[m] == "function") {
            if (m.indexOf(this.COMMAND_FUNCTION_NAME_SIGNATURE)==0){
                var command = m.slice(this.COMMAND_FUNCTION_NAME_SIGNATURE.length);
                res.write("<li>");
                res.write("<a href='http://" + this.serverBind + '/' + command + "'>" + command + "<a/>");
                res.write("</li>");

            }
        }
    }

    res.write("</ul>");
    res.close();

}

module.exports = Server;