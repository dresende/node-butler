var util = require("util"),
    events = require("events");

function Butler() {
    events.EventEmitter.call(this);

    this.actions = [];
    this._working = false;
}

util.inherits(Butler, events.EventEmitter);

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
Butler.prototype.wait = function (cb) {
	this.actions.push({
		"wait": cb
	});
	this.resume();

	return this;
};
Butler.prototype.resume = function (params) {
	if (this._working) {
		return;
	}

	this._working = true;

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
		this._working = false;
		if (action.wait.apply(action.wait, [ null, this._next_params, butler ])) {
			console.log("continuing after wait..");
			this.resume(this._next_params);
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
		return console.log("error!");
	}

	this.resume(params.slice(1));
};

exports.Butler = Butler;