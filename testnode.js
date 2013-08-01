

if (process.argv[3] =='runserver'){

    var express = require('express');
    var app = express();

    app.post('/update', function(req, res){
        req.body.payload
        res.send('ok');
    });
    app.post('/debug', function(req, res){
        req.body.payload
        res.send('ok');
    });

    app.listen(8000);

    var zmq = require('zmq')
        , sock = zmq.socket('push');

    sock.bindSync('tcp://127.0.0.1:3000');
    console.log('Producer bound to port 3000');

    setInterval(function(){
        console.log('sending work');
        sock.send('some work');
    }, 500);

} else {

}

