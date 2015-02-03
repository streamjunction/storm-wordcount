var http = require("http")
  , https = require("https")
  , url = require("url")
  , stream = require("stream")
  , streamBuffers = require("stream-buffers")
  , fs = require("fs")
  , cp = require("child_process");

exports.RESTClient = function (requestUrl, options) {
  
  var self = this;
  var parsedUrl = url.parse(requestUrl);
  
  var getConnection = function (headers) {
    var myOptions = {};
    for (k in options) {
      myOptions[k] = options[k];
    }
    myOptions.host = parsedUrl.hostname;
    myOptions.auth = parsedUrl.auth;
    myOptions.path = parsedUrl.path;
    myOptions.method = "POST";
    if (headers) {
      myOptions.headers = myOptions.headers || {};
      for (h in headers) {
        myOptions.headers[h] = headers[h];
      }
    }

    if (parsedUrl.protocol == "http:") {
      myOptions.port = parsedUrl.port || 80;
      return http.request(myOptions);
    } else
    if (parsedUrl.protocol == "https:") {
      myOptions.port = parsedUrl.port || 443;
      return https.request(myOptions);
    } else {
      throw new Error("Unknown protocol: "+parsedUrl.protocol);
    }
  };
  
  this.send = function (obj, cb) {
    send(JSON.stringify(obj), "application/json", cb);
  };
  
  this.sendText = function (data, cb) {
    send(data, "text/plain", cb);
  };
  
  var send = function (data, contentType, cb) {
    var request = getConnection();
    request.setHeader("content-type", contentType);
    request.on("response", function (response) {      
      var resBuf = new streamBuffers.WritableStreamBuffer();
      response.pipe(resBuf);
      response.on("end", function () {          
          var contents = resBuf.getContentsAsString("utf-8") || "";
          if (response.statusCode != 200) {        
            cb("Stream error: "+response.statusCode+". "+contents);
          } else {            
            if (response.headers["content-type"] && response.headers["content-type"].match("application/json")) {
              cb(null, JSON.parseJSON(contents));
            } else {              
              cb(null, contents);
            }
          }
        }).
        on("error", function (err) {
          cb("Connection error: "+ err);
        });      
    });
    request.on("error", function (err) {
      cb("Connection error: "+err);
    });
    if (data instanceof stream.Readable) {
      data.on("data", function (b) {
        request.write(b);
      });
      data.on("end", function () {
        request.end();
      });
      data.on("error", function (err) {
        request.abort();
        cb("Source error: "+err);
      });
    } else {
      request.end(data);
    }
  };
    
};

exports.submit = function (stormJarDir, topologyJar, submitUrl, cb) {
  
  fs.readdir(stormJarDir, function (err, files) {
    if (err) {
      cb(err);
    } else {
      console.log(files);
      var classPath = files.map(function (file) { 
        return stormJarDir + "/" + file;
      }).join(":");
      
      classPath = classPath + ":" + topologyJar;
      
      console.log("cp="+classPath);
  
      var java = cp.spawn("java", [ 
        "-cp", 
        classPath, 
        "-Dstorm.jar="+topologyJar, 
        "com.streamjunction.sdk.sample.WordCount", 
        submitUrl 
      ], { stdio: "inherit" });
      
      java.on("error", function (err) {
        cb(err);
      });
      
      java.on("exit", function (exitCode, signal) {
        if (exitCode !== 0) {
          cb(exitCode || signal);
        } else {
          cb();
        }
      });
    }
  });
  
};
