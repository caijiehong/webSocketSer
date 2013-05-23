var wsServer = require('./server.js');
var WSPORT = 15354;
var clientList = [];

wsServer.createServer(function(client){
    clientList.push(client);

    client.on('connect',function(con){
        console.log(con.address());
    }).on('data', function(data){
            console.log('[' + new Date().toLocaleTimeString() + ']' + 'web recv:' + data);
    }).on('close', function(){

        });
}).listen(WSPORT, function(){
        console.log('websocket listen on ' + WSPORT);
    });