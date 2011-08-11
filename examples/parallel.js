var Butler = require("./../lib/butler").Butler,
    Alfred = new Butler();

Alfred
	// this will be done in parallel
	.add(asyncDouble, 2)
	.add(asyncDouble, 4)
	.add(asyncDouble, 6)
	.add(asyncDouble, 8)
	.parallel(function () {
		if (this.errors.length) {
			console.log("%d errors occurred", this.errors.length);
			console.log(this.errors);
			return false;
		}
		console.log(this.returns);
	})
	// this will also be done in parallel (only after the first 4 calls finish)
	.add(asyncDouble, 20)
	.add(asyncDouble, 40)
	.add(asyncDouble, 60)
	.add(asyncDouble, 80)
	.parallel(function () {
		if (this.errors.length) {
			console.log("%d errors occurred", this.errors.length);
			console.log(this.errors);
			return false;
		}
		console.log(this.returns);
	});

function asyncDouble(v, cb) {
	setTimeout(function () {
		cb(null, v * 2);
	}, Math.random() * 2e3);
};