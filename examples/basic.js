var Butler = require("./../lib/butler").Butler,
    Alfred = new Butler();

Alfred
	.on("task-start", function (name, params) {
		console.log("task start: %s(%s)", name, params.join(","));
	})
	.on("task-end", function (name, params, err, returns) {
		console.log("  task end: %s(%s) -> %s [ err? %s ]", name, params.join(","), returns.join(","), err);
	})
	.on("job-end", function () {
		console.log("   job end: -");
	})
	.on("end", function () {
		console.log("butler end: -");
	})
	// job 1
	.add(asyncSum, 2, 1, 2, 3)
	.chain(asyncDouble)
	// job 2
	.add(asyncSum, 1, 4, 5, 6)
	.chain(asyncDouble)
	.wait(function (err, finalValue) {
		if (err) {
			return console.log("Error: %s", err);
		}
	})
	// job 3
	.add(asyncSum, 3, 2, 2, 2)
	.wait(5000) // 5 secs
	// job 4
	.add(asyncDouble, 5)
	.start();

function asyncDouble(v, cb) {
	setTimeout(function () {
		cb(null, v * 2);
	}, 1e3);
}

function asyncSum() {
	var params = Array.prototype.slice.apply(arguments),
	    delay = params.splice(0, 1).pop(),
	    cb = params.splice(-1, 1).pop();

	setTimeout(function () {
		for (var i = 0, sum = 0; i < params.length; sum += params[i++]);
		cb(null, sum);
	}, delay * 1e3);
}