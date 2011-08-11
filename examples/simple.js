var Butler = require("./../lib/butler").Butler;

var b = new Butler();
b.add(asyncAdd, 1, 2)
 .add(asyncDouble)
 .wait(function (err, values, butler) {
 	if (err) {
 		console.log("error!", err);
 		return [ 10 ];
 	}
 	console.log("%d - 1 = %d", values[0], values[0] - 1);
 	butler.set(values[0] - 1);

 	console.log("waiting 2 seconds before resuming");
 	setTimeout(function () {
 		butler.resume();
 	}, 2e3);
 	return false;
 })
 .add(asyncDouble)
 .wait(function (err, values, butler) {
 	if (err) {
 		return console.log("error!", err);
 	}
 	console.log("%d + 1 = %d", values[0], values[0] + 1);

 	butler.params.set(values[0] + 1);
 })
 .add(asyncDouble)
 .wait(function (err, values, butler) {
 	console.log("final=", values[0]);

 	console.log("now going parallel");
 })
 .add(asyncDouble, 5)
 .add(asyncDouble, 10)
 .add(asyncDouble, 15)
 .add(asyncDouble, 20)
 .parallel(function (returns) {
 	console.log(returns);
 });

function asyncAdd(a, b, cb) {
	setTimeout(function () {
		console.log("%d + %d = %d", a, b, a + b);
		cb(null, a + b);	
	}, 1e3);
};

function asyncDouble(v, cb) {
	// this is used to check if `this.` works
	this.doubleIt = function (v) { return v * 2; };

	setTimeout((function (that) {
		return function () {
			var result = that.doubleIt(v);

			console.log("%d * 2 = %d", v, result);
			if (result < 10) {
				return cb({ message: "Double value below 10" });
			}
			cb(null, result);
		};
	})(this), 1e3);
};