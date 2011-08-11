//
// A simple asynchronous chaining butler
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
    this.storage = {};
    this._working = false;
    this._last_wait = 0;
    this._scope = null;
}
util.inherits(Butler, events.EventEmitter);

//
// Before adding a method from an object you must call
// `.scope(object)` so the method is properly called with
// the `this` correctly set. After that, if you want to
// unset the scope for the next calls, just run `.scope()`.
//
Butler.prototype.scope = function (scope) {
	this._scope = scope || null;
	return this;
};
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
    	"call" : params[0],
    	"scope": this._scope,
    	"args" : params.slice(1)
    });

    return this;
};

//
// After an asynchronous call, save return param (on index `paramIndex`)
// on storage (for future use) under the key `key`.
//
Butler.prototype.store = function (key, paramIndex) {
	this.actions.push({
		"store": key,
		"index": paramIndex
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

//
// Returns `true` if an asynchronous call is runing and has
// still not yet invoked the callback. This will always be
// `false` inside the `.wait()` callbacks, unless you invoke
// `.resume()`.
//
Butler.prototype.busy = function (cb) {
	return this._working;
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
		if (this.actions[i].hasOwnProperty("store")) break;
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
		    errors = [],
		    returns = [];

		this._last_wait = 0;

		for (var i = 0; i < actions.length; i++) {
			returns[i] = [];
		}

		for (var i = 0; i < actions.length; i++) {
			var callName = findCallName(actions[i].call);

			actions[i].args.push(
				(function (butler, n, callbackName) {
					return function () {
						missingActions--;
						var params = Array.prototype.slice.apply(arguments);
						if (params.length == 0) {
							returns[n].push(null);
						} else {
							/* 1st argument must always be an error object */
							if (params[0]) {
								params[0].callbackIndex = n + 1;

								errors.push(params[0]);
							}
							returns[n] = params.slice(1) || null;
						}
						butler.emit("call.end", callbackName, params ? params[0] : null, params ? params.slice(1) : []);

						if (missingActions == 0) {
							var ret, ctx = butler._getButlerCallbackObject();

							butler._working = false;

							ctx.errors = errors;
							ctx.returns = returns;

							ret = parallelCb.parallel.apply(ctx);
							if (ret !== false) {
								butler.resume(typeof ret == "object" ? ret : butler._next_params);
							}
						}
					};
				})(this, i, callName)
			);

			this.emit("call.start", callName, actions[i].args.slice(0, -1));
			actions[i].call.apply(actions[i].scope, actions[i].args);
		}
		return;
	}

	var action = this.actions.splice(0, 1).pop();

	params = params || this._next_params;
	delete this._next_params;

	if (action.hasOwnProperty("store")) {
		var index = Math.max(action.index || 0, 0);
		this.storage[action.store] = params && params.length > index ? params[index] : null;
		this._next_params = params;
		this._working = false;
		return this.resume();
	}
	if (action.hasOwnProperty("call")) {
		if (params && params.length) {
			for (var i = params.length - 1; i >= 0; i--) {
				action.args.unshift(params[i]);
			}
		}

		var callName = findCallName(action.call);

		action.args.push(
			(function (butler) {
				return function () {
					var return_params = Array.prototype.slice.apply(arguments);

					butler._working = false;
					butler.emit("call.end", callName, return_params ? return_params[0] : null, return_params ? return_params.slice(1) : []);
					butler._handleReturn(return_params);
				};
			})(this)
		);

		this._last_wait++;

		this.emit("call.start", callName, action.args.slice(0, -1));
		action.call.apply(action.scope, action.args);
		return;
	}
	if (action.hasOwnProperty("wait")) {
		var ctx = this._getButlerCallbackObject();

		this._next_params = params || [];
		this._last_wait = 0;
		this._working = false;

		var ret = action.wait.apply(ctx, [ null, this._next_params ]);
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
				    ctx = this._getButlerCallbackObject();

				params[0].callbackIndex = this._last_wait;

				this._last_wait = 0;
				this._working = false;

				var ret = action.wait.apply(ctx, [ params[0] ]);
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
Butler.prototype._getButlerCallbackObject = function () {
	return (function (butler) {
		return {
			"params": {
				"length": function () {
					return (butler._next_params || []).length;
				},
				"set": function () {
					butler._next_params = Array.prototype.slice.apply(arguments);
					return this;
				},
				"get": function (i) {
					if (typeof i == "number") {
						if (butler._next_params.length) {
							if (i >= 0 && i < butler._next_params.length) {
								return butler._next_params[i];
							}
						}
						return null;
					}
					return butler._next_params || [];
				},
				"first": function () {
					return this.get(0);
				},
				"last": function () {
					return this.get(butler._next_params.length - 1);
				},
				"clear": function () {
					butler._next_params = [];
					return this;
				},
				"append": function () {
					butler._next_params = (butler._next_params || []).concat(Array.prototype.slice.apply(arguments));
					return this;
				},
				"prepend": function () {
					butler._next_params = Array.prototype.slice.apply(arguments).concat(butler._next_params || []);
					return this;
				}
			},
			"storage": butler.storage,
			"resume": function () {
				butler.resume();
			}
		};
	})(this);
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