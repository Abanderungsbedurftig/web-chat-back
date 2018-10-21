var crypto = require('crypto');
var mongoose = require('../libs/mongoose.js')

var schema = mongoose.Schema({
    username: {
        type: String,
        unique: true,
        required: true
    },
    hashedPassword: {
        type: String,
        required: true
    },
    salt: {
        type: String,
        required: true
    },
    created: {
        type: Date,
        default: Date.now
    }
});

var encryptPassword = function(password, salt){
    return crypto.createHmac('sha1', salt).update(password).digest('hex');
};

schema.virtual('password').set(function(password){
    this._plainPassword = password;
    this.salt = Math.random().toString();
    this.hashedPassword = encryptPassword(password, this.salt);
})
.get(function(){
    return this._plainPassword
});

schema.methods.checkPassword = function(password){
    return encryptPassword(password, this.salt) === this.hashedPassword;
};

exports.User = mongoose.model('User', schema);