var Q = require('q');

exports.index = function(req, res) {
  if (!req.session.userVariable)
    res.render('index', { title: 'Express' });
  else
    res.render('list', { title: 'Express' });
};

exports.login = function (req, res) {

}

exports.game = function(req, res) {
  res.render('game', { title: 'Express' });
};