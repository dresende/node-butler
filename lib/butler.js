//
// A couple of dependencies
//
var util = require("util"),
    events = require("events");

//
// **The Butler!**
//
// Initializes actions and defines himself as not working
//
function Butler() {
    events.EventEmitter.call(this);

    this.actions = [];
    this._working = false;
    this._last_wait = 0;
}

//
// Butler inherits from `EventEmitter` (events are planned for the future)
// 
util.inherits(Butler, events.EventEmitter);

//
// Add an asynchronous call to the Butler. The first parameter is
// a call reference and the other parameters are possible arguments
// (if needed). A callback will be appended to the arguments so your
// asynchronous call must have a last parameter which is the return
// **callback that must have an error argument** as first parameter or
// don't have any arguments at all.
//
Butler.prototype.add = function () {
	var params = Array.prototype.slice.apply(arguments);

	if (!params.length || typeof params[0] != "function") {
		throw new Error({ code: 1, message: "Function not specified" });
	}

    this.actions.push({
    	"call": params[0],
    	"args": params.slice(1)
    });

    return this;
};

//
// Add a waiting callback. This immediately start running the previously
// added callbacks one by one. After all run successfull, this callback
// is executed with 3 parameters: an error object (if some callback in
// the middle fails), the return parameters from the final callback and
// a butler object with 2 methods:
//
// - `butler.set(arg1, ...)` sets the parameters to be prepended to the
//   next callback (if any).
// - `butler.resume()` continues execution of the next callback. This is
//   needed if you make an asynchronous action inside the wait callback.
//   To make the Butler wait for it, this wait callback must return a
//   boolean `false` and the `butler.resume()` must be triggered after
//   your asynchronous stuff.
//
Butler.prototype.wait = function (cb) {
	this.actions.push({
		"wait": cb
	});
	this.resume();

	return this;
};

//
// Instructs the butler that the previous calls are to be runned in
// parallel, without arguments passing from one to another.
// The callback is executed at the end of all the asynchronous calls
// with the result of all the callbacks.
//
Butler.prototype.parallel = function (cb) {
	this.actions.push({
		"parallel": cb
	});
	this.resume();

	return this;
};

Butler.prototype.resume = function (params) {
	if (this._working || !this.actions.length) {
		return;
	}

	this._working = true;

	var parallelResume = -1;

	for (var i = 0; i < this.actions.length; i++) {
		if (this.actions[i].hasOwnProperty("call")) continue;
		if (this.actions[i].hasOwnProperty("wait")) break;
		if (this.actions[i].hasOwnProperty("parallel")) {
			parallelResume = i;
			break;
		}
	}

	if (parallelResume == 0) {
		// ???
		return console.log("parallel resume without anything to run in parallel");
	} else if (parallelResume > 0) {
		var actions = this.actions.splice(0, parallelResume + 1),
		    parallelCb = actions.pop(),
		    missingActions = actions.length,
		    actionReturns = [];

		this._last_wait = 0;

		for (var i = 0; i < actions.length; i++) {
			actions[i].args.push(
				(function (butler, n) {
					return function () {
						console.log("action %d finished", n);
						missingActions--;
						actionReturns[n] = Array.prototype.slice.apply(arguments);

						if (missingActions == 0) {
							console.log("parallel done!");
							butler._working = false;

							parallelCb.parallel(actionReturns);
							//butler.resume();
						}
					};
				})(this, i)
			);

			actions[i].call.apply(actions[i].call, actions[i].args);
		}
		return;
	}

	var action = this.actions.splice(0, 1).pop();

	params = params || this._next_params;
	delete this._next_params;

	if (action.hasOwnProperty("call")) {
		if (params && params.length) {
			for (var i = params.length - 1; i >= 0; i--) {
				action.args.unshift(params[i]);
			}
		}
		action.args.push(
			(function (butler) {
				return function () {
					butler._working = false;
					butler._handleReturn(Array.prototype.slice.apply(arguments));
				};
			})(this)
		);

		this._last_wait++;

		action.call.apply(action.call, action.args);
		return;
	}
	if (action.hasOwnProperty("wait")) {
		var butler = (function (butler) {
			return {
				"set": function () {
					butler._next_params = Array.prototype.slice.apply(arguments);
					return this;
				},
				"resume": function () {
					butler.resume();
				}
			};
		})(this);

		this._next_params = params || [];
		this._last_wait = 0;
		this._working = false;

		var ret = action.wait.apply(action.wait, [ null, this._next_params, butler ]);
		if (ret !== false) {
			this.resume(typeof ret == "object" ? ret : this._next_params);
		}
		return;
	}
};
Butler.prototype._handleReturn = function (params) {
	if (!params.length) {
		return this.resume();
	}
	if (params[0]) {
		// error
		for (var i = 0; i < this.actions.length; i++) {
			if (this.actions[i].hasOwnProperty("wait")) {
				var action = this.actions.splice(0, i + 1).pop(),
				    butler = (function (butler) {
					return {
						"set": function () {
							butler._next_params = Array.prototype.slice.apply(arguments);
							return this;
						},
						"resume": function () {
							butler.resume();
						}
					};
				})(this);

				params[0].callbackIndex = this._last_wait;

				this._last_wait = 0;
				this._working = false;

				var ret = action.wait.apply(action.wait, [ params[0], null, butler ]);
				if (ret !== false) {
					this.resume(typeof ret == "object" ? ret : null);
				}
				return;
			}
		}
		return console.log("error without a wait() call to handle!", params[0], this._last_wait);
	}

	this.resume(params.slice(1));
};

exports.Butler = Butler;