//
// A simple asynchronous chaining butler
//
var util = require("util"),
    events = require("events");

//
// **The Butler!**
//
// Initializes some stuff like action list and storage object. It
// also defines himself as not working.
//
function Butler() {
    events.EventEmitter.call(this);

    this.tasksPolls = [];
    this.storage = {};
    this.jobs = [];
    this.scope = null;
    this.working = false;
}
util.inherits(Butler, events.EventEmitter);

//
// Before adding a method from an object you must call
// `.scope(object)` so the method is properly called with
// the `this` correctly set. After that, if you want to
// unset the scope for the next calls, just run `.scope()`.
//
Butler.prototype.scope = function (scope) {
	this.scope = scope || null;
	return this;
};
Butler.prototype.add = function () {
	this._addJob("async", Array.prototype.slice.apply(arguments));
	return this;
};
Butler.prototype.store = function () {
	this._addJob("store", Array.prototype.slice.apply(arguments));
	return this;
};
Butler.prototype.chain = function () {
	return this.chainLeft.apply(this, arguments);
};
Butler.prototype.chainLeft = function () {
	this._addJob("chain-left", Array.prototype.slice.apply(arguments));
	return this;
};
Butler.prototype.chainRight = function () {
	this._addJob("chain-left", Array.prototype.slice.apply(arguments));
	return this;
};
Butler.prototype.wait = function () {
	if (arguments.length) {
		switch (typeof arguments[0]) {
			case "function":
				this.tasksPolls[this.tasksPolls.length - 1].push({
					"action"  : "wait",
					"call"    : arguments[0],
					"scope"   : this.scope
				});
				this.tasksPolls.push([]);
				this._resumeJobs();
				return this;
			case "number":
				this.tasksPolls[this.tasksPolls.length - 1].push({
					"action"  : "wait",
					"wait"    : arguments[0]
				});
				this.tasksPolls.push([]);
				this._resumeJobs();
				return this;
		}
	}

	this.tasksPolls[this.tasksPolls.length - 1].push({
		"action"  : "wait",
		"wait"    : 0
	});
	this.tasksPolls.push([]);
	this._resumeJobs();
	return this;
};
Butler.prototype.start = function () {
	this._resumeJobs();
	return this;
};
Butler.prototype._resumeJobs = function (force) {
	if (this.tasksPolls.length == 0) {
		if (!force) this.emit("end");
		return;
	}

	// console.log("Butler._resumeJobs(%s)", force);

	if (!force) {
		for (var i = 0; i < this.jobs.length; i++) {
			if (!this.jobs[i].finished) return;
		}
	}

	var poll = this.tasksPolls.shift(), len = poll.length;

	if (len > 0) {
		var lastIsWait = poll[len - 1].action == "wait";

		/*console.log("Butler: new poll ", poll);*/
		this.jobs.push(new ButlerJob(this, poll));

		if (!lastIsWait) {
			this._resumeJobs(true);
		}
	}
};
Butler.prototype._addJob = function (type, params) {
	switch (type) {
		case "async":
			if (this.tasksPolls.length == 0 || this.tasksPolls[this.tasksPolls.length - 1].length > 0) {
				this.tasksPolls.push([]);
			}
		case "chain-left":
		case "chain-right":
			if (!params.length || typeof params[0] != "function") {
				throw new Error({ code: 1, message: "Function not specified" });
			}
			this.tasksPolls[this.tasksPolls.length - 1].push({
				"action"  : "call",
				"call"    : params[0],
				"scope"   : this.scope,
				"params"  : params.slice(1),
				"type"    : type
			});
			break;
		case "store":
			if (this.tasksPolls.length == 0) return;

			this.tasksPolls[this.tasksPolls.length - 1].push({
				"action"  : "store",
				"key"     : params[0],
				"index"   : params.length > 1 ? params[1] : 0
			});
			break;
	}
};

function ButlerJob(butler, tasks) {
	this.butler = butler;
	this.tasks = tasks;
	this.env = {
		"params": []
	};
	this.finished = false;
	this.run();
}
ButlerJob.prototype.run = function () {
	if (this.tasks.length == 0) return this._pollFinished();

	var task = this.tasks.splice(0, 1).pop(),
	    params = Array.prototype.slice.apply(arguments);

	switch (task.action) {
		case "call":
			var call_params = task.params, call_name = findCallName(task.call);

			switch (task.type) {
				case "chain-left":
					call_params = params.concat(task.params);
					break;
				case "chain-right":
					call_params = task.params.concat(params);
					break;
			}

			call_params.push((function (butler, taskCall, params) {
				return function () {
					var p = Array.prototype.slice.apply(arguments);
					p.splice(0, 0, call_name, params.slice(0, -1));

					butler._taskFinished.apply(butler, p);
				}
			})(this, task.call, call_params));

			this.butler.emit("task-start", call_name, call_params.slice(0, -1));

			task.call.apply(task.scope, call_params);
			break;
		case "store":
			if (task.index >= 0 && task.index < params.length) {
				this.butler.storage[task.key] = params[task.index];
			}
			this.run.apply(this, params);
			break;
		case "wait":
			if (task.hasOwnProperty("wait")) {
				// just wait a few seconds
				setTimeout((function (butlerjob) {
					return function () {
						butlerjob._pollFinished();
					};
				})(this), task.wait);
				return;
			}
			params.unshift(null);
			if (task.call.apply(task.scope, params) !== false) {
				//console.log("finished, calling Butler.resumeJobs()");
				this._pollFinished();
			}
			break;
		default:
			console.log("unknown action", task);
	}
};
ButlerJob.prototype._taskFinished = function () {
	var params = Array.prototype.slice.apply(arguments),
	    callName = params.splice(0, 1).pop(),
	    callParams = params.splice(0, 1).pop();

	this.butler.emit("task-end", callName, callParams, params.length ? params[0] : null, params.length ? params.slice(1) : []);

	if (params.length == 0) return this.run();
	if (!params[0]) return this.run.apply(this, params.slice(1));

	if (this.tasks.length == 0 || this.tasks[this.tasks.length - 1].action != "wait") {
		// emit something!
		console.log("error!", params);
		return;
	}

	var task = this.tasks.pop();
	this.tasks.length = 0;

	task.call.apply(null, [ params[0] ]);

	this._pollFinished();
};
ButlerJob.prototype._pollFinished = function () {
	this.finished = true;
	this.butler.emit("job-end");
	this.butler._resumeJobs();
};

exports.Butler = Butler;

/*
 Utilities
*/
function findCallName(cb) {
	var m = cb.toString().match(/^function\s+([^\s\(]+)/i);

	if (m !== null) return m[1];
	return 'anonymous'; // is it?
}