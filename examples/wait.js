var Butler = require("./../lib/butler").Butler,
    Alfred = new Butler();

Alfred
	// this will be done in parallel
	.add(asyncDouble, 2)
	.add(asyncDouble)
	.add(asyncDouble)
	.wait(5000)
	.add(asyncDouble, 16)
	.add(asyncDouble)
	.resume(); // start execution, don't care about results

function asyncDouble(v, cb) {
	setTimeout(function () {
		console.log("%d * 2 = %d", v, v * 2);
		cb(null, v * 2);
	}, Math.random() * 2e3);
};