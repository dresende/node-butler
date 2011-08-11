var Butler = require("./../lib/butler").Butler,
    fs = require("fs"),
    path = require("path");

var b = new Butler(),
    file = __dirname + "/fs.js",
    fd;

b.add(fs.open, file, "r")
 .wait(function (err, values) {
 	if (err) {
 		console.log("error!", err);
 		return false;
 	}
 	console.log("OPENED %s", path.basename(file));
 	fd = values[0];
 })
 .add(fs.fstat)
 .wait(function (err, values, butler) {
 	if (err) {
 		console.log("error!", err);
 		return false;
 	}

 	var size = values[0].size;
	butler.params.set(fd, new Buffer(size), 0, size, 0);
 })
 .add(fs.read)
 .wait(function (err, values, butler) {
 	if (err) {
 		return console.log("error!", err);
 	}

 	console.log("READ %d BYTES FROM %s", values[0], path.basename(file));
 	// file content is here:
 	//console.log("-------------------\n%s\n----------------\n", values[1]);

 	butler.params.set(fd);
 })
 .add(fs.close)
 .wait(function (err) {
 	if (err) {
 		return console.log("error!", err);
 	}

 	console.log("CLOSED %s", path.basename(file));
 });