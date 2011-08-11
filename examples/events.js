var Butler = require("./../lib/butler").Butler,
    Alfred = new Butler();

Alfred
	.on("call.start", function (cb, params) {
		console.log("call started: %s(%s)", cb, params.join(","));
	})
	.on("call.end", function (cb, err, params) {
		console.log("  call ended: %s: return %s [ error? %s ]", cb, params, err ? 'y' : 'n');
	})
	// this will be done sequentially
	// the return value from 1 call will be sent to the next
	.add(asyncDouble, 2)
	.add(asyncDouble) // 4
	.add(asyncDouble) // 8
	.add(asyncDouble) // ..
	.add(asyncDouble)
	.add(asyncDouble)
	.add(asyncDouble)
	.wait(function () {
		console.log("Done!");
	});

function asyncDouble(v, cb) {
	setTimeout(function () {
		cb(null, v * 2);
	}, Math.random() * 2e3);
};