var express = require('express');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var User = require('./APPI/user');
var Leituras = require('./APPI/leituras');
var Leituras_gli = require('./APPI/leituras_gli');
var Medicos = require('./APPI/medicos');
var Notificacoes = require('./APPI/notificacoes');
var Pacientes = require('./APPI/pacientes');
var passport = require("passport");
var app = express();
var LocalStrategy = require("passport-local");
var passportLocalMongoose = require("passport-local-mongoose");
var crypto = require("crypto");
var async = require("async");
var flash = require('connect-flash');
var cookieParser = require('cookie-parser');
var session = require("express-session");
var client = require("twilio")

app.configure(function() {
  app.use(express.cookieParser('keyboard cat'));
  app.use(express.session({ cookie: { maxAge: 60000 }}));
  app.use(flash());
});

var nodemailer = require("nodemailer");



app.use(bodyParser.urlencoded({extended:true}));
app.use(require("express-session")({
    secret:"Rusty is the best og in the world",
    resave: false,
    saveUninitialized: false
}));

app.set('view engine','ejs');
app.use(passport.initialize());
app.use(passport.session());
// 
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());


mongoose.connect('mongodb://ed:ed@ds237489.mlab.com:37489/heroku_4jqslj1n');

var db = mongoose.connection;

// show register form
app.get("/register", function(req, res){
     req.flash("reg", "register here");
   res.render("register", {page: 'register'}); 
});

app.get("/luisa9.github.io/ptsi/site", function(req, res){
   res.render("site", {page: 'site'}); 
});

app.get("/secret",isLoggedIn, function(req, res){
    res.render("secret");
});



//handling user sign up
app.post("/register", function(req, res){
    var newUser = new User({
        username: req.body.username,
      
        email: req.body.email,
       
      });

    if(req.body.adminCode === 'admin') {
      newUser.isAdmin = true;
    }

    User.register(newUser, req.body.password, function(err, user){
        if(err){
            console.log(err);
            return res.render("register", {error: err.message});
        }
        passport.authenticate("local")(req, res, function(){
           res.redirect("/luisa9.github.io/ptsi/site"); 
        });
    });
});

app.get("/login", function(req, res){
   res.render("login", {page: 'login'}); 
});


app.post("/login", passport.authenticate("local", 
    {
        successRedirect: "/luisa9.github.io/ptsi/site",
        failureRedirect: "/login",
        failureFlash: true,
        successFlash: 'Welcome'
    }), function(req, res){
                //res.render("home" , { expressFlash: req.flash('success')}); 

});

app.get("/logout", function(req, res){
   req.logout();
   req.flash("success", "See you later!");
   res.redirect("/home");
});

app.get('/forgot', function(req, res) {
  res.render('forgot');
});

app.post('/forgot', function(req, res, next) {
  async.waterfall([
    function(done) {
      crypto.randomBytes(20, function(err, buf) {
        var token = buf.toString('hex');
        done(err, token);
      });
    },
    function(token, done) {
      User.findOne({ email: req.body.email }, function(err, user) {
        if (!user) {
          req.flash('error', 'No account with that email address exists.');
          return res.redirect('/forgot');
        }

        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

        user.save(function(err) {
          done(err, token, user);
        });
      });
    },
    function(token, user, done) {
      var smtpTransport = nodemailer.createTransport({
        service: 'Gmail', 
        auth: {
          user: 'diabetes.ptsi2018@gmail.com',
          pass: 'ptsidiabetes'
        }
      });
      var mailOptions = {
        to: user.email,
        from: 'diabetes.ptsi2018@gmail.com',
        subject: 'Node.js Password Reset',
        text: 'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n' +
          'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
          'http://' + req.headers.host + '/reset/' + token + '\n\n' +
          'If you did not request this, please ignore this email and your password will remain unchanged.\n'
      };
      smtpTransport.sendMail(mailOptions, function(err) {
        console.log('mail sent');
        req.flash('success', 'An e-mail has been sent to ' + user.email + ' with further instructions.');
        done(err, 'done');
      });
    }
  ], function(err) {
    if (err) return next(err);
    res.redirect('/forgot');
  });
});

app.get('/reset/:token', function(req, res) {
  User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function(err, user) {
    if (!user) {
      req.flash('error', 'Password reset token is invalid or has expired.');
      return res.redirect('/forgot');
    }
    res.render('reset', {token: req.params.token});
  });
});

app.post('/reset/:token', function(req, res) {
  async.waterfall([
    function(done) {
      User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function(err, user) {
        if (!user) {
          req.flash('error', 'Password reset token is invalid or has expired.');
          return res.redirect('back');
        }
        if(req.body.password === req.body.confirm) {
          user.setPassword(req.body.password, function(err) {
            user.resetPasswordToken = undefined;
            user.resetPasswordExpires = undefined;

            user.save(function(err) {
              req.logIn(user, function(err) {
                done(err, user);
              });
            });
          })
        } else {
            req.flash("error", "Passwords do not match.");
            return res.redirect('back');
        }
      });
    },
    function(user, done) {
      var smtpTransport = nodemailer.createTransport({
        service: 'Gmail', 
        auth: {
          user: 'diabetes.ptsi2018@gmail.com',
          pass: 'ptsidiabetes'
        }
      });
      var mailOptions = {
        to: user.email,
        from: 'diabetes.ptsi2018@mail.com',
        subject: 'Your password has been changed',
        text: 'Hello,\n\n' +
          'This is a confirmation that the password for your account ' + user.email + ' has just been changed.\n'
      };
      smtpTransport.sendMail(mailOptions, function(err) {
        req.flash('success', 'Success! Your password has been changed.');
        done(err);
      });
    }
  ], function(err) {
    res.redirect('/login');
  });
});

function isLoggedIn(req, res, next){
    if(req.isAuthenticated()){
        return next();
    }
    res.redirect("/login");
}
