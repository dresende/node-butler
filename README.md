## Node Butler

This module helps when you need to call several asynchronous calls one after each other.

## Install

    npm install butler

## Example

    var fs = require("fs"),
    Butler = require("./../lib/butler").Butler;

    // fs.readFile()
    function readFileAsync(filename, cb) {
      var Alfred = new Butler();

      Alfred
      .add(fs.open, filename, "r")
      .store("fd")
      .chain(fs.fstat)
      .wait(function (err, stats) {
        if (err) { cb(err); return false; }

        // Alfred.storage.fd was saved previously using .store("fd", [ param index = 0])
        Alfred.storage.size = stats.size;

        Alfred
        .add(fs.read, Alfred.storage.fd, new Buffer(Alfred.storage.size), 0, Alfred.storage.size, 0)
        .wait(function (err, size, data) {
          if (err) { cb(err); return false; }

          Alfred.storage.data = data;
        })
        .add(fs.close, Alfred.storage.fd)
        .wait(function (err) {
          if (err) { cb(err); return false; }
          cb(null, Alfred.storage.data);
        });
      });
    }

    readFileAsync(__dirname + "/fs.js", function (err, data) {
      if (err) {
        return console.log("error reading file", err);
      }
      console.log("FILE\n-------------------------");
      console.log(data);
      console.log("-------------------------");
    });