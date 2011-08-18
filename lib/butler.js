//
// A "simple" asynchronous chaining butler
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
//
// Add a new async task on a new job poll. This will force
// a new poll creation. You can chain other calls by using
// .chain()
//
Butler.prototype.add = function () {
	this._addJob("async", Array.prototype.slice.apply(arguments));
	return this;
};
//
// Store a return argument from the previous call. The first
// parameter should be a key string and the second should be
// the return argument index (defaults to 0 - the first).
//
Butler.prototype.store = function () {
	this._addJob("store", Array.prototype.slice.apply(arguments));
	return this;
};
//
// Shortcut for .chainLeft()
//
Butler.prototype.chain = function () {
	return this.chainLeft.apply(this, arguments);
};
//
// Chain an async call to be run after the previous added call,
// using the return arguments as the first parameters. You can
// add more after them.
//
Butler.prototype.chainLeft = function () {
	this._addJob("chain-left", Array.prototype.slice.apply(arguments));
	return this;
};
//
// Chain an async call to be run after the previous added call,
// using the return arguments as the last parameters. You can
// add more before them.
//
Butler.prototype.chainRight = function () {
	this._addJob("chain-left", Array.prototype.slice.apply(arguments));
	return this;
};
//
// This triggers the task poll to start. It will wait for the poll
// to end. If you define a number of miliseconds to wait, it will
// wait that before continuing to the next poll. If you define a
// function, it will call that.
//
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
//
// This triggers the task poll to start. You don't usually need this
// unless you don't define a callback/number using .wait() before.
//
Butler.prototype.start = function () {
	this._resumeJobs();
	return this;
};
Butler.prototype._resumeJobs = function (force) {
	if (this.tasksPolls.length == 0) {
		if (!force) this.emit("end");
		return;
	}

	/* console.log("Butler._resumeJobs(%s)", force); */

	if (!force) {
		for (var i = 0; i < this.jobs.length; i++) {
			if (!this.jobs[i].finished) return;
		}
	}

	var poll = this.tasksPolls.shift(), len = poll.length;

	if (len > 0) {
		var lastIsWait = poll[len - 1].action == "wait";

		/* console.log("Butler: new poll ", poll); */
		this.jobs.push(new ButlerJob(this, poll));

		if (!lastIsWait) {
			this._resumeJobs(true);
		}
	}
};
Butler.prototype._addJob = function (type, params) {
	switch (type) {
		case "async":
			var len  =this.tasksPolls.length;
			if (len == 0 || this.tasksPolls[len - 1].length > 0) {
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
				/* just wait a few miliseconds */
				setTimeout((function (butlerjob) {
					return function () {
						butlerjob._pollFinished();
					};
				})(this), task.wait);
				return;
			}
			params.unshift(null);
			if (task.call.apply(task.scope, params) !== false) {
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

	this.butler.emit("task-end", callName, callParams,
	                 params.length ? params[0] : null, params.length ? params.slice(1) : []);

	if (params.length == 0) return this.run();
	if (!params[0]) return this.run.apply(this, params.slice(1));

	if (this.tasks.length == 0 || this.tasks[this.tasks.length - 1].action != "wait") {
		this.butler.emit("error", params);
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