var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var bcrypt = require('bcrypt-nodejs');

var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var session = require('express-session');
var passport = require('passport');

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));


app.get('/',
function(req, res) {
  res.render('index');
});

app.get('/create',
function(req, res) {
  res.render('index');
});

app.get('/links',
function(req, res) {
  Links.reset().fetch().then(function(links) {
    res.status(200).send(links.models);
  });
});

app.post('/links',
function(req, res) {
  console.log(req.body);
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.sendStatus(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.status(200).send(found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.sendStatus(404);
        }

        Links.create({
          url: uri,
          title: title,
          baseUrl: req.headers.origin
        })
        .then(function(newLink) {
          res.status(200).send(newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/
app.get('/signup', function(req, res) {
  console.log('SIGN UP GET REQ');
  res.render('signup');
});

app.post('/signup', function(req, res) {
  console.log('SIGNED UPPPPPPP WOOOOOHOOOOOOOO ----------------------->', req.body);
  var user = req.body.username;
  var passy = req.body.password;
  var hashPass;
  bcrypt.hash(passy, null, null, function(err, hash) {
    hashPass = hash;
    console.log(hash);
      // Store hash in your password DB.
  });

  new User({ username: user}).fetch().then(function(found) {
    if (found) {
      console.log('USER EXISTS ---->');
      res.redirect('/login');
    } else {

      Users.create({
        username: user,
        password: hashPass,
      })
      .then(function(newUser) {
        res.status(200).send(newUser);
        res.redirect('/');
      })
    //   var newUser = new User({
    //     username: user,
    //     password: hashPass
    // });

    };
  });
});

app.get('/login', function(req, res) {
  res.render('login');
});

app.post('/login', function(req, res) {
  new User({ username: req.body.username}).fetch().then(function(found) {
    if (found) {
      if (req.body.password === req.body.username.password) {
        req.session.user = req.body.username;
        res.redirect('/');
      }
      console.log('USER EXISTS ---->');
      console.log('Invalid Password');
    } else {
      res.redirect('/signup')
    }
  });
});

// app.post('/login', function(req, res) {
//   User.findOne({ email: req.body.email }, function(err, user) {
//     if (!user) {
//       res.render('login.jade', { error: 'Invalid email or password.' });
//     } else {
//       if (req.body.password === user.password) {
//         // sets a cookie with the user's info
//         req.session.user = user;
//         res.redirect('/dashboard');
//       } else {
//         res.render('login.jade', { error: 'Invalid email or password.' });
//       }
//     }
//   });
// });

app.get('/logout', function(req, res) {
  req.session.destroy(function(err) {
    if (err) { throw err; }
    res.redirect('/login');
  });
});

/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        linkId: link.get('id')
      });

      click.save().then(function() {
        link.set('visits', link.get('visits') + 1);
        link.save().then(function() {
          return res.redirect(link.get('url'));
        });
      });
    }
  });
});

module.exports = app;
