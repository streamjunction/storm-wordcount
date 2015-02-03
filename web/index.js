//
// Main routing module
//
// The following page hierarchy is assumed:
// 
// * / - root; doesn't actually do anything, just a redirect to the landing page
// * /login - login page
// * /logout - logout action: destroy session and redirect to /
// * /static/* - static resources (css, img, js)
// * /pages/* - different pages for logged in users
// * /api/* - REST resources for logged in users
// * /forms/* - form submission endpoints for logged in users
// * /auth/* - authentication actions
// * /pp/* - TODO: publicly visible pages
// * /papi/* - TODO: read-only REST resources for publicly visible pages


//
// --------------------------------
//    IMPORT MODULES
// --------------------------------
//

var express = require("express")
  , compiless = require("express-compiless");

var web = express();

//
// --------------------------------
//    INITIALIZE SESSION STORAGE
// --------------------------------
//


// Server options

var port = process.env.PORT || 5000;
var site = process.env.SITE || 'http://localhost:'+port;


//
// --------------------------------
//    INITIALIZE APPLICATION ROUTING
// --------------------------------
//

// ***
// Initialize middleware
// ***
web.set('views', __dirname + '/views');
web.set('view engine', 'jade');

// Set NODE_ENV env var to production or development
// to trigger the settings below
web.configure('development', function () {
    web.locals.pretty = true;
});

// General settings
web.configure(function() {        
    // initialize logging
    web.use(express.logger('dev'));
    // serve static content from /public
    // TODO: use CDN solution
    web.use('/static', compiless({ root: __dirname+'/public' }));
    // --> use { maxAge: oneDay } as the optional parameter to static to control caching
    web.use('/static', express.static(__dirname+'/public'));
    // parse cookies
    web.use(express.cookieParser());
    // parse body if application/x-www-form-urlencoded
    web.use(express.bodyParser());
    // route request
    web.use(web.router);
});


// ***
// Default redirect 
// ***
web.get('/', function (req, res) {
    res.redirect('/pages/home');
});

// ***
// Display pages
// ***

web.get('/pages/home', function (req, res) {
    res.render("main", {});
});

// ------------

// ------------

// ***
// Supporting services for the pages
// ***

require('./api/web-api.js').api(web);

//*** START THE SERVER
//***********************

require("./client.js").submit("storm/target/storm/storm", "storm/target/storm.jar", 
  process.env.SJ_SUBMIT_URL, function (err) {
  if (err) {
    console.log("Cannot submit topology: "+err);
  } else {
    web.listen(port, function() {
      console.log('Web listening on port '+port);
    });
  }
});

