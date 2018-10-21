module.exports = function(app){
    var User = require('../models/user').User;
    var async = require('async');
    var checkAuth = require('../middleware/checkAuth');
    var config = require('../config');
    var ip = config.get('chat_ip');

    app.post('/login', function(req, res){
        var username = req.body.login;
        var password = req.body.password;
        async.waterfall([
            function(callback){
                User.findOne({username: username}, callback);
            },
            function(user, callback){
                if(user){
                    if(user.checkPassword(password)){
                        callback(null, user);
                    }else{
                        res.status(403).json({message: 'Неверный пароль'});
                    }
                }else{
                        res.status(403).json({message: 'Неверный логин'});
                }
            }
        ], function(err, user){
            if(err) return res.status(500).json({message: 'Произошла ошибка'});
            req.session.user = user._id;
            res.status(200).json({message: ip}); 
        });
    });

    app.get('/chat', checkAuth, function(req, res){
        User.findById(req.session.user, function(err, user){
            if(err) return res.status(500).json({message: 'Произошла ошибка'})
            res.status(200).json({login: user.username, ip: ip})
        });
    });

    app.post('/logout', function(req, res){
        req.session.destroy(function(err){   
            if(err) return res.status(500).json({message: 'Произошла ошибка'});
            res.json(200, {});
        });
        
     });
}

