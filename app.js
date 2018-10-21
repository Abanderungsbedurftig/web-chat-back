var express = require('express');
var http = require('http');
var config = require('./config');
var path = require('path');
var bodyParser = require('body-parser');
var expressSession = require('express-session');
var MongoStore = require('connect-mongo')(expressSession);
var User = require('./models/user').User;
var session = expressSession({
    resave: false,
    saveUninitialized: false,
    secret: config.get('session:secret'),
    key: "sid",
    cookie: {maxAge: 1000*6*60*24*7*2},
    store: new MongoStore({url: config.get('mongoose:uri')})
});

var app = express();

app.use(bodyParser());

app.use(session);

app.use(require('./middleware/loadUser'));
app.use(express.static(path.join(__dirname + '/public')));

app.get('/', function(req, res, next){
    res.sendfile(__dirname + '/public/index.html');
});

require('./routes/index')(app);

app.use(function(req, res){
    res.sendfile(__dirname + '/public/error.html');
});

app.use(function(err, req, res, next){
    if(err) res.json(500, {message: 'Произошла ошибка'});
});

var server = http.createServer(app);

//Socket.io --------------------------------------------------
var io = require('socket.io')(server);
// io.set("origins", "localhost:*");
io.use(function(socket, next){
    session(socket.request, socket.request.res, next);
});

server.listen(config.get('port'), function(){
    console.log('Server started on port: ' + config.get('port'))
});

function loadUser(id, callback){
    User.findById(id, function(err, user){
        if(err){
            return callback(err)
        }else{
            if(user) return callback(null, user.username);
        }
    });
}

var connectedClients = {
    clients: []
}

function pushClient(username, cb){
    var isAuth = false;
    connectedClients.clients.map(function(client){
        if(client.username === username) isAuth = true;
    });
    if(!isAuth) connectedClients.clients.push({username: username, connected: true});
    cb(connectedClients, isAuth);
}

function popClient(username, cb){
    var index = connectedClients.clients.findIndex(obj => obj.username === username);
    if(index > -1) connectedClients.clients.splice(index, 1);
    cb(connectedClients);
}

io.sockets.on('connection', function(socket){
    if(socket.request.session){
        var username;
        var id = socket.request.session.user;   
        loadUser(id, function(err, user){
            if(err) socket.emit('error', 'Пользователь не найден')
            username = user;
            pushClient(user, function(clients, isAuth){
                io.sockets.emit('get_clients', JSON.stringify(clients));
                if(!isAuth) socket.broadcast.emit('join', user);
            });       
        })
    }else{
        socket.emit('error', 'Отсутствует сессия');
    };
    socket.on('message', function(user, text, cb){
        socket.broadcast.emit('message', user, text);
        cb();
    });
    socket.on('logout', function(){
        Object.keys(io.sockets.connected).map(function(socketId){
            if(io.sockets.connected[socketId].request.session.user === socket.request.session.user) io.sockets.connected[socketId].emit('logout');
        });
    });
    socket.on('disconnect', function(){
        var repetitions = 0;
        Object.keys(io.sockets.connected).map(function(socketId){
            if(io.sockets.connected[socketId].request.session.user === socket.request.session.user) repetitions = repetitions + 1;
        });
        if(!repetitions){
            socket.broadcast.emit('leave', username);
            popClient(username, function(clients){
                socket.broadcast.emit('get_clients', JSON.stringify(clients));
            });
        }
    });
});
