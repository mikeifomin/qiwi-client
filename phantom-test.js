var webpage = require("webpage");
page = webpage.create();
page.open("http://google.com",function(status){
    console.log(status) ;
    page.render("1.png")
})