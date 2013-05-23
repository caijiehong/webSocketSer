var net = require('net');
var crypto = require('crypto');
var events = require("events");

exports.createServer = function (onConnect) {
    var server = net.createServer(function (con) {
        var client = new WsClient(con);
        onConnect(client);
    });

    this.listen = function(port, onlisten){
        server.listen(port, onlisten);
    }

    return this;
}

function WsClient(con) {
    var _t = this;
    var registered = false;
    var dataLength = 0;
    var recevBuf = null;
    var mask = null;
    var recevHead = null;

    var eve = new events.EventEmitter();

    this.on = function (_event, _listenter) {
        eve.on(_event, _listenter);
        return this;
    };

    con.on('data', function (data) {
        if (!registered) {
            _shakeHand(data, con);
            registered = true;
            eve.emit('connect', con)
        } else {
            _readData(data);
        }
    });

    con.on('end', function () {
        eve.emit('close');
    });

    function _shakeHand(data) {

        var data = data.toString().split('\r\n');

        var header = {};
        for (var i = 0; i < data.length; i++) {
            var index = data[i].indexOf(':');
            if (index > 0) {
                var key = data[i].substr(0, index);
                var value = data[i].substr(index + 1);
                header[key.trim()] = value.trim();
            }
        }

        var shasum = crypto.createHash('sha1');
        var m_Magic = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
        shasum.update(header['Sec-WebSocket-Key'] + m_Magic, 'ascii');

        var respond = 'HTTP/1.1 101 Web Socket Protocol Handshake\r\n';
        respond += 'Upgrade: ' + header['Upgrade'] + '\r\n';
        respond += 'Connection: ' + header['Connection'] + '\r\n';
        respond += 'Sec-WebSocket-Accept: ' + shasum.digest('base64') + '\r\n';
        respond += 'WebSocket-Origin: ' + header['Origin'] + '\r\n';
        respond += 'WebSocket-Location: ' + header['Host'] + '\r\n';
        respond += '\r\n';

        con.write(respond, 'ascii');

    }

    function _readFrameHead(data) {
        if (dataLength == 0) {
            recevHead = data[0];

            //获取实际数据Payload长度
            var length = data[1] & 0x7F;
            //是否使用掩码
            var hasMarsk = (data[1] & 0x80) == 0x80;

            var marskIndex = 2;
            var dataIndex = 6;
            if (length == 126) {
                marskIndex = 4;
                dataIndex = 8;
                length = data.readUInt16BE(2);
            } else if (length == 127) {
                marskIndex = 10;
                dataIndex = 14;
                length = data.readUInt32BE(6);
            }
            dataLength = length;

            if (hasMarsk) {
                recevBuf = new Buffer(length);
                mask = data.slice(marskIndex, marskIndex + 4);
            } else {
                recevBuf = '';
                mask = null;
            }
            return dataIndex;
        } else {
            return 0;
        }
    }

    function _readData(data) {

        var dataIndex = _readFrameHead(data);

        if (mask) {
            var i = recevBuf.length - dataLength;
            var l = Math.min(recevBuf.length, data.length - dataIndex + i);
            dataLength -= data.length - dataIndex;

            for (; i < l; i++) {
                recevBuf[i] = data[dataIndex++] ^ mask[i % 4];
            }
        } else {
            recevBuf += data.toString('utf8', dataIndex);
            dataLength -= data.length - dataIndex;
        }

        if (dataLength == 0) {
            if (recevBuf.length > 0) {
                var out = recevBuf.toString();
                eve.emit('data', out);
            } else {
                eve.emit('close');
            }
        }
    }

    this.send = function (message) {
        var length = Buffer.byteLength(message);
        var dataIndex = length > 65535 ? 10 : length > 125 ? 4 : 2;

        var buf = new Buffer(dataIndex + length);
        buf[0] = recevHead;
        if (length > 65535) {
            buf[1] = 127;
            buf.writeUInt32BE(0, 2);
            buf.writeUInt32BE(length, 6);
        } else if (length > 125) {
            buf[1] = 126;
            buf.writeUInt16BE(length, 2);
        } else {
            buf.writeUInt8(length, 1);
        }

        buf.write(message, dataIndex);

        con.write(buf, 'utf8', function () {

        });
    }
}

OpCode = {
    Text: 1,
    Binary: 2,
    Close: 8,
    Ping: 9,
    Pong: 10
}