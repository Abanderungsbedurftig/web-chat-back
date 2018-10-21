var User = require('../models/user').User;
var config = require('../config');

module.exports = function(req, res, next){
    req.user = null;
    if(!req.session.user) return next();
    User.findById(req.session.user, function(err, user){
        if(err) return next(err);
        req.user = user;
        res.locals.username = user.username;
        res.locals.ip = config.get('chat_ip');
        next();
    });
}