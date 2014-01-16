
/**
 * Module dependencies.
 */
var pkg = require('./package');

var express = require('express'),
    routes = require('./routes'),
    user = require('./routes/user'),
    http = require('http'),
    path = require('path'),
    io   = require('socket.io'),
    cluster = require('cluster'),
    numCPUs = require('os').cpus().length,
    sessionStore = new express.session.MemoryStore(),
    mongoose = require('mongoose').connect('mongodb://localhost/bg');

var reversi = require('./games/reversi');

var cookieParser = express.cookieParser(pkg.name);

var sessionKey = 'wtf';

var app = express();

var User = mongoose.model('User', { email: String, md5pw: String, name: String, session: String });
var Game = mongoose.model('Game', { type: String, gamenumber: Number, gamestate: String, player1: String, player2: String, turn: String, winner: String });
var Chat = mongoose.model('Chat', { gamenumber: Number, commentor: String, comment: String, when: Date });

/*
var game = new Game({ type: 'reversi', gamenumber: 1, gamestate: ',,,,,,,,,,,,,,,,,,,,,,,,,,,w,b,,,,,,,b,w,,,,,,,,,,,,,,,,,,,,,,,,,,,' });
User.findOne({email: 'asmallgrin@gmail.com'}, function(err, user) {
  console.log(user.id);
  console.log(user.email);
  console.log(user.name);
  game.player1 = user.id;
  game.save();
});
*/


/*
User.findOne({email: 'asmallgrin@gmail.com'}, function(err, user) {
  console.log(user.id);
  console.log(user.email);
  console.log(user.name);
});
*/


// all environments
app.set('port', 3001);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(express.favicon());
app.use(express.logger('dev'));
//app.use(express.json());
app.use(express.bodyParser());

//app.use(express.methodOverride());

app.use(express.cookieParser());
app.use(express.session({store: sessionStore, secret: pkg.name, key: sessionKey}));

app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

app.use('/components', express.static(__dirname + '/bower_components'));

app.post('/login', function(req, res) {
  if (req.session.userVariable) {
    res.end('already logged in');
    return;
  }
  console.log(req.body.email);
  User.findOne({ email: req.body.email }, function (err, user) {
    if (err) {
      ;
    } else if (user != null) {
      if (user.md5pw == req.body.password) {
        req.session.userid = user.id;
      }
    }
    res.end(req.session.userid ? 'success' : 'fail');    
  });
  
});

app.get('/', routes.index);
app.get('/game', routes.game);
app.get('/users', user.list);
app.get('/session', function (req, res) {
  res.send(req.sessionID)
});

server = http.createServer(app);
server.listen(app.get('port'), function() {
  console.log('Express server listening on port ' + app.get('port'));
});
io = io.listen(server);

io.set('authorization', function(data, accept) {

  if (data.headers.cookie) {
    console.log(data.headers.cookie);
    cookieParser(data, {}, function(err) {
        if(err) {
            return accept(err, false);
        }

        console.log(data.signedCookies);
        console.log(data.signedCookies[sessionKey]);

        sessionStore.get(data.signedCookies[sessionKey], function(err, session) {
            console.log(err + " " + session);

            if (err || !session) {
                return accept('Session error', false);
            }
            data.session = session;
            data.sessionID = data.signedCookies[sessionKey];
            


            data.userid = (session.userid == null) ? "-1" : session.userid;
            
            console.log(data.session);
            console.log(data.sessionID);
            console.log(data.userid);

            accept(null, true);
        });

    });

    console.log('there are cookies');
  }
});

io.sockets.on('connection', function(socket) {
  
  socket.on('join', function(data) {

    socket.room = data;
    socket.join(data);

    Game.findOne({type: data.split("-")[0], gamenumber: data.split("-")[1]}, function (err, game) {

      if (game != null) {
        socket.emit('gamestate', { gamestate: game.gamestate, you: socket.handshake.userid, player1: game.player1, player2: game.player2, turn: game.turn } );
      }
    
    });
    // get gamestate

    console.log(data);
  });

  socket.on('makemove', function(data) {

    Game.findOne({type: socket.room.split("-")[0], gamenumber: socket.room.split("-")[1]}, function (err, game) {

      if (game != null) {
        console.log('making move');
        reversi.makemove(game, socket.handshake.userid, data.x, data.y);
        console.log('emitting gamestate');
        io.sockets.in(socket.room).emit('gamestate', { gamestate: game.gamestate, you: socket.handshake.userid, player1: game.player1, player2: game.player2, turn: game.turn } );
      }
    
    });
    // get gamestate

    console.log(data);
  });

  socket.on('chat', function(data) {

    io.sockets.in(socket.room).emit('chat', { username: 'not sure', data: data } );
    console.log(socket.room + " " + data);
  });

  socket.on('disconnect', function() {
    socket.leave(socket.room);
  });

});



