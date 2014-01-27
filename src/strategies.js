/* global DistinctPredicate,ConsecutiveDistinctPredicate,SubscriptionDefinition */
/*jshint -W098 */
var ConsecutiveDistinctPredicate = function () {
    var previous;
    return function ( data ) {
        var eq = false;
        if ( _.isString( data ) ) {
            eq = data === previous;
            previous = data;
        }
        else {
            eq = _.isEqual( data, previous );
            previous = _.clone( data );
        }
        return !eq;
    };
};

var DistinctPredicate = function () {
    var previous = [];
    return function ( data ) {
        var isDistinct = !_.any( previous, function ( p ) {
            if ( _.isObject( data ) || _.isArray( data ) ) {
                return _.isEqual( data, p );
            }
            return data === p;
        } );
        if ( isDistinct ) {
            previous.push( data );
        }
        return isDistinct;
    };
};

var strats = {
    withDelay: function(ms) {
        if ( _.isNaN( ms ) ) {
            throw "Milliseconds must be a number";
        }
        return {
            name: "withDelay",
            fn: function (next, data, envelope) {
                setTimeout(function () {
                    next(data, envelope);
                }, ms);
            }
        };
    },
    defer: function() {
        return this.withDelay(0);
    },
    stopAfter: function(maxCalls, callback) {
        if ( _.isNaN( maxCalls ) || maxCalls <= 0 ) {
            throw "The value provided to disposeAfter (maxCalls) must be a number greater than zero.";
        }
        var dispose = _.after(maxCalls, callback);
        return {
            name: "stopAfter",
            fn: function (next, data, envelope) {
                dispose();
                next(data, envelope);
            }
        };
    },
    withThrottle : function(ms) {
        if ( _.isNaN( ms ) ) {
            throw "Milliseconds must be a number";
        }
        return {
            name: "withThrottle",
            fn: _.throttle(function(next, data, envelope) {
                next(data, envelope);
            }, ms)
        };
    },
    withDebounce: function(ms, immediate) {
        if ( _.isNaN( ms ) ) {
            throw "Milliseconds must be a number";
        }
        return {
            name: "debounce",
            fn: _.debounce(function(next, data, envelope) {
                next(data, envelope);
            }, ms, !!immediate)
        };
    },
    withConstraint: function(pred) {
        if ( !_.isFunction( pred ) ) {
            throw "Predicate constraint must be a function";
        }
        return {
            name: "withConstraint",
            fn: function(next, data, envelope) {
                if(pred.call(this, data, envelope)) {
                    next.call(this, data, envelope);
                }
            }
        };
    },
    distinct : function(options) {
        options = options || {};
        var accessor = function(args) {
            return args[0];
        };
        var check = options.all ?
            new DistinctPredicate(accessor) :
            new ConsecutiveDistinctPredicate(accessor);
        return {
            name : "distinct",
            fn : function(next, data, envelope) {
                if(check(data)) {
                    next(data, envelope);
                }
            }
        };
    }
};

SubscriptionDefinition.prototype.defer = function () {
    this.callback.useStrategy(strats.defer());
    return this;
};

SubscriptionDefinition.prototype.disposeAfter = function ( maxCalls ) {
    var self = this;
    self.callback.useStrategy(strats.stopAfter(maxCalls, function() {
        self.unsubscribe.call(self);
    }));
    return self;
};

SubscriptionDefinition.prototype.distinctUntilChanged = function () {
    this.callback.useStrategy(strats.distinct());
    return this;
};

SubscriptionDefinition.prototype.distinct = function () {
    this.callback.useStrategy(strats.distinct({ all : true }));
    return this;
};

SubscriptionDefinition.prototype.once = function () {
    this.disposeAfter(1);
    return this;
};

SubscriptionDefinition.prototype.withConstraint = function ( predicate ) {
    this.callback.useStrategy(strats.withConstraint(predicate));
    return this;
};

SubscriptionDefinition.prototype.withDebounce = function ( milliseconds, immediate ) {
    this.callback.useStrategy(strats.withDebounce(milliseconds, immediate));
    return this;
};

SubscriptionDefinition.prototype.withDelay = function ( milliseconds ) {
    this.callback.useStrategy(strats.withDelay(milliseconds));
    return this;
};

SubscriptionDefinition.prototype.withThrottle = function ( milliseconds ) {
    this.callback.useStrategy(strats.withThrottle(milliseconds));
    return this;
};