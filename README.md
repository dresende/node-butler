## Node Butler

This module helps when you need to call several asynchronous calls one after each other.

## Install

    npm install butler

## Example

    var butler = new(require("butler").Butler)();

    butler.add(myAsyncCall, arg1)
          .add(otherAsyncCall, arg1, arg2)
          .wait(function (err, returns, butler) {
              if (err) {
              	  console.log("Some error happened on call %d", err.callbackIndex);
              	  console.log(err);
              	  return false; // this stops the butler from continuing
              }

              // myAsyncCall returned values are prepended to otherAsyncCall
              // arguments. Then the final returned values are in the 
              // returns Array.
          });