var Butler = require("./../lib/butler").Butler;

var b = new Butler();
b.add(asyncAdd, 1, 2)
 .add(asyncDouble)
 .wait(function (err, values, butler) {
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
 	console.log("final=", values[0]);
 });

function asyncAdd(a, b, cb) {
	setTimeout(function () {
		console.log("%d + %d = %d", a, b, a + b);
		cb(null, a + b);	
	}, 1e3);
};

function asyncDouble(v, cb) {
	setTimeout(function () {
		console.log("%d * 2 = %d", v, v * 2);
		cb(null, v * 2);
	}, 1e3);
};