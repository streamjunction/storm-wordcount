
var fs = require("fs")
  , sj = require("../client.js");

var inputStream = process.env.SJ_INPUT_STREAM_URL;
var wordsStream = process.env.SJ_WORDS_STREAM_URL;

function api(app) {

  app.get("/api/getWordCount", function (req, res) {
    new sj.RESTClient(wordsStream).sendText(req.query.words, function (err, result) {
      if (err) {
        console.log(err);
        res.send(500, "Internal error");
      } else {
        res.json(JSON.parse(result));
      }
    });
  });
  
  app.post("/api/sendWords", function (req, res) {
    new sj.RESTClient(inputStream).sendText(fs.createReadStream(
      req.files.file.path), function (err) {
        if (err) {
          console.log(err);
          res.send(500, "Internal error");
        } else {
          res.send(200, "OK");
        }
      });
  });

}

exports.api = api;
