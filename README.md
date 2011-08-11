## Node Butler

This module helps when you need to call several asynchronous calls one after each other.

## Install

    npm install butler

## Example

    // fs.readFile() implementation (check examples/fs.js)
    var fs = require("fs"),
        Butler = require("./../lib/butler").Butler,
        Alfred = new Butler();

    // fs.readFile()
    function readFileAsync(filename, cb) {
      Alfred
        .add(fs.open, filename, "r")
        .wait(function (err) {
          if (err) { cb(err); return false; }

          this.storage.fd = this.params.first();
        })
        .add(fs.fstat)
        .wait(function (err) {
          if (err) { cb(err); return false; }

          var size = this.params.get(0).size;
          this.params.set(this.storage.fd, new Buffer(size), 0, size, 0);
        })
        .add(fs.read)
        .wait(function (err) {
          if (err) { cb(err); return false; }

          this.storage.data = this.params.get(1);
          this.params.set(this.storage.fd);
        })
        .add(fs.close)
        .wait(function (err) {
          if (err) { cb(err); return false; }
          cb(null, this.storage.data);
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
