//     Underscore.js 1.8.3
//     http://underscorejs.org
//     (c) 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Underscore may be freely distributed under the MIT license.

(function() {

  // Baseline setup
  // --------------

  // Establish the root object, `window` in the browser, or `exports` on the server.
  var root = this;

  // Save the previous value of the `_` variable.
  var previousUnderscore = root._;

  // Save bytes in the minified (but not gzipped) version:
  var ArrayProto = Array.prototype, ObjProto = Object.prototype, FuncProto = Function.prototype;

  // Create quick reference variables for speed access to core prototypes.
  var
    push             = ArrayProto.push,
    slice            = ArrayProto.slice,
    toString         = ObjProto.toString,
    hasOwnProperty   = ObjProto.hasOwnProperty;

  // All **ECMAScript 5** native function implementations that we hope to use
  // are declared here.
  var
    nativeIsArray      = Array.isArray,
    nativeKeys         = Object.keys,
    nativeBind         = FuncProto.bind,
    nativeCreate       = Object.create;

  // Naked function reference for surrogate-prototype-swapping.
  var Ctor = function(){};

  // Create a safe reference to the Underscore object for use below.
  var _ = function(obj) {
    if (obj instanceof _) return obj;
    if (!(this instanceof _)) return new _(obj);
    this._wrapped = obj;
  };

  // Export the Underscore object for **Node.js**, with
  // backwards-compatibility for the old `require()` API. If we're in
  // the browser, add `_` as a global object.
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = _;
    }
    exports._ = _;
  } else {
    root._ = _;
  }

  // Current version.
  _.VERSION = '1.8.3';

  // Internal function that returns an efficient (for current engines) version
  // of the passed-in callback, to be repeatedly applied in other Underscore
  // functions.
  var optimizeCb = function(func, context, argCount) {
    if (context === void 0) return func;
    switch (argCount == null ? 3 : argCount) {
      case 1: return function(value) {
        return func.call(context, value);
      };
      case 2: return function(value, other) {
        return func.call(context, value, other);
      };
      case 3: return function(value, index, collection) {
        return func.call(context, value, index, collection);
      };
      case 4: return function(accumulator, value, index, collection) {
        return func.call(context, accumulator, value, index, collection);
      };
    }
    return function() {
      return func.apply(context, arguments);
    };
  };

  // A mostly-internal function to generate callbacks that can be applied
  // to each element in a collection, returning the desired result — either
  // identity, an arbitrary callback, a property matcher, or a property accessor.
  var cb = function(value, context, argCount) {
    if (value == null) return _.identity;
    if (_.isFunction(value)) return optimizeCb(value, context, argCount);
    if (_.isObject(value)) return _.matcher(value);
    return _.property(value);
  };
  _.iteratee = function(value, context) {
    return cb(value, context, Infinity);
  };

  // An internal function for creating assigner functions.
  var createAssigner = function(keysFunc, undefinedOnly) {
    return function(obj) {
      var length = arguments.length;
      if (length < 2 || obj == null) return obj;
      for (var index = 1; index < length; index++) {
        var source = arguments[index],
            keys = keysFunc(source),
            l = keys.length;
        for (var i = 0; i < l; i++) {
          var key = keys[i];
          if (!undefinedOnly || obj[key] === void 0) obj[key] = source[key];
        }
      }
      return obj;
    };
  };

  // An internal function for creating a new object that inherits from another.
  var baseCreate = function(prototype) {
    if (!_.isObject(prototype)) return {};
    if (nativeCreate) return nativeCreate(prototype);
    Ctor.prototype = prototype;
    var result = new Ctor;
    Ctor.prototype = null;
    return result;
  };

  var property = function(key) {
    return function(obj) {
      return obj == null ? void 0 : obj[key];
    };
  };

  // Helper for collection methods to determine whether a collection
  // should be iterated as an array or as an object
  // Related: http://people.mozilla.org/~jorendorff/es6-draft.html#sec-tolength
  // Avoids a very nasty iOS 8 JIT bug on ARM-64. #2094
  var MAX_ARRAY_INDEX = Math.pow(2, 53) - 1;
  var getLength = property('length');
  var isArrayLike = function(collection) {
    var length = getLength(collection);
    return typeof length == 'number' && length >= 0 && length <= MAX_ARRAY_INDEX;
  };

  // Collection Functions
  // --------------------

  // The cornerstone, an `each` implementation, aka `forEach`.
  // Handles raw objects in addition to array-likes. Treats all
  // sparse array-likes as if they were dense.
  _.each = _.forEach = function(obj, iteratee, context) {
    iteratee = optimizeCb(iteratee, context);
    var i, length;
    if (isArrayLike(obj)) {
      for (i = 0, length = obj.length; i < length; i++) {
        iteratee(obj[i], i, obj);
      }
    } else {
      var keys = _.keys(obj);
      for (i = 0, length = keys.length; i < length; i++) {
        iteratee(obj[keys[i]], keys[i], obj);
      }
    }
    return obj;
  };

  // Return the results of applying the iteratee to each element.
  _.map = _.collect = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length,
        results = Array(length);
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      results[index] = iteratee(obj[currentKey], currentKey, obj);
    }
    return results;
  };

  // Create a reducing function iterating left or right.
  function createReduce(dir) {
    // Optimized iterator function as using arguments.length
    // in the main function will deoptimize the, see #1991.
    function iterator(obj, iteratee, memo, keys, index, length) {
      for (; index >= 0 && index < length; index += dir) {
        var currentKey = keys ? keys[index] : index;
        memo = iteratee(memo, obj[currentKey], currentKey, obj);
      }
      return memo;
    }

    return function(obj, iteratee, memo, context) {
      iteratee = optimizeCb(iteratee, context, 4);
      var keys = !isArrayLike(obj) && _.keys(obj),
          length = (keys || obj).length,
          index = dir > 0 ? 0 : length - 1;
      // Determine the initial value if none is provided.
      if (arguments.length < 3) {
        memo = obj[keys ? keys[index] : index];
        index += dir;
      }
      return iterator(obj, iteratee, memo, keys, index, length);
    };
  }

  // **Reduce** builds up a single result from a list of values, aka `inject`,
  // or `foldl`.
  _.reduce = _.foldl = _.inject = createReduce(1);

  // The right-associative version of reduce, also known as `foldr`.
  _.reduceRight = _.foldr = createReduce(-1);

  // Return the first value which passes a truth test. Aliased as `detect`.
  _.find = _.detect = function(obj, predicate, context) {
    var key;
    if (isArrayLike(obj)) {
      key = _.findIndex(obj, predicate, context);
    } else {
      key = _.findKey(obj, predicate, context);
    }
    if (key !== void 0 && key !== -1) return obj[key];
  };

  // Return all the elements that pass a truth test.
  // Aliased as `select`.
  _.filter = _.select = function(obj, predicate, context) {
    var results = [];
    predicate = cb(predicate, context);
    _.each(obj, function(value, index, list) {
      if (predicate(value, index, list)) results.push(value);
    });
    return results;
  };

  // Return all the elements for which a truth test fails.
  _.reject = function(obj, predicate, context) {
    return _.filter(obj, _.negate(cb(predicate)), context);
  };

  // Determine whether all of the elements match a truth test.
  // Aliased as `all`.
  _.every = _.all = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length;
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      if (!predicate(obj[currentKey], currentKey, obj)) return false;
    }
    return true;
  };

  // Determine if at least one element in the object matches a truth test.
  // Aliased as `any`.
  _.some = _.any = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length;
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      if (predicate(obj[currentKey], currentKey, obj)) return true;
    }
    return false;
  };

  // Determine if the array or object contains a given item (using `===`).
  // Aliased as `includes` and `include`.
  _.contains = _.includes = _.include = function(obj, item, fromIndex, guard) {
    if (!isArrayLike(obj)) obj = _.values(obj);
    if (typeof fromIndex != 'number' || guard) fromIndex = 0;
    return _.indexOf(obj, item, fromIndex) >= 0;
  };

  // Invoke a method (with arguments) on every item in a collection.
  _.invoke = function(obj, method) {
    var args = slice.call(arguments, 2);
    var isFunc = _.isFunction(method);
    return _.map(obj, function(value) {
      var func = isFunc ? method : value[method];
      return func == null ? func : func.apply(value, args);
    });
  };

  // Convenience version of a common use case of `map`: fetching a property.
  _.pluck = function(obj, key) {
    return _.map(obj, _.property(key));
  };

  // Convenience version of a common use case of `filter`: selecting only objects
  // containing specific `key:value` pairs.
  _.where = function(obj, attrs) {
    return _.filter(obj, _.matcher(attrs));
  };

  // Convenience version of a common use case of `find`: getting the first object
  // containing specific `key:value` pairs.
  _.findWhere = function(obj, attrs) {
    return _.find(obj, _.matcher(attrs));
  };

  // Return the maximum element (or element-based computation).
  _.max = function(obj, iteratee, context) {
    var result = -Infinity, lastComputed = -Infinity,
        value, computed;
    if (iteratee == null && obj != null) {
      obj = isArrayLike(obj) ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value > result) {
          result = value;
        }
      }
    } else {
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index, list) {
        computed = iteratee(value, index, list);
        if (computed > lastComputed || computed === -Infinity && result === -Infinity) {
          result = value;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Return the minimum element (or element-based computation).
  _.min = function(obj, iteratee, context) {
    var result = Infinity, lastComputed = Infinity,
        value, computed;
    if (iteratee == null && obj != null) {
      obj = isArrayLike(obj) ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value < result) {
          result = value;
        }
      }
    } else {
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index, list) {
        computed = iteratee(value, index, list);
        if (computed < lastComputed || computed === Infinity && result === Infinity) {
          result = value;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Shuffle a collection, using the modern version of the
  // [Fisher-Yates shuffle](http://en.wikipedia.org/wiki/Fisher–Yates_shuffle).
  _.shuffle = function(obj) {
    var set = isArrayLike(obj) ? obj : _.values(obj);
    var length = set.length;
    var shuffled = Array(length);
    for (var index = 0, rand; index < length; index++) {
      rand = _.random(0, index);
      if (rand !== index) shuffled[index] = shuffled[rand];
      shuffled[rand] = set[index];
    }
    return shuffled;
  };

  // Sample **n** random values from a collection.
  // If **n** is not specified, returns a single random element.
  // The internal `guard` argument allows it to work with `map`.
  _.sample = function(obj, n, guard) {
    if (n == null || guard) {
      if (!isArrayLike(obj)) obj = _.values(obj);
      return obj[_.random(obj.length - 1)];
    }
    return _.shuffle(obj).slice(0, Math.max(0, n));
  };

  // Sort the object's values by a criterion produced by an iteratee.
  _.sortBy = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    return _.pluck(_.map(obj, function(value, index, list) {
      return {
        value: value,
        index: index,
        criteria: iteratee(value, index, list)
      };
    }).sort(function(left, right) {
      var a = left.criteria;
      var b = right.criteria;
      if (a !== b) {
        if (a > b || a === void 0) return 1;
        if (a < b || b === void 0) return -1;
      }
      return left.index - right.index;
    }), 'value');
  };

  // An internal function used for aggregate "group by" operations.
  var group = function(behavior) {
    return function(obj, iteratee, context) {
      var result = {};
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index) {
        var key = iteratee(value, index, obj);
        behavior(result, value, key);
      });
      return result;
    };
  };

  // Groups the object's values by a criterion. Pass either a string attribute
  // to group by, or a function that returns the criterion.
  _.groupBy = group(function(result, value, key) {
    if (_.has(result, key)) result[key].push(value); else result[key] = [value];
  });

  // Indexes the object's values by a criterion, similar to `groupBy`, but for
  // when you know that your index values will be unique.
  _.indexBy = group(function(result, value, key) {
    result[key] = value;
  });

  // Counts instances of an object that group by a certain criterion. Pass
  // either a string attribute to count by, or a function that returns the
  // criterion.
  _.countBy = group(function(result, value, key) {
    if (_.has(result, key)) result[key]++; else result[key] = 1;
  });

  // Safely create a real, live array from anything iterable.
  _.toArray = function(obj) {
    if (!obj) return [];
    if (_.isArray(obj)) return slice.call(obj);
    if (isArrayLike(obj)) return _.map(obj, _.identity);
    return _.values(obj);
  };

  // Return the number of elements in an object.
  _.size = function(obj) {
    if (obj == null) return 0;
    return isArrayLike(obj) ? obj.length : _.keys(obj).length;
  };

  // Split a collection into two arrays: one whose elements all satisfy the given
  // predicate, and one whose elements all do not satisfy the predicate.
  _.partition = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var pass = [], fail = [];
    _.each(obj, function(value, key, obj) {
      (predicate(value, key, obj) ? pass : fail).push(value);
    });
    return [pass, fail];
  };

  // Array Functions
  // ---------------

  // Get the first element of an array. Passing **n** will return the first N
  // values in the array. Aliased as `head` and `take`. The **guard** check
  // allows it to work with `_.map`.
  _.first = _.head = _.take = function(array, n, guard) {
    if (array == null) return void 0;
    if (n == null || guard) return array[0];
    return _.initial(array, array.length - n);
  };

  // Returns everything but the last entry of the array. Especially useful on
  // the arguments object. Passing **n** will return all the values in
  // the array, excluding the last N.
  _.initial = function(array, n, guard) {
    return slice.call(array, 0, Math.max(0, array.length - (n == null || guard ? 1 : n)));
  };

  // Get the last element of an array. Passing **n** will return the last N
  // values in the array.
  _.last = function(array, n, guard) {
    if (array == null) return void 0;
    if (n == null || guard) return array[array.length - 1];
    return _.rest(array, Math.max(0, array.length - n));
  };

  // Returns everything but the first entry of the array. Aliased as `tail` and `drop`.
  // Especially useful on the arguments object. Passing an **n** will return
  // the rest N values in the array.
  _.rest = _.tail = _.drop = function(array, n, guard) {
    return slice.call(array, n == null || guard ? 1 : n);
  };

  // Trim out all falsy values from an array.
  _.compact = function(array) {
    return _.filter(array, _.identity);
  };

  // Internal implementation of a recursive `flatten` function.
  var flatten = function(input, shallow, strict, startIndex) {
    var output = [], idx = 0;
    for (var i = startIndex || 0, length = getLength(input); i < length; i++) {
      var value = input[i];
      if (isArrayLike(value) && (_.isArray(value) || _.isArguments(value))) {
        //flatten current level of array or arguments object
        if (!shallow) value = flatten(value, shallow, strict);
        var j = 0, len = value.length;
        output.length += len;
        while (j < len) {
          output[idx++] = value[j++];
        }
      } else if (!strict) {
        output[idx++] = value;
      }
    }
    return output;
  };

  // Flatten out an array, either recursively (by default), or just one level.
  _.flatten = function(array, shallow) {
    return flatten(array, shallow, false);
  };

  // Return a version of the array that does not contain the specified value(s).
  _.without = function(array) {
    return _.difference(array, slice.call(arguments, 1));
  };

  // Produce a duplicate-free version of the array. If the array has already
  // been sorted, you have the option of using a faster algorithm.
  // Aliased as `unique`.
  _.uniq = _.unique = function(array, isSorted, iteratee, context) {
    if (!_.isBoolean(isSorted)) {
      context = iteratee;
      iteratee = isSorted;
      isSorted = false;
    }
    if (iteratee != null) iteratee = cb(iteratee, context);
    var result = [];
    var seen = [];
    for (var i = 0, length = getLength(array); i < length; i++) {
      var value = array[i],
          computed = iteratee ? iteratee(value, i, array) : value;
      if (isSorted) {
        if (!i || seen !== computed) result.push(value);
        seen = computed;
      } else if (iteratee) {
        if (!_.contains(seen, computed)) {
          seen.push(computed);
          result.push(value);
        }
      } else if (!_.contains(result, value)) {
        result.push(value);
      }
    }
    return result;
  };

  // Produce an array that contains the union: each distinct element from all of
  // the passed-in arrays.
  _.union = function() {
    return _.uniq(flatten(arguments, true, true));
  };

  // Produce an array that contains every item shared between all the
  // passed-in arrays.
  _.intersection = function(array) {
    var result = [];
    var argsLength = arguments.length;
    for (var i = 0, length = getLength(array); i < length; i++) {
      var item = array[i];
      if (_.contains(result, item)) continue;
      for (var j = 1; j < argsLength; j++) {
        if (!_.contains(arguments[j], item)) break;
      }
      if (j === argsLength) result.push(item);
    }
    return result;
  };

  // Take the difference between one array and a number of other arrays.
  // Only the elements present in just the first array will remain.
  _.difference = function(array) {
    var rest = flatten(arguments, true, true, 1);
    return _.filter(array, function(value){
      return !_.contains(rest, value);
    });
  };

  // Zip together multiple lists into a single array -- elements that share
  // an index go together.
  _.zip = function() {
    return _.unzip(arguments);
  };

  // Complement of _.zip. Unzip accepts an array of arrays and groups
  // each array's elements on shared indices
  _.unzip = function(array) {
    var length = array && _.max(array, getLength).length || 0;
    var result = Array(length);

    for (var index = 0; index < length; index++) {
      result[index] = _.pluck(array, index);
    }
    return result;
  };

  // Converts lists into objects. Pass either a single array of `[key, value]`
  // pairs, or two parallel arrays of the same length -- one of keys, and one of
  // the corresponding values.
  _.object = function(list, values) {
    var result = {};
    for (var i = 0, length = getLength(list); i < length; i++) {
      if (values) {
        result[list[i]] = values[i];
      } else {
        result[list[i][0]] = list[i][1];
      }
    }
    return result;
  };

  // Generator function to create the findIndex and findLastIndex functions
  function createPredicateIndexFinder(dir) {
    return function(array, predicate, context) {
      predicate = cb(predicate, context);
      var length = getLength(array);
      var index = dir > 0 ? 0 : length - 1;
      for (; index >= 0 && index < length; index += dir) {
        if (predicate(array[index], index, array)) return index;
      }
      return -1;
    };
  }

  // Returns the first index on an array-like that passes a predicate test
  _.findIndex = createPredicateIndexFinder(1);
  _.findLastIndex = createPredicateIndexFinder(-1);

  // Use a comparator function to figure out the smallest index at which
  // an object should be inserted so as to maintain order. Uses binary search.
  _.sortedIndex = function(array, obj, iteratee, context) {
    iteratee = cb(iteratee, context, 1);
    var value = iteratee(obj);
    var low = 0, high = getLength(array);
    while (low < high) {
      var mid = Math.floor((low + high) / 2);
      if (iteratee(array[mid]) < value) low = mid + 1; else high = mid;
    }
    return low;
  };

  // Generator function to create the indexOf and lastIndexOf functions
  function createIndexFinder(dir, predicateFind, sortedIndex) {
    return function(array, item, idx) {
      var i = 0, length = getLength(array);
      if (typeof idx == 'number') {
        if (dir > 0) {
            i = idx >= 0 ? idx : Math.max(idx + length, i);
        } else {
            length = idx >= 0 ? Math.min(idx + 1, length) : idx + length + 1;
        }
      } else if (sortedIndex && idx && length) {
        idx = sortedIndex(array, item);
        return array[idx] === item ? idx : -1;
      }
      if (item !== item) {
        idx = predicateFind(slice.call(array, i, length), _.isNaN);
        return idx >= 0 ? idx + i : -1;
      }
      for (idx = dir > 0 ? i : length - 1; idx >= 0 && idx < length; idx += dir) {
        if (array[idx] === item) return idx;
      }
      return -1;
    };
  }

  // Return the position of the first occurrence of an item in an array,
  // or -1 if the item is not included in the array.
  // If the array is large and already in sort order, pass `true`
  // for **isSorted** to use binary search.
  _.indexOf = createIndexFinder(1, _.findIndex, _.sortedIndex);
  _.lastIndexOf = createIndexFinder(-1, _.findLastIndex);

  // Generate an integer Array containing an arithmetic progression. A port of
  // the native Python `range()` function. See
  // [the Python documentation](http://docs.python.org/library/functions.html#range).
  _.range = function(start, stop, step) {
    if (stop == null) {
      stop = start || 0;
      start = 0;
    }
    step = step || 1;

    var length = Math.max(Math.ceil((stop - start) / step), 0);
    var range = Array(length);

    for (var idx = 0; idx < length; idx++, start += step) {
      range[idx] = start;
    }

    return range;
  };

  // Function (ahem) Functions
  // ------------------

  // Determines whether to execute a function as a constructor
  // or a normal function with the provided arguments
  var executeBound = function(sourceFunc, boundFunc, context, callingContext, args) {
    if (!(callingContext instanceof boundFunc)) return sourceFunc.apply(context, args);
    var self = baseCreate(sourceFunc.prototype);
    var result = sourceFunc.apply(self, args);
    if (_.isObject(result)) return result;
    return self;
  };

  // Create a function bound to a given object (assigning `this`, and arguments,
  // optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
  // available.
  _.bind = function(func, context) {
    if (nativeBind && func.bind === nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));
    if (!_.isFunction(func)) throw new TypeError('Bind must be called on a function');
    var args = slice.call(arguments, 2);
    var bound = function() {
      return executeBound(func, bound, context, this, args.concat(slice.call(arguments)));
    };
    return bound;
  };

  // Partially apply a function by creating a version that has had some of its
  // arguments pre-filled, without changing its dynamic `this` context. _ acts
  // as a placeholder, allowing any combination of arguments to be pre-filled.
  _.partial = function(func) {
    var boundArgs = slice.call(arguments, 1);
    var bound = function() {
      var position = 0, length = boundArgs.length;
      var args = Array(length);
      for (var i = 0; i < length; i++) {
        args[i] = boundArgs[i] === _ ? arguments[position++] : boundArgs[i];
      }
      while (position < arguments.length) args.push(arguments[position++]);
      return executeBound(func, bound, this, this, args);
    };
    return bound;
  };

  // Bind a number of an object's methods to that object. Remaining arguments
  // are the method names to be bound. Useful for ensuring that all callbacks
  // defined on an object belong to it.
  _.bindAll = function(obj) {
    var i, length = arguments.length, key;
    if (length <= 1) throw new Error('bindAll must be passed function names');
    for (i = 1; i < length; i++) {
      key = arguments[i];
      obj[key] = _.bind(obj[key], obj);
    }
    return obj;
  };

  // Memoize an expensive function by storing its results.
  _.memoize = function(func, hasher) {
    var memoize = function(key) {
      var cache = memoize.cache;
      var address = '' + (hasher ? hasher.apply(this, arguments) : key);
      if (!_.has(cache, address)) cache[address] = func.apply(this, arguments);
      return cache[address];
    };
    memoize.cache = {};
    return memoize;
  };

  // Delays a function for the given number of milliseconds, and then calls
  // it with the arguments supplied.
  _.delay = function(func, wait) {
    var args = slice.call(arguments, 2);
    return setTimeout(function(){
      return func.apply(null, args);
    }, wait);
  };

  // Defers a function, scheduling it to run after the current call stack has
  // cleared.
  _.defer = _.partial(_.delay, _, 1);

  // Returns a function, that, when invoked, will only be triggered at most once
  // during a given window of time. Normally, the throttled function will run
  // as much as it can, without ever going more than once per `wait` duration;
  // but if you'd like to disable the execution on the leading edge, pass
  // `{leading: false}`. To disable execution on the trailing edge, ditto.
  _.throttle = function(func, wait, options) {
    var context, args, result;
    var timeout = null;
    var previous = 0;
    if (!options) options = {};
    var later = function() {
      previous = options.leading === false ? 0 : _.now();
      timeout = null;
      result = func.apply(context, args);
      if (!timeout) context = args = null;
    };
    return function() {
      var now = _.now();
      if (!previous && options.leading === false) previous = now;
      var remaining = wait - (now - previous);
      context = this;
      args = arguments;
      if (remaining <= 0 || remaining > wait) {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        previous = now;
        result = func.apply(context, args);
        if (!timeout) context = args = null;
      } else if (!timeout && options.trailing !== false) {
        timeout = setTimeout(later, remaining);
      }
      return result;
    };
  };

  // Returns a function, that, as long as it continues to be invoked, will not
  // be triggered. The function will be called after it stops being called for
  // N milliseconds. If `immediate` is passed, trigger the function on the
  // leading edge, instead of the trailing.
  _.debounce = function(func, wait, immediate) {
    var timeout, args, context, timestamp, result;

    var later = function() {
      var last = _.now() - timestamp;

      if (last < wait && last >= 0) {
        timeout = setTimeout(later, wait - last);
      } else {
        timeout = null;
        if (!immediate) {
          result = func.apply(context, args);
          if (!timeout) context = args = null;
        }
      }
    };

    return function() {
      context = this;
      args = arguments;
      timestamp = _.now();
      var callNow = immediate && !timeout;
      if (!timeout) timeout = setTimeout(later, wait);
      if (callNow) {
        result = func.apply(context, args);
        context = args = null;
      }

      return result;
    };
  };

  // Returns the first function passed as an argument to the second,
  // allowing you to adjust arguments, run code before and after, and
  // conditionally execute the original function.
  _.wrap = function(func, wrapper) {
    return _.partial(wrapper, func);
  };

  // Returns a negated version of the passed-in predicate.
  _.negate = function(predicate) {
    return function() {
      return !predicate.apply(this, arguments);
    };
  };

  // Returns a function that is the composition of a list of functions, each
  // consuming the return value of the function that follows.
  _.compose = function() {
    var args = arguments;
    var start = args.length - 1;
    return function() {
      var i = start;
      var result = args[start].apply(this, arguments);
      while (i--) result = args[i].call(this, result);
      return result;
    };
  };

  // Returns a function that will only be executed on and after the Nth call.
  _.after = function(times, func) {
    return function() {
      if (--times < 1) {
        return func.apply(this, arguments);
      }
    };
  };

  // Returns a function that will only be executed up to (but not including) the Nth call.
  _.before = function(times, func) {
    var memo;
    return function() {
      if (--times > 0) {
        memo = func.apply(this, arguments);
      }
      if (times <= 1) func = null;
      return memo;
    };
  };

  // Returns a function that will be executed at most one time, no matter how
  // often you call it. Useful for lazy initialization.
  _.once = _.partial(_.before, 2);

  // Object Functions
  // ----------------

  // Keys in IE < 9 that won't be iterated by `for key in ...` and thus missed.
  var hasEnumBug = !{toString: null}.propertyIsEnumerable('toString');
  var nonEnumerableProps = ['valueOf', 'isPrototypeOf', 'toString',
                      'propertyIsEnumerable', 'hasOwnProperty', 'toLocaleString'];

  function collectNonEnumProps(obj, keys) {
    var nonEnumIdx = nonEnumerableProps.length;
    var constructor = obj.constructor;
    var proto = (_.isFunction(constructor) && constructor.prototype) || ObjProto;

    // Constructor is a special case.
    var prop = 'constructor';
    if (_.has(obj, prop) && !_.contains(keys, prop)) keys.push(prop);

    while (nonEnumIdx--) {
      prop = nonEnumerableProps[nonEnumIdx];
      if (prop in obj && obj[prop] !== proto[prop] && !_.contains(keys, prop)) {
        keys.push(prop);
      }
    }
  }

  // Retrieve the names of an object's own properties.
  // Delegates to **ECMAScript 5**'s native `Object.keys`
  _.keys = function(obj) {
    if (!_.isObject(obj)) return [];
    if (nativeKeys) return nativeKeys(obj);
    var keys = [];
    for (var key in obj) if (_.has(obj, key)) keys.push(key);
    // Ahem, IE < 9.
    if (hasEnumBug) collectNonEnumProps(obj, keys);
    return keys;
  };

  // Retrieve all the property names of an object.
  _.allKeys = function(obj) {
    if (!_.isObject(obj)) return [];
    var keys = [];
    for (var key in obj) keys.push(key);
    // Ahem, IE < 9.
    if (hasEnumBug) collectNonEnumProps(obj, keys);
    return keys;
  };

  // Retrieve the values of an object's properties.
  _.values = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var values = Array(length);
    for (var i = 0; i < length; i++) {
      values[i] = obj[keys[i]];
    }
    return values;
  };

  // Returns the results of applying the iteratee to each element of the object
  // In contrast to _.map it returns an object
  _.mapObject = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    var keys =  _.keys(obj),
          length = keys.length,
          results = {},
          currentKey;
      for (var index = 0; index < length; index++) {
        currentKey = keys[index];
        results[currentKey] = iteratee(obj[currentKey], currentKey, obj);
      }
      return results;
  };

  // Convert an object into a list of `[key, value]` pairs.
  _.pairs = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var pairs = Array(length);
    for (var i = 0; i < length; i++) {
      pairs[i] = [keys[i], obj[keys[i]]];
    }
    return pairs;
  };

  // Invert the keys and values of an object. The values must be serializable.
  _.invert = function(obj) {
    var result = {};
    var keys = _.keys(obj);
    for (var i = 0, length = keys.length; i < length; i++) {
      result[obj[keys[i]]] = keys[i];
    }
    return result;
  };

  // Return a sorted list of the function names available on the object.
  // Aliased as `methods`
  _.functions = _.methods = function(obj) {
    var names = [];
    for (var key in obj) {
      if (_.isFunction(obj[key])) names.push(key);
    }
    return names.sort();
  };

  // Extend a given object with all the properties in passed-in object(s).
  _.extend = createAssigner(_.allKeys);

  // Assigns a given object with all the own properties in the passed-in object(s)
  // (https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/assign)
  _.extendOwn = _.assign = createAssigner(_.keys);

  // Returns the first key on an object that passes a predicate test
  _.findKey = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = _.keys(obj), key;
    for (var i = 0, length = keys.length; i < length; i++) {
      key = keys[i];
      if (predicate(obj[key], key, obj)) return key;
    }
  };

  // Return a copy of the object only containing the whitelisted properties.
  _.pick = function(object, oiteratee, context) {
    var result = {}, obj = object, iteratee, keys;
    if (obj == null) return result;
    if (_.isFunction(oiteratee)) {
      keys = _.allKeys(obj);
      iteratee = optimizeCb(oiteratee, context);
    } else {
      keys = flatten(arguments, false, false, 1);
      iteratee = function(value, key, obj) { return key in obj; };
      obj = Object(obj);
    }
    for (var i = 0, length = keys.length; i < length; i++) {
      var key = keys[i];
      var value = obj[key];
      if (iteratee(value, key, obj)) result[key] = value;
    }
    return result;
  };

   // Return a copy of the object without the blacklisted properties.
  _.omit = function(obj, iteratee, context) {
    if (_.isFunction(iteratee)) {
      iteratee = _.negate(iteratee);
    } else {
      var keys = _.map(flatten(arguments, false, false, 1), String);
      iteratee = function(value, key) {
        return !_.contains(keys, key);
      };
    }
    return _.pick(obj, iteratee, context);
  };

  // Fill in a given object with default properties.
  _.defaults = createAssigner(_.allKeys, true);

  // Creates an object that inherits from the given prototype object.
  // If additional properties are provided then they will be added to the
  // created object.
  _.create = function(prototype, props) {
    var result = baseCreate(prototype);
    if (props) _.extendOwn(result, props);
    return result;
  };

  // Create a (shallow-cloned) duplicate of an object.
  _.clone = function(obj) {
    if (!_.isObject(obj)) return obj;
    return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
  };

  // Invokes interceptor with the obj, and then returns obj.
  // The primary purpose of this method is to "tap into" a method chain, in
  // order to perform operations on intermediate results within the chain.
  _.tap = function(obj, interceptor) {
    interceptor(obj);
    return obj;
  };

  // Returns whether an object has a given set of `key:value` pairs.
  _.isMatch = function(object, attrs) {
    var keys = _.keys(attrs), length = keys.length;
    if (object == null) return !length;
    var obj = Object(object);
    for (var i = 0; i < length; i++) {
      var key = keys[i];
      if (attrs[key] !== obj[key] || !(key in obj)) return false;
    }
    return true;
  };


  // Internal recursive comparison function for `isEqual`.
  var eq = function(a, b, aStack, bStack) {
    // Identical objects are equal. `0 === -0`, but they aren't identical.
    // See the [Harmony `egal` proposal](http://wiki.ecmascript.org/doku.php?id=harmony:egal).
    if (a === b) return a !== 0 || 1 / a === 1 / b;
    // A strict comparison is necessary because `null == undefined`.
    if (a == null || b == null) return a === b;
    // Unwrap any wrapped objects.
    if (a instanceof _) a = a._wrapped;
    if (b instanceof _) b = b._wrapped;
    // Compare `[[Class]]` names.
    var className = toString.call(a);
    if (className !== toString.call(b)) return false;
    switch (className) {
      // Strings, numbers, regular expressions, dates, and booleans are compared by value.
      case '[object RegExp]':
      // RegExps are coerced to strings for comparison (Note: '' + /a/i === '/a/i')
      case '[object String]':
        // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
        // equivalent to `new String("5")`.
        return '' + a === '' + b;
      case '[object Number]':
        // `NaN`s are equivalent, but non-reflexive.
        // Object(NaN) is equivalent to NaN
        if (+a !== +a) return +b !== +b;
        // An `egal` comparison is performed for other numeric values.
        return +a === 0 ? 1 / +a === 1 / b : +a === +b;
      case '[object Date]':
      case '[object Boolean]':
        // Coerce dates and booleans to numeric primitive values. Dates are compared by their
        // millisecond representations. Note that invalid dates with millisecond representations
        // of `NaN` are not equivalent.
        return +a === +b;
    }

    var areArrays = className === '[object Array]';
    if (!areArrays) {
      if (typeof a != 'object' || typeof b != 'object') return false;

      // Objects with different constructors are not equivalent, but `Object`s or `Array`s
      // from different frames are.
      var aCtor = a.constructor, bCtor = b.constructor;
      if (aCtor !== bCtor && !(_.isFunction(aCtor) && aCtor instanceof aCtor &&
                               _.isFunction(bCtor) && bCtor instanceof bCtor)
                          && ('constructor' in a && 'constructor' in b)) {
        return false;
      }
    }
    // Assume equality for cyclic structures. The algorithm for detecting cyclic
    // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.

    // Initializing stack of traversed objects.
    // It's done here since we only need them for objects and arrays comparison.
    aStack = aStack || [];
    bStack = bStack || [];
    var length = aStack.length;
    while (length--) {
      // Linear search. Performance is inversely proportional to the number of
      // unique nested structures.
      if (aStack[length] === a) return bStack[length] === b;
    }

    // Add the first object to the stack of traversed objects.
    aStack.push(a);
    bStack.push(b);

    // Recursively compare objects and arrays.
    if (areArrays) {
      // Compare array lengths to determine if a deep comparison is necessary.
      length = a.length;
      if (length !== b.length) return false;
      // Deep compare the contents, ignoring non-numeric properties.
      while (length--) {
        if (!eq(a[length], b[length], aStack, bStack)) return false;
      }
    } else {
      // Deep compare objects.
      var keys = _.keys(a), key;
      length = keys.length;
      // Ensure that both objects contain the same number of properties before comparing deep equality.
      if (_.keys(b).length !== length) return false;
      while (length--) {
        // Deep compare each member
        key = keys[length];
        if (!(_.has(b, key) && eq(a[key], b[key], aStack, bStack))) return false;
      }
    }
    // Remove the first object from the stack of traversed objects.
    aStack.pop();
    bStack.pop();
    return true;
  };

  // Perform a deep comparison to check if two objects are equal.
  _.isEqual = function(a, b) {
    return eq(a, b);
  };

  // Is a given array, string, or object empty?
  // An "empty" object has no enumerable own-properties.
  _.isEmpty = function(obj) {
    if (obj == null) return true;
    if (isArrayLike(obj) && (_.isArray(obj) || _.isString(obj) || _.isArguments(obj))) return obj.length === 0;
    return _.keys(obj).length === 0;
  };

  // Is a given value a DOM element?
  _.isElement = function(obj) {
    return !!(obj && obj.nodeType === 1);
  };

  // Is a given value an array?
  // Delegates to ECMA5's native Array.isArray
  _.isArray = nativeIsArray || function(obj) {
    return toString.call(obj) === '[object Array]';
  };

  // Is a given variable an object?
  _.isObject = function(obj) {
    var type = typeof obj;
    return type === 'function' || type === 'object' && !!obj;
  };

  // Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp, isError.
  _.each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp', 'Error'], function(name) {
    _['is' + name] = function(obj) {
      return toString.call(obj) === '[object ' + name + ']';
    };
  });

  // Define a fallback version of the method in browsers (ahem, IE < 9), where
  // there isn't any inspectable "Arguments" type.
  if (!_.isArguments(arguments)) {
    _.isArguments = function(obj) {
      return _.has(obj, 'callee');
    };
  }

  // Optimize `isFunction` if appropriate. Work around some typeof bugs in old v8,
  // IE 11 (#1621), and in Safari 8 (#1929).
  if (typeof /./ != 'function' && typeof Int8Array != 'object') {
    _.isFunction = function(obj) {
      return typeof obj == 'function' || false;
    };
  }

  // Is a given object a finite number?
  _.isFinite = function(obj) {
    return isFinite(obj) && !isNaN(parseFloat(obj));
  };

  // Is the given value `NaN`? (NaN is the only number which does not equal itself).
  _.isNaN = function(obj) {
    return _.isNumber(obj) && obj !== +obj;
  };

  // Is a given value a boolean?
  _.isBoolean = function(obj) {
    return obj === true || obj === false || toString.call(obj) === '[object Boolean]';
  };

  // Is a given value equal to null?
  _.isNull = function(obj) {
    return obj === null;
  };

  // Is a given variable undefined?
  _.isUndefined = function(obj) {
    return obj === void 0;
  };

  // Shortcut function for checking if an object has a given property directly
  // on itself (in other words, not on a prototype).
  _.has = function(obj, key) {
    return obj != null && hasOwnProperty.call(obj, key);
  };

  // Utility Functions
  // -----------------

  // Run Underscore.js in *noConflict* mode, returning the `_` variable to its
  // previous owner. Returns a reference to the Underscore object.
  _.noConflict = function() {
    root._ = previousUnderscore;
    return this;
  };

  // Keep the identity function around for default iteratees.
  _.identity = function(value) {
    return value;
  };

  // Predicate-generating functions. Often useful outside of Underscore.
  _.constant = function(value) {
    return function() {
      return value;
    };
  };

  _.noop = function(){};

  _.property = property;

  // Generates a function for a given object that returns a given property.
  _.propertyOf = function(obj) {
    return obj == null ? function(){} : function(key) {
      return obj[key];
    };
  };

  // Returns a predicate for checking whether an object has a given set of
  // `key:value` pairs.
  _.matcher = _.matches = function(attrs) {
    attrs = _.extendOwn({}, attrs);
    return function(obj) {
      return _.isMatch(obj, attrs);
    };
  };

  // Run a function **n** times.
  _.times = function(n, iteratee, context) {
    var accum = Array(Math.max(0, n));
    iteratee = optimizeCb(iteratee, context, 1);
    for (var i = 0; i < n; i++) accum[i] = iteratee(i);
    return accum;
  };

  // Return a random integer between min and max (inclusive).
  _.random = function(min, max) {
    if (max == null) {
      max = min;
      min = 0;
    }
    return min + Math.floor(Math.random() * (max - min + 1));
  };

  // A (possibly faster) way to get the current timestamp as an integer.
  _.now = Date.now || function() {
    return new Date().getTime();
  };

   // List of HTML entities for escaping.
  var escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '`': '&#x60;'
  };
  var unescapeMap = _.invert(escapeMap);

  // Functions for escaping and unescaping strings to/from HTML interpolation.
  var createEscaper = function(map) {
    var escaper = function(match) {
      return map[match];
    };
    // Regexes for identifying a key that needs to be escaped
    var source = '(?:' + _.keys(map).join('|') + ')';
    var testRegexp = RegExp(source);
    var replaceRegexp = RegExp(source, 'g');
    return function(string) {
      string = string == null ? '' : '' + string;
      return testRegexp.test(string) ? string.replace(replaceRegexp, escaper) : string;
    };
  };
  _.escape = createEscaper(escapeMap);
  _.unescape = createEscaper(unescapeMap);

  // If the value of the named `property` is a function then invoke it with the
  // `object` as context; otherwise, return it.
  _.result = function(object, property, fallback) {
    var value = object == null ? void 0 : object[property];
    if (value === void 0) {
      value = fallback;
    }
    return _.isFunction(value) ? value.call(object) : value;
  };

  // Generate a unique integer id (unique within the entire client session).
  // Useful for temporary DOM ids.
  var idCounter = 0;
  _.uniqueId = function(prefix) {
    var id = ++idCounter + '';
    return prefix ? prefix + id : id;
  };

  // By default, Underscore uses ERB-style template delimiters, change the
  // following template settings to use alternative delimiters.
  _.templateSettings = {
    evaluate    : /<%([\s\S]+?)%>/g,
    interpolate : /<%=([\s\S]+?)%>/g,
    escape      : /<%-([\s\S]+?)%>/g
  };

  // When customizing `templateSettings`, if you don't want to define an
  // interpolation, evaluation or escaping regex, we need one that is
  // guaranteed not to match.
  var noMatch = /(.)^/;

  // Certain characters need to be escaped so that they can be put into a
  // string literal.
  var escapes = {
    "'":      "'",
    '\\':     '\\',
    '\r':     'r',
    '\n':     'n',
    '\u2028': 'u2028',
    '\u2029': 'u2029'
  };

  var escaper = /\\|'|\r|\n|\u2028|\u2029/g;

  var escapeChar = function(match) {
    return '\\' + escapes[match];
  };

  // JavaScript micro-templating, similar to John Resig's implementation.
  // Underscore templating handles arbitrary delimiters, preserves whitespace,
  // and correctly escapes quotes within interpolated code.
  // NB: `oldSettings` only exists for backwards compatibility.
  _.template = function(text, settings, oldSettings) {
    if (!settings && oldSettings) settings = oldSettings;
    settings = _.defaults({}, settings, _.templateSettings);

    // Combine delimiters into one regular expression via alternation.
    var matcher = RegExp([
      (settings.escape || noMatch).source,
      (settings.interpolate || noMatch).source,
      (settings.evaluate || noMatch).source
    ].join('|') + '|$', 'g');

    // Compile the template source, escaping string literals appropriately.
    var index = 0;
    var source = "__p+='";
    text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
      source += text.slice(index, offset).replace(escaper, escapeChar);
      index = offset + match.length;

      if (escape) {
        source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
      } else if (interpolate) {
        source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
      } else if (evaluate) {
        source += "';\n" + evaluate + "\n__p+='";
      }

      // Adobe VMs need the match returned to produce the correct offest.
      return match;
    });
    source += "';\n";

    // If a variable is not specified, place data values in local scope.
    if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';

    source = "var __t,__p='',__j=Array.prototype.join," +
      "print=function(){__p+=__j.call(arguments,'');};\n" +
      source + 'return __p;\n';

    try {
      var render = new Function(settings.variable || 'obj', '_', source);
    } catch (e) {
      e.source = source;
      throw e;
    }

    var template = function(data) {
      return render.call(this, data, _);
    };

    // Provide the compiled source as a convenience for precompilation.
    var argument = settings.variable || 'obj';
    template.source = 'function(' + argument + '){\n' + source + '}';

    return template;
  };

  // Add a "chain" function. Start chaining a wrapped Underscore object.
  _.chain = function(obj) {
    var instance = _(obj);
    instance._chain = true;
    return instance;
  };

  // OOP
  // ---------------
  // If Underscore is called as a function, it returns a wrapped object that
  // can be used OO-style. This wrapper holds altered versions of all the
  // underscore functions. Wrapped objects may be chained.

  // Helper function to continue chaining intermediate results.
  var result = function(instance, obj) {
    return instance._chain ? _(obj).chain() : obj;
  };

  // Add your own custom functions to the Underscore object.
  _.mixin = function(obj) {
    _.each(_.functions(obj), function(name) {
      var func = _[name] = obj[name];
      _.prototype[name] = function() {
        var args = [this._wrapped];
        push.apply(args, arguments);
        return result(this, func.apply(_, args));
      };
    });
  };

  // Add all of the Underscore functions to the wrapper object.
  _.mixin(_);

  // Add all mutator Array functions to the wrapper.
  _.each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      var obj = this._wrapped;
      method.apply(obj, arguments);
      if ((name === 'shift' || name === 'splice') && obj.length === 0) delete obj[0];
      return result(this, obj);
    };
  });

  // Add all accessor Array functions to the wrapper.
  _.each(['concat', 'join', 'slice'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      return result(this, method.apply(this._wrapped, arguments));
    };
  });

  // Extracts the result from a wrapped and chained object.
  _.prototype.value = function() {
    return this._wrapped;
  };

  // Provide unwrapping proxy for some methods used in engine operations
  // such as arithmetic and JSON stringification.
  _.prototype.valueOf = _.prototype.toJSON = _.prototype.value;

  _.prototype.toString = function() {
    return '' + this._wrapped;
  };

  // AMD registration happens at the end for compatibility with AMD loaders
  // that may not enforce next-turn semantics on modules. Even though general
  // practice for AMD registration is to be anonymous, underscore registers
  // as a named module because, like jQuery, it is a base library that is
  // popular enough to be bundled in a third party lib, but not be part of
  // an AMD load request. Those cases could generate an error when an
  // anonymous define() is called outside of a loader request.
  if (typeof define === 'function' && define.amd) {
    define('underscore', [], function() {
      return _;
    });
  }
}.call(this));
// http://paulirish.com/2011/requestanimationframe-for-smart-animating/
// http://my.opera.com/emoller/blog/2011/12/20/requestanimationframe-for-smart-er-animating

// requestAnimationFrame polyfill by Erik Möller. fixes from Paul Irish and Tino Zijdel

// MIT license

(function() {
    var lastTime = 0;
    var vendors = ['ms', 'moz', 'webkit', 'o'];
    for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
        window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
        window.cancelAnimationFrame = window[vendors[x]+'CancelAnimationFrame']
                                   || window[vendors[x]+'CancelRequestAnimationFrame'];
    }

    if (!window.requestAnimationFrame)
        window.requestAnimationFrame = function(callback, element) {
            var currTime = new Date().getTime();
            var timeToCall = Math.max(0, 16 - (currTime - lastTime));
            var id = window.setTimeout(function() { callback(currTime + timeToCall); },
              timeToCall);
            lastTime = currTime + timeToCall;
            return id;
        };

    if (!window.cancelAnimationFrame)
        window.cancelAnimationFrame = function(id) {
            clearTimeout(id);
        };
}());
//     Backbone.js 1.2.1

//     (c) 2010-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Backbone may be freely distributed under the MIT license.
//     For all details and documentation:
//     http://backbonejs.org

(function(factory) {

  // Establish the root object, `window` (`self`) in the browser, or `global` on the server.
  // We use `self` instead of `window` for `WebWorker` support.
  var root = (typeof self == 'object' && self.self == self && self) ||
            (typeof global == 'object' && global.global == global && global);

  // Set up Backbone appropriately for the environment. Start with AMD.
  if (typeof define === 'function' && define.amd) {
    define(['underscore', 'jquery', 'exports'], function(_, $, exports) {
      // Export global even in AMD case in case this script is loaded with
      // others that may still expect a global Backbone.
      root.Backbone = factory(root, exports, _, $);
    });

  // Next for Node.js or CommonJS. jQuery may not be needed as a module.
  } else if (typeof exports !== 'undefined') {
    var _ = require('underscore'), $;
    try { $ = require('jquery'); } catch(e) {}
    factory(root, exports, _, $);

  // Finally, as a browser global.
  } else {
    root.Backbone = factory(root, {}, root._, (root.jQuery || root.Zepto || root.ender || root.$));
  }

}(function(root, Backbone, _, $) {

  // Initial Setup
  // -------------

  // Save the previous value of the `Backbone` variable, so that it can be
  // restored later on, if `noConflict` is used.
  var previousBackbone = root.Backbone;

  // Create a local reference to a common array method we'll want to use later.
  var slice = [].slice;

  // Current version of the library. Keep in sync with `package.json`.
  Backbone.VERSION = '1.2.1';

  // For Backbone's purposes, jQuery, Zepto, Ender, or My Library (kidding) owns
  // the `$` variable.
  Backbone.$ = $;

  // Runs Backbone.js in *noConflict* mode, returning the `Backbone` variable
  // to its previous owner. Returns a reference to this Backbone object.
  Backbone.noConflict = function() {
    root.Backbone = previousBackbone;
    return this;
  };

  // Turn on `emulateHTTP` to support legacy HTTP servers. Setting this option
  // will fake `"PATCH"`, `"PUT"` and `"DELETE"` requests via the `_method` parameter and
  // set a `X-Http-Method-Override` header.
  Backbone.emulateHTTP = false;

  // Turn on `emulateJSON` to support legacy servers that can't deal with direct
  // `application/json` requests ... this will encode the body as
  // `application/x-www-form-urlencoded` instead and will send the model in a
  // form param named `model`.
  Backbone.emulateJSON = false;

  // Proxy Underscore methods to a Backbone class' prototype using a
  // particular attribute as the data argument
  var addMethod = function(length, method, attribute) {
    switch (length) {
      case 1: return function() {
        return _[method](this[attribute]);
      };
      case 2: return function(value) {
        return _[method](this[attribute], value);
      };
      case 3: return function(iteratee, context) {
        return _[method](this[attribute], iteratee, context);
      };
      case 4: return function(iteratee, defaultVal, context) {
        return _[method](this[attribute], iteratee, defaultVal, context);
      };
      default: return function() {
        var args = slice.call(arguments);
        args.unshift(this[attribute]);
        return _[method].apply(_, args);
      };
    }
  };
  var addUnderscoreMethods = function(Class, methods, attribute) {
    _.each(methods, function(length, method) {
      if (_[method]) Class.prototype[method] = addMethod(length, method, attribute);
    });
  };

  // Backbone.Events
  // ---------------

  // A module that can be mixed in to *any object* in order to provide it with
  // custom events. You may bind with `on` or remove with `off` callback
  // functions to an event; `trigger`-ing an event fires all callbacks in
  // succession.
  //
  //     var object = {};
  //     _.extend(object, Backbone.Events);
  //     object.on('expand', function(){ alert('expanded'); });
  //     object.trigger('expand');
  //
  var Events = Backbone.Events = {};

  // Regular expression used to split event strings.
  var eventSplitter = /\s+/;

  // Iterates over the standard `event, callback` (as well as the fancy multiple
  // space-separated events `"change blur", callback` and jQuery-style event
  // maps `{event: callback}`), reducing them by manipulating `memo`.
  // Passes a normalized single event name and callback, as well as any
  // optional `opts`.
  var eventsApi = function(iteratee, memo, name, callback, opts) {
    var i = 0, names;
    if (name && typeof name === 'object') {
      // Handle event maps.
      if (callback !== void 0 && 'context' in opts && opts.context === void 0) opts.context = callback;
      for (names = _.keys(name); i < names.length ; i++) {
        memo = iteratee(memo, names[i], name[names[i]], opts);
      }
    } else if (name && eventSplitter.test(name)) {
      // Handle space separated event names.
      for (names = name.split(eventSplitter); i < names.length; i++) {
        memo = iteratee(memo, names[i], callback, opts);
      }
    } else {
      memo = iteratee(memo, name, callback, opts);
    }
    return memo;
  };

  // Bind an event to a `callback` function. Passing `"all"` will bind
  // the callback to all events fired.
  Events.on = function(name, callback, context) {
    return internalOn(this, name, callback, context);
  };

  // An internal use `on` function, used to guard the `listening` argument from
  // the public API.
  var internalOn = function(obj, name, callback, context, listening) {
    obj._events = eventsApi(onApi, obj._events || {}, name, callback, {
        context: context,
        ctx: obj,
        listening: listening
    });

    if (listening) {
      var listeners = obj._listeners || (obj._listeners = {});
      listeners[listening.id] = listening;
    }

    return obj;
  };

  // Inversion-of-control versions of `on`. Tell *this* object to listen to
  // an event in another object... keeping track of what it's listening to.
  Events.listenTo =  function(obj, name, callback) {
    if (!obj) return this;
    var id = obj._listenId || (obj._listenId = _.uniqueId('l'));
    var listeningTo = this._listeningTo || (this._listeningTo = {});
    var listening = listeningTo[id];

    // This object is not listening to any other events on `obj` yet.
    // Setup the necessary references to track the listening callbacks.
    if (!listening) {
      var thisId = this._listenId || (this._listenId = _.uniqueId('l'));
      listening = listeningTo[id] = {obj: obj, objId: id, id: thisId, listeningTo: listeningTo, count: 0};
    }

    // Bind callbacks on obj, and keep track of them on listening.
    internalOn(obj, name, callback, this, listening);
    return this;
  };

  // The reducing API that adds a callback to the `events` object.
  var onApi = function(events, name, callback, options) {
    if (callback) {
      var handlers = events[name] || (events[name] = []);
      var context = options.context, ctx = options.ctx, listening = options.listening;
      if (listening) listening.count++;

      handlers.push({ callback: callback, context: context, ctx: context || ctx, listening: listening });
    }
    return events;
  };

  // Remove one or many callbacks. If `context` is null, removes all
  // callbacks with that function. If `callback` is null, removes all
  // callbacks for the event. If `name` is null, removes all bound
  // callbacks for all events.
  Events.off =  function(name, callback, context) {
    if (!this._events) return this;
    this._events = eventsApi(offApi, this._events, name, callback, {
        context: context,
        listeners: this._listeners
    });
    return this;
  };

  // Tell this object to stop listening to either specific events ... or
  // to every object it's currently listening to.
  Events.stopListening =  function(obj, name, callback) {
    var listeningTo = this._listeningTo;
    if (!listeningTo) return this;

    var ids = obj ? [obj._listenId] : _.keys(listeningTo);

    for (var i = 0; i < ids.length; i++) {
      var listening = listeningTo[ids[i]];

      // If listening doesn't exist, this object is not currently
      // listening to obj. Break out early.
      if (!listening) break;

      listening.obj.off(name, callback, this);
    }
    if (_.isEmpty(listeningTo)) this._listeningTo = void 0;

    return this;
  };

  // The reducing API that removes a callback from the `events` object.
  var offApi = function(events, name, callback, options) {
    // No events to consider.
    if (!events) return;

    var i = 0, listening;
    var context = options.context, listeners = options.listeners;

    // Delete all events listeners and "drop" events.
    if (!name && !callback && !context) {
      var ids = _.keys(listeners);
      for (; i < ids.length; i++) {
        listening = listeners[ids[i]];
        delete listeners[listening.id];
        delete listening.listeningTo[listening.objId];
      }
      return;
    }

    var names = name ? [name] : _.keys(events);
    for (; i < names.length; i++) {
      name = names[i];
      var handlers = events[name];

      // Bail out if there are no events stored.
      if (!handlers) break;

      // Replace events if there are any remaining.  Otherwise, clean up.
      var remaining = [];
      for (var j = 0; j < handlers.length; j++) {
        var handler = handlers[j];
        if (
          callback && callback !== handler.callback &&
            callback !== handler.callback._callback ||
              context && context !== handler.context
        ) {
          remaining.push(handler);
        } else {
          listening = handler.listening;
          if (listening && --listening.count === 0) {
            delete listeners[listening.id];
            delete listening.listeningTo[listening.objId];
          }
        }
      }

      // Update tail event if the list has any events.  Otherwise, clean up.
      if (remaining.length) {
        events[name] = remaining;
      } else {
        delete events[name];
      }
    }
    if (_.size(events)) return events;
  };

  // Bind an event to only be triggered a single time. After the first time
  // the callback is invoked, it will be removed. When multiple events are
  // passed in using the space-separated syntax, the event will fire once for every
  // event you passed in, not once for a combination of all events
  Events.once =  function(name, callback, context) {
    // Map the event into a `{event: once}` object.
    var events = eventsApi(onceMap, {}, name, callback, _.bind(this.off, this));
    return this.on(events, void 0, context);
  };

  // Inversion-of-control versions of `once`.
  Events.listenToOnce =  function(obj, name, callback) {
    // Map the event into a `{event: once}` object.
    var events = eventsApi(onceMap, {}, name, callback, _.bind(this.stopListening, this, obj));
    return this.listenTo(obj, events);
  };

  // Reduces the event callbacks into a map of `{event: onceWrapper}`.
  // `offer` unbinds the `onceWrapper` after it has been called.
  var onceMap = function(map, name, callback, offer) {
    if (callback) {
      var once = map[name] = _.once(function() {
        offer(name, once);
        callback.apply(this, arguments);
      });
      once._callback = callback;
    }
    return map;
  };

  // Trigger one or many events, firing all bound callbacks. Callbacks are
  // passed the same arguments as `trigger` is, apart from the event name
  // (unless you're listening on `"all"`, which will cause your callback to
  // receive the true name of the event as the first argument).
  Events.trigger =  function(name) {
    if (!this._events) return this;

    var length = Math.max(0, arguments.length - 1);
    var args = Array(length);
    for (var i = 0; i < length; i++) args[i] = arguments[i + 1];

    eventsApi(triggerApi, this._events, name, void 0, args);
    return this;
  };

  // Handles triggering the appropriate event callbacks.
  var triggerApi = function(objEvents, name, cb, args) {
    if (objEvents) {
      var events = objEvents[name];
      var allEvents = objEvents.all;
      if (events && allEvents) allEvents = allEvents.slice();
      if (events) triggerEvents(events, args);
      if (allEvents) triggerEvents(allEvents, [name].concat(args));
    }
    return objEvents;
  };

  // A difficult-to-believe, but optimized internal dispatch function for
  // triggering events. Tries to keep the usual cases speedy (most internal
  // Backbone events have 3 arguments).
  var triggerEvents = function(events, args) {
    var ev, i = -1, l = events.length, a1 = args[0], a2 = args[1], a3 = args[2];
    switch (args.length) {
      case 0: while (++i < l) (ev = events[i]).callback.call(ev.ctx); return;
      case 1: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1); return;
      case 2: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2); return;
      case 3: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2, a3); return;
      default: while (++i < l) (ev = events[i]).callback.apply(ev.ctx, args); return;
    }
  };

  // Aliases for backwards compatibility.
  Events.bind   = Events.on;
  Events.unbind = Events.off;

  // Allow the `Backbone` object to serve as a global event bus, for folks who
  // want global "pubsub" in a convenient place.
  _.extend(Backbone, Events);

  // Backbone.Model
  // --------------

  // Backbone **Models** are the basic data object in the framework --
  // frequently representing a row in a table in a database on your server.
  // A discrete chunk of data and a bunch of useful, related methods for
  // performing computations and transformations on that data.

  // Create a new model with the specified attributes. A client id (`cid`)
  // is automatically generated and assigned for you.
  var Model = Backbone.Model = function(attributes, options) {
    var attrs = attributes || {};
    options || (options = {});
    this.cid = _.uniqueId(this.cidPrefix);
    this.attributes = {};
    if (options.collection) this.collection = options.collection;
    if (options.parse) attrs = this.parse(attrs, options) || {};
    attrs = _.defaults({}, attrs, _.result(this, 'defaults'));
    this.set(attrs, options);
    this.changed = {};
    this.initialize.apply(this, arguments);
  };

  // Attach all inheritable methods to the Model prototype.
  _.extend(Model.prototype, Events, {

    // A hash of attributes whose current and previous value differ.
    changed: null,

    // The value returned during the last failed validation.
    validationError: null,

    // The default name for the JSON `id` attribute is `"id"`. MongoDB and
    // CouchDB users may want to set this to `"_id"`.
    idAttribute: 'id',

    // The prefix is used to create the client id which is used to identify models locally.
    // You may want to override this if you're experiencing name clashes with model ids.
    cidPrefix: 'c',

    // Initialize is an empty function by default. Override it with your own
    // initialization logic.
    initialize: function(){},

    // Return a copy of the model's `attributes` object.
    toJSON: function(options) {
      return _.clone(this.attributes);
    },

    // Proxy `Backbone.sync` by default -- but override this if you need
    // custom syncing semantics for *this* particular model.
    sync: function() {
      return Backbone.sync.apply(this, arguments);
    },

    // Get the value of an attribute.
    get: function(attr) {
      return this.attributes[attr];
    },

    // Get the HTML-escaped value of an attribute.
    escape: function(attr) {
      return _.escape(this.get(attr));
    },

    // Returns `true` if the attribute contains a value that is not null
    // or undefined.
    has: function(attr) {
      return this.get(attr) != null;
    },

    // Special-cased proxy to underscore's `_.matches` method.
    matches: function(attrs) {
      return !!_.iteratee(attrs, this)(this.attributes);
    },

    // Set a hash of model attributes on the object, firing `"change"`. This is
    // the core primitive operation of a model, updating the data and notifying
    // anyone who needs to know about the change in state. The heart of the beast.
    set: function(key, val, options) {
      if (key == null) return this;

      // Handle both `"key", value` and `{key: value}` -style arguments.
      var attrs;
      if (typeof key === 'object') {
        attrs = key;
        options = val;
      } else {
        (attrs = {})[key] = val;
      }

      options || (options = {});

      // Run validation.
      if (!this._validate(attrs, options)) return false;

      // Extract attributes and options.
      var unset      = options.unset;
      var silent     = options.silent;
      var changes    = [];
      var changing   = this._changing;
      this._changing = true;

      if (!changing) {
        this._previousAttributes = _.clone(this.attributes);
        this.changed = {};
      }

      var current = this.attributes;
      var changed = this.changed;
      var prev    = this._previousAttributes;

      // Check for changes of `id`.
      if (this.idAttribute in attrs) this.id = attrs[this.idAttribute];

      // For each `set` attribute, update or delete the current value.
      for (var attr in attrs) {
        val = attrs[attr];
        if (!_.isEqual(current[attr], val)) changes.push(attr);
        if (!_.isEqual(prev[attr], val)) {
          changed[attr] = val;
        } else {
          delete changed[attr];
        }
        unset ? delete current[attr] : current[attr] = val;
      }

      // Trigger all relevant attribute changes.
      if (!silent) {
        if (changes.length) this._pending = options;
        for (var i = 0; i < changes.length; i++) {
          this.trigger('change:' + changes[i], this, current[changes[i]], options);
        }
      }

      // You might be wondering why there's a `while` loop here. Changes can
      // be recursively nested within `"change"` events.
      if (changing) return this;
      if (!silent) {
        while (this._pending) {
          options = this._pending;
          this._pending = false;
          this.trigger('change', this, options);
        }
      }
      this._pending = false;
      this._changing = false;
      return this;
    },

    // Remove an attribute from the model, firing `"change"`. `unset` is a noop
    // if the attribute doesn't exist.
    unset: function(attr, options) {
      return this.set(attr, void 0, _.extend({}, options, {unset: true}));
    },

    // Clear all attributes on the model, firing `"change"`.
    clear: function(options) {
      var attrs = {};
      for (var key in this.attributes) attrs[key] = void 0;
      return this.set(attrs, _.extend({}, options, {unset: true}));
    },

    // Determine if the model has changed since the last `"change"` event.
    // If you specify an attribute name, determine if that attribute has changed.
    hasChanged: function(attr) {
      if (attr == null) return !_.isEmpty(this.changed);
      return _.has(this.changed, attr);
    },

    // Return an object containing all the attributes that have changed, or
    // false if there are no changed attributes. Useful for determining what
    // parts of a view need to be updated and/or what attributes need to be
    // persisted to the server. Unset attributes will be set to undefined.
    // You can also pass an attributes object to diff against the model,
    // determining if there *would be* a change.
    changedAttributes: function(diff) {
      if (!diff) return this.hasChanged() ? _.clone(this.changed) : false;
      var old = this._changing ? this._previousAttributes : this.attributes;
      var changed = {};
      for (var attr in diff) {
        var val = diff[attr];
        if (_.isEqual(old[attr], val)) continue;
        changed[attr] = val;
      }
      return _.size(changed) ? changed : false;
    },

    // Get the previous value of an attribute, recorded at the time the last
    // `"change"` event was fired.
    previous: function(attr) {
      if (attr == null || !this._previousAttributes) return null;
      return this._previousAttributes[attr];
    },

    // Get all of the attributes of the model at the time of the previous
    // `"change"` event.
    previousAttributes: function() {
      return _.clone(this._previousAttributes);
    },

    // Fetch the model from the server, merging the response with the model's
    // local attributes. Any changed attributes will trigger a "change" event.
    fetch: function(options) {
      options = _.extend({parse: true}, options);
      var model = this;
      var success = options.success;
      options.success = function(resp) {
        var serverAttrs = options.parse ? model.parse(resp, options) : resp;
        if (!model.set(serverAttrs, options)) return false;
        if (success) success.call(options.context, model, resp, options);
        model.trigger('sync', model, resp, options);
      };
      wrapError(this, options);
      return this.sync('read', this, options);
    },

    // Set a hash of model attributes, and sync the model to the server.
    // If the server returns an attributes hash that differs, the model's
    // state will be `set` again.
    save: function(key, val, options) {
      // Handle both `"key", value` and `{key: value}` -style arguments.
      var attrs;
      if (key == null || typeof key === 'object') {
        attrs = key;
        options = val;
      } else {
        (attrs = {})[key] = val;
      }

      options = _.extend({validate: true, parse: true}, options);
      var wait = options.wait;

      // If we're not waiting and attributes exist, save acts as
      // `set(attr).save(null, opts)` with validation. Otherwise, check if
      // the model will be valid when the attributes, if any, are set.
      if (attrs && !wait) {
        if (!this.set(attrs, options)) return false;
      } else {
        if (!this._validate(attrs, options)) return false;
      }

      // After a successful server-side save, the client is (optionally)
      // updated with the server-side state.
      var model = this;
      var success = options.success;
      var attributes = this.attributes;
      options.success = function(resp) {
        // Ensure attributes are restored during synchronous saves.
        model.attributes = attributes;
        var serverAttrs = options.parse ? model.parse(resp, options) : resp;
        if (wait) serverAttrs = _.extend({}, attrs, serverAttrs);
        if (serverAttrs && !model.set(serverAttrs, options)) return false;
        if (success) success.call(options.context, model, resp, options);
        model.trigger('sync', model, resp, options);
      };
      wrapError(this, options);

      // Set temporary attributes if `{wait: true}` to properly find new ids.
      if (attrs && wait) this.attributes = _.extend({}, attributes, attrs);

      var method = this.isNew() ? 'create' : (options.patch ? 'patch' : 'update');
      if (method === 'patch' && !options.attrs) options.attrs = attrs;
      var xhr = this.sync(method, this, options);

      // Restore attributes.
      this.attributes = attributes;

      return xhr;
    },

    // Destroy this model on the server if it was already persisted.
    // Optimistically removes the model from its collection, if it has one.
    // If `wait: true` is passed, waits for the server to respond before removal.
    destroy: function(options) {
      options = options ? _.clone(options) : {};
      var model = this;
      var success = options.success;
      var wait = options.wait;

      var destroy = function() {
        model.stopListening();
        model.trigger('destroy', model, model.collection, options);
      };

      options.success = function(resp) {
        if (wait) destroy();
        if (success) success.call(options.context, model, resp, options);
        if (!model.isNew()) model.trigger('sync', model, resp, options);
      };

      var xhr = false;
      if (this.isNew()) {
        _.defer(options.success);
      } else {
        wrapError(this, options);
        xhr = this.sync('delete', this, options);
      }
      if (!wait) destroy();
      return xhr;
    },

    // Default URL for the model's representation on the server -- if you're
    // using Backbone's restful methods, override this to change the endpoint
    // that will be called.
    url: function() {
      var base =
        _.result(this, 'urlRoot') ||
        _.result(this.collection, 'url') ||
        urlError();
      if (this.isNew()) return base;
      var id = this.get(this.idAttribute);
      return base.replace(/[^\/]$/, '$&/') + encodeURIComponent(id);
    },

    // **parse** converts a response into the hash of attributes to be `set` on
    // the model. The default implementation is just to pass the response along.
    parse: function(resp, options) {
      return resp;
    },

    // Create a new model with identical attributes to this one.
    clone: function() {
      return new this.constructor(this.attributes);
    },

    // A model is new if it has never been saved to the server, and lacks an id.
    isNew: function() {
      return !this.has(this.idAttribute);
    },

    // Check if the model is currently in a valid state.
    isValid: function(options) {
      return this._validate({}, _.defaults({validate: true}, options));
    },

    // Run validation against the next complete set of model attributes,
    // returning `true` if all is well. Otherwise, fire an `"invalid"` event.
    _validate: function(attrs, options) {
      if (!options.validate || !this.validate) return true;
      attrs = _.extend({}, this.attributes, attrs);
      var error = this.validationError = this.validate(attrs, options) || null;
      if (!error) return true;
      this.trigger('invalid', this, error, _.extend(options, {validationError: error}));
      return false;
    }

  });

  // Underscore methods that we want to implement on the Model.
  var modelMethods = { keys: 1, values: 1, pairs: 1, invert: 1, pick: 0,
      omit: 0, chain: 1, isEmpty: 1 };

  // Mix in each Underscore method as a proxy to `Model#attributes`.
  addUnderscoreMethods(Model, modelMethods, 'attributes');

  // Backbone.Collection
  // -------------------

  // If models tend to represent a single row of data, a Backbone Collection is
  // more analogous to a table full of data ... or a small slice or page of that
  // table, or a collection of rows that belong together for a particular reason
  // -- all of the messages in this particular folder, all of the documents
  // belonging to this particular author, and so on. Collections maintain
  // indexes of their models, both in order, and for lookup by `id`.

  // Create a new **Collection**, perhaps to contain a specific type of `model`.
  // If a `comparator` is specified, the Collection will maintain
  // its models in sort order, as they're added and removed.
  var Collection = Backbone.Collection = function(models, options) {
    options || (options = {});
    if (options.model) this.model = options.model;
    if (options.comparator !== void 0) this.comparator = options.comparator;
    this._reset();
    this.initialize.apply(this, arguments);
    if (models) this.reset(models, _.extend({silent: true}, options));
  };

  // Default options for `Collection#set`.
  var setOptions = {add: true, remove: true, merge: true};
  var addOptions = {add: true, remove: false};

  // Define the Collection's inheritable methods.
  _.extend(Collection.prototype, Events, {

    // The default model for a collection is just a **Backbone.Model**.
    // This should be overridden in most cases.
    model: Model,

    // Initialize is an empty function by default. Override it with your own
    // initialization logic.
    initialize: function(){},

    // The JSON representation of a Collection is an array of the
    // models' attributes.
    toJSON: function(options) {
      return this.map(function(model) { return model.toJSON(options); });
    },

    // Proxy `Backbone.sync` by default.
    sync: function() {
      return Backbone.sync.apply(this, arguments);
    },

    // Add a model, or list of models to the set.
    add: function(models, options) {
      return this.set(models, _.extend({merge: false}, options, addOptions));
    },

    // Remove a model, or a list of models from the set.
    remove: function(models, options) {
      options = _.extend({}, options);
      var singular = !_.isArray(models);
      models = singular ? [models] : _.clone(models);
      var removed = this._removeModels(models, options);
      if (!options.silent && removed) this.trigger('update', this, options);
      return singular ? removed[0] : removed;
    },

    // Update a collection by `set`-ing a new list of models, adding new ones,
    // removing models that are no longer present, and merging models that
    // already exist in the collection, as necessary. Similar to **Model#set**,
    // the core operation for updating the data contained by the collection.
    set: function(models, options) {
      options = _.defaults({}, options, setOptions);
      if (options.parse && !this._isModel(models)) models = this.parse(models, options);
      var singular = !_.isArray(models);
      models = singular ? (models ? [models] : []) : models.slice();
      var id, model, attrs, existing, sort;
      var at = options.at;
      if (at != null) at = +at;
      if (at < 0) at += this.length + 1;
      var sortable = this.comparator && (at == null) && options.sort !== false;
      var sortAttr = _.isString(this.comparator) ? this.comparator : null;
      var toAdd = [], toRemove = [], modelMap = {};
      var add = options.add, merge = options.merge, remove = options.remove;
      var order = !sortable && add && remove ? [] : false;
      var orderChanged = false;

      // Turn bare objects into model references, and prevent invalid models
      // from being added.
      for (var i = 0; i < models.length; i++) {
        attrs = models[i];

        // If a duplicate is found, prevent it from being added and
        // optionally merge it into the existing model.
        if (existing = this.get(attrs)) {
          if (remove) modelMap[existing.cid] = true;
          if (merge && attrs !== existing) {
            attrs = this._isModel(attrs) ? attrs.attributes : attrs;
            if (options.parse) attrs = existing.parse(attrs, options);
            existing.set(attrs, options);
            if (sortable && !sort && existing.hasChanged(sortAttr)) sort = true;
          }
          models[i] = existing;

        // If this is a new, valid model, push it to the `toAdd` list.
        } else if (add) {
          model = models[i] = this._prepareModel(attrs, options);
          if (!model) continue;
          toAdd.push(model);
          this._addReference(model, options);
        }

        // Do not add multiple models with the same `id`.
        model = existing || model;
        if (!model) continue;
        id = this.modelId(model.attributes);
        if (order && (model.isNew() || !modelMap[id])) {
          order.push(model);

          // Check to see if this is actually a new model at this index.
          orderChanged = orderChanged || !this.models[i] || model.cid !== this.models[i].cid;
        }

        modelMap[id] = true;
      }

      // Remove nonexistent models if appropriate.
      if (remove) {
        for (var i = 0; i < this.length; i++) {
          if (!modelMap[(model = this.models[i]).cid]) toRemove.push(model);
        }
        if (toRemove.length) this._removeModels(toRemove, options);
      }

      // See if sorting is needed, update `length` and splice in new models.
      if (toAdd.length || orderChanged) {
        if (sortable) sort = true;
        this.length += toAdd.length;
        if (at != null) {
          for (var i = 0; i < toAdd.length; i++) {
            this.models.splice(at + i, 0, toAdd[i]);
          }
        } else {
          if (order) this.models.length = 0;
          var orderedModels = order || toAdd;
          for (var i = 0; i < orderedModels.length; i++) {
            this.models.push(orderedModels[i]);
          }
        }
      }

      // Silently sort the collection if appropriate.
      if (sort) this.sort({silent: true});

      // Unless silenced, it's time to fire all appropriate add/sort events.
      if (!options.silent) {
        var addOpts = at != null ? _.clone(options) : options;
        for (var i = 0; i < toAdd.length; i++) {
          if (at != null) addOpts.index = at + i;
          (model = toAdd[i]).trigger('add', model, this, addOpts);
        }
        if (sort || orderChanged) this.trigger('sort', this, options);
        if (toAdd.length || toRemove.length) this.trigger('update', this, options);
      }

      // Return the added (or merged) model (or models).
      return singular ? models[0] : models;
    },

    // When you have more items than you want to add or remove individually,
    // you can reset the entire set with a new list of models, without firing
    // any granular `add` or `remove` events. Fires `reset` when finished.
    // Useful for bulk operations and optimizations.
    reset: function(models, options) {
      options = options ? _.clone(options) : {};
      for (var i = 0; i < this.models.length; i++) {
        this._removeReference(this.models[i], options);
      }
      options.previousModels = this.models;
      this._reset();
      models = this.add(models, _.extend({silent: true}, options));
      if (!options.silent) this.trigger('reset', this, options);
      return models;
    },

    // Add a model to the end of the collection.
    push: function(model, options) {
      return this.add(model, _.extend({at: this.length}, options));
    },

    // Remove a model from the end of the collection.
    pop: function(options) {
      var model = this.at(this.length - 1);
      return this.remove(model, options);
    },

    // Add a model to the beginning of the collection.
    unshift: function(model, options) {
      return this.add(model, _.extend({at: 0}, options));
    },

    // Remove a model from the beginning of the collection.
    shift: function(options) {
      var model = this.at(0);
      return this.remove(model, options);
    },

    // Slice out a sub-array of models from the collection.
    slice: function() {
      return slice.apply(this.models, arguments);
    },

    // Get a model from the set by id.
    get: function(obj) {
      if (obj == null) return void 0;
      var id = this.modelId(this._isModel(obj) ? obj.attributes : obj);
      return this._byId[obj] || this._byId[id] || this._byId[obj.cid];
    },

    // Get the model at the given index.
    at: function(index) {
      if (index < 0) index += this.length;
      return this.models[index];
    },

    // Return models with matching attributes. Useful for simple cases of
    // `filter`.
    where: function(attrs, first) {
      var matches = _.matches(attrs);
      return this[first ? 'find' : 'filter'](function(model) {
        return matches(model.attributes);
      });
    },

    // Return the first model with matching attributes. Useful for simple cases
    // of `find`.
    findWhere: function(attrs) {
      return this.where(attrs, true);
    },

    // Force the collection to re-sort itself. You don't need to call this under
    // normal circumstances, as the set will maintain sort order as each item
    // is added.
    sort: function(options) {
      if (!this.comparator) throw new Error('Cannot sort a set without a comparator');
      options || (options = {});

      // Run sort based on type of `comparator`.
      if (_.isString(this.comparator) || this.comparator.length === 1) {
        this.models = this.sortBy(this.comparator, this);
      } else {
        this.models.sort(_.bind(this.comparator, this));
      }

      if (!options.silent) this.trigger('sort', this, options);
      return this;
    },

    // Pluck an attribute from each model in the collection.
    pluck: function(attr) {
      return _.invoke(this.models, 'get', attr);
    },

    // Fetch the default set of models for this collection, resetting the
    // collection when they arrive. If `reset: true` is passed, the response
    // data will be passed through the `reset` method instead of `set`.
    fetch: function(options) {
      options = _.extend({parse: true}, options);
      var success = options.success;
      var collection = this;
      options.success = function(resp) {
        var method = options.reset ? 'reset' : 'set';
        collection[method](resp, options);
        if (success) success.call(options.context, collection, resp, options);
        collection.trigger('sync', collection, resp, options);
      };
      wrapError(this, options);
      return this.sync('read', this, options);
    },

    // Create a new instance of a model in this collection. Add the model to the
    // collection immediately, unless `wait: true` is passed, in which case we
    // wait for the server to agree.
    create: function(model, options) {
      options = options ? _.clone(options) : {};
      var wait = options.wait;
      model = this._prepareModel(model, options);
      if (!model) return false;
      if (!wait) this.add(model, options);
      var collection = this;
      var success = options.success;
      options.success = function(model, resp, callbackOpts) {
        if (wait) collection.add(model, callbackOpts);
        if (success) success.call(callbackOpts.context, model, resp, callbackOpts);
      };
      model.save(null, options);
      return model;
    },

    // **parse** converts a response into a list of models to be added to the
    // collection. The default implementation is just to pass it through.
    parse: function(resp, options) {
      return resp;
    },

    // Create a new collection with an identical list of models as this one.
    clone: function() {
      return new this.constructor(this.models, {
        model: this.model,
        comparator: this.comparator
      });
    },

    // Define how to uniquely identify models in the collection.
    modelId: function (attrs) {
      return attrs[this.model.prototype.idAttribute || 'id'];
    },

    // Private method to reset all internal state. Called when the collection
    // is first initialized or reset.
    _reset: function() {
      this.length = 0;
      this.models = [];
      this._byId  = {};
    },

    // Prepare a hash of attributes (or other model) to be added to this
    // collection.
    _prepareModel: function(attrs, options) {
      if (this._isModel(attrs)) {
        if (!attrs.collection) attrs.collection = this;
        return attrs;
      }
      options = options ? _.clone(options) : {};
      options.collection = this;
      var model = new this.model(attrs, options);
      if (!model.validationError) return model;
      this.trigger('invalid', this, model.validationError, options);
      return false;
    },

    // Internal method called by both remove and set.
    // Returns removed models, or false if nothing is removed.
    _removeModels: function(models, options) {
      var removed = [];
      for (var i = 0; i < models.length; i++) {
        var model = this.get(models[i]);
        if (!model) continue;

        var index = this.indexOf(model);
        this.models.splice(index, 1);
        this.length--;

        if (!options.silent) {
          options.index = index;
          model.trigger('remove', model, this, options);
        }

        removed.push(model);
        this._removeReference(model, options);
      }
      return removed.length ? removed : false;
    },

    // Method for checking whether an object should be considered a model for
    // the purposes of adding to the collection.
    _isModel: function (model) {
      return model instanceof Model;
    },

    // Internal method to create a model's ties to a collection.
    _addReference: function(model, options) {
      this._byId[model.cid] = model;
      var id = this.modelId(model.attributes);
      if (id != null) this._byId[id] = model;
      model.on('all', this._onModelEvent, this);
    },

    // Internal method to sever a model's ties to a collection.
    _removeReference: function(model, options) {
      delete this._byId[model.cid];
      var id = this.modelId(model.attributes);
      if (id != null) delete this._byId[id];
      if (this === model.collection) delete model.collection;
      model.off('all', this._onModelEvent, this);
    },

    // Internal method called every time a model in the set fires an event.
    // Sets need to update their indexes when models change ids. All other
    // events simply proxy through. "add" and "remove" events that originate
    // in other collections are ignored.
    _onModelEvent: function(event, model, collection, options) {
      if ((event === 'add' || event === 'remove') && collection !== this) return;
      if (event === 'destroy') this.remove(model, options);
      if (event === 'change') {
        var prevId = this.modelId(model.previousAttributes());
        var id = this.modelId(model.attributes);
        if (prevId !== id) {
          if (prevId != null) delete this._byId[prevId];
          if (id != null) this._byId[id] = model;
        }
      }
      this.trigger.apply(this, arguments);
    }

  });

  // Underscore methods that we want to implement on the Collection.
  // 90% of the core usefulness of Backbone Collections is actually implemented
  // right here:
  var collectionMethods = { forEach: 3, each: 3, map: 3, collect: 3, reduce: 4,
      foldl: 4, inject: 4, reduceRight: 4, foldr: 4, find: 3, detect: 3, filter: 3,
      select: 3, reject: 3, every: 3, all: 3, some: 3, any: 3, include: 2,
      contains: 2, invoke: 0, max: 3, min: 3, toArray: 1, size: 1, first: 3,
      head: 3, take: 3, initial: 3, rest: 3, tail: 3, drop: 3, last: 3,
      without: 0, difference: 0, indexOf: 3, shuffle: 1, lastIndexOf: 3,
      isEmpty: 1, chain: 1, sample: 3, partition: 3 };

  // Mix in each Underscore method as a proxy to `Collection#models`.
  addUnderscoreMethods(Collection, collectionMethods, 'models');

  // Underscore methods that take a property name as an argument.
  var attributeMethods = ['groupBy', 'countBy', 'sortBy', 'indexBy'];

  // Use attributes instead of properties.
  _.each(attributeMethods, function(method) {
    if (!_[method]) return;
    Collection.prototype[method] = function(value, context) {
      var iterator = _.isFunction(value) ? value : function(model) {
        return model.get(value);
      };
      return _[method](this.models, iterator, context);
    };
  });

  // Backbone.View
  // -------------

  // Backbone Views are almost more convention than they are actual code. A View
  // is simply a JavaScript object that represents a logical chunk of UI in the
  // DOM. This might be a single item, an entire list, a sidebar or panel, or
  // even the surrounding frame which wraps your whole app. Defining a chunk of
  // UI as a **View** allows you to define your DOM events declaratively, without
  // having to worry about render order ... and makes it easy for the view to
  // react to specific changes in the state of your models.

  // Creating a Backbone.View creates its initial element outside of the DOM,
  // if an existing element is not provided...
  var View = Backbone.View = function(options) {
    this.cid = _.uniqueId('view');
    _.extend(this, _.pick(options, viewOptions));
    this._ensureElement();
    this.initialize.apply(this, arguments);
  };

  // Cached regex to split keys for `delegate`.
  var delegateEventSplitter = /^(\S+)\s*(.*)$/;

  // List of view options to be merged as properties.
  var viewOptions = ['model', 'collection', 'el', 'id', 'attributes', 'className', 'tagName', 'events'];

  // Set up all inheritable **Backbone.View** properties and methods.
  _.extend(View.prototype, Events, {

    // The default `tagName` of a View's element is `"div"`.
    tagName: 'div',

    // jQuery delegate for element lookup, scoped to DOM elements within the
    // current view. This should be preferred to global lookups where possible.
    $: function(selector) {
      return this.$el.find(selector);
    },

    // Initialize is an empty function by default. Override it with your own
    // initialization logic.
    initialize: function(){},

    // **render** is the core function that your view should override, in order
    // to populate its element (`this.el`), with the appropriate HTML. The
    // convention is for **render** to always return `this`.
    render: function() {
      return this;
    },

    // Remove this view by taking the element out of the DOM, and removing any
    // applicable Backbone.Events listeners.
    remove: function() {
      this._removeElement();
      this.stopListening();
      return this;
    },

    // Remove this view's element from the document and all event listeners
    // attached to it. Exposed for subclasses using an alternative DOM
    // manipulation API.
    _removeElement: function() {
      this.$el.remove();
    },

    // Change the view's element (`this.el` property) and re-delegate the
    // view's events on the new element.
    setElement: function(element) {
      this.undelegateEvents();
      this._setElement(element);
      this.delegateEvents();
      return this;
    },

    // Creates the `this.el` and `this.$el` references for this view using the
    // given `el`. `el` can be a CSS selector or an HTML string, a jQuery
    // context or an element. Subclasses can override this to utilize an
    // alternative DOM manipulation API and are only required to set the
    // `this.el` property.
    _setElement: function(el) {
      this.$el = el instanceof Backbone.$ ? el : Backbone.$(el);
      this.el = this.$el[0];
    },

    // Set callbacks, where `this.events` is a hash of
    //
    // *{"event selector": "callback"}*
    //
    //     {
    //       'mousedown .title':  'edit',
    //       'click .button':     'save',
    //       'click .open':       function(e) { ... }
    //     }
    //
    // pairs. Callbacks will be bound to the view, with `this` set properly.
    // Uses event delegation for efficiency.
    // Omitting the selector binds the event to `this.el`.
    delegateEvents: function(events) {
      events || (events = _.result(this, 'events'));
      if (!events) return this;
      this.undelegateEvents();
      for (var key in events) {
        var method = events[key];
        if (!_.isFunction(method)) method = this[method];
        if (!method) continue;
        var match = key.match(delegateEventSplitter);
        this.delegate(match[1], match[2], _.bind(method, this));
      }
      return this;
    },

    // Add a single event listener to the view's element (or a child element
    // using `selector`). This only works for delegate-able events: not `focus`,
    // `blur`, and not `change`, `submit`, and `reset` in Internet Explorer.
    delegate: function(eventName, selector, listener) {
      this.$el.on(eventName + '.delegateEvents' + this.cid, selector, listener);
      return this;
    },

    // Clears all callbacks previously bound to the view by `delegateEvents`.
    // You usually don't need to use this, but may wish to if you have multiple
    // Backbone views attached to the same DOM element.
    undelegateEvents: function() {
      if (this.$el) this.$el.off('.delegateEvents' + this.cid);
      return this;
    },

    // A finer-grained `undelegateEvents` for removing a single delegated event.
    // `selector` and `listener` are both optional.
    undelegate: function(eventName, selector, listener) {
      this.$el.off(eventName + '.delegateEvents' + this.cid, selector, listener);
      return this;
    },

    // Produces a DOM element to be assigned to your view. Exposed for
    // subclasses using an alternative DOM manipulation API.
    _createElement: function(tagName) {
      return document.createElement(tagName);
    },

    // Ensure that the View has a DOM element to render into.
    // If `this.el` is a string, pass it through `$()`, take the first
    // matching element, and re-assign it to `el`. Otherwise, create
    // an element from the `id`, `className` and `tagName` properties.
    _ensureElement: function() {
      if (!this.el) {
        var attrs = _.extend({}, _.result(this, 'attributes'));
        if (this.id) attrs.id = _.result(this, 'id');
        if (this.className) attrs['class'] = _.result(this, 'className');
        this.setElement(this._createElement(_.result(this, 'tagName')));
        this._setAttributes(attrs);
      } else {
        this.setElement(_.result(this, 'el'));
      }
    },

    // Set attributes from a hash on this view's element.  Exposed for
    // subclasses using an alternative DOM manipulation API.
    _setAttributes: function(attributes) {
      this.$el.attr(attributes);
    }

  });

  // Backbone.sync
  // -------------

  // Override this function to change the manner in which Backbone persists
  // models to the server. You will be passed the type of request, and the
  // model in question. By default, makes a RESTful Ajax request
  // to the model's `url()`. Some possible customizations could be:
  //
  // * Use `setTimeout` to batch rapid-fire updates into a single request.
  // * Send up the models as XML instead of JSON.
  // * Persist models via WebSockets instead of Ajax.
  //
  // Turn on `Backbone.emulateHTTP` in order to send `PUT` and `DELETE` requests
  // as `POST`, with a `_method` parameter containing the true HTTP method,
  // as well as all requests with the body as `application/x-www-form-urlencoded`
  // instead of `application/json` with the model in a param named `model`.
  // Useful when interfacing with server-side languages like **PHP** that make
  // it difficult to read the body of `PUT` requests.
  Backbone.sync = function(method, model, options) {
    var type = methodMap[method];

    // Default options, unless specified.
    _.defaults(options || (options = {}), {
      emulateHTTP: Backbone.emulateHTTP,
      emulateJSON: Backbone.emulateJSON
    });

    // Default JSON-request options.
    var params = {type: type, dataType: 'json'};

    // Ensure that we have a URL.
    if (!options.url) {
      params.url = _.result(model, 'url') || urlError();
    }

    // Ensure that we have the appropriate request data.
    if (options.data == null && model && (method === 'create' || method === 'update' || method === 'patch')) {
      params.contentType = 'application/json';
      params.data = JSON.stringify(options.attrs || model.toJSON(options));
    }

    // For older servers, emulate JSON by encoding the request into an HTML-form.
    if (options.emulateJSON) {
      params.contentType = 'application/x-www-form-urlencoded';
      params.data = params.data ? {model: params.data} : {};
    }

    // For older servers, emulate HTTP by mimicking the HTTP method with `_method`
    // And an `X-HTTP-Method-Override` header.
    if (options.emulateHTTP && (type === 'PUT' || type === 'DELETE' || type === 'PATCH')) {
      params.type = 'POST';
      if (options.emulateJSON) params.data._method = type;
      var beforeSend = options.beforeSend;
      options.beforeSend = function(xhr) {
        xhr.setRequestHeader('X-HTTP-Method-Override', type);
        if (beforeSend) return beforeSend.apply(this, arguments);
      };
    }

    // Don't process data on a non-GET request.
    if (params.type !== 'GET' && !options.emulateJSON) {
      params.processData = false;
    }

    // Pass along `textStatus` and `errorThrown` from jQuery.
    var error = options.error;
    options.error = function(xhr, textStatus, errorThrown) {
      options.textStatus = textStatus;
      options.errorThrown = errorThrown;
      if (error) error.call(options.context, xhr, textStatus, errorThrown);
    };

    // Make the request, allowing the user to override any Ajax options.
    var xhr = options.xhr = Backbone.ajax(_.extend(params, options));
    model.trigger('request', model, xhr, options);
    return xhr;
  };

  // Map from CRUD to HTTP for our default `Backbone.sync` implementation.
  var methodMap = {
    'create': 'POST',
    'update': 'PUT',
    'patch':  'PATCH',
    'delete': 'DELETE',
    'read':   'GET'
  };

  // Set the default implementation of `Backbone.ajax` to proxy through to `$`.
  // Override this if you'd like to use a different library.
  Backbone.ajax = function() {
    return Backbone.$.ajax.apply(Backbone.$, arguments);
  };

  // Backbone.Router
  // ---------------

  // Routers map faux-URLs to actions, and fire events when routes are
  // matched. Creating a new one sets its `routes` hash, if not set statically.
  var Router = Backbone.Router = function(options) {
    options || (options = {});
    if (options.routes) this.routes = options.routes;
    this._bindRoutes();
    this.initialize.apply(this, arguments);
  };

  // Cached regular expressions for matching named param parts and splatted
  // parts of route strings.
  var optionalParam = /\((.*?)\)/g;
  var namedParam    = /(\(\?)?:\w+/g;
  var splatParam    = /\*\w+/g;
  var escapeRegExp  = /[\-{}\[\]+?.,\\\^$|#\s]/g;

  // Set up all inheritable **Backbone.Router** properties and methods.
  _.extend(Router.prototype, Events, {

    // Initialize is an empty function by default. Override it with your own
    // initialization logic.
    initialize: function(){},

    // Manually bind a single named route to a callback. For example:
    //
    //     this.route('search/:query/p:num', 'search', function(query, num) {
    //       ...
    //     });
    //
    route: function(route, name, callback) {
      if (!_.isRegExp(route)) route = this._routeToRegExp(route);
      if (_.isFunction(name)) {
        callback = name;
        name = '';
      }
      if (!callback) callback = this[name];
      var router = this;
      Backbone.history.route(route, function(fragment) {
        var args = router._extractParameters(route, fragment);
        if (router.execute(callback, args, name) !== false) {
          router.trigger.apply(router, ['route:' + name].concat(args));
          router.trigger('route', name, args);
          Backbone.history.trigger('route', router, name, args);
        }
      });
      return this;
    },

    // Execute a route handler with the provided parameters.  This is an
    // excellent place to do pre-route setup or post-route cleanup.
    execute: function(callback, args, name) {
      if (callback) callback.apply(this, args);
    },

    // Simple proxy to `Backbone.history` to save a fragment into the history.
    navigate: function(fragment, options) {
      Backbone.history.navigate(fragment, options);
      return this;
    },

    // Bind all defined routes to `Backbone.history`. We have to reverse the
    // order of the routes here to support behavior where the most general
    // routes can be defined at the bottom of the route map.
    _bindRoutes: function() {
      if (!this.routes) return;
      this.routes = _.result(this, 'routes');
      var route, routes = _.keys(this.routes);
      while ((route = routes.pop()) != null) {
        this.route(route, this.routes[route]);
      }
    },

    // Convert a route string into a regular expression, suitable for matching
    // against the current location hash.
    _routeToRegExp: function(route) {
      route = route.replace(escapeRegExp, '\\$&')
                   .replace(optionalParam, '(?:$1)?')
                   .replace(namedParam, function(match, optional) {
                     return optional ? match : '([^/?]+)';
                   })
                   .replace(splatParam, '([^?]*?)');
      return new RegExp('^' + route + '(?:\\?([\\s\\S]*))?$');
    },

    // Given a route, and a URL fragment that it matches, return the array of
    // extracted decoded parameters. Empty or unmatched parameters will be
    // treated as `null` to normalize cross-browser behavior.
    _extractParameters: function(route, fragment) {
      var params = route.exec(fragment).slice(1);
      return _.map(params, function(param, i) {
        // Don't decode the search params.
        if (i === params.length - 1) return param || null;
        return param ? decodeURIComponent(param) : null;
      });
    }

  });

  // Backbone.History
  // ----------------

  // Handles cross-browser history management, based on either
  // [pushState](http://diveintohtml5.info/history.html) and real URLs, or
  // [onhashchange](https://developer.mozilla.org/en-US/docs/DOM/window.onhashchange)
  // and URL fragments. If the browser supports neither (old IE, natch),
  // falls back to polling.
  var History = Backbone.History = function() {
    this.handlers = [];
    _.bindAll(this, 'checkUrl');

    // Ensure that `History` can be used outside of the browser.
    if (typeof window !== 'undefined') {
      this.location = window.location;
      this.history = window.history;
    }
  };

  // Cached regex for stripping a leading hash/slash and trailing space.
  var routeStripper = /^[#\/]|\s+$/g;

  // Cached regex for stripping leading and trailing slashes.
  var rootStripper = /^\/+|\/+$/g;

  // Cached regex for stripping urls of hash.
  var pathStripper = /#.*$/;

  // Has the history handling already been started?
  History.started = false;

  // Set up all inheritable **Backbone.History** properties and methods.
  _.extend(History.prototype, Events, {

    // The default interval to poll for hash changes, if necessary, is
    // twenty times a second.
    interval: 50,

    // Are we at the app root?
    atRoot: function() {
      var path = this.location.pathname.replace(/[^\/]$/, '$&/');
      return path === this.root && !this.getSearch();
    },

    // Does the pathname match the root?
    matchRoot: function() {
      var path = this.decodeFragment(this.location.pathname);
      var root = path.slice(0, this.root.length - 1) + '/';
      return root === this.root;
    },

    // Unicode characters in `location.pathname` are percent encoded so they're
    // decoded for comparison. `%25` should not be decoded since it may be part
    // of an encoded parameter.
    decodeFragment: function(fragment) {
      return decodeURI(fragment.replace(/%25/g, '%2525'));
    },

    // In IE6, the hash fragment and search params are incorrect if the
    // fragment contains `?`.
    getSearch: function() {
      var match = this.location.href.replace(/#.*/, '').match(/\?.+/);
      return match ? match[0] : '';
    },

    // Gets the true hash value. Cannot use location.hash directly due to bug
    // in Firefox where location.hash will always be decoded.
    getHash: function(window) {
      var match = (window || this).location.href.match(/#(.*)$/);
      return match ? match[1] : '';
    },

    // Get the pathname and search params, without the root.
    getPath: function() {
      var path = this.decodeFragment(
        this.location.pathname + this.getSearch()
      ).slice(this.root.length - 1);
      return path.charAt(0) === '/' ? path.slice(1) : path;
    },

    // Get the cross-browser normalized URL fragment from the path or hash.
    getFragment: function(fragment) {
      if (fragment == null) {
        if (this._usePushState || !this._wantsHashChange) {
          fragment = this.getPath();
        } else {
          fragment = this.getHash();
        }
      }
      return fragment.replace(routeStripper, '');
    },

    // Start the hash change handling, returning `true` if the current URL matches
    // an existing route, and `false` otherwise.
    start: function(options) {
      if (History.started) throw new Error('Backbone.history has already been started');
      History.started = true;

      // Figure out the initial configuration. Do we need an iframe?
      // Is pushState desired ... is it available?
      this.options          = _.extend({root: '/'}, this.options, options);
      this.root             = this.options.root;
      this._wantsHashChange = this.options.hashChange !== false;
      this._hasHashChange   = 'onhashchange' in window;
      this._useHashChange   = this._wantsHashChange && this._hasHashChange;
      this._wantsPushState  = !!this.options.pushState;
      this._hasPushState    = !!(this.history && this.history.pushState);
      this._usePushState    = this._wantsPushState && this._hasPushState;
      this.fragment         = this.getFragment();

      // Normalize root to always include a leading and trailing slash.
      this.root = ('/' + this.root + '/').replace(rootStripper, '/');

      // Transition from hashChange to pushState or vice versa if both are
      // requested.
      if (this._wantsHashChange && this._wantsPushState) {

        // If we've started off with a route from a `pushState`-enabled
        // browser, but we're currently in a browser that doesn't support it...
        if (!this._hasPushState && !this.atRoot()) {
          var root = this.root.slice(0, -1) || '/';
          this.location.replace(root + '#' + this.getPath());
          // Return immediately as browser will do redirect to new url
          return true;

        // Or if we've started out with a hash-based route, but we're currently
        // in a browser where it could be `pushState`-based instead...
        } else if (this._hasPushState && this.atRoot()) {
          this.navigate(this.getHash(), {replace: true});
        }

      }

      // Proxy an iframe to handle location events if the browser doesn't
      // support the `hashchange` event, HTML5 history, or the user wants
      // `hashChange` but not `pushState`.
      if (!this._hasHashChange && this._wantsHashChange && !this._usePushState) {
        this.iframe = document.createElement('iframe');
        this.iframe.src = 'javascript:0';
        this.iframe.style.display = 'none';
        this.iframe.tabIndex = -1;
        var body = document.body;
        // Using `appendChild` will throw on IE < 9 if the document is not ready.
        var iWindow = body.insertBefore(this.iframe, body.firstChild).contentWindow;
        iWindow.document.open();
        iWindow.document.close();
        iWindow.location.hash = '#' + this.fragment;
      }

      // Add a cross-platform `addEventListener` shim for older browsers.
      var addEventListener = window.addEventListener || function (eventName, listener) {
        return attachEvent('on' + eventName, listener);
      };

      // Depending on whether we're using pushState or hashes, and whether
      // 'onhashchange' is supported, determine how we check the URL state.
      if (this._usePushState) {
        addEventListener('popstate', this.checkUrl, false);
      } else if (this._useHashChange && !this.iframe) {
        addEventListener('hashchange', this.checkUrl, false);
      } else if (this._wantsHashChange) {
        this._checkUrlInterval = setInterval(this.checkUrl, this.interval);
      }

      if (!this.options.silent) return this.loadUrl();
    },

    // Disable Backbone.history, perhaps temporarily. Not useful in a real app,
    // but possibly useful for unit testing Routers.
    stop: function() {
      // Add a cross-platform `removeEventListener` shim for older browsers.
      var removeEventListener = window.removeEventListener || function (eventName, listener) {
        return detachEvent('on' + eventName, listener);
      };

      // Remove window listeners.
      if (this._usePushState) {
        removeEventListener('popstate', this.checkUrl, false);
      } else if (this._useHashChange && !this.iframe) {
        removeEventListener('hashchange', this.checkUrl, false);
      }

      // Clean up the iframe if necessary.
      if (this.iframe) {
        document.body.removeChild(this.iframe);
        this.iframe = null;
      }

      // Some environments will throw when clearing an undefined interval.
      if (this._checkUrlInterval) clearInterval(this._checkUrlInterval);
      History.started = false;
    },

    // Add a route to be tested when the fragment changes. Routes added later
    // may override previous routes.
    route: function(route, callback) {
      this.handlers.unshift({route: route, callback: callback});
    },

    // Checks the current URL to see if it has changed, and if it has,
    // calls `loadUrl`, normalizing across the hidden iframe.
    checkUrl: function(e) {
      var current = this.getFragment();

      // If the user pressed the back button, the iframe's hash will have
      // changed and we should use that for comparison.
      if (current === this.fragment && this.iframe) {
        current = this.getHash(this.iframe.contentWindow);
      }

      if (current === this.fragment) return false;
      if (this.iframe) this.navigate(current);
      this.loadUrl();
    },

    // Attempt to load the current URL fragment. If a route succeeds with a
    // match, returns `true`. If no defined routes matches the fragment,
    // returns `false`.
    loadUrl: function(fragment) {
      // If the root doesn't match, no routes can match either.
      if (!this.matchRoot()) return false;
      fragment = this.fragment = this.getFragment(fragment);
      return _.any(this.handlers, function(handler) {
        if (handler.route.test(fragment)) {
          handler.callback(fragment);
          return true;
        }
      });
    },

    // Save a fragment into the hash history, or replace the URL state if the
    // 'replace' option is passed. You are responsible for properly URL-encoding
    // the fragment in advance.
    //
    // The options object can contain `trigger: true` if you wish to have the
    // route callback be fired (not usually desirable), or `replace: true`, if
    // you wish to modify the current URL without adding an entry to the history.
    navigate: function(fragment, options) {
      if (!History.started) return false;
      if (!options || options === true) options = {trigger: !!options};

      // Normalize the fragment.
      fragment = this.getFragment(fragment || '');

      // Don't include a trailing slash on the root.
      var root = this.root;
      if (fragment === '' || fragment.charAt(0) === '?') {
        root = root.slice(0, -1) || '/';
      }
      var url = root + fragment;

      // Strip the hash and decode for matching.
      fragment = this.decodeFragment(fragment.replace(pathStripper, ''));

      if (this.fragment === fragment) return;
      this.fragment = fragment;

      // If pushState is available, we use it to set the fragment as a real URL.
      if (this._usePushState) {
        this.history[options.replace ? 'replaceState' : 'pushState']({}, document.title, url);

      // If hash changes haven't been explicitly disabled, update the hash
      // fragment to store history.
      } else if (this._wantsHashChange) {
        this._updateHash(this.location, fragment, options.replace);
        if (this.iframe && (fragment !== this.getHash(this.iframe.contentWindow))) {
          var iWindow = this.iframe.contentWindow;

          // Opening and closing the iframe tricks IE7 and earlier to push a
          // history entry on hash-tag change.  When replace is true, we don't
          // want this.
          if (!options.replace) {
            iWindow.document.open();
            iWindow.document.close();
          }

          this._updateHash(iWindow.location, fragment, options.replace);
        }

      // If you've told us that you explicitly don't want fallback hashchange-
      // based history, then `navigate` becomes a page refresh.
      } else {
        return this.location.assign(url);
      }
      if (options.trigger) return this.loadUrl(fragment);
    },

    // Update the hash location, either replacing the current entry, or adding
    // a new one to the browser history.
    _updateHash: function(location, fragment, replace) {
      if (replace) {
        var href = location.href.replace(/(javascript:|#).*$/, '');
        location.replace(href + '#' + fragment);
      } else {
        // Some browsers require that `hash` contains a leading #.
        location.hash = '#' + fragment;
      }
    }

  });

  // Create the default Backbone.history.
  Backbone.history = new History;

  // Helpers
  // -------

  // Helper function to correctly set up the prototype chain for subclasses.
  // Similar to `goog.inherits`, but uses a hash of prototype properties and
  // class properties to be extended.
  var extend = function(protoProps, staticProps) {
    var parent = this;
    var child;

    // The constructor function for the new subclass is either defined by you
    // (the "constructor" property in your `extend` definition), or defaulted
    // by us to simply call the parent constructor.
    if (protoProps && _.has(protoProps, 'constructor')) {
      child = protoProps.constructor;
    } else {
      child = function(){ return parent.apply(this, arguments); };
    }

    // Add static properties to the constructor function, if supplied.
    _.extend(child, parent, staticProps);

    // Set the prototype chain to inherit from `parent`, without calling
    // `parent` constructor function.
    var Surrogate = function(){ this.constructor = child; };
    Surrogate.prototype = parent.prototype;
    child.prototype = new Surrogate;

    // Add prototype properties (instance properties) to the subclass,
    // if supplied.
    if (protoProps) _.extend(child.prototype, protoProps);

    // Set a convenience property in case the parent's prototype is needed
    // later.
    child.__super__ = parent.prototype;

    return child;
  };

  // Set up inheritance for the model, collection, router, view and history.
  Model.extend = Collection.extend = Router.extend = View.extend = History.extend = extend;

  // Throw an error when a URL is needed, and none is supplied.
  var urlError = function() {
    throw new Error('A "url" property or function must be specified');
  };

  // Wrap an optional error callback with a fallback error event.
  var wrapError = function(model, options) {
    var error = options.error;
    options.error = function(resp) {
      if (error) error.call(options.context, model, resp, options);
      model.trigger('error', model, resp, options);
    };
  };

  return Backbone;

}));
/*
Copyright 2012 Igor Vaynberg

Version: 3.5.4 Timestamp: Sun Aug 30 13:30:32 EDT 2015

This software is licensed under the Apache License, Version 2.0 (the "Apache License") or the GNU
General Public License version 2 (the "GPL License"). You may choose either license to govern your
use of this software only upon the condition that you accept all of the terms of either the Apache
License or the GPL License.

You may obtain a copy of the Apache License and the GPL License at:

    http://www.apache.org/licenses/LICENSE-2.0
    http://www.gnu.org/licenses/gpl-2.0.html

Unless required by applicable law or agreed to in writing, software distributed under the
Apache License or the GPL License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
CONDITIONS OF ANY KIND, either express or implied. See the Apache License and the GPL License for
the specific language governing permissions and limitations under the Apache License and the GPL License.
*/

(function ($) {
    if(typeof $.fn.each2 == "undefined") {
        $.extend($.fn, {
            /*
            * 4-10 times faster .each replacement
            * use it carefully, as it overrides jQuery context of element on each iteration
            */
            each2 : function (c) {
                var j = $([0]), i = -1, l = this.length;
                while (
                    ++i < l
                    && (j.context = j[0] = this[i])
                    && c.call(j[0], i, j) !== false //"this"=DOM, i=index, j=jQuery object
                );
                return this;
            }
        });
    }
})(jQuery);

(function ($, undefined) {
    "use strict";
    /*global document, window, jQuery, console */

    if (window.Select2 !== undefined) {
        return;
    }

    var AbstractSelect2, SingleSelect2, MultiSelect2, nextUid, sizer,
        lastMousePosition={x:0,y:0}, $document, scrollBarDimensions,

    KEY = {
        TAB: 9,
        ENTER: 13,
        ESC: 27,
        SPACE: 32,
        LEFT: 37,
        UP: 38,
        RIGHT: 39,
        DOWN: 40,
        SHIFT: 16,
        CTRL: 17,
        ALT: 18,
        PAGE_UP: 33,
        PAGE_DOWN: 34,
        HOME: 36,
        END: 35,
        BACKSPACE: 8,
        DELETE: 46,
        isArrow: function (k) {
            k = k.which ? k.which : k;
            switch (k) {
            case KEY.LEFT:
            case KEY.RIGHT:
            case KEY.UP:
            case KEY.DOWN:
                return true;
            }
            return false;
        },
        isControl: function (e) {
            var k = e.which;
            switch (k) {
            case KEY.SHIFT:
            case KEY.CTRL:
            case KEY.ALT:
                return true;
            }

            if (e.metaKey) return true;

            return false;
        },
        isFunctionKey: function (k) {
            k = k.which ? k.which : k;
            return k >= 112 && k <= 123;
        }
    },
    MEASURE_SCROLLBAR_TEMPLATE = "<div class='select2-measure-scrollbar'></div>",

    DIACRITICS = {"\u24B6":"A","\uFF21":"A","\u00C0":"A","\u00C1":"A","\u00C2":"A","\u1EA6":"A","\u1EA4":"A","\u1EAA":"A","\u1EA8":"A","\u00C3":"A","\u0100":"A","\u0102":"A","\u1EB0":"A","\u1EAE":"A","\u1EB4":"A","\u1EB2":"A","\u0226":"A","\u01E0":"A","\u00C4":"A","\u01DE":"A","\u1EA2":"A","\u00C5":"A","\u01FA":"A","\u01CD":"A","\u0200":"A","\u0202":"A","\u1EA0":"A","\u1EAC":"A","\u1EB6":"A","\u1E00":"A","\u0104":"A","\u023A":"A","\u2C6F":"A","\uA732":"AA","\u00C6":"AE","\u01FC":"AE","\u01E2":"AE","\uA734":"AO","\uA736":"AU","\uA738":"AV","\uA73A":"AV","\uA73C":"AY","\u24B7":"B","\uFF22":"B","\u1E02":"B","\u1E04":"B","\u1E06":"B","\u0243":"B","\u0182":"B","\u0181":"B","\u24B8":"C","\uFF23":"C","\u0106":"C","\u0108":"C","\u010A":"C","\u010C":"C","\u00C7":"C","\u1E08":"C","\u0187":"C","\u023B":"C","\uA73E":"C","\u24B9":"D","\uFF24":"D","\u1E0A":"D","\u010E":"D","\u1E0C":"D","\u1E10":"D","\u1E12":"D","\u1E0E":"D","\u0110":"D","\u018B":"D","\u018A":"D","\u0189":"D","\uA779":"D","\u01F1":"DZ","\u01C4":"DZ","\u01F2":"Dz","\u01C5":"Dz","\u24BA":"E","\uFF25":"E","\u00C8":"E","\u00C9":"E","\u00CA":"E","\u1EC0":"E","\u1EBE":"E","\u1EC4":"E","\u1EC2":"E","\u1EBC":"E","\u0112":"E","\u1E14":"E","\u1E16":"E","\u0114":"E","\u0116":"E","\u00CB":"E","\u1EBA":"E","\u011A":"E","\u0204":"E","\u0206":"E","\u1EB8":"E","\u1EC6":"E","\u0228":"E","\u1E1C":"E","\u0118":"E","\u1E18":"E","\u1E1A":"E","\u0190":"E","\u018E":"E","\u24BB":"F","\uFF26":"F","\u1E1E":"F","\u0191":"F","\uA77B":"F","\u24BC":"G","\uFF27":"G","\u01F4":"G","\u011C":"G","\u1E20":"G","\u011E":"G","\u0120":"G","\u01E6":"G","\u0122":"G","\u01E4":"G","\u0193":"G","\uA7A0":"G","\uA77D":"G","\uA77E":"G","\u24BD":"H","\uFF28":"H","\u0124":"H","\u1E22":"H","\u1E26":"H","\u021E":"H","\u1E24":"H","\u1E28":"H","\u1E2A":"H","\u0126":"H","\u2C67":"H","\u2C75":"H","\uA78D":"H","\u24BE":"I","\uFF29":"I","\u00CC":"I","\u00CD":"I","\u00CE":"I","\u0128":"I","\u012A":"I","\u012C":"I","\u0130":"I","\u00CF":"I","\u1E2E":"I","\u1EC8":"I","\u01CF":"I","\u0208":"I","\u020A":"I","\u1ECA":"I","\u012E":"I","\u1E2C":"I","\u0197":"I","\u24BF":"J","\uFF2A":"J","\u0134":"J","\u0248":"J","\u24C0":"K","\uFF2B":"K","\u1E30":"K","\u01E8":"K","\u1E32":"K","\u0136":"K","\u1E34":"K","\u0198":"K","\u2C69":"K","\uA740":"K","\uA742":"K","\uA744":"K","\uA7A2":"K","\u24C1":"L","\uFF2C":"L","\u013F":"L","\u0139":"L","\u013D":"L","\u1E36":"L","\u1E38":"L","\u013B":"L","\u1E3C":"L","\u1E3A":"L","\u0141":"L","\u023D":"L","\u2C62":"L","\u2C60":"L","\uA748":"L","\uA746":"L","\uA780":"L","\u01C7":"LJ","\u01C8":"Lj","\u24C2":"M","\uFF2D":"M","\u1E3E":"M","\u1E40":"M","\u1E42":"M","\u2C6E":"M","\u019C":"M","\u24C3":"N","\uFF2E":"N","\u01F8":"N","\u0143":"N","\u00D1":"N","\u1E44":"N","\u0147":"N","\u1E46":"N","\u0145":"N","\u1E4A":"N","\u1E48":"N","\u0220":"N","\u019D":"N","\uA790":"N","\uA7A4":"N","\u01CA":"NJ","\u01CB":"Nj","\u24C4":"O","\uFF2F":"O","\u00D2":"O","\u00D3":"O","\u00D4":"O","\u1ED2":"O","\u1ED0":"O","\u1ED6":"O","\u1ED4":"O","\u00D5":"O","\u1E4C":"O","\u022C":"O","\u1E4E":"O","\u014C":"O","\u1E50":"O","\u1E52":"O","\u014E":"O","\u022E":"O","\u0230":"O","\u00D6":"O","\u022A":"O","\u1ECE":"O","\u0150":"O","\u01D1":"O","\u020C":"O","\u020E":"O","\u01A0":"O","\u1EDC":"O","\u1EDA":"O","\u1EE0":"O","\u1EDE":"O","\u1EE2":"O","\u1ECC":"O","\u1ED8":"O","\u01EA":"O","\u01EC":"O","\u00D8":"O","\u01FE":"O","\u0186":"O","\u019F":"O","\uA74A":"O","\uA74C":"O","\u01A2":"OI","\uA74E":"OO","\u0222":"OU","\u24C5":"P","\uFF30":"P","\u1E54":"P","\u1E56":"P","\u01A4":"P","\u2C63":"P","\uA750":"P","\uA752":"P","\uA754":"P","\u24C6":"Q","\uFF31":"Q","\uA756":"Q","\uA758":"Q","\u024A":"Q","\u24C7":"R","\uFF32":"R","\u0154":"R","\u1E58":"R","\u0158":"R","\u0210":"R","\u0212":"R","\u1E5A":"R","\u1E5C":"R","\u0156":"R","\u1E5E":"R","\u024C":"R","\u2C64":"R","\uA75A":"R","\uA7A6":"R","\uA782":"R","\u24C8":"S","\uFF33":"S","\u1E9E":"S","\u015A":"S","\u1E64":"S","\u015C":"S","\u1E60":"S","\u0160":"S","\u1E66":"S","\u1E62":"S","\u1E68":"S","\u0218":"S","\u015E":"S","\u2C7E":"S","\uA7A8":"S","\uA784":"S","\u24C9":"T","\uFF34":"T","\u1E6A":"T","\u0164":"T","\u1E6C":"T","\u021A":"T","\u0162":"T","\u1E70":"T","\u1E6E":"T","\u0166":"T","\u01AC":"T","\u01AE":"T","\u023E":"T","\uA786":"T","\uA728":"TZ","\u24CA":"U","\uFF35":"U","\u00D9":"U","\u00DA":"U","\u00DB":"U","\u0168":"U","\u1E78":"U","\u016A":"U","\u1E7A":"U","\u016C":"U","\u00DC":"U","\u01DB":"U","\u01D7":"U","\u01D5":"U","\u01D9":"U","\u1EE6":"U","\u016E":"U","\u0170":"U","\u01D3":"U","\u0214":"U","\u0216":"U","\u01AF":"U","\u1EEA":"U","\u1EE8":"U","\u1EEE":"U","\u1EEC":"U","\u1EF0":"U","\u1EE4":"U","\u1E72":"U","\u0172":"U","\u1E76":"U","\u1E74":"U","\u0244":"U","\u24CB":"V","\uFF36":"V","\u1E7C":"V","\u1E7E":"V","\u01B2":"V","\uA75E":"V","\u0245":"V","\uA760":"VY","\u24CC":"W","\uFF37":"W","\u1E80":"W","\u1E82":"W","\u0174":"W","\u1E86":"W","\u1E84":"W","\u1E88":"W","\u2C72":"W","\u24CD":"X","\uFF38":"X","\u1E8A":"X","\u1E8C":"X","\u24CE":"Y","\uFF39":"Y","\u1EF2":"Y","\u00DD":"Y","\u0176":"Y","\u1EF8":"Y","\u0232":"Y","\u1E8E":"Y","\u0178":"Y","\u1EF6":"Y","\u1EF4":"Y","\u01B3":"Y","\u024E":"Y","\u1EFE":"Y","\u24CF":"Z","\uFF3A":"Z","\u0179":"Z","\u1E90":"Z","\u017B":"Z","\u017D":"Z","\u1E92":"Z","\u1E94":"Z","\u01B5":"Z","\u0224":"Z","\u2C7F":"Z","\u2C6B":"Z","\uA762":"Z","\u24D0":"a","\uFF41":"a","\u1E9A":"a","\u00E0":"a","\u00E1":"a","\u00E2":"a","\u1EA7":"a","\u1EA5":"a","\u1EAB":"a","\u1EA9":"a","\u00E3":"a","\u0101":"a","\u0103":"a","\u1EB1":"a","\u1EAF":"a","\u1EB5":"a","\u1EB3":"a","\u0227":"a","\u01E1":"a","\u00E4":"a","\u01DF":"a","\u1EA3":"a","\u00E5":"a","\u01FB":"a","\u01CE":"a","\u0201":"a","\u0203":"a","\u1EA1":"a","\u1EAD":"a","\u1EB7":"a","\u1E01":"a","\u0105":"a","\u2C65":"a","\u0250":"a","\uA733":"aa","\u00E6":"ae","\u01FD":"ae","\u01E3":"ae","\uA735":"ao","\uA737":"au","\uA739":"av","\uA73B":"av","\uA73D":"ay","\u24D1":"b","\uFF42":"b","\u1E03":"b","\u1E05":"b","\u1E07":"b","\u0180":"b","\u0183":"b","\u0253":"b","\u24D2":"c","\uFF43":"c","\u0107":"c","\u0109":"c","\u010B":"c","\u010D":"c","\u00E7":"c","\u1E09":"c","\u0188":"c","\u023C":"c","\uA73F":"c","\u2184":"c","\u24D3":"d","\uFF44":"d","\u1E0B":"d","\u010F":"d","\u1E0D":"d","\u1E11":"d","\u1E13":"d","\u1E0F":"d","\u0111":"d","\u018C":"d","\u0256":"d","\u0257":"d","\uA77A":"d","\u01F3":"dz","\u01C6":"dz","\u24D4":"e","\uFF45":"e","\u00E8":"e","\u00E9":"e","\u00EA":"e","\u1EC1":"e","\u1EBF":"e","\u1EC5":"e","\u1EC3":"e","\u1EBD":"e","\u0113":"e","\u1E15":"e","\u1E17":"e","\u0115":"e","\u0117":"e","\u00EB":"e","\u1EBB":"e","\u011B":"e","\u0205":"e","\u0207":"e","\u1EB9":"e","\u1EC7":"e","\u0229":"e","\u1E1D":"e","\u0119":"e","\u1E19":"e","\u1E1B":"e","\u0247":"e","\u025B":"e","\u01DD":"e","\u24D5":"f","\uFF46":"f","\u1E1F":"f","\u0192":"f","\uA77C":"f","\u24D6":"g","\uFF47":"g","\u01F5":"g","\u011D":"g","\u1E21":"g","\u011F":"g","\u0121":"g","\u01E7":"g","\u0123":"g","\u01E5":"g","\u0260":"g","\uA7A1":"g","\u1D79":"g","\uA77F":"g","\u24D7":"h","\uFF48":"h","\u0125":"h","\u1E23":"h","\u1E27":"h","\u021F":"h","\u1E25":"h","\u1E29":"h","\u1E2B":"h","\u1E96":"h","\u0127":"h","\u2C68":"h","\u2C76":"h","\u0265":"h","\u0195":"hv","\u24D8":"i","\uFF49":"i","\u00EC":"i","\u00ED":"i","\u00EE":"i","\u0129":"i","\u012B":"i","\u012D":"i","\u00EF":"i","\u1E2F":"i","\u1EC9":"i","\u01D0":"i","\u0209":"i","\u020B":"i","\u1ECB":"i","\u012F":"i","\u1E2D":"i","\u0268":"i","\u0131":"i","\u24D9":"j","\uFF4A":"j","\u0135":"j","\u01F0":"j","\u0249":"j","\u24DA":"k","\uFF4B":"k","\u1E31":"k","\u01E9":"k","\u1E33":"k","\u0137":"k","\u1E35":"k","\u0199":"k","\u2C6A":"k","\uA741":"k","\uA743":"k","\uA745":"k","\uA7A3":"k","\u24DB":"l","\uFF4C":"l","\u0140":"l","\u013A":"l","\u013E":"l","\u1E37":"l","\u1E39":"l","\u013C":"l","\u1E3D":"l","\u1E3B":"l","\u017F":"l","\u0142":"l","\u019A":"l","\u026B":"l","\u2C61":"l","\uA749":"l","\uA781":"l","\uA747":"l","\u01C9":"lj","\u24DC":"m","\uFF4D":"m","\u1E3F":"m","\u1E41":"m","\u1E43":"m","\u0271":"m","\u026F":"m","\u24DD":"n","\uFF4E":"n","\u01F9":"n","\u0144":"n","\u00F1":"n","\u1E45":"n","\u0148":"n","\u1E47":"n","\u0146":"n","\u1E4B":"n","\u1E49":"n","\u019E":"n","\u0272":"n","\u0149":"n","\uA791":"n","\uA7A5":"n","\u01CC":"nj","\u24DE":"o","\uFF4F":"o","\u00F2":"o","\u00F3":"o","\u00F4":"o","\u1ED3":"o","\u1ED1":"o","\u1ED7":"o","\u1ED5":"o","\u00F5":"o","\u1E4D":"o","\u022D":"o","\u1E4F":"o","\u014D":"o","\u1E51":"o","\u1E53":"o","\u014F":"o","\u022F":"o","\u0231":"o","\u00F6":"o","\u022B":"o","\u1ECF":"o","\u0151":"o","\u01D2":"o","\u020D":"o","\u020F":"o","\u01A1":"o","\u1EDD":"o","\u1EDB":"o","\u1EE1":"o","\u1EDF":"o","\u1EE3":"o","\u1ECD":"o","\u1ED9":"o","\u01EB":"o","\u01ED":"o","\u00F8":"o","\u01FF":"o","\u0254":"o","\uA74B":"o","\uA74D":"o","\u0275":"o","\u01A3":"oi","\u0223":"ou","\uA74F":"oo","\u24DF":"p","\uFF50":"p","\u1E55":"p","\u1E57":"p","\u01A5":"p","\u1D7D":"p","\uA751":"p","\uA753":"p","\uA755":"p","\u24E0":"q","\uFF51":"q","\u024B":"q","\uA757":"q","\uA759":"q","\u24E1":"r","\uFF52":"r","\u0155":"r","\u1E59":"r","\u0159":"r","\u0211":"r","\u0213":"r","\u1E5B":"r","\u1E5D":"r","\u0157":"r","\u1E5F":"r","\u024D":"r","\u027D":"r","\uA75B":"r","\uA7A7":"r","\uA783":"r","\u24E2":"s","\uFF53":"s","\u00DF":"s","\u015B":"s","\u1E65":"s","\u015D":"s","\u1E61":"s","\u0161":"s","\u1E67":"s","\u1E63":"s","\u1E69":"s","\u0219":"s","\u015F":"s","\u023F":"s","\uA7A9":"s","\uA785":"s","\u1E9B":"s","\u24E3":"t","\uFF54":"t","\u1E6B":"t","\u1E97":"t","\u0165":"t","\u1E6D":"t","\u021B":"t","\u0163":"t","\u1E71":"t","\u1E6F":"t","\u0167":"t","\u01AD":"t","\u0288":"t","\u2C66":"t","\uA787":"t","\uA729":"tz","\u24E4":"u","\uFF55":"u","\u00F9":"u","\u00FA":"u","\u00FB":"u","\u0169":"u","\u1E79":"u","\u016B":"u","\u1E7B":"u","\u016D":"u","\u00FC":"u","\u01DC":"u","\u01D8":"u","\u01D6":"u","\u01DA":"u","\u1EE7":"u","\u016F":"u","\u0171":"u","\u01D4":"u","\u0215":"u","\u0217":"u","\u01B0":"u","\u1EEB":"u","\u1EE9":"u","\u1EEF":"u","\u1EED":"u","\u1EF1":"u","\u1EE5":"u","\u1E73":"u","\u0173":"u","\u1E77":"u","\u1E75":"u","\u0289":"u","\u24E5":"v","\uFF56":"v","\u1E7D":"v","\u1E7F":"v","\u028B":"v","\uA75F":"v","\u028C":"v","\uA761":"vy","\u24E6":"w","\uFF57":"w","\u1E81":"w","\u1E83":"w","\u0175":"w","\u1E87":"w","\u1E85":"w","\u1E98":"w","\u1E89":"w","\u2C73":"w","\u24E7":"x","\uFF58":"x","\u1E8B":"x","\u1E8D":"x","\u24E8":"y","\uFF59":"y","\u1EF3":"y","\u00FD":"y","\u0177":"y","\u1EF9":"y","\u0233":"y","\u1E8F":"y","\u00FF":"y","\u1EF7":"y","\u1E99":"y","\u1EF5":"y","\u01B4":"y","\u024F":"y","\u1EFF":"y","\u24E9":"z","\uFF5A":"z","\u017A":"z","\u1E91":"z","\u017C":"z","\u017E":"z","\u1E93":"z","\u1E95":"z","\u01B6":"z","\u0225":"z","\u0240":"z","\u2C6C":"z","\uA763":"z","\u0386":"\u0391","\u0388":"\u0395","\u0389":"\u0397","\u038A":"\u0399","\u03AA":"\u0399","\u038C":"\u039F","\u038E":"\u03A5","\u03AB":"\u03A5","\u038F":"\u03A9","\u03AC":"\u03B1","\u03AD":"\u03B5","\u03AE":"\u03B7","\u03AF":"\u03B9","\u03CA":"\u03B9","\u0390":"\u03B9","\u03CC":"\u03BF","\u03CD":"\u03C5","\u03CB":"\u03C5","\u03B0":"\u03C5","\u03C9":"\u03C9","\u03C2":"\u03C3"};

    $document = $(document);

    nextUid=(function() { var counter=1; return function() { return counter++; }; }());


    function reinsertElement(element) {
        var placeholder = $(document.createTextNode(''));

        element.before(placeholder);
        placeholder.before(element);
        placeholder.remove();
    }

    function stripDiacritics(str) {
        // Used 'uni range + named function' from http://jsperf.com/diacritics/18
        function match(a) {
            return DIACRITICS[a] || a;
        }

        return str.replace(/[^\u0000-\u007E]/g, match);
    }

    function indexOf(value, array) {
        var i = 0, l = array.length;
        for (; i < l; i = i + 1) {
            if (equal(value, array[i])) return i;
        }
        return -1;
    }

    function measureScrollbar () {
        var $template = $( MEASURE_SCROLLBAR_TEMPLATE );
        $template.appendTo(document.body);

        var dim = {
            width: $template.width() - $template[0].clientWidth,
            height: $template.height() - $template[0].clientHeight
        };
        $template.remove();

        return dim;
    }

    /**
     * Compares equality of a and b
     * @param a
     * @param b
     */
    function equal(a, b) {
        if (a === b) return true;
        if (a === undefined || b === undefined) return false;
        if (a === null || b === null) return false;
        // Check whether 'a' or 'b' is a string (primitive or object).
        // The concatenation of an empty string (+'') converts its argument to a string's primitive.
        if (a.constructor === String) return a+'' === b+''; // a+'' - in case 'a' is a String object
        if (b.constructor === String) return b+'' === a+''; // b+'' - in case 'b' is a String object
        return false;
    }

    /**
     * Splits the string into an array of values, transforming each value. An empty array is returned for nulls or empty
     * strings
     * @param string
     * @param separator
     */
    function splitVal(string, separator, transform) {
        var val, i, l;
        if (string === null || string.length < 1) return [];
        val = string.split(separator);
        for (i = 0, l = val.length; i < l; i = i + 1) val[i] = transform(val[i]);
        return val;
    }

    function getSideBorderPadding(element) {
        return element.outerWidth(false) - element.width();
    }

    function installKeyUpChangeEvent(element) {
        var key="keyup-change-value";
        element.on("keydown", function () {
            if ($.data(element, key) === undefined) {
                $.data(element, key, element.val());
            }
        });
        element.on("keyup", function () {
            var val= $.data(element, key);
            if (val !== undefined && element.val() !== val) {
                $.removeData(element, key);
                element.trigger("keyup-change");
            }
        });
    }


    /**
     * filters mouse events so an event is fired only if the mouse moved.
     *
     * filters out mouse events that occur when mouse is stationary but
     * the elements under the pointer are scrolled.
     */
    function installFilteredMouseMove(element) {
        element.on("mousemove", function (e) {
            var lastpos = lastMousePosition;
            if (lastpos === undefined || lastpos.x !== e.pageX || lastpos.y !== e.pageY) {
                $(e.target).trigger("mousemove-filtered", e);
            }
        });
    }

    /**
     * Debounces a function. Returns a function that calls the original fn function only if no invocations have been made
     * within the last quietMillis milliseconds.
     *
     * @param quietMillis number of milliseconds to wait before invoking fn
     * @param fn function to be debounced
     * @param ctx object to be used as this reference within fn
     * @return debounced version of fn
     */
    function debounce(quietMillis, fn, ctx) {
        ctx = ctx || undefined;
        var timeout;
        return function () {
            var args = arguments;
            window.clearTimeout(timeout);
            timeout = window.setTimeout(function() {
                fn.apply(ctx, args);
            }, quietMillis);
        };
    }

    function installDebouncedScroll(threshold, element) {
        var notify = debounce(threshold, function (e) { element.trigger("scroll-debounced", e);});
        element.on("scroll", function (e) {
            if (indexOf(e.target, element.get()) >= 0) notify(e);
        });
    }

    function focus($el) {
        if ($el[0] === document.activeElement) return;

        /* set the focus in a 0 timeout - that way the focus is set after the processing
            of the current event has finished - which seems like the only reliable way
            to set focus */
        window.setTimeout(function() {
            var el=$el[0], pos=$el.val().length, range;

            $el.focus();

            /* make sure el received focus so we do not error out when trying to manipulate the caret.
                sometimes modals or others listeners may steal it after its set */
            var isVisible = (el.offsetWidth > 0 || el.offsetHeight > 0);
            if (isVisible && el === document.activeElement) {

                /* after the focus is set move the caret to the end, necessary when we val()
                    just before setting focus */
                if(el.setSelectionRange)
                {
                    el.setSelectionRange(pos, pos);
                }
                else if (el.createTextRange) {
                    range = el.createTextRange();
                    range.collapse(false);
                    range.select();
                }
            }
        }, 0);
    }

    function getCursorInfo(el) {
        el = $(el)[0];
        var offset = 0;
        var length = 0;
        if ('selectionStart' in el) {
            offset = el.selectionStart;
            length = el.selectionEnd - offset;
        } else if ('selection' in document) {
            el.focus();
            var sel = document.selection.createRange();
            length = document.selection.createRange().text.length;
            sel.moveStart('character', -el.value.length);
            offset = sel.text.length - length;
        }
        return { offset: offset, length: length };
    }

    function killEvent(event) {
        event.preventDefault();
        event.stopPropagation();
    }
    function killEventImmediately(event) {
        event.preventDefault();
        event.stopImmediatePropagation();
    }

    function measureTextWidth(e) {
        if (!sizer){
            var style = e[0].currentStyle || window.getComputedStyle(e[0], null);
            sizer = $(document.createElement("div")).css({
                position: "absolute",
                left: "-10000px",
                top: "-10000px",
                display: "none",
                fontSize: style.fontSize,
                fontFamily: style.fontFamily,
                fontStyle: style.fontStyle,
                fontWeight: style.fontWeight,
                letterSpacing: style.letterSpacing,
                textTransform: style.textTransform,
                whiteSpace: "nowrap"
            });
            sizer.attr("class","select2-sizer");
            $(document.body).append(sizer);
        }
        sizer.text(e.val());
        return sizer.width();
    }

    function syncCssClasses(dest, src, adapter) {
        var classes, replacements = [], adapted;

        classes = $.trim(dest.attr("class"));

        if (classes) {
            classes = '' + classes; // for IE which returns object

            $(classes.split(/\s+/)).each2(function() {
                if (this.indexOf("select2-") === 0) {
                    replacements.push(this);
                }
            });
        }

        classes = $.trim(src.attr("class"));

        if (classes) {
            classes = '' + classes; // for IE which returns object

            $(classes.split(/\s+/)).each2(function() {
                if (this.indexOf("select2-") !== 0) {
                    adapted = adapter(this);

                    if (adapted) {
                        replacements.push(adapted);
                    }
                }
            });
        }

        dest.attr("class", replacements.join(" "));
    }


    function markMatch(text, term, markup, escapeMarkup) {
        var match=stripDiacritics(text.toUpperCase()).indexOf(stripDiacritics(term.toUpperCase())),
            tl=term.length;

        if (match<0) {
            markup.push(escapeMarkup(text));
            return;
        }

        markup.push(escapeMarkup(text.substring(0, match)));
        markup.push("<span class='select2-match'>");
        markup.push(escapeMarkup(text.substring(match, match + tl)));
        markup.push("</span>");
        markup.push(escapeMarkup(text.substring(match + tl, text.length)));
    }

    function defaultEscapeMarkup(markup) {
        var replace_map = {
            '\\': '&#92;',
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
            "/": '&#47;'
        };

        return String(markup).replace(/[&<>"'\/\\]/g, function (match) {
            return replace_map[match];
        });
    }

    /**
     * Produces an ajax-based query function
     *
     * @param options object containing configuration parameters
     * @param options.params parameter map for the transport ajax call, can contain such options as cache, jsonpCallback, etc. see $.ajax
     * @param options.transport function that will be used to execute the ajax request. must be compatible with parameters supported by $.ajax
     * @param options.url url for the data
     * @param options.data a function(searchTerm, pageNumber, context) that should return an object containing query string parameters for the above url.
     * @param options.dataType request data type: ajax, jsonp, other datatypes supported by jQuery's $.ajax function or the transport function if specified
     * @param options.quietMillis (optional) milliseconds to wait before making the ajaxRequest, helps debounce the ajax function if invoked too often
     * @param options.results a function(remoteData, pageNumber, query) that converts data returned form the remote request to the format expected by Select2.
     *      The expected format is an object containing the following keys:
     *      results array of objects that will be used as choices
     *      more (optional) boolean indicating whether there are more results available
     *      Example: {results:[{id:1, text:'Red'},{id:2, text:'Blue'}], more:true}
     */
    function ajax(options) {
        var timeout, // current scheduled but not yet executed request
            handler = null,
            quietMillis = options.quietMillis || 100,
            ajaxUrl = options.url,
            self = this;

        return function (query) {
            window.clearTimeout(timeout);
            timeout = window.setTimeout(function () {
                var data = options.data, // ajax data function
                    url = ajaxUrl, // ajax url string or function
                    transport = options.transport || $.fn.select2.ajaxDefaults.transport,
                    // deprecated - to be removed in 4.0  - use params instead
                    deprecated = {
                        type: options.type || 'GET', // set type of request (GET or POST)
                        cache: options.cache || false,
                        jsonpCallback: options.jsonpCallback||undefined,
                        dataType: options.dataType||"json"
                    },
                    params = $.extend({}, $.fn.select2.ajaxDefaults.params, deprecated);

                data = data ? data.call(self, query.term, query.page, query.context) : null;
                url = (typeof url === 'function') ? url.call(self, query.term, query.page, query.context) : url;

                if (handler && typeof handler.abort === "function") { handler.abort(); }

                if (options.params) {
                    if ($.isFunction(options.params)) {
                        $.extend(params, options.params.call(self));
                    } else {
                        $.extend(params, options.params);
                    }
                }

                $.extend(params, {
                    url: url,
                    dataType: options.dataType,
                    data: data,
                    success: function (data) {
                        // TODO - replace query.page with query so users have access to term, page, etc.
                        // added query as third paramter to keep backwards compatibility
                        var results = options.results(data, query.page, query);
                        query.callback(results);
                    },
                    error: function(jqXHR, textStatus, errorThrown){
                        var results = {
                            hasError: true,
                            jqXHR: jqXHR,
                            textStatus: textStatus,
                            errorThrown: errorThrown
                        };

                        query.callback(results);
                    }
                });
                handler = transport.call(self, params);
            }, quietMillis);
        };
    }

    /**
     * Produces a query function that works with a local array
     *
     * @param options object containing configuration parameters. The options parameter can either be an array or an
     * object.
     *
     * If the array form is used it is assumed that it contains objects with 'id' and 'text' keys.
     *
     * If the object form is used it is assumed that it contains 'data' and 'text' keys. The 'data' key should contain
     * an array of objects that will be used as choices. These objects must contain at least an 'id' key. The 'text'
     * key can either be a String in which case it is expected that each element in the 'data' array has a key with the
     * value of 'text' which will be used to match choices. Alternatively, text can be a function(item) that can extract
     * the text.
     */
    function local(options) {
        var data = options, // data elements
            dataText,
            tmp,
            text = function (item) { return ""+item.text; }; // function used to retrieve the text portion of a data item that is matched against the search

         if ($.isArray(data)) {
            tmp = data;
            data = { results: tmp };
        }

         if ($.isFunction(data) === false) {
            tmp = data;
            data = function() { return tmp; };
        }

        var dataItem = data();
        if (dataItem.text) {
            text = dataItem.text;
            // if text is not a function we assume it to be a key name
            if (!$.isFunction(text)) {
                dataText = dataItem.text; // we need to store this in a separate variable because in the next step data gets reset and data.text is no longer available
                text = function (item) { return item[dataText]; };
            }
        }

        return function (query) {
            var t = query.term, filtered = { results: [] }, process;
            if (t === "") {
                query.callback(data());
                return;
            }

            process = function(datum, collection) {
                var group, attr;
                datum = datum[0];
                if (datum.children) {
                    group = {};
                    for (attr in datum) {
                        if (datum.hasOwnProperty(attr)) group[attr]=datum[attr];
                    }
                    group.children=[];
                    $(datum.children).each2(function(i, childDatum) { process(childDatum, group.children); });
                    if (group.children.length || query.matcher(t, text(group), datum)) {
                        collection.push(group);
                    }
                } else {
                    if (query.matcher(t, text(datum), datum)) {
                        collection.push(datum);
                    }
                }
            };

            $(data().results).each2(function(i, datum) { process(datum, filtered.results); });
            query.callback(filtered);
        };
    }

    // TODO javadoc
    function tags(data) {
        var isFunc = $.isFunction(data);
        return function (query) {
            var t = query.term, filtered = {results: []};
            var result = isFunc ? data(query) : data;
            if ($.isArray(result)) {
                $(result).each(function () {
                    var isObject = this.text !== undefined,
                        text = isObject ? this.text : this;
                    if (t === "" || query.matcher(t, text)) {
                        filtered.results.push(isObject ? this : {id: this, text: this});
                    }
                });
                query.callback(filtered);
            }
        };
    }

    /**
     * Checks if the formatter function should be used.
     *
     * Throws an error if it is not a function. Returns true if it should be used,
     * false if no formatting should be performed.
     *
     * @param formatter
     */
    function checkFormatter(formatter, formatterName) {
        if ($.isFunction(formatter)) return true;
        if (!formatter) return false;
        if (typeof(formatter) === 'string') return true;
        throw new Error(formatterName +" must be a string, function, or falsy value");
    }

  /**
   * Returns a given value
   * If given a function, returns its output
   *
   * @param val string|function
   * @param context value of "this" to be passed to function
   * @returns {*}
   */
    function evaluate(val, context) {
        if ($.isFunction(val)) {
            var args = Array.prototype.slice.call(arguments, 2);
            return val.apply(context, args);
        }
        return val;
    }

    function countResults(results) {
        var count = 0;
        $.each(results, function(i, item) {
            if (item.children) {
                count += countResults(item.children);
            } else {
                count++;
            }
        });
        return count;
    }

    /**
     * Default tokenizer. This function uses breaks the input on substring match of any string from the
     * opts.tokenSeparators array and uses opts.createSearchChoice to create the choice object. Both of those
     * two options have to be defined in order for the tokenizer to work.
     *
     * @param input text user has typed so far or pasted into the search field
     * @param selection currently selected choices
     * @param selectCallback function(choice) callback tho add the choice to selection
     * @param opts select2's opts
     * @return undefined/null to leave the current input unchanged, or a string to change the input to the returned value
     */
    function defaultTokenizer(input, selection, selectCallback, opts) {
        var original = input, // store the original so we can compare and know if we need to tell the search to update its text
            dupe = false, // check for whether a token we extracted represents a duplicate selected choice
            token, // token
            index, // position at which the separator was found
            i, l, // looping variables
            separator; // the matched separator

        if (!opts.createSearchChoice || !opts.tokenSeparators || opts.tokenSeparators.length < 1) return undefined;

        while (true) {
            index = -1;

            for (i = 0, l = opts.tokenSeparators.length; i < l; i++) {
                separator = opts.tokenSeparators[i];
                index = input.indexOf(separator);
                if (index >= 0) break;
            }

            if (index < 0) break; // did not find any token separator in the input string, bail

            token = input.substring(0, index);
            input = input.substring(index + separator.length);

            if (token.length > 0) {
                token = opts.createSearchChoice.call(this, token, selection);
                if (token !== undefined && token !== null && opts.id(token) !== undefined && opts.id(token) !== null) {
                    dupe = false;
                    for (i = 0, l = selection.length; i < l; i++) {
                        if (equal(opts.id(token), opts.id(selection[i]))) {
                            dupe = true; break;
                        }
                    }

                    if (!dupe) selectCallback(token);
                }
            }
        }

        if (original!==input) return input;
    }

    function cleanupJQueryElements() {
        var self = this;

        $.each(arguments, function (i, element) {
            self[element].remove();
            self[element] = null;
        });
    }

    /**
     * Creates a new class
     *
     * @param superClass
     * @param methods
     */
    function clazz(SuperClass, methods) {
        var constructor = function () {};
        constructor.prototype = new SuperClass;
        constructor.prototype.constructor = constructor;
        constructor.prototype.parent = SuperClass.prototype;
        constructor.prototype = $.extend(constructor.prototype, methods);
        return constructor;
    }

    AbstractSelect2 = clazz(Object, {

        // abstract
        bind: function (func) {
            var self = this;
            return function () {
                func.apply(self, arguments);
            };
        },

        // abstract
        init: function (opts) {
            var results, search, resultsSelector = ".select2-results";

            // prepare options
            this.opts = opts = this.prepareOpts(opts);

            this.id=opts.id;

            // destroy if called on an existing component
            if (opts.element.data("select2") !== undefined &&
                opts.element.data("select2") !== null) {
                opts.element.data("select2").destroy();
            }

            this.container = this.createContainer();

            this.liveRegion = $('.select2-hidden-accessible');
            if (this.liveRegion.length == 0) {
                this.liveRegion = $("<span>", {
                        role: "status",
                        "aria-live": "polite"
                    })
                    .addClass("select2-hidden-accessible")
                    .appendTo(document.body);
            }

            this.containerId="s2id_"+(opts.element.attr("id") || "autogen"+nextUid());
            this.containerEventName= this.containerId
                .replace(/([.])/g, '_')
                .replace(/([;&,\-\.\+\*\~':"\!\^#$%@\[\]\(\)=>\|])/g, '\\$1');
            this.container.attr("id", this.containerId);

            this.container.attr("title", opts.element.attr("title"));

            this.body = $(document.body);

            syncCssClasses(this.container, this.opts.element, this.opts.adaptContainerCssClass);

            this.container.attr("style", opts.element.attr("style"));
            this.container.css(evaluate(opts.containerCss, this.opts.element));
            this.container.addClass(evaluate(opts.containerCssClass, this.opts.element));

            this.elementTabIndex = this.opts.element.attr("tabindex");

            // swap container for the element
            this.opts.element
                .data("select2", this)
                .attr("tabindex", "-1")
                .before(this.container)
                .on("click.select2", killEvent); // do not leak click events

            this.container.data("select2", this);

            this.dropdown = this.container.find(".select2-drop");

            syncCssClasses(this.dropdown, this.opts.element, this.opts.adaptDropdownCssClass);

            this.dropdown.addClass(evaluate(opts.dropdownCssClass, this.opts.element));
            this.dropdown.data("select2", this);
            this.dropdown.on("click", killEvent);

            this.results = results = this.container.find(resultsSelector);
            this.search = search = this.container.find("input.select2-input");

            this.queryCount = 0;
            this.resultsPage = 0;
            this.context = null;

            // initialize the container
            this.initContainer();

            this.container.on("click", killEvent);

            installFilteredMouseMove(this.results);

            this.dropdown.on("mousemove-filtered", resultsSelector, this.bind(this.highlightUnderEvent));
            this.dropdown.on("touchstart touchmove touchend", resultsSelector, this.bind(function (event) {
                this._touchEvent = true;
                this.highlightUnderEvent(event);
            }));
            this.dropdown.on("touchmove", resultsSelector, this.bind(this.touchMoved));
            this.dropdown.on("touchstart touchend", resultsSelector, this.bind(this.clearTouchMoved));

            // Waiting for a click event on touch devices to select option and hide dropdown
            // otherwise click will be triggered on an underlying element
            this.dropdown.on('click', this.bind(function (event) {
                if (this._touchEvent) {
                    this._touchEvent = false;
                    this.selectHighlighted();
                }
            }));

            installDebouncedScroll(80, this.results);
            this.dropdown.on("scroll-debounced", resultsSelector, this.bind(this.loadMoreIfNeeded));

            // do not propagate change event from the search field out of the component
            $(this.container).on("change", ".select2-input", function(e) {e.stopPropagation();});
            $(this.dropdown).on("change", ".select2-input", function(e) {e.stopPropagation();});

            // if jquery.mousewheel plugin is installed we can prevent out-of-bounds scrolling of results via mousewheel
            if ($.fn.mousewheel) {
                results.mousewheel(function (e, delta, deltaX, deltaY) {
                    var top = results.scrollTop();
                    if (deltaY > 0 && top - deltaY <= 0) {
                        results.scrollTop(0);
                        killEvent(e);
                    } else if (deltaY < 0 && results.get(0).scrollHeight - results.scrollTop() + deltaY <= results.height()) {
                        results.scrollTop(results.get(0).scrollHeight - results.height());
                        killEvent(e);
                    }
                });
            }

            installKeyUpChangeEvent(search);
            search.on("keyup-change input paste", this.bind(this.updateResults));
            search.on("focus", function () { search.addClass("select2-focused"); });
            search.on("blur", function () { search.removeClass("select2-focused");});

            this.dropdown.on("mouseup", resultsSelector, this.bind(function (e) {
                if ($(e.target).closest(".select2-result-selectable").length > 0) {
                    this.highlightUnderEvent(e);
                    this.selectHighlighted(e);
                }
            }));

            // trap all mouse events from leaving the dropdown. sometimes there may be a modal that is listening
            // for mouse events outside of itself so it can close itself. since the dropdown is now outside the select2's
            // dom it will trigger the popup close, which is not what we want
            // focusin can cause focus wars between modals and select2 since the dropdown is outside the modal.
            this.dropdown.on("click mouseup mousedown touchstart touchend focusin", function (e) { e.stopPropagation(); });

            this.lastSearchTerm = undefined;

            if ($.isFunction(this.opts.initSelection)) {
                // initialize selection based on the current value of the source element
                this.initSelection();

                // if the user has provided a function that can set selection based on the value of the source element
                // we monitor the change event on the element and trigger it, allowing for two way synchronization
                this.monitorSource();
            }

            if (opts.maximumInputLength !== null) {
                this.search.attr("maxlength", opts.maximumInputLength);
            }

            var disabled = opts.element.prop("disabled");
            if (disabled === undefined) disabled = false;
            this.enable(!disabled);

            var readonly = opts.element.prop("readonly");
            if (readonly === undefined) readonly = false;
            this.readonly(readonly);

            // Calculate size of scrollbar
            scrollBarDimensions = scrollBarDimensions || measureScrollbar();

            this.autofocus = opts.element.prop("autofocus");
            opts.element.prop("autofocus", false);
            if (this.autofocus) this.focus();

            this.search.attr("placeholder", opts.searchInputPlaceholder);
        },

        // abstract
        destroy: function () {
            var element=this.opts.element, select2 = element.data("select2"), self = this;

            this.close();

            if (element.length && element[0].detachEvent && self._sync) {
                element.each(function () {
                    if (self._sync) {
                        this.detachEvent("onpropertychange", self._sync);
                    }
                });
            }
            if (this.propertyObserver) {
                this.propertyObserver.disconnect();
                this.propertyObserver = null;
            }
            this._sync = null;

            if (select2 !== undefined) {
                select2.container.remove();
                select2.liveRegion.remove();
                select2.dropdown.remove();
                element.removeData("select2")
                    .off(".select2");
                if (!element.is("input[type='hidden']")) {
                    element
                        .show()
                        .prop("autofocus", this.autofocus || false);
                    if (this.elementTabIndex) {
                        element.attr({tabindex: this.elementTabIndex});
                    } else {
                        element.removeAttr("tabindex");
                    }
                    element.show();
                } else {
                    element.css("display", "");
                }
            }

            cleanupJQueryElements.call(this,
                "container",
                "liveRegion",
                "dropdown",
                "results",
                "search"
            );
        },

        // abstract
        optionToData: function(element) {
            if (element.is("option")) {
                return {
                    id:element.prop("value"),
                    text:element.text(),
                    element: element.get(),
                    css: element.attr("class"),
                    disabled: element.prop("disabled"),
                    locked: equal(element.attr("locked"), "locked") || equal(element.data("locked"), true)
                };
            } else if (element.is("optgroup")) {
                return {
                    text:element.attr("label"),
                    children:[],
                    element: element.get(),
                    css: element.attr("class")
                };
            }
        },

        // abstract
        prepareOpts: function (opts) {
            var element, select, idKey, ajaxUrl, self = this;

            element = opts.element;

            if (element.get(0).tagName.toLowerCase() === "select") {
                this.select = select = opts.element;
            }

            if (select) {
                // these options are not allowed when attached to a select because they are picked up off the element itself
                $.each(["id", "multiple", "ajax", "query", "createSearchChoice", "initSelection", "data", "tags"], function () {
                    if (this in opts) {
                        throw new Error("Option '" + this + "' is not allowed for Select2 when attached to a <select> element.");
                    }
                });
            }

            opts.debug = opts.debug || $.fn.select2.defaults.debug;

            // Warnings for options renamed/removed in Select2 4.0.0
            // Only when it's enabled through debug mode
            if (opts.debug && console && console.warn) {
                // id was removed
                if (opts.id != null) {
                    console.warn(
                        'Select2: The `id` option has been removed in Select2 4.0.0, ' +
                        'consider renaming your `id` property or mapping the property before your data makes it to Select2. ' +
                        'You can read more at https://select2.github.io/announcements-4.0.html#changed-id'
                    );
                }

                // text was removed
                if (opts.text != null) {
                    console.warn(
                        'Select2: The `text` option has been removed in Select2 4.0.0, ' +
                        'consider renaming your `text` property or mapping the property before your data makes it to Select2. ' +
                        'You can read more at https://select2.github.io/announcements-4.0.html#changed-id'
                    );
                }

                // sortResults was renamed to results
                if (opts.sortResults != null) {
                    console.warn(
                        'Select2: the `sortResults` option has been renamed to `sorter` in Select2 4.0.0. '
                    );
                }

                // selectOnBlur was renamed to selectOnClose
                if (opts.selectOnBlur != null) {
                    console.warn(
                        'Select2: The `selectOnBlur` option has been renamed to `selectOnClose` in Select2 4.0.0.'
                    );
                }

                // ajax.results was renamed to ajax.processResults
                if (opts.ajax != null && opts.ajax.results != null) {
                    console.warn(
                        'Select2: The `ajax.results` option has been renamed to `ajax.processResults` in Select2 4.0.0.'
                    );
                }

                // format* options were renamed to language.*
                if (opts.formatNoResults != null) {
                    console.warn(
                        'Select2: The `formatNoResults` option has been renamed to `language.noResults` in Select2 4.0.0.'
                    );
                }
                if (opts.formatSearching != null) {
                    console.warn(
                        'Select2: The `formatSearching` option has been renamed to `language.searching` in Select2 4.0.0.'
                    );
                }
                if (opts.formatInputTooShort != null) {
                    console.warn(
                        'Select2: The `formatInputTooShort` option has been renamed to `language.inputTooShort` in Select2 4.0.0.'
                    );
                }
                if (opts.formatInputTooLong != null) {
                    console.warn(
                        'Select2: The `formatInputTooLong` option has been renamed to `language.inputTooLong` in Select2 4.0.0.'
                    );
                }
                if (opts.formatLoading != null) {
                    console.warn(
                        'Select2: The `formatLoading` option has been renamed to `language.loadingMore` in Select2 4.0.0.'
                    );
                }
                if (opts.formatSelectionTooBig != null) {
                    console.warn(
                        'Select2: The `formatSelectionTooBig` option has been renamed to `language.maximumSelected` in Select2 4.0.0.'
                    );
                }

                if (opts.element.data('select2Tags')) {
                    console.warn(
                        'Select2: The `data-select2-tags` attribute has been renamed to `data-tags` in Select2 4.0.0.'
                    );
                }
            }

            // Aliasing options renamed in Select2 4.0.0

            // data-select2-tags -> data-tags
            if (opts.element.data('tags') != null) {
                var elemTags = opts.element.data('tags');

                // data-tags should actually be a boolean
                if (!$.isArray(elemTags)) {
                    elemTags = [];
                }

                opts.element.data('select2Tags', elemTags);
            }

            // sortResults -> sorter
            if (opts.sorter != null) {
                opts.sortResults = opts.sorter;
            }

            // selectOnBlur -> selectOnClose
            if (opts.selectOnClose != null) {
                opts.selectOnBlur = opts.selectOnClose;
            }

            // ajax.results -> ajax.processResults
            if (opts.ajax != null) {
                if ($.isFunction(opts.ajax.processResults)) {
                    opts.ajax.results = opts.ajax.processResults;
                }
            }

            // Formatters/language options
            if (opts.language != null) {
                var lang = opts.language;

                // formatNoMatches -> language.noMatches
                if ($.isFunction(lang.noMatches)) {
                    opts.formatNoMatches = lang.noMatches;
                }

                // formatSearching -> language.searching
                if ($.isFunction(lang.searching)) {
                    opts.formatSearching = lang.searching;
                }

                // formatInputTooShort -> language.inputTooShort
                if ($.isFunction(lang.inputTooShort)) {
                    opts.formatInputTooShort = lang.inputTooShort;
                }

                // formatInputTooLong -> language.inputTooLong
                if ($.isFunction(lang.inputTooLong)) {
                    opts.formatInputTooLong = lang.inputTooLong;
                }

                // formatLoading -> language.loadingMore
                if ($.isFunction(lang.loadingMore)) {
                    opts.formatLoading = lang.loadingMore;
                }

                // formatSelectionTooBig -> language.maximumSelected
                if ($.isFunction(lang.maximumSelected)) {
                    opts.formatSelectionTooBig = lang.maximumSelected;
                }
            }

            opts = $.extend({}, {
                populateResults: function(container, results, query) {
                    var populate, id=this.opts.id, liveRegion=this.liveRegion;

                    populate=function(results, container, depth) {

                        var i, l, result, selectable, disabled, compound, node, label, innerContainer, formatted;

                        results = opts.sortResults(results, container, query);

                        // collect the created nodes for bulk append
                        var nodes = [];
                        for (i = 0, l = results.length; i < l; i = i + 1) {

                            result=results[i];

                            disabled = (result.disabled === true);
                            selectable = (!disabled) && (id(result) !== undefined);

                            compound=result.children && result.children.length > 0;

                            node=$("<li></li>");
                            node.addClass("select2-results-dept-"+depth);
                            node.addClass("select2-result");
                            node.addClass(selectable ? "select2-result-selectable" : "select2-result-unselectable");
                            if (disabled) { node.addClass("select2-disabled"); }
                            if (compound) { node.addClass("select2-result-with-children"); }
                            node.addClass(self.opts.formatResultCssClass(result));
                            node.attr("role", "presentation");

                            label=$(document.createElement("div"));
                            label.addClass("select2-result-label");
                            label.attr("id", "select2-result-label-" + nextUid());
                            label.attr("role", "option");

                            formatted=opts.formatResult(result, label, query, self.opts.escapeMarkup);
                            if (formatted!==undefined) {
                                label.html(formatted);
                                node.append(label);
                            }


                            if (compound) {
                                innerContainer=$("<ul></ul>");
                                innerContainer.addClass("select2-result-sub");
                                populate(result.children, innerContainer, depth+1);
                                node.append(innerContainer);
                            }

                            node.data("select2-data", result);
                            nodes.push(node[0]);
                        }

                        // bulk append the created nodes
                        container.append(nodes);
                        liveRegion.text(opts.formatMatches(results.length));
                    };

                    populate(results, container, 0);
                }
            }, $.fn.select2.defaults, opts);

            if (typeof(opts.id) !== "function") {
                idKey = opts.id;
                opts.id = function (e) { return e[idKey]; };
            }

            if ($.isArray(opts.element.data("select2Tags"))) {
                if ("tags" in opts) {
                    throw "tags specified as both an attribute 'data-select2-tags' and in options of Select2 " + opts.element.attr("id");
                }
                opts.tags=opts.element.data("select2Tags");
            }

            if (select) {
                opts.query = this.bind(function (query) {
                    var data = { results: [], more: false },
                        term = query.term,
                        children, placeholderOption, process;

                    process=function(element, collection) {
                        var group;
                        if (element.is("option")) {
                            if (query.matcher(term, element.text(), element)) {
                                collection.push(self.optionToData(element));
                            }
                        } else if (element.is("optgroup")) {
                            group=self.optionToData(element);
                            element.children().each2(function(i, elm) { process(elm, group.children); });
                            if (group.children.length>0) {
                                collection.push(group);
                            }
                        }
                    };

                    children=element.children();

                    // ignore the placeholder option if there is one
                    if (this.getPlaceholder() !== undefined && children.length > 0) {
                        placeholderOption = this.getPlaceholderOption();
                        if (placeholderOption) {
                            children=children.not(placeholderOption);
                        }
                    }

                    children.each2(function(i, elm) { process(elm, data.results); });

                    query.callback(data);
                });
                // this is needed because inside val() we construct choices from options and their id is hardcoded
                opts.id=function(e) { return e.id; };
            } else {
                if (!("query" in opts)) {
                    if ("ajax" in opts) {
                        ajaxUrl = opts.element.data("ajax-url");
                        if (ajaxUrl && ajaxUrl.length > 0) {
                            opts.ajax.url = ajaxUrl;
                        }
                        opts.query = ajax.call(opts.element, opts.ajax);
                    } else if ("data" in opts) {
                        opts.query = local(opts.data);
                    } else if ("tags" in opts) {
                        opts.query = tags(opts.tags);
                        if (opts.createSearchChoice === undefined) {
                            opts.createSearchChoice = function (term) { return {id: $.trim(term), text: $.trim(term)}; };
                        }
                        if (opts.initSelection === undefined) {
                            opts.initSelection = function (element, callback) {
                                var data = [];
                                $(splitVal(element.val(), opts.separator, opts.transformVal)).each(function () {
                                    var obj = { id: this, text: this },
                                        tags = opts.tags;
                                    if ($.isFunction(tags)) tags=tags();
                                    $(tags).each(function() { if (equal(this.id, obj.id)) { obj = this; return false; } });
                                    data.push(obj);
                                });

                                callback(data);
                            };
                        }
                    }
                }
            }
            if (typeof(opts.query) !== "function") {
                throw "query function not defined for Select2 " + opts.element.attr("id");
            }

            if (opts.createSearchChoicePosition === 'top') {
                opts.createSearchChoicePosition = function(list, item) { list.unshift(item); };
            }
            else if (opts.createSearchChoicePosition === 'bottom') {
                opts.createSearchChoicePosition = function(list, item) { list.push(item); };
            }
            else if (typeof(opts.createSearchChoicePosition) !== "function")  {
                throw "invalid createSearchChoicePosition option must be 'top', 'bottom' or a custom function";
            }

            return opts;
        },

        /**
         * Monitor the original element for changes and update select2 accordingly
         */
        // abstract
        monitorSource: function () {
            var el = this.opts.element, observer, self = this;

            el.on("change.select2", this.bind(function (e) {
                if (this.opts.element.data("select2-change-triggered") !== true) {
                    this.initSelection();
                }
            }));

            this._sync = this.bind(function () {

                // sync enabled state
                var disabled = el.prop("disabled");
                if (disabled === undefined) disabled = false;
                this.enable(!disabled);

                var readonly = el.prop("readonly");
                if (readonly === undefined) readonly = false;
                this.readonly(readonly);

                if (this.container) {
                    syncCssClasses(this.container, this.opts.element, this.opts.adaptContainerCssClass);
                    this.container.addClass(evaluate(this.opts.containerCssClass, this.opts.element));
                }

                if (this.dropdown) {
                    syncCssClasses(this.dropdown, this.opts.element, this.opts.adaptDropdownCssClass);
                    this.dropdown.addClass(evaluate(this.opts.dropdownCssClass, this.opts.element));
                }

            });

            // IE8-10 (IE9/10 won't fire propertyChange via attachEventListener)
            if (el.length && el[0].attachEvent) {
                el.each(function() {
                    this.attachEvent("onpropertychange", self._sync);
                });
            }

            // safari, chrome, firefox, IE11
            observer = window.MutationObserver || window.WebKitMutationObserver|| window.MozMutationObserver;
            if (observer !== undefined) {
                if (this.propertyObserver) { delete this.propertyObserver; this.propertyObserver = null; }
                this.propertyObserver = new observer(function (mutations) {
                    $.each(mutations, self._sync);
                });
                this.propertyObserver.observe(el.get(0), { attributes:true, subtree:false });
            }
        },

        // abstract
        triggerSelect: function(data) {
            var evt = $.Event("select2-selecting", { val: this.id(data), object: data, choice: data });
            this.opts.element.trigger(evt);
            return !evt.isDefaultPrevented();
        },

        /**
         * Triggers the change event on the source element
         */
        // abstract
        triggerChange: function (details) {

            details = details || {};
            details= $.extend({}, details, { type: "change", val: this.val() });
            // prevents recursive triggering
            this.opts.element.data("select2-change-triggered", true);
            this.opts.element.trigger(details);
            this.opts.element.data("select2-change-triggered", false);

            // some validation frameworks ignore the change event and listen instead to keyup, click for selects
            // so here we trigger the click event manually
            this.opts.element.click();

            // ValidationEngine ignores the change event and listens instead to blur
            // so here we trigger the blur event manually if so desired
            if (this.opts.blurOnChange)
                this.opts.element.blur();
        },

        //abstract
        isInterfaceEnabled: function()
        {
            return this.enabledInterface === true;
        },

        // abstract
        enableInterface: function() {
            var enabled = this._enabled && !this._readonly,
                disabled = !enabled;

            if (enabled === this.enabledInterface) return false;

            this.container.toggleClass("select2-container-disabled", disabled);
            this.close();
            this.enabledInterface = enabled;

            return true;
        },

        // abstract
        enable: function(enabled) {
            if (enabled === undefined) enabled = true;
            if (this._enabled === enabled) return;
            this._enabled = enabled;

            this.opts.element.prop("disabled", !enabled);
            this.enableInterface();
        },

        // abstract
        disable: function() {
            this.enable(false);
        },

        // abstract
        readonly: function(enabled) {
            if (enabled === undefined) enabled = false;
            if (this._readonly === enabled) return;
            this._readonly = enabled;

            this.opts.element.prop("readonly", enabled);
            this.enableInterface();
        },

        // abstract
        opened: function () {
            return (this.container) ? this.container.hasClass("select2-dropdown-open") : false;
        },

        // abstract
        positionDropdown: function() {
            var $dropdown = this.dropdown,
                container = this.container,
                offset = container.offset(),
                height = container.outerHeight(false),
                width = container.outerWidth(false),
                dropHeight = $dropdown.outerHeight(false),
                $window = $(window),
                windowWidth = $window.width(),
                windowHeight = $window.height(),
                viewPortRight = $window.scrollLeft() + windowWidth,
                viewportBottom = $window.scrollTop() + windowHeight,
                dropTop = offset.top + height,
                dropLeft = offset.left,
                enoughRoomBelow = dropTop + dropHeight <= viewportBottom,
                enoughRoomAbove = (offset.top - dropHeight) >= $window.scrollTop(),
                dropWidth = $dropdown.outerWidth(false),
                enoughRoomOnRight = function() {
                    return dropLeft + dropWidth <= viewPortRight;
                },
                enoughRoomOnLeft = function() {
                    return offset.left + viewPortRight + container.outerWidth(false)  > dropWidth;
                },
                aboveNow = $dropdown.hasClass("select2-drop-above"),
                bodyOffset,
                above,
                changeDirection,
                css,
                resultsListNode;

            // always prefer the current above/below alignment, unless there is not enough room
            if (aboveNow) {
                above = true;
                if (!enoughRoomAbove && enoughRoomBelow) {
                    changeDirection = true;
                    above = false;
                }
            } else {
                above = false;
                if (!enoughRoomBelow && enoughRoomAbove) {
                    changeDirection = true;
                    above = true;
                }
            }

            //if we are changing direction we need to get positions when dropdown is hidden;
            if (changeDirection) {
                $dropdown.hide();
                offset = this.container.offset();
                height = this.container.outerHeight(false);
                width = this.container.outerWidth(false);
                dropHeight = $dropdown.outerHeight(false);
                viewPortRight = $window.scrollLeft() + windowWidth;
                viewportBottom = $window.scrollTop() + windowHeight;
                dropTop = offset.top + height;
                dropLeft = offset.left;
                dropWidth = $dropdown.outerWidth(false);
                $dropdown.show();

                // fix so the cursor does not move to the left within the search-textbox in IE
                this.focusSearch();
            }

            if (this.opts.dropdownAutoWidth) {
                resultsListNode = $('.select2-results', $dropdown)[0];
                $dropdown.addClass('select2-drop-auto-width');
                $dropdown.css('width', '');
                // Add scrollbar width to dropdown if vertical scrollbar is present
                dropWidth = $dropdown.outerWidth(false) + (resultsListNode.scrollHeight === resultsListNode.clientHeight ? 0 : scrollBarDimensions.width);
                dropWidth > width ? width = dropWidth : dropWidth = width;
                dropHeight = $dropdown.outerHeight(false);
            }
            else {
                this.container.removeClass('select2-drop-auto-width');
            }

            //console.log("below/ droptop:", dropTop, "dropHeight", dropHeight, "sum", (dropTop+dropHeight)+" viewport bottom", viewportBottom, "enough?", enoughRoomBelow);
            //console.log("above/ offset.top", offset.top, "dropHeight", dropHeight, "top", (offset.top-dropHeight), "scrollTop", this.body.scrollTop(), "enough?", enoughRoomAbove);

            // fix positioning when body has an offset and is not position: static
            if (this.body.css('position') !== 'static') {
                bodyOffset = this.body.offset();
                dropTop -= bodyOffset.top;
                dropLeft -= bodyOffset.left;
            }

            if (!enoughRoomOnRight() && enoughRoomOnLeft()) {
                dropLeft = offset.left + this.container.outerWidth(false) - dropWidth;
            }

            css =  {
                left: dropLeft,
                width: width
            };

            if (above) {
                this.container.addClass("select2-drop-above");
                $dropdown.addClass("select2-drop-above");
                dropHeight = $dropdown.outerHeight(false);
                css.top = offset.top - dropHeight;
                css.bottom = 'auto';
            }
            else {
                css.top = dropTop;
                css.bottom = 'auto';
                this.container.removeClass("select2-drop-above");
                $dropdown.removeClass("select2-drop-above");
            }
            css = $.extend(css, evaluate(this.opts.dropdownCss, this.opts.element));

            $dropdown.css(css);
        },

        // abstract
        shouldOpen: function() {
            var event;

            if (this.opened()) return false;

            if (this._enabled === false || this._readonly === true) return false;

            event = $.Event("select2-opening");
            this.opts.element.trigger(event);
            return !event.isDefaultPrevented();
        },

        // abstract
        clearDropdownAlignmentPreference: function() {
            // clear the classes used to figure out the preference of where the dropdown should be opened
            this.container.removeClass("select2-drop-above");
            this.dropdown.removeClass("select2-drop-above");
        },

        /**
         * Opens the dropdown
         *
         * @return {Boolean} whether or not dropdown was opened. This method will return false if, for example,
         * the dropdown is already open, or if the 'open' event listener on the element called preventDefault().
         */
        // abstract
        open: function () {

            if (!this.shouldOpen()) return false;

            this.opening();

            // Only bind the document mousemove when the dropdown is visible
            $document.on("mousemove.select2Event", function (e) {
                lastMousePosition.x = e.pageX;
                lastMousePosition.y = e.pageY;
            });

            return true;
        },

        /**
         * Performs the opening of the dropdown
         */
        // abstract
        opening: function() {
            var cid = this.containerEventName,
                scroll = "scroll." + cid,
                resize = "resize."+cid,
                orient = "orientationchange."+cid,
                mask;

            this.container.addClass("select2-dropdown-open").addClass("select2-container-active");

            this.clearDropdownAlignmentPreference();

            if(this.dropdown[0] !== this.body.children().last()[0]) {
                this.dropdown.detach().appendTo(this.body);
            }

            // create the dropdown mask if doesn't already exist
            mask = $("#select2-drop-mask");
            if (mask.length === 0) {
                mask = $(document.createElement("div"));
                mask.attr("id","select2-drop-mask").attr("class","select2-drop-mask");
                mask.hide();
                mask.appendTo(this.body);
                mask.on("mousedown touchstart click", function (e) {
                    // Prevent IE from generating a click event on the body
                    reinsertElement(mask);

                    var dropdown = $("#select2-drop"), self;
                    if (dropdown.length > 0) {
                        self=dropdown.data("select2");
                        if (self.opts.selectOnBlur) {
                            self.selectHighlighted({noFocus: true});
                        }
                        self.close();
                        e.preventDefault();
                        e.stopPropagation();
                    }
                });
            }

            // ensure the mask is always right before the dropdown
            if (this.dropdown.prev()[0] !== mask[0]) {
                this.dropdown.before(mask);
            }

            // move the global id to the correct dropdown
            $("#select2-drop").removeAttr("id");
            this.dropdown.attr("id", "select2-drop");

            // show the elements
            mask.show();

            this.positionDropdown();
            this.dropdown.show();
            this.positionDropdown();

            this.dropdown.addClass("select2-drop-active");

            // attach listeners to events that can change the position of the container and thus require
            // the position of the dropdown to be updated as well so it does not come unglued from the container
            var that = this;
            this.container.parents().add(window).each(function () {
                $(this).on(resize+" "+scroll+" "+orient, function (e) {
                    if (that.opened()) that.positionDropdown();
                });
            });


        },

        // abstract
        close: function () {
            if (!this.opened()) return;

            var cid = this.containerEventName,
                scroll = "scroll." + cid,
                resize = "resize."+cid,
                orient = "orientationchange."+cid;

            // unbind event listeners
            this.container.parents().add(window).each(function () { $(this).off(scroll).off(resize).off(orient); });

            this.clearDropdownAlignmentPreference();

            $("#select2-drop-mask").hide();
            this.dropdown.removeAttr("id"); // only the active dropdown has the select2-drop id
            this.dropdown.hide();
            this.container.removeClass("select2-dropdown-open").removeClass("select2-container-active");
            this.results.empty();

            // Now that the dropdown is closed, unbind the global document mousemove event
            $document.off("mousemove.select2Event");

            this.clearSearch();
            this.search.removeClass("select2-active");

            // Remove the aria active descendant for highlighted element
            this.search.removeAttr("aria-activedescendant");
            this.opts.element.trigger($.Event("select2-close"));
        },

        /**
         * Opens control, sets input value, and updates results.
         */
        // abstract
        externalSearch: function (term) {
            this.open();
            this.search.val(term);
            this.updateResults(false);
        },

        // abstract
        clearSearch: function () {

        },

        /**
         * @return {Boolean} Whether or not search value was changed.
         * @private
         */
        prefillNextSearchTerm: function () {
            // initializes search's value with nextSearchTerm (if defined by user)
            // ignore nextSearchTerm if the dropdown is opened by the user pressing a letter
            if(this.search.val() !== "") {
                return false;
            }

            var nextSearchTerm = this.opts.nextSearchTerm(this.data(), this.lastSearchTerm);
            if(nextSearchTerm !== undefined){
                this.search.val(nextSearchTerm);
                this.search.select();
                return true;
            }

            return false;
        },

        //abstract
        getMaximumSelectionSize: function() {
            return evaluate(this.opts.maximumSelectionSize, this.opts.element);
        },

        // abstract
        ensureHighlightVisible: function () {
            var results = this.results, children, index, child, hb, rb, y, more, topOffset;

            index = this.highlight();

            if (index < 0) return;

            if (index == 0) {

                // if the first element is highlighted scroll all the way to the top,
                // that way any unselectable headers above it will also be scrolled
                // into view

                results.scrollTop(0);
                return;
            }

            children = this.findHighlightableChoices().find('.select2-result-label');

            child = $(children[index]);

            topOffset = (child.offset() || {}).top || 0;

            hb = topOffset + child.outerHeight(true);

            // if this is the last child lets also make sure select2-more-results is visible
            if (index === children.length - 1) {
                more = results.find("li.select2-more-results");
                if (more.length > 0) {
                    hb = more.offset().top + more.outerHeight(true);
                }
            }

            rb = results.offset().top + results.outerHeight(false);
            if (hb > rb) {
                results.scrollTop(results.scrollTop() + (hb - rb));
            }
            y = topOffset - results.offset().top;

            // make sure the top of the element is visible
            if (y < 0 && child.css('display') != 'none' ) {
                results.scrollTop(results.scrollTop() + y); // y is negative
            }
        },

        // abstract
        findHighlightableChoices: function() {
            return this.results.find(".select2-result-selectable:not(.select2-disabled):not(.select2-selected)");
        },

        // abstract
        moveHighlight: function (delta) {
            var choices = this.findHighlightableChoices(),
                index = this.highlight();

            while (index > -1 && index < choices.length) {
                index += delta;
                var choice = $(choices[index]);
                if (choice.hasClass("select2-result-selectable") && !choice.hasClass("select2-disabled") && !choice.hasClass("select2-selected")) {
                    this.highlight(index);
                    break;
                }
            }
        },

        // abstract
        highlight: function (index) {
            var choices = this.findHighlightableChoices(),
                choice,
                data;

            if (arguments.length === 0) {
                return indexOf(choices.filter(".select2-highlighted")[0], choices.get());
            }

            if (index >= choices.length) index = choices.length - 1;
            if (index < 0) index = 0;

            this.removeHighlight();

            choice = $(choices[index]);
            choice.addClass("select2-highlighted");

            // ensure assistive technology can determine the active choice
            this.search.attr("aria-activedescendant", choice.find(".select2-result-label").attr("id"));

            this.ensureHighlightVisible();

            this.liveRegion.text(choice.text());

            data = choice.data("select2-data");
            if (data) {
                this.opts.element.trigger({ type: "select2-highlight", val: this.id(data), choice: data });
            }
        },

        removeHighlight: function() {
            this.results.find(".select2-highlighted").removeClass("select2-highlighted");
        },

        touchMoved: function() {
            this._touchMoved = true;
        },

        clearTouchMoved: function() {
          this._touchMoved = false;
        },

        // abstract
        countSelectableResults: function() {
            return this.findHighlightableChoices().length;
        },

        // abstract
        highlightUnderEvent: function (event) {
            var el = $(event.target).closest(".select2-result-selectable");
            if (el.length > 0 && !el.is(".select2-highlighted")) {
                var choices = this.findHighlightableChoices();
                this.highlight(choices.index(el));
            } else if (el.length == 0) {
                // if we are over an unselectable item remove all highlights
                this.removeHighlight();
            }
        },

        // abstract
        loadMoreIfNeeded: function () {
            var results = this.results,
                more = results.find("li.select2-more-results"),
                below, // pixels the element is below the scroll fold, below==0 is when the element is starting to be visible
                page = this.resultsPage + 1,
                self=this,
                term=this.search.val(),
                context=this.context;

            if (more.length === 0) return;
            below = more.offset().top - results.offset().top - results.height();

            if (below <= this.opts.loadMorePadding) {
                more.addClass("select2-active");
                this.opts.query({
                        element: this.opts.element,
                        term: term,
                        page: page,
                        context: context,
                        matcher: this.opts.matcher,
                        callback: this.bind(function (data) {

                    // ignore a response if the select2 has been closed before it was received
                    if (!self.opened()) return;


                    self.opts.populateResults.call(this, results, data.results, {term: term, page: page, context:context});
                    self.postprocessResults(data, false, false);

                    if (data.more===true) {
                        more.detach().appendTo(results).html(self.opts.escapeMarkup(evaluate(self.opts.formatLoadMore, self.opts.element, page+1)));
                        window.setTimeout(function() { self.loadMoreIfNeeded(); }, 10);
                    } else {
                        more.remove();
                    }
                    self.positionDropdown();
                    self.resultsPage = page;
                    self.context = data.context;
                    this.opts.element.trigger({ type: "select2-loaded", items: data });
                })});
            }
        },

        /**
         * Default tokenizer function which does nothing
         */
        tokenize: function() {

        },

        /**
         * @param initial whether or not this is the call to this method right after the dropdown has been opened
         */
        // abstract
        updateResults: function (initial) {
            var search = this.search,
                results = this.results,
                opts = this.opts,
                data,
                self = this,
                input,
                term = search.val(),
                lastTerm = $.data(this.container, "select2-last-term"),
                // sequence number used to drop out-of-order responses
                queryNumber;

            // prevent duplicate queries against the same term
            if (initial !== true && lastTerm && equal(term, lastTerm)) return;

            $.data(this.container, "select2-last-term", term);

            // if the search is currently hidden we do not alter the results
            if (initial !== true && (this.showSearchInput === false || !this.opened())) {
                return;
            }

            function postRender() {
                search.removeClass("select2-active");
                self.positionDropdown();
                if (results.find('.select2-no-results,.select2-selection-limit,.select2-searching').length) {
                    self.liveRegion.text(results.text());
                }
                else {
                    self.liveRegion.text(self.opts.formatMatches(results.find('.select2-result-selectable:not(".select2-selected")').length));
                }
            }

            function render(html) {
                results.html(html);
                postRender();
            }

            queryNumber = ++this.queryCount;

            var maxSelSize = this.getMaximumSelectionSize();
            if (maxSelSize >=1) {
                data = this.data();
                if ($.isArray(data) && data.length >= maxSelSize && checkFormatter(opts.formatSelectionTooBig, "formatSelectionTooBig")) {
                    render("<li class='select2-selection-limit'>" + evaluate(opts.formatSelectionTooBig, opts.element, maxSelSize) + "</li>");
                    return;
                }
            }

            if (search.val().length < opts.minimumInputLength) {
                if (checkFormatter(opts.formatInputTooShort, "formatInputTooShort")) {
                    render("<li class='select2-no-results'>" + evaluate(opts.formatInputTooShort, opts.element, search.val(), opts.minimumInputLength) + "</li>");
                } else {
                    render("");
                }
                if (initial && this.showSearch) this.showSearch(true);
                return;
            }

            if (opts.maximumInputLength && search.val().length > opts.maximumInputLength) {
                if (checkFormatter(opts.formatInputTooLong, "formatInputTooLong")) {
                    render("<li class='select2-no-results'>" + evaluate(opts.formatInputTooLong, opts.element, search.val(), opts.maximumInputLength) + "</li>");
                } else {
                    render("");
                }
                return;
            }

            if (opts.formatSearching && this.findHighlightableChoices().length === 0) {
                render("<li class='select2-searching'>" + evaluate(opts.formatSearching, opts.element) + "</li>");
            }

            search.addClass("select2-active");

            this.removeHighlight();

            // give the tokenizer a chance to pre-process the input
            input = this.tokenize();
            if (input != undefined && input != null) {
                search.val(input);
            }

            this.resultsPage = 1;

            opts.query({
                element: opts.element,
                    term: search.val(),
                    page: this.resultsPage,
                    context: null,
                    matcher: opts.matcher,
                    callback: this.bind(function (data) {
                var def; // default choice

                // ignore old responses
                if (queryNumber != this.queryCount) {
                  return;
                }

                // ignore a response if the select2 has been closed before it was received
                if (!this.opened()) {
                    this.search.removeClass("select2-active");
                    return;
                }

                // handle ajax error
                if(data.hasError !== undefined && checkFormatter(opts.formatAjaxError, "formatAjaxError")) {
                    render("<li class='select2-ajax-error'>" + evaluate(opts.formatAjaxError, opts.element, data.jqXHR, data.textStatus, data.errorThrown) + "</li>");
                    return;
                }

                // save context, if any
                this.context = (data.context===undefined) ? null : data.context;
                // create a default choice and prepend it to the list
                if (this.opts.createSearchChoice && search.val() !== "") {
                    def = this.opts.createSearchChoice.call(self, search.val(), data.results);
                    if (def !== undefined && def !== null && self.id(def) !== undefined && self.id(def) !== null) {
                        if ($(data.results).filter(
                            function () {
                                return equal(self.id(this), self.id(def));
                            }).length === 0) {
                            this.opts.createSearchChoicePosition(data.results, def);
                        }
                    }
                }

                if (data.results.length === 0 && checkFormatter(opts.formatNoMatches, "formatNoMatches")) {
                    render("<li class='select2-no-results'>" + evaluate(opts.formatNoMatches, opts.element, search.val()) + "</li>");
                    if(this.showSearch){
                        this.showSearch(search.val());
                    }
                    return;
                }

                results.empty();
                self.opts.populateResults.call(this, results, data.results, {term: search.val(), page: this.resultsPage, context:null});

                if (data.more === true && checkFormatter(opts.formatLoadMore, "formatLoadMore")) {
                    results.append("<li class='select2-more-results'>" + opts.escapeMarkup(evaluate(opts.formatLoadMore, opts.element, this.resultsPage)) + "</li>");
                    window.setTimeout(function() { self.loadMoreIfNeeded(); }, 10);
                }

                this.postprocessResults(data, initial);

                postRender();

                this.opts.element.trigger({ type: "select2-loaded", items: data });
            })});
        },

        // abstract
        cancel: function () {
            this.close();
        },

        // abstract
        blur: function () {
            // if selectOnBlur == true, select the currently highlighted option
            if (this.opts.selectOnBlur)
                this.selectHighlighted({noFocus: true});

            this.close();
            this.container.removeClass("select2-container-active");
            // synonymous to .is(':focus'), which is available in jquery >= 1.6
            if (this.search[0] === document.activeElement) { this.search.blur(); }
            this.clearSearch();
            this.selection.find(".select2-search-choice-focus").removeClass("select2-search-choice-focus");
        },

        // abstract
        focusSearch: function () {
            focus(this.search);
        },

        // abstract
        selectHighlighted: function (options) {
            if (this._touchMoved) {
              this.clearTouchMoved();
              return;
            }
            var index=this.highlight(),
                highlighted=this.results.find(".select2-highlighted"),
                data = highlighted.closest('.select2-result').data("select2-data");

            if (data) {
                this.highlight(index);
                this.onSelect(data, options);
            } else if (options && options.noFocus) {
                this.close();
            }
        },

        // abstract
        getPlaceholder: function () {
            var placeholderOption;
            return this.opts.element.attr("placeholder") ||
                this.opts.element.attr("data-placeholder") || // jquery 1.4 compat
                this.opts.element.data("placeholder") ||
                this.opts.placeholder ||
                ((placeholderOption = this.getPlaceholderOption()) !== undefined ? placeholderOption.text() : undefined);
        },

        // abstract
        getPlaceholderOption: function() {
            if (this.select) {
                var firstOption = this.select.children('option').first();
                if (this.opts.placeholderOption !== undefined ) {
                    //Determine the placeholder option based on the specified placeholderOption setting
                    return (this.opts.placeholderOption === "first" && firstOption) ||
                           (typeof this.opts.placeholderOption === "function" && this.opts.placeholderOption(this.select));
                } else if ($.trim(firstOption.text()) === "" && firstOption.val() === "") {
                    //No explicit placeholder option specified, use the first if it's blank
                    return firstOption;
                }
            }
        },

        /**
         * Get the desired width for the container element.  This is
         * derived first from option `width` passed to select2, then
         * the inline 'style' on the original element, and finally
         * falls back to the jQuery calculated element width.
         */
        // abstract
        initContainerWidth: function () {
            function resolveContainerWidth() {
                var style, attrs, matches, i, l, attr;

                if (this.opts.width === "off") {
                    return null;
                } else if (this.opts.width === "element"){
                    return this.opts.element.outerWidth(false) === 0 ? 'auto' : this.opts.element.outerWidth(false) + 'px';
                } else if (this.opts.width === "copy" || this.opts.width === "resolve") {
                    // check if there is inline style on the element that contains width
                    style = this.opts.element.attr('style');
                    if (typeof(style) === "string") {
                        attrs = style.split(';');
                        for (i = 0, l = attrs.length; i < l; i = i + 1) {
                            attr = attrs[i].replace(/\s/g, '');
                            matches = attr.match(/^width:(([-+]?([0-9]*\.)?[0-9]+)(px|em|ex|%|in|cm|mm|pt|pc))/i);
                            if (matches !== null && matches.length >= 1)
                                return matches[1];
                        }
                    }

                    if (this.opts.width === "resolve") {
                        // next check if css('width') can resolve a width that is percent based, this is sometimes possible
                        // when attached to input type=hidden or elements hidden via css
                        style = this.opts.element.css('width');
                        if (style.indexOf("%") > 0) return style;

                        // finally, fallback on the calculated width of the element
                        return (this.opts.element.outerWidth(false) === 0 ? 'auto' : this.opts.element.outerWidth(false) + 'px');
                    }

                    return null;
                } else if ($.isFunction(this.opts.width)) {
                    return this.opts.width();
                } else {
                    return this.opts.width;
               }
            };

            var width = resolveContainerWidth.call(this);
            if (width !== null) {
                this.container.css("width", width);
            }
        }
    });

    SingleSelect2 = clazz(AbstractSelect2, {

        // single

        createContainer: function () {
            var container = $(document.createElement("div")).attr({
                "class": "select2-container"
            }).html([
                "<a href='javascript:void(0)' class='select2-choice' tabindex='-1'>",
                "   <span class='select2-chosen'>&#160;</span><abbr class='select2-search-choice-close'></abbr>",
                "   <span class='select2-arrow' role='presentation'><b role='presentation'></b></span>",
                "</a>",
                "<label for='' class='select2-offscreen'></label>",
                "<input class='select2-focusser select2-offscreen' type='text' aria-haspopup='true' role='button' />",
                "<div class='select2-drop select2-display-none'>",
                "   <div class='select2-search'>",
                "       <label for='' class='select2-offscreen'></label>",
                "       <input type='text' autocomplete='off' autocorrect='off' autocapitalize='off' spellcheck='false' class='select2-input' role='combobox' aria-expanded='true'",
                "       aria-autocomplete='list' />",
                "   </div>",
                "   <ul class='select2-results' role='listbox'>",
                "   </ul>",
                "</div>"].join(""));
            return container;
        },

        // single
        enableInterface: function() {
            if (this.parent.enableInterface.apply(this, arguments)) {
                this.focusser.prop("disabled", !this.isInterfaceEnabled());
            }
        },

        // single
        opening: function () {
            var el, range, len;

            if (this.opts.minimumResultsForSearch >= 0) {
                this.showSearch(true);
            }

            this.parent.opening.apply(this, arguments);

            if (this.showSearchInput !== false) {
                // IE appends focusser.val() at the end of field :/ so we manually insert it at the beginning using a range
                // all other browsers handle this just fine

                this.search.val(this.focusser.val());
            }
            if (this.opts.shouldFocusInput(this)) {
                this.search.focus();
                // move the cursor to the end after focussing, otherwise it will be at the beginning and
                // new text will appear *before* focusser.val()
                el = this.search.get(0);
                if (el.createTextRange) {
                    range = el.createTextRange();
                    range.collapse(false);
                    range.select();
                } else if (el.setSelectionRange) {
                    len = this.search.val().length;
                    el.setSelectionRange(len, len);
                }
            }

            this.prefillNextSearchTerm();

            this.focusser.prop("disabled", true).val("");
            this.updateResults(true);
            this.opts.element.trigger($.Event("select2-open"));
        },

        // single
        close: function () {
            if (!this.opened()) return;
            this.parent.close.apply(this, arguments);

            this.focusser.prop("disabled", false);

            if (this.opts.shouldFocusInput(this)) {
                this.focusser.focus();
            }
        },

        // single
        focus: function () {
            if (this.opened()) {
                this.close();
            } else {
                this.focusser.prop("disabled", false);
                if (this.opts.shouldFocusInput(this)) {
                    this.focusser.focus();
                }
            }
        },

        // single
        isFocused: function () {
            return this.container.hasClass("select2-container-active");
        },

        // single
        cancel: function () {
            this.parent.cancel.apply(this, arguments);
            this.focusser.prop("disabled", false);

            if (this.opts.shouldFocusInput(this)) {
                this.focusser.focus();
            }
        },

        // single
        destroy: function() {
            $("label[for='" + this.focusser.attr('id') + "']")
                .attr('for', this.opts.element.attr("id"));
            this.parent.destroy.apply(this, arguments);

            cleanupJQueryElements.call(this,
                "selection",
                "focusser"
            );
        },

        // single
        initContainer: function () {

            var selection,
                container = this.container,
                dropdown = this.dropdown,
                idSuffix = nextUid(),
                elementLabel;

            if (this.opts.minimumResultsForSearch < 0) {
                this.showSearch(false);
            } else {
                this.showSearch(true);
            }

            this.selection = selection = container.find(".select2-choice");

            this.focusser = container.find(".select2-focusser");

            // add aria associations
            selection.find(".select2-chosen").attr("id", "select2-chosen-"+idSuffix);
            this.focusser.attr("aria-labelledby", "select2-chosen-"+idSuffix);
            this.results.attr("id", "select2-results-"+idSuffix);
            this.search.attr("aria-owns", "select2-results-"+idSuffix);

            // rewrite labels from original element to focusser
            this.focusser.attr("id", "s2id_autogen"+idSuffix);

            elementLabel = $("label[for='" + this.opts.element.attr("id") + "']");
            this.opts.element.on('focus.select2', this.bind(function () { this.focus(); }));

            this.focusser.prev()
                .text(elementLabel.text())
                .attr('for', this.focusser.attr('id'));

            // Ensure the original element retains an accessible name
            var originalTitle = this.opts.element.attr("title");
            this.opts.element.attr("title", (originalTitle || elementLabel.text()));

            this.focusser.attr("tabindex", this.elementTabIndex);

            // write label for search field using the label from the focusser element
            this.search.attr("id", this.focusser.attr('id') + '_search');

            this.search.prev()
                .text($("label[for='" + this.focusser.attr('id') + "']").text())
                .attr('for', this.search.attr('id'));

            this.search.on("keydown", this.bind(function (e) {
                if (!this.isInterfaceEnabled()) return;

                // filter 229 keyCodes (input method editor is processing key input)
                if (229 == e.keyCode) return;

                if (e.which === KEY.PAGE_UP || e.which === KEY.PAGE_DOWN) {
                    // prevent the page from scrolling
                    killEvent(e);
                    return;
                }

                switch (e.which) {
                    case KEY.UP:
                    case KEY.DOWN:
                        this.moveHighlight((e.which === KEY.UP) ? -1 : 1);
                        killEvent(e);
                        return;
                    case KEY.ENTER:
                        this.selectHighlighted();
                        killEvent(e);
                        return;
                    case KEY.TAB:
                        this.selectHighlighted({noFocus: true});
                        return;
                    case KEY.ESC:
                        this.cancel(e);
                        killEvent(e);
                        return;
                }
            }));

            this.search.on("blur", this.bind(function(e) {
                // a workaround for chrome to keep the search field focussed when the scroll bar is used to scroll the dropdown.
                // without this the search field loses focus which is annoying
                if (document.activeElement === this.body.get(0)) {
                    window.setTimeout(this.bind(function() {
                        if (this.opened() && this.results && this.results.length > 1) {
                            this.search.focus();
                        }
                    }), 0);
                }
            }));

            this.focusser.on("keydown", this.bind(function (e) {
                if (!this.isInterfaceEnabled()) return;

                if (e.which === KEY.TAB || KEY.isControl(e) || KEY.isFunctionKey(e) || e.which === KEY.ESC) {
                    return;
                }

                if (this.opts.openOnEnter === false && e.which === KEY.ENTER) {
                    killEvent(e);
                    return;
                }

                if (e.which == KEY.DOWN || e.which == KEY.UP
                    || (e.which == KEY.ENTER && this.opts.openOnEnter)) {

                    if (e.altKey || e.ctrlKey || e.shiftKey || e.metaKey) return;

                    this.open();
                    killEvent(e);
                    return;
                }

                if (e.which == KEY.DELETE || e.which == KEY.BACKSPACE) {
                    if (this.opts.allowClear) {
                        this.clear();
                    }
                    killEvent(e);
                    return;
                }
            }));


            installKeyUpChangeEvent(this.focusser);
            this.focusser.on("keyup-change input", this.bind(function(e) {
                if (this.opts.minimumResultsForSearch >= 0) {
                    e.stopPropagation();
                    if (this.opened()) return;
                    this.open();
                }
            }));

            selection.on("mousedown touchstart", "abbr", this.bind(function (e) {
                if (!this.isInterfaceEnabled()) {
                    return;
                }

                this.clear();
                killEventImmediately(e);
                this.close();

                if (this.selection) {
                    this.selection.focus();
                }
            }));

            selection.on("mousedown touchstart", this.bind(function (e) {
                // Prevent IE from generating a click event on the body
                reinsertElement(selection);

                if (!this.container.hasClass("select2-container-active")) {
                    this.opts.element.trigger($.Event("select2-focus"));
                }

                if (this.opened()) {
                    this.close();
                } else if (this.isInterfaceEnabled()) {
                    this.open();
                }

                killEvent(e);
            }));

            dropdown.on("mousedown touchstart", this.bind(function() {
                if (this.opts.shouldFocusInput(this)) {
                    this.search.focus();
                }
            }));

            selection.on("focus", this.bind(function(e) {
                killEvent(e);
            }));

            this.focusser.on("focus", this.bind(function(){
                if (!this.container.hasClass("select2-container-active")) {
                    this.opts.element.trigger($.Event("select2-focus"));
                }
                this.container.addClass("select2-container-active");
            })).on("blur", this.bind(function() {
                if (!this.opened()) {
                    this.container.removeClass("select2-container-active");
                    this.opts.element.trigger($.Event("select2-blur"));
                }
            }));
            this.search.on("focus", this.bind(function(){
                if (!this.container.hasClass("select2-container-active")) {
                    this.opts.element.trigger($.Event("select2-focus"));
                }
                this.container.addClass("select2-container-active");
            }));

            this.initContainerWidth();
            this.opts.element.hide();
            this.setPlaceholder();

        },

        // single
        clear: function(triggerChange) {
            var data=this.selection.data("select2-data");
            if (data) { // guard against queued quick consecutive clicks
                var evt = $.Event("select2-clearing");
                this.opts.element.trigger(evt);
                if (evt.isDefaultPrevented()) {
                    return;
                }
                var placeholderOption = this.getPlaceholderOption();
                this.opts.element.val(placeholderOption ? placeholderOption.val() : "");
                this.selection.find(".select2-chosen").empty();
                this.selection.removeData("select2-data");
                this.setPlaceholder();

                if (triggerChange !== false){
                    this.opts.element.trigger({ type: "select2-removed", val: this.id(data), choice: data });
                    this.triggerChange({removed:data});
                }
            }
        },

        /**
         * Sets selection based on source element's value
         */
        // single
        initSelection: function () {
            var selected;
            if (this.isPlaceholderOptionSelected()) {
                this.updateSelection(null);
                this.close();
                this.setPlaceholder();
            } else {
                var self = this;
                this.opts.initSelection.call(null, this.opts.element, function(selected){
                    if (selected !== undefined && selected !== null) {
                        self.updateSelection(selected);
                        self.close();
                        self.setPlaceholder();
                        self.lastSearchTerm = self.search.val();
                    }
                });
            }
        },

        isPlaceholderOptionSelected: function() {
            var placeholderOption;
            if (this.getPlaceholder() === undefined) return false; // no placeholder specified so no option should be considered
            return ((placeholderOption = this.getPlaceholderOption()) !== undefined && placeholderOption.prop("selected"))
                || (this.opts.element.val() === "")
                || (this.opts.element.val() === undefined)
                || (this.opts.element.val() === null);
        },

        // single
        prepareOpts: function () {
            var opts = this.parent.prepareOpts.apply(this, arguments),
                self=this;

            if (opts.element.get(0).tagName.toLowerCase() === "select") {
                // install the selection initializer
                opts.initSelection = function (element, callback) {
                    var selected = element.find("option").filter(function() { return this.selected && !this.disabled });
                    // a single select box always has a value, no need to null check 'selected'
                    callback(self.optionToData(selected));
                };
            } else if ("data" in opts) {
                // install default initSelection when applied to hidden input and data is local
                opts.initSelection = opts.initSelection || function (element, callback) {
                    var id = element.val();
                    //search in data by id, storing the actual matching item
                    var match = null;
                    opts.query({
                        matcher: function(term, text, el){
                            var is_match = equal(id, opts.id(el));
                            if (is_match) {
                                match = el;
                            }
                            return is_match;
                        },
                        callback: !$.isFunction(callback) ? $.noop : function() {
                            callback(match);
                        }
                    });
                };
            }

            return opts;
        },

        // single
        getPlaceholder: function() {
            // if a placeholder is specified on a single select without a valid placeholder option ignore it
            if (this.select) {
                if (this.getPlaceholderOption() === undefined) {
                    return undefined;
                }
            }

            return this.parent.getPlaceholder.apply(this, arguments);
        },

        // single
        setPlaceholder: function () {
            var placeholder = this.getPlaceholder();

            if (this.isPlaceholderOptionSelected() && placeholder !== undefined) {

                // check for a placeholder option if attached to a select
                if (this.select && this.getPlaceholderOption() === undefined) return;

                this.selection.find(".select2-chosen").html(this.opts.escapeMarkup(placeholder));

                this.selection.addClass("select2-default");

                this.container.removeClass("select2-allowclear");
            }
        },

        // single
        postprocessResults: function (data, initial, noHighlightUpdate) {
            var selected = 0, self = this, showSearchInput = true;

            // find the selected element in the result list

            this.findHighlightableChoices().each2(function (i, elm) {
                if (equal(self.id(elm.data("select2-data")), self.opts.element.val())) {
                    selected = i;
                    return false;
                }
            });

            // and highlight it
            if (noHighlightUpdate !== false) {
                if (initial === true && selected >= 0) {
                    this.highlight(selected);
                } else {
                    this.highlight(0);
                }
            }

            // hide the search box if this is the first we got the results and there are enough of them for search

            if (initial === true) {
                var min = this.opts.minimumResultsForSearch;
                if (min >= 0) {
                    this.showSearch(countResults(data.results) >= min);
                }
            }
        },

        // single
        showSearch: function(showSearchInput) {
            if (this.showSearchInput === showSearchInput) return;

            this.showSearchInput = showSearchInput;

            this.dropdown.find(".select2-search").toggleClass("select2-search-hidden", !showSearchInput);
            this.dropdown.find(".select2-search").toggleClass("select2-offscreen", !showSearchInput);
            //add "select2-with-searchbox" to the container if search box is shown
            $(this.dropdown, this.container).toggleClass("select2-with-searchbox", showSearchInput);
        },

        // single
        onSelect: function (data, options) {

            if (!this.triggerSelect(data)) { return; }

            var old = this.opts.element.val(),
                oldData = this.data();

            this.opts.element.val(this.id(data));
            this.updateSelection(data);

            this.opts.element.trigger({ type: "select2-selected", val: this.id(data), choice: data });

            this.lastSearchTerm = this.search.val();
            this.close();

            if ((!options || !options.noFocus) && this.opts.shouldFocusInput(this)) {
                this.focusser.focus();
            }

            if (!equal(old, this.id(data))) {
                this.triggerChange({ added: data, removed: oldData });
            }
        },

        // single
        updateSelection: function (data) {

            var container=this.selection.find(".select2-chosen"), formatted, cssClass;

            this.selection.data("select2-data", data);

            container.empty();
            if (data !== null) {
                formatted=this.opts.formatSelection(data, container, this.opts.escapeMarkup);
            }
            if (formatted !== undefined) {
                container.append(formatted);
            }
            cssClass=this.opts.formatSelectionCssClass(data, container);
            if (cssClass !== undefined) {
                container.addClass(cssClass);
            }

            this.selection.removeClass("select2-default");

            if (this.opts.allowClear && this.getPlaceholder() !== undefined) {
                this.container.addClass("select2-allowclear");
            }
        },

        // single
        val: function () {
            var val,
                triggerChange = false,
                data = null,
                self = this,
                oldData = this.data();

            if (arguments.length === 0) {
                return this.opts.element.val();
            }

            val = arguments[0];

            if (arguments.length > 1) {
                triggerChange = arguments[1];

                if (this.opts.debug && console && console.warn) {
                    console.warn(
                        'Select2: The second option to `select2("val")` is not supported in Select2 4.0.0. ' +
                        'The `change` event will always be triggered in 4.0.0.'
                    );
                }
            }

            if (this.select) {
                if (this.opts.debug && console && console.warn) {
                    console.warn(
                        'Select2: Setting the value on a <select> using `select2("val")` is no longer supported in 4.0.0. ' +
                        'You can use the `.val(newValue).trigger("change")` method provided by jQuery instead.'
                    );
                }

                this.select
                    .val(val)
                    .find("option").filter(function() { return this.selected }).each2(function (i, elm) {
                        data = self.optionToData(elm);
                        return false;
                    });
                this.updateSelection(data);
                this.setPlaceholder();
                if (triggerChange) {
                    this.triggerChange({added: data, removed:oldData});
                }
            } else {
                // val is an id. !val is true for [undefined,null,'',0] - 0 is legal
                if (!val && val !== 0) {
                    this.clear(triggerChange);
                    return;
                }
                if (this.opts.initSelection === undefined) {
                    throw new Error("cannot call val() if initSelection() is not defined");
                }
                this.opts.element.val(val);
                this.opts.initSelection(this.opts.element, function(data){
                    self.opts.element.val(!data ? "" : self.id(data));
                    self.updateSelection(data);
                    self.setPlaceholder();
                    if (triggerChange) {
                        self.triggerChange({added: data, removed:oldData});
                    }
                });
            }
        },

        // single
        clearSearch: function () {
            this.search.val("");
            this.focusser.val("");
        },

        // single
        data: function(value) {
            var data,
                triggerChange = false;

            if (arguments.length === 0) {
                data = this.selection.data("select2-data");
                if (data == undefined) data = null;
                return data;
            } else {
                if (this.opts.debug && console && console.warn) {
                    console.warn(
                        'Select2: The `select2("data")` method can no longer set selected values in 4.0.0, ' +
                        'consider using the `.val()` method instead.'
                    );
                }

                if (arguments.length > 1) {
                    triggerChange = arguments[1];
                }
                if (!value) {
                    this.clear(triggerChange);
                } else {
                    data = this.data();
                    this.opts.element.val(!value ? "" : this.id(value));
                    this.updateSelection(value);
                    if (triggerChange) {
                        this.triggerChange({added: value, removed:data});
                    }
                }
            }
        }
    });

    MultiSelect2 = clazz(AbstractSelect2, {

        // multi
        createContainer: function () {
            var container = $(document.createElement("div")).attr({
                "class": "select2-container select2-container-multi"
            }).html([
                "<ul class='select2-choices'>",
                "  <li class='select2-search-field'>",
                "    <label for='' class='select2-offscreen'></label>",
                "    <input type='text' autocomplete='off' autocorrect='off' autocapitalize='off' spellcheck='false' class='select2-input'>",
                "  </li>",
                "</ul>",
                "<div class='select2-drop select2-drop-multi select2-display-none'>",
                "   <ul class='select2-results'>",
                "   </ul>",
                "</div>"].join(""));
            return container;
        },

        // multi
        prepareOpts: function () {
            var opts = this.parent.prepareOpts.apply(this, arguments),
                self=this;

            // TODO validate placeholder is a string if specified
            if (opts.element.get(0).tagName.toLowerCase() === "select") {
                // install the selection initializer
                opts.initSelection = function (element, callback) {

                    var data = [];

                    element.find("option").filter(function() { return this.selected && !this.disabled }).each2(function (i, elm) {
                        data.push(self.optionToData(elm));
                    });
                    callback(data);
                };
            } else if ("data" in opts) {
                // install default initSelection when applied to hidden input and data is local
                opts.initSelection = opts.initSelection || function (element, callback) {
                    var ids = splitVal(element.val(), opts.separator, opts.transformVal);
                    //search in data by array of ids, storing matching items in a list
                    var matches = [];
                    opts.query({
                        matcher: function(term, text, el){
                            var is_match = $.grep(ids, function(id) {
                                return equal(id, opts.id(el));
                            }).length;
                            if (is_match) {
                                matches.push(el);
                            }
                            return is_match;
                        },
                        callback: !$.isFunction(callback) ? $.noop : function() {
                            // reorder matches based on the order they appear in the ids array because right now
                            // they are in the order in which they appear in data array
                            var ordered = [];
                            for (var i = 0; i < ids.length; i++) {
                                var id = ids[i];
                                for (var j = 0; j < matches.length; j++) {
                                    var match = matches[j];
                                    if (equal(id, opts.id(match))) {
                                        ordered.push(match);
                                        matches.splice(j, 1);
                                        break;
                                    }
                                }
                            }
                            callback(ordered);
                        }
                    });
                };
            }

            return opts;
        },

        // multi
        selectChoice: function (choice) {

            var selected = this.container.find(".select2-search-choice-focus");
            if (selected.length && choice && choice[0] == selected[0]) {

            } else {
                if (selected.length) {
                    this.opts.element.trigger("choice-deselected", selected);
                }
                selected.removeClass("select2-search-choice-focus");
                if (choice && choice.length) {
                    this.close();
                    choice.addClass("select2-search-choice-focus");
                    this.opts.element.trigger("choice-selected", choice);
                }
            }
        },

        // multi
        destroy: function() {
            $("label[for='" + this.search.attr('id') + "']")
                .attr('for', this.opts.element.attr("id"));
            this.parent.destroy.apply(this, arguments);

            cleanupJQueryElements.call(this,
                "searchContainer",
                "selection"
            );
        },

        // multi
        initContainer: function () {

            var selector = ".select2-choices", selection;

            this.searchContainer = this.container.find(".select2-search-field");
            this.selection = selection = this.container.find(selector);

            var _this = this;
            this.selection.on("click", ".select2-container:not(.select2-container-disabled) .select2-search-choice:not(.select2-locked)", function (e) {
                _this.search[0].focus();
                _this.selectChoice($(this));
            });

            // rewrite labels from original element to focusser
            this.search.attr("id", "s2id_autogen"+nextUid());

            this.search.prev()
                .text($("label[for='" + this.opts.element.attr("id") + "']").text())
                .attr('for', this.search.attr('id'));
            this.opts.element.on('focus.select2', this.bind(function () { this.focus(); }));

            this.search.on("input paste", this.bind(function() {
                if (this.search.attr('placeholder') && this.search.val().length == 0) return;
                if (!this.isInterfaceEnabled()) return;
                if (!this.opened()) {
                    this.open();
                }
            }));

            this.search.attr("tabindex", this.elementTabIndex);

            this.keydowns = 0;
            this.search.on("keydown", this.bind(function (e) {
                if (!this.isInterfaceEnabled()) return;

                ++this.keydowns;
                var selected = selection.find(".select2-search-choice-focus");
                var prev = selected.prev(".select2-search-choice:not(.select2-locked)");
                var next = selected.next(".select2-search-choice:not(.select2-locked)");
                var pos = getCursorInfo(this.search);

                if (selected.length &&
                    (e.which == KEY.LEFT || e.which == KEY.RIGHT || e.which == KEY.BACKSPACE || e.which == KEY.DELETE || e.which == KEY.ENTER)) {
                    var selectedChoice = selected;
                    if (e.which == KEY.LEFT && prev.length) {
                        selectedChoice = prev;
                    }
                    else if (e.which == KEY.RIGHT) {
                        selectedChoice = next.length ? next : null;
                    }
                    else if (e.which === KEY.BACKSPACE) {
                        if (this.unselect(selected.first())) {
                            this.search.width(10);
                            selectedChoice = prev.length ? prev : next;
                        }
                    } else if (e.which == KEY.DELETE) {
                        if (this.unselect(selected.first())) {
                            this.search.width(10);
                            selectedChoice = next.length ? next : null;
                        }
                    } else if (e.which == KEY.ENTER) {
                        selectedChoice = null;
                    }

                    this.selectChoice(selectedChoice);
                    killEvent(e);
                    if (!selectedChoice || !selectedChoice.length) {
                        this.open();
                    }
                    return;
                } else if (((e.which === KEY.BACKSPACE && this.keydowns == 1)
                    || e.which == KEY.LEFT) && (pos.offset == 0 && !pos.length)) {

                    this.selectChoice(selection.find(".select2-search-choice:not(.select2-locked)").last());
                    killEvent(e);
                    return;
                } else {
                    this.selectChoice(null);
                }

                if (this.opened()) {
                    switch (e.which) {
                    case KEY.UP:
                    case KEY.DOWN:
                        this.moveHighlight((e.which === KEY.UP) ? -1 : 1);
                        killEvent(e);
                        return;
                    case KEY.ENTER:
                        this.selectHighlighted();
                        killEvent(e);
                        return;
                    case KEY.TAB:
                        this.selectHighlighted({noFocus:true});
                        this.close();
                        return;
                    case KEY.ESC:
                        this.cancel(e);
                        killEvent(e);
                        return;
                    }
                }

                if (e.which === KEY.TAB || KEY.isControl(e) || KEY.isFunctionKey(e)
                 || e.which === KEY.BACKSPACE || e.which === KEY.ESC) {
                    return;
                }

                if (e.which === KEY.ENTER) {
                    if (this.opts.openOnEnter === false) {
                        return;
                    } else if (e.altKey || e.ctrlKey || e.shiftKey || e.metaKey) {
                        return;
                    }
                }

                this.open();

                if (e.which === KEY.PAGE_UP || e.which === KEY.PAGE_DOWN) {
                    // prevent the page from scrolling
                    killEvent(e);
                }

                if (e.which === KEY.ENTER) {
                    // prevent form from being submitted
                    killEvent(e);
                }

            }));

            this.search.on("keyup", this.bind(function (e) {
                this.keydowns = 0;
                this.resizeSearch();
            })
            );

            this.search.on("blur", this.bind(function(e) {
                this.container.removeClass("select2-container-active");
                this.search.removeClass("select2-focused");
                this.selectChoice(null);
                if (!this.opened()) this.clearSearch();
                e.stopImmediatePropagation();
                this.opts.element.trigger($.Event("select2-blur"));
            }));

            this.container.on("click", selector, this.bind(function (e) {
                if (!this.isInterfaceEnabled()) return;
                if ($(e.target).closest(".select2-search-choice").length > 0) {
                    // clicked inside a select2 search choice, do not open
                    return;
                }
                this.selectChoice(null);
                this.clearPlaceholder();
                if (!this.container.hasClass("select2-container-active")) {
                    this.opts.element.trigger($.Event("select2-focus"));
                }
                this.open();
                this.focusSearch();
                e.preventDefault();
            }));

            this.container.on("focus", selector, this.bind(function () {
                if (!this.isInterfaceEnabled()) return;
                if (!this.container.hasClass("select2-container-active")) {
                    this.opts.element.trigger($.Event("select2-focus"));
                }
                this.container.addClass("select2-container-active");
                this.dropdown.addClass("select2-drop-active");
                this.clearPlaceholder();
            }));

            this.initContainerWidth();
            this.opts.element.hide();

            // set the placeholder if necessary
            this.clearSearch();
        },

        // multi
        enableInterface: function() {
            if (this.parent.enableInterface.apply(this, arguments)) {
                this.search.prop("disabled", !this.isInterfaceEnabled());
            }
        },

        // multi
        initSelection: function () {
            var data;
            if (this.opts.element.val() === "" && this.opts.element.text() === "") {
                this.updateSelection([]);
                this.close();
                // set the placeholder if necessary
                this.clearSearch();
            }
            if (this.select || this.opts.element.val() !== "") {
                var self = this;
                this.opts.initSelection.call(null, this.opts.element, function(data){
                    if (data !== undefined && data !== null) {
                        self.updateSelection(data);
                        self.close();
                        // set the placeholder if necessary
                        self.clearSearch();
                    }
                });
            }
        },

        // multi
        clearSearch: function () {
            var placeholder = this.getPlaceholder(),
                maxWidth = this.getMaxSearchWidth();

            if (placeholder !== undefined  && this.getVal().length === 0 && this.search.hasClass("select2-focused") === false) {
                this.search.val(placeholder).addClass("select2-default");
                // stretch the search box to full width of the container so as much of the placeholder is visible as possible
                // we could call this.resizeSearch(), but we do not because that requires a sizer and we do not want to create one so early because of a firefox bug, see #944
                this.search.width(maxWidth > 0 ? maxWidth : this.container.css("width"));
            } else {
                this.search.val("").width(10);
            }
        },

        // multi
        clearPlaceholder: function () {
            if (this.search.hasClass("select2-default")) {
                this.search.val("").removeClass("select2-default");
            }
        },

        // multi
        opening: function () {
            this.clearPlaceholder(); // should be done before super so placeholder is not used to search
            this.resizeSearch();

            this.parent.opening.apply(this, arguments);

            this.focusSearch();

            this.prefillNextSearchTerm();
            this.updateResults(true);

            if (this.opts.shouldFocusInput(this)) {
                this.search.focus();
            }
            this.opts.element.trigger($.Event("select2-open"));
        },

        // multi
        close: function () {
            if (!this.opened()) return;
            this.parent.close.apply(this, arguments);
        },

        // multi
        focus: function () {
            this.close();
            this.search.focus();
        },

        // multi
        isFocused: function () {
            return this.search.hasClass("select2-focused");
        },

        // multi
        updateSelection: function (data) {
            var ids = {}, filtered = [], self = this;

            // filter out duplicates
            $(data).each(function () {
                if (!(self.id(this) in ids)) {
                    ids[self.id(this)] = 0;
                    filtered.push(this);
                }
            });

            this.selection.find(".select2-search-choice").remove();
            this.addSelectedChoice(filtered);
            self.postprocessResults();
        },

        // multi
        tokenize: function() {
            var input = this.search.val();
            input = this.opts.tokenizer.call(this, input, this.data(), this.bind(this.onSelect), this.opts);
            if (input != null && input != undefined) {
                this.search.val(input);
                if (input.length > 0) {
                    this.open();
                }
            }

        },

        // multi
        onSelect: function (data, options) {

            if (!this.triggerSelect(data) || data.text === "") { return; }

            this.addSelectedChoice(data);

            this.opts.element.trigger({ type: "selected", val: this.id(data), choice: data });

            // keep track of the search's value before it gets cleared
            this.lastSearchTerm = this.search.val();

            this.clearSearch();
            this.updateResults();

            if (this.select || !this.opts.closeOnSelect) this.postprocessResults(data, false, this.opts.closeOnSelect===true);

            if (this.opts.closeOnSelect) {
                this.close();
                this.search.width(10);
            } else {
                if (this.countSelectableResults()>0) {
                    this.search.width(10);
                    this.resizeSearch();
                    if (this.getMaximumSelectionSize() > 0 && this.val().length >= this.getMaximumSelectionSize()) {
                        // if we reached max selection size repaint the results so choices
                        // are replaced with the max selection reached message
                        this.updateResults(true);
                    } else {
                        // initializes search's value with nextSearchTerm and update search result
                        if (this.prefillNextSearchTerm()) {
                            this.updateResults();
                        }
                    }
                    this.positionDropdown();
                } else {
                    // if nothing left to select close
                    this.close();
                    this.search.width(10);
                }
            }

            // since its not possible to select an element that has already been
            // added we do not need to check if this is a new element before firing change
            this.triggerChange({ added: data });

            if (!options || !options.noFocus)
                this.focusSearch();
        },

        // multi
        cancel: function () {
            this.close();
            this.focusSearch();
        },

        addSelectedChoice: function (data) {
            var val = this.getVal(), self = this;
            $(data).each(function () {
                val.push(self.createChoice(this));
            });
            this.setVal(val);
        },

        createChoice: function (data) {
            var enableChoice = !data.locked,
                enabledItem = $(
                    "<li class='select2-search-choice'>" +
                    "    <div></div>" +
                    "    <a href='#' class='select2-search-choice-close' tabindex='-1'></a>" +
                    "</li>"),
                disabledItem = $(
                    "<li class='select2-search-choice select2-locked'>" +
                    "<div></div>" +
                    "</li>");
            var choice = enableChoice ? enabledItem : disabledItem,
                id = this.id(data),
                formatted,
                cssClass;

            formatted=this.opts.formatSelection(data, choice.find("div"), this.opts.escapeMarkup);
            if (formatted != undefined) {
                choice.find("div").replaceWith($("<div></div>").html(formatted));
            }
            cssClass=this.opts.formatSelectionCssClass(data, choice.find("div"));
            if (cssClass != undefined) {
                choice.addClass(cssClass);
            }

            if(enableChoice){
              choice.find(".select2-search-choice-close")
                  .on("mousedown", killEvent)
                  .on("click dblclick", this.bind(function (e) {
                  if (!this.isInterfaceEnabled()) return;

                  this.unselect($(e.target));
                  this.selection.find(".select2-search-choice-focus").removeClass("select2-search-choice-focus");
                  killEvent(e);
                  this.close();
                  this.focusSearch();
              })).on("focus", this.bind(function () {
                  if (!this.isInterfaceEnabled()) return;
                  this.container.addClass("select2-container-active");
                  this.dropdown.addClass("select2-drop-active");
              }));
            }

            choice.data("select2-data", data);
            choice.insertBefore(this.searchContainer);

            return id;
        },

        // multi
        unselect: function (selected) {
            var val = this.getVal(),
                data,
                index;
            selected = selected.closest(".select2-search-choice");

            if (selected.length === 0) {
                throw "Invalid argument: " + selected + ". Must be .select2-search-choice";
            }

            data = selected.data("select2-data");

            if (!data) {
                // prevent a race condition when the 'x' is clicked really fast repeatedly the event can be queued
                // and invoked on an element already removed
                return;
            }

            var evt = $.Event("select2-removing");
            evt.val = this.id(data);
            evt.choice = data;
            this.opts.element.trigger(evt);

            if (evt.isDefaultPrevented()) {
                return false;
            }

            while((index = indexOf(this.id(data), val)) >= 0) {
                val.splice(index, 1);
                this.setVal(val);
                if (this.select) this.postprocessResults();
            }

            selected.remove();

            this.opts.element.trigger({ type: "select2-removed", val: this.id(data), choice: data });
            this.triggerChange({ removed: data });

            return true;
        },

        // multi
        postprocessResults: function (data, initial, noHighlightUpdate) {
            var val = this.getVal(),
                choices = this.results.find(".select2-result"),
                compound = this.results.find(".select2-result-with-children"),
                self = this;

            choices.each2(function (i, choice) {
                var id = self.id(choice.data("select2-data"));
                if (indexOf(id, val) >= 0) {
                    choice.addClass("select2-selected");
                    // mark all children of the selected parent as selected
                    choice.find(".select2-result-selectable").addClass("select2-selected");
                }
            });

            compound.each2(function(i, choice) {
                // hide an optgroup if it doesn't have any selectable children
                if (!choice.is('.select2-result-selectable')
                    && choice.find(".select2-result-selectable:not(.select2-selected)").length === 0) {
                    choice.addClass("select2-selected");
                }
            });

            if (this.highlight() == -1 && noHighlightUpdate !== false && this.opts.closeOnSelect === true){
                self.highlight(0);
            }

            //If all results are chosen render formatNoMatches
            if(!this.opts.createSearchChoice && !choices.filter('.select2-result:not(.select2-selected)').length > 0){
                if(!data || data && !data.more && this.results.find(".select2-no-results").length === 0) {
                    if (checkFormatter(self.opts.formatNoMatches, "formatNoMatches")) {
                        this.results.append("<li class='select2-no-results'>" + evaluate(self.opts.formatNoMatches, self.opts.element, self.search.val()) + "</li>");
                    }
                }
            }

        },

        // multi
        getMaxSearchWidth: function() {
            return this.selection.width() - getSideBorderPadding(this.search);
        },

        // multi
        resizeSearch: function () {
            var minimumWidth, left, maxWidth, containerLeft, searchWidth,
                sideBorderPadding = getSideBorderPadding(this.search);

            minimumWidth = measureTextWidth(this.search) + 10;

            left = this.search.offset().left;

            maxWidth = this.selection.width();
            containerLeft = this.selection.offset().left;

            searchWidth = maxWidth - (left - containerLeft) - sideBorderPadding;

            if (searchWidth < minimumWidth) {
                searchWidth = maxWidth - sideBorderPadding;
            }

            if (searchWidth < 40) {
                searchWidth = maxWidth - sideBorderPadding;
            }

            if (searchWidth <= 0) {
              searchWidth = minimumWidth;
            }

            this.search.width(Math.floor(searchWidth));
        },

        // multi
        getVal: function () {
            var val;
            if (this.select) {
                val = this.select.val();
                return val === null ? [] : val;
            } else {
                val = this.opts.element.val();
                return splitVal(val, this.opts.separator, this.opts.transformVal);
            }
        },

        // multi
        setVal: function (val) {
            if (this.select) {
                this.select.val(val);
            } else {
                var unique = [], valMap = {};
                // filter out duplicates
                $(val).each(function () {
                    if (!(this in valMap)) {
                        unique.push(this);
                        valMap[this] = 0;
                    }
                });
                this.opts.element.val(unique.length === 0 ? "" : unique.join(this.opts.separator));
            }
        },

        // multi
        buildChangeDetails: function (old, current) {
            var current = current.slice(0),
                old = old.slice(0);

            // remove intersection from each array
            for (var i = 0; i < current.length; i++) {
                for (var j = 0; j < old.length; j++) {
                    if (equal(this.opts.id(current[i]), this.opts.id(old[j]))) {
                        current.splice(i, 1);
                        i--;
                        old.splice(j, 1);
                        break;
                    }
                }
            }

            return {added: current, removed: old};
        },


        // multi
        val: function (val, triggerChange) {
            var oldData, self=this;

            if (arguments.length === 0) {
                return this.getVal();
            }

            oldData=this.data();
            if (!oldData.length) oldData=[];

            // val is an id. !val is true for [undefined,null,'',0] - 0 is legal
            if (!val && val !== 0) {
                this.opts.element.val("");
                this.updateSelection([]);
                this.clearSearch();
                if (triggerChange) {
                    this.triggerChange({added: this.data(), removed: oldData});
                }
                return;
            }

            // val is a list of ids
            this.setVal(val);

            if (this.select) {
                this.opts.initSelection(this.select, this.bind(this.updateSelection));
                if (triggerChange) {
                    this.triggerChange(this.buildChangeDetails(oldData, this.data()));
                }
            } else {
                if (this.opts.initSelection === undefined) {
                    throw new Error("val() cannot be called if initSelection() is not defined");
                }

                this.opts.initSelection(this.opts.element, function(data){
                    var ids=$.map(data, self.id);
                    self.setVal(ids);
                    self.updateSelection(data);
                    self.clearSearch();
                    if (triggerChange) {
                        self.triggerChange(self.buildChangeDetails(oldData, self.data()));
                    }
                });
            }
            this.clearSearch();
        },

        // multi
        onSortStart: function() {
            if (this.select) {
                throw new Error("Sorting of elements is not supported when attached to <select>. Attach to <input type='hidden'/> instead.");
            }

            // collapse search field into 0 width so its container can be collapsed as well
            this.search.width(0);
            // hide the container
            this.searchContainer.hide();
        },

        // multi
        onSortEnd:function() {

            var val=[], self=this;

            // show search and move it to the end of the list
            this.searchContainer.show();
            // make sure the search container is the last item in the list
            this.searchContainer.appendTo(this.searchContainer.parent());
            // since we collapsed the width in dragStarted, we resize it here
            this.resizeSearch();

            // update selection
            this.selection.find(".select2-search-choice").each(function() {
                val.push(self.opts.id($(this).data("select2-data")));
            });
            this.setVal(val);
            this.triggerChange();
        },

        // multi
        data: function(values, triggerChange) {
            var self=this, ids, old;
            if (arguments.length === 0) {
                 return this.selection
                     .children(".select2-search-choice")
                     .map(function() { return $(this).data("select2-data"); })
                     .get();
            } else {
                old = this.data();
                if (!values) { values = []; }
                ids = $.map(values, function(e) { return self.opts.id(e); });
                this.setVal(ids);
                this.updateSelection(values);
                this.clearSearch();
                if (triggerChange) {
                    this.triggerChange(this.buildChangeDetails(old, this.data()));
                }
            }
        }
    });

    $.fn.select2 = function () {

        var args = Array.prototype.slice.call(arguments, 0),
            opts,
            select2,
            method, value, multiple,
            allowedMethods = ["val", "destroy", "opened", "open", "close", "focus", "isFocused", "container", "dropdown", "onSortStart", "onSortEnd", "enable", "disable", "readonly", "positionDropdown", "data", "search"],
            valueMethods = ["opened", "isFocused", "container", "dropdown"],
            propertyMethods = ["val", "data"],
            methodsMap = { search: "externalSearch" };

        this.each(function () {
            if (args.length === 0 || typeof(args[0]) === "object") {
                opts = args.length === 0 ? {} : $.extend({}, args[0]);
                opts.element = $(this);

                if (opts.element.get(0).tagName.toLowerCase() === "select") {
                    multiple = opts.element.prop("multiple");
                } else {
                    multiple = opts.multiple || false;
                    if ("tags" in opts) {opts.multiple = multiple = true;}
                }

                select2 = multiple ? new window.Select2["class"].multi() : new window.Select2["class"].single();
                select2.init(opts);
            } else if (typeof(args[0]) === "string") {

                if (indexOf(args[0], allowedMethods) < 0) {
                    throw "Unknown method: " + args[0];
                }

                value = undefined;
                select2 = $(this).data("select2");
                if (select2 === undefined) return;

                method=args[0];

                if (method === "container") {
                    value = select2.container;
                } else if (method === "dropdown") {
                    value = select2.dropdown;
                } else {
                    if (methodsMap[method]) method = methodsMap[method];

                    value = select2[method].apply(select2, args.slice(1));
                }
                if (indexOf(args[0], valueMethods) >= 0
                    || (indexOf(args[0], propertyMethods) >= 0 && args.length == 1)) {
                    return false; // abort the iteration, ready to return first matched value
                }
            } else {
                throw "Invalid arguments to select2 plugin: " + args;
            }
        });
        return (value === undefined) ? this : value;
    };

    // plugin defaults, accessible to users
    $.fn.select2.defaults = {
        debug: false,
        width: "copy",
        loadMorePadding: 0,
        closeOnSelect: true,
        openOnEnter: true,
        containerCss: {},
        dropdownCss: {},
        containerCssClass: "",
        dropdownCssClass: "",
        formatResult: function(result, container, query, escapeMarkup) {
            var markup=[];
            markMatch(this.text(result), query.term, markup, escapeMarkup);
            return markup.join("");
        },
        transformVal: function(val) {
            return $.trim(val);
        },
        formatSelection: function (data, container, escapeMarkup) {
            return data ? escapeMarkup(this.text(data)) : undefined;
        },
        sortResults: function (results, container, query) {
            return results;
        },
        formatResultCssClass: function(data) {return data.css;},
        formatSelectionCssClass: function(data, container) {return undefined;},
        minimumResultsForSearch: 0,
        minimumInputLength: 0,
        maximumInputLength: null,
        maximumSelectionSize: 0,
        id: function (e) { return e == undefined ? null : e.id; },
        text: function (e) {
          if (e && this.data && this.data.text) {
            if ($.isFunction(this.data.text)) {
              return this.data.text(e);
            } else {
              return e[this.data.text];
            }
          } else {
            return e.text;
          }
        },
        matcher: function(term, text) {
            return stripDiacritics(''+text).toUpperCase().indexOf(stripDiacritics(''+term).toUpperCase()) >= 0;
        },
        separator: ",",
        tokenSeparators: [],
        tokenizer: defaultTokenizer,
        escapeMarkup: defaultEscapeMarkup,
        blurOnChange: false,
        selectOnBlur: false,
        adaptContainerCssClass: function(c) { return c; },
        adaptDropdownCssClass: function(c) { return null; },
        nextSearchTerm: function(selectedObject, currentSearchTerm) { return undefined; },
        searchInputPlaceholder: '',
        createSearchChoicePosition: 'top',
        shouldFocusInput: function (instance) {
            // Attempt to detect touch devices
            var supportsTouchEvents = (('ontouchstart' in window) ||
                                       (navigator.msMaxTouchPoints > 0));

            // Only devices which support touch events should be special cased
            if (!supportsTouchEvents) {
                return true;
            }

            // Never focus the input if search is disabled
            if (instance.opts.minimumResultsForSearch < 0) {
                return false;
            }

            return true;
        }
    };

    $.fn.select2.locales = [];

    $.fn.select2.locales['en'] = {
         formatMatches: function (matches) { if (matches === 1) { return "One result is available, press enter to select it."; } return matches + " results are available, use up and down arrow keys to navigate."; },
         formatNoMatches: function () { return "No matches found"; },
         formatAjaxError: function (jqXHR, textStatus, errorThrown) { return "Loading failed"; },
         formatInputTooShort: function (input, min) { var n = min - input.length; return "Please enter " + n + " or more character" + (n == 1 ? "" : "s"); },
         formatInputTooLong: function (input, max) { var n = input.length - max; return "Please delete " + n + " character" + (n == 1 ? "" : "s"); },
         formatSelectionTooBig: function (limit) { return "You can only select " + limit + " item" + (limit == 1 ? "" : "s"); },
         formatLoadMore: function (pageNumber) { return "Loading more results…"; },
         formatSearching: function () { return "Searching…"; }
    };

    $.extend($.fn.select2.defaults, $.fn.select2.locales['en']);

    $.fn.select2.ajaxDefaults = {
        transport: $.ajax,
        params: {
            type: "GET",
            cache: false,
            dataType: "json"
        }
    };

    // exports
    window.Select2 = {
        query: {
            ajax: ajax,
            local: local,
            tags: tags
        }, util: {
            debounce: debounce,
            markMatch: markMatch,
            escapeMarkup: defaultEscapeMarkup,
            stripDiacritics: stripDiacritics
        }, "class": {
            "abstract": AbstractSelect2,
            "single": SingleSelect2,
            "multi": MultiSelect2
        }
    };

}(jQuery));
// vim:ts=4:sts=4:sw=4:
/*!
 *
 * Copyright 2009-2012 Kris Kowal under the terms of the MIT
 * license found at http://github.com/kriskowal/q/raw/master/LICENSE
 *
 * With parts by Tyler Close
 * Copyright 2007-2009 Tyler Close under the terms of the MIT X license found
 * at http://www.opensource.org/licenses/mit-license.html
 * Forked at ref_send.js version: 2009-05-11
 *
 * With parts by Mark Miller
 * Copyright (C) 2011 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */


(function (definition) {
    "use strict";

    // This file will function properly as a <script> tag, or a module
    // using CommonJS and NodeJS or RequireJS module formats.  In
    // Common/Node/RequireJS, the module exports the Q API and when
    // executed as a simple <script>, it creates a Q global instead.

    // Montage Require
    if (typeof bootstrap === "function") {
        bootstrap("promise", definition);

    // CommonJS
    } else if (typeof exports === "object" && typeof module === "object") {
        module.exports = definition();

    // RequireJS
    } else if (typeof define === "function" && define.amd) {
        define(definition);

    // SES (Secure EcmaScript)
    } else if (typeof ses !== "undefined") {
        if (!ses.ok()) {
            return;
        } else {
            ses.makeQ = definition;
        }

    // <script>
    } else if (typeof self !== "undefined") {
        self.Q = definition();

    } else {
        throw new Error("This environment was not anticiapted by Q. Please file a bug.");
    }

})(function () {
"use strict";

var hasStacks = false;
try {
    throw new Error();
} catch (e) {
    hasStacks = !!e.stack;
}

// All code after this point will be filtered from stack traces reported
// by Q.
var qStartingLine = captureLine();
var qFileName;

// shims

// used for fallback in "allResolved"
var noop = function () {};

// Use the fastest possible means to execute a task in a future turn
// of the event loop.
var nextTick =(function () {
    // linked list of tasks (single, with head node)
    var head = {task: void 0, next: null};
    var tail = head;
    var flushing = false;
    var requestTick = void 0;
    var isNodeJS = false;

    function flush() {
        /* jshint loopfunc: true */

        while (head.next) {
            head = head.next;
            var task = head.task;
            head.task = void 0;
            var domain = head.domain;

            if (domain) {
                head.domain = void 0;
                domain.enter();
            }

            try {
                task();

            } catch (e) {
                if (isNodeJS) {
                    // In node, uncaught exceptions are considered fatal errors.
                    // Re-throw them synchronously to interrupt flushing!

                    // Ensure continuation if the uncaught exception is suppressed
                    // listening "uncaughtException" events (as domains does).
                    // Continue in next event to avoid tick recursion.
                    if (domain) {
                        domain.exit();
                    }
                    setTimeout(flush, 0);
                    if (domain) {
                        domain.enter();
                    }

                    throw e;

                } else {
                    // In browsers, uncaught exceptions are not fatal.
                    // Re-throw them asynchronously to avoid slow-downs.
                    setTimeout(function() {
                       throw e;
                    }, 0);
                }
            }

            if (domain) {
                domain.exit();
            }
        }

        flushing = false;
    }

    nextTick = function (task) {
        tail = tail.next = {
            task: task,
            domain: isNodeJS && process.domain,
            next: null
        };

        if (!flushing) {
            flushing = true;
            requestTick();
        }
    };

    if (typeof process !== "undefined" && process.nextTick) {
        // Node.js before 0.9. Note that some fake-Node environments, like the
        // Mocha test runner, introduce a `process` global without a `nextTick`.
        isNodeJS = true;

        requestTick = function () {
            process.nextTick(flush);
        };

    } else if (typeof setImmediate === "function") {
        // In IE10, Node.js 0.9+, or https://github.com/NobleJS/setImmediate
        if (typeof window !== "undefined") {
            requestTick = setImmediate.bind(window, flush);
        } else {
            requestTick = function () {
                setImmediate(flush);
            };
        }

    } else if (typeof MessageChannel !== "undefined") {
        // modern browsers
        // http://www.nonblocking.io/2011/06/windownexttick.html
        var channel = new MessageChannel();
        // At least Safari Version 6.0.5 (8536.30.1) intermittently cannot create
        // working message ports the first time a page loads.
        channel.port1.onmessage = function () {
            requestTick = requestPortTick;
            channel.port1.onmessage = flush;
            flush();
        };
        var requestPortTick = function () {
            // Opera requires us to provide a message payload, regardless of
            // whether we use it.
            channel.port2.postMessage(0);
        };
        requestTick = function () {
            setTimeout(flush, 0);
            requestPortTick();
        };

    } else {
        // old browsers
        requestTick = function () {
            setTimeout(flush, 0);
        };
    }

    return nextTick;
})();

// Attempt to make generics safe in the face of downstream
// modifications.
// There is no situation where this is necessary.
// If you need a security guarantee, these primordials need to be
// deeply frozen anyway, and if you don’t need a security guarantee,
// this is just plain paranoid.
// However, this **might** have the nice side-effect of reducing the size of
// the minified code by reducing x.call() to merely x()
// See Mark Miller’s explanation of what this does.
// http://wiki.ecmascript.org/doku.php?id=conventions:safe_meta_programming
var call = Function.call;
function uncurryThis(f) {
    return function () {
        return call.apply(f, arguments);
    };
}
// This is equivalent, but slower:
// uncurryThis = Function_bind.bind(Function_bind.call);
// http://jsperf.com/uncurrythis

var array_slice = uncurryThis(Array.prototype.slice);

var array_reduce = uncurryThis(
    Array.prototype.reduce || function (callback, basis) {
        var index = 0,
            length = this.length;
        // concerning the initial value, if one is not provided
        if (arguments.length === 1) {
            // seek to the first value in the array, accounting
            // for the possibility that is is a sparse array
            do {
                if (index in this) {
                    basis = this[index++];
                    break;
                }
                if (++index >= length) {
                    throw new TypeError();
                }
            } while (1);
        }
        // reduce
        for (; index < length; index++) {
            // account for the possibility that the array is sparse
            if (index in this) {
                basis = callback(basis, this[index], index);
            }
        }
        return basis;
    }
);

var array_indexOf = uncurryThis(
    Array.prototype.indexOf || function (value) {
        // not a very good shim, but good enough for our one use of it
        for (var i = 0; i < this.length; i++) {
            if (this[i] === value) {
                return i;
            }
        }
        return -1;
    }
);

var array_map = uncurryThis(
    Array.prototype.map || function (callback, thisp) {
        var self = this;
        var collect = [];
        array_reduce(self, function (undefined, value, index) {
            collect.push(callback.call(thisp, value, index, self));
        }, void 0);
        return collect;
    }
);

var object_create = Object.create || function (prototype) {
    function Type() { }
    Type.prototype = prototype;
    return new Type();
};

var object_hasOwnProperty = uncurryThis(Object.prototype.hasOwnProperty);

var object_keys = Object.keys || function (object) {
    var keys = [];
    for (var key in object) {
        if (object_hasOwnProperty(object, key)) {
            keys.push(key);
        }
    }
    return keys;
};

var object_toString = uncurryThis(Object.prototype.toString);

function isObject(value) {
    return value === Object(value);
}

// generator related shims

// FIXME: Remove this function once ES6 generators are in SpiderMonkey.
function isStopIteration(exception) {
    return (
        object_toString(exception) === "[object StopIteration]" ||
        exception instanceof QReturnValue
    );
}

// FIXME: Remove this helper and Q.return once ES6 generators are in
// SpiderMonkey.
var QReturnValue;
if (typeof ReturnValue !== "undefined") {
    QReturnValue = ReturnValue;
} else {
    QReturnValue = function (value) {
        this.value = value;
    };
}

// long stack traces

var STACK_JUMP_SEPARATOR = "From previous event:";

function makeStackTraceLong(error, promise) {
    // If possible, transform the error stack trace by removing Node and Q
    // cruft, then concatenating with the stack trace of `promise`. See #57.
    if (hasStacks &&
        promise.stack &&
        typeof error === "object" &&
        error !== null &&
        error.stack &&
        error.stack.indexOf(STACK_JUMP_SEPARATOR) === -1
    ) {
        var stacks = [];
        for (var p = promise; !!p; p = p.source) {
            if (p.stack) {
                stacks.unshift(p.stack);
            }
        }
        stacks.unshift(error.stack);

        var concatedStacks = stacks.join("\n" + STACK_JUMP_SEPARATOR + "\n");
        error.stack = filterStackString(concatedStacks);
    }
}

function filterStackString(stackString) {
    var lines = stackString.split("\n");
    var desiredLines = [];
    for (var i = 0; i < lines.length; ++i) {
        var line = lines[i];

        if (!isInternalFrame(line) && !isNodeFrame(line) && line) {
            desiredLines.push(line);
        }
    }
    return desiredLines.join("\n");
}

function isNodeFrame(stackLine) {
    return stackLine.indexOf("(module.js:") !== -1 ||
           stackLine.indexOf("(node.js:") !== -1;
}

function getFileNameAndLineNumber(stackLine) {
    // Named functions: "at functionName (filename:lineNumber:columnNumber)"
    // In IE10 function name can have spaces ("Anonymous function") O_o
    var attempt1 = /at .+ \((.+):(\d+):(?:\d+)\)$/.exec(stackLine);
    if (attempt1) {
        return [attempt1[1], Number(attempt1[2])];
    }

    // Anonymous functions: "at filename:lineNumber:columnNumber"
    var attempt2 = /at ([^ ]+):(\d+):(?:\d+)$/.exec(stackLine);
    if (attempt2) {
        return [attempt2[1], Number(attempt2[2])];
    }

    // Firefox style: "function@filename:lineNumber or @filename:lineNumber"
    var attempt3 = /.*@(.+):(\d+)$/.exec(stackLine);
    if (attempt3) {
        return [attempt3[1], Number(attempt3[2])];
    }
}

function isInternalFrame(stackLine) {
    var fileNameAndLineNumber = getFileNameAndLineNumber(stackLine);

    if (!fileNameAndLineNumber) {
        return false;
    }

    var fileName = fileNameAndLineNumber[0];
    var lineNumber = fileNameAndLineNumber[1];

    return fileName === qFileName &&
        lineNumber >= qStartingLine &&
        lineNumber <= qEndingLine;
}

// discover own file name and line number range for filtering stack
// traces
function captureLine() {
    if (!hasStacks) {
        return;
    }

    try {
        throw new Error();
    } catch (e) {
        var lines = e.stack.split("\n");
        var firstLine = lines[0].indexOf("@") > 0 ? lines[1] : lines[2];
        var fileNameAndLineNumber = getFileNameAndLineNumber(firstLine);
        if (!fileNameAndLineNumber) {
            return;
        }

        qFileName = fileNameAndLineNumber[0];
        return fileNameAndLineNumber[1];
    }
}

function deprecate(callback, name, alternative) {
    return function () {
        if (typeof console !== "undefined" &&
            typeof console.warn === "function") {
            console.warn(name + " is deprecated, use " + alternative +
                         " instead.", new Error("").stack);
        }
        return callback.apply(callback, arguments);
    };
}

// end of shims
// beginning of real work

/**
 * Constructs a promise for an immediate reference, passes promises through, or
 * coerces promises from different systems.
 * @param value immediate reference or promise
 */
function Q(value) {
    // If the object is already a Promise, return it directly.  This enables
    // the resolve function to both be used to created references from objects,
    // but to tolerably coerce non-promises to promises.
    if (value instanceof Promise) {
        return value;
    }

    // assimilate thenables
    if (isPromiseAlike(value)) {
        return coerce(value);
    } else {
        return fulfill(value);
    }
}
Q.resolve = Q;

/**
 * Performs a task in a future turn of the event loop.
 * @param {Function} task
 */
Q.nextTick = nextTick;

/**
 * Controls whether or not long stack traces will be on
 */
Q.longStackSupport = false;

// enable long stacks if Q_DEBUG is set
if (typeof process === "object" && process && process.env && process.env.Q_DEBUG) {
    Q.longStackSupport = true;
}

/**
 * Constructs a {promise, resolve, reject} object.
 *
 * `resolve` is a callback to invoke with a more resolved value for the
 * promise. To fulfill the promise, invoke `resolve` with any value that is
 * not a thenable. To reject the promise, invoke `resolve` with a rejected
 * thenable, or invoke `reject` with the reason directly. To resolve the
 * promise to another thenable, thus putting it in the same state, invoke
 * `resolve` with that other thenable.
 */
Q.defer = defer;
function defer() {
    // if "messages" is an "Array", that indicates that the promise has not yet
    // been resolved.  If it is "undefined", it has been resolved.  Each
    // element of the messages array is itself an array of complete arguments to
    // forward to the resolved promise.  We coerce the resolution value to a
    // promise using the `resolve` function because it handles both fully
    // non-thenable values and other thenables gracefully.
    var messages = [], progressListeners = [], resolvedPromise;

    var deferred = object_create(defer.prototype);
    var promise = object_create(Promise.prototype);

    promise.promiseDispatch = function (resolve, op, operands) {
        var args = array_slice(arguments);
        if (messages) {
            messages.push(args);
            if (op === "when" && operands[1]) { // progress operand
                progressListeners.push(operands[1]);
            }
        } else {
            Q.nextTick(function () {
                resolvedPromise.promiseDispatch.apply(resolvedPromise, args);
            });
        }
    };

    // XXX deprecated
    promise.valueOf = function () {
        if (messages) {
            return promise;
        }
        var nearerValue = nearer(resolvedPromise);
        if (isPromise(nearerValue)) {
            resolvedPromise = nearerValue; // shorten chain
        }
        return nearerValue;
    };

    promise.inspect = function () {
        if (!resolvedPromise) {
            return { state: "pending" };
        }
        return resolvedPromise.inspect();
    };

    if (Q.longStackSupport && hasStacks) {
        try {
            throw new Error();
        } catch (e) {
            // NOTE: don't try to use `Error.captureStackTrace` or transfer the
            // accessor around; that causes memory leaks as per GH-111. Just
            // reify the stack trace as a string ASAP.
            //
            // At the same time, cut off the first line; it's always just
            // "[object Promise]\n", as per the `toString`.
            promise.stack = e.stack.substring(e.stack.indexOf("\n") + 1);
        }
    }

    // NOTE: we do the checks for `resolvedPromise` in each method, instead of
    // consolidating them into `become`, since otherwise we'd create new
    // promises with the lines `become(whatever(value))`. See e.g. GH-252.

    function become(newPromise) {
        resolvedPromise = newPromise;
        promise.source = newPromise;

        array_reduce(messages, function (undefined, message) {
            Q.nextTick(function () {
                newPromise.promiseDispatch.apply(newPromise, message);
            });
        }, void 0);

        messages = void 0;
        progressListeners = void 0;
    }

    deferred.promise = promise;
    deferred.resolve = function (value) {
        if (resolvedPromise) {
            return;
        }

        become(Q(value));
    };

    deferred.fulfill = function (value) {
        if (resolvedPromise) {
            return;
        }

        become(fulfill(value));
    };
    deferred.reject = function (reason) {
        if (resolvedPromise) {
            return;
        }

        become(reject(reason));
    };
    deferred.notify = function (progress) {
        if (resolvedPromise) {
            return;
        }

        array_reduce(progressListeners, function (undefined, progressListener) {
            Q.nextTick(function () {
                progressListener(progress);
            });
        }, void 0);
    };

    return deferred;
}

/**
 * Creates a Node-style callback that will resolve or reject the deferred
 * promise.
 * @returns a nodeback
 */
defer.prototype.makeNodeResolver = function () {
    var self = this;
    return function (error, value) {
        if (error) {
            self.reject(error);
        } else if (arguments.length > 2) {
            self.resolve(array_slice(arguments, 1));
        } else {
            self.resolve(value);
        }
    };
};

/**
 * @param resolver {Function} a function that returns nothing and accepts
 * the resolve, reject, and notify functions for a deferred.
 * @returns a promise that may be resolved with the given resolve and reject
 * functions, or rejected by a thrown exception in resolver
 */
Q.Promise = promise; // ES6
Q.promise = promise;
function promise(resolver) {
    if (typeof resolver !== "function") {
        throw new TypeError("resolver must be a function.");
    }
    var deferred = defer();
    try {
        resolver(deferred.resolve, deferred.reject, deferred.notify);
    } catch (reason) {
        deferred.reject(reason);
    }
    return deferred.promise;
}

promise.race = race; // ES6
promise.all = all; // ES6
promise.reject = reject; // ES6
promise.resolve = Q; // ES6

// XXX experimental.  This method is a way to denote that a local value is
// serializable and should be immediately dispatched to a remote upon request,
// instead of passing a reference.
Q.passByCopy = function (object) {
    //freeze(object);
    //passByCopies.set(object, true);
    return object;
};

Promise.prototype.passByCopy = function () {
    //freeze(object);
    //passByCopies.set(object, true);
    return this;
};

/**
 * If two promises eventually fulfill to the same value, promises that value,
 * but otherwise rejects.
 * @param x {Any*}
 * @param y {Any*}
 * @returns {Any*} a promise for x and y if they are the same, but a rejection
 * otherwise.
 *
 */
Q.join = function (x, y) {
    return Q(x).join(y);
};

Promise.prototype.join = function (that) {
    return Q([this, that]).spread(function (x, y) {
        if (x === y) {
            // TODO: "===" should be Object.is or equiv
            return x;
        } else {
            throw new Error("Can't join: not the same: " + x + " " + y);
        }
    });
};

/**
 * Returns a promise for the first of an array of promises to become settled.
 * @param answers {Array[Any*]} promises to race
 * @returns {Any*} the first promise to be settled
 */
Q.race = race;
function race(answerPs) {
    return promise(function(resolve, reject) {
        // Switch to this once we can assume at least ES5
        // answerPs.forEach(function(answerP) {
        //     Q(answerP).then(resolve, reject);
        // });
        // Use this in the meantime
        for (var i = 0, len = answerPs.length; i < len; i++) {
            Q(answerPs[i]).then(resolve, reject);
        }
    });
}

Promise.prototype.race = function () {
    return this.then(Q.race);
};

/**
 * Constructs a Promise with a promise descriptor object and optional fallback
 * function.  The descriptor contains methods like when(rejected), get(name),
 * set(name, value), post(name, args), and delete(name), which all
 * return either a value, a promise for a value, or a rejection.  The fallback
 * accepts the operation name, a resolver, and any further arguments that would
 * have been forwarded to the appropriate method above had a method been
 * provided with the proper name.  The API makes no guarantees about the nature
 * of the returned object, apart from that it is usable whereever promises are
 * bought and sold.
 */
Q.makePromise = Promise;
function Promise(descriptor, fallback, inspect) {
    if (fallback === void 0) {
        fallback = function (op) {
            return reject(new Error(
                "Promise does not support operation: " + op
            ));
        };
    }
    if (inspect === void 0) {
        inspect = function () {
            return {state: "unknown"};
        };
    }

    var promise = object_create(Promise.prototype);

    promise.promiseDispatch = function (resolve, op, args) {
        var result;
        try {
            if (descriptor[op]) {
                result = descriptor[op].apply(promise, args);
            } else {
                result = fallback.call(promise, op, args);
            }
        } catch (exception) {
            result = reject(exception);
        }
        if (resolve) {
            resolve(result);
        }
    };

    promise.inspect = inspect;

    // XXX deprecated `valueOf` and `exception` support
    if (inspect) {
        var inspected = inspect();
        if (inspected.state === "rejected") {
            promise.exception = inspected.reason;
        }

        promise.valueOf = function () {
            var inspected = inspect();
            if (inspected.state === "pending" ||
                inspected.state === "rejected") {
                return promise;
            }
            return inspected.value;
        };
    }

    return promise;
}

Promise.prototype.toString = function () {
    return "[object Promise]";
};

Promise.prototype.then = function (fulfilled, rejected, progressed) {
    var self = this;
    var deferred = defer();
    var done = false;   // ensure the untrusted promise makes at most a
                        // single call to one of the callbacks

    function _fulfilled(value) {
        try {
            return typeof fulfilled === "function" ? fulfilled(value) : value;
        } catch (exception) {
            return reject(exception);
        }
    }

    function _rejected(exception) {
        if (typeof rejected === "function") {
            makeStackTraceLong(exception, self);
            try {
                return rejected(exception);
            } catch (newException) {
                return reject(newException);
            }
        }
        return reject(exception);
    }

    function _progressed(value) {
        return typeof progressed === "function" ? progressed(value) : value;
    }

    Q.nextTick(function () {
        self.promiseDispatch(function (value) {
            if (done) {
                return;
            }
            done = true;

            deferred.resolve(_fulfilled(value));
        }, "when", [function (exception) {
            if (done) {
                return;
            }
            done = true;

            deferred.resolve(_rejected(exception));
        }]);
    });

    // Progress propagator need to be attached in the current tick.
    self.promiseDispatch(void 0, "when", [void 0, function (value) {
        var newValue;
        var threw = false;
        try {
            newValue = _progressed(value);
        } catch (e) {
            threw = true;
            if (Q.onerror) {
                Q.onerror(e);
            } else {
                throw e;
            }
        }

        if (!threw) {
            deferred.notify(newValue);
        }
    }]);

    return deferred.promise;
};

Q.tap = function (promise, callback) {
    return Q(promise).tap(callback);
};

/**
 * Works almost like "finally", but not called for rejections.
 * Original resolution value is passed through callback unaffected.
 * Callback may return a promise that will be awaited for.
 * @param {Function} callback
 * @returns {Q.Promise}
 * @example
 * doSomething()
 *   .then(...)
 *   .tap(console.log)
 *   .then(...);
 */
Promise.prototype.tap = function (callback) {
    callback = Q(callback);

    return this.then(function (value) {
        return callback.fcall(value).thenResolve(value);
    });
};

/**
 * Registers an observer on a promise.
 *
 * Guarantees:
 *
 * 1. that fulfilled and rejected will be called only once.
 * 2. that either the fulfilled callback or the rejected callback will be
 *    called, but not both.
 * 3. that fulfilled and rejected will not be called in this turn.
 *
 * @param value      promise or immediate reference to observe
 * @param fulfilled  function to be called with the fulfilled value
 * @param rejected   function to be called with the rejection exception
 * @param progressed function to be called on any progress notifications
 * @return promise for the return value from the invoked callback
 */
Q.when = when;
function when(value, fulfilled, rejected, progressed) {
    return Q(value).then(fulfilled, rejected, progressed);
}

Promise.prototype.thenResolve = function (value) {
    return this.then(function () { return value; });
};

Q.thenResolve = function (promise, value) {
    return Q(promise).thenResolve(value);
};

Promise.prototype.thenReject = function (reason) {
    return this.then(function () { throw reason; });
};

Q.thenReject = function (promise, reason) {
    return Q(promise).thenReject(reason);
};

/**
 * If an object is not a promise, it is as "near" as possible.
 * If a promise is rejected, it is as "near" as possible too.
 * If it’s a fulfilled promise, the fulfillment value is nearer.
 * If it’s a deferred promise and the deferred has been resolved, the
 * resolution is "nearer".
 * @param object
 * @returns most resolved (nearest) form of the object
 */

// XXX should we re-do this?
Q.nearer = nearer;
function nearer(value) {
    if (isPromise(value)) {
        var inspected = value.inspect();
        if (inspected.state === "fulfilled") {
            return inspected.value;
        }
    }
    return value;
}

/**
 * @returns whether the given object is a promise.
 * Otherwise it is a fulfilled value.
 */
Q.isPromise = isPromise;
function isPromise(object) {
    return object instanceof Promise;
}

Q.isPromiseAlike = isPromiseAlike;
function isPromiseAlike(object) {
    return isObject(object) && typeof object.then === "function";
}

/**
 * @returns whether the given object is a pending promise, meaning not
 * fulfilled or rejected.
 */
Q.isPending = isPending;
function isPending(object) {
    return isPromise(object) && object.inspect().state === "pending";
}

Promise.prototype.isPending = function () {
    return this.inspect().state === "pending";
};

/**
 * @returns whether the given object is a value or fulfilled
 * promise.
 */
Q.isFulfilled = isFulfilled;
function isFulfilled(object) {
    return !isPromise(object) || object.inspect().state === "fulfilled";
}

Promise.prototype.isFulfilled = function () {
    return this.inspect().state === "fulfilled";
};

/**
 * @returns whether the given object is a rejected promise.
 */
Q.isRejected = isRejected;
function isRejected(object) {
    return isPromise(object) && object.inspect().state === "rejected";
}

Promise.prototype.isRejected = function () {
    return this.inspect().state === "rejected";
};

//// BEGIN UNHANDLED REJECTION TRACKING

// This promise library consumes exceptions thrown in handlers so they can be
// handled by a subsequent promise.  The exceptions get added to this array when
// they are created, and removed when they are handled.  Note that in ES6 or
// shimmed environments, this would naturally be a `Set`.
var unhandledReasons = [];
var unhandledRejections = [];
var trackUnhandledRejections = true;

function resetUnhandledRejections() {
    unhandledReasons.length = 0;
    unhandledRejections.length = 0;

    if (!trackUnhandledRejections) {
        trackUnhandledRejections = true;
    }
}

function trackRejection(promise, reason) {
    if (!trackUnhandledRejections) {
        return;
    }

    unhandledRejections.push(promise);
    if (reason && typeof reason.stack !== "undefined") {
        unhandledReasons.push(reason.stack);
    } else {
        unhandledReasons.push("(no stack) " + reason);
    }
}

function untrackRejection(promise) {
    if (!trackUnhandledRejections) {
        return;
    }

    var at = array_indexOf(unhandledRejections, promise);
    if (at !== -1) {
        unhandledRejections.splice(at, 1);
        unhandledReasons.splice(at, 1);
    }
}

Q.resetUnhandledRejections = resetUnhandledRejections;

Q.getUnhandledReasons = function () {
    // Make a copy so that consumers can't interfere with our internal state.
    return unhandledReasons.slice();
};

Q.stopUnhandledRejectionTracking = function () {
    resetUnhandledRejections();
    trackUnhandledRejections = false;
};

resetUnhandledRejections();

//// END UNHANDLED REJECTION TRACKING

/**
 * Constructs a rejected promise.
 * @param reason value describing the failure
 */
Q.reject = reject;
function reject(reason) {
    var rejection = Promise({
        "when": function (rejected) {
            // note that the error has been handled
            if (rejected) {
                untrackRejection(this);
            }
            return rejected ? rejected(reason) : this;
        }
    }, function fallback() {
        return this;
    }, function inspect() {
        return { state: "rejected", reason: reason };
    });

    // Note that the reason has not been handled.
    trackRejection(rejection, reason);

    return rejection;
}

/**
 * Constructs a fulfilled promise for an immediate reference.
 * @param value immediate reference
 */
Q.fulfill = fulfill;
function fulfill(value) {
    return Promise({
        "when": function () {
            return value;
        },
        "get": function (name) {
            return value[name];
        },
        "set": function (name, rhs) {
            value[name] = rhs;
        },
        "delete": function (name) {
            delete value[name];
        },
        "post": function (name, args) {
            // Mark Miller proposes that post with no name should apply a
            // promised function.
            if (name === null || name === void 0) {
                return value.apply(void 0, args);
            } else {
                return value[name].apply(value, args);
            }
        },
        "apply": function (thisp, args) {
            return value.apply(thisp, args);
        },
        "keys": function () {
            return object_keys(value);
        }
    }, void 0, function inspect() {
        return { state: "fulfilled", value: value };
    });
}

/**
 * Converts thenables to Q promises.
 * @param promise thenable promise
 * @returns a Q promise
 */
function coerce(promise) {
    var deferred = defer();
    Q.nextTick(function () {
        try {
            promise.then(deferred.resolve, deferred.reject, deferred.notify);
        } catch (exception) {
            deferred.reject(exception);
        }
    });
    return deferred.promise;
}

/**
 * Annotates an object such that it will never be
 * transferred away from this process over any promise
 * communication channel.
 * @param object
 * @returns promise a wrapping of that object that
 * additionally responds to the "isDef" message
 * without a rejection.
 */
Q.master = master;
function master(object) {
    return Promise({
        "isDef": function () {}
    }, function fallback(op, args) {
        return dispatch(object, op, args);
    }, function () {
        return Q(object).inspect();
    });
}

/**
 * Spreads the values of a promised array of arguments into the
 * fulfillment callback.
 * @param fulfilled callback that receives variadic arguments from the
 * promised array
 * @param rejected callback that receives the exception if the promise
 * is rejected.
 * @returns a promise for the return value or thrown exception of
 * either callback.
 */
Q.spread = spread;
function spread(value, fulfilled, rejected) {
    return Q(value).spread(fulfilled, rejected);
}

Promise.prototype.spread = function (fulfilled, rejected) {
    return this.all().then(function (array) {
        return fulfilled.apply(void 0, array);
    }, rejected);
};

/**
 * The async function is a decorator for generator functions, turning
 * them into asynchronous generators.  Although generators are only part
 * of the newest ECMAScript 6 drafts, this code does not cause syntax
 * errors in older engines.  This code should continue to work and will
 * in fact improve over time as the language improves.
 *
 * ES6 generators are currently part of V8 version 3.19 with the
 * --harmony-generators runtime flag enabled.  SpiderMonkey has had them
 * for longer, but under an older Python-inspired form.  This function
 * works on both kinds of generators.
 *
 * Decorates a generator function such that:
 *  - it may yield promises
 *  - execution will continue when that promise is fulfilled
 *  - the value of the yield expression will be the fulfilled value
 *  - it returns a promise for the return value (when the generator
 *    stops iterating)
 *  - the decorated function returns a promise for the return value
 *    of the generator or the first rejected promise among those
 *    yielded.
 *  - if an error is thrown in the generator, it propagates through
 *    every following yield until it is caught, or until it escapes
 *    the generator function altogether, and is translated into a
 *    rejection for the promise returned by the decorated generator.
 */
Q.async = async;
function async(makeGenerator) {
    return function () {
        // when verb is "send", arg is a value
        // when verb is "throw", arg is an exception
        function continuer(verb, arg) {
            var result;

            // Until V8 3.19 / Chromium 29 is released, SpiderMonkey is the only
            // engine that has a deployed base of browsers that support generators.
            // However, SM's generators use the Python-inspired semantics of
            // outdated ES6 drafts.  We would like to support ES6, but we'd also
            // like to make it possible to use generators in deployed browsers, so
            // we also support Python-style generators.  At some point we can remove
            // this block.

            if (typeof StopIteration === "undefined") {
                // ES6 Generators
                try {
                    result = generator[verb](arg);
                } catch (exception) {
                    return reject(exception);
                }
                if (result.done) {
                    return Q(result.value);
                } else {
                    return when(result.value, callback, errback);
                }
            } else {
                // SpiderMonkey Generators
                // FIXME: Remove this case when SM does ES6 generators.
                try {
                    result = generator[verb](arg);
                } catch (exception) {
                    if (isStopIteration(exception)) {
                        return Q(exception.value);
                    } else {
                        return reject(exception);
                    }
                }
                return when(result, callback, errback);
            }
        }
        var generator = makeGenerator.apply(this, arguments);
        var callback = continuer.bind(continuer, "next");
        var errback = continuer.bind(continuer, "throw");
        return callback();
    };
}

/**
 * The spawn function is a small wrapper around async that immediately
 * calls the generator and also ends the promise chain, so that any
 * unhandled errors are thrown instead of forwarded to the error
 * handler. This is useful because it's extremely common to run
 * generators at the top-level to work with libraries.
 */
Q.spawn = spawn;
function spawn(makeGenerator) {
    Q.done(Q.async(makeGenerator)());
}

// FIXME: Remove this interface once ES6 generators are in SpiderMonkey.
/**
 * Throws a ReturnValue exception to stop an asynchronous generator.
 *
 * This interface is a stop-gap measure to support generator return
 * values in older Firefox/SpiderMonkey.  In browsers that support ES6
 * generators like Chromium 29, just use "return" in your generator
 * functions.
 *
 * @param value the return value for the surrounding generator
 * @throws ReturnValue exception with the value.
 * @example
 * // ES6 style
 * Q.async(function* () {
 *      var foo = yield getFooPromise();
 *      var bar = yield getBarPromise();
 *      return foo + bar;
 * })
 * // Older SpiderMonkey style
 * Q.async(function () {
 *      var foo = yield getFooPromise();
 *      var bar = yield getBarPromise();
 *      Q.return(foo + bar);
 * })
 */
Q["return"] = _return;
function _return(value) {
    throw new QReturnValue(value);
}

/**
 * The promised function decorator ensures that any promise arguments
 * are settled and passed as values (`this` is also settled and passed
 * as a value).  It will also ensure that the result of a function is
 * always a promise.
 *
 * @example
 * var add = Q.promised(function (a, b) {
 *     return a + b;
 * });
 * add(Q(a), Q(B));
 *
 * @param {function} callback The function to decorate
 * @returns {function} a function that has been decorated.
 */
Q.promised = promised;
function promised(callback) {
    return function () {
        return spread([this, all(arguments)], function (self, args) {
            return callback.apply(self, args);
        });
    };
}

/**
 * sends a message to a value in a future turn
 * @param object* the recipient
 * @param op the name of the message operation, e.g., "when",
 * @param args further arguments to be forwarded to the operation
 * @returns result {Promise} a promise for the result of the operation
 */
Q.dispatch = dispatch;
function dispatch(object, op, args) {
    return Q(object).dispatch(op, args);
}

Promise.prototype.dispatch = function (op, args) {
    var self = this;
    var deferred = defer();
    Q.nextTick(function () {
        self.promiseDispatch(deferred.resolve, op, args);
    });
    return deferred.promise;
};

/**
 * Gets the value of a property in a future turn.
 * @param object    promise or immediate reference for target object
 * @param name      name of property to get
 * @return promise for the property value
 */
Q.get = function (object, key) {
    return Q(object).dispatch("get", [key]);
};

Promise.prototype.get = function (key) {
    return this.dispatch("get", [key]);
};

/**
 * Sets the value of a property in a future turn.
 * @param object    promise or immediate reference for object object
 * @param name      name of property to set
 * @param value     new value of property
 * @return promise for the return value
 */
Q.set = function (object, key, value) {
    return Q(object).dispatch("set", [key, value]);
};

Promise.prototype.set = function (key, value) {
    return this.dispatch("set", [key, value]);
};

/**
 * Deletes a property in a future turn.
 * @param object    promise or immediate reference for target object
 * @param name      name of property to delete
 * @return promise for the return value
 */
Q.del = // XXX legacy
Q["delete"] = function (object, key) {
    return Q(object).dispatch("delete", [key]);
};

Promise.prototype.del = // XXX legacy
Promise.prototype["delete"] = function (key) {
    return this.dispatch("delete", [key]);
};

/**
 * Invokes a method in a future turn.
 * @param object    promise or immediate reference for target object
 * @param name      name of method to invoke
 * @param value     a value to post, typically an array of
 *                  invocation arguments for promises that
 *                  are ultimately backed with `resolve` values,
 *                  as opposed to those backed with URLs
 *                  wherein the posted value can be any
 *                  JSON serializable object.
 * @return promise for the return value
 */
// bound locally because it is used by other methods
Q.mapply = // XXX As proposed by "Redsandro"
Q.post = function (object, name, args) {
    return Q(object).dispatch("post", [name, args]);
};

Promise.prototype.mapply = // XXX As proposed by "Redsandro"
Promise.prototype.post = function (name, args) {
    return this.dispatch("post", [name, args]);
};

/**
 * Invokes a method in a future turn.
 * @param object    promise or immediate reference for target object
 * @param name      name of method to invoke
 * @param ...args   array of invocation arguments
 * @return promise for the return value
 */
Q.send = // XXX Mark Miller's proposed parlance
Q.mcall = // XXX As proposed by "Redsandro"
Q.invoke = function (object, name /*...args*/) {
    return Q(object).dispatch("post", [name, array_slice(arguments, 2)]);
};

Promise.prototype.send = // XXX Mark Miller's proposed parlance
Promise.prototype.mcall = // XXX As proposed by "Redsandro"
Promise.prototype.invoke = function (name /*...args*/) {
    return this.dispatch("post", [name, array_slice(arguments, 1)]);
};

/**
 * Applies the promised function in a future turn.
 * @param object    promise or immediate reference for target function
 * @param args      array of application arguments
 */
Q.fapply = function (object, args) {
    return Q(object).dispatch("apply", [void 0, args]);
};

Promise.prototype.fapply = function (args) {
    return this.dispatch("apply", [void 0, args]);
};

/**
 * Calls the promised function in a future turn.
 * @param object    promise or immediate reference for target function
 * @param ...args   array of application arguments
 */
Q["try"] =
Q.fcall = function (object /* ...args*/) {
    return Q(object).dispatch("apply", [void 0, array_slice(arguments, 1)]);
};

Promise.prototype.fcall = function (/*...args*/) {
    return this.dispatch("apply", [void 0, array_slice(arguments)]);
};

/**
 * Binds the promised function, transforming return values into a fulfilled
 * promise and thrown errors into a rejected one.
 * @param object    promise or immediate reference for target function
 * @param ...args   array of application arguments
 */
Q.fbind = function (object /*...args*/) {
    var promise = Q(object);
    var args = array_slice(arguments, 1);
    return function fbound() {
        return promise.dispatch("apply", [
            this,
            args.concat(array_slice(arguments))
        ]);
    };
};
Promise.prototype.fbind = function (/*...args*/) {
    var promise = this;
    var args = array_slice(arguments);
    return function fbound() {
        return promise.dispatch("apply", [
            this,
            args.concat(array_slice(arguments))
        ]);
    };
};

/**
 * Requests the names of the owned properties of a promised
 * object in a future turn.
 * @param object    promise or immediate reference for target object
 * @return promise for the keys of the eventually settled object
 */
Q.keys = function (object) {
    return Q(object).dispatch("keys", []);
};

Promise.prototype.keys = function () {
    return this.dispatch("keys", []);
};

/**
 * Turns an array of promises into a promise for an array.  If any of
 * the promises gets rejected, the whole array is rejected immediately.
 * @param {Array*} an array (or promise for an array) of values (or
 * promises for values)
 * @returns a promise for an array of the corresponding values
 */
// By Mark Miller
// http://wiki.ecmascript.org/doku.php?id=strawman:concurrency&rev=1308776521#allfulfilled
Q.all = all;
function all(promises) {
    return when(promises, function (promises) {
        var countDown = 0;
        var deferred = defer();
        array_reduce(promises, function (undefined, promise, index) {
            var snapshot;
            if (
                isPromise(promise) &&
                (snapshot = promise.inspect()).state === "fulfilled"
            ) {
                promises[index] = snapshot.value;
            } else {
                ++countDown;
                when(
                    promise,
                    function (value) {
                        promises[index] = value;
                        if (--countDown === 0) {
                            deferred.resolve(promises);
                        }
                    },
                    deferred.reject,
                    function (progress) {
                        deferred.notify({ index: index, value: progress });
                    }
                );
            }
        }, void 0);
        if (countDown === 0) {
            deferred.resolve(promises);
        }
        return deferred.promise;
    });
}

Promise.prototype.all = function () {
    return all(this);
};

/**
 * Waits for all promises to be settled, either fulfilled or
 * rejected.  This is distinct from `all` since that would stop
 * waiting at the first rejection.  The promise returned by
 * `allResolved` will never be rejected.
 * @param promises a promise for an array (or an array) of promises
 * (or values)
 * @return a promise for an array of promises
 */
Q.allResolved = deprecate(allResolved, "allResolved", "allSettled");
function allResolved(promises) {
    return when(promises, function (promises) {
        promises = array_map(promises, Q);
        return when(all(array_map(promises, function (promise) {
            return when(promise, noop, noop);
        })), function () {
            return promises;
        });
    });
}

Promise.prototype.allResolved = function () {
    return allResolved(this);
};

/**
 * @see Promise#allSettled
 */
Q.allSettled = allSettled;
function allSettled(promises) {
    return Q(promises).allSettled();
}

/**
 * Turns an array of promises into a promise for an array of their states (as
 * returned by `inspect`) when they have all settled.
 * @param {Array[Any*]} values an array (or promise for an array) of values (or
 * promises for values)
 * @returns {Array[State]} an array of states for the respective values.
 */
Promise.prototype.allSettled = function () {
    return this.then(function (promises) {
        return all(array_map(promises, function (promise) {
            promise = Q(promise);
            function regardless() {
                return promise.inspect();
            }
            return promise.then(regardless, regardless);
        }));
    });
};

/**
 * Captures the failure of a promise, giving an oportunity to recover
 * with a callback.  If the given promise is fulfilled, the returned
 * promise is fulfilled.
 * @param {Any*} promise for something
 * @param {Function} callback to fulfill the returned promise if the
 * given promise is rejected
 * @returns a promise for the return value of the callback
 */
Q.fail = // XXX legacy
Q["catch"] = function (object, rejected) {
    return Q(object).then(void 0, rejected);
};

Promise.prototype.fail = // XXX legacy
Promise.prototype["catch"] = function (rejected) {
    return this.then(void 0, rejected);
};

/**
 * Attaches a listener that can respond to progress notifications from a
 * promise's originating deferred. This listener receives the exact arguments
 * passed to ``deferred.notify``.
 * @param {Any*} promise for something
 * @param {Function} callback to receive any progress notifications
 * @returns the given promise, unchanged
 */
Q.progress = progress;
function progress(object, progressed) {
    return Q(object).then(void 0, void 0, progressed);
}

Promise.prototype.progress = function (progressed) {
    return this.then(void 0, void 0, progressed);
};

/**
 * Provides an opportunity to observe the settling of a promise,
 * regardless of whether the promise is fulfilled or rejected.  Forwards
 * the resolution to the returned promise when the callback is done.
 * The callback can return a promise to defer completion.
 * @param {Any*} promise
 * @param {Function} callback to observe the resolution of the given
 * promise, takes no arguments.
 * @returns a promise for the resolution of the given promise when
 * ``fin`` is done.
 */
Q.fin = // XXX legacy
Q["finally"] = function (object, callback) {
    return Q(object)["finally"](callback);
};

Promise.prototype.fin = // XXX legacy
Promise.prototype["finally"] = function (callback) {
    callback = Q(callback);
    return this.then(function (value) {
        return callback.fcall().then(function () {
            return value;
        });
    }, function (reason) {
        // TODO attempt to recycle the rejection with "this".
        return callback.fcall().then(function () {
            throw reason;
        });
    });
};

/**
 * Terminates a chain of promises, forcing rejections to be
 * thrown as exceptions.
 * @param {Any*} promise at the end of a chain of promises
 * @returns nothing
 */
Q.done = function (object, fulfilled, rejected, progress) {
    return Q(object).done(fulfilled, rejected, progress);
};

Promise.prototype.done = function (fulfilled, rejected, progress) {
    var onUnhandledError = function (error) {
        // forward to a future turn so that ``when``
        // does not catch it and turn it into a rejection.
        Q.nextTick(function () {
            makeStackTraceLong(error, promise);
            if (Q.onerror) {
                Q.onerror(error);
            } else {
                throw error;
            }
        });
    };

    // Avoid unnecessary `nextTick`ing via an unnecessary `when`.
    var promise = fulfilled || rejected || progress ?
        this.then(fulfilled, rejected, progress) :
        this;

    if (typeof process === "object" && process && process.domain) {
        onUnhandledError = process.domain.bind(onUnhandledError);
    }

    promise.then(void 0, onUnhandledError);
};

/**
 * Causes a promise to be rejected if it does not get fulfilled before
 * some milliseconds time out.
 * @param {Any*} promise
 * @param {Number} milliseconds timeout
 * @param {Any*} custom error message or Error object (optional)
 * @returns a promise for the resolution of the given promise if it is
 * fulfilled before the timeout, otherwise rejected.
 */
Q.timeout = function (object, ms, error) {
    return Q(object).timeout(ms, error);
};

Promise.prototype.timeout = function (ms, error) {
    var deferred = defer();
    var timeoutId = setTimeout(function () {
        if (!error || "string" === typeof error) {
            error = new Error(error || "Timed out after " + ms + " ms");
            error.code = "ETIMEDOUT";
        }
        deferred.reject(error);
    }, ms);

    this.then(function (value) {
        clearTimeout(timeoutId);
        deferred.resolve(value);
    }, function (exception) {
        clearTimeout(timeoutId);
        deferred.reject(exception);
    }, deferred.notify);

    return deferred.promise;
};

/**
 * Returns a promise for the given value (or promised value), some
 * milliseconds after it resolved. Passes rejections immediately.
 * @param {Any*} promise
 * @param {Number} milliseconds
 * @returns a promise for the resolution of the given promise after milliseconds
 * time has elapsed since the resolution of the given promise.
 * If the given promise rejects, that is passed immediately.
 */
Q.delay = function (object, timeout) {
    if (timeout === void 0) {
        timeout = object;
        object = void 0;
    }
    return Q(object).delay(timeout);
};

Promise.prototype.delay = function (timeout) {
    return this.then(function (value) {
        var deferred = defer();
        setTimeout(function () {
            deferred.resolve(value);
        }, timeout);
        return deferred.promise;
    });
};

/**
 * Passes a continuation to a Node function, which is called with the given
 * arguments provided as an array, and returns a promise.
 *
 *      Q.nfapply(FS.readFile, [__filename])
 *      .then(function (content) {
 *      })
 *
 */
Q.nfapply = function (callback, args) {
    return Q(callback).nfapply(args);
};

Promise.prototype.nfapply = function (args) {
    var deferred = defer();
    var nodeArgs = array_slice(args);
    nodeArgs.push(deferred.makeNodeResolver());
    this.fapply(nodeArgs).fail(deferred.reject);
    return deferred.promise;
};

/**
 * Passes a continuation to a Node function, which is called with the given
 * arguments provided individually, and returns a promise.
 * @example
 * Q.nfcall(FS.readFile, __filename)
 * .then(function (content) {
 * })
 *
 */
Q.nfcall = function (callback /*...args*/) {
    var args = array_slice(arguments, 1);
    return Q(callback).nfapply(args);
};

Promise.prototype.nfcall = function (/*...args*/) {
    var nodeArgs = array_slice(arguments);
    var deferred = defer();
    nodeArgs.push(deferred.makeNodeResolver());
    this.fapply(nodeArgs).fail(deferred.reject);
    return deferred.promise;
};

/**
 * Wraps a NodeJS continuation passing function and returns an equivalent
 * version that returns a promise.
 * @example
 * Q.nfbind(FS.readFile, __filename)("utf-8")
 * .then(console.log)
 * .done()
 */
Q.nfbind =
Q.denodeify = function (callback /*...args*/) {
    var baseArgs = array_slice(arguments, 1);
    return function () {
        var nodeArgs = baseArgs.concat(array_slice(arguments));
        var deferred = defer();
        nodeArgs.push(deferred.makeNodeResolver());
        Q(callback).fapply(nodeArgs).fail(deferred.reject);
        return deferred.promise;
    };
};

Promise.prototype.nfbind =
Promise.prototype.denodeify = function (/*...args*/) {
    var args = array_slice(arguments);
    args.unshift(this);
    return Q.denodeify.apply(void 0, args);
};

Q.nbind = function (callback, thisp /*...args*/) {
    var baseArgs = array_slice(arguments, 2);
    return function () {
        var nodeArgs = baseArgs.concat(array_slice(arguments));
        var deferred = defer();
        nodeArgs.push(deferred.makeNodeResolver());
        function bound() {
            return callback.apply(thisp, arguments);
        }
        Q(bound).fapply(nodeArgs).fail(deferred.reject);
        return deferred.promise;
    };
};

Promise.prototype.nbind = function (/*thisp, ...args*/) {
    var args = array_slice(arguments, 0);
    args.unshift(this);
    return Q.nbind.apply(void 0, args);
};

/**
 * Calls a method of a Node-style object that accepts a Node-style
 * callback with a given array of arguments, plus a provided callback.
 * @param object an object that has the named method
 * @param {String} name name of the method of object
 * @param {Array} args arguments to pass to the method; the callback
 * will be provided by Q and appended to these arguments.
 * @returns a promise for the value or error
 */
Q.nmapply = // XXX As proposed by "Redsandro"
Q.npost = function (object, name, args) {
    return Q(object).npost(name, args);
};

Promise.prototype.nmapply = // XXX As proposed by "Redsandro"
Promise.prototype.npost = function (name, args) {
    var nodeArgs = array_slice(args || []);
    var deferred = defer();
    nodeArgs.push(deferred.makeNodeResolver());
    this.dispatch("post", [name, nodeArgs]).fail(deferred.reject);
    return deferred.promise;
};

/**
 * Calls a method of a Node-style object that accepts a Node-style
 * callback, forwarding the given variadic arguments, plus a provided
 * callback argument.
 * @param object an object that has the named method
 * @param {String} name name of the method of object
 * @param ...args arguments to pass to the method; the callback will
 * be provided by Q and appended to these arguments.
 * @returns a promise for the value or error
 */
Q.nsend = // XXX Based on Mark Miller's proposed "send"
Q.nmcall = // XXX Based on "Redsandro's" proposal
Q.ninvoke = function (object, name /*...args*/) {
    var nodeArgs = array_slice(arguments, 2);
    var deferred = defer();
    nodeArgs.push(deferred.makeNodeResolver());
    Q(object).dispatch("post", [name, nodeArgs]).fail(deferred.reject);
    return deferred.promise;
};

Promise.prototype.nsend = // XXX Based on Mark Miller's proposed "send"
Promise.prototype.nmcall = // XXX Based on "Redsandro's" proposal
Promise.prototype.ninvoke = function (name /*...args*/) {
    var nodeArgs = array_slice(arguments, 1);
    var deferred = defer();
    nodeArgs.push(deferred.makeNodeResolver());
    this.dispatch("post", [name, nodeArgs]).fail(deferred.reject);
    return deferred.promise;
};

/**
 * If a function would like to support both Node continuation-passing-style and
 * promise-returning-style, it can end its internal promise chain with
 * `nodeify(nodeback)`, forwarding the optional nodeback argument.  If the user
 * elects to use a nodeback, the result will be sent there.  If they do not
 * pass a nodeback, they will receive the result promise.
 * @param object a result (or a promise for a result)
 * @param {Function} nodeback a Node.js-style callback
 * @returns either the promise or nothing
 */
Q.nodeify = nodeify;
function nodeify(object, nodeback) {
    return Q(object).nodeify(nodeback);
}

Promise.prototype.nodeify = function (nodeback) {
    if (nodeback) {
        this.then(function (value) {
            Q.nextTick(function () {
                nodeback(null, value);
            });
        }, function (error) {
            Q.nextTick(function () {
                nodeback(error);
            });
        });
    } else {
        return this;
    }
};

// All code before this point will be filtered from stack traces.
var qEndingLine = captureLine();

return Q;

});
/*!
 * clipboard.js v1.5.10
 * https://zenorocha.github.io/clipboard.js
 *
 * Licensed MIT © Zeno Rocha
 */

(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.Clipboard = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var matches = require('matches-selector')

module.exports = function (element, selector, checkYoSelf) {
  var parent = checkYoSelf ? element : element.parentNode

  while (parent && parent !== document) {
    if (matches(parent, selector)) return parent;
    parent = parent.parentNode
  }
}

},{"matches-selector":5}],2:[function(require,module,exports){
var closest = require('closest');

/**
 * Delegates event to a selector.
 *
 * @param {Element} element
 * @param {String} selector
 * @param {String} type
 * @param {Function} callback
 * @param {Boolean} useCapture
 * @return {Object}
 */
function delegate(element, selector, type, callback, useCapture) {
    var listenerFn = listener.apply(this, arguments);

    element.addEventListener(type, listenerFn, useCapture);

    return {
        destroy: function() {
            element.removeEventListener(type, listenerFn, useCapture);
        }
    }
}

/**
 * Finds closest match and invokes callback.
 *
 * @param {Element} element
 * @param {String} selector
 * @param {String} type
 * @param {Function} callback
 * @return {Function}
 */
function listener(element, selector, type, callback) {
    return function(e) {
        e.delegateTarget = closest(e.target, selector, true);

        if (e.delegateTarget) {
            callback.call(element, e);
        }
    }
}

module.exports = delegate;

},{"closest":1}],3:[function(require,module,exports){
/**
 * Check if argument is a HTML element.
 *
 * @param {Object} value
 * @return {Boolean}
 */
exports.node = function(value) {
    return value !== undefined
        && value instanceof HTMLElement
        && value.nodeType === 1;
};

/**
 * Check if argument is a list of HTML elements.
 *
 * @param {Object} value
 * @return {Boolean}
 */
exports.nodeList = function(value) {
    var type = Object.prototype.toString.call(value);

    return value !== undefined
        && (type === '[object NodeList]' || type === '[object HTMLCollection]')
        && ('length' in value)
        && (value.length === 0 || exports.node(value[0]));
};

/**
 * Check if argument is a string.
 *
 * @param {Object} value
 * @return {Boolean}
 */
exports.string = function(value) {
    return typeof value === 'string'
        || value instanceof String;
};

/**
 * Check if argument is a function.
 *
 * @param {Object} value
 * @return {Boolean}
 */
exports.fn = function(value) {
    var type = Object.prototype.toString.call(value);

    return type === '[object Function]';
};

},{}],4:[function(require,module,exports){
var is = require('./is');
var delegate = require('delegate');

/**
 * Validates all params and calls the right
 * listener function based on its target type.
 *
 * @param {String|HTMLElement|HTMLCollection|NodeList} target
 * @param {String} type
 * @param {Function} callback
 * @return {Object}
 */
function listen(target, type, callback) {
    if (!target && !type && !callback) {
        throw new Error('Missing required arguments');
    }

    if (!is.string(type)) {
        throw new TypeError('Second argument must be a String');
    }

    if (!is.fn(callback)) {
        throw new TypeError('Third argument must be a Function');
    }

    if (is.node(target)) {
        return listenNode(target, type, callback);
    }
    else if (is.nodeList(target)) {
        return listenNodeList(target, type, callback);
    }
    else if (is.string(target)) {
        return listenSelector(target, type, callback);
    }
    else {
        throw new TypeError('First argument must be a String, HTMLElement, HTMLCollection, or NodeList');
    }
}

/**
 * Adds an event listener to a HTML element
 * and returns a remove listener function.
 *
 * @param {HTMLElement} node
 * @param {String} type
 * @param {Function} callback
 * @return {Object}
 */
function listenNode(node, type, callback) {
    node.addEventListener(type, callback);

    return {
        destroy: function() {
            node.removeEventListener(type, callback);
        }
    }
}

/**
 * Add an event listener to a list of HTML elements
 * and returns a remove listener function.
 *
 * @param {NodeList|HTMLCollection} nodeList
 * @param {String} type
 * @param {Function} callback
 * @return {Object}
 */
function listenNodeList(nodeList, type, callback) {
    Array.prototype.forEach.call(nodeList, function(node) {
        node.addEventListener(type, callback);
    });

    return {
        destroy: function() {
            Array.prototype.forEach.call(nodeList, function(node) {
                node.removeEventListener(type, callback);
            });
        }
    }
}

/**
 * Add an event listener to a selector
 * and returns a remove listener function.
 *
 * @param {String} selector
 * @param {String} type
 * @param {Function} callback
 * @return {Object}
 */
function listenSelector(selector, type, callback) {
    return delegate(document.body, selector, type, callback);
}

module.exports = listen;

},{"./is":3,"delegate":2}],5:[function(require,module,exports){

/**
 * Element prototype.
 */

var proto = Element.prototype;

/**
 * Vendor function.
 */

var vendor = proto.matchesSelector
  || proto.webkitMatchesSelector
  || proto.mozMatchesSelector
  || proto.msMatchesSelector
  || proto.oMatchesSelector;

/**
 * Expose `match()`.
 */

module.exports = match;

/**
 * Match `el` to `selector`.
 *
 * @param {Element} el
 * @param {String} selector
 * @return {Boolean}
 * @api public
 */

function match(el, selector) {
  if (vendor) return vendor.call(el, selector);
  var nodes = el.parentNode.querySelectorAll(selector);
  for (var i = 0; i < nodes.length; ++i) {
    if (nodes[i] == el) return true;
  }
  return false;
}
},{}],6:[function(require,module,exports){
function select(element) {
    var selectedText;

    if (element.nodeName === 'INPUT' || element.nodeName === 'TEXTAREA') {
        element.focus();
        element.setSelectionRange(0, element.value.length);

        selectedText = element.value;
    }
    else {
        if (element.hasAttribute('contenteditable')) {
            element.focus();
        }

        var selection = window.getSelection();
        var range = document.createRange();

        range.selectNodeContents(element);
        selection.removeAllRanges();
        selection.addRange(range);

        selectedText = selection.toString();
    }

    return selectedText;
}

module.exports = select;

},{}],7:[function(require,module,exports){
function E () {
	// Keep this empty so it's easier to inherit from
  // (via https://github.com/lipsmack from https://github.com/scottcorgan/tiny-emitter/issues/3)
}

E.prototype = {
	on: function (name, callback, ctx) {
    var e = this.e || (this.e = {});

    (e[name] || (e[name] = [])).push({
      fn: callback,
      ctx: ctx
    });

    return this;
  },

  once: function (name, callback, ctx) {
    var self = this;
    function listener () {
      self.off(name, listener);
      callback.apply(ctx, arguments);
    };

    listener._ = callback
    return this.on(name, listener, ctx);
  },

  emit: function (name) {
    var data = [].slice.call(arguments, 1);
    var evtArr = ((this.e || (this.e = {}))[name] || []).slice();
    var i = 0;
    var len = evtArr.length;

    for (i; i < len; i++) {
      evtArr[i].fn.apply(evtArr[i].ctx, data);
    }

    return this;
  },

  off: function (name, callback) {
    var e = this.e || (this.e = {});
    var evts = e[name];
    var liveEvents = [];

    if (evts && callback) {
      for (var i = 0, len = evts.length; i < len; i++) {
        if (evts[i].fn !== callback && evts[i].fn._ !== callback)
          liveEvents.push(evts[i]);
      }
    }

    // Remove event from queue to prevent memory leak
    // Suggested by https://github.com/lazd
    // Ref: https://github.com/scottcorgan/tiny-emitter/commit/c6ebfaa9bc973b33d110a84a307742b7cf94c953#commitcomment-5024910

    (liveEvents.length)
      ? e[name] = liveEvents
      : delete e[name];

    return this;
  }
};

module.exports = E;

},{}],8:[function(require,module,exports){
(function (global, factory) {
    if (typeof define === "function" && define.amd) {
        define(['module', 'select'], factory);
    } else if (typeof exports !== "undefined") {
        factory(module, require('select'));
    } else {
        var mod = {
            exports: {}
        };
        factory(mod, global.select);
        global.clipboardAction = mod.exports;
    }
})(this, function (module, _select) {
    'use strict';

    var _select2 = _interopRequireDefault(_select);

    function _interopRequireDefault(obj) {
        return obj && obj.__esModule ? obj : {
            default: obj
        };
    }

    var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
        return typeof obj;
    } : function (obj) {
        return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj;
    };

    function _classCallCheck(instance, Constructor) {
        if (!(instance instanceof Constructor)) {
            throw new TypeError("Cannot call a class as a function");
        }
    }

    var _createClass = function () {
        function defineProperties(target, props) {
            for (var i = 0; i < props.length; i++) {
                var descriptor = props[i];
                descriptor.enumerable = descriptor.enumerable || false;
                descriptor.configurable = true;
                if ("value" in descriptor) descriptor.writable = true;
                Object.defineProperty(target, descriptor.key, descriptor);
            }
        }

        return function (Constructor, protoProps, staticProps) {
            if (protoProps) defineProperties(Constructor.prototype, protoProps);
            if (staticProps) defineProperties(Constructor, staticProps);
            return Constructor;
        };
    }();

    var ClipboardAction = function () {
        /**
         * @param {Object} options
         */

        function ClipboardAction(options) {
            _classCallCheck(this, ClipboardAction);

            this.resolveOptions(options);
            this.initSelection();
        }

        /**
         * Defines base properties passed from constructor.
         * @param {Object} options
         */


        ClipboardAction.prototype.resolveOptions = function resolveOptions() {
            var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

            this.action = options.action;
            this.emitter = options.emitter;
            this.target = options.target;
            this.text = options.text;
            this.trigger = options.trigger;

            this.selectedText = '';
        };

        ClipboardAction.prototype.initSelection = function initSelection() {
            if (this.text) {
                this.selectFake();
            } else if (this.target) {
                this.selectTarget();
            }
        };

        ClipboardAction.prototype.selectFake = function selectFake() {
            var _this = this;

            var isRTL = document.documentElement.getAttribute('dir') == 'rtl';

            this.removeFake();

            this.fakeHandler = document.body.addEventListener('click', function () {
                return _this.removeFake();
            });

            this.fakeElem = document.createElement('textarea');
            // Prevent zooming on iOS
            this.fakeElem.style.fontSize = '12pt';
            // Reset box model
            this.fakeElem.style.border = '0';
            this.fakeElem.style.padding = '0';
            this.fakeElem.style.margin = '0';
            // Move element out of screen horizontally
            this.fakeElem.style.position = 'fixed';
            this.fakeElem.style[isRTL ? 'right' : 'left'] = '-9999px';
            // Move element to the same position vertically
            this.fakeElem.style.top = (window.pageYOffset || document.documentElement.scrollTop) + 'px';
            this.fakeElem.setAttribute('readonly', '');
            this.fakeElem.value = this.text;

            document.body.appendChild(this.fakeElem);

            this.selectedText = (0, _select2.default)(this.fakeElem);
            this.copyText();
        };

        ClipboardAction.prototype.removeFake = function removeFake() {
            if (this.fakeHandler) {
                document.body.removeEventListener('click');
                this.fakeHandler = null;
            }

            if (this.fakeElem) {
                document.body.removeChild(this.fakeElem);
                this.fakeElem = null;
            }
        };

        ClipboardAction.prototype.selectTarget = function selectTarget() {
            this.selectedText = (0, _select2.default)(this.target);
            this.copyText();
        };

        ClipboardAction.prototype.copyText = function copyText() {
            var succeeded = undefined;

            try {
                succeeded = document.execCommand(this.action);
            } catch (err) {
                succeeded = false;
            }

            this.handleResult(succeeded);
        };

        ClipboardAction.prototype.handleResult = function handleResult(succeeded) {
            if (succeeded) {
                this.emitter.emit('success', {
                    action: this.action,
                    text: this.selectedText,
                    trigger: this.trigger,
                    clearSelection: this.clearSelection.bind(this)
                });
            } else {
                this.emitter.emit('error', {
                    action: this.action,
                    trigger: this.trigger,
                    clearSelection: this.clearSelection.bind(this)
                });
            }
        };

        ClipboardAction.prototype.clearSelection = function clearSelection() {
            if (this.target) {
                this.target.blur();
            }

            window.getSelection().removeAllRanges();
        };

        ClipboardAction.prototype.destroy = function destroy() {
            this.removeFake();
        };

        _createClass(ClipboardAction, [{
            key: 'action',
            set: function set() {
                var action = arguments.length <= 0 || arguments[0] === undefined ? 'copy' : arguments[0];

                this._action = action;

                if (this._action !== 'copy' && this._action !== 'cut') {
                    throw new Error('Invalid "action" value, use either "copy" or "cut"');
                }
            },
            get: function get() {
                return this._action;
            }
        }, {
            key: 'target',
            set: function set(target) {
                if (target !== undefined) {
                    if (target && (typeof target === 'undefined' ? 'undefined' : _typeof(target)) === 'object' && target.nodeType === 1) {
                        if (this.action === 'copy' && target.hasAttribute('disabled')) {
                            throw new Error('Invalid "target" attribute. Please use "readonly" instead of "disabled" attribute');
                        }

                        if (this.action === 'cut' && (target.hasAttribute('readonly') || target.hasAttribute('disabled'))) {
                            throw new Error('Invalid "target" attribute. You can\'t cut text from elements with "readonly" or "disabled" attributes');
                        }

                        this._target = target;
                    } else {
                        throw new Error('Invalid "target" value, use a valid Element');
                    }
                }
            },
            get: function get() {
                return this._target;
            }
        }]);

        return ClipboardAction;
    }();

    module.exports = ClipboardAction;
});

},{"select":6}],9:[function(require,module,exports){
(function (global, factory) {
    if (typeof define === "function" && define.amd) {
        define(['module', './clipboard-action', 'tiny-emitter', 'good-listener'], factory);
    } else if (typeof exports !== "undefined") {
        factory(module, require('./clipboard-action'), require('tiny-emitter'), require('good-listener'));
    } else {
        var mod = {
            exports: {}
        };
        factory(mod, global.clipboardAction, global.tinyEmitter, global.goodListener);
        global.clipboard = mod.exports;
    }
})(this, function (module, _clipboardAction, _tinyEmitter, _goodListener) {
    'use strict';

    var _clipboardAction2 = _interopRequireDefault(_clipboardAction);

    var _tinyEmitter2 = _interopRequireDefault(_tinyEmitter);

    var _goodListener2 = _interopRequireDefault(_goodListener);

    function _interopRequireDefault(obj) {
        return obj && obj.__esModule ? obj : {
            default: obj
        };
    }

    function _classCallCheck(instance, Constructor) {
        if (!(instance instanceof Constructor)) {
            throw new TypeError("Cannot call a class as a function");
        }
    }

    function _possibleConstructorReturn(self, call) {
        if (!self) {
            throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
        }

        return call && (typeof call === "object" || typeof call === "function") ? call : self;
    }

    function _inherits(subClass, superClass) {
        if (typeof superClass !== "function" && superClass !== null) {
            throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
        }

        subClass.prototype = Object.create(superClass && superClass.prototype, {
            constructor: {
                value: subClass,
                enumerable: false,
                writable: true,
                configurable: true
            }
        });
        if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
    }

    var Clipboard = function (_Emitter) {
        _inherits(Clipboard, _Emitter);

        /**
         * @param {String|HTMLElement|HTMLCollection|NodeList} trigger
         * @param {Object} options
         */

        function Clipboard(trigger, options) {
            _classCallCheck(this, Clipboard);

            var _this = _possibleConstructorReturn(this, _Emitter.call(this));

            _this.resolveOptions(options);
            _this.listenClick(trigger);
            return _this;
        }

        /**
         * Defines if attributes would be resolved using internal setter functions
         * or custom functions that were passed in the constructor.
         * @param {Object} options
         */


        Clipboard.prototype.resolveOptions = function resolveOptions() {
            var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

            this.action = typeof options.action === 'function' ? options.action : this.defaultAction;
            this.target = typeof options.target === 'function' ? options.target : this.defaultTarget;
            this.text = typeof options.text === 'function' ? options.text : this.defaultText;
        };

        Clipboard.prototype.listenClick = function listenClick(trigger) {
            var _this2 = this;

            this.listener = (0, _goodListener2.default)(trigger, 'click', function (e) {
                return _this2.onClick(e);
            });
        };

        Clipboard.prototype.onClick = function onClick(e) {
            var trigger = e.delegateTarget || e.currentTarget;

            if (this.clipboardAction) {
                this.clipboardAction = null;
            }

            this.clipboardAction = new _clipboardAction2.default({
                action: this.action(trigger),
                target: this.target(trigger),
                text: this.text(trigger),
                trigger: trigger,
                emitter: this
            });
        };

        Clipboard.prototype.defaultAction = function defaultAction(trigger) {
            return getAttributeValue('action', trigger);
        };

        Clipboard.prototype.defaultTarget = function defaultTarget(trigger) {
            var selector = getAttributeValue('target', trigger);

            if (selector) {
                return document.querySelector(selector);
            }
        };

        Clipboard.prototype.defaultText = function defaultText(trigger) {
            return getAttributeValue('text', trigger);
        };

        Clipboard.prototype.destroy = function destroy() {
            this.listener.destroy();

            if (this.clipboardAction) {
                this.clipboardAction.destroy();
                this.clipboardAction = null;
            }
        };

        return Clipboard;
    }(_tinyEmitter2.default);

    /**
     * Helper function to retrieve attribute value.
     * @param {String} suffix
     * @param {Element} element
     */
    function getAttributeValue(suffix, element) {
        var attribute = 'data-clipboard-' + suffix;

        if (!element.hasAttribute(attribute)) {
            return;
        }

        return element.getAttribute(attribute);
    }

    module.exports = Clipboard;
});

},{"./clipboard-action":8,"good-listener":4,"tiny-emitter":7}]},{},[9])(9)
});
(function() {
  var _ref, _ref1;

  window.RG = {
    Models: {},
    Collections: {},
    Commands: {},
    Controllers: {},
    Popovers: null,
    Factories: {},
    Validators: {},
    Interactions: {},
    Views: {
      Downtimes: {},
      Dialogs: {},
      Factories: {},
      Resource: {},
      Selectors: {},
      Filters: {}
    },
    Routers: {},
    Support: {},
    Utils: {},
    Parsers: {},
    Renderer: {},
    Variables: {
      DowntimeType: {
        publicHoliday: 'Public holiday',
        vacation: 'Vacation (personal)',
        maternity: 'Maternity/paternity leave',
        sick: 'Sick leave',
        other: 'Other time off'
      },
      MaximumDowntimeLength: parseInt((_ref = window.validationData) != null ? _ref['MaximumDowntimeLength'] : void 0) || 365,
      MaximumCustomAvailabilityLength: parseInt((_ref1 = window.validationData) != null ? _ref1['MaximumCustomAvailabilityLength'] : void 0) || 365
    },
    bindTimeOff: function(selectedElements) {
      return selectedElements.on('click', function(e) {
        var factory, newDowntimeDialog, popover;
        e.preventDefault();
        if (RG.Popovers.popoverActive) {
          return;
        }
        factory = new RG.Factories.NewDowntimeDialog;
        newDowntimeDialog = factory.create(window.currentDashboardDate);
        popover = new RG.Views.Dialogs.Popover({
          removeAttachTo: false,
          attachTo: selectedElements,
          body: newDowntimeDialog,
          className: 'dashboard-time-off js-downtime-new',
          callback: function() {
            return $(".js-add-time-off-link").removeClass("active");
          }
        });
        popover.shrinkDropdown = function(el) {};
        popover.setPosition = function() {
          var baseTopOffset, contentHeight, main, offset, scrollable, shadowMargin, shadowTopOffset, windowBottom;
          this.$(".shadow-arrow").css({
            top: ""
          });
          this.$el.css({
            top: "",
            left: ""
          });
          this.$(".f-dropdown").removeClass("cdrop-left").removeClass("cdrop-right");
          this.$(".f-dropdown .dropdown-content").css({
            "max-height": $(window).height()
          });
          this.$(".f-dropdown .dropdown-content main").css({
            "max-height": $(window).height() - this.$(".f-dropdown .dropdown-content header, .f-dropdown .dropdown-content .tabs").height() - 130
          });
          this._setOpenDirection();
          baseTopOffset = -20;
          offset = this.$el.offset();
          windowBottom = $(window).scrollTop() + $(window).height();
          shadowMargin = parseInt(this.$(".shadow-arrow").css("margin-top"), 10);
          if (offset.top + shadowMargin > windowBottom - 40) {
            $(window).scrollTop($(window).scrollTop() + 40 + shadowMargin + offset.top - windowBottom);
            windowBottom = $(window).scrollTop() + $(window).height();
          }
          windowBottom = $(window).scrollTop() + $(window).height();
          contentHeight = this.$el.children(0).outerHeight();
          baseTopOffset = _.min([-20, -(offset.top + contentHeight - windowBottom) + 20]) - 30;
          if (offset.top + baseTopOffset < 20) {
            baseTopOffset = -offset.top + $(window).scrollTop() + 60;
          }
          shadowTopOffset = -baseTopOffset - 16;
          this.$(".shadow-arrow").css({
            top: shadowTopOffset
          });
          this.$el.css({
            position: 'absolute',
            left: "-17px",
            top: baseTopOffset
          });
          main = this.el.querySelector(".f-dropdown .dropdown-content main");
          scrollable = main && main.scrollHeight > main.offsetHeight;
          return this.$el.toggleClass("is-scrollable", scrollable);
        };
        return RG.Popovers.set(popover);
      });
    },
    closeAllSelections: function() {},
    clearStaleDropdowns: function() {},
    getUnitWidth: function() {
      return 40;
    },
    spin: function(target, options) {
      if (options == null) {
        options = {
          lines: 9,
          length: 3,
          width: 2,
          radius: 2,
          corners: 1,
          rotate: 0,
          speed: 1,
          shadow: false,
          hwaccel: false
        };
      }
      window.requestAnimationFrame((function(_this) {
        return function() {
          if (target) {
            _this.Variables.spinner = new Spinner(options).spin(target);
          }
        };
      })(this));
    },
    stopSpinners: function() {
      window.requestAnimationFrame((function(_this) {
        return function() {
          if (_this.Variables.spinner) {
            _this.Variables.spinner.stop();
            _this.Variables.spinner = null;
          }
        };
      })(this));
    }
  };

}).call(this);
// Polyfill taken from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/find

if (!Array.prototype.find) {
  Array.prototype.find = function(predicate) {
    if (this === null) {
      throw new TypeError('Array.prototype.find called on null or undefined');
    }
    if (typeof predicate !== 'function') {
      throw new TypeError('predicate must be a function');
    }
    var list = Object(this);
    var length = list.length >>> 0;
    var thisArg = arguments[1];
    var value;

    for (var i = 0; i < length; i++) {
      value = list[i];
      if (predicate.call(thisArg, value, i, list)) {
        return value;
      }
    }
    return undefined;
  };
}
;
// Polyfill taken from https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_objects/Function/bind
if (!Function.prototype.bind) {
  Function.prototype.bind = function(oThis) {
    if (typeof this !== 'function') {
      // closest thing possible to the ECMAScript 5
      // internal IsCallable function
      throw new TypeError('Function.prototype.bind - what is trying to be bound is not callable');
    }

    var aArgs = Array.prototype.slice.call(arguments, 1),
      fToBind = this,
      fNOP    = function() {},
      fBound  = function() {
          return fToBind.apply(this instanceof fNOP
                               ? this
                               : oThis,
                               aArgs.concat(Array.prototype.slice.call(arguments)));
      };

    if (this.prototype) {
        // native functions don't have a prototype
        fNOP.prototype = this.prototype;
    }
    fBound.prototype = new fNOP();

    return fBound;
  };
}
;
(function() {
  RG.Factories.AvailabilityManager = (function() {
    function AvailabilityManager(resource) {
      this.resource = resource;
    }

    AvailabilityManager.prototype.create = function() {
      return new RG.Utils.AvailabilityManager({
        availablePeriods: this.resource.availablePeriods,
        customAvailablePeriods: this.resource.customAvailablePeriods,
        overtimes: this.resource.overtimes,
        downtimes: this.resource.downtimes,
        resource: this.resource,
        timeZone: this.resource.getTimeZone()
      });
    };

    return AvailabilityManager;

  })();

}).call(this);
(function() {
  RG.Validators.CustomAvailabilityLengthValidator = (function() {
    function CustomAvailabilityLengthValidator() {}

    CustomAvailabilityLengthValidator.prototype.validate = function(view) {
      if (view.getDateRange().getNumberOfDays() <= RG.Variables.MaximumCustomAvailabilityLength) {
        $(view.el).find(".error").hide();
        return true;
      }
      $(view.el).find(".error").text("Woah there, you're changing the availability for over a year. It is much better to make this type of change to the resource's \"normal availability\" which you can edit in the Resources section. Alternatively, you can make multiple changes here with each one spanning less than a year.").show();
      return false;
    };

    return CustomAvailabilityLengthValidator;

  })();

}).call(this);
(function() {
  RG.Validators.DowntimeLengthValidator = (function() {
    function DowntimeLengthValidator() {}

    DowntimeLengthValidator.prototype.validate = function(view) {
      if (view.dateRangeSelector.getDateRange().getNumberOfDays() <= RG.Variables.MaximumDowntimeLength) {
        $(view.el).find(".error").hide();
        return true;
      }
      $(view.el).find(".error").text("Woah there, you're changing the availability for over a year. It is much better to make this type of change to the resource's \"normal availability\" which you can edit in the Resources section. Alternatively, you can make multiple changes here with each one spanning less than a year.").show();
      return false;
    };

    return DowntimeLengthValidator;

  })();

}).call(this);
(function() {
  RG.Factories.NewDowntimeDialog = (function() {
    function NewDowntimeDialog() {}

    NewDowntimeDialog.prototype.create = function(defaultDate) {
      var newDowntime, options, resource, resourceSelector, updater;
      if (defaultDate == null) {
        defaultDate = new Date();
      }
      updater = new RG.Utils.DashboardUpdater;
      resource = window.resources.findWhere({
        id: window.currentResourceInstanceId
      });
      resourceSelector = new RG.Views.Selectors.ResourceStatic(resource);
      options = {
        currentUserId: window.currentUserId,
        resourceSelector: resourceSelector,
        bookers: window.bookers,
        deletedBookers: window.deletedBookers,
        downtimeTypes: window.downtimeTypes,
        successCallback: function() {
          return updater.update();
        },
        dateRange: new RG.Utils.DateRange(defaultDate, defaultDate),
        resource: resource,
        resources: window.resources,
        timeZones: window.timeZones,
        renderHeader: true,
        spinnerAttachToEl: ".js-downtime-new"
      };
      options.timeRange = new RG.Utils.TimeRange(0, 1440);
      return newDowntime = new RG.Views.Dialogs.NewDowntime(options);
    };

    return NewDowntimeDialog;

  })();

}).call(this);
(function() {
  RG.Utils.BookingDataParser = {
    expirePolls: function() {}
  };

}).call(this);
(function() {
  RG.Utils.DashboardUpdater = (function() {
    function DashboardUpdater() {}

    DashboardUpdater.prototype.update = function() {
      var e;
      e = $("#refresh_form");
      e.submit();
      return setTimeout(function() {
        RG.Variables.waitingListManager.attach();
        return RG.Variables.waitingListManager.perform('sync');
      }, 1000);
    };

    return DashboardUpdater;

  })();

}).call(this);
(function() {
  RG.Utils.DataParser = {
    boot: function() {
      return $.ajax("/dashboard/bootstrap", {
        success: function(data, status, xhr) {
          var key, link, syncLink, _i, _len, _ref;
          window.currentUserDate = data.today;
          _ref = ['today'];
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            key = _ref[_i];
            delete data[key];
          }
          RG.Utils.DataParser.parse(data);
          link = $('.js-add-time-off-link');
          syncLink = $(".js-get-calendar");
          RG.bindTimeOff(link);
          $('.js-add-time-off-loading-text').remove();
          RG.stopSpinners();
          link.css('visibility', 'visible');
          return syncLink.css('visibility', 'visible');
        },
        error: function (responseData) {
          var data = { "users": "[{\"id\":86770,\"first_name\":\"Vini\",\"last_name\":\"A\",\"email\":\"myprivacy2015@gmail.com\",\"image\":\"https://resourceguru.s3.amazonaws.com/images/user/86770/image/thumb_ff1b50bc-a5bb-4512-b229-f03e7d99a898.jpg\",\"timezone\":\"Chennai\",\"last_login_at\":\"2016-08-28T09:32:09.000Z\",\"last_logout_at\":\"2016-04-08T13:46:49.000Z\",\"last_activity_at\":null,\"activation_state\":\"active\",\"created_at\":\"2016-04-08T13:07:18.000Z\",\"updated_at\":\"2016-08-28T09:43:29.000Z\",\"permissions\":\"administrator\",\"booking_rights\":\"manage_all\",\"client_rights\":\"manage_all\",\"project_rights\":\"manage_all\",\"resource_rights\":\"manage_all\",\"report_rights\":\"view\",\"owner\":\"true\"}]", "deleted_bookers": "[]", "resource_types": "[{\"id\":144374,\"name\":\"Person\",\"human\":true,\"created_at\":\"2016-08-28T09:32:08.000Z\",\"updated_at\":\"2016-08-28T09:32:08.000Z\",\"custom_fields\":[{\"id\":33273,\"name\":\"Job Title\",\"created_at\":\"2016-08-28T09:32:09.000Z\",\"updated_at\":\"2016-08-28T09:32:09.000Z\",\"custom_field_options\":[]}],\"custom_attributes\":[\"phone\"]},{\"id\":144375,\"name\":\"Conference Call Line\",\"human\":false,\"created_at\":\"2016-08-28T09:32:09.000Z\",\"updated_at\":\"2016-08-28T09:32:09.000Z\",\"custom_fields\":[],\"custom_attributes\":[]},{\"id\":144376,\"name\":\"Meeting Room\",\"human\":false,\"created_at\":\"2016-08-28T09:32:09.000Z\",\"updated_at\":\"2016-08-28T09:32:09.000Z\",\"custom_fields\":[],\"custom_attributes\":[\"capacity\"]},{\"id\":144377,\"name\":\"Vehicle\",\"human\":false,\"created_at\":\"2016-08-28T09:32:09.000Z\",\"updated_at\":\"2016-08-28T09:32:09.000Z\",\"custom_fields\":[],\"custom_attributes\":[\"registration_number\"]},{\"id\":144378,\"name\":\"Miscellaneous\",\"human\":false,\"created_at\":\"2016-08-28T09:32:09.000Z\",\"updated_at\":\"2016-08-28T09:32:09.000Z\",\"custom_fields\":[],\"custom_attributes\":[]}]", "resources": "[{\"id\":215334,\"archived\":false,\"bookable\":true,\"email\":\"myprivacy2015@gmail.com\",\"job_title\":null,\"notes\":null,\"created_at\":\"2016-08-28T09:32:09.000Z\",\"updated_at\":\"2016-08-28T09:43:33.000Z\",\"timezone\":{\"name\":\"Chennai\",\"offset\":330},\"vacation_allowance\":20.0,\"available_periods\":[{\"week_day\":1,\"start_time\":540,\"end_time\":780,\"valid_from\":\"2016-08-28\",\"valid_until\":null},{\"week_day\":1,\"start_time\":540,\"end_time\":780,\"valid_from\":\"2016-05-10\",\"valid_until\":\"2016-08-27\"},{\"week_day\":1,\"start_time\":840,\"end_time\":1080,\"valid_from\":\"2016-05-10\",\"valid_until\":\"2016-08-27\"},{\"week_day\":1,\"start_time\":840,\"end_time\":1080,\"valid_from\":\"2016-08-28\",\"valid_until\":null},{\"week_day\":2,\"start_time\":540,\"end_time\":780,\"valid_from\":\"2016-05-10\",\"valid_until\":\"2016-08-27\"},{\"week_day\":2,\"start_time\":540,\"end_time\":780,\"valid_from\":\"2016-08-28\",\"valid_until\":null},{\"week_day\":2,\"start_time\":840,\"end_time\":1080,\"valid_from\":\"2016-05-10\",\"valid_until\":\"2016-08-27\"},{\"week_day\":2,\"start_time\":840,\"end_time\":1080,\"valid_from\":\"2016-08-28\",\"valid_until\":null},{\"week_day\":3,\"start_time\":540,\"end_time\":780,\"valid_from\":\"2016-05-10\",\"valid_until\":\"2016-08-27\"},{\"week_day\":3,\"start_time\":540,\"end_time\":780,\"valid_from\":\"2016-08-28\",\"valid_until\":null},{\"week_day\":3,\"start_time\":840,\"end_time\":1080,\"valid_from\":\"2016-05-10\",\"valid_until\":\"2016-08-27\"},{\"week_day\":3,\"start_time\":840,\"end_time\":1080,\"valid_from\":\"2016-08-28\",\"valid_until\":null},{\"week_day\":4,\"start_time\":540,\"end_time\":780,\"valid_from\":\"2016-05-10\",\"valid_until\":\"2016-08-27\"},{\"week_day\":4,\"start_time\":540,\"end_time\":780,\"valid_from\":\"2016-08-28\",\"valid_until\":null},{\"week_day\":4,\"start_time\":840,\"end_time\":1080,\"valid_from\":\"2016-08-28\",\"valid_until\":null},{\"week_day\":4,\"start_time\":840,\"end_time\":1080,\"valid_from\":\"2016-05-10\",\"valid_until\":\"2016-08-27\"},{\"week_day\":5,\"start_time\":540,\"end_time\":780,\"valid_from\":\"2016-08-28\",\"valid_until\":null},{\"week_day\":5,\"start_time\":540,\"end_time\":780,\"valid_from\":\"2016-05-10\",\"valid_until\":\"2016-08-27\"},{\"week_day\":5,\"start_time\":840,\"end_time\":1080,\"valid_from\":\"2016-08-28\",\"valid_until\":null},{\"week_day\":5,\"start_time\":840,\"end_time\":1080,\"valid_from\":\"2016-05-10\",\"valid_until\":\"2016-08-27\"}],\"custom_available_periods\":[],\"name\":\"Vini A\",\"color\":null,\"image\":\"https://resourceguru.s3.amazonaws.com/images/human_resource_instance/215334/image/thumb_4098555c-76d0-4569-b79a-4e9df2657fb7.jpg\",\"account\":{\"id\":28882,\"name\":\"emrm\",\"url\":\"https://api.resourceguruapp.com/v1/accounts/28882\"},\"phone\":null,\"human\":true,\"resource_type\":{\"id\":144374,\"name\":\"Person\",\"url\":\"https://api.resourceguruapp.com/v1/testemrm/resource_types/144374\"},\"selected_custom_field_options\":[],\"booked_client_ids\":[164140],\"booked_project_ids\":[411692],\"overtimes\":[]}]", "downtime_types": "[{\"id\":87376,\"name\":\"Holiday (personal)\"},{\"id\":87377,\"name\":\"Public holiday\"},{\"id\":87378,\"name\":\"Sick leave\"},{\"id\":87379,\"name\":\"Maternity/paternity leave\"},{\"id\":87380,\"name\":\"Compassionate leave\"}]", "today": "2016-08-28", "time_zones": "[{\"name\":\"American Samoa\",\"offset\":-660},{\"name\":\"International Date Line West\",\"offset\":-660},{\"name\":\"Midway Island\",\"offset\":-660},{\"name\":\"Hawaii\",\"offset\":-600},{\"name\":\"Alaska\",\"offset\":-540},{\"name\":\"Pacific Time (US \\u0026 Canada)\",\"offset\":-480},{\"name\":\"Tijuana\",\"offset\":-480},{\"name\":\"Arizona\",\"offset\":-420},{\"name\":\"Chihuahua\",\"offset\":-420},{\"name\":\"Mazatlan\",\"offset\":-420},{\"name\":\"Mountain Time (US \\u0026 Canada)\",\"offset\":-420},{\"name\":\"Central America\",\"offset\":-360},{\"name\":\"Central Time (US \\u0026 Canada)\",\"offset\":-360},{\"name\":\"Guadalajara\",\"offset\":-360},{\"name\":\"Mexico City\",\"offset\":-360},{\"name\":\"Monterrey\",\"offset\":-360},{\"name\":\"Saskatchewan\",\"offset\":-360},{\"name\":\"Bogota\",\"offset\":-300},{\"name\":\"Eastern Time (US \\u0026 Canada)\",\"offset\":-300},{\"name\":\"Indiana (East)\",\"offset\":-300},{\"name\":\"Lima\",\"offset\":-300},{\"name\":\"Quito\",\"offset\":-300},{\"name\":\"Atlantic Time (Canada)\",\"offset\":-240},{\"name\":\"Caracas\",\"offset\":-240},{\"name\":\"Georgetown\",\"offset\":-240},{\"name\":\"La Paz\",\"offset\":-240},{\"name\":\"Santiago\",\"offset\":-240},{\"name\":\"Newfoundland\",\"offset\":-210},{\"name\":\"Brasilia\",\"offset\":-180},{\"name\":\"Buenos Aires\",\"offset\":-180},{\"name\":\"Greenland\",\"offset\":-180},{\"name\":\"Montevideo\",\"offset\":-180},{\"name\":\"Mid-Atlantic\",\"offset\":-120},{\"name\":\"Azores\",\"offset\":-60},{\"name\":\"Cape Verde Is.\",\"offset\":-60},{\"name\":\"Casablanca\",\"offset\":0},{\"name\":\"Dublin\",\"offset\":0},{\"name\":\"Edinburgh\",\"offset\":0},{\"name\":\"Lisbon\",\"offset\":0},{\"name\":\"London\",\"offset\":0},{\"name\":\"Monrovia\",\"offset\":0},{\"name\":\"UTC\",\"offset\":0},{\"name\":\"Amsterdam\",\"offset\":60},{\"name\":\"Belgrade\",\"offset\":60},{\"name\":\"Berlin\",\"offset\":60},{\"name\":\"Bern\",\"offset\":60},{\"name\":\"Bratislava\",\"offset\":60},{\"name\":\"Brussels\",\"offset\":60},{\"name\":\"Budapest\",\"offset\":60},{\"name\":\"Copenhagen\",\"offset\":60},{\"name\":\"Ljubljana\",\"offset\":60},{\"name\":\"Madrid\",\"offset\":60},{\"name\":\"Paris\",\"offset\":60},{\"name\":\"Prague\",\"offset\":60},{\"name\":\"Rome\",\"offset\":60},{\"name\":\"Sarajevo\",\"offset\":60},{\"name\":\"Skopje\",\"offset\":60},{\"name\":\"Stockholm\",\"offset\":60},{\"name\":\"Vienna\",\"offset\":60},{\"name\":\"Warsaw\",\"offset\":60},{\"name\":\"West Central Africa\",\"offset\":60},{\"name\":\"Zagreb\",\"offset\":60},{\"name\":\"Athens\",\"offset\":120},{\"name\":\"Bucharest\",\"offset\":120},{\"name\":\"Cairo\",\"offset\":120},{\"name\":\"Harare\",\"offset\":120},{\"name\":\"Helsinki\",\"offset\":120},{\"name\":\"Istanbul\",\"offset\":120},{\"name\":\"Jerusalem\",\"offset\":120},{\"name\":\"Kaliningrad\",\"offset\":120},{\"name\":\"Kyiv\",\"offset\":120},{\"name\":\"Pretoria\",\"offset\":120},{\"name\":\"Riga\",\"offset\":120},{\"name\":\"Sofia\",\"offset\":120},{\"name\":\"Tallinn\",\"offset\":120},{\"name\":\"Vilnius\",\"offset\":120},{\"name\":\"Baghdad\",\"offset\":180},{\"name\":\"Kuwait\",\"offset\":180},{\"name\":\"Minsk\",\"offset\":180},{\"name\":\"Moscow\",\"offset\":180},{\"name\":\"Nairobi\",\"offset\":180},{\"name\":\"Riyadh\",\"offset\":180},{\"name\":\"St. Petersburg\",\"offset\":180},{\"name\":\"Volgograd\",\"offset\":180},{\"name\":\"Tehran\",\"offset\":210},{\"name\":\"Abu Dhabi\",\"offset\":240},{\"name\":\"Baku\",\"offset\":240},{\"name\":\"Muscat\",\"offset\":240},{\"name\":\"Samara\",\"offset\":240},{\"name\":\"Tbilisi\",\"offset\":240},{\"name\":\"Yerevan\",\"offset\":240},{\"name\":\"Kabul\",\"offset\":270},{\"name\":\"Ekaterinburg\",\"offset\":300},{\"name\":\"Islamabad\",\"offset\":300},{\"name\":\"Karachi\",\"offset\":300},{\"name\":\"Tashkent\",\"offset\":300},{\"name\":\"Chennai\",\"offset\":330},{\"name\":\"Kolkata\",\"offset\":330},{\"name\":\"Mumbai\",\"offset\":330},{\"name\":\"New Delhi\",\"offset\":330},{\"name\":\"Sri Jayawardenepura\",\"offset\":330},{\"name\":\"Kathmandu\",\"offset\":345},{\"name\":\"Almaty\",\"offset\":360},{\"name\":\"Astana\",\"offset\":360},{\"name\":\"Dhaka\",\"offset\":360},{\"name\":\"Novosibirsk\",\"offset\":360},{\"name\":\"Urumqi\",\"offset\":360},{\"name\":\"Rangoon\",\"offset\":390},{\"name\":\"Bangkok\",\"offset\":420},{\"name\":\"Hanoi\",\"offset\":420},{\"name\":\"Jakarta\",\"offset\":420},{\"name\":\"Krasnoyarsk\",\"offset\":420},{\"name\":\"Beijing\",\"offset\":480},{\"name\":\"Chongqing\",\"offset\":480},{\"name\":\"Hong Kong\",\"offset\":480},{\"name\":\"Irkutsk\",\"offset\":480},{\"name\":\"Kuala Lumpur\",\"offset\":480},{\"name\":\"Perth\",\"offset\":480},{\"name\":\"Singapore\",\"offset\":480},{\"name\":\"Taipei\",\"offset\":480},{\"name\":\"Ulaanbaatar\",\"offset\":480},{\"name\":\"Osaka\",\"offset\":540},{\"name\":\"Sapporo\",\"offset\":540},{\"name\":\"Seoul\",\"offset\":540},{\"name\":\"Tokyo\",\"offset\":540},{\"name\":\"Yakutsk\",\"offset\":540},{\"name\":\"Adelaide\",\"offset\":570},{\"name\":\"Darwin\",\"offset\":570},{\"name\":\"Brisbane\",\"offset\":600},{\"name\":\"Canberra\",\"offset\":600},{\"name\":\"Guam\",\"offset\":600},{\"name\":\"Hobart\",\"offset\":600},{\"name\":\"Melbourne\",\"offset\":600},{\"name\":\"Port Moresby\",\"offset\":600},{\"name\":\"Sydney\",\"offset\":600},{\"name\":\"Vladivostok\",\"offset\":600},{\"name\":\"Magadan\",\"offset\":660},{\"name\":\"New Caledonia\",\"offset\":660},{\"name\":\"Solomon Is.\",\"offset\":660},{\"name\":\"Srednekolymsk\",\"offset\":660},{\"name\":\"Auckland\",\"offset\":720},{\"name\":\"Fiji\",\"offset\":720},{\"name\":\"Kamchatka\",\"offset\":720},{\"name\":\"Marshall Is.\",\"offset\":720},{\"name\":\"Wellington\",\"offset\":720},{\"name\":\"Chatham Is.\",\"offset\":765},{\"name\":\"Nuku'alofa\",\"offset\":780},{\"name\":\"Samoa\",\"offset\":780},{\"name\":\"Tokelau Is.\",\"offset\":780}]" };

          var key, link, syncLink, _i, _len, _ref;
          window.currentUserDate = data.today;
          _ref = ['today'];
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
              key = _ref[_i];
              delete data[key];
          }
          RG.Utils.DataParser.parse(data);
          link = $('.js-add-time-off-link');
          syncLink = $(".js-get-calendar");
          RG.bindTimeOff(link);
          $('.js-add-time-off-loading-text').remove();
          RG.stopSpinners();
          link.css('visibility', 'visible');
          return syncLink.css('visibility', 'visible');

          if (responseData.status === 400 && responseData.statusText === "Bad Request") {
            return alert(responseData.responseText);
          } else {
            //return $("body").html(responseData.responseText);
          }
        }
      });
    },
    parse: function(data) {
      var key, parsedData, value;
      parsedData = {};
      for (key in data) {
        value = data[key];
        parsedData[key] = $.parseJSON(value);
      }
      this.setupTimeZones(parsedData);
      this.setupBookers(parsedData);
      this.setupDeletedBookers(parsedData);
      this.setupDowntimeTypes(parsedData);
      this.setupResourceTypes(parsedData);
      return this.setupResources(parsedData);
    },
    setupTimeZones: function(data) {
      return window.timeZones = new RG.Collections.TimeZones(data.time_zones);
    },
    setupDefaultBookingHours: function() {
      var resourceType, _base, _base1, _base2, _base3, _i, _len, _name, _name1, _name2, _name3, _ref, _results;
      _ref = window.resourceTypes.models;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        resourceType = _ref[_i];
        if (resourceType.get('name') === 'Person') {
          (_base = window.localStorage)[_name = "Duration:" + (resourceType.get('name'))] || (_base[_name] = 480);
        } else {
          (_base1 = window.localStorage)[_name1 = "Duration:" + (resourceType.get('name'))] || (_base1[_name1] = 60);
        }
        (_base2 = window.localStorage)[_name2 = "TimeRange:StartTime:" + (resourceType.get('name'))] || (_base2[_name2] = 540);
        _results.push((_base3 = window.localStorage)[_name3 = "TimeRange:EndTime:" + (resourceType.get('name'))] || (_base3[_name3] = 600));
      }
      return _results;
    },
    getDateFromStr: function(dateStr) {
      var d, m, y;
      y = parseInt(dateStr.substr(0, 4), 10);
      m = parseInt(dateStr.substr(5, 2), 10);
      d = parseInt(dateStr.substr(8, 2), 10);
      return new Date(y, m - 1, d);
    },
    setupDowntimeTypes: function(data) {
      return window.downtimeTypes.reset(data.downtime_types);
    },
    setupBookers: function(data) {
      var parser;
      parser = new RG.Parsers.BookerParser(data.users, data.resources, window.bookers);
      return parser.parse();
    },
    setupDeletedBookers: function(data) {
      var parser;
      parser = new RG.Parsers.DeletedBookerParser(data.deleted_bookers, window.deletedBookers);
      return parser.parse();
    },
    setupResourceTypes: function(data) {
      var parser;
      parser = new RG.Parsers.ResourceTypeParser(data.resource_types, window.resourceTypes);
      return parser.parse();
    },
    setupResources: function(data) {
      var options, parser;
      options = {
        dateStringProcessor: RG.Utils.DataParser.getDateFromStr,
        resourceTypes: window.resourceTypes
      };
      parser = new RG.Parsers.ResourceParser(data.resources, window.resources, options);
      return parser.parse();
    }
  };

}).call(this);
(function() {
  RG.Utils.DowntimeCalendarUpdater = (function() {
    function DowntimeCalendarUpdater(currentUserTimeZone, account, resources, timeZones, affectedResources) {
      this.currentUserTimeZone = currentUserTimeZone;
      this.account = account;
      this.resources = resources;
      this.timeZones = timeZones;
      this.affectedResources = affectedResources;
    }

    DowntimeCalendarUpdater.prototype.update = function(downtime, durations, shouldDelete) {};

    DowntimeCalendarUpdater.prototype.add = function(downtime, durations, shouldDelete) {};

    DowntimeCalendarUpdater.prototype._updateCalendar = function(downtime, durations, shouldDelete) {};

    DowntimeCalendarUpdater.prototype._updateBookings = function(durations, shouldDelete) {};

    DowntimeCalendarUpdater.prototype.updateAffectedResources = function() {
      return Q.Promise(function(resolve, reject, notify) {
        RG.Popovers.popoverActive = false;
        return resolve();
      });
    };

    return DowntimeCalendarUpdater;

  })();

}).call(this);
(function() {
  RG.Utils.getLastUsedFilters = function() {
    return [];
  };

  RG.Utils.enableScrolling = function() {};

}).call(this);
(function() {
  RG.Utils.Permissions = {
    getAdapter: function() {
      return new RG.Utils.DashboardPermissionsAdapter(window.currentUserId, window.userPermissions);
    },
    canManage: function(booking) {
      var _ref;
      return window.userPermissions.bookingRights === "manage_all" || (window.userPermissions.bookingRights === "manage_own" && ((_ref = booking.getBooker()) != null ? _ref.id : void 0) === window.currentUserId);
    },
    canAdd: function(resource) {
      return window.userPermissions.bookingRights === "manage_all" || window.userPermissions.bookingRights === "manage_own";
    },
    canAddProject: function(resource) {
      return window.userPermissions.projectRights === "manage_all" || window.userPermissions.projectRights === "manage_own";
    },
    canAddClient: function(resource) {
      return window.userPermissions.clientRights === "manage_all" || window.userPermissions.clientRights === "manage_own";
    },
    canManageDowntime: function(downtime) {
      return this.getAdapter().canManageDowntime(downtime);
    },
    canAddDowntime: function() {
      return this.getAdapter().canAddDowntime();
    },
    canMoveClashBookingToWaitingList: function() {
      var _ref;
      return (_ref = this.getAdapter()).canMoveClashBookingToWaitingList.apply(_ref, arguments);
    },
    canDeleteClashBooking: function() {
      var _ref;
      return (_ref = this.getAdapter()).canDeleteClashBooking.apply(_ref, arguments);
    }
  };

}).call(this);
(function() {
  RG.Utils.WaitingListDisplayManager = (function() {
    function WaitingListDisplayManager(openElements, closedElements, linkElements) {
      this.openElements = openElements;
      this.closedElements = closedElements;
      this.linkElements = linkElements;
      this.isOpen = $(this.openElements).hasClass("hide");
    }

    WaitingListDisplayManager.prototype.attach = function() {
      this._setActive();
      if (this.active) {
        return $(this.linkElements).click((function(_this) {
          return function(e) {
            e.preventDefault();
            return _this.perform('toggle');
          };
        })(this));
      }
    };

    WaitingListDisplayManager.prototype.perform = function(action) {
      if (!this.active) {
        return;
      }
      return this[action]();
    };

    WaitingListDisplayManager.prototype.open = function() {
      this.isOpen = true;
      $(this.openElements).removeClass('hide');
      return $(this.closedElements).addClass('hide');
    };

    WaitingListDisplayManager.prototype.close = function() {
      this.isOpen = false;
      $(this.openElements).addClass('hide');
      return $(this.closedElements).removeClass('hide');
    };

    WaitingListDisplayManager.prototype.toggle = function() {
      if (this.isOpen) {
        return this.close();
      } else {
        return this.open();
      }
    };

    WaitingListDisplayManager.prototype.sync = function() {
      if (this.isOpen) {
        return this.open();
      } else {
        return this.close();
      }
    };

    WaitingListDisplayManager.prototype._setActive = function() {
      return this.active = $(this.linkElements).length;
    };

    return WaitingListDisplayManager;

  })();

}).call(this);
(function() {
  Array.prototype.max = function() {
    return Math.max.apply(null, this);
  };

  Array.prototype.min = function() {
    return Math.min.apply(null, this);
  };

}).call(this);
(function() {
  var delegateEventSplitter, viewKeys,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  delegateEventSplitter = /^(\S+)\s*(.*)$/;

  viewKeys = ['model', 'collection', 'el', 'id', 'className', 'tagName', 'events'];

  RG.Views.BaseView = (function(_super) {
    __extends(BaseView, _super);

    function BaseView(options) {
      var key, value, _i, _len;
      options = options || {};
      this.cid = _.uniqueId('view');
      for (_i = 0, _len = viewKeys.length; _i < _len; _i++) {
        key = viewKeys[_i];
        value = options[key];
        if (value) {
          this[key] = value;
        }
      }
      this._ensureElement();
      this.initialize.apply(this, arguments);
    }

    BaseView.prototype.delegateEvents = function(events) {
      var key, match, method;
      events || (events = this.events);
      if (!events) {
        return this;
      }
      this.undelegateEvents();
      for (key in events) {
        method = events[key];
        method = this[method];
        if (!method) {
          continue;
        }
        match = key.match(delegateEventSplitter);
        this.delegate(match[1], match[2], method.bind(this));
      }
      return this;
    };

    BaseView.prototype._removeElement = function() {
      if (this.el.parentNode) {
        return this.el.parentNode.removeChild(this.el);
      }
    };

    BaseView.prototype.remove = function() {
      this.off();
      return BaseView.__super__.remove.apply(this, arguments);
    };

    BaseView.prototype.shrinkDropdown = function(event) {
      var chznBottomOffset, chznResults;
      chznResults = $(event.currentTarget.parentElement).find(".chzn-drop");
      chznBottomOffset = parseInt(chznResults != null ? chznResults.css("height") : void 0) + (chznResults != null ? chznResults.offset().top : void 0) - $(window).scrollTop();
      if (this._dropdownOutOfViewport(chznBottomOffset)) {
        return this._shrinkDropdownAndScrollToSelected(event);
      }
    };

    BaseView.prototype._dropdownOutOfViewport = function(bottomOffset) {
      return (bottomOffset - $(window).height()) > 0;
    };

    BaseView.prototype._shrinkDropdownAndScrollToSelected = function(el) {
      var chznResults, height, jWindow, selectedResult;
      chznResults = $(el.currentTarget.parentElement).find(".chzn-results");
      jWindow = $(window);
      height = (jWindow.height() + jWindow.scrollTop()) - chznResults.offset().top - 8;
      chznResults.css("height", _.min([parseInt(chznResults.css("height")), height]));
      selectedResult = chznResults.find(".result-selected");
      if (selectedResult.length > 0) {
        return chznResults.scrollTo(selectedResult, {
          duration: 80
        });
      }
    };

    return BaseView;

  })(Backbone.View);

}).call(this);
(function() {
  var __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  RG.Support.CollectionView = (function(_super) {
    __extends(CollectionView, _super);

    function CollectionView() {
      CollectionView.__super__.constructor.apply(this, arguments);
      if (this.collection === null) {
        throw "No collection given to CollectionView.";
      }
      this.listenTo(this.collection, 'add', this.addItem);
      this.listenTo(this.collection, 'remove', this.removeItem);
      this.listenTo(this.collection, 'reset', this.render);
      this.collectionViews = {};
    }

    CollectionView.prototype.forEach = function(fn) {
      var view, _, _ref;
      _ref = this.collectionViews;
      for (_ in _ref) {
        view = _ref[_];
        fn(view);
      }
    };

    CollectionView.prototype.addItem = function(model) {
      var view;
      view = this.createItemView({
        model: model
      });
      this.collectionViews[model.cid] = view;
      this._insertView(view, model);
      return view;
    };

    CollectionView.prototype._insertView = function(view, model) {
      var element;
      element = view.render().el;
      if (model === this.collection.models[0]) {
        return this.el.insertBefore(element, this.el.firstChild);
      } else {
        return this.el.appendChild(element);
      }
    };

    CollectionView.prototype.removeItem = function(model) {
      return this._removeViewByModelCid(model.cid);
    };

    CollectionView.prototype._postAnimate = function(element) {};

    CollectionView.prototype._preAnimate = function(element) {};

    CollectionView.prototype._removeViewByModelCid = function(cid) {
      this._removeView(this.collectionViews[cid]);
      return delete this.collectionViews[cid];
    };

    CollectionView.prototype._removeView = function(view) {
      view.remove();
      return typeof view.close === "function" ? view.close() : void 0;
    };

    CollectionView.prototype.remove = function() {
      var cid, view, _ref;
      _ref = this.collectionViews;
      for (cid in _ref) {
        view = _ref[cid];
        view.remove();
      }
      return CollectionView.__super__.remove.apply(this, arguments);
    };

    CollectionView.prototype.close = function() {
      var child, item, _results;
      for (item in this.collectionViews) {
        this._removeViewByModelCid(item);
      }
      _results = [];
      while ((child = this.el.firstChild)) {
        _results.push(this.el.removeChild(child));
      }
      return _results;
    };

    CollectionView.prototype.createItemView = function(options) {
      return new this.itemView({
        model: options.model
      });
    };

    CollectionView.prototype.render = function() {
      this._render();
      return this;
    };

    CollectionView.prototype._render = function() {
      var model, _i, _len, _ref;
      this.close();
      _ref = this.collection.models;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        model = _ref[_i];
        this.addItem(model);
      }
      return this;
    };

    return CollectionView;

  })(RG.Views.BaseView);

  RG.Support.ArrayView = (function(_super) {
    __extends(ArrayView, _super);

    function ArrayView() {
      ArrayView.__super__.constructor.apply(this, arguments);
      this.collectionViews = {};
    }

    ArrayView.prototype.addItem = function(model) {
      var view;
      view = this.createItemView({
        model: model
      });
      this.collectionViews[model.cid] = view;
      this._insertView(view, model);
      return view;
    };

    ArrayView.prototype._insertView = function(view, model) {
      return this.el.appendChild(view.render().el);
    };

    ArrayView.prototype.removeItem = function(model) {
      return this._removeViewByModelCid(model.cid);
    };

    ArrayView.prototype._removeViewByModelCid = function(cid) {
      this._removeView(this.collectionViews[cid]);
      return delete this.collectionViews[cid];
    };

    ArrayView.prototype._removeView = function(view) {
      return view.remove();
    };

    ArrayView.prototype.remove = function() {
      var cid, view, _ref;
      _ref = this.collectionViews;
      for (cid in _ref) {
        view = _ref[cid];
        view.remove();
      }
      return ArrayView.__super__.remove.apply(this, arguments);
    };

    ArrayView.prototype.close = function() {
      var child, item, _results;
      for (item in this.collectionViews) {
        this._removeViewByModelCid(item);
      }
      _results = [];
      while ((child = this.el.firstChild)) {
        _results.push(this.el.removeChild(child));
      }
      return _results;
    };

    ArrayView.prototype.createItemView = function(options) {
      return new this.itemView({
        model: options.model
      });
    };

    ArrayView.prototype.render = function() {
      this._render();
      return this;
    };

    ArrayView.prototype._render = function() {
      var model, _i, _len, _ref;
      this.close();
      _ref = this.collection;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        model = _ref[_i];
        this.addItem(model);
      }
      return this;
    };

    return ArrayView;

  })(RG.Views.BaseView);

  RG.Support.SortedCollectionView = (function(_super) {
    __extends(SortedCollectionView, _super);

    function SortedCollectionView() {
      return SortedCollectionView.__super__.constructor.apply(this, arguments);
    }

    SortedCollectionView.prototype._insertView = function(view, model) {
      var currentModelIndex, element, prevModel, prevView;
      element = view.render().el;
      this._preAnimate(element);
      if (model === this.collection.first()) {
        this.el.insertBefore(element, this.el.firstChild);
      } else if (model === this.collection.last()) {
        this.el.appendChild(element);
      } else {
        currentModelIndex = this.collection.indexOf(model);
        prevModel = this.collection.models[currentModelIndex - 1];
        prevView = this.collectionViews[prevModel.cid];
        if (prevView) {
          this.el.insertBefore(element, prevView.el.nextElementSibling);
        } else {
          this.el.appendChild(element);
        }
      }
      this._postAnimate(element);
      return element;
    };

    return SortedCollectionView;

  })(RG.Support.CollectionView);

  RG.Support.CachedCollectionView = (function(_super) {
    __extends(CachedCollectionView, _super);

    function CachedCollectionView() {
      return CachedCollectionView.__super__.constructor.apply(this, arguments);
    }

    CachedCollectionView.prototype.addItem = function(model) {
      var view;
      if (view = this.collectionViews[model.cid]) {
        this.el.appendChild(view.el);
        return view.el.style.display = "";
      } else {
        return CachedCollectionView.__super__.addItem.apply(this, arguments);
      }
    };

    CachedCollectionView.prototype.clearInvisibleViews = function() {
      var cid, view, _ref;
      _ref = this.collectionViews;
      for (cid in _ref) {
        view = _ref[cid];
        if (!(view.el.style.display === "none")) {
          continue;
        }
        view.remove();
        delete this.collectionViews[cid];
      }
    };

    CachedCollectionView.prototype.close = function() {
      var item, _results;
      _results = [];
      for (item in this.collectionViews) {
        _results.push(this._removeViewByModelCid(item));
      }
      return _results;
    };

    CachedCollectionView.prototype._removeViewByModelCid = function(cid) {
      return this._removeView(this.collectionViews[cid]);
    };

    CachedCollectionView.prototype._removeView = function(view) {
      return view.el.style.display = "none";
    };

    return CachedCollectionView;

  })(RG.Support.SortedCollectionView);

}).call(this);
(function() {
  RG.Support.ValidTags = (function() {
    function ValidTags() {}

    ValidTags.prototype.valid_html_tags = function() {
      return ["!--", "!DOCTYPE", "a", "abbr", "acronym", "address", "applet", "area", "article", "aside", "audio", "b", "base", "basefont", "bdi", "bdo", "big", "blockquote", "body", "br", "button", "canvas", "caption", "center", "cite", "code", "col", "colgroup", "datalist", "dd", "del", "details", "dfn", "dialog", "dir", "div", "dl", "dt", "em", "embed", "fieldset", "figcaption", "figure", "font", "footer", "form", "frame", "frameset", "head", "header", "hr", "html", "i", "iframe", "img", "input", "ins", "kbd", "keygen", "label", "legend", "li", "link", "main", "map", "mark", "menu", "menuitem", "meta", "meter", "nav", "noframes", "noscript", "object", "ol", "optgroup", "option", "output", "p", "param", "pre", "progress", "q", "rp", "rt", "ruby", "s", "samp", "script", "section", "select", "small", "source", "span", "strike", "strong", "style", "sub", "summary", "sup", "table", "tbody", "td", "textarea", "tfoot", "th", "thead", "time", "title", "tr", "track", "tt", "u", "ul", "var", "video", "wbr"];
    };

    return ValidTags;

  })();

}).call(this);
(function() {
  RG.Utils.Range = (function() {
    function Range() {}

    Range.prototype.getStart = function() {
      throw 'Implement `getStart` in subclasses of Range';
    };

    Range.prototype.getEnd = function() {
      throw 'Implement `getEnd` in subclasses of Range';
    };

    Range.prototype.contains = function(other) {
      return this.getStart() <= other.getStart() && this.getEnd() >= other.getEnd();
    };

    Range.prototype.overlapsWith = function(other) {
      return this.getEnd() > other.getStart() && this.getStart() < other.getEnd();
    };

    Range.prototype.isTouching = function(other) {
      return this.getEnd() >= other.getStart() && this.getStart() <= other.getEnd();
    };

    Range.prototype.includes = function(value) {
      return value && this.getStart().valueOf() <= value.valueOf() && this.getEnd().valueOf() >= value.valueOf();
    };

    return Range;

  })();

}).call(this);
(function() {
  RG.Utils.getCurrentAccount = function() {
    return this._currentAccount != null ? this._currentAccount : this._currentAccount = new RG.Models.Account({
      subdomain: window.location.host.substr(0, window.location.host.indexOf(".")),
      downtimes: window.downtimes
    });
  };

}).call(this);
(function() {
  RG.Utils.AvailabilityManager = (function() {
    function AvailabilityManager(options) {
      _.extend(this, Backbone.Events);
      this._maxMinutesInUnit = {};
      this.availablePeriods = options.availablePeriods || new RG.Collections.AvailablePeriods;
      this.customAvailablePeriods = options.customAvailablePeriods || new RG.Collections.CustomAvailablePeriods;
      this.overtimes = options.overtimes || new RG.Collections.Overtimes;
      this.downtimes = options.downtimes || new RG.Collections.Downtimes;
      this.resource = options.resource;
      this.timeZone = options.timeZone || RG.Models.TimeZone.Current;
      this._minutesInDateRange = {};
      if (!options.ignoreEvents) {
        this.availablePeriods.on("add remove reset", (function(_this) {
          return function() {
            _this._clearMaxMinutesInUnit();
            return _this.trigger('refreshUtilisation');
          };
        })(this));
        this.customAvailablePeriods.on("add remove reset", (function(_this) {
          return function() {
            _this._clearMaxMinutesInUnit();
            return _this.trigger('refreshUtilisation');
          };
        })(this));
        this.downtimes.on("add remove change reset", (function(_this) {
          return function() {
            return _this._clearMaxMinutesInUnit();
          };
        })(this));
        this.overtimes.on("add remove change reset", (function(_this) {
          return function() {
            _this._clearMaxMinutesInUnit();
            return _this.trigger('refreshUtilisation');
          };
        })(this));
        this.downtimes.on("add", (function(_this) {
          return function(d) {
            var dd;
            dd = d.inTimeZone(_this.resource.get('timeZone'));
            return _this.trigger('refresh', new RG.Utils.DateRange(dd.get('from'), dd.get('to')));
          };
        })(this));
        this.downtimes.on("remove", (function(_this) {
          return function(d) {
            var dd;
            dd = d.inTimeZone(_this.resource.get('timeZone'));
            return _this.trigger('refresh', new RG.Utils.DateRange(dd.get('from'), dd.get('to')));
          };
        })(this));
        this.downtimes.on("change", (function(_this) {
          return function(d) {
            var dd, old;
            dd = d.inTimeZone(_this.resource.get('timeZone'));
            _this.trigger('refresh', new RG.Utils.DateRange(dd.get('from'), dd.get('to')));
            old = new RG.Models.Downtime(d.previousAttributes());
            dd = old.inTimeZone(_this.resource.get('timeZone'));
            return _this.trigger('refresh', new RG.Utils.DateRange(dd.get('from'), dd.get('to')));
          };
        })(this));
        this.on('add remove reset', this._clearMaxMinutesInUnit);
        this.on('maxAvailabilityChanged', this._flushCache);
      }
    }

    AvailabilityManager.prototype.getOvertimeMinutesInDateRange = function(dateRange) {
      return this.overtimes.getMinutesAvailableInDateRange(dateRange);
    };

    AvailabilityManager.prototype.getMinutesAvailableForDate = function(date, timeRange) {
      var dateRange;
      if (timeRange == null) {
        timeRange = null;
      }
      dateRange = new RG.Utils.DateRange(date, date);
      return this.getMinutesAvailableInDateRange(dateRange, timeRange);
    };

    AvailabilityManager.prototype.getMinutesAvailableInDateRange = function(dateRange, timeRange) {
      var minutes, resource;
      if (timeRange == null) {
        timeRange = null;
      }
      if (this._minutesInDateRange[dateRange]) {
        return this._minutesInDateRange[dateRange];
      }
      minutes = 0;
      resource = this.resource;
      this.getDowntimeAndAvailablePeriodAggregateForDateRange(dateRange, timeRange).forEach(function(aggregate) {
        var downtime, downtimeTimeRanges, hasRemainingPeriod, period, periodsTimeRanges, _i, _j, _len, _len1, _results;
        downtimeTimeRanges = aggregate.downtimes.map(function(downtime) {
          return downtime.getTimeRange(aggregate.date);
        });
        periodsTimeRanges = aggregate.periods;
        if (downtimeTimeRanges.length > 1) {
          timeRange = downtimeTimeRanges.shift();
          downtimeTimeRanges = timeRange.merge.apply(timeRange, downtimeTimeRanges);
        }
        if (periodsTimeRanges.length > 1) {
          timeRange = periodsTimeRanges.shift();
          periodsTimeRanges = timeRange.merge.apply(timeRange, periodsTimeRanges);
        }
        _results = [];
        for (_i = 0, _len = periodsTimeRanges.length; _i < _len; _i++) {
          period = periodsTimeRanges[_i];
          if (downtimeTimeRanges.length) {
            hasRemainingPeriod = false;
            for (_j = 0, _len1 = downtimeTimeRanges.length; _j < _len1; _j++) {
              downtime = downtimeTimeRanges[_j];
              if (period.overlapsWith(downtime)) {
                minutes += period.subtract(downtime);
                hasRemainingPeriod = true;
              }
            }
            if (!hasRemainingPeriod) {
              _results.push(minutes += period.totalTime() | 0);
            } else {
              _results.push(void 0);
            }
          } else {
            _results.push(minutes += period.totalTime() | 0);
          }
        }
        return _results;
      });
      return this._minutesInDateRange[dateRange] = minutes;
    };

    AvailabilityManager.prototype.getAvailableTimeRangesInDateRange = function(dateRange, timeRange) {
      var aggregate, downtime, downtimeTimeRanges, hasRemainingPeriod, period, periodsTimeRanges, r, ranges, resource, _i, _j, _k, _l, _len, _len1, _len2, _len3, _ref, _ref1;
      if (timeRange == null) {
        timeRange = null;
      }
      ranges = [];
      resource = this.resource;
      _ref = this.getDowntimeAndAvailablePeriodAggregateForDateRange(dateRange, timeRange);
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        aggregate = _ref[_i];
        downtimeTimeRanges = aggregate.downtimes.map(function(downtime) {
          return downtime.getTimeRange(aggregate.date);
        });
        periodsTimeRanges = aggregate.periods;
        if (downtimeTimeRanges.length > 1) {
          timeRange = downtimeTimeRanges.shift();
          downtimeTimeRanges = timeRange.merge.apply(timeRange, downtimeTimeRanges);
        }
        if (periodsTimeRanges.length > 1) {
          timeRange = periodsTimeRanges.shift();
          periodsTimeRanges = timeRange.merge.apply(timeRange, periodsTimeRanges);
        }
        for (_j = 0, _len1 = periodsTimeRanges.length; _j < _len1; _j++) {
          period = periodsTimeRanges[_j];
          if (downtimeTimeRanges.length) {
            hasRemainingPeriod = false;
            for (_k = 0, _len2 = downtimeTimeRanges.length; _k < _len2; _k++) {
              downtime = downtimeTimeRanges[_k];
              if (period.overlapsWith(downtime)) {
                _ref1 = period.subtractOne(downtime);
                for (_l = 0, _len3 = _ref1.length; _l < _len3; _l++) {
                  r = _ref1[_l];
                  ranges.push(r);
                }
                hasRemainingPeriod = true;
              }
            }
            if (!hasRemainingPeriod) {
              ranges.push(period);
            }
          } else {
            ranges.push(period);
          }
        }
      }
      return ranges;
    };

    AvailabilityManager.prototype.hasNoNormalAvailability = function() {
      return this.availablePeriods.length === 0;
    };

    AvailabilityManager.prototype.getMaxMinutesInUnit = function(dateRange, memoize) {
      var customMinutesAvailable, date, minutes, period, periodMinutesAvailable, somePeriods, _i, _j, _len, _len1, _ref, _ref1;
      if (memoize == null) {
        memoize = true;
      }
      if (memoize && this._maxMinutesInUnit[dateRange.toString()]) {
        return this._maxMinutesInUnit[dateRange.toString()];
      }
      minutes = 0;
      _ref = dateRange.getDates();
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        date = _ref[_i];
        customMinutesAvailable = this.customAvailablePeriods.calculator().sum(date);
        periodMinutesAvailable = this.availablePeriods.calculator().sum(date);
        if (customMinutesAvailable > periodMinutesAvailable) {
          periodMinutesAvailable = customMinutesAvailable;
        }
        if (periodMinutesAvailable > minutes) {
          minutes = periodMinutesAvailable;
        }
      }
      somePeriods = this.availablePeriods.some(function(period) {
        return period.isValidInDateRange(dateRange);
      });
      if (!somePeriods) {
        _ref1 = this._getBackfilledAvailablePeriods(dateRange.startDate);
        for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
          period = _ref1[_j];
          periodMinutesAvailable = period.getMinutesAvailable();
          if (periodMinutesAvailable > minutes) {
            minutes = periodMinutesAvailable;
          }
        }
      }
      return this._maxMinutesInUnit[dateRange.toString()] = minutes;
    };

    AvailabilityManager.prototype.inEarliestNormalAvailability = function(dateRange, timeRange) {
      var day, earliest, earliestOnDay, periods;
      if (timeRange == null) {
        timeRange = null;
      }
      day = dateRange.startDate.getDay();
      if (timeRange) {
        periods = this.availablePeriods.select(function(period) {
          return period.getTimeRange().overlapsWith(timeRange);
        });
      } else {
        periods = this.availablePeriods.models;
      }
      earliest = _.min(periods, function(ap) {
        return ap.get('validFrom');
      });
      earliestOnDay = _.find(periods, function(ap) {
        return ap.get('weekDay') === day && RG.Utils.DateComparator.equalsYMD(ap.get('validFrom'), earliest.get('validFrom'));
      });
      return earliestOnDay && dateRange.startDate < earliest.get('validFrom') && !RG.Utils.DateComparator.equalsYMD(dateRange.startDate, earliest.get('validFrom'));
    };

    AvailabilityManager.prototype._clearMaxMinutesInUnit = function() {
      this._maxMinutesInUnit = {};
      this._minutesInDateRange = {};
    };

    AvailabilityManager.prototype._flushCache = function() {
      this._clearMaxMinutesInUnit();
      this.customAvailablePeriods._minutes = {};
    };

    AvailabilityManager.prototype.getOriginalPeriodsForDate = function(date) {
      var periods;
      periods = this.availablePeriods.models.filter(function(p) {
        return p.isValidOn(date);
      });
      if (periods.length) {
        return periods;
      } else if (!this._somePeriodsForDate(date)) {
        return this._getBackfilledAvailablePeriods(date);
      } else {
        return [];
      }
    };

    AvailabilityManager.prototype.getCustomPeriodsForDate = function(date) {
      return this.customAvailablePeriods.select(function(p) {
        return p.isValidOn(date);
      });
    };

    AvailabilityManager.prototype.getDowntimesForDateAndTimeRange = function(date, timeRange) {
      return this.downtimes.inTimeZone(this.getTimeZone()).forDate(date).filter(function(downtime) {
        var tRange;
        tRange = downtime.getTimeRange(date);
        return timeRange.overlapsWith(tRange);
      });
    };

    AvailabilityManager.prototype.getPeriodTimeRangesForDateAndTimeRange = function(date, timeRange) {
      var period, results, _i, _len, _ref;
      results = [];
      _ref = this.getPeriodsForDate(date);
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        period = _ref[_i];
        if (timeRange.overlapsWith(period.getTimeRange())) {
          results.push(period.getTimeRange());
        }
      }
      return results;
    };

    AvailabilityManager.prototype.getDowntimeAndAvailablePeriodAggregateForDateRange = function(dateRange, timeRange, year) {
      var aggregate, date, i, sd, _i, _ref;
      if (timeRange == null) {
        timeRange = new RG.Utils.TimeRange(0, 1440);
      }
      if (year == null) {
        year = null;
      }
      sd = dateRange.startDate;
      aggregate = [];
      for (i = _i = 0, _ref = dateRange.getNumberOfDays() - 1; 0 <= _ref ? _i <= _ref : _i >= _ref; i = 0 <= _ref ? ++_i : --_i) {
        date = new Date(sd.getFullYear(), sd.getMonth(), sd.getDate() + i);
        if (year) {
          if (date.getFullYear() === year) {
            aggregate.push({
              downtimes: this.getDowntimesForDateAndTimeRange(date, timeRange),
              periods: this.getPeriodTimeRangesForDateAndTimeRange(date, timeRange),
              date: date
            });
          }
        } else {
          aggregate.push({
            downtimes: this.getDowntimesForDateAndTimeRange(date, timeRange),
            periods: this.getPeriodTimeRangesForDateAndTimeRange(date, timeRange),
            date: date
          });
        }
      }
      return aggregate;
    };

    AvailabilityManager.prototype.getPeriodsForDate = function(date) {
      var customPeriods;
      customPeriods = this.getCustomPeriodsForDate(date);
      if (customPeriods.length) {
        return customPeriods;
      } else {
        return this.getOriginalPeriodsForDate(date);
      }
    };

    AvailabilityManager.prototype.getTimeZone = function() {
      return this.timeZone;
    };

    AvailabilityManager.prototype.getOvertimesForDate = function(date) {
      var o, overtimes, _i, _len, _ref;
      overtimes = [];
      _ref = this.overtimes.models;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        o = _ref[_i];
        if (o.isValidOn(date)) {
          overtimes.push(o);
        }
      }
      return overtimes;
    };

    AvailabilityManager.prototype.isAvailableStartAndEndDate = function(dateRange) {
      var endDateRange, startDateRange;
      startDateRange = new RG.Utils.DateRange(dateRange.startDate, dateRange.startDate);
      endDateRange = new RG.Utils.DateRange(dateRange.endDate, dateRange.endDate);
      return this.isAvailableIn(startDateRange) && this.isAvailableIn(endDateRange);
    };

    AvailabilityManager.prototype.isAvailableIn = function(dateRange, timeRange) {
      if (timeRange == null) {
        timeRange = null;
      }
      return this.getMinutesAvailableInDateRange(dateRange, timeRange) > 0 || this.inEarliestNormalAvailability(dateRange, timeRange);
    };

    AvailabilityManager.prototype.intersectsWithDowntime = function(date, timeRange) {
      return this.downtimes.any((function(_this) {
        return function(downtime) {
          return downtime.inTimeZone(_this.resource.get('timeZone')).getTimeRange(date).overlapsWith(timeRange);
        };
      })(this));
    };

    AvailabilityManager.prototype._getBackfilledAvailablePeriods = function(date) {
      var periods;
      periods = _.chain(this.availablePeriods.models).filter(function(ap) {
        return ap.isNewerThan(date);
      }).sort(function(ap) {
        var _ref;
        return ((_ref = ap.get('validFrom')) != null ? _ref.valueOf() : void 0) || 0;
      }).value();
      if (periods.some(function(ap) {
        return ap.get('validUntil');
      })) {
        return this._getClosestOldestHistoricalPeriods(date);
      } else {
        return periods.filter(function(p) {
          return p.get('weekDay') === date.getDay();
        });
      }
      return periods;
    };

    AvailabilityManager.prototype._getClosestOldestHistoricalPeriods = function(date) {
      var periods, validFrom;
      periods = this.availablePeriods.models.filter(function(ap) {
        return ap.get('validUntil') && ap.get('weekDay') === date.getDay() && ap.isNewerThan(date);
      });
      periods = periods.sort(function(a, b) {
        if (a.get('validFrom').valueOf() < b.get('validFrom').valueOf()) {
          return -1;
        } else if (a.get('validFrom').valueOf() === b.get('validFrom').valueOf()) {
          return 0;
        }
        return 1;
      });
      validFrom = null;
      return periods.filter(function(ap) {
        if (validFrom == null) {
          validFrom = periods[0].get('validFrom');
        }
        return RG.Utils.DateComparator.equalsYMD(ap.get('validFrom'), validFrom);
      });
    };

    AvailabilityManager.prototype._somePeriodsForDate = function(date) {
      return this.availablePeriods.some(function(ap) {
        return ap.isCoveringDate(date);
      });
    };

    return AvailabilityManager;

  })();

}).call(this);
(function() {
  RG.Utils.CalendarPermissionsAdapter = (function() {
    function CalendarPermissionsAdapter(currentUserId, userPermissions) {
      this.currentUserId = currentUserId;
      this.userPermissions = userPermissions != null ? userPermissions : {};
    }

    CalendarPermissionsAdapter.prototype.canManage = function(booking) {
      var _ref;
      return window.userPermissions.bookingRights === "manage_all" || (window.userPermissions.bookingRights === "manage_own" && ((_ref = booking.getBooker()) != null ? _ref.id : void 0) === window.currentUserId);
    };

    CalendarPermissionsAdapter.prototype.canAddDowntime = function() {
      return this.userPermissions.downtimeRights === "manage_all" || this.userPermissions.downtimeRights === "manage_own";
    };

    CalendarPermissionsAdapter.prototype.canDeleteClashBooking = function(bookings) {
      return this.canMoveClashBookingToWaitingList(bookings);
    };

    CalendarPermissionsAdapter.prototype.canManageDowntime = function(downtime) {
      var _ref;
      return this.userPermissions.downtimeRights === "manage_all" || (this.userPermissions.downtimeRights === "manage_own" && ((_ref = downtime.getBooker()) != null ? _ref.id : void 0) === this.currentUserId);
    };

    CalendarPermissionsAdapter.prototype.canMoveClashBookingToWaitingList = function(bookings) {
      var mayChangeBookings;
      mayChangeBookings = _.map(bookings, (function(_this) {
        return function(booking) {
          return _this.canManage(booking);
        };
      })(this));
      return !_.contains(mayChangeBookings, false) && this.canAddDowntime();
    };

    return CalendarPermissionsAdapter;

  })();

}).call(this);
(function() {
  var __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  RG.Utils.DashboardPermissionsAdapter = (function(_super) {
    __extends(DashboardPermissionsAdapter, _super);

    function DashboardPermissionsAdapter() {
      return DashboardPermissionsAdapter.__super__.constructor.apply(this, arguments);
    }

    DashboardPermissionsAdapter.prototype.canAddDowntime = function() {
      return ['manage_all', 'manage_own', 'view'].indexOf(this.userPermissions.downtimeRights) !== -1;
    };

    DashboardPermissionsAdapter.prototype.canManageDowntime = function(downtime) {
      var _ref;
      return this.userPermissions.downtimeRights === 'manage_all' || this.canAddDowntime() && ((_ref = downtime.getBooker()) != null ? _ref.id : void 0) === this.currentUserId;
    };

    DashboardPermissionsAdapter.prototype.canMoveClashBookingToWaitingList = function(bookings) {
      var mayChangeBookings;
      mayChangeBookings = _.map(bookings, (function(_this) {
        return function(booking) {
          return _this.canManage(booking);
        };
      })(this));
      return !_.contains(mayChangeBookings, false) && this.canAddDowntime();
    };

    DashboardPermissionsAdapter.prototype.canDeleteClashBooking = function(bookings) {
      return this.canMoveClashBookingToWaitingList(bookings);
    };

    return DashboardPermissionsAdapter;

  })(RG.Utils.CalendarPermissionsAdapter);

}).call(this);
(function() {
  RG.Utils.DateComparator = {
    getDateParts: function(date) {
      return date && [date.getFullYear(), date.getMonth(), date.getDate()];
    },
    equalsYMD: function(date1, date2) {
      return date1.getFullYear() === date2.getFullYear() && date1.getMonth() === date2.getMonth() && date1.getDate() === date2.getDate();
    }
  };

  Date.prototype.cloneYMD = function() {
    return new Date(this.getFullYear(), this.getMonth(), this.getDate());
  };

}).call(this);
(function() {
  RG.Utils.DateFormatter = {
    months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    longMonths: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    getShortDate: function(date) {
      return "" + (date.getDate()) + " " + RG.Utils.DateFormatter.months[date.getMonth()];
    },
    getShortDateWithYear: function(date) {
      return "" + (date.getDate()) + " " + RG.Utils.DateFormatter.months[date.getMonth()] + " " + (date.getFullYear());
    },
    getLongDateWithYear: function(date) {
      return "" + (date.getDate()) + " " + RG.Utils.DateFormatter.longMonths[date.getMonth()] + " " + (date.getFullYear());
    },
    getISODate: function(date) {
      var d, m, y, zeroPad;
      zeroPad = function(number) {
        var s;
        s = number.toString();
        if (s.length === 1) {
          s = "0" + s;
        }
        return s;
      };
      y = date.getFullYear();
      m = zeroPad(date.getMonth() + 1);
      d = zeroPad(date.getDate());
      return "" + y + "-" + m + "-" + d;
    }
  };

  Date.prototype.getISODate = function() {
    return RG.Utils.DateFormatter.getISODate(this);
  };

  Date.prototype.getWeek = function() {
    var dayNr, firstThursday, target;
    target = new Date(this.valueOf());
    dayNr = (this.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
    }
    return 1 + Math.ceil((firstThursday - target) / 604800000);
  };

}).call(this);
(function() {
  var __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  RG.Utils.DateRange = (function(_super) {
    var months;

    __extends(DateRange, _super);

    months = RG.Utils.DateFormatter.months;

    function DateRange(startDate, endDate) {
      this.startDate = startDate;
      this.endDate = endDate;
    }

    DateRange.prototype.getStart = function() {
      return this.startDate;
    };

    DateRange.prototype.getEnd = function() {
      return this.endDate;
    };

    DateRange.prototype.getNumberOfDays = function() {
      return Math.round(((this.endDate.valueOf() - this.startDate.valueOf()) / 86400 / 1000) + 1);
    };

    DateRange.prototype.getDates = function() {
      var date, dates;
      date = new Date(this.startDate);
      dates = [];
      while (date.getTime() <= this.endDate.getTime()) {
        dates.push(new Date(date));
        date.setDate(date.getDate() + 1);
      }
      return dates;
    };

    DateRange.prototype.overlapsWith = function(other) {
      return this.getEnd() >= other.getStart() && this.getStart() <= other.getEnd();
    };

    DateRange.prototype.toString = function() {
      var firstMonthStr, firstYearStr, inSameMonth, inSameYear, secondMonthStr;
      if (RG.Utils.DateComparator.equalsYMD(this.startDate, this.endDate)) {
        return "" + (this.startDate.getDate()) + " " + months[this.startDate.getMonth()] + " " + (this.endDate.getFullYear());
      } else {
        inSameMonth = this.startDate.getMonth() === this.endDate.getMonth();
        inSameYear = this.startDate.getFullYear() === this.endDate.getFullYear();
        firstMonthStr = !inSameMonth || !inSameYear ? "" + months[this.startDate.getMonth()] + " " : "";
        firstYearStr = !inSameYear ? "" + (this.startDate.getFullYear()) + " " : "";
        secondMonthStr = months[this.endDate.getMonth()];
        return "" + (this.startDate.getDate()) + " " + firstMonthStr + firstYearStr + "- " + (this.endDate.getDate()) + " " + secondMonthStr + " " + (this.endDate.getFullYear());
      }
    };

    DateRange.prototype.getYears = function() {
      var endYear, startYear, _i, _results;
      startYear = this.startDate.getFullYear();
      endYear = this.endDate.getFullYear();
      return (function() {
        _results = [];
        for (var _i = startYear; startYear <= endYear ? _i <= endYear : _i >= endYear; startYear <= endYear ? _i++ : _i--){ _results.push(_i); }
        return _results;
      }).apply(this);
    };

    DateRange.prototype.coversYear = function(year) {
      return _.include(this.getYears(), year);
    };

    DateRange.prototype.isValid = function() {
      return !!(this.startDate && this.endDate);
    };

    return DateRange;

  })(RG.Utils.Range);

}).call(this);
(function() {
  RG.Utils.DowntimeService = {
    createDowntime: function(downtime, params, callbacks) {
      return Q.Promise(function(resolve, reject, notify) {
        RG.Utils.BookingDataParser.expirePolls();
        return $.ajax("" + (RG.getApiRoot()) + "/downtimes", {
          method: "POST",
          headers: {
            "X-CSRF-Token": RG.Utils.getCSRFToken()
          },
          data: params,
          dataType: 'json',
          success: (function(_this) {
            return function(data) {
              RG.Utils.BookingDataParser.expirePolls();
              downtime.set({
                id: data.id
              });
              callbacks.successCallback(downtime);
              return resolve("Downtime " + downtime.id + " created.");
            };
          })(this),
          error: (function(_this) {
            return function(xhr) {
              var responseData;
              responseData = JSON.parse(xhr.responseText);
              RG.Utils.BookingDataParser.expirePolls();
              callbacks.errorCallback(responseData);
              return reject("Downtime not created.");
            };
          })(this)
        });
      });
    },
    updateDowntime: function(id, params, callbacks) {
      return Q.Promise(function(resolve, reject, notify) {
        RG.Utils.BookingDataParser.expirePolls();
        return $.ajax("" + (RG.getApiRoot()) + "/downtimes/" + id, {
          method: "PATCH",
          headers: {
            "X-CSRF-Token": RG.Utils.getCSRFToken()
          },
          data: params,
          dataType: 'json',
          success: (function(_this) {
            return function(data) {
              RG.Utils.BookingDataParser.expirePolls();
              callbacks.successCallback(data);
              return resolve("Downtime " + id + " updated.");
            };
          })(this),
          error: (function(_this) {
            return function(xhr) {
              var responseData;
              responseData = JSON.parse(xhr.responseText);
              RG.Utils.BookingDataParser.expirePolls();
              callbacks.errorCallback(responseData);
              return reject("Downtime " + id + " not updated.");
            };
          })(this)
        });
      });
    },
    deleteSingleDate: function(downtime, date, callback) {
      var createRightDowntime, leftDowntime, leftDowntimeFromDate, leftDowntimeParams, leftDowntimeToDate, notStartOrEnd, options, rightDowntime, rightDowntimeFromDate, rightParams;
      if (RG.Utils.DateComparator.equalsYMD(date, downtime.get('from'))) {
        leftDowntimeFromDate = moment(date).add(1, 'days')._d;
        leftDowntimeToDate = downtime.get('to');
      } else if (RG.Utils.DateComparator.equalsYMD(date, downtime.get('to'))) {
        leftDowntimeFromDate = downtime.get('from');
        leftDowntimeToDate = moment(date).subtract(1, 'days')._d;
      } else {
        leftDowntimeFromDate = downtime.get('from');
        leftDowntimeToDate = moment(date).subtract(1, 'days')._d;
      }
      leftDowntimeParams = this._buildDowntimeParams(downtime, leftDowntimeFromDate, leftDowntimeToDate);
      leftDowntime = new RG.Models.Downtime(downtime.attributes);
      leftDowntime.set({
        from: leftDowntimeFromDate,
        to: leftDowntimeToDate,
        timeZone: downtime.get('timeZone')
      });
      notStartOrEnd = !RG.Utils.DateComparator.equalsYMD(date, downtime.get('from')) && !RG.Utils.DateComparator.equalsYMD(date, downtime.get('to'));
      if (notStartOrEnd) {
        rightDowntimeFromDate = moment(date).add(1, 'days')._d;
        rightDowntime = new RG.Models.Downtime(_.extend(_.clone(downtime.attributes), {
          downtimeType: downtime.downtimeType,
          id: null,
          timeZone: downtime.getTimeZone(),
          from: rightDowntimeFromDate,
          to: downtime.get('to')
        }));
        rightParams = _.extend(_.clone(leftDowntimeParams), {
          id: null,
          from: RG.Utils.DateFormatter.getISODate(rightDowntimeFromDate),
          to: downtime.get('to')
        });
      }
      options = this._buildOptions(downtime, leftDowntime, rightDowntime);
      createRightDowntime = (function(_this) {
        return function() {
          if (notStartOrEnd) {
            return RG.Utils.DowntimeService.createDowntime(rightDowntime, rightParams, options);
          } else {
            return Q.delay(0);
          }
        };
      })(this);
      return RG.Utils.DowntimeService.updateDowntime(downtime.id, leftDowntimeParams, options).then(callback).then(createRightDowntime).then(window.update);
    },
    deleteDowntime: function(id, callback) {
      return Q.Promise(function(resolve, reject, notify) {
        return $.ajax("" + (RG.getApiRoot()) + "/downtimes/" + id, {
          method: 'DELETE',
          timeout: 30000,
          headers: {
            "X-CSRF-Token": RG.Utils.getCSRFToken()
          },
          success: (function(_this) {
            return function() {
              if (typeof callback === "function") {
                callback();
              }
              window.update();
              return resolve("Downtime " + id + " deleted.");
            };
          })(this)
        });
      });
    },
    split: function(downtime, date, callback) {
      var leftDowntime, leftDowntimeParams, options, rightDowntime, rightParams, timezone, toDate;
      timezone = null;
      toDate = moment(date).subtract(1, 'days')._d;
      leftDowntimeParams = this._buildDowntimeParams(downtime, downtime.get('from'), toDate);
      leftDowntimeParams.end_time = 1440;
      leftDowntime = new RG.Models.Downtime(leftDowntimeParams);
      leftDowntime.set({
        from: downtime.get('from'),
        to: toDate,
        endTime: 1440
      });
      rightDowntime = new RG.Models.Downtime(_.extend(_.clone(downtime.attributes), {
        downtimeType: downtime.downtimeType,
        id: null,
        timeZone: downtime.get('timeZone'),
        from: date,
        to: downtime.get('to'),
        startTime: 0
      }));
      rightParams = _.extend(_.clone(leftDowntimeParams), {
        id: null,
        from: RG.Utils.DateFormatter.getISODate(date),
        to: RG.Utils.DateFormatter.getISODate(downtime.get('to')),
        start_time: 0
      });
      options = this._buildOptions(downtime, leftDowntime, rightDowntime);
      return RG.Utils.DowntimeService.updateDowntime(downtime.id, leftDowntimeParams, options).then(function() {
        return RG.Utils.DowntimeService.createDowntime(rightDowntime, rightParams, options);
      }).then(callback);
    },
    updateResources: (function(_this) {
      return function(downtime, leftDowntime, rightDowntime) {
        var affectedResources, resource, updatedDowntime, _i, _len, _results;
        window.downtimes.add(rightDowntime);
        updatedDowntime = window.downtimes.findWhere({
          id: downtime.id
        });
        updatedDowntime.set(leftDowntime.attributes);
        affectedResources = window.resources.select(function(resource) {
          return _.include(downtime.get('resourceIds'), resource.id);
        });
        _results = [];
        for (_i = 0, _len = affectedResources.length; _i < _len; _i++) {
          resource = affectedResources[_i];
          _results.push(resource.refreshDowntimes());
        }
        return _results;
      };
    })(this),
    _buildDowntimeParams: function(downtime, from, to) {
      var downtimeTimeZone, params;
      params = {
        resource_ids: downtime.get('resourceIds'),
        creator_id: window.currentUserId,
        from: RG.Utils.DateFormatter.getISODate(from),
        to: RG.Utils.DateFormatter.getISODate(to),
        start_time: downtime.get('startTime'),
        end_time: downtime.get('endTime'),
        details: downtime.get('details'),
        leave: downtime.get('leave'),
        downtime_type_id: downtime.get('downtimeTypeId')
      };
      downtimeTimeZone = downtime.getTimeZoneName();
      if (!downtime.isLocalTimeZone() && window.currentUserTimeZone !== downtimeTimeZone) {
        params.timezone = downtimeTimeZone;
      }
      return params;
    },
    _buildOptions: function(downtime, leftDowntime, rightDowntime) {
      return {
        successCallback: function() {
          return RG.Utils.DowntimeService.updateResources(downtime, leftDowntime, rightDowntime);
        },
        errorCallback: function() {}
      };
    }
  };

}).call(this);
(function() {
  RG.Utils.isDifferentTimeZones = function(downtimeResources, currentUserTimeZone) {
    var flag;
    if (downtimeResources.length === 1) {
      return false;
    }
    flag = false;
    flag = _.any(downtimeResources, function(resource) {
      return resource.getTimeZoneName() !== currentUserTimeZone;
    });
    return flag;
  };

}).call(this);
(function() {
  RG.Utils.getDowntimeTypePriority = function(name) {
    var _base;
    if ((_base = RG.Variables).downtimeTypes == null) {
      _base.downtimeTypes = _.values(RG.Variables.DowntimeType);
    }
    return _.indexOf(RG.Variables.downtimeTypes, name);
  };

}).call(this);
(function() {
  RG.Utils.select2Close = function(element, flag) {
    if ($('.filters.active.open').length || flag) {
      return window.requestAnimationFrame(function() {
        var select2Inputs;
        if (element) {
          element.addClass('select2-active-filter-option');
        }
        select2Inputs = $("select.filter-option:not(.select2-active-filter-option)");
        if (select2Inputs.length) {
          select2Inputs.select2('enable', false).select2('enable', true);
        }
        if (element) {
          return element.removeClass('select2-active-filter-option');
        }
      });
    }
  };

  RG.Utils.getCSRFToken = function() {
    return $('meta[name="csrf-token"]').attr('content');
  };

}).call(this);
(function() {
  RG.Utils.PopoverManager = (function() {
    function PopoverManager() {
      this._nestedPopovers = [];
      this._rendererLocks = [];
    }

    PopoverManager.prototype.lock = function() {
      return this.locked = true;
    };

    PopoverManager.prototype.unlock = function() {
      this.clear();
      return this.locked = false;
    };

    PopoverManager.prototype.set = function(popoverView, removeCallback) {
      var _ref;
      if (removeCallback == null) {
        removeCallback = null;
      }
      if (this.locked) {
        return;
      }
      RG.Utils.enableScrolling(false);
      if ((_ref = this.popover) != null) {
        _ref.remove();
      }
      this.removeCallback = removeCallback;
      this.toggle(popoverView, removeCallback);
      return this.popover;
    };

    PopoverManager.prototype._lockRenderer = function() {
      var lock;
      lock = new RG.Renderer.GlobalLock;
      this._rendererLocks.push(lock);
      return RG.renderer.lock(lock);
    };

    PopoverManager.prototype._unlockRenderer = function() {
      var lock, _i, _len, _ref;
      _ref = this._rendererLocks;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        lock = _ref[_i];
        RG.renderer.unlock(lock);
      }
      this._rendererLocks = [];
    };

    PopoverManager.prototype.nest = function(popover) {
      return this._nestedPopovers.push(popover);
    };

    PopoverManager.prototype.clearNest = function() {
      var p, _i, _len, _ref;
      _ref = this._nestedPopovers;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        p = _ref[_i];
        p.remove();
      }
      return this._nestedPopovers = [];
    };

    PopoverManager.prototype.setBody = function(bodyView) {
      this.popover.setBodyView(bodyView);
      return this.popover.render();
    };

    PopoverManager.prototype.clear = function() {
      var _ref;
      if (this.locked) {
        return;
      }
      if ((_ref = this.popover) != null) {
        _ref.remove();
      }
      if (typeof this.removeCallback === "function") {
        this.removeCallback();
      }
      this.popover = null;
      this.removeCallback = null;
      this._unlockRenderer();
      return RG.Utils.enableScrolling(true);
    };

    PopoverManager.prototype.done = function() {
      this.popoverActive = false;
      this.removeCallback = null;
      return this.clear();
    };

    PopoverManager.prototype.replace = function(options) {
      if (options == null) {
        options = {};
      }
      if (this.locked) {
        return;
      }
      this.clear();
      this.popoverActive = false;
      if (options.popoverView) {
        return this.set(options.popoverView, options.removeCallback);
      }
    };

    PopoverManager.prototype.toggle = function(popoverView, removeCallback) {
      if (this.popoverActive || this.locked) {
        this.popoverActive = false;
        if (typeof removeCallback === "function") {
          removeCallback();
        }
        this.removeCallback = null;
        this.clear();
        return;
      }
      this.popoverActive = true;
      this.popover = popoverView;
      this.popover.popup();
      return this._lockRenderer();
    };

    PopoverManager.prototype.popoverVisible = function() {
      var popoverElement;
      if (!this.popover) {
        return false;
      }
      popoverElement = $(this.popover.el);
      return popoverElement.length > 0 && popoverElement.parent().length > 0;
    };

    return PopoverManager;

  })();

}).call(this);
(function() {
  RG.Utils.spinnerOptions = {
    lines: 9,
    length: 10,
    width: 5,
    radius: 15,
    corners: 1,
    rotate: 0,
    speed: 1,
    shadow: false,
    hwaccel: false,
    left: '50%',
    bottom: '-50%'
  };

}).call(this);
(function() {
  RG.Utils.spinnerOverlay = function(element) {
    var overlay;
    overlay = new RG.Views.Dialogs.Overlay({
      attachTo: element,
      className: "overlay",
      template: function() {
        return '';
      }
    });
    new Spinner(RG.Utils.spinnerOptions).spin(overlay.render().el);
    return overlay;
  };

}).call(this);
(function() {
  RG.Utils.TimeFormatter = {
    formatFixedTime: function(minuteOfDay) {
      var hour, minute, minuteStr, noonFlag;
      hour = Math.floor(minuteOfDay / 60);
      noonFlag = Math.floor(hour / 12) % 2 === 0 ? "am" : "pm";
      minute = minuteOfDay % 60;
      minuteStr = minute.toString();
      if (minuteStr.length === 1) {
        minuteStr = "0" + minuteStr;
      }
      if (hour > 12) {
        hour = hour % 12;
      }
      if (hour === 0) {
        hour = 12;
      }
      if (minuteStr === "00") {
        return "" + hour + noonFlag;
      } else {
        return "" + hour + "." + minuteStr + noonFlag;
      }
    },
    formatMinutes: function(time) {
      var hours, minutes, minutesStr, showHours, showMinutes;
      hours = Math.floor(time / 60);
      minutes = time % 60;
      showHours = (hours === 0 && minutes === 0) || hours > 0;
      showMinutes = minutes > 0;
      time = "";
      if (showHours) {
        time = time + ("" + hours + "h ");
      }
      if (showMinutes) {
        minutesStr = "" + minutes + "m";
        if (minutesStr.length === 2) {
          minutesStr = "0" + minutesStr;
        }
        time = time + minutesStr;
      }
      return time.trim();
    },
    formatMinutesOffset: function(time) {
      var hours, isNegative, minutes, minutesStr;
      isNegative = time < 0;
      hours = Math.floor(Math.abs(time) / 60);
      minutes = Math.abs(time) % 60;
      time = hours.toString();
      minutesStr = minutes.toString();
      if (minutes > 0) {
        minutesStr = minutes.toString();
        if (minutesStr.length === 1) {
          minutesStr = "0" + minutesStr;
        }
        time = time + ":" + minutesStr;
      }
      time = isNegative ? "-" + time : "+" + time;
      return time;
    }
  };

}).call(this);
(function() {
  var __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    __slice = [].slice;

  RG.Utils.TimeRange = (function(_super) {
    __extends(TimeRange, _super);

    function TimeRange(startTime, endTime) {
      this.startTime = startTime;
      this.endTime = endTime;
    }

    TimeRange.prototype.getStart = function() {
      return this.startTime;
    };

    TimeRange.prototype.getEnd = function() {
      return this.endTime;
    };

    TimeRange.prototype.merge = function() {
      var currentRange, newRanges, ranges;
      ranges = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      ranges.push(this);
      ranges = _.sortBy(ranges, 'endTime');
      ranges = _.sortBy(ranges, 'startTime');
      newRanges = [];
      currentRange = ranges.shift();
      while (ranges.length) {
        if (ranges[0] && currentRange.isTouching(ranges[0])) {
          if (currentRange.endTime < ranges[0].endTime) {
            currentRange.endTime = ranges[0].endTime;
          }
          ranges.shift();
        } else {
          newRanges.push(currentRange);
          currentRange = ranges.shift();
        }
      }
      newRanges.push(currentRange);
      return newRanges;
    };

    TimeRange.prototype.isEqual = function(other) {
      return this.endTime === other.endTime && this.startTime === other.startTime;
    };

    TimeRange.prototype.subtract = function(other) {
      var ranges;
      if (!this.overlapsWith(other)) {
        return this.totalTime();
      }
      if (this.contains(other)) {
        return this.totalTime() - other.totalTime();
      } else if (other.contains(this)) {
        return 0;
      } else if (this.overlapsWith(other)) {
        ranges = this.subtractOne(other);
        return ranges.reduce((function(acc, val) {
          return acc + val.totalTime();
        }), 0);
      }
    };

    TimeRange.prototype.subtractOne = function(subtracted) {
      if (subtracted.startTime <= this.startTime && subtracted.endTime >= this.endTime) {
        return [];
      }
      if (subtracted.endTime <= this.startTime || subtracted.startTime >= this.endTime) {
        return [this];
      }
      if (subtracted.startTime > this.startTime && subtracted.endTime < this.endTime) {
        return [new RG.Utils.TimeRange(this.startTime, subtracted.startTime), new RG.Utils.TimeRange(subtracted.endTime, this.endTime)];
      }
      if (subtracted.startTime <= this.startTime && subtracted.endTime < this.endTime) {
        return [new RG.Utils.TimeRange(subtracted.endTime, this.endTime)];
      }
      if (subtracted.startTime > this.startTime && subtracted.endTime >= this.endTime) {
        return [new RG.Utils.TimeRange(this.startTime, subtracted.startTime)];
      }
      throw "Invalid subtraction";
    };

    TimeRange.prototype.totalTime = function() {
      return (this.endTime - this.startTime) | 0;
    };

    TimeRange.prototype.overlapsOneOClock = function() {
      return this.startTime < 780 && this.endTime > 780;
    };

    TimeRange.prototype.getAllowancePerDay = function() {
      if (this.overlapsOneOClock()) {
        return 1;
      } else {
        return 0.5;
      }
    };

    TimeRange.prototype.toString = function() {
      if (this.totalTime() === 1440) {
        return 'All day';
      }
      return "" + (this._startMinutesToTime()) + " - " + (this._endMinutesToTime());
    };

    TimeRange.prototype._startMinutesToTime = function() {
      return RG.Utils.TimeFormatter.formatFixedTime(this.startTime);
    };

    TimeRange.prototype._endMinutesToTime = function() {
      return RG.Utils.TimeFormatter.formatFixedTime(this.endTime);
    };

    return TimeRange;

  })(RG.Utils.Range);

  RG.Utils.TimeRange.sum = function(ranges) {
    return ranges.reduce((function(acc, range) {
      return acc + range.totalTime();
    }), 0);
  };

}).call(this);
(function() {
  RG.Utils.UnitDurationConverter = (function() {
    function UnitDurationConverter(unitType) {
      this.unitType = unitType;
    }

    UnitDurationConverter.prototype.convertArray = function(durations, startDate, endDate) {
      var currentUnit, duration, durationsInUnit, earliest, latest, unit, unitDuration, unitDurations;
      if (durations.length === 0) {
        return [];
      }
      if (durations.length === 1) {
        duration = durations[0];
        unit = new this.unitType(duration.attributes.date);
        unitDuration = new RG.Models.UnitDuration;
        unitDuration.attributes = {
          minutes: duration.getMinutes(),
          minutesPerLine: unit.getMinutesPerUtilisationLine(),
          date: unit.date,
          waiting: duration.isWaiting() || false
        };
        return [unitDuration];
      }
      earliest = startDate || durations[0].attributes.date;
      latest = endDate || durations[durations.length - 1].attributes.date;
      unitDurations = [];
      currentUnit = new this.unitType(earliest);
      while (1) {
        durationsInUnit = this._getDurationsInUnit(durations, currentUnit);
        duration = new RG.Models.UnitDuration;
        duration.attributes = {
          minutes: this.getMinutesInDurations(durationsInUnit),
          minutesPerLine: currentUnit.getMinutesPerUtilisationLine(),
          date: currentUnit.date,
          waiting: durationsInUnit.some(function(d) {
            return d.isWaiting();
          })
        };
        unitDurations.push(duration);
        currentUnit = currentUnit.nextUnit();
        if (currentUnit.date > latest) {
          break;
        }
      }
      return unitDurations;
    };

    UnitDurationConverter.prototype.convert = function(durations, startDate, endDate) {
      var collection, newDurations;
      if (durations.length === 0) {
        return new RG.Collections.UnitDurations;
      }
      newDurations = this.convertArray(durations, startDate, endDate);
      collection = new RG.Collections.UnitDurations;
      collection.models = newDurations;
      collection.models.forEach(function(d) {
        return d.collection = collection;
      });
      collection.length = newDurations.length;
      return collection;
    };

    UnitDurationConverter.prototype.getDurationMinutesInUnit = function(durations, unit) {
      var durationsInUnit;
      durationsInUnit = this._getDurationsInUnit(durations, unit);
      return this.getMinutesInDurations(durationsInUnit);
    };

    UnitDurationConverter.prototype.getMinutesInDurations = function(durations) {
      var d, minutes, _i, _len;
      minutes = 0;
      for (_i = 0, _len = durations.length; _i < _len; _i++) {
        d = durations[_i];
        minutes = minutes + d.getMinutes();
      }
      return minutes;
    };

    UnitDurationConverter.prototype._getDurationsInUnit = function(durations, unit) {
      var d, durationsInUnit, _i, _len;
      durationsInUnit = [];
      for (_i = 0, _len = durations.length; _i < _len; _i++) {
        d = durations[_i];
        if (unit.containsDate(d.attributes.date)) {
          durationsInUnit.push(d);
        }
      }
      return durationsInUnit;
    };

    return UnitDurationConverter;

  })();

}).call(this);
(function() {
  RG.Controllers.TimeAllocationLayers = (function() {
    function TimeAllocationLayers(bookingsCollection, downtimesCollection) {
      this.bookingsCollection = bookingsCollection;
      this.downtimesCollection = downtimesCollection;
    }

    TimeAllocationLayers.prototype.layerFor = function(timeAllocation) {};

    TimeAllocationLayers.prototype.resetLayers = function() {};

    TimeAllocationLayers.prototype.close = function() {};

    TimeAllocationLayers.prototype._getTimeAllocations = function() {};

    return TimeAllocationLayers;

  })();

}).call(this);
(function() {
  var __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  RG.Models.Base = (function(_super) {
    __extends(Base, _super);

    function Base(attributes, options) {
      this.cid = _.uniqueId(this.cidPrefix);
      this.attributes = {};
      if (options) {
        this.collection = options.collection;
      }
      this.set(attributes || {});
      this.changed = {};
      this.initialize.apply(this, arguments);
    }

    return Base;

  })(Backbone.Model);

}).call(this);
(function() {
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  RG.Models.ResourceInstance = (function(_super) {
    __extends(ResourceInstance, _super);

    function ResourceInstance() {
      this.refreshDowntimes = __bind(this.refreshDowntimes, this);
      return ResourceInstance.__super__.constructor.apply(this, arguments);
    }

    ResourceInstance.prototype.initialize = function(options) {
      this.account = options != null ? options.account : void 0;
      this.bookings = new RG.Collections.Bookings;
      this.bookings.resource = this;
      this.availablePeriods = new RG.Collections.AvailablePeriods;
      this.availablePeriods.resource = this;
      this.customAvailablePeriods = new RG.Collections.CustomAvailablePeriods;
      this.customAvailablePeriods.resource = this;
      this.overtimes = new RG.Collections.Overtimes;
      this.overtimes.resource = this;
      this.downtimes = new RG.Collections.Downtimes;
      this.downtimes.resource = this;
      window.downtimes.on("add:resource_id:" + this.id, (function(_this) {
        return function(d) {
          return _this.downtimes.push(d.cloneWithBinding());
        };
      })(this));
      window.downtimes.on("remove:resource_id:" + this.id, (function(_this) {
        return function(d) {
          var removedDowntime;
          removedDowntime = _this.downtimes.findWhere({
            id: d.id
          });
          return _this.downtimes.remove(removedDowntime);
        };
      })(this));
      this.downtimes.on("change", function(d) {
        var original;
        original = window.downtimes.findWhere({
          id: d.id
        });
        return original.set(d.attributes);
      });
      this.availability = new RG.Factories.AvailabilityManager(this).create();
      this.customFieldOptions = new RG.Collections.CustomFieldOptions;
      this.customFieldOptions.resource = this;
      this.visible = this.get('bookable');
      return ResourceInstance.__super__.initialize.apply(this, arguments);
    };

    ResourceInstance.prototype.isAvailableIn = function(dateRange, timeRange) {
      if (timeRange == null) {
        timeRange = new RG.Utils.TimeRange(0, 1440);
      }
      return this.availability.isAvailableIn(dateRange, timeRange);
    };

    ResourceInstance.prototype.getFirstName = function() {
      var spacePos;
      if (this.get("human")) {
        spacePos = this.get('name').indexOf(' ');
        if (spacePos >= 0) {
          return this.escape('name').substr(0, spacePos);
        } else {
          return this.escape('name');
        }
      } else {
        return this.getName();
      }
    };

    ResourceInstance.prototype.getImage = function() {
      return this.get('imageUrl');
    };

    ResourceInstance.prototype.hasAvatar = function() {
      return true;
    };

    ResourceInstance.prototype.getName = function() {
      return this.escape('name');
    };

    ResourceInstance.prototype.getTimeZoneName = function() {
      return this.getTimeZone().getName();
    };

    ResourceInstance.prototype.getInitials = function() {
      var initials, names;
      names = this.get('name').split(" ");
      initials = names[0][0].toUpperCase();
      if (names.length !== 1 && names[names.length - 1][0]) {
        initials += names[names.length - 1][0].toUpperCase();
      }
      return initials;
    };

    ResourceInstance.prototype.getTimeZone = function() {
      return this.get('timeZone') || new RG.Models.TimeZone({
        name: "UTC",
        offset: 0
      });
    };

    ResourceInstance.prototype.shouldDisplayTimeZone = function() {
      return this.getTimeZoneName() !== window.currentUserTimeZone;
    };

    ResourceInstance.prototype.hasCustomFieldOption = function(option) {
      return this.customFieldOptions.contains(option);
    };

    ResourceInstance.prototype.isBookable = function() {
      return typeof this.get("bookable") === "undefined" || this.get("bookable");
    };

    ResourceInstance.prototype.isBookedOnClient = function(client) {
      return _.contains(this.get('bookedClients'), client);
    };

    ResourceInstance.prototype.isBookedOnProject = function(project) {
      return _.contains(this.get('bookedProjects'), project);
    };

    ResourceInstance.prototype.isHuman = function() {
      return typeof this.get("human") !== "undefined" && this.get("human");
    };

    ResourceInstance.prototype.predictWaitingList = function() {
      return this.bookings.predictWaitingList();
    };

    ResourceInstance.prototype.typeName = function() {
      var _ref;
      return (_ref = this.get('resourceType')) != null ? _ref.get('name') : void 0;
    };

    ResourceInstance.prototype.refreshDowntimes = function(silent) {
      if (silent == null) {
        silent = false;
      }
      if (this.hasDowntimes) {
        return;
      }
      this.hasDowntimes = true;
      return this.downtimes.reset(this.account.downtimes.forResource(this).map(function(downtime) {
        var d;
        d = downtime.clone();
        downtime.on('change', function() {
          return d.set(downtime.attributes);
        });
        return d;
      }), {
        silent: silent
      });
    };

    ResourceInstance.prototype.isDowntimesStale = function() {
      var array, currentDowntimes, uniqArray, val, _i, _j, _len, _len1;
      currentDowntimes = this.account.downtimes.forResource(this);
      if (this.downtimes.length !== currentDowntimes.length) {
        return true;
      } else {
        array = (currentDowntimes.map(function(downtime) {
          return downtime.id;
        })).concat(this.downtimes.pluck('id'));
        uniqArray = [];
        for (_i = 0, _len = array.length; _i < _len; _i++) {
          val = array[_i];
          if (__indexOf.call(uniqArray, val) < 0) {
            uniqArray.push(val);
          }
        }
        if (uniqArray.length !== this.downtimes.length) {
          return true;
        } else {
          array = (currentDowntimes.map(function(downtime) {
            return downtime.attributes.updatedAt.getTime();
          })).concat(this.downtimes.models.map(function(downtime) {
            return downtime.attributes.updatedAt.getTime();
          }));
          uniqArray = [];
          for (_j = 0, _len1 = array.length; _j < _len1; _j++) {
            val = array[_j];
            if (__indexOf.call(uniqArray, val) < 0) {
              uniqArray.push(val);
            }
          }
          if (uniqArray.length !== this.downtimes.length) {
            return true;
          }
        }
      }
      return false;
    };

    ResourceInstance.prototype.getDowntimeText = function() {
      return "downtime";
    };

    ResourceInstance.prototype.getHeadingDowntimeText = function() {
      return "Downtime";
    };

    ResourceInstance.prototype._addDays = function(dateRange, timeRange, total, increment) {
      if (this.isAvailableIn(dateRange, timeRange)) {
        return total + increment;
      } else {
        return total;
      }
    };

    return ResourceInstance;

  })(RG.Models.Base);

}).call(this);
(function() {
  var date,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  RG.Models.TimeZone = (function(_super) {
    __extends(TimeZone, _super);

    function TimeZone() {
      return TimeZone.__super__.constructor.apply(this, arguments);
    }

    TimeZone.prototype.toString = function() {
      return "(GMT " + (RG.Utils.TimeFormatter.formatMinutesOffset(this.get('offset'))) + ") " + (this.get('name'));
    };

    TimeZone.prototype.getFormattedOffset = function() {
      var flag, formattedHours, formattedOffset, hours, offsetHours;
      offsetHours = (this.get('offset') / 60) * -1;
      hours = Math.abs(offsetHours);
      formattedHours = Math.floor(hours);
      if (hours <= 10) {
        formattedHours = "0" + formattedHours;
      }
      if (offsetHours % 1 !== 0) {
        formattedOffset = formattedHours + ":30";
      } else {
        formattedOffset = formattedHours + ":00";
      }
      flag = offsetHours >= 0 ? "+" : "-";
      return flag + formattedOffset;
    };

    TimeZone.prototype.getName = function() {
      return this.get('name');
    };

    TimeZone.prototype.getParamValue = function() {
      return this.getName();
    };

    return TimeZone;

  })(RG.Models.Base);

  RG.Models.TimeZone.UTC = new RG.Models.TimeZone({
    name: 'UTC',
    offset: 0
  });

  date = new Date();

  RG.Models.TimeZone.Current = new RG.Models.TimeZone({
    name: 'Current',
    offset: -date.getTimezoneOffset()
  });

}).call(this);
(function() {
  var __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  RG.Models.AbstractTimeAllocation = (function(_super) {
    __extends(AbstractTimeAllocation, _super);

    function AbstractTimeAllocation() {
      return AbstractTimeAllocation.__super__.constructor.apply(this, arguments);
    }

    AbstractTimeAllocation.prototype.isDowntime = function() {
      return false;
    };

    AbstractTimeAllocation.prototype.getDateRange = function() {
      return new RG.Utils.DateRange(this.getFirstAllocatedDate(), this.getLastAllocatedDate());
    };

    AbstractTimeAllocation.prototype.getFirstAllocatedDate = function() {
      throw "Implement getFirstAllocatedDate in subclasses";
    };

    AbstractTimeAllocation.prototype.getLastAllocatedDate = function() {
      throw "Implement getLastAllocatedDate in subclasses";
    };

    AbstractTimeAllocation.prototype.getTimeRange = function() {
      throw "Implement getTimeRange in subclasses";
    };

    AbstractTimeAllocation.prototype.getConfirmedMinutes = function() {
      return this.getTimeRange().totalTime();
    };

    AbstractTimeAllocation.prototype.getDurationCaption = function() {
      return this._getFirstDuration().getCaption();
    };

    AbstractTimeAllocation.prototype.getDurationRepeatCaption = function() {
      return this._getFirstDuration().getRepeatCaption();
    };

    AbstractTimeAllocation.prototype.getDurationLongRepeatCaption = function() {
      return this._getFirstDuration().getLongRepeatCaption();
    };

    AbstractTimeAllocation.prototype.getDraggingId = function() {
      return "" + (RG.Utils.DateFormatter.getISODate(this.getFirstAllocatedDate())) + "-" + (RG.Utils.DateFormatter.getISODate(this.getLastAllocatedDate())) + "-dragged-booking";
    };

    AbstractTimeAllocation.prototype._getFirstDuration = function() {
      throw "Implement _getFirstDuration in subclasses";
    };

    AbstractTimeAllocation.prototype._getLastDuration = function() {
      throw "Implement _getLastDuration in subclasses";
    };

    AbstractTimeAllocation.prototype.getStartDate = function() {
      throw "Implement getStartDate in subclasses";
    };

    AbstractTimeAllocation.prototype.getEndDate = function() {
      throw "Implement getEndDate in subclasses";
    };

    return AbstractTimeAllocation;

  })(RG.Models.Base);

}).call(this);
(function() {
  var __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  RG.Models.Account = (function(_super) {
    __extends(Account, _super);

    function Account() {
      return Account.__super__.constructor.apply(this, arguments);
    }

    Account.prototype.initialize = function(options) {
      if (options == null) {
        options = {};
      }
      return this.downtimes = options.downtimes || new RG.Collections.Downtimes;
    };

    Account.prototype.getSubdomain = function() {
      return this.get("subdomain");
    };

    return Account;

  })(RG.Models.Base);

}).call(this);
(function() {
  var __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  RG.Models.AvailablePeriod = (function(_super) {
    __extends(AvailablePeriod, _super);

    function AvailablePeriod() {
      return AvailablePeriod.__super__.constructor.apply(this, arguments);
    }

    AvailablePeriod.prototype.getMinutesAvailable = function() {
      return +this.get('endTime') - +this.get('startTime');
    };

    AvailablePeriod.prototype.isValidOn = function(date) {
      return this.get('weekDay') === date.getDay() && (typeof this.get('validUntil') === 'undefined' || this.get('validUntil').getTime() >= date.getTime()) && (this.get('validFrom') < date || RG.Utils.DateComparator.equalsYMD(this.get('validFrom'), date));
    };

    AvailablePeriod.prototype.isCoveringDate = function(date) {
      var comparedRange, dateRange;
      dateRange = new RG.Utils.DateRange(this.get('validFrom'), this.get('validUntil'));
      comparedRange = new RG.Utils.DateRange(date, date);
      return dateRange.overlapsWith(comparedRange);
    };

    AvailablePeriod.prototype.isValidInDateRange = function(dateRange) {
      var endDate, startDate, validFrom, validFromTime, validUntil, validUntilTime;
      validFrom = this.attributes.validFrom;
      validUntil = this.attributes.validUntil;
      validFromTime = validFrom.valueOf();
      validUntilTime = validUntil != null ? validUntil.valueOf() : void 0;
      startDate = dateRange.startDate.valueOf();
      endDate = dateRange.endDate.valueOf();
      return dateRange.includes(validFrom) || ((validFromTime <= startDate) && !validUntilTime) || ((validFromTime <= startDate) && (validUntilTime >= endDate)) || dateRange.includes(validUntil);
    };

    AvailablePeriod.prototype.isAllDay = function() {
      return this.getMinutesAvailable() === 1440;
    };

    AvailablePeriod.prototype.toString = function() {
      return "" + (RG.Utils.TimeFormatter.formatFixedTime(+this.get('startTime'))) + " - " + (RG.Utils.TimeFormatter.formatFixedTime(+this.get('endTime')));
    };

    AvailablePeriod.prototype.differentPeriod = function(cap) {
      return +this.get('endTime') !== +cap.get('endTime') || +this.get('startTime') !== +cap.get('startTime');
    };

    AvailablePeriod.prototype.contains = function(timeRange) {
      return new RG.Utils.TimeRange(this.get('startTime'), this.get('endTime')).contains(timeRange);
    };

    AvailablePeriod.prototype.getTimeRange = function() {
      return new RG.Utils.TimeRange(this.get('startTime'), this.get('endTime'));
    };

    AvailablePeriod.prototype.isNewerThan = function(date) {
      return this.get('validFrom').valueOf() >= date.valueOf();
    };

    return AvailablePeriod;

  })(RG.Models.Base);

}).call(this);
(function() {
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  RG.Models.BaseDuration = (function(_super) {
    __extends(BaseDuration, _super);

    function BaseDuration() {
      this.predictWaitingList = __bind(this.predictWaitingList, this);
      return BaseDuration.__super__.constructor.apply(this, arguments);
    }

    BaseDuration.prototype.anyClashes = function() {
      return false;
    };

    BaseDuration.prototype.getDate = function() {
      return this.get('date');
    };

    BaseDuration.prototype.getLayer = function() {
      return this.collection.booking.layer;
    };

    BaseDuration.prototype.isConfirmed = function() {
      return !this.attributes.waiting;
    };

    BaseDuration.prototype.isWaiting = function() {
      return this.attributes.waiting;
    };

    BaseDuration.prototype.containsDate = function(date) {
      return RG.Utils.DateComparator.equalsYMD(this.get('date'), date);
    };

    BaseDuration.prototype._isValidInTimeRange = function(timeRange) {
      return true;
    };

    BaseDuration.prototype.predictWaitingList = function() {
      var am, confirmed, date, duration, durations, minutesAvailable, resource, usedMinutes, _i, _len, _ref, _ref1, _ref2, _ref3;
      resource = (_ref = this.collection) != null ? (_ref1 = _ref.booking) != null ? (_ref2 = _ref1.collection) != null ? _ref2.resource : void 0 : void 0 : void 0;
      if (!resource) {
        return;
      }
      am = resource.availability;
      date = this.attributes.date;
      minutesAvailable = am.getMinutesAvailableForDate(date);
      if (minutesAvailable === 0) {
        return;
      }
      usedMinutes = 0;
      durations = [];
      _ref3 = resource.bookings.getDurationsForDate(date);
      for (_i = 0, _len = _ref3.length; _i < _len; _i++) {
        duration = _ref3[_i];
        if (!(duration !== this && duration.isConfirmed())) {
          continue;
        }
        durations.push(duration);
        usedMinutes += duration.getMinutes();
      }
      if (this.get('waiting')) {
        confirmed = !this.anyClashes(durations) && (usedMinutes + this.getMinutes()) <= minutesAvailable && am.getAvailableTimeRangesInDateRange(new RG.Utils.DateRange(date, date)).some((function(_this) {
          return function(r) {
            return _this._isValidInTimeRange(r);
          };
        })(this));
        this.set({
          waiting: !confirmed
        });
      }
    };

    BaseDuration.prototype.removeAndUpdateBooking = function() {
      var booking, bookings, date, durations, resource;
      durations = this.collection;
      booking = durations != null ? durations.booking : void 0;
      if (!booking) {
        return;
      }
      bookings = booking.collection;
      resource = bookings.resource;
      date = this.get('date');
      durations.remove(this, {
        silent: true
      });
      if (durations.length === 0) {
        bookings.remove(booking);
        return;
      }
      if (resource.availability.getMinutesAvailableForDate(date) > 0) {
        booking.split(date);
      }
    };

    return BaseDuration;

  })(RG.Models.Base);

}).call(this);
(function() {
  var __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  RG.Models.Booker = (function(_super) {
    __extends(Booker, _super);

    function Booker() {
      return Booker.__super__.constructor.apply(this, arguments);
    }

    return Booker;

  })(RG.Models.Base);

}).call(this);
(function() {
  var __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    __slice = [].slice;

  RG.Models.Booking = (function(_super) {
    __extends(Booking, _super);

    function Booking() {
      Booking.__super__.constructor.apply(this, arguments);
      this.layer = 0;
      this.realBooking = this;
      this.durations = new RG.Collections.Durations;
      this.durations.booking = this;
      return;
    }

    Booking.prototype.deepEqual = function(other) {
      var myResource, otherResource, _ref, _ref1;
      myResource = (_ref = this.collection) != null ? _ref.resource : void 0;
      otherResource = (_ref1 = other.collection) != null ? _ref1.resource : void 0;
      return other.constructor === this.constructor && this.layer === other.layer && _.isEqual(this.attributes, other.attributes) && _.isEqual(this.durations.models.map(function(d) {
        return d.attributes;
      }), other.durations.models.map(function(d) {
        return d.attributes;
      })) && myResource === otherResource;
    };

    Booking.prototype.deepClone = function() {
      var b, clonedDurations;
      b = this.clone();
      clonedDurations = this.durations.models.map(function(d) {
        var dup;
        dup = new d.constructor;
        dup.attributes = _.clone(d.attributes);
        dup.id = d.id;
        return dup;
      });
      b.durations = new RG.Collections.Durations;
      b.durations.models = clonedDurations;
      b.durations.length = clonedDurations.length;
      b.durations.booking = b;
      return b;
    };

    Booking.prototype.getBookingTarget = function() {
      return this.get('client') || this.get('project') || new RG.Models.NullBookingTarget;
    };

    Booking.prototype.getCaption = function() {
      var caption, durationCaption, separator;
      durationCaption = this.getDurationCaption();
      separator = "";
      caption = this.getBookingTarget().toString();
      if (this.isSeries()) {
        durationCaption = "" + durationCaption + " " + (this.getDurationRepeatCaption());
      }
      if (caption.indexOf("|") === -1 && this.escape('notes').trim().length) {
        if (caption.length) {
          caption = caption + " | ";
        }
        caption = caption + this.escape('notes').substr(0, 35).trim();
        if (this.escape('notes').length > 35) {
          caption = caption + "...";
        }
      }
      if (caption.length && durationCaption.length) {
        separator = " | ";
      }
      return caption + separator + durationCaption;
    };

    Booking.prototype.getConfirmedMinutes = function() {
      var confirmedDurations;
      confirmedDurations = this.durations.filter(function(d) {
        return d.isConfirmed();
      });
      return confirmedDurations.map(function(d) {
        return d.getMinutes();
      }).reduce((function(a, b) {
        return a + b;
      }), 0);
    };

    Booking.prototype.getFirstAllocatedDate = function() {
      return this._getFirstDuration().get('date');
    };

    Booking.prototype.getLastAllocatedDate = function() {
      return this._getLastDuration().get('date');
    };

    Booking.prototype.getLongCaption = function() {
      var caption, durationCaption, longCaption, target;
      target = this.getBookingTarget();
      caption = "";
      durationCaption = this.getDurationCaption();
      if (this.isSeries()) {
        durationCaption = "" + durationCaption + " " + (this.getDurationLongRepeatCaption());
      }
      caption = caption + ("<span class=\"label__time\">" + durationCaption + "</span>");
      if ((target != null) && target.constructor) {
        longCaption = "<br>" + (target.getLongCaption());
        caption = caption + (target.getLongCaption().length ? longCaption : "");
      }
      if (this.get('notes') && target.getLongCaption().indexOf("<br>") === -1) {
        caption = caption + ("<br>" + (this.escape('notes')));
      }
      return caption;
    };

    Booking.prototype.getSavedDateRange = function() {
      return new RG.Utils.DateRange(this.get('startDate'), this.get('endDate'));
    };

    Booking.prototype.getTitleCaption = function() {
      var caption, details, durationCaption, target, targetString;
      target = this.getBookingTarget();
      caption = [];
      if (targetString = target.toString()) {
        caption.push(targetString);
      }
      if (this.get('notes') && this.get('notes').length) {
        details = this.get('notes').replace(/\n/g, " ").substr(0, 300);
        details = details.length === 300 ? details.substr(0, 297) + "..." : details;
        caption.push(details);
      }
      durationCaption = this.getDurationCaption();
      if (this.isSeries) {
        durationCaption += " " + this.getDurationRepeatCaption();
      }
      caption.push(durationCaption);
      return caption.join(" | ");
    };

    Booking.prototype.getWaitingMinutes = function() {
      var waitingDurations;
      waitingDurations = this.durations.filter(function(d) {
        return d.isWaiting();
      });
      return _.reduce(_.map(waitingDurations, function(d) {
        return d.getMinutes();
      }), (function(a, b) {
        return a + b;
      }), 0);
    };

    Booking.prototype.cloneWithDurations = function() {
      var booking, durations, endDate, startDate;
      durations = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      startDate = durations[0].get('date');
      endDate = _.last(durations).get('date');
      booking = this.clone();
      booking.set({
        startDate: startDate,
        endDate: endDate
      });
      booking.durations = new RG.Collections.Durations(durations);
      booking.collection = this.collection;
      booking.realBooking = this;
      return booking;
    };

    Booking.prototype.split = function(date) {
      var durations, leftDurations, rightBooking, rightDurations;
      leftDurations = this.durations.select(function(duration) {
        return duration.get('date').cloneYMD() < date.cloneYMD();
      });
      rightDurations = this.durations.select(function(duration) {
        return duration.get('date').cloneYMD() > date.cloneYMD();
      });
      if (leftDurations.length && rightDurations.length) {
        this.durations.reset(leftDurations);
        this.set({
          startDate: leftDurations[0].get('date'),
          endDate: _.last(leftDurations).get('date')
        });
        rightBooking = this.clone();
        rightBooking.set({
          id: null,
          startDate: rightDurations[0].get('date'),
          endDate: _.last(rightDurations).get('date')
        });
        rightBooking.collection = this.collection;
        rightBooking.durations = new RG.Collections.Durations(rightDurations);
        rightBooking.durations.booking = rightBooking;
        return this.collection.add(rightBooking);
      } else {
        durations = leftDurations.concat(rightDurations);
        this.durations.reset(durations);
        return this.set({
          startDate: durations[0].get('date'),
          endDate: _.last(durations).get('date')
        });
      }
    };

    Booking.prototype.isExclusivelyOnWaitingList = function() {
      return this.durations.models.filter(function(d) {
        return d.getMinutes() > 0;
      }).every(function(d) {
        return d.isWaiting();
      });
    };

    Booking.prototype.isSeries = function() {
      return this.durations.length > 1;
    };

    Booking.prototype.predictWaitingList = function() {
      return this.durations.predictWaitingList();
    };

    Booking.prototype.getFirstNonZeroDuration = function() {
      var duration, _i, _len, _ref;
      _ref = this.durations.models;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        duration = _ref[_i];
        if (duration.getMinutes() > 0) {
          return duration;
        }
      }
      return new RG.Models.NullDuration;
    };

    Booking.prototype._getFirstDuration = function() {
      return this.durations.models[0] || new RG.Models.NullDuration;
    };

    Booking.prototype._getLastDuration = function() {
      return this.durations.models[this.durations.length - 1] || new RG.Models.NullDuration;
    };

    Booking.prototype.getBooker = function() {
      return this.get('booker');
    };

    Booking.prototype.getDurations = function() {
      return this.durations.models;
    };

    Booking.prototype.getStartDate = function() {
      return this._getFirstDuration().getDate();
    };

    Booking.prototype.getEndDate = function() {
      return this._getLastDuration().getDate();
    };

    Booking.prototype.hasNoDurations = function() {
      return this.durations.select(function(d) {
        return !d.transient;
      }).length === 0;
    };

    return Booking;

  })(RG.Models.AbstractTimeAllocation);

}).call(this);
(function() {
  var __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  RG.Models.CustomAvailablePeriod = (function(_super) {
    __extends(CustomAvailablePeriod, _super);

    function CustomAvailablePeriod() {
      return CustomAvailablePeriod.__super__.constructor.apply(this, arguments);
    }

    CustomAvailablePeriod.prototype.initialize = function(options) {
      return CustomAvailablePeriod.__super__.initialize.apply(this, arguments);
    };

    CustomAvailablePeriod.prototype.isValidOn = function(date) {
      return RG.Utils.DateComparator.equalsYMD(this.get('date'), date);
    };

    CustomAvailablePeriod.prototype.isEditable = function() {
      return true;
    };

    return CustomAvailablePeriod;

  })(RG.Models.AvailablePeriod);

}).call(this);
(function() {
  var __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  RG.Models.CustomField = (function(_super) {
    __extends(CustomField, _super);

    function CustomField() {
      return CustomField.__super__.constructor.apply(this, arguments);
    }

    CustomField.prototype.initialize = function() {
      this.customFieldOptions = new RG.Collections.CustomFieldOptions;
      return this.customFieldOptions.customField = this;
    };

    return CustomField;

  })(RG.Models.Base);

}).call(this);
(function() {
  var __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  RG.Models.CustomFieldOption = (function(_super) {
    __extends(CustomFieldOption, _super);

    function CustomFieldOption() {
      return CustomFieldOption.__super__.constructor.apply(this, arguments);
    }

    return CustomFieldOption;

  })(RG.Models.Base);

}).call(this);
(function() {
  var __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  RG.Models.Downtime = (function(_super) {
    __extends(Downtime, _super);

    function Downtime() {
      Downtime.__super__.constructor.apply(this, arguments);
      this.downtimeType = this.getDowntimeType();
      this._timeRanges = {};
      this._timeZoneConverted = {};
      this._boundClones = [];
      if (!this.attributes.updatedAt) {
        this.attributes.updatedAt = new Date;
      }
      this.on('change', this._resetCache, this);
      this.on('change', (function(_this) {
        return function() {
          var d, _i, _len, _ref, _results;
          _ref = _this._boundClones;
          _results = [];
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            d = _ref[_i];
            _results.push(d.set(_this.attributes));
          }
          return _results;
        };
      })(this));
      return;
    }

    Downtime.prototype.deepEqual = function(other) {
      return this.constructor === other.constructor && this.layer === other.layer && _.isEqual(this.attributes, other.attributes);
    };

    Downtime.prototype.deepClone = function() {
      return this.clone();
    };

    Downtime.prototype._resetCache = function() {
      this._timeRanges = {};
      this._durations = null;
      return this._timeZoneConverted = {};
    };

    Downtime.prototype.isDowntime = function() {
      return true;
    };

    Downtime.prototype.isSeries = function() {
      return this.getDateRange().getNumberOfDays() > 1;
    };

    Downtime.prototype.clone = function() {
      return new this.constructor(this.attributes);
    };

    Downtime.prototype.cloneWithBinding = function() {
      var d;
      d = this.clone();
      this._boundClones.push(d);
      return d;
    };

    Downtime.prototype.getDowntimeType = function() {
      return this.get('downtimeType');
    };

    Downtime.prototype.getConfirmedMinutes = function() {
      var date, dateRange, time, timeRange, _i, _len, _ref;
      dateRange = this.getDateRange();
      if (dateRange.getNumberOfDays() === 1) {
        timeRange = this.getTimeRange(dateRange.startDate);
        return timeRange.totalTime();
      } else {
        time = 0;
        _ref = dateRange.getDates();
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          date = _ref[_i];
          timeRange = this.getTimeRange(date);
          time += timeRange.totalTime();
        }
        return time;
      }
    };

    Downtime.prototype.getSavedDateRange = function() {
      return this.getDateRange();
    };

    Downtime.prototype.getFirstAllocatedDate = function() {
      return this.attributes.from;
    };

    Downtime.prototype.getLastAllocatedDate = function() {
      return this.attributes.to;
    };

    Downtime.prototype.type = function() {
      var _ref;
      return (_ref = this.getDowntimeType()) != null ? _ref.get('name') : void 0;
    };

    Downtime.prototype.inYear = function(year) {
      return this.getDateRange().coversYear(year);
    };

    Downtime.prototype.isValidOn = function(date) {
      return this.getDateRange().includes(date);
    };

    Downtime.prototype.inTimeZoneSimple = function(timeZone) {
      var from, offset, shift, shiftedEnd, shiftedEndDate, shiftedEndTime, shiftedStart, shiftedStartDate, shiftedStartTime, to;
      if (this.isLocalTimeZone()) {
        from = this.attributes.from;
        to = this.attributes.to;
        return {
          startDate: from,
          endDate: to,
          startTime: this.attributes.startTime,
          endTime: this.attributes.endTime,
          getDateRange: function() {
            return new RG.Utils.DateRange(from, to);
          },
          getStartDate: function() {
            return from;
          },
          getEndDate: function() {
            return to;
          }
        };
      }
      offset = timeZone != null ? timeZone.get('offset') : void 0;
      shift = -this.get('timeZone').get('offset') + offset;
      from = this.get('from');
      to = this.get('to');
      shiftedStartTime = this.get('startTime') + shift;
      shiftedEndTime = this.get('endTime') + shift;
      shiftedStartDate = from.getTime();
      if (shiftedStartTime < 0) {
        shiftedStartDate -= 86400000;
      } else if (shiftedStartTime > 1440) {
        shiftedStartDate += 86400000;
      }
      shiftedEndDate = to.getTime();
      if (shiftedEndTime <= 0) {
        shiftedEndDate -= 86400000;
      } else if (shiftedEndTime > 1440) {
        shiftedEndDate += 86400000;
      }
      shiftedStart = new Date(shiftedStartDate);
      shiftedEnd = new Date(shiftedEndDate);
      return {
        startDate: shiftedStart,
        endDate: shiftedEnd,
        startTime: (shiftedStartTime + 1440) % 1440,
        endTime: ((shiftedEndTime + 1440) % 1440) || 1440,
        getDateRange: function() {
          return new RG.Utils.DateRange(shiftedStart, shiftedEnd);
        },
        getStartDate: function() {
          return shiftedStart;
        },
        getEndDate: function() {
          return shiftedEnd;
        }
      };
    };

    Downtime.prototype.inTimeZone = function(timeZone) {
      var attributes, from, offset, resultDowntime, shift, shiftedDowntime, shiftedEnd, shiftedEndDate, shiftedEndTime, shiftedStart, shiftedStartDate, shiftedStartTime, to;
      offset = timeZone != null ? timeZone.get('offset') : void 0;
      if (this._timeZoneConverted[offset]) {
        return this._timeZoneConverted[offset];
      }
      if (this.isLocalTimeZone()) {
        resultDowntime = new RG.Models.Downtime;
        resultDowntime.attributes = _.clone(this.attributes);
        resultDowntime.id = this.attributes.id;
        return this._timeZoneConverted[offset] = resultDowntime;
      }
      shift = -this.get('timeZone').get('offset') + offset;
      from = this.get('from');
      to = this.get('to');
      shiftedStartTime = this.get('startTime') + shift;
      shiftedEndTime = this.get('endTime') + shift;
      shiftedStartDate = from.getTime();
      if (shiftedStartTime < 0) {
        shiftedStartDate -= 86400000;
      } else if (shiftedStartTime > 1440) {
        shiftedStartDate += 86400000;
      }
      shiftedEndDate = to.getTime();
      if (shiftedEndTime <= 0) {
        shiftedEndDate -= 86400000;
      } else if (shiftedEndTime > 1440) {
        shiftedEndDate += 86400000;
      }
      shiftedStart = new Date(shiftedStartDate);
      shiftedEnd = new Date(shiftedEndDate);
      attributes = {
        id: this.attributes.id,
        timeZone: timeZone,
        downtimeTypeId: this.attributes.downtimeTypeId,
        details: this.attributes.details,
        state: this.attributes.state,
        creatorId: this.attributes.creatorId,
        leave: this.attributes.leave,
        resourceIds: this.attributes.resourceIds,
        downtimeType: this.getDowntimeType(),
        from: shiftedStart,
        to: shiftedEnd,
        updatedAt: this.attributes.updatedAt,
        startTime: ((shiftedStartTime + 1440) % 1440) | 0,
        endTime: (((shiftedEndTime + 1440) % 1440) | 0) || 1440
      };
      shiftedDowntime = new RG.Models.Downtime;
      shiftedDowntime.attributes = attributes;
      shiftedDowntime.id = attributes.id;
      shiftedDowntime.layer = this.layer;
      return this._timeZoneConverted[timeZone] = shiftedDowntime;
    };

    Downtime.prototype.getRawTimeRange = function() {
      return new RG.Utils.TimeRange(this.get('startTime'), this.get('endTime'));
    };

    Downtime.prototype.getTimeRange = function(date) {
      var key;
      key = date.toString();
      if (this._timeRanges[key]) {
        return this._timeRanges[key];
      }
      return this._timeRanges[key] = RG.Utils.DateComparator.equalsYMD(date, this.get('from')) && RG.Utils.DateComparator.equalsYMD(date, this.get('to')) ? new RG.Utils.TimeRange(this.get('startTime'), this.get('endTime')) : RG.Utils.DateComparator.equalsYMD(date, this.get('from')) ? new RG.Utils.TimeRange(this.get('startTime'), 1440) : RG.Utils.DateComparator.equalsYMD(date, this.get('to')) ? new RG.Utils.TimeRange(0, this.get('endTime')) : this.get('from') > date || this.get('to') < date ? new RG.Utils.TimeRange(0, 0) : new RG.Utils.TimeRange(0, 1440);
    };

    Downtime.prototype.getType = function() {
      return this.type();
    };

    Downtime.prototype.getTypeIcon = function() {
      var _ref;
      return (_ref = this.getDowntimeType()) != null ? _ref.typeIcon() : void 0;
    };

    Downtime.prototype.isVacation = function() {
      var _ref;
      return (_ref = this.getDowntimeType()) != null ? _ref.isVacation() : void 0;
    };

    Downtime.prototype.getAllowancePerDay = function(date) {
      return this.getTimeRange(date).getAllowancePerDay();
    };

    Downtime.prototype.getTitleCaption = function() {
      var caption, details;
      caption = [];
      if (this.getType() && this.getType().length) {
        caption.push(this.type());
      }
      if (this.get('details') && this.get('details').length) {
        details = this.get('details').replace(/\n/g, " ").substr(0, 300);
        details = details.length === 300 ? details.substr(0, 297) + "..." : details;
        caption.push(details);
      }
      caption.push(this.getDateTimeString());
      return caption.join(" | ");
    };

    Downtime.prototype.getTimeZone = function() {
      return this.get('timeZone') || RG.Models.NullTimeZone.instance;
    };

    Downtime.prototype.getTimeZoneName = function() {
      return this.getTimeZone().getName();
    };

    Downtime.prototype.getDateTimeString = function(dateFormatter) {
      if (dateFormatter == null) {
        dateFormatter = RG.Utils.DateFormatter.getShortDate;
      }
      return new RG.Utils.DowntimePresenter(this).dateTimeString(dateFormatter);
    };

    Downtime.prototype._getFirstDuration = function() {
      return new RG.Models.Duration({
        date: this.get('from'),
        minutes: 0,
        waiting: false
      });
    };

    Downtime.prototype.getFirstNonZeroDuration = function() {
      return this._getFirstDuration();
    };

    Downtime.prototype._getLastDuration = function() {
      return new RG.Models.Duration({
        date: this.get('to'),
        minutes: 0,
        waiting: false
      });
    };

    Downtime.prototype.isExclusivelyOnWaitingList = function() {
      return false;
    };

    Downtime.prototype.getStartDate = function() {
      return this.attributes.from;
    };

    Downtime.prototype.getEndDate = function() {
      return this.attributes.to;
    };

    Downtime.prototype.getBooker = function() {
      return {
        id: this.get('creatorId')
      };
    };

    Downtime.prototype.getDurations = function(downtime) {
      var date, duration, durations, timeRange, _i, _len, _ref;
      if (downtime == null) {
        downtime = this;
      }
      if (this._durations) {
        return this._durations;
      }
      durations = [];
      _ref = this.getDateRange().getDates();
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        date = _ref[_i];
        timeRange = this.getTimeRange(date);
        duration = new RG.Models.DowntimeDuration({
          startTime: timeRange.startTime,
          endTime: timeRange.endTime,
          date: date
        });
        duration.downtime = downtime;
        durations.push(duration);
      }
      return this._durations = durations;
    };

    Downtime.prototype.addResource = function(resource) {
      var resourceIds;
      resourceIds = this.get('resourceIds');
      if (_.include(resourceIds, resource.id)) {
        return;
      }
      resourceIds.push(resource.id);
      return this.set({
        resourceIds: resourceIds
      });
    };

    Downtime.prototype.removeResource = function(resource) {
      var resourceIds;
      resourceIds = this.get('resourceIds');
      resourceIds = _.reject(resourceIds, function(id) {
        return id === resource.id;
      });
      return this.set({
        resourceIds: resourceIds
      });
    };

    Downtime.prototype.isLocalTimeZone = function() {
      return this.getTimeZone().toString() === '';
    };

    return Downtime;

  })(RG.Models.AbstractTimeAllocation);

}).call(this);
(function() {
  var __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  RG.Models.DowntimeType = (function(_super) {
    __extends(DowntimeType, _super);

    function DowntimeType() {
      return DowntimeType.__super__.constructor.apply(this, arguments);
    }

    DowntimeType.prototype.getName = function() {
      return this.get('name');
    };

    DowntimeType.prototype.isVacation = function() {
      var name;
      name = this.getName();
      return name === RG.Variables.DowntimeType.vacation || name === RG.Variables.DowntimeType.personalHoliday;
    };

    DowntimeType.prototype.isPublicHoliday = function() {
      return this.getName() === RG.Variables.DowntimeType.publicHoliday;
    };

    DowntimeType.prototype.isSick = function() {
      return this.getName() === RG.Variables.DowntimeType.sick;
    };

    DowntimeType.prototype.isMaternity = function() {
      return this.getName() === RG.Variables.DowntimeType.maternity;
    };

    DowntimeType.prototype.isCompassionate = function() {
      return this.getName() === RG.Variables.DowntimeType.compassionate;
    };

    DowntimeType.prototype.typeIcon = function() {
      if (this.isVacation()) {
        return 'rg-icon--vacation';
      } else if (this.isPublicHoliday()) {
        return 'rg-icon--happy';
      } else if (this.isSick()) {
        return 'rg-icon--sick';
      } else if (this.isMaternity()) {
        return 'rg-icon--maternity';
      } else if (this.isCompassionate()) {
        return 'rg-icon--compassionate';
      } else {
        return '';
      }
    };

    return DowntimeType;

  })(RG.Models.Base);

}).call(this);
(function() {
  var __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  RG.Models.Duration = (function(_super) {
    __extends(Duration, _super);

    function Duration() {
      return Duration.__super__.constructor.apply(this, arguments);
    }

    Duration.prototype.getCaption = function() {
      return RG.Utils.TimeFormatter.formatMinutes(this.realMinutes || this.getMinutes());
    };

    Duration.prototype.getMinutes = function() {
      return this.get('minutes');
    };

    Duration.prototype.getRepeatCaption = function() {
      return "p/d";
    };

    Duration.prototype.getLongRepeatCaption = function() {
      return "per day";
    };

    Duration.prototype.startsAfterTime = function(startTime) {
      return false;
    };

    Duration.prototype.endsBeforeTime = function(endTime) {
      return false;
    };

    Duration.prototype.isFixed = function() {
      return false;
    };

    Duration.prototype.getTimeRange = function() {
      return new RG.Utils.TimeRange(0, 0);
    };

    return Duration;

  })(RG.Models.BaseDuration);

}).call(this);
(function() {
  var __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  RG.Models.FilterOption = (function(_super) {
    __extends(FilterOption, _super);

    function FilterOption() {
      return FilterOption.__super__.constructor.apply(this, arguments);
    }

    FilterOption.prototype.getName = function() {
      return this.escape("name");
    };

    return FilterOption;

  })(RG.Models.Base);

}).call(this);
(function() {
  var __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  RG.Models.FixedDuration = (function(_super) {
    __extends(FixedDuration, _super);

    function FixedDuration() {
      return FixedDuration.__super__.constructor.apply(this, arguments);
    }

    FixedDuration.prototype.getCaption = function() {
      return this._getTimeFor(this.get('startTime')) + " - " + this._getTimeFor(this.get('endTime'));
    };

    FixedDuration.prototype.getMinutes = function() {
      return this.attributes.endTime - this.attributes.startTime;
    };

    FixedDuration.prototype.getRepeatCaption = function() {
      return "daily";
    };

    FixedDuration.prototype.getLongRepeatCaption = function() {
      return "every day";
    };

    FixedDuration.prototype._getTimeFor = function(minuteOfDay) {
      return RG.Utils.TimeFormatter.formatFixedTime(minuteOfDay);
    };

    FixedDuration.prototype.isFixed = function() {
      return true;
    };

    FixedDuration.prototype.startsAfterTime = function(endTime) {
      return endTime <= this.get('startTime');
    };

    FixedDuration.prototype.endsBeforeTime = function(startTime) {
      return startTime >= this.get('endTime');
    };

    FixedDuration.prototype.anyClashes = function(durations) {
      return durations.some((function(_this) {
        return function(duration) {
          return _this.clash(duration);
        };
      })(this));
    };

    FixedDuration.prototype.clash = function(other) {
      return this.getTimeRange().overlapsWith(other.getTimeRange());
    };

    FixedDuration.prototype.within = function(ap) {
      return +this.get('startTime') >= +ap.get('startTime') && +this.get('endTime') <= +ap.get('endTime');
    };

    FixedDuration.prototype.getTimeRange = function() {
      return new RG.Utils.TimeRange(this.get('startTime'), this.get('endTime'));
    };

    FixedDuration.prototype._isValidInTimeRange = function(timeRange) {
      return this.getTimeRange().subtractOne(timeRange).length === 0;
    };

    return FixedDuration;

  })(RG.Models.BaseDuration);

  RG.Models.DowntimeDuration = (function(_super) {
    __extends(DowntimeDuration, _super);

    function DowntimeDuration() {
      return DowntimeDuration.__super__.constructor.apply(this, arguments);
    }

    DowntimeDuration.prototype.getLayer = function() {
      return this.downtime.layer;
    };

    return DowntimeDuration;

  })(RG.Models.FixedDuration);

}).call(this);
(function() {
  var __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  RG.Models.HumanResourceInstance = (function(_super) {
    __extends(HumanResourceInstance, _super);

    function HumanResourceInstance() {
      return HumanResourceInstance.__super__.constructor.apply(this, arguments);
    }

    HumanResourceInstance.prototype.hasAvatar = function() {
      var _ref;
      return ((_ref = this.get('imageUrl')) != null ? _ref.indexOf("fallback") : void 0) === -1;
    };

    HumanResourceInstance.prototype.getDowntimeText = function() {
      return "time off";
    };

    HumanResourceInstance.prototype.getHeadingDowntimeText = function() {
      return "Time Off";
    };

    return HumanResourceInstance;

  })(RG.Models.ResourceInstance);

}).call(this);
(function() {
  var __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  RG.Models.NullTimeZone = (function(_super) {
    __extends(NullTimeZone, _super);

    function NullTimeZone() {
      return NullTimeZone.__super__.constructor.apply(this, arguments);
    }

    NullTimeZone.prototype.toString = function() {
      return '';
    };

    NullTimeZone.prototype.getFormattedOffset = function() {
      return '';
    };

    NullTimeZone.prototype.getName = function() {
      return 'NullTimeZone';
    };

    NullTimeZone.prototype.getParamValue = function() {
      return null;
    };

    return NullTimeZone;

  })(RG.Models.TimeZone);

  RG.Models.NullTimeZone.instance = new RG.Models.NullTimeZone;

}).call(this);
(function() {
  var __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  RG.Models.OptionGroup = (function(_super) {
    __extends(OptionGroup, _super);

    function OptionGroup() {
      return OptionGroup.__super__.constructor.apply(this, arguments);
    }

    OptionGroup.prototype.initialize = function(options) {
      this.options = new RG.Collections.FilterOptions;
      return this.options.optionGroup = this;
    };

    OptionGroup.prototype.getName = function() {
      return this.get('name');
    };

    OptionGroup.prototype.getTagId = function() {
      var _ref;
      return (_ref = this.get('tag')) != null ? _ref.id : void 0;
    };

    OptionGroup.prototype.getType = function() {
      var _ref, _ref1;
      return (_ref = this.collection) != null ? (_ref1 = _ref.category) != null ? _ref1.get('name') : void 0 : void 0;
    };

    return OptionGroup;

  })(RG.Models.Base);

}).call(this);
(function() {
  var __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  RG.Models.Overtime = (function(_super) {
    __extends(Overtime, _super);

    function Overtime() {
      return Overtime.__super__.constructor.apply(this, arguments);
    }

    Overtime.prototype.getMinutesAvailable = function() {
      return this.get('duration');
    };

    return Overtime;

  })(RG.Models.CustomAvailablePeriod);

}).call(this);
(function() {
  var __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  RG.Models.ResourceType = (function(_super) {
    __extends(ResourceType, _super);

    function ResourceType() {
      return ResourceType.__super__.constructor.apply(this, arguments);
    }

    ResourceType.prototype.initialize = function() {
      this.customFields = new RG.Collections.CustomFields;
      return this.customFields.resourceType = this;
    };

    ResourceType.prototype.getName = function() {
      return this.attributes.name;
    };

    return ResourceType;

  })(RG.Models.Base);

}).call(this);
(function() {
  var __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  RG.Collections.Base = (function(_super) {
    __extends(Base, _super);

    function Base(models, options) {
      if (options) {
        this.model = options.model;
      }
      this._reset();
      this.initialize.apply(this, arguments);
      if (models) {
        this.reset(models, {
          silent: true
        });
      }
    }

    Base.prototype.setModels = function(array) {
      return this.reset(array);
    };

    return Base;

  })(Backbone.Collection);

}).call(this);
(function() {
  var __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  RG.Collections.AbstractTimePeriods = (function(_super) {
    __extends(AbstractTimePeriods, _super);

    function AbstractTimePeriods() {
      return AbstractTimePeriods.__super__.constructor.apply(this, arguments);
    }

    AbstractTimePeriods.prototype.calculator = function() {
      return this.calc != null ? this.calc : this.calc = new RG.Utils.TimePeriodsCalculator(this);
    };

    AbstractTimePeriods.prototype.getMinutesAvailableInDateRange = function(dateRange) {
      return this.calculator().availableMinutes(dateRange);
    };

    AbstractTimePeriods.prototype.removeForDate = function(date) {
      throw "Implement removeForDate in subclasses";
    };

    return AbstractTimePeriods;

  })(RG.Collections.Base);

}).call(this);
(function() {
  var __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  RG.Collections.AvailablePeriods = (function(_super) {
    __extends(AvailablePeriods, _super);

    function AvailablePeriods() {
      return AvailablePeriods.__super__.constructor.apply(this, arguments);
    }

    return AvailablePeriods;

  })(RG.Collections.AbstractTimePeriods);

}).call(this);
(function() {
  var __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  RG.Collections.Bookers = (function(_super) {
    __extends(Bookers, _super);

    function Bookers() {
      return Bookers.__super__.constructor.apply(this, arguments);
    }

    Bookers.prototype.comparator = function(b) {
      return b.get('name');
    };

    return Bookers;

  })(Backbone.Collection);

}).call(this);
(function() {
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  RG.Collections.Bookings = (function(_super) {
    __extends(Bookings, _super);

    function Bookings() {
      this.predictWaitingList = __bind(this.predictWaitingList, this);
      return Bookings.__super__.constructor.apply(this, arguments);
    }

    Bookings.prototype.initialize = function(options) {
      Bookings.__super__.initialize.apply(this, arguments);
      this._forDateDurations = {};
      this._overlapsDateBookings = {};
      return this.on('add remove reset change', (function(_this) {
        return function() {
          _this._forDateDurations = {};
          return _this._overlapsDateBookings = {};
        };
      })(this));
    };

    Bookings.prototype.forDate = function(date) {
      var booking, bookings, dateRange, _i, _len, _ref;
      bookings = [];
      _ref = this.models;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        booking = _ref[_i];
        dateRange = booking.getDateRange();
        if (dateRange.isValid() && dateRange.includes(date)) {
          bookings.push(booking);
        }
      }
      return bookings;
    };

    Bookings.prototype.startsOnDate = function(date) {
      var booking, bookings, _i, _len, _ref;
      bookings = [];
      _ref = this.forDate(date);
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        booking = _ref[_i];
        if (RG.Utils.DateComparator.equalsYMD(date, booking.getDateRange().startDate)) {
          bookings.push(booking);
        }
      }
      return bookings;
    };

    Bookings.prototype.overlapsDate = function(date) {
      var key;
      key = date.toString();
      if (this._overlapsDateBookings[key]) {
        return this._overlapsDateBookings[key];
      }
      return this._overlapsDateBookings[key] = this.filter(function(booking) {
        var dateRange;
        dateRange = booking.getDateRange();
        return dateRange.startDate < date && dateRange.endDate >= date;
      });
    };

    Bookings.prototype.getDurationsForDate = function(date) {
      var b, bookings, d, durations, key, _i, _j, _len, _len1, _ref;
      key = date.getTime();
      if (this._forDateDurations[key]) {
        return this._forDateDurations[key];
      }
      bookings = this.forDate(date);
      durations = [];
      for (_i = 0, _len = bookings.length; _i < _len; _i++) {
        b = bookings[_i];
        _ref = b.durations.models;
        for (_j = 0, _len1 = _ref.length; _j < _len1; _j++) {
          d = _ref[_j];
          if (RG.Utils.DateComparator.equalsYMD(d.attributes.date, date)) {
            durations.push(d);
          }
        }
      }
      return this._forDateDurations[key] = durations;
    };

    Bookings.prototype.predictWaitingList = function() {
      this.models.forEach((function(_this) {
        return function(b) {
          return RG.renderer.enqueue(new RG.Renderer.ResourceDateLock(_this.resource, b.getStartDate(), b.getEndDate()), function() {
            return b.durations.predictWaitingList();
          });
        };
      })(this));
      return RG.resizeCards();
    };

    Bookings.prototype.getLayerCount = function() {
      var layer;
      layer = this.map(function(b) {
        return b.layer;
      }).max();
      if (layer >= 0) {
        return layer + 1;
      } else {
        return 0;
      }
    };

    return Bookings;

  })(RG.Collections.Base);

}).call(this);
(function() {
  var __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  RG.Collections.CustomAvailablePeriods = (function(_super) {
    __extends(CustomAvailablePeriods, _super);

    function CustomAvailablePeriods() {
      return CustomAvailablePeriods.__super__.constructor.apply(this, arguments);
    }

    CustomAvailablePeriods.prototype.removeForDate = function(date) {
      var models;
      models = this.select((function(_this) {
        return function(cap) {
          return RG.Utils.DateComparator.equalsYMD(cap.get('date'), date);
        };
      })(this));
      return this.remove(models, {
        silent: true
      });
    };

    return CustomAvailablePeriods;

  })(RG.Collections.AbstractTimePeriods);

}).call(this);
(function() {
  var __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  RG.Collections.CustomFieldOptions = (function(_super) {
    __extends(CustomFieldOptions, _super);

    function CustomFieldOptions() {
      return CustomFieldOptions.__super__.constructor.apply(this, arguments);
    }

    return CustomFieldOptions;

  })(Backbone.Collection);

}).call(this);
(function() {
  var __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  RG.Collections.CustomFields = (function(_super) {
    __extends(CustomFields, _super);

    function CustomFields() {
      return CustomFields.__super__.constructor.apply(this, arguments);
    }

    return CustomFields;

  })(Backbone.Collection);

}).call(this);
(function() {
  var __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  RG.Collections.DowntimeTypes = (function(_super) {
    __extends(DowntimeTypes, _super);

    function DowntimeTypes() {
      return DowntimeTypes.__super__.constructor.apply(this, arguments);
    }

    DowntimeTypes.prototype.model = RG.Models.DowntimeType;

    return DowntimeTypes;

  })(Backbone.Collection);

}).call(this);
(function() {
  var __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  RG.Collections.Downtimes = (function(_super) {
    __extends(Downtimes, _super);

    function Downtimes() {
      return Downtimes.__super__.constructor.apply(this, arguments);
    }

    Downtimes.prototype.model = RG.Models.Downtime;

    Downtimes.prototype.initialize = function(options) {
      Downtimes.__super__.initialize.apply(this, arguments);
      this._forDateDowntimes = {};
      this._overlapsDateDowntimes = {};
      this._forResourceIndex = {};
      this._forDateInTimeZoneIndex = {};
      this.on('add remove reset change', (function(_this) {
        return function() {
          _this._forDateDowntimes = {};
          _this._overlapsDateDowntimes = {};
          _this._forResourceIndex = {};
          return _this._forDateInTimeZoneIndex = {};
        };
      })(this));
      this.on('add', function(d) {
        var rid, _i, _len, _ref, _results;
        if (d && d.get('resourceIds')) {
          _ref = d.get('resourceIds');
          _results = [];
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            rid = _ref[_i];
            _results.push(this.trigger("add:resource_id:" + rid, d));
          }
          return _results;
        }
      });
      return this.on('remove', function(d) {
        var rid, _i, _len, _ref, _results;
        if (d && d.get('resourceIds')) {
          _ref = d.get('resourceIds');
          _results = [];
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            rid = _ref[_i];
            _results.push(this.trigger("remove:resource_id:" + rid, d));
          }
          return _results;
        }
      });
    };

    Downtimes.prototype.forResource = function(resource) {
      var _base, _name;
      return (_base = this._forResourceIndex)[_name = resource.id] != null ? _base[_name] : _base[_name] = this.models.filter(function(downtime) {
        return downtime.get('resourceIds').indexOf(resource.id) !== -1;
      });
    };

    Downtimes.prototype.forYear = function(year) {
      return this.models.filter(function(downtime) {
        return downtime.inYear(year);
      });
    };

    Downtimes.prototype.forDate = function(date) {
      var key;
      key = date.toString();
      if (this._forDateDowntimes[key]) {
        return this._forDateDowntimes[key];
      }
      return this._forDateDowntimes[key] = this.models.filter(function(downtime) {
        return downtime.isValidOn(date);
      });
    };

    Downtimes.prototype.inTimeZone = function(timeZone) {
      var collection, downtimes;
      downtimes = this.models.map(function(downtime) {
        return downtime.inTimeZone(timeZone);
      });
      collection = new RG.Collections.Downtimes;
      collection.models = downtimes;
      collection.length = downtimes.length;
      return collection;
    };

    Downtimes.prototype.forDateInTimeZone = function(date, timeZone) {
      var offset, _base, _name;
      offset = (timeZone != null ? timeZone.attributes.offset : void 0) || -1;
      return (_base = this._forDateInTimeZoneIndex)[_name = [date.valueOf(), offset]] != null ? _base[_name] : _base[_name] = this.models.filter(function(downtime) {
        return downtime.inTimeZone(timeZone).isValidOn(date);
      });
    };

    Downtimes.prototype.durationsForDateInTimeZone = function(date, timeZone) {
      var downtime, duration, durations, _i, _j, _len, _len1, _ref, _ref1;
      durations = [];
      _ref = this.forDateInTimeZone(date, timeZone);
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        downtime = _ref[_i];
        _ref1 = downtime.inTimeZone(timeZone).getDurations(downtime);
        for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
          duration = _ref1[_j];
          if (duration.containsDate(date)) {
            durations.push(duration);
          }
        }
      }
      return durations;
    };

    Downtimes.prototype.startsOnDateInTimeZone = function(date, timeZone) {
      var downtime, downtimes, _i, _len, _ref;
      downtimes = [];
      _ref = this.forDateInTimeZone(date, timeZone);
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        downtime = _ref[_i];
        if (RG.Utils.DateComparator.equalsYMD(date, downtime.inTimeZone(timeZone).getDateRange().startDate)) {
          downtimes.push(downtime);
        }
      }
      return downtimes;
    };

    Downtimes.prototype.startsOnDate = function(date) {
      var downtime, downtimes, _i, _len, _ref;
      downtimes = [];
      _ref = this.forDate(date);
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        downtime = _ref[_i];
        if (RG.Utils.DateComparator.equalsYMD(date, downtime.getDateRange().startDate)) {
          downtimes.push(downtime);
        }
      }
      return downtimes;
    };

    Downtimes.prototype.overlapsDateInTimeZone = function(date, timeZone) {
      var key;
      key = date.toString();
      if (this._overlapsDateDowntimes[key]) {
        return this._overlapsDateDowntimes[key];
      }
      return this._overlapsDateDowntimes[key] = this.filter(function(downtime) {
        var dateRange;
        dateRange = downtime.inTimeZone(timeZone).getDateRange();
        return dateRange.startDate < date && dateRange.endDate >= date;
      });
    };

    Downtimes.prototype.mergedTimeRangesForDate = function(date) {
      var timeRange, timeRanges;
      timeRanges = this.inTimeZone(this.resource.get('timeZone')).forDate(date).map(function(downtime) {
        return downtime.getTimeRange(date);
      });
      if (timeRanges.length < 2) {
        return timeRanges;
      }
      timeRange = timeRanges.pop();
      return timeRange.merge.apply(timeRange, timeRanges);
    };

    return Downtimes;

  })(RG.Collections.Base);

}).call(this);
(function() {
  var __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  RG.Collections.FilterOptions = (function(_super) {
    __extends(FilterOptions, _super);

    function FilterOptions() {
      return FilterOptions.__super__.constructor.apply(this, arguments);
    }

    return FilterOptions;

  })(Backbone.Collection);

}).call(this);
(function() {
  var __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  RG.Collections.Overtimes = (function(_super) {
    __extends(Overtimes, _super);

    function Overtimes() {
      return Overtimes.__super__.constructor.apply(this, arguments);
    }

    Overtimes.prototype.removeForDate = function(date) {
      var overtimes;
      overtimes = this.select(function(overtime) {
        return RG.Utils.DateComparator.equalsYMD(overtime.get('date'), date);
      });
      return this.remove(overtimes, {
        silent: true
      });
    };

    return Overtimes;

  })(RG.Collections.AbstractTimePeriods);

}).call(this);
(function() {
  var __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  RG.Collections.ResourceInstances = (function(_super) {
    __extends(ResourceInstances, _super);

    function ResourceInstances() {
      return ResourceInstances.__super__.constructor.apply(this, arguments);
    }

    ResourceInstances.prototype.model = RG.Models.ResourceInstance;

    ResourceInstances.prototype.comparator = function(ri) {
      var _ref;
      return (_ref = ri.getName()) != null ? _ref.toLowerCase() : void 0;
    };

    ResourceInstances.prototype.setVisibleResources = function(resources) {
      this.models.forEach(function(ri) {
        return ri.visible = false;
      });
      resources.forEach(function(ri) {
        return ri.visible = true;
      });
      return this.trigger('change:visible');
    };

    return ResourceInstances;

  })(RG.Collections.Base);

}).call(this);
(function() {
  var __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  RG.Collections.ResourceTypes = (function(_super) {
    __extends(ResourceTypes, _super);

    function ResourceTypes() {
      return ResourceTypes.__super__.constructor.apply(this, arguments);
    }

    return ResourceTypes;

  })(Backbone.Collection);

}).call(this);
(function() {
  var __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  RG.Collections.TimeZones = (function(_super) {
    __extends(TimeZones, _super);

    function TimeZones() {
      return TimeZones.__super__.constructor.apply(this, arguments);
    }

    TimeZones.prototype.model = RG.Models.TimeZone;

    return TimeZones;

  })(Backbone.Collection);

}).call(this);
(function() {
  RG.Parsers.AvailablePeriodParser = (function() {
    function AvailablePeriodParser(dateStringProcessor) {
      this.dateStringProcessor = dateStringProcessor;
    }

    AvailablePeriodParser.prototype.parse = function(resourceInstance, resource) {
      var ap, apm, aps, _i, _len, _ref;
      aps = [];
      _ref = resource.available_periods;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        ap = _ref[_i];
        apm = new RG.Models.AvailablePeriod({
          weekDay: ap.week_day,
          startTime: ap.start_time,
          endTime: ap.end_time,
          validFrom: this.dateStringProcessor(ap.valid_from)
        });
        if (ap.valid_until) {
          apm.set({
            validUntil: this.dateStringProcessor(ap.valid_until)
          });
        }
        aps.push(apm);
      }
      resourceInstance.availablePeriods.setModels(aps);
      return aps;
    };

    return AvailablePeriodParser;

  })();

}).call(this);
(function() {
  var __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  RG.Parsers.BookerParser = (function() {
    function BookerParser(usersJson, resourcesJson, collection) {
      this.usersJson = usersJson;
      this.resourcesJson = resourcesJson;
      this.collection = collection;
    }

    BookerParser.prototype.parse = function() {
      var activeHumanResources, activeHumanResourcesEmails, bookerModels, u, _i, _len, _ref, _ref1, _ref2;
      activeHumanResources = this.resourcesJson.filter(function(resource) {
        return resource.human === true;
      });
      activeHumanResourcesEmails = activeHumanResources.map(function(resource) {
        return resource.email;
      });
      bookerModels = [];
      _ref = this.usersJson;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        u = _ref[_i];
        bookerModels.push(new RG.Models.Booker({
          id: u.id,
          name: u.first_name + " " + u.last_name,
          imageUrl: u.image,
          color: u.color,
          archived: (_ref1 = u.email, __indexOf.call(activeHumanResourcesEmails, _ref1) < 0)
        }));
      }
      if ((_ref2 = this.collection) != null) {
        _ref2.reset(bookerModels);
      }
      return bookerModels;
    };

    return BookerParser;

  })();

}).call(this);
(function() {
  RG.Parsers.BookingBuilder = (function() {
    function BookingBuilder(dateStringProcessor, durationParser, projects, clients, deletedProjects, deletedClients, bookers, deletedBookers) {
      this.dateStringProcessor = dateStringProcessor;
      this.durationParser = durationParser;
      this.projects = projects;
      this.clients = clients;
      this.deletedProjects = deletedProjects;
      this.deletedClients = deletedClients;
      this.bookers = bookers;
      this.deletedBookers = deletedBookers;
    }

    BookingBuilder.prototype.build = function(booking) {
      var attributes, b, booker, booker_found, c, client_found, deleted_booker, p, project_found, _i, _j, _k, _l, _len, _len1, _len2, _len3, _len4, _len5, _m, _n, _ref, _ref1, _ref2, _ref3, _ref4, _ref5;
      b = new RG.Models.Booking;
      attributes = {
        id: booking.id,
        notes: booking.notes,
        startDate: this.dateStringProcessor(booking.start_date),
        endDate: this.dateStringProcessor(booking.end_date),
        createdAt: new Date(booking.created_at),
        updatedAt: new Date(booking.updated_at),
        refreshable: booking.refreshable
      };
      project_found = false;
      client_found = false;
      if (booking.project_id) {
        _ref = this.projects.models;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          p = _ref[_i];
          if (p.id === booking.project_id) {
            attributes.project = p;
            project_found = true;
            break;
          }
        }
      } else if (booking.client_id) {
        _ref1 = this.clients.models;
        for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
          c = _ref1[_j];
          if (c.id === booking.client_id) {
            attributes.client = c;
            client_found = true;
            break;
          }
        }
      }
      if (!project_found && booking.project_id) {
        _ref2 = this.deletedProjects.models;
        for (_k = 0, _len2 = _ref2.length; _k < _len2; _k++) {
          p = _ref2[_k];
          if (p.id === booking.project_id) {
            attributes.project = p;
            break;
          }
        }
      } else if (!client_found && booking.client_id) {
        _ref3 = this.deletedClients.models;
        for (_l = 0, _len3 = _ref3.length; _l < _len3; _l++) {
          c = _ref3[_l];
          if (c.id === booking.client_id) {
            attributes.client = c;
            break;
          }
        }
      }
      booker_found = false;
      _ref4 = this.bookers.models;
      for (_m = 0, _len4 = _ref4.length; _m < _len4; _m++) {
        booker = _ref4[_m];
        if (booker.id === booking.booker.id) {
          attributes.booker = booker;
          booker_found = true;
          break;
        }
      }
      if (!booker_found) {
        _ref5 = this.deletedBookers.models;
        for (_n = 0, _len5 = _ref5.length; _n < _len5; _n++) {
          deleted_booker = _ref5[_n];
          if (deleted_booker.id === booking.booker.id) {
            attributes.booker = deleted_booker;
            break;
          }
        }
      }
      b.attributes = attributes;
      b.id = attributes.id;
      this.durationParser.parse(b, booking);
      return b;
    };

    return BookingBuilder;

  })();

}).call(this);
(function() {
  RG.Parsers.BookingParser = (function() {
    function BookingParser(bookingsJson, bookingBuilder) {
      this.bookingsJson = bookingsJson;
      this.bookingBuilder = bookingBuilder;
    }

    BookingParser.prototype.parse = function(resourceModels) {
      var booking, bookings, resource, _i, _j, _len, _len1, _ref;
      for (_i = 0, _len = resourceModels.length; _i < _len; _i++) {
        resource = resourceModels[_i];
        bookings = [];
        _ref = this.bookingsJson;
        for (_j = 0, _len1 = _ref.length; _j < _len1; _j++) {
          booking = _ref[_j];
          if (booking.resource_id === resource.id) {
            bookings.push(this.bookingBuilder.build(booking));
          }
        }
        resource.bookings.setModels(bookings);
      }
    };

    return BookingParser;

  })();

}).call(this);
(function() {
  RG.Parsers.ClientParser = (function() {
    function ClientParser(clientsJson, archiveClientsJson, collection) {
      this.clientsJson = clientsJson;
      this.archiveClientsJson = archiveClientsJson;
      this.collection = collection;
    }

    ClientParser.prototype.parse = function() {
      var c, client, clientModels, _i, _j, _len, _len1, _ref, _ref1, _ref2;
      clientModels = [];
      _ref = this.clientsJson;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        client = _ref[_i];
        c = new RG.Models.Client;
        c.attributes = {
          id: client.id,
          name: client.name,
          color: client.color
        };
        c.id = client.id;
        clientModels.push(c);
      }
      _ref1 = this.archiveClientsJson;
      for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
        client = _ref1[_j];
        c = new RG.Models.Client;
        c.attributes = {
          id: client.id,
          name: client.name,
          color: client.color,
          archived: true
        };
        c.id = client.id;
        clientModels.push(c);
      }
      if ((_ref2 = this.collection) != null) {
        _ref2.reset(clientModels);
      }
      return clientModels;
    };

    return ClientParser;

  })();

}).call(this);
(function() {
  RG.Parsers.CustomAvailablePeriodParser = (function() {
    function CustomAvailablePeriodParser(dateStringProcessor) {
      this.dateStringProcessor = dateStringProcessor;
    }

    CustomAvailablePeriodParser.prototype.parse = function(resourceInstance, resource) {
      var ap, apm, aps, _i, _len, _ref;
      aps = [];
      _ref = resource.custom_available_periods;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        ap = _ref[_i];
        apm = new RG.Models.CustomAvailablePeriod({
          date: this.dateStringProcessor(ap.date),
          startTime: ap.start_time,
          endTime: ap.end_time
        });
        aps.push(apm);
      }
      resourceInstance.customAvailablePeriods.setModels(aps);
      return aps;
    };

    return CustomAvailablePeriodParser;

  })();

}).call(this);
(function() {
  RG.Parsers.CustomFieldParser = (function() {
    function CustomFieldParser() {}

    CustomFieldParser.prototype.parse = function(resourceInstance, resource, resourceType) {
      var cf, resourceTypeFields, scf, scfom, _i, _j, _len, _len1, _ref, _results;
      _ref = resource.selected_custom_field_options;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        scf = _ref[_i];
        resourceTypeFields = _.flatten(resourceType.customFields.map(function(cf) {
          return cf.customFieldOptions.models;
        }));
        scfom = null;
        for (_j = 0, _len1 = resourceTypeFields.length; _j < _len1; _j++) {
          cf = resourceTypeFields[_j];
          if (scf.id === cf.id) {
            scfom = cf;
            break;
          }
        }
        _results.push(resourceInstance.customFieldOptions.add(scfom));
      }
      return _results;
    };

    return CustomFieldParser;

  })();

}).call(this);
(function() {
  RG.Utils.CustomFieldParser = (function() {
    function CustomFieldParser() {}

    CustomFieldParser.prototype.parse = function(resourceInstance, resource, resourceType) {
      var cf, resourceTypeFields, scf, scfom, _i, _j, _len, _len1, _ref, _results;
      _ref = resource.selected_custom_field_options;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        scf = _ref[_i];
        resourceTypeFields = _.flatten(resourceType.customFields.map(function(cf) {
          return cf.customFieldOptions.models;
        }));
        scfom = null;
        for (_j = 0, _len1 = resourceTypeFields.length; _j < _len1; _j++) {
          cf = resourceTypeFields[_j];
          if (scf.id === cf.id) {
            scfom = cf;
            break;
          }
        }
        _results.push(resourceInstance.customFieldOptions.add(scfom));
      }
      return _results;
    };

    return CustomFieldParser;

  })();

}).call(this);
(function() {
  RG.Parsers.DeletedBookerParser = (function() {
    function DeletedBookerParser(deletedBookerJson, collection) {
      this.deletedBookerJson = deletedBookerJson;
      this.collection = collection;
    }

    DeletedBookerParser.prototype.parse = function() {
      var bookerModels, u, _i, _len, _ref, _ref1;
      bookerModels = [];
      if (this.deletedBookerJson) {
        _ref = this.deletedBookerJson;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          u = _ref[_i];
          bookerModels.push(new RG.Models.Booker({
            id: u.id,
            name: u.first_name + " " + u.last_name
          }));
        }
        if ((_ref1 = this.collection) != null) {
          _ref1.reset(bookerModels);
        }
      }
      return bookerModels;
    };

    return DeletedBookerParser;

  })();

}).call(this);
(function() {
  RG.Parsers.DeletedClientParser = (function() {
    function DeletedClientParser(deletedClientsJson, collection) {
      this.deletedClientsJson = deletedClientsJson;
      this.collection = collection;
    }

    DeletedClientParser.prototype.parse = function() {
      var client, deletedClients, _i, _len, _ref, _ref1;
      deletedClients = [];
      _ref = this.deletedClientsJson;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        client = _ref[_i];
        deletedClients.push(new RG.Models.Client({
          id: client.id,
          name: client.name,
          color: client.color
        }));
      }
      if ((_ref1 = this.collection) != null) {
        _ref1.reset(deletedClients);
      }
      return deletedClients;
    };

    return DeletedClientParser;

  })();

}).call(this);
(function() {
  RG.Parsers.DeletedProjectParser = (function() {
    function DeletedProjectParser(deletedProjectsJson, clientModels, collection) {
      this.deletedProjectsJson = deletedProjectsJson;
      this.clientModels = clientModels;
      this.collection = collection;
    }

    DeletedProjectParser.prototype.parse = function() {
      var p, project, projectModels, _i, _len, _ref, _ref1;
      projectModels = [];
      _ref = this.deletedProjectsJson;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        p = _ref[_i];
        project = new RG.Models.Project({
          id: p.id,
          name: p.name,
          color: p.color
        });
        if (p.client_id) {
          project.set({
            client: _.find(this.clientModels, function(c) {
              return c.get('id') === p.client_id;
            })
          });
        }
        projectModels.push(project);
      }
      if ((_ref1 = this.collection) != null) {
        _ref1.reset(projectModels);
      }
      return projectModels;
    };

    return DeletedProjectParser;

  })();

}).call(this);
(function() {
  RG.Parsers.DowntimeParser = (function() {
    function DowntimeParser(downtimesJson, dateStringProcessor, collection, timezones, downtimeTypes) {
      this.downtimesJson = downtimesJson;
      this.dateStringProcessor = dateStringProcessor;
      this.collection = collection;
      this.timezones = timezones;
      this.downtimeTypes = downtimeTypes;
    }

    DowntimeParser.prototype.parse = function() {
      var allDowntimeIds, removedDowntimes;
      allDowntimeIds = this.downtimesJson.map(function(c) {
        return c.id;
      });
      removedDowntimes = this.collection.models.filter(function(d) {
        return allDowntimeIds.indexOf(d.id) === -1;
      });
      removedDowntimes.forEach((function(_this) {
        return function(d) {
          var rid, _i, _len, _ref, _results;
          _this.collection.remove(d);
          _ref = d.get('resourceIds');
          _results = [];
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            rid = _ref[_i];
            _results.push(_this.collection.trigger("remove:resource_id:" + rid, d));
          }
          return _results;
        };
      })(this));
      return this.downtimesJson.forEach((function(_this) {
        return function(downtime) {
          var d, downtimeUpdatedAt, isNew, newAttributes, resources, _ref;
          d = _this.collection.findWhere({
            id: downtime.id
          });
          if (!d) {
            isNew = true;
            d = new RG.Models.Downtime;
          }
          downtimeUpdatedAt = _this.dateStringProcessor(downtime.updated_at);
          if (((_ref = d.get('updatedAt')) != null ? _ref.getTime() : void 0) === downtimeUpdatedAt) {
            return;
          }
          newAttributes = {
            id: downtime.id,
            from: _this.dateStringProcessor(downtime.from),
            to: _this.dateStringProcessor(downtime.to),
            updatedAt: _this.dateStringProcessor(downtime.updated_at),
            timeZone: _this.timezones.findWhere({
              name: downtime.timezone
            }),
            startTime: downtime.start_time,
            endTime: downtime.end_time,
            downtimeTypeId: downtime.downtime_type_id,
            details: downtime.details,
            state: downtime.state,
            creatorId: downtime.creator_id,
            leave: downtime.leave,
            resourceIds: downtime.resource_ids,
            downtimeType: _this.downtimeTypes.findWhere({
              id: downtime.downtime_type_id
            })
          };
          resources = window.resources.filter(function(r) {
            return downtime.resource_ids.indexOf(r) !== -1;
          });
          d.id = newAttributes.id;
          return RG.renderer.enqueue(new RG.Renderer.GlobalLock, function() {
            var rid, _i, _len, _ref1, _results;
            if (!isNew && !_.isEqual(newAttributes, d.attributes)) {
              d.set(newAttributes);
            }
            if (isNew) {
              d.attributes = newAttributes;
              _this.collection.add(d);
              _ref1 = downtime.resource_ids;
              _results = [];
              for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
                rid = _ref1[_i];
                _results.push(_this.collection.trigger("add:resource_id:" + rid, d));
              }
              return _results;
            }
          });
        };
      })(this));
    };

    return DowntimeParser;

  })();

}).call(this);
(function() {
  RG.Parsers.DurationParser = (function() {
    function DurationParser(dateStringProcessor) {
      this.dateStringProcessor = dateStringProcessor;
    }

    DurationParser.prototype.parse = function(bookingModel, booking) {
      var d, date, duration, durations, nextDate, prevDate, _i, _len, _ref;
      durations = [];
      prevDate = null;
      _ref = booking.durations;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        duration = _ref[_i];
        date = this.dateStringProcessor(duration.date);
        if (prevDate) {
          while (new RG.Utils.DateRange(date, prevDate).getNumberOfDays() > 1) {
            d = new RG.Models.Duration;
            nextDate = new Date(prevDate);
            nextDate.setDate(nextDate.getDate() + 1);
            d.attributes = {
              date: nextDate,
              minutes: 0,
              waiting: false
            };
            durations.push(d);
            prevDate = new Date(nextDate);
          }
        }
        if (duration.start_time || duration.start_time === 0) {
          d = new RG.Models.FixedDuration;
          d.attributes = {
            date: date,
            startTime: duration.start_time,
            endTime: duration.end_time,
            waiting: duration.waiting
          };
          durations.push(d);
        } else {
          d = new RG.Models.Duration;
          d.attributes = {
            date: date,
            minutes: duration.duration,
            waiting: duration.waiting
          };
          durations.push(d);
        }
        prevDate = date;
      }
      bookingModel.durations.reset(durations);
      return durations;
    };

    return DurationParser;

  })();

}).call(this);
(function() {
  RG.Parsers.OvertimeParser = (function() {
    function OvertimeParser(overtimesJson, dateStringProcessor) {
      this.overtimesJson = overtimesJson;
      this.dateStringProcessor = dateStringProcessor;
    }

    OvertimeParser.prototype.parse = function(resourceInstance, resetOptions) {
      var otimes, overtime, overtimeModel, overtimes, _i, _len;
      if (resetOptions == null) {
        resetOptions = {};
      }
      otimes = [];
      overtimes = this._groupOvertimes()[resourceInstance.id];
      if (!overtimes) {
        return [];
      }
      for (_i = 0, _len = overtimes.length; _i < _len; _i++) {
        overtime = overtimes[_i];
        overtimeModel = new RG.Models.Overtime({
          id: overtime.id,
          resourceInstanceId: overtime.resource_instance_id,
          date: this.dateStringProcessor(overtime.date),
          duration: overtime.duration,
          creatorId: overtime.creator_id
        });
        otimes.push(overtimeModel);
      }
      resourceInstance.overtimes.setModels(otimes, resetOptions);
      return otimes;
    };

    OvertimeParser.prototype._groupOvertimes = function() {
      if (this._groupedOvertimes) {
        return this._groupedOvertimes;
      }
      return this._groupedOvertimes = _.groupBy(this.overtimesJson, 'resource_instance_id');
    };

    return OvertimeParser;

  })();

}).call(this);
(function() {
  RG.Parsers.ProjectParser = (function() {
    function ProjectParser(projectsJson, archivedProjectsJson, clientModels, collection) {
      this.projectsJson = projectsJson;
      this.archivedProjectsJson = archivedProjectsJson;
      this.clientModels = clientModels;
      this.collection = collection;
    }

    ProjectParser.prototype.parse = function() {
      var p, project, projectModels, _i, _j, _len, _len1, _ref, _ref1, _ref2;
      projectModels = [];
      _ref = this.projectsJson;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        p = _ref[_i];
        project = new RG.Models.Project;
        project.attributes = {
          id: p.id,
          name: p.name,
          color: p.color
        };
        if (p.client_id) {
          project.attributes.client = _.find(this.clientModels, function(c) {
            return c.get('id') === p.client_id;
          });
        }
        project.id = p.id;
        projectModels.push(project);
      }
      _ref1 = this.archivedProjectsJson;
      for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
        p = _ref1[_j];
        project = new RG.Models.Project;
        project.attributes = {
          id: p.id,
          name: p.name,
          color: p.color,
          archived: true
        };
        if (p.client_id) {
          project.attributes.client = _.find(this.clientModels, function(c) {
            return c.get('id') === p.client_id;
          });
        }
        project.id = p.id;
        projectModels.push(project);
      }
      if ((_ref2 = this.collection) != null) {
        _ref2.reset(projectModels);
      }
      return projectModels;
    };

    return ProjectParser;

  })();

}).call(this);
(function() {
  RG.Parsers.ResourceParser = (function() {
    function ResourceParser(resourcesJson, collection, options) {
      this.resourcesJson = resourcesJson;
      this.collection = collection;
      _.extend(this, options);
    }

    ResourceParser.prototype.parse = function() {
      var resource, resourceClass, resourceType, ri, rm, _i, _len, _ref, _ref1, _ref2, _ref3, _ref4, _ref5, _ref6, _ref7, _ref8;
      rm = [];
      _ref = this.resourcesJson;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        resource = _ref[_i];
        resourceType = (_ref1 = this.resourceTypes) != null ? _ref1.findWhere({
          id: resource.resource_type.id
        }) : void 0;
        if (resource.resource_type.name === "Person") {
          resourceClass = RG.Models.HumanResourceInstance;
        } else {
          resourceClass = RG.Models.ResourceInstance;
        }
        ri = new resourceClass({
          account: RG.Utils.getCurrentAccount(),
          id: resource.id,
          name: resource.name,
          type: resource.job_title || resource.resource_type.name,
          resourceType: resourceType,
          human: resource.human,
          bookable: resource.bookable,
          vacationAllowance: resource.vacation_allowance,
          imageUrl: resource.image,
          timeZone: new RG.Models.TimeZone({
            name: resource.timezone.name,
            offset: resource.timezone.offset
          }),
          bookedClients: (_ref2 = this.clients) != null ? _ref2.select(function(c) {
            return _.contains(resource.booked_client_ids, c.id);
          }) : void 0,
          bookedProjects: (_ref3 = this.projects) != null ? _ref3.select(function(c) {
            return _.contains(resource.booked_project_ids, c.id);
          }) : void 0
        });
        ri.layerController = new RG.Controllers.TimeAllocationLayers(ri.bookings, ri.downtimes);
        if ((_ref4 = this.availablePeriodParser) != null) {
          _ref4.parse(ri, resource);
        }
        if ((_ref5 = this.customAvailablePeriodParser) != null) {
          _ref5.parse(ri, resource);
        }
        if ((_ref6 = this.overtimeParser) != null) {
          _ref6.parse(ri);
        }
        if ((_ref7 = this.customFieldParser) != null) {
          _ref7.parse(ri, resource, resourceType);
        }
        rm.push(ri);
      }
      if ((_ref8 = this.bookingParser) != null) {
        _ref8.parse(rm);
      }
      window.resources.setModels(rm);
      return rm;
    };

    return ResourceParser;

  })();

}).call(this);
(function() {
  RG.Parsers.ResourceTypeParser = (function() {
    function ResourceTypeParser(resourceTypesJson, collection) {
      this.resourceTypesJson = resourceTypesJson;
      this.collection = collection;
    }

    ResourceTypeParser.prototype.parse = function() {
      var cf, cfm, cfo, cfom, resourceTypeModels, rt, rtm, _i, _j, _k, _len, _len1, _len2, _ref, _ref1, _ref2, _ref3;
      resourceTypeModels = [];
      _ref = this.resourceTypesJson;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        rt = _ref[_i];
        rtm = new RG.Models.ResourceType({
          id: rt.id,
          name: rt.name
        });
        _ref1 = rt.custom_fields;
        for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
          cf = _ref1[_j];
          cfm = new RG.Models.CustomField({
            name: cf.name,
            id: cf.id
          });
          _ref2 = cf.custom_field_options;
          for (_k = 0, _len2 = _ref2.length; _k < _len2; _k++) {
            cfo = _ref2[_k];
            cfom = new RG.Models.CustomFieldOption({
              id: cfo.id,
              name: cfo.value,
              resourceType: rtm,
              customField: cfm
            });
            cfm.customFieldOptions.add(cfom);
          }
          rtm.customFields.add(cfm);
        }
        resourceTypeModels.push(rtm);
      }
      if ((_ref3 = this.collection) != null) {
        _ref3.reset(resourceTypeModels);
      }
      return resourceTypeModels;
    };

    return ResourceTypeParser;

  })();

}).call(this);
(function() {
  RG.Parsers.SavedFilterParser = (function() {
    function SavedFilterParser(savedFiltersJson, collection) {
      this.savedFiltersJson = savedFiltersJson;
      this.collection = collection;
    }

    SavedFilterParser.prototype.parse = function() {
      var savedFilterModels, sf, _i, _len, _ref, _ref1;
      savedFilterModels = [];
      _ref = this.savedFiltersJson;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        sf = _ref[_i];
        savedFilterModels.push(new RG.Models.SavedFilter({
          id: sf.id,
          name: sf.name,
          filter_json: sf.filter_json
        }));
      }
      if ((_ref1 = this.collection) != null) {
        _ref1.reset(savedFilterModels);
      }
      return savedFilterModels;
    };

    return SavedFilterParser;

  })();

}).call(this);
(function() { this.JST || (this.JST = {}); this.JST["templates/dialogs/new_downtime"] = function(obj){var __p=[],print=function(){__p.push.apply(__p,arguments);};with(obj||{}){__p.push('<main>\n  <form class="time-off__form">\n    <dl>\n      <dt class="resource-field required">Resource</dt>\n      <dd class="js-resource-selector downtime-resource"></dd>\n      <div class="downtime-date"></div>\n      <dt>Type</dt>\n      <dd class="downtime-type required" id="downtime-type-options"></dd>\n      <dt class=\'js-timezone-heading required\'></dt>\n      <dd class="js-timezone-selector"></dd>\n      <dt>Details</dt>\n      <dd class="downtime-details optional">\n        <textarea id="downtime-details-value"></textarea>\n      </dd>\n      <dt class="required">Booker</dt>\n      <dd class="booker js-booker"></dd>\n    </dl>\n  </form>\n</main>\n<footer>\n  <button class="btn btn-guru" id="add-downtime">Add Time Off</button>\n  <button class="btn" id="cancel">Cancel</button>\n</footer>\n');}return __p.join('');};
}).call(this);
(function() { this.JST || (this.JST = {}); this.JST["templates/dialogs/new_downtime_header"] = function(obj){var __p=[],print=function(){__p.push.apply(__p,arguments);};with(obj||{}){__p.push('<header>\n  <div class=\'popover__header\'>\n    <h4>\n      <i class="js-downtime-icon rg-icon--vacation"></i><span class=\'js-time-off-header-text\'> New Time Off </span>\n    </h4>\n  </div>\n</header>\n');}return __p.join('');};
}).call(this);
(function() { this.JST || (this.JST = {}); this.JST["templates/dialogs/booking_clash_management"] = function(obj){var __p=[],print=function(){__p.push.apply(__p,arguments);};with(obj||{}){__p.push('<div class="booking-clash">\n  <main>\n    <img src="/assets/smallicon/icon--alert.svg">\n    <h1 class="text--warning">Booking Clash</h1>\n    <p class=\'js-booking-clash-text\'>\n      <span class="js-booking-count"></span> within the date range no longer <span class="js-fit-text"></span> the new schedule. What do you want to do with the bookings?\n    </p>\n  </main>\n  <footer>\n    <button class="btn btn-guru js-add-waiting">Move To Waiting List</button>\n    <button class="btn btn-guru js-delete-bookings">Delete</button>\n    <button class="btn cancel js-cancel">Cancel</button>\n  </footer>\n</div>\n');}return __p.join('');};
}).call(this);
(function() { this.JST || (this.JST = {}); this.JST["templates/filters/match_type"] = function(obj){var __p=[],print=function(){__p.push.apply(__p,arguments);};with(obj||{}){__p.push('<select class="match-type-select">\n  <option value="any">match any</option>\n  <option value="all">match all</option>\n</select>\n');}return __p.join('');};
}).call(this);
(function() { this.JST || (this.JST = {}); this.JST["templates/filters/option_group"] = function(obj){var __p=[],print=function(){__p.push.apply(__p,arguments);};with(obj||{}){__p.push('<div class="filter__options-control">\n  <select class="chzn-select filter-option" multiple></select>\n</div>\n<div class="filter__match-type-control">\n  <div class="match-type"></div>\n</div>\n');}return __p.join('');};
}).call(this);
(function() { this.JST || (this.JST = {}); this.JST["templates/downtimes/resource_selector"] = function(obj){var __p=[],print=function(){__p.push.apply(__p,arguments);};with(obj||{}){__p.push('<div class="filter__options-control">\n  <select class="chzn-select filter-option" multiple></select>\n</div>\n<span class="help-inline error" visibility="hidden">Please select at least one resource.</span>\n');}return __p.join('');};
}).call(this);
(function() { this.JST || (this.JST = {}); this.JST["templates/dialogs/popover"] = function(obj){var __p=[],print=function(){__p.push.apply(__p,arguments);};with(obj||{}){__p.push('<div class="f-dropdown copy-availability-dropdown ',  cssClass ,'" data-dropdown-content aria-hidden="true" aria-autoclose="false" tabindex="-1">\n  <span class="shadow-arrow"></span>\n  <div class="dropdown-content">\n  </div>\n</div>\n');}return __p.join('');};
}).call(this);
(function() { this.JST || (this.JST = {}); this.JST["templates/filters/quick_search_menu"] = function(obj){var __p=[],print=function(){__p.push.apply(__p,arguments);};with(obj||{}){__p.push('<div class="js-menu-cog time-off-resource__menu">\n  <a class="dropdown-toggle">\n    <i class="rg-ion-gear-a"> </i>\n  </a>\n  <ul class="dropdown-menu js-menu-options" style="position: relative;">\n    <li>\n      <a class="js-currently-filtered">Currently filtered</a>\n    </li>\n    <li>\n      <a class="js-all-people">All people</a>\n    </li>\n    <li>\n      <a class="js-all-resources">All resources</a>\n    </li>\n    <li>\n      <a class="js-clear-resources">Clear</a>\n    </li>\n  </ul>\n</div>\n');}return __p.join('');};
}).call(this);
(function() { this.JST || (this.JST = {}); this.JST["templates/selectors/date_range"] = function(obj){var __p=[],print=function(){__p.push.apply(__p,arguments);};with(obj||{}){__p.push('<span>\n  <input type="text" id="booking-start-date" class="js-date-range-input" autocomplete="off">\n</span>\n<span class="dash">to</span>\n<span>\n  <input type="text" id="booking-end-date" class="js-date-range-input" autocomplete="off">\n</span>\n<div class="help-inline error">Please select a start and end date.</div>\n');}return __p.join('');};
}).call(this);
(function() { this.JST || (this.JST = {}); this.JST["templates/selectors/date_time_range"] = function(obj){var __p=[],print=function(){__p.push.apply(__p,arguments);};with(obj||{}){__p.push('<dt class="required">From</dt>\n<dd>\n  <span>\n    <input type="text" id="booking-start-date" class="js-date-range-input" autocomplete="off">\n    <input type="text" id="booking-start-time" class="js-time-range-input" autocomplete="off">\n  </span>\n</dd>\n<dt class="required">To</dt>\n<dd>\n  <span>\n    <input type="text" id="booking-end-date" class="js-date-range-input" autocomplete="off">\n    <input type="text" id="booking-end-time" class="js-time-range-input" autocomplete="off">\n  </span>\n  <div class="help-inline error">Validation message</div>\n</dd>\n');}return __p.join('');};
}).call(this);
(function() { this.JST || (this.JST = {}); this.JST["templates/selectors/time_range"] = function(obj){var __p=[],print=function(){__p.push.apply(__p,arguments);};with(obj||{}){__p.push('<span>\n  <input type="text" id="booking-start-time" class="js-time-range-input" autocomplete="off">\n</span>\n<span class="dash">to</span>\n<span>\n  <input type="text" id="booking-end-time" class="js-time-range-input" autocomplete="off">\n</span>\n<span class="alt-toggle">or <a href="#" class="book-duration-type-toggle">Book hours per day</a></span>\n<div>\n  <span class="help-inline error">Please select a valid start and end time.</span>\n</div>\n');}return __p.join('');};
}).call(this);
(function() {
  var __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  RG.Views.Dialogs.NewDowntime = (function(_super) {
    __extends(NewDowntime, _super);

    function NewDowntime() {
      return NewDowntime.__super__.constructor.apply(this, arguments);
    }

    NewDowntime.prototype.template = JST['templates/dialogs/new_downtime'];

    NewDowntime.prototype.headerTemplate = JST['templates/dialogs/new_downtime_header'];

    NewDowntime.prototype.initialize = function(options) {
      this.currentUserId = options.currentUserId;
      this.resourceSelector = options.resourceSelector;
      this.resources = options.resources;
      this.resource = options.resource;
      this.interactedResource = options.resource;
      this.selectedResources = [this.resource];
      this.account = this.resource.account;
      this.bookers = options.bookers;
      this.dateRange = options.dateRange;
      this.timeRange = options.timeRange || new RG.Utils.TimeRange(0, 1440);
      this.downtimeTypes = options.downtimeTypes;
      this.timeZones = options.timeZones;
      this.currentUserTimeZone = options.currentUserTimeZone;
      this.successCallback = options.successCallback;
      this.renderHeader = options.renderHeader;
      return this.spinnerAttachToEl = options.spinnerAttachToEl;
    };

    NewDowntime.prototype.close = function() {
      if (typeof e !== "undefined" && e !== null) {
        e.stopPropagation();
      }
      return this.trigger("close");
    };

    NewDowntime.prototype.remove = function() {
      var _ref, _ref1, _ref2, _ref3;
      if ((_ref = this.resourceSelector) != null) {
        _ref.remove();
      }
      if ((_ref1 = this.dateTimeRangeSelector) != null) {
        _ref1.remove();
      }
      if ((_ref2 = this.downtimeTypeSelector) != null) {
        _ref2.remove();
      }
      if ((_ref3 = this.vacationAllowance) != null) {
        _ref3.remove();
      }
      return NewDowntime.__super__.remove.apply(this, arguments);
    };

    NewDowntime.prototype.render = function() {
      var html;
      html = [];
      if (this.renderHeader) {
        html.push(this.headerTemplate());
      }
      html.push(this.template());
      this.$el.html(html.join(""));
      this._fillValues();
      this._bindEvents();
      return this;
    };

    NewDowntime.prototype._bindEvents = function() {
      this.$el.on("click", ".chzn-single", (function(_this) {
        return function(e) {
          return _this.trigger("shrinkDropdown", e);
        };
      })(this));
      this.$el.on("click", (function(_this) {
        return function(e) {
          var _ref;
          if (!$(e.target).hasClass('js-tooltip')) {
            return (_ref = _this.vacationAllowance) != null ? _ref.closeAllPopovers() : void 0;
          }
        };
      })(this));
      this.$el.on("click", "#cancel", (function(_this) {
        return function(e) {
          e.preventDefault();
          e.stopPropagation();
          return _this.close();
        };
      })(this));
      this.$el.on("click", "#add-downtime", (function(_this) {
        return function(e) {
          _this.resourceSelector.searchBlur();
          return Q.delay(15).then(function() {
            e.preventDefault();
            e.stopPropagation();
            return _this.createDowntime();
          });
        };
      })(this));
      this.$el.on("click", (function(_this) {
        return function() {
          _this.$('.js-menu-options').hide();
          RG.Utils.select2Close($(".select2-drop"), true);
          return _this.resourceSelector.searchBlur();
        };
      })(this));
      this.resourceSelector.on('change:filter', (function(_this) {
        return function() {
          _this.selectedResources = _this._getResources();
          _this.resource = _this.selectedResources[0];
          return _this._composeTimezoneSelector();
        };
      })(this));
      return this.dateTimeRangeSelector.on('change', (function(_this) {
        return function(dateRange, timeRange) {
          _this.dateRange = dateRange;
          _this.timeRange = timeRange;
          return _this.trigger('change', dateRange);
        };
      })(this));
    };

    NewDowntime.prototype.validate = function() {
      var flag;
      flag = true;
      if (this.timeZoneSelector) {
        flag = this.dateTimeRangeSelector.validate() & this.timeZoneSelector.validate() & this.resourceSelector.validate();
      } else {
        flag = this.dateTimeRangeSelector.validate() & this.resourceSelector.validate();
      }
      this.trigger('validate');
      return flag;
    };

    NewDowntime.prototype._adjustOverlayForDashboard = function(overlay) {
      var spinner;
      overlay.$el.css({
        left: "-488px",
        top: "14px"
      });
      spinner = overlay.$el.find(".spinner");
      return spinner.css({
        top: "50%",
        left: "50%"
      });
    };

    NewDowntime.prototype.createDowntime = function() {
      var overlay, spinnerAttachToEl;
      spinnerAttachToEl = $(this.spinnerAttachToEl)[0] || $(this.el).closest('.js-booking-downtime-new')[0];
      overlay = RG.Utils.spinnerOverlay(spinnerAttachToEl);
      if (this.spinnerAttachToEl) {
        this._adjustOverlayForDashboard(overlay);
      }
      return Q.delay(20).then((function(_this) {
        return function() {
          var command, dateTimeRange, resources;
          dateTimeRange = _this.dateTimeRangeSelector.getValues();
          resources = _this._getResources();
          if (!_.any(resources, function(r) {
            return _this.interactedResource.id === r.id;
          })) {
            _this.interactedResource = _this.resource;
          }
          if (_this.validate()) {
            _this.rendererLock = new RG.Renderer.GlobalLock;
            RG.renderer.lock(_this.rendererLock);
            command = new RG.Commands.CreateDowntimeCommand({
              account: _this.resource.account,
              resources: _this._getResources(),
              booker: _this._getBooker(),
              dateTimeRange: dateTimeRange,
              details: _this._getDetails(),
              timeZones: _this.timeZones,
              timeZone: _this._getTimeZone(),
              type: _this._getType(),
              preExecuteCallback: function(downtime, durations, shouldDelete) {
                return RG.renderer.unlock(_this.rendererLock);
              },
              successCallback: function(downtime) {
                RG.renderer.unlock(_this.rendererLock);
                window.update().then(function() {
                  RG.Popovers.popoverActive = false;
                  return RG.Popovers.done();
                });
                return typeof _this.successCallback === "function" ? _this.successCallback() : void 0;
              },
              errorCallback: function(data) {
                RG.renderer.unlock(_this.rendererLock);
                overlay.close();
                _this.optionView = new RG.Views.Dialogs.ErrorList({
                  errors: data
                });
                return _this.trigger('changeOverlay', _this.optionView, {
                  className: 'overlay availability-waiting'
                });
              }
            });
            return Q.delay(50).then(function() {
              return command.willTouchBookings({
                success: function(bookingsCount) {
                  var cancelCallback;
                  cancelCallback = function() {
                    RG.renderer.unlock(_this.rendererLock);
                    RG.Popovers.removeCallback = null;
                    return _this.account.downtimes.remove(command.downtime);
                  };
                  _this.optionView = new RG.Views.Dialogs.BookingClashManagement({
                    command: command,
                    clashBookingsCount: bookingsCount,
                    cancelCallback: cancelCallback,
                    successCallback: function() {
                      RG.renderer.unlock(_this.rendererLock);
                      return RG.Popovers.removeCallback = null;
                    },
                    userPermissions: RG.Utils.Permissions
                  });
                  overlay.close();
                  _this.trigger('changeOverlay', _this.optionView, {
                    className: 'overlay availability-waiting'
                  });
                  return RG.Popovers.removeCallback = cancelCallback;
                },
                fail: function() {
                  RG.renderer.unlock(_this.rendererLock);
                  return command.execute();
                }
              });
            });
          } else {
            return overlay.close();
          }
        };
      })(this));
    };

    NewDowntime.prototype._getResourceIds = function() {
      return this.resourceSelector.getResourceIds();
    };

    NewDowntime.prototype._getResources = function() {
      var resourceIds;
      resourceIds = this.resourceSelector.getResourceIds();
      return this.resources.models.filter(function(r) {
        return resourceIds.indexOf(r.id) !== -1;
      });
    };

    NewDowntime.prototype._getBooker = function() {
      return this.bookerSelector.getBooker();
    };

    NewDowntime.prototype._getDetails = function() {
      return this.$('#downtime-details-value').val();
    };

    NewDowntime.prototype._getLeave = function() {
      var data;
      data = {};
      _.each(this.$('.js-vacation-allowance input'), function(input) {
        return data[$(input).attr('data-attribute-year')] = $(input).val();
      });
      return data;
    };

    NewDowntime.prototype._getTimeZone = function() {
      var timeZone, _ref;
      timeZone = (_ref = this.timeZoneSelector) != null ? _ref.getTimeZone() : void 0;
      if (timeZone === "NullTimeZone") {
        timeZone = "";
      }
      return timeZone;
    };

    NewDowntime.prototype._getType = function() {
      var id;
      id = this.$("#downtime-type-options select").val();
      id = (id !== void 0 && id.length && +id) || null;
      return this.downtimeTypes.findWhere({
        id: id
      });
    };

    NewDowntime.prototype._fillValues = function() {
      var booker, dateTimeRange, _ref;
      this._composeResourceSelector();
      this._composeDateRangeSelector();
      this._composeDownTimeTypes();
      this._composeTimezoneSelector();
      booker = this.bookers.find({
        id: (_ref = this.downtime) != null ? _ref.getBooker().id : void 0
      });
      this.bookerSelector = new RG.Views.Selectors.Booker({
        currentUserId: (booker != null ? booker.id : void 0) || this.currentUserId,
        bookers: this.bookers,
        booker: booker
      });
      this.$("dd.js-booker").html(this.bookerSelector.render().el);
      this.$(this.bookerSelector.el).find("select").chosen();
      this.$(this.downtimeTypeSelector.el).chosen();
      dateTimeRange = this.dateTimeRangeSelector.getValues();
      this.timeRange = dateTimeRange.timeRange;
      this.dateRange = dateTimeRange.dateRange;
      return this.$('#add-downtime').text("Add " + (this.resource.getHeadingDowntimeText()));
    };

    NewDowntime.prototype._composeResourceSelector = function() {
      this.$('.js-resource-selector').html(this.resourceSelector.render().el);
      return this.resourceSelector.setFilters([
        {
          categoryName: 'Person',
          options: [
            {
              matchType: 'any',
              name: 'Name',
              selectedOptions: [this.resource.id]
            }
          ]
        }
      ]);
    };

    NewDowntime.prototype._composeDateRangeSelector = function() {
      var dateRange;
      this.dateTimeRangeSelector = new RG.Views.Selectors.DateTimeRange({
        resource: this.resource,
        dateRange: this.dateRange,
        timeRange: this.timeRange,
        customValidations: new RG.Validators.DowntimeLengthValidator().validate
      });
      this.dateTimeRangeSelector.on("validate", (function(_this) {
        return function() {
          return _this.trigger("validate");
        };
      })(this));
      dateRange = this.$(".downtime-date");
      return dateRange.html(this.dateTimeRangeSelector.render().el);
    };

    NewDowntime.prototype._composeDownTimeTypes = function() {
      this.downtimeTypeSelector = new RG.Views.Selectors.DowntimeTypeSelector({
        downtimeTypes: this.downtimeTypes
      });
      return this.$("#downtime-type-options").append(this.downtimeTypeSelector.render().el);
    };

    NewDowntime.prototype._composeTimezoneSelector = function() {
      var _ref;
      if ((_ref = this.timeZoneSelector) != null) {
        _ref.remove();
      }
      this.timeZoneSelector = null;
      if (this._isDifferentTimeZones()) {
        this.$("dd.js-timezone-selector").show();
        this.$('.js-timezone-heading').text('Timezone').show();
        this.timeZoneSelector = new RG.Views.Selectors.TimeZoneSelector({
          currentUserTimeZone: this.currentUserTimeZone,
          selectedOption: this.selectedTimeZoneOption,
          timeZones: this.timeZones
        });
        this.$("dd.js-timezone-selector").html(this.timeZoneSelector.render().el);
        return this.$(this.timeZoneSelector.el).find('select').chosen({
          width: "100%"
        });
      } else {
        this.$("dd.js-timezone-selector").hide();
        return this.$('.js-timezone-heading').empty().hide();
      }
    };

    NewDowntime.prototype._selectedDowntimeType = function() {
      var _ref;
      return (_ref = this.downtimeTypes.findWhere({
        id: +this.downtimeTypeSelector.$el.val()
      })) != null ? _ref.get('name') : void 0;
    };

    NewDowntime.prototype._isDifferentTimeZones = function() {
      return RG.Utils.isDifferentTimeZones(this.selectedResources, this.currentUserTimeZone);
    };

    return NewDowntime;

  })(RG.Views.BaseView);

}).call(this);
(function() {
  var __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  RG.Views.Dialogs.Popover = (function(_super) {
    __extends(Popover, _super);

    function Popover() {
      return Popover.__super__.constructor.apply(this, arguments);
    }

    Popover.prototype.baseTemplate = JST["templates/dialogs/popover"];

    Popover.prototype.spinnerOptions = RG.Utils.spinnerOptions;

    Popover.prototype.initialize = function(options) {
      this.$el.on("click", (function(_this) {
        return function(e) {
          _this._closeOpenDropdowns(e);
          RG.Popovers.clearNest();
          return e.stopPropagation();
        };
      })(this));
      this.attachTo = options.attachTo;
      this.bodyView = options.body;
      this.callback = options.callback;
      this.cssClass = options.cssClass || this.cssClass || this.cid;
      this.$el.addClass(options.className);
      this.removeAttachTo = options.removeAttachTo;
      return this._debouncedSetPosition = _.debounce((function(_this) {
        return function() {
          return _this.setPosition({
            animate: false
          });
        };
      })(this), 50);
    };

    Popover.prototype.render = function() {
      this.$el.html(this.baseTemplate({
        cssClass: this.cssClass
      }));
      this._fillValues();
      return this;
    };

    Popover.prototype._closeOpenDropdowns = function(e) {
      var _ref;
      return (_ref = this.$el.find(".open")) != null ? _ref.removeClass("open") : void 0;
    };

    Popover.prototype.remove = function() {
      var _ref, _ref1;
      $(window).off("resize", this._debouncedSetPosition);
      if (this.removeAttachTo) {
        $(this.attachTo).remove();
      }
      if ((_ref = this.overlay) != null) {
        _ref.remove();
      }
      if ((_ref1 = this.bodyView) != null) {
        _ref1.remove();
      }
      if (typeof this.callback === "function") {
        this.callback();
      }
      if ($(".dropdown-content").length === 0) {
        RG.Utils.enableScrolling(true);
      }
      return Popover.__super__.remove.apply(this, arguments);
    };

    Popover.prototype.popup = function() {
      var $attachTo;
      RG.closeAllSelections();
      this.render();
      $attachTo = $(this.attachTo);
      $attachTo.append(this.el);
      this.setPosition();
      $(window).on("resize", this._debouncedSetPosition);
      return RG.Popovers.locked = false;
    };

    Popover.prototype.setBodyView = function(view, options) {
      var content;
      if (options == null) {
        options = {
          render: true
        };
      }
      if (this.removeFunc == null) {
        this.removeFunc = (function(_this) {
          return function() {
            _this.remove();
            return RG.Popovers.popoverActive = false;
          };
        })(this);
      }
      if (this.bodyView) {
        this.bodyView.remove();
      }
      this.bodyView = view;
      content = this._getContentPanel();
      while (content != null ? content.firstChild : void 0) {
        content.removeChild(content.firstChild);
      }
      if (options.className) {
        this.$el.addClass(options.className);
      }
      if (options.render) {
        this.bodyView.render();
      }
      if (content) {
        content.appendChild(this.bodyView.el);
      } else {
        this.render();
      }
      this.bodyView.on("shrinkDropdown", (function(_this) {
        return function(el) {
          return _this.shrinkDropdown(el);
        };
      })(this));
      this.bodyView.on("hide", (function(_this) {
        return function() {
          return _this.$el.hide();
        };
      })(this));
      this.bodyView.on("show", (function(_this) {
        return function() {
          return _this.$el.show();
        };
      })(this));
      this.bodyView.on("close", this.removeFunc);
      this.bodyView.on("changeView", this.setBodyView, this, options);
      this.bodyView.on("changeOverlay", this.setOverlay, this);
      this.bodyView.on("changeView", this.setPosition, this);
      return this.bodyView.on("updatePosition", this._updateAndReposition, this);
    };

    Popover.prototype._updateAndReposition = function() {
      return window.requestAnimationFrame((function(_this) {
        return function() {
          _this.setPosition();
          return $(window).trigger('scroll');
        };
      })(this));
    };

    Popover.prototype._getContentPanel = function() {
      return this.el.querySelector(".dropdown-content");
    };

    Popover.prototype.setPosition = function(_arg) {
      var animate, baseTopOffset, contentHeight, main, offset, scrollable, shadowMargin, shadowTopOffset, windowBottom;
      animate = (_arg != null ? _arg : {
        animate: true
      }).animate;
      this.$el.css('visibility', 'visible');
      this.$(".shadow-arrow").css({
        top: ""
      });
      this.$el.css({
        top: "",
        left: ""
      });
      this.$(".f-dropdown").removeClass("cdrop-left").removeClass("cdrop-right");
      this.$(".f-dropdown .dropdown-content").css({
        "max-height": $(window).height()
      });
      this.$(".f-dropdown .dropdown-content main").css({
        "max-height": $(window).height() - this.$(".f-dropdown .dropdown-content header, .f-dropdown .dropdown-content .tabs").height() - 130
      });
      this._setOpenDirection();
      baseTopOffset = -20;
      offset = this.$el.offset();
      windowBottom = $(window).scrollTop() + $(window).height();
      shadowMargin = parseInt(this.$(".shadow-arrow").css("margin-top"), 10);
      if (offset.top + shadowMargin > windowBottom - 40) {
        $(window).scrollTop($(window).scrollTop() + 40 + shadowMargin + offset.top - windowBottom);
      }
      windowBottom = $(window).scrollTop() + $(window).height();
      contentHeight = this.$el.children(0).outerHeight();
      if (windowBottom - contentHeight - $(window).scrollTop() - 20 < 0) {
        baseTopOffset = -offset.top + $(window).scrollTop() + 60;
      } else {
        baseTopOffset = _.min([-20, -(offset.top + contentHeight - windowBottom) + 20]);
      }
      shadowTopOffset = -baseTopOffset + 10;
      this.$(".shadow-arrow").css({
        top: shadowTopOffset
      });
      this.$el.css({
        position: 'absolute',
        top: baseTopOffset
      });
      this._scrollIntoHorizontalView(animate);
      main = this.el.querySelector(".f-dropdown .dropdown-content main");
      scrollable = !!(main && main.scrollHeight > main.offsetHeight) && main.querySelectorAll(".chzn-drop").length === 0;
      this.$el.toggleClass("is-scrollable", scrollable);
    };

    Popover.prototype.setOverlay = function(view, options) {
      var removeFunc, removeOverlayClassFunc, _ref;
      if (options == null) {
        options = {
          className: 'overlay'
        };
      }
      removeOverlayClassFunc = (function(_this) {
        return function() {
          return _this.$el.removeClass("has-overlay");
        };
      })(this);
      removeFunc = function() {
        removeOverlayClassFunc();
        return typeof options.removeCallback === "function" ? options.removeCallback() : void 0;
      };
      if ((_ref = this.overlay) != null) {
        _ref.remove();
      }
      this.overlay = new RG.Views.Dialogs.Overlay({
        attachTo: this.el,
        template: function() {
          return view.render().el;
        },
        className: options.className,
        removeCallback: removeFunc,
        bodyView: view
      });
      this.overlay.render();
      return this.$el.addClass("has-overlay");
    };

    Popover.prototype._fillValues = function() {
      if (this.bodyView) {
        return this.setBodyView(this.bodyView);
      }
    };

    Popover.prototype._setOpenDirection = function() {
      var droppingLeft, _ref;
      droppingLeft = this._getOpenDirection() === "left";
      if (droppingLeft) {
        this._setOpenLeft();
      } else {
        this._setOpenRight();
      }
      return (_ref = this.attachTo) != null ? typeof _ref.callback === "function" ? _ref.callback(false) : void 0 : void 0;
    };

    Popover.prototype._getOpenDirection = function() {
      var $window, offset, width, windowRight;
      $window = $(window);
      windowRight = $window.scrollLeft() + $window.width();
      offset = this.$el.offset();
      width = $(this.el.firstChild).outerWidth();
      if (this.openDirection === "left" || windowRight <= offset.left + width + RG.getUnitWidth() + 14) {
        return "left";
      } else {
        return "right";
      }
    };

    Popover.prototype._setOpenTop = function() {
      var topPosition;
      this.verticalDirection = "top";
      topPosition = $(this.el.firstChild).outerHeight();
      this.$el.css({
        top: -topPosition
      });
      return this.$(".f-dropdown").addClass("cdrop-top");
    };

    Popover.prototype._setOpenLeft = function() {
      var leftPosition;
      leftPosition = $(this.el.firstChild).outerWidth();
      this.$el.css({
        left: -leftPosition - 40
      });
      this.$(".f-dropdown").addClass("cdrop-left");
      return this.$(".f-dropdown").removeClass("cdrop-right");
    };

    Popover.prototype._setOpenRight = function() {
      this.$(".f-dropdown").addClass("cdrop-right");
      this.$(".f-dropdown").removeClass("cdrop-left");
      return this.$el.css({
        left: 27
      });
    };

    Popover.prototype._scrollIntoVerticalView = function() {
      var dropdownRect, elRect, offset;
      offset = this.$el.offset();
      elRect = this.el.getBoundingClientRect();
      if (elRect.top < 0) {
        $("html, body").animate({
          scrollTop: offset.top - 10
        }, 300);
      }
      dropdownRect = this.el.querySelector(".f-dropdown").getBoundingClientRect();
      if (dropdownRect.bottom > $(window).height()) {
        return $("html, body").animate({
          scrollTop: offset.top + (this.$(".f-dropdown").height() * 2) - $(window).height()
        }, 300);
      }
    };

    Popover.prototype._scrollIntoHorizontalView = function(animate) {
      var cardsWidth, offset, rect, scrollFunc, targetLeft;
      if (animate == null) {
        animate = true;
      }
      scrollFunc = function(left) {
        if (animate) {
          return $("html, body").animate({
            scrollLeft: left
          }, 300);
        } else {
          return $(window).scrollLeft(left);
        }
      };
      offset = this.$el.offset();
      try {
        rect = this.el.querySelector(".f-dropdown").getBoundingClientRect();
      } catch (_error) {
        return;
      }
      cardsWidth = $("#calendar > aside").outerWidth();
      if (rect.left < cardsWidth || rect.right > $(window).width()) {
        if ($(".f-dropdown").hasClass("cdrop-right") && rect.left - cardsWidth < 0) {
          scrollFunc(offset.left - cardsWidth - 40);
        }
        if (rect.left < 0) {
          this._setOpenRight();
          offset = this.$el.offset();
          rect = this.el.querySelector(".f-dropdown").getBoundingClientRect();
        }
        if (rect.right > $(window).width()) {
          targetLeft = offset.left + rect.width - $(window).width() + RG.getUnitWidth() + 40;
          if (targetLeft + $(window).width() > $("#resources").width() + cardsWidth) {
            this._setOpenLeft();
            offset = this.$el.offset();
            targetLeft = offset.left - 10;
          }
          return scrollFunc(targetLeft);
        }
      }
    };

    Popover.prototype._resetPosition = function() {
      if (this.verticalDirection === "top") {
        return this._setOpenTop();
      }
    };

    return Popover;

  })(RG.Views.BaseView);

}).call(this);
(function() {
  var __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  RG.Views.Dialogs.BookingClashManagement = (function(_super) {
    __extends(BookingClashManagement, _super);

    function BookingClashManagement() {
      return BookingClashManagement.__super__.constructor.apply(this, arguments);
    }

    BookingClashManagement.prototype.template = JST['templates/dialogs/booking_clash_management'];

    BookingClashManagement.prototype.initialize = function(options) {
      var _ref, _ref1;
      this.command = options.command;
      this.clashBookingsCount = ((_ref = options.clashBookingsCount) != null ? _ref.length : void 0) || ((_ref1 = this.command) != null ? _ref1.getClashingBookings().length : void 0);
      this.cancelCallback = options.cancelCallback;
      this.successCallback = options.successCallback;
      return this.userPermissions = options.userPermissions || RG.Utils.Permissions;
    };

    BookingClashManagement.prototype.render = function() {
      this.$el.html(this.template());
      this._fillValues();
      this._removeDisallowedActions();
      this._bindEvents();
      return this;
    };

    BookingClashManagement.prototype.addToWaitingList = function(e) {
      var overlay;
      e.preventDefault();
      overlay = this._spinner();
      return Q.delay(50).then((function(_this) {
        return function() {
          if (typeof _this.successCallback === "function") {
            _this.successCallback();
          }
          return _this.command.execute({
            "delete": false
          }).then(function() {
            overlay.close();
            _this.trigger("close");
            return RG.Popovers.done();
          });
        };
      })(this));
    };

    BookingClashManagement.prototype.deleteBookings = function(e) {
      var overlay;
      e.preventDefault();
      overlay = this._spinner();
      return Q.delay(50).then((function(_this) {
        return function() {
          if (typeof _this.successCallback === "function") {
            _this.successCallback();
          }
          return _this.command.execute({
            "delete": true
          }).then(function() {
            overlay.close();
            _this.trigger("close");
            return RG.Popovers.done();
          });
        };
      })(this));
    };

    BookingClashManagement.prototype.cancel = function(e) {
      e.preventDefault();
      if (typeof this.cancelCallback === "function") {
        this.cancelCallback();
      }
      this.trigger("close");
      return e.stopPropagation();
    };

    BookingClashManagement.prototype._spinner = function() {
      var overlay, parentDropdown;
      parentDropdown = this.$el.closest('.dropdown-anchor').children();
      overlay = RG.Utils.spinnerOverlay(parentDropdown[0]);
      if (this._isRenderedAsOverlay(parentDropdown)) {
        this.$el.hide();
      } else {
        $(overlay.el).find('.dropdown-overlay-backdrop').css('height', parentDropdown.find('.f-dropdown').outerHeight());
        $(overlay.el).find('.spinner').css('margin-top', '-20px');
      }
      return overlay;
    };

    BookingClashManagement.prototype._isRenderedAsOverlay = function($parent) {
      return $parent.find('.dropdown-overlay-backdrop').length > 1;
    };

    BookingClashManagement.prototype._fillValues = function() {
      this.$(".js-booking-count").text("" + this.clashBookingsCount + " booking" + (this.clashBookingsCount > 1 ? "s" : ""));
      return this.$(".js-fit-text").text("fit" + (this.clashBookingsCount > 1 ? "" : "s"));
    };

    BookingClashManagement.prototype._bindEvents = function() {
      this.$el.on('click', '.js-add-waiting', this.addToWaitingList.bind(this));
      this.$el.on('click', '.js-delete-bookings', this.deleteBookings.bind(this));
      return this.$el.on('click', '.js-cancel', this.cancel.bind(this));
    };

    BookingClashManagement.prototype._removeDisallowedActions = function() {
      var clashBookings;
      clashBookings = this.command._clashingBookings.map(function(duration) {
        return duration.collection.booking;
      });
      if (!this.userPermissions.canDeleteClashBooking(clashBookings)) {
        this.$(".js-delete-bookings").remove();
      }
      if (!this.userPermissions.canMoveClashBookingToWaitingList(clashBookings)) {
        this.$(".js-add-waiting").remove();
        this.$('.js-fit-text').remove();
        this.$('.js-booking-count').remove();
        this.$(".js-booking-clash-text").text('Some bookings within the date range clash with your time off. Please select dates when time is available instead.');
        return this.$('.js-cancel').text('OK');
      }
    };

    return BookingClashManagement;

  })(RG.Views.BaseView);

}).call(this);
(function() {
  var __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  RG.Views.Dialogs.Overlay = (function(_super) {
    __extends(Overlay, _super);

    function Overlay() {
      return Overlay.__super__.constructor.apply(this, arguments);
    }

    Overlay.prototype.events = {
      "click .js-close": "close",
      "click": "_stopPropagation"
    };

    Overlay.prototype.initialize = function(options) {
      this.template = options.template;
      this.attachTo = options.attachTo;
      this.removeCallback = options.removeCallback;
      return this.bodyView = options.bodyView;
    };

    Overlay.prototype.render = function() {
      var offset;
      this.$el.css("position", "absolute");
      if (this.attachTo) {
        this.$el.width($(this.attachTo.firstChild).outerWidth() - 2);
        this.$el.height($(this.attachTo.firstChild).outerHeight() - 2);
        offset = $(this.attachTo.firstChild).offset();
      }
      this.$el.append(this._renderBackdrop());
      this.$el.append(this._renderModal().addClass("dropdown-overlay"));
      this._bindBodyClose();
      $(this.attachTo).append(this.el);
      if (this.attachTo) {
        this.$el.offset({
          top: offset.top + 1,
          left: offset.left + 1
        });
      }
      return this;
    };

    Overlay.prototype.close = function() {
      if (typeof this.removeCallback === "function") {
        this.removeCallback();
      }
      return this.remove();
    };

    Overlay.prototype._renderBackdrop = function() {
      var $backdrop;
      $backdrop = $(document.createElement("div"));
      $backdrop.width("100%");
      $backdrop.height("100%");
      $backdrop.addClass("dropdown-overlay-backdrop");
      return $backdrop;
    };

    Overlay.prototype._bindBodyClose = function() {
      if (this.bodyView) {
        return this.bodyView.on('close', (function(_this) {
          return function() {
            _this.bodyView.off();
            _this.bodyView.remove();
            return _this.close();
          };
        })(this));
      }
    };

    Overlay.prototype._renderModal = function() {
      return $(this.template());
    };

    Overlay.prototype._stopPropagation = function(e) {
      return e.stopPropagation();
    };

    return Overlay;

  })(RG.Views.BaseView);

}).call(this);
(function() {
  RG.Views.Factories.NameSearch = (function() {
    function NameSearch(resources) {
      this.resources = resources;
    }

    NameSearch.prototype.create = function(options) {
      var allOptions, filterableResources, filteredOptions, menu, searchGroupModel, visibleResources;
      if (options == null) {
        options = {};
      }
      searchGroupModel = new RG.Models.OptionGroup;
      visibleResources = this.resources.filter(function(resource) {
        return resource.visible;
      });
      filterableResources = this._getFilterableResources(this.resources.models);
      allOptions = this._mapResources(filterableResources);
      filteredOptions = this._mapResources(visibleResources);
      searchGroupModel.options.reset(allOptions);
      if (options.showMenu) {
        menu = new RG.Views.Filters.QuickSearchMenu({
          optionGroup: searchGroupModel,
          filteredOptions: filteredOptions,
          allResourceOptions: allOptions,
          savedFilters: RG.Utils.getLastUsedFilters()
        });
        return new RG.Views.Filters.QuickSearchWithMenu({
          menu: menu,
          optionGroup: searchGroupModel,
          cssClass: options.cssClass,
          resourceSelector: options.resourceSelector
        });
      }
      return new RG.Views.Filters.QuickSearch({
        optionGroup: searchGroupModel,
        cssClass: options.cssClass,
        resourceSelector: options.resourceSelector
      });
    };

    NameSearch.prototype._getFilterableResources = function(resources) {
      return resources.filter(function(r) {
        return r.isBookable();
      });
    };

    NameSearch.prototype._mapResources = function(resources) {
      return resources.map(function(r) {
        return new RG.Models.FilterOption({
          id: r.id,
          name: r.get('name'),
          tag: 'quick_search',
          ref: r,
          type: r.get('resourceType').getName()
        });
      });
    };

    return NameSearch;

  })();

}).call(this);
(function() {
  var __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  RG.Views.Filters.OptionGroup = (function(_super) {
    __extends(OptionGroup, _super);

    function OptionGroup() {
      return OptionGroup.__super__.constructor.apply(this, arguments);
    }

    OptionGroup.prototype.template = JST["templates/filters/option_group"];

    OptionGroup.prototype.matchTypeTemplate = JST["templates/filters/match_type"];

    OptionGroup.prototype.className = "filter__options-container";

    OptionGroup.prototype.events = {
      "change select": "triggerChangeFilter",
      "select2-open select.filter-option": 'focus',
      "select2-open select.match-type-select": 'focusMatchType'
    };

    OptionGroup.prototype.clearSelection = function() {
      this.getFilterOptionSelect().val([]);
      this.getFilterOptionSelect().trigger("change");
      this.$(".filter-option .select2-search-field .select2-input").width("290px");
      return this.trigger("change:filter");
    };

    OptionGroup.prototype.getFilterOptionSelect = function() {
      return this.$("select.filter-option");
    };

    OptionGroup.prototype.getMatchType = function() {
      if (this.optionGroup.get('multiple')) {
        return this.$("select.match-type-select").val();
      } else {
        return "any";
      }
    };

    OptionGroup.prototype.focus = function(e) {
      $("select.match-type-select").select2("close");
      return $("select.filter-option").not(this.$("select.filter-option")).select2("close");
    };

    OptionGroup.prototype.focusMatchType = function() {
      $("select.match-type-select").not(this.$("select.match-type-select")).select2("close");
      return $("select.filter-option").select2("close");
    };

    OptionGroup.prototype.getOptions = function() {
      return {
        name: this.optionGroup.getName(),
        id: this.optionGroup.getTagId(),
        matchType: this.getMatchType(),
        selectedOptions: this.getFilterOptionSelect().val(),
        type: this.optionGroup.getType()
      };
    };

    OptionGroup.prototype.getSelectedOptions = function() {
      var selectedOptions, values;
      values = this.getFilterOptionSelect().val();
      if (!values) {
        return null;
      }
      selectedOptions = values.map((function(_this) {
        return function(id) {
          return _this.optionGroup.options.findWhere({
            id: parseInt(id, 10)
          });
        };
      })(this));
      return {
        optionGroup: this.optionGroup,
        selectedOptions: selectedOptions,
        matchType: this.getMatchType()
      };
    };

    OptionGroup.prototype.initialize = function(options) {
      return this.optionGroup = options.optionGroup;
    };

    OptionGroup.prototype.render = function() {
      this.$el.html(this.template());
      this._fillValues();
      this.$(".match-type-select").select2({
        minimumResultsForSearch: 10
      });
      return this;
    };

    OptionGroup.prototype.setFilters = function(filters) {
      var category, filter, option, _i, _len, _results;
      category = this.optionGroup.collection.category;
      _results = [];
      for (_i = 0, _len = filters.length; _i < _len; _i++) {
        filter = filters[_i];
        if (category.get('name') === filter.categoryName) {
          _results.push((function() {
            var _j, _len1, _ref, _results1;
            _ref = filter.options;
            _results1 = [];
            for (_j = 0, _len1 = _ref.length; _j < _len1; _j++) {
              option = _ref[_j];
              if ((option.id && option.id === this.optionGroup.getTagId()) || ((option.id == null) && option.name === this.optionGroup.getName())) {
                _results1.push(this.getFilterOptionSelect().val(option.selectedOptions).trigger("change"));
              }
            }
            return _results1;
          }).call(this));
        }
      }
      return _results;
    };

    OptionGroup.prototype.triggerChangeFilter = function() {
      return this.trigger("change:filter", this.optionGroup, this.getSelectedOptions());
    };

    OptionGroup.prototype._createMatchAllOrAny = function() {
      if (this.optionGroup.get("multiple")) {
        return this.$(".match-type").html(this.matchTypeTemplate());
      } else {
        return this.$(".match-type").text("match any");
      }
    };

    OptionGroup.prototype._fillValues = function() {
      this.getFilterOptionSelect().html(this._getSelectOptions());
      this.getFilterOptionSelect().select2({
        placeholder: this._getPlaceholderText(),
        allowClear: true
      });
      return this._createMatchAllOrAny();
    };

    OptionGroup.prototype._getPlaceholderText = function() {
      return "" + (this.optionGroup.getName()) + " - select one or more";
    };

    OptionGroup.prototype._getSelectOptions = function() {
      var html, option, _i, _len, _ref;
      html = [];
      _ref = this.optionGroup.options.models;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        option = _ref[_i];
        html.push("<option value=\"" + option.id + "\">" + (option.getName()) + "</option>");
      }
      return html.join("");
    };

    return OptionGroup;

  })(RG.Views.BaseView);

}).call(this);
(function() {
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  RG.Views.Filters.QuickSearch = (function(_super) {
    __extends(QuickSearch, _super);

    function QuickSearch() {
      this.searchBlur = __bind(this.searchBlur, this);
      this.searchFocused = __bind(this.searchFocused, this);
      return QuickSearch.__super__.constructor.apply(this, arguments);
    }

    QuickSearch.prototype.resourceSelectorTemplate = JST["templates/downtimes/resource_selector"];

    QuickSearch.prototype.events = {
      "change select": "triggerChangeFilter",
      "focus .select2-input": 'searchFocused',
      "blur .select2-input": 'searchBlur'
    };

    QuickSearch.prototype.initialize = function(options) {
      var view;
      QuickSearch.__super__.initialize.apply(this, arguments);
      this.controls = options.controls;
      this.cssClass = options.cssClass;
      this.callback = options.callback;
      this.resourceSelector = options.resourceSelector;
      view = this;
      return $("#root nav").on('click', function(e) {
        return view.closeQuickSearch();
      });
    };

    QuickSearch.prototype._fillValues = function() {
      return this._renderOptions();
    };

    QuickSearch.prototype._renderOptions = function() {
      this.getFilterOptionSelect().html(this._getSelectOptions());
      return this.getFilterOptionSelect().select2({
        placeholder: this._getPlaceholderText()
      });
    };

    QuickSearch.prototype._getPlaceholderText = function() {
      return "Name Search";
    };

    QuickSearch.prototype.triggerChangeFilter = function(e) {
      this.focused = false;
      if (e.removed && this.getSelectedOptions() === null) {
        RG.spin(this.$('.select2-container')[0]);
        return window.requestAnimationFrame((function(_this) {
          return function() {
            return _this.bubbleChanges();
          };
        })(this));
      } else {
        return this.bubbleChanges();
      }
    };

    QuickSearch.prototype.bubbleChanges = function() {
      this.validate();
      this.trigger("change:filter", this.optionGroup, this.getSelectedOptions());
      if (this.$('.select2-container-disabled').length) {
        return this.searchBlur();
      }
    };

    QuickSearch.prototype.searchFocused = function(e) {
      return window.requestAnimationFrame((function(_this) {
        return function() {
          RG.Popovers.clear();
          if (_this._isSearchFocused()) {
            return;
          }
          return Q.delay(150).then(function() {
            _this.$('.select2-input').focus();
            _this.$('.select2-choices').click();
            return RG.spin();
          });
        };
      })(this));
    };

    QuickSearch.prototype.toggle = function(toggle) {
      if (toggle) {
        return $('#select2-drop-mask').trigger('click');
      } else {
        this.$("select.filter-option").select2('enable', true);
        return this.searchBlur();
      }
    };

    QuickSearch.prototype.searchBlur = function(e) {
      return window.requestAnimationFrame((function(_this) {
        return function() {
          if ($("li." + _this.cssClass).length === 0) {
            _this.focused = false;
            _this.togglePlaceholder(false);
            if (_this.isMultiple()) {
              $(_this.el).removeClass('search-hover');
              _this.addAllPill();
            }
          }
          return _this.$('.select2-input').trigger('blur');
        };
      })(this));
    };

    QuickSearch.prototype.isMultiple = function() {
      return this.$('.select2-choices').find('li.select2-search-choice').length > 1;
    };

    QuickSearch.prototype.togglePlaceholder = function(focused) {
      var input, _ref, _ref1;
      if (((_ref = $('html')) != null ? (_ref1 = _ref.attr('class')) != null ? _ref1.indexOf('ie') : void 0 : void 0) === -1) {
        input = this.$('.select2-input');
        if (this.getFilterOptionSelect().val()) {
          return input.attr('placeholder', '');
        } else {
          if (focused) {
            return input.attr('placeholder', 'Select one or more');
          } else {
            return input.attr('placeholder', this._getPlaceholderText());
          }
        }
      }
    };

    QuickSearch.prototype.addAllPill = function() {
      var choices, html, plural, selected_options_length;
      if (this.$('.all-pill').length === 0) {
        html = [];
        choices = this.$('.select2-choices');
        selected_options_length = choices.find('li.select2-search-choice').length;
        plural = "resources";
        if (selected_options_length < 2) {
          plural = "resource";
        }
        html.push("<li class='all-pill select2-search-choice'>");
        html.push("<div>" + selected_options_length + " " + plural + " selected</div>");
        html.push("<a href=\"#\" class=\"all-pill-remove select2-search-choice-close\" tabindex=\"-1\"></a>");
        html.push("</li>");
        choices.prepend(html.join(''));
        return this.bindAllPill();
      }
    };

    QuickSearch.prototype.bindAllPill = function() {
      if (!this.allPillBound) {
        this.$('.select2-choices').on('click', '.all-pill-remove', (function(_this) {
          return function() {
            return _this.clearAll();
          };
        })(this));
        this.allPillBound = true;
      }
      this.$('.all-pill').off();
      return this.$('.all-pill').on('click', (function(_this) {
        return function(e) {
          return _this.$('.select2-input').click();
        };
      })(this));
    };

    QuickSearch.prototype.clearAll = function() {
      localStorage.lastActiveFilterId = null;
      RG.spin(this.$('.select2-container')[0]);
      this.removeAllPill();
      this.$('.select2-choices li.select2-search-choice').hide();
      return this.clearSelection();
    };

    QuickSearch.prototype.clearSelection = function() {
      return setTimeout((function(_this) {
        return function() {
          _this.getFilterOptionSelect().val([]).trigger('change');
          return RG.spin(_this.$('.select2-container')[0]);
        };
      })(this), 16);
    };

    QuickSearch.prototype.removeAllPill = function() {
      return this.$('.all-pill').remove();
    };

    QuickSearch.prototype.getResourceIds = function() {
      var selectedOptions, _ref;
      selectedOptions = (_ref = this.getSelectedOptions()) != null ? _ref.selectedOptions : void 0;
      if (!selectedOptions) {
        return [];
      }
      return _.collect(selectedOptions, function(so) {
        return so.id;
      });
    };

    QuickSearch.prototype._getOptions = function() {
      return _.groupBy(this.optionGroup.options.models, function(e) {
        return e.get('type');
      });
    };

    QuickSearch.prototype._getSelectOptions = function() {
      var categories, category, html, option, options, _i, _len;
      categories = this._getOptions();
      html = [];
      for (category in categories) {
        options = categories[category];
        if (options.length) {
          html.push("<optgroup class='" + this.cssClass + "' label=\"" + category + "\">");
          for (_i = 0, _len = options.length; _i < _len; _i++) {
            option = options[_i];
            html.push("<option value=\"" + option.id + "\">" + (option.getName().substring(0, 20)) + "</option>");
          }
          html.push("</optgroup>");
        }
      }
      return html.join("");
    };

    QuickSearch.prototype.setFilters = function(filters) {
      var filter, option, selectedOptions, _i, _j, _len, _len1, _ref;
      selectedOptions = [];
      for (_i = 0, _len = filters.length; _i < _len; _i++) {
        filter = filters[_i];
        _ref = filter.options;
        for (_j = 0, _len1 = _ref.length; _j < _len1; _j++) {
          option = _ref[_j];
          if (option.name === 'Name') {
            selectedOptions.push(option.selectedOptions);
          }
        }
      }
      return this.getFilterOptionSelect().val(_.flatten(_.compact(selectedOptions))).trigger("change");
    };

    QuickSearch.prototype.setSearchHeigth = function(e) {
      var options, _ref;
      options = this.searchGroup.getSelectedOptions();
      this.quickSearchCount = options != null ? (_ref = options.selectedOptions) != null ? _ref.length : void 0 : void 0;
      return this.$('#quick-search').addClass('search-hover');
    };

    QuickSearch.prototype.setDropMaskOffset = function() {
      var offset;
      offset = 60 + (20 * this.getFilterOptionSelect().val().length);
      return $('#select2-drop-mask').offset({
        top: "" + offset
      });
    };

    QuickSearch.prototype.closeQuickSearch = function() {
      RG.closeAllSelections();
      this.focused = false;
      this.togglePlaceholder(false);
      if (this.isMultiple()) {
        this.addAllPill();
      }
      return $(this.el).removeClass('search-hover');
    };

    QuickSearch.prototype.remove = function() {
      return QuickSearch.__super__.remove.apply(this, arguments);
    };

    QuickSearch.prototype.render = function() {
      this.$el.html(this._template());
      this._fillValues();
      this.$(".match-type-select").select2({
        minimumResultsForSearch: 10
      });
      setTimeout((function(_this) {
        return function() {
          return _this.searchBlur();
        };
      })(this), 1000);
      return this;
    };

    QuickSearch.prototype.validate = function() {
      if (this.getResourceIds().length > 0) {
        this.$el.find('.error').hide();
        return true;
      } else {
        this.$el.find('.error').show();
        return false;
      }
    };

    QuickSearch.prototype._template = function() {
      if (this.resourceSelector) {
        return this.resourceSelectorTemplate;
      }
      return this.template;
    };

    QuickSearch.prototype._isSearchFocused = function() {
      var _ref, _ref1;
      if (typeof this.callback === "function") {
        this.callback();
      }
      RG.closeAllDropdowns();
      if (this.focused) {
        return true;
      }
      this.removeAllPill();
      this.$el.addClass('search-hover');
      this.togglePlaceholder(true);
      this._scroll();
      this._bindDropMask();
      if ((_ref = $(".match-type-select.select2-container-active")) != null) {
        if ((_ref1 = _ref.data('select2')) != null) {
          _ref1.close();
        }
      }
      this.focused = true;
      return false;
    };

    QuickSearch.prototype._bindDropMask = function() {
      return $("#select2-drop-mask").on("mousedown touchstart click", (function(_this) {
        return function(e) {
          return _this.searchBlur(e);
        };
      })(this));
    };

    QuickSearch.prototype._scroll = function() {
      return $(document).trigger("scroll");
    };

    return QuickSearch;

  })(RG.Views.Filters.OptionGroup);

}).call(this);
(function() {
  var __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  RG.Views.Filters.QuickSearchMenu = (function(_super) {
    __extends(QuickSearchMenu, _super);

    function QuickSearchMenu() {
      return QuickSearchMenu.__super__.constructor.apply(this, arguments);
    }

    QuickSearchMenu.prototype.template = JST['templates/filters/quick_search_menu'];

    QuickSearchMenu.prototype.initialize = function(options) {
      this.optionGroup = options.optionGroup;
      this.filteredOptions = options.filteredOptions;
      return this.allResourceOptions = options.allResourceOptions;
    };

    QuickSearchMenu.prototype.render = function() {
      this.$el.html(this.template());
      this._bindEvents();
      return this;
    };

    QuickSearchMenu.prototype._bindEvents = function() {
      this.$el.on("click", 'i', (function(_this) {
        return function(e) {
          return _this._toggleMenu(e);
        };
      })(this));
      this.$el.on("click", '.js-clear-resources', (function(_this) {
        return function() {
          return _this._clearAllSelectedOptions();
        };
      })(this));
      this.$el.on("click", '.js-currently-filtered', (function(_this) {
        return function() {
          return _this._setToCurrentlyFilteredResources();
        };
      })(this));
      this.$el.on("click", '.js-all-people', (function(_this) {
        return function() {
          return _this._setToAllPeople();
        };
      })(this));
      return this.$el.on("click", '.js-all-resources', (function(_this) {
        return function() {
          return _this._setToAllResources();
        };
      })(this));
    };

    QuickSearchMenu.prototype._toggleMenu = function(e) {
      e.preventDefault();
      e.stopPropagation();
      this.trigger('menuClicked');
      return this.$('.js-menu-options').toggle();
    };

    QuickSearchMenu.prototype.hide = function() {
      return this.$('.js-menu-options').hide();
    };

    QuickSearchMenu.prototype._clearAllSelectedOptions = function() {
      return this.trigger('change', []);
    };

    QuickSearchMenu.prototype._setToAllPeople = function() {
      var filters, ids;
      this.optionGroup.options.reset(this.allResourceOptions);
      ids = _.chain(this.optionGroup.options.models).select(function(option) {
        return option.get('type') === 'Person';
      }).collect(function(option) {
        return option.id;
      }).value();
      filters = [
        {
          categoryName: 'Person',
          options: [
            {
              matchType: 'any',
              name: 'Name',
              selectedOptions: ids
            }
          ]
        }
      ];
      return this.trigger('change', filters);
    };

    QuickSearchMenu.prototype._setToCurrentlyFilteredResources = function() {
      this.optionGroup.options.reset(this.filteredOptions);
      return this._triggerChange();
    };

    QuickSearchMenu.prototype._setToAllResources = function() {
      this.optionGroup.options.reset(this.allResourceOptions);
      return this._triggerChange();
    };

    QuickSearchMenu.prototype._triggerChange = function() {
      var filters, ids;
      ids = this.optionGroup.options.collect(function(option) {
        return option.id;
      });
      filters = [
        {
          categoryName: 'Person',
          options: [
            {
              matchType: 'any',
              name: 'Name',
              selectedOptions: ids
            }
          ]
        }
      ];
      return this.trigger('change', filters);
    };

    return QuickSearchMenu;

  })(RG.Views.BaseView);

}).call(this);
(function() {
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  RG.Views.Filters.QuickSearchWithMenu = (function(_super) {
    __extends(QuickSearchWithMenu, _super);

    function QuickSearchWithMenu() {
      this.searchFocused = __bind(this.searchFocused, this);
      return QuickSearchWithMenu.__super__.constructor.apply(this, arguments);
    }

    QuickSearchWithMenu.prototype.resourceSelectorTemplate = JST["templates/downtimes/resource_selector"];

    QuickSearchWithMenu.prototype.initialize = function(options) {
      QuickSearchWithMenu.__super__.initialize.apply(this, arguments);
      return this.menu = options.menu;
    };

    QuickSearchWithMenu.prototype._fillValues = function() {
      this.$('.filter__options-control').append(this.menu.render().el);
      this.menu.on('change', (function(_this) {
        return function(filters, reRender) {
          if (reRender == null) {
            reRender = false;
          }
          _this.trigger('displaySpinner');
          return Q.delay(10).then(function() {
            var _ref;
            _this._renderOptions();
            _this.setFilters(filters);
            return (_ref = _this.overlay) != null ? _ref.remove() : void 0;
          });
        };
      })(this));
      this.menu.on('menuClicked', (function(_this) {
        return function() {
          return _this.$el.click();
        };
      })(this));
      return QuickSearchWithMenu.__super__._fillValues.apply(this, arguments);
    };

    QuickSearchWithMenu.prototype._renderOptions = function() {
      var element;
      element = this.getFilterOptionSelect();
      element.html(this._getSelectOptions());
      window.view = this;
      element.select2({
        placeholder: this._getPlaceholderText(),
        closeOnSelect: false
      });
      return this.$('.select2-input').on('keyup', (function(_this) {
        return function(e) {
          var currentIds, option, topMatch;
          if (e.keyCode === 13) {
            topMatch = $($('div.select2-result-label')[1]).text();
            option = _this.optionGroup.options.findWhere({
              name: topMatch
            });
            currentIds = _this.getResourceIds();
            currentIds.push(option.id);
            element.val(currentIds).trigger('change');
            return Q.delay(20).then(function() {
              _this.$('.select2-input').focus();
              return _this.$('.select2-choices').click();
            });
          }
        };
      })(this));
    };

    QuickSearchWithMenu.prototype.setDropMaskOffset = function() {
      var offset;
      offset = 60 + (20 * this.getFilterOptionSelect().val().length);
      return $('#select2-drop-mask').offset({
        top: "" + offset
      });
    };

    QuickSearchWithMenu.prototype.remove = function() {
      RG.clearStaleDropdowns();
      this.menu.remove();
      return QuickSearchWithMenu.__super__.remove.apply(this, arguments);
    };

    QuickSearchWithMenu.prototype.searchFocused = function(e) {
      return this.menu.hide();
    };

    QuickSearchWithMenu.prototype.searchBlur = function(e) {};

    QuickSearchWithMenu.prototype.addAllPill = function() {};

    QuickSearchWithMenu.prototype.bindAllPill = function() {};

    QuickSearchWithMenu.prototype.removeAllPill = function() {};

    QuickSearchWithMenu.prototype._bindDropMask = function() {};

    return QuickSearchWithMenu;

  })(RG.Views.Filters.QuickSearch);

}).call(this);
(function() {
  var __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  RG.Views.Selectors.Booker = (function(_super) {
    __extends(Booker, _super);

    function Booker() {
      return Booker.__super__.constructor.apply(this, arguments);
    }

    Booker.prototype.initialize = function(options) {
      var _ref;
      this.bookers = options.bookers;
      this.booking = options.booking;
      this.currentUserId = options.currentUserId;
      return this.booker = options.booker || ((_ref = this.booking) != null ? _ref.get('booker') : void 0);
    };

    Booker.prototype.render = function() {
      var _ref;
      if ((_ref = this.selectBox) != null) {
        _ref.remove();
      }
      this.selectBox = $("<select style='width: 288px'></select>").addClass("chzn-select");
      this._fillValues();
      this.$el.html(this.selectBox);
      this.setSelectedValue(this.getCurrentUserBooker().cid);
      return this;
    };

    Booker.prototype._fillValues = function() {
      var b, bookers, _i, _len, _results;
      bookers = this.bookers.select((function(_this) {
        return function(b) {
          var _ref;
          return !b.get('archived') || b.cid === ((_ref = _this.booker) != null ? _ref.cid : void 0);
        };
      })(this));
      _results = [];
      for (_i = 0, _len = bookers.length; _i < _len; _i++) {
        b = bookers[_i];
        _results.push(this.selectBox.append($("<option></option").val(b.cid).text(b.get('name'))));
      }
      return _results;
    };

    Booker.prototype.getBooker = function() {
      var val;
      val = this.selectBox.trigger("liszt:updated").val();
      return this.bookers.find(function(b) {
        return b.cid === val;
      });
    };

    Booker.prototype.getCurrentUserBooker = function() {
      return this.bookers.findWhere({
        id: this.currentUserId
      });
    };

    Booker.prototype.setSelectedValue = function(cid) {
      return this.selectBox.val(cid).trigger("liszt:updated");
    };

    return Booker;

  })(RG.Views.BaseView);

}).call(this);
(function() {
  var __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  RG.Views.Selectors.DateRange = (function(_super) {
    __extends(DateRange, _super);

    function DateRange() {
      return DateRange.__super__.constructor.apply(this, arguments);
    }

    DateRange.prototype.dateFormat = "d M yy";

    DateRange.prototype.template = JST["templates/selectors/date_range"];

    DateRange.prototype.initialize = function(options) {
      this.dateRange = options.dateRange;
      this.resource = options.resource;
      this.customTemplate = options.customTemplate;
      return this.customValidations = options.customValidations || function(view) {
        return true;
      };
    };

    DateRange.prototype.getDateRange = function() {
      var dateRange;
      return dateRange = new RG.Utils.DateRange(this._parseDateString(this._getStartDateEl().val()) || this.dateRange.startDate, this._parseDateString(this._getEndDateEl().val()) || this.dateRange.endDate);
    };

    DateRange.prototype._bindEvents = function() {
      this.$el.on("change", "input#booking-start-date", (function(_this) {
        return function() {
          return _this._setMinDate();
        };
      })(this));
      this.$el.on("change", "input#booking-end-date", (function(_this) {
        return function() {
          return _this._setMaxDate();
        };
      })(this));
      this.$el.on("change", "input.js-date-range-input", (function(_this) {
        return function() {
          return _this.triggerValidate();
        };
      })(this));
      return this.$el.on("change", "input.js-date-range-input", (function(_this) {
        return function() {
          return _this.triggerChange();
        };
      })(this));
    };

    DateRange.prototype.render = function() {
      var widget;
      if (!this.customTemplate) {
        this.$el.html(this.template());
      }
      this._fillValues();
      this._getStartDateEl().datepicker({
        dateFormat: this.dateFormat,
        firstDay: 1
      });
      widget = this._getStartDateEl().datepicker("widget");
      widget.off();
      widget.on("mousedown mouseup click", function(e) {
        return e.stopPropagation();
      });
      widget.hasStopPropagation = true;
      this._getEndDateEl().datepicker({
        minDate: this.dateRange.startDate,
        dateFormat: this.dateFormat,
        firstDay: 1
      });
      this._bindEvents();
      return this;
    };

    DateRange.prototype.stopPropagation = function(e) {
      return e.stopPropagation();
    };

    DateRange.prototype.toggleError = function(error) {
      return this.$(".help-inline").toggle(error);
    };

    DateRange.prototype.triggerChange = function() {
      return this.trigger("change", this.getDateRange());
    };

    DateRange.prototype.triggerValidate = function() {
      this.validate(true);
      return true;
    };

    DateRange.prototype.validate = function(trigger) {
      return this.customValidations(this) && this._validate(trigger);
    };

    DateRange.prototype._validate = function(trigger) {
      var dateRange, e, error, errors;
      dateRange = null;
      error = false;
      try {
        dateRange = new RG.Utils.DateRange(this._parseDateString(this._getStartDateEl().val()) || this.dateRange.endDate, this._parseDateString(this._getEndDateEl().val()) || this.dateRange.endDate);
      } catch (_error) {
        e = _error;
        error = true;
      }
      if (this._isDateRangeValid(dateRange) && this._isResourceAvailable(dateRange)) {
        error = false;
      } else {
        error = true;
        errors = [];
        if (!this._isDateRangeValid(dateRange)) {
          errors.push("Please select a start and end date.");
        } else if (!this._isResourceAvailable(dateRange)) {
          errors.push("Sorry, you can't start or end a booking on a non-working day. Please change your dates.");
        }
        this._setErrorText(errors.join("<br>"));
      }
      this.toggleError(error);
      if (trigger) {
        this.trigger('validate');
      }
      return !error;
    };

    DateRange.prototype._fillValues = function() {
      this._getStartDateEl().val(this._getDateString(this.dateRange.startDate));
      this._getEndDateEl().val(this._getDateString(this.dateRange.endDate));
      return this.validate();
    };

    DateRange.prototype._getDateString = function(date) {
      return $.datepicker.formatDate(this.dateFormat, date);
    };

    DateRange.prototype._getEndDateEl = function() {
      return this.$("#booking-end-date");
    };

    DateRange.prototype._getStartDateEl = function() {
      return this.$("#booking-start-date");
    };

    DateRange.prototype._isDateRangeValid = function(dateRange) {
      return dateRange && dateRange.startDate && dateRange.endDate;
    };

    DateRange.prototype._isResourceAvailable = function(dateRange) {
      return this.resource.availability.isAvailableStartAndEndDate(dateRange);
    };

    DateRange.prototype._parseDateString = function(dateString) {
      try {
        return $.datepicker.parseDate(this.dateFormat, dateString);
      } catch (_error) {
        return null;
      }
    };

    DateRange.prototype._setErrorText = function(error) {
      return this.$(".help-inline").text(error);
    };

    DateRange.prototype._setMinDate = function() {
      var selectedRange;
      selectedRange = this.getDateRange();
      this._getEndDateEl().datepicker("destroy");
      this._getEndDateEl().datepicker({
        dateFormat: this.dateFormat,
        minDate: selectedRange.startDate,
        firstDay: 1
      });
      if (selectedRange.getNumberOfDays() < 1) {
        return this._getEndDateEl().val(this._getDateString(selectedRange.startDate));
      }
    };

    DateRange.prototype._setMaxDate = function() {
      var selectedRange;
      selectedRange = this.getDateRange();
      if (selectedRange.getNumberOfDays() < 1) {
        return this._getStartDateEl().val(this._getDateString(selectedRange.endDate));
      }
    };

    return DateRange;

  })(RG.Views.BaseView);

}).call(this);
(function() {
  var __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  RG.Views.Selectors.DateTimeRange = (function(_super) {
    __extends(DateTimeRange, _super);

    function DateTimeRange() {
      return DateTimeRange.__super__.constructor.apply(this, arguments);
    }

    DateTimeRange.prototype.template = JST["templates/selectors/date_time_range"];

    DateTimeRange.prototype.initialize = function(options) {
      this.timeRange = options.timeRange;
      this.dateRange = options.dateRange;
      this.resource = options.resource;
      return this.customValidations = options.customValidations || function(view) {
        return true;
      };
    };

    DateTimeRange.prototype.render = function() {
      this.$el.html(this.template());
      this._fillValues();
      return this;
    };

    DateTimeRange.prototype.getValues = function() {
      return {
        dateRange: this.dateRangeSelector.getDateRange(),
        timeRange: this.timeRangeSelector.getTimeRange()
      };
    };

    DateTimeRange.prototype.validate = function() {
      var result;
      result = this.customValidations(this) && this.dateRangeSelector.validate() && this.timeRangeSelector.validate();
      this.trigger("validate");
      return result;
    };

    DateTimeRange.prototype._fillValues = function() {
      this._composeDateRangeSelector();
      this.dateRangeSelector.render();
      this._composeTimeRangeSelector();
      this._composeValidations();
      return this.timeRangeSelector.render();
    };

    DateTimeRange.prototype._composeDateRangeSelector = function() {
      this.dateRangeSelector = new RG.Views.Selectors.DateRange({
        customTemplate: true,
        dateRange: this.dateRange,
        resource: this.resource,
        el: this.el
      });
      this.dateRangeSelector._isResourceAvailable = function(dateRange) {
        return true;
      };
      return this.dateRangeSelector.on('change', (function(_this) {
        return function(dateRange) {
          _this.dateRange = dateRange;
          _this.trigger('change', dateRange, _this.timeRangeSelector.getTimeRange());
          return _this.validate();
        };
      })(this));
    };

    DateTimeRange.prototype._composeTimeRangeSelector = function() {
      this.timeRangeSelector = new RG.Views.Selectors.TimeRange({
        customTemplate: true,
        startTime: this.timeRange.startTime,
        endTime: this.timeRange.endTime,
        typeName: this.resource.typeName(),
        el: this.el
      });
      this._overWriteTimeRangeValues();
      return this.timeRangeSelector.on('change', (function(_this) {
        return function(timeRange) {
          _this.trigger('change', _this.dateRangeSelector.getDateRange(), timeRange);
          return _this.validate();
        };
      })(this));
    };

    DateTimeRange.prototype._composeValidations = function() {
      var validate;
      validate = this.timeRangeSelector.validate.bind(this.timeRangeSelector);
      return this.timeRangeSelector.validate = (function(_this) {
        return function() {
          if (_this.dateRangeSelector.getDateRange().getNumberOfDays() === 1) {
            return validate(true);
          } else {
            return true;
          }
        };
      })(this);
    };

    DateTimeRange.prototype._overWriteTimeRangeValues = function() {
      if (this.dateRange.getNumberOfDays() > 1) {
        return this.timeRangeSelector._fillValues = (function(_this) {
          return function() {
            var startTime;
            startTime = _this.timeRangeSelector.$("#booking-start-time");
            startTime.calendricalTime();
            _this.timeRangeSelector.$("#booking-end-time").calendricalTime({
              maxTime: {
                hour: 24,
                minute: 0
              },
              startDate: _this.dateRangeSelector.$('input#booking-start-date'),
              endDate: _this.dateRangeSelector.$('input#booking-end-date')
            });
            _this.timeRangeSelector.$("#booking-start-time").val(_this.timeRangeSelector._minutesToTime(_this.timeRange.startTime));
            return _this.timeRangeSelector.$("#booking-end-time").val(_this.timeRangeSelector._minutesToTime(_this.timeRange.endTime));
          };
        })(this);
      }
    };

    return DateTimeRange;

  })(RG.Views.BaseView);

}).call(this);
(function() {
  var __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  RG.Views.Selectors.DowntimeTypeSelector = (function(_super) {
    __extends(DowntimeTypeSelector, _super);

    function DowntimeTypeSelector() {
      return DowntimeTypeSelector.__super__.constructor.apply(this, arguments);
    }

    DowntimeTypeSelector.prototype.tagName = 'select';

    DowntimeTypeSelector.prototype.initialize = function(options) {
      if (options == null) {
        options = {};
      }
      this.downtimeTypes = options.downtimeTypes;
      return this.selectedOption = options.selectedOption;
    };

    DowntimeTypeSelector.prototype.render = function() {
      var child;
      while (child = this.el.firstChild) {
        this.el.removeChild(child);
      }
      this._fillValues();
      this._bindEvents();
      return this;
    };

    DowntimeTypeSelector.prototype.getSelectedDowntimeType = function() {
      return this.downtimeTypes.findWhere({
        id: +this.$el.val()
      });
    };

    DowntimeTypeSelector.prototype._bindEvents = function() {
      return this.$el.on("change", (function(_this) {
        return function() {
          return _this.trigger('change', _this.getSelectedDowntimeType());
        };
      })(this));
    };

    DowntimeTypeSelector.prototype._fillValues = function() {
      this.$el.css("width", "288px");
      return this._createDowntimeTypes();
    };

    DowntimeTypeSelector.prototype._createDowntimeTypes = function() {
      var downtimeType, _i, _len, _ref, _results;
      this.$el.append('<option selected="selected" value="">&nbsp;</option>');
      _ref = this.downtimeTypes.models;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        downtimeType = _ref[_i];
        _results.push(this._createOption(downtimeType));
      }
      return _results;
    };

    DowntimeTypeSelector.prototype._createOption = function(downtimeType) {
      var option, _ref;
      option = $(document.createElement('option')).val(downtimeType.get('id')).text(downtimeType.get('name'));
      if (downtimeType.cid === ((_ref = this.selectedOption) != null ? _ref.cid : void 0)) {
        option.attr('selected', 'selected');
      }
      return this.$el.append(option);
    };

    return DowntimeTypeSelector;

  })(RG.Views.BaseView);

}).call(this);
(function() {
  var __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  RG.Views.Selectors.TimeRange = (function(_super) {
    __extends(TimeRange, _super);

    function TimeRange() {
      return TimeRange.__super__.constructor.apply(this, arguments);
    }

    TimeRange.prototype.className = 'specific-time';

    TimeRange.prototype.template = JST["templates/selectors/time_range"];

    TimeRange.prototype.togglable = true;

    TimeRange.prototype.initialize = function(options) {
      if (typeof options.startTime === 'undefined') {
        this.startTime = 540;
      } else {
        this.startTime = options.startTime;
      }
      this.endTime = options.endTime || 1020;
      if (options.togglable !== void 0) {
        this.togglable = options.togglable;
      }
      this.storageTypeName = options.typeName;
      return this.customTemplate = options.customTemplate;
    };

    TimeRange.prototype.remove = function() {
      return TimeRange.__super__.remove.apply(this, arguments);
    };

    TimeRange.prototype.closeSelector = function() {
      return this.$("#booking-start-time, #booking-end-time").blur();
    };

    TimeRange.prototype.getBookingDurationDTO = function() {
      return new RG.DTO.BookingDuration({
        duration: this.getEndTime() - this.getStartTime(),
        startTime: this.getStartTime()
      });
    };

    TimeRange.prototype.getEndTime = function() {
      var time;
      if (this.getEndTimeStr() === "Start of day") {
        return 0;
      }
      if (this.isEndOfDay()) {
        return 1440;
      }
      time = this._timeToMinutes(this.getEndTimeStr());
      return time || 1440;
    };

    TimeRange.prototype.isEndOfDay = function() {
      return this.getEndTimeStr() === "End of day";
    };

    TimeRange.prototype.getEndTimeStr = function() {
      return this.$("#booking-end-time").val();
    };

    TimeRange.prototype.getStartTime = function() {
      if (this.isStartOfDay()) {
        return 0;
      }
      return this._timeToMinutes(this.getStartTimeStr());
    };

    TimeRange.prototype.getTimeRange = function() {
      return new RG.Utils.TimeRange(this.getStartTime(), this.getEndTime());
    };

    TimeRange.prototype.isStartOfDay = function() {
      return this.getStartTimeStr() === "Start of day";
    };

    TimeRange.prototype.getStartTimeStr = function() {
      return this.$("#booking-start-time").val();
    };

    TimeRange.prototype._bindEvents = function() {
      return this.$el.on("change", "input.js-time-range-input", (function(_this) {
        return function() {
          return _this.triggerValidate();
        };
      })(this));
    };

    TimeRange.prototype.render = function() {
      if (!this.customTemplate) {
        this.$el.html(this.template());
        this.$(".alt-toggle").toggle(this.togglable);
      }
      this._fillValues();
      this._bindEvents();
      this.validate();
      return this;
    };

    TimeRange.prototype.setEndTime = function(endTime) {
      this.endTime = endTime;
      return this._fillValues();
    };

    TimeRange.prototype.setStartTime = function(startTime) {
      this.startTime = startTime;
      return this._fillValues();
    };

    TimeRange.prototype.toggleError = function(error) {
      return this.$(".help-inline").toggle(error);
    };

    TimeRange.prototype.triggerValidate = function() {
      if (!isNaN(+this.getEndTime())) {
        window.localStorage["TimeRange:EndTime:" + this.storageTypeName] = +this.getEndTime();
      }
      if (!isNaN(+this.getStartTime())) {
        window.localStorage["TimeRange:StartTime:" + this.storageTypeName] = +this.getStartTime();
      }
      this.validate(true);
      this.trigger('change', this.getTimeRange());
      return true;
    };

    TimeRange.prototype.validate = function(trigger) {
      var error;
      error = false;
      if (this._validated()) {
        error = false;
      } else {
        error = true;
      }
      this.toggleError(error);
      if (trigger) {
        this.trigger('validate', !error);
      }
      return !error;
    };

    TimeRange.prototype._validated = function() {
      var valid;
      this.$el.find('.error').text('Please select a valid start and end time.');
      valid = this.getStartTime() >= 0 && this.getEndTime() <= 1440;
      valid = valid && (!isNaN(this._timeToMinutes(this.$("#booking-end-time").val())) || this.isEndOfDay());
      valid = valid && this.getEndTime() > this.getStartTime();
      if (!valid) {
        this.$el.find('.error').text('Start time must be before end time');
      }
      return valid && this._validateTimeStringRange(this.getStartTimeStr(), false) && this._validateTimeStringRange(this.getEndTimeStr(), true);
    };

    TimeRange.prototype._fillValues = function() {
      this._calendrical || (this._calendrical = this.$("#booking-start-time, #booking-end-time").calendricalTimeRange());
      this.$("#booking-start-time").val(this._minutesToTime(this.startTime));
      return this.$("#booking-end-time").val(this._minutesToTime(this.endTime));
    };

    TimeRange.prototype._minutesToTime = function(minutes) {
      var flag, hour, minuteStr;
      hour = Math.floor(minutes / 60);
      minutes = minutes % 60;
      flag = hour >= 12 && hour !== 24 ? "pm" : "am";
      minuteStr = minutes.toString();
      if (minuteStr.length === 1) {
        minuteStr = "0" + minuteStr;
      }
      if (hour === 0 && minutes === 0) {
        return 'Start of day';
      }
      if (hour === 24 && minutes === 0) {
        return 'End of day';
      }
      if (hour > 12) {
        hour = hour - 12;
      }
      if (hour === 0) {
        hour = 12;
      }
      return "" + hour + ":" + minuteStr + flag;
    };

    TimeRange.prototype._timeToMinutes = function(time) {
      var flag, hours, hoursStr, minutes;
      hoursStr = time.substr(0, time.indexOf(":"));
      hours = parseInt(hoursStr, 10);
      minutes = parseInt(time.substr(hoursStr.length + 1, 2), 10);
      flag = time.substr(time.length - 2, 2);
      if (hours >= 12) {
        hours -= 12;
      }
      if (flag.toLowerCase() !== "am") {
        hours += 12;
      }
      return (hours * 60) + minutes;
    };

    TimeRange.prototype._validateTimeStringRange = function(time, end_parameter) {
      var flag, hours, hoursStr, minutes, total_minutes;
      hoursStr = time.substr(0, time.indexOf(":"));
      hours = parseInt(hoursStr, 10);
      minutes = parseInt(time.substr(hoursStr.length + 1, 2), 10);
      if (time === "Start of day") {
        minutes = 0;
        hours = 0;
      }
      if (time === "End of day") {
        minutes = 0;
        hours = 24;
      }
      if (time === "Start of day") {
        flag = "AM";
      } else if (time === "End of day") {
        flag = "PM";
      } else {
        flag = time.substr(time.length - 2, 2);
      }
      if (flag.toLowerCase() !== "am" && flag.toLowerCase() !== "pm") {
        return false;
      }
      if (minutes >= 60 || minutes < 0) {
        return false;
      }
      if (flag.toLowerCase() === "am" && !end_parameter && hours >= 13) {
        return false;
      }
      if (flag.toLowerCase() === "am" && end_parameter && hours >= 13) {
        return false;
      }
      if (hours >= 12) {
        hours -= 12;
      }
      if (flag.toLowerCase() !== "am") {
        hours += 12;
      }
      total_minutes = (hours * 60) + minutes;
      if (flag.toLowerCase() === "am" && end_parameter && total_minutes > 1440) {
        return false;
      }
      if (flag.toLowerCase() === "am" && !end_parameter) {
        if (total_minutes < 0 || total_minutes >= 720) {
          return false;
        }
      }
      if (flag.toLowerCase() === "pm" && end_parameter) {
        if (total_minutes > 1440 || total_minutes < 720) {
          return false;
        }
      }
      return true;
    };

    return TimeRange;

  })(RG.Views.BaseView);

}).call(this);
(function() {
  var __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  RG.Views.Selectors.TimeZoneSelector = (function(_super) {
    __extends(TimeZoneSelector, _super);

    function TimeZoneSelector() {
      return TimeZoneSelector.__super__.constructor.apply(this, arguments);
    }

    TimeZoneSelector.prototype.initialize = function(options) {
      this.timeZones = options.timeZones;
      this.selectedOption = options.selectedOption;
      this.resourceLocalTime = options.resourceLocalTime;
      return this.currentUserTimeZone = options.currentUserTimeZone;
    };

    TimeZoneSelector.prototype.render = function() {
      this.$el.append();
      this._fillValues();
      this.setTimeZone();
      return this;
    };

    TimeZoneSelector.prototype._fillValues = function() {
      var defaultOptionGroup, defaultOptions, errorElement, optionGroup, select;
      errorElement = $(document.createElement('span')).addClass('help-inline error').text('Please select a timezone - selected resources are in different zones').hide();
      select = $(document.createElement('select'));
      defaultOptionGroup = $(document.createElement('optgroup'));
      defaultOptionGroup.append($(document.createElement('option')).text('Select an option').attr('selected', !this.selectedOption).val('none'));
      defaultOptionGroup.append($(document.createElement('option')).text("Resource's local time").attr('selected', this._isLocalTimeZone()).val("NullTimeZone"));
      defaultOptions = [_.unescape(this.selectedOption), _.unescape(this.currentUserTimeZone), _.unescape(this.resourceLocalTime)];
      optionGroup = $(document.createElement('optgroup')).attr('label', '--------------');
      this.timeZones.each((function(_this) {
        return function(timeZone) {
          var option;
          option = $(document.createElement("option"));
          option.text(timeZone.toString()).val(timeZone.getName());
          if (_.include(defaultOptions, timeZone.getName())) {
            if (_this.selectedOption === timeZone.getName()) {
              option.attr('selected', 'selected');
            }
            return defaultOptionGroup.append(option);
          } else {
            return optionGroup.append(option);
          }
        };
      })(this));
      select.append(defaultOptionGroup);
      select.append(optionGroup);
      this.$el.append(select);
      this.$el.append(errorElement);
      return this.$el.on('change', 'select', (function(_this) {
        return function() {
          return _this.validate();
        };
      })(this));
    };

    TimeZoneSelector.prototype.getTimeZone = function() {
      return this.$('select').val();
    };

    TimeZoneSelector.prototype.setTimeZone = function() {
      if (this.selectedOption) {
        return this.$('select').val(this.selectedOption);
      }
    };

    TimeZoneSelector.prototype.validate = function() {
      if (this.getTimeZone() === 'none') {
        this.$el.find('.error').show();
        return false;
      } else {
        this.$el.find('.error').hide();
        return true;
      }
    };

    TimeZoneSelector.prototype._isLocalTimeZone = function() {
      return this.selectedOption === (new RG.Models.NullTimeZone).getName();
    };

    return TimeZoneSelector;

  })(RG.Views.BaseView);

}).call(this);
(function() {
  var __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  RG.Views.Selectors.ResourceStatic = (function(_super) {
    __extends(ResourceStatic, _super);

    function ResourceStatic() {
      return ResourceStatic.__super__.constructor.apply(this, arguments);
    }

    ResourceStatic.prototype.initialize = function(resource) {
      this.resource = resource;
    };

    ResourceStatic.prototype.render = function() {
      this.$el.text(this.resource.getName());
      return this;
    };

    ResourceStatic.prototype.searchBlur = function() {};

    ResourceStatic.prototype.validate = function() {
      return true;
    };

    ResourceStatic.prototype.setFilters = function(array) {};

    ResourceStatic.prototype.getResourceIds = function() {
      return [this.resource.id];
    };

    return ResourceStatic;

  })(RG.Views.BaseView);

}).call(this);
(function() {
  RG.Commands.CreateDowntimeCommand = (function() {
    function CreateDowntimeCommand(options) {
      this.timeZones = options.timeZones;
      this.account = options.account;
      this.resources = options.resources;
      this.booker = options.booker;
      this.dateTimeRange = options.dateTimeRange;
      this.timeZone = options.timeZone;
      this.details = options.details;
      this.leave = options.leave;
      this.type = options.type;
      this.preExecuteCallback = options.preExecuteCallback || function() {};
      this.successCallback = options.successCallback || function() {};
      this.errorCallback = options.errorCallback || function() {};
      this.dataDateRange = RG.Variables.dataDateRange || this.dateTimeRange.dateRange;
    }

    CreateDowntimeCommand.prototype.execute = function(options) {
      var callbacks, downtime, params;
      if (options == null) {
        options = {};
      }
      params = this._getParameters();
      if (options["delete"] !== void 0) {
        params.delete_invalid_bookings = options["delete"];
      }
      callbacks = {
        successCallback: this.successCallback,
        errorCallback: this.errorCallback
      };
      downtime = this._buildDowntime(params);
      this.preExecuteCallback(downtime, this.getClashingBookings(), params.delete_invalid_bookings);
      RG.Utils.DowntimeService.createDowntime(downtime, params, callbacks)["catch"](function(err) {
        console.log(err.message);
      });
    };

    CreateDowntimeCommand.prototype.getClashingBookingsFromServer = function(options) {
      var params, req;
      params = this._getParameters();
      req = $.ajax("/v1/" + (this.account.getSubdomain()) + "/downtimes/clashes", {
        method: "POST",
        headers: {
          "X-CSRF-Token": RG.Utils.getCSRFToken()
        },
        data: params,
        dataType: 'json',
        success: (function(_this) {
          return function(data) {
            var bookings;
            if (parseInt(data.length, 10) > 0) {
              bookings = data.map(function(object) {
                var duration;
                duration = new RG.Models.Duration(object);
                return duration.collection = {
                  collection: {
                    booking: {
                      getBooker: function() {
                        return window.bookers.findWhere({
                          id: duration.attributes.booker_id
                        });
                      }
                    }
                  }
                };
              });
              _this._clashingBookings = bookings;
              if (typeof options.success === "function") {
                options.success(bookings);
              }
            } else {
              if (typeof options.fail === "function") {
                options.fail();
              }
            }
          };
        })(this)
      });
      return req;
    };

    CreateDowntimeCommand.prototype.getClashingBookings = function() {
      var allDurations, availabilityManager, availableMinutes, clashes, confirmedDurations, date, dateRange, dates, downtime, duration, resource, timeBooked, _i, _j, _k, _len, _len1, _len2, _ref;
      clashes = [];
      _ref = this.resources;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        resource = _ref[_i];
        availabilityManager = new RG.Utils.AvailabilityManager({
          resource: resource,
          availablePeriods: resource.availablePeriods,
          customAvailablePeriods: resource.customAvailablePeriods,
          overtimes: resource.overtimes,
          downtimes: new RG.Collections.Downtimes(resource.downtimes.map(function(downtime) {
            return downtime.clone();
          })),
          timeZone: resource.getTimeZone(),
          ignoreEvents: true
        });
        downtime = new RG.Models.Downtime({
          resourcedIds: [resource.id],
          from: this.dateTimeRange.dateRange.startDate,
          to: this.dateTimeRange.dateRange.endDate,
          timeZone: window.timeZones.findWhere({
            name: this.timeZone
          }),
          startTime: this.dateTimeRange.timeRange.startTime,
          endTime: this.dateTimeRange.timeRange.endTime
        }).inTimeZone(resource.getTimeZone());
        availabilityManager.downtimes.add(downtime);
        dateRange = downtime.getDateRange();
        dates = dateRange.getDates();
        for (_j = 0, _len1 = dates.length; _j < _len1; _j++) {
          date = dates[_j];
          allDurations = resource.bookings.getDurationsForDate(date);
          confirmedDurations = allDurations.filter(function(d) {
            return d.isConfirmed() && d.getMinutes() > 0;
          }).sort(function(a, b) {
            return a.getMinutes() - b.getMinutes();
          });
          availableMinutes = availabilityManager.getMinutesAvailableForDate(date);
          timeBooked = 0;
          for (_k = 0, _len2 = confirmedDurations.length; _k < _len2; _k++) {
            duration = confirmedDurations[_k];
            if ((duration.isFixed() && availabilityManager.intersectsWithDowntime(date, duration.getTimeRange())) || !this._fitsInFirstOrLastDate(duration, dateRange, date, downtime.startTime, downtime.endTime, availableMinutes, timeBooked)) {
              clashes.push(duration);
            } else {
              timeBooked += duration.getMinutes();
            }
          }
        }
      }
      return this._clashingBookings = clashes;
    };

    CreateDowntimeCommand.prototype.willTouchBookings = function(options) {
      var clashes;
      if (options == null) {
        options = {};
      }
      this._buildDowntime(this._getParameters());
      if (this.outsideDataDateRange()) {
        this.getClashingBookingsFromServer(options);
      } else {
        clashes = this.getClashingBookings();
        if (clashes.length > 0) {
          if (typeof options.success === "function") {
            options.success(clashes);
          }
        } else {
          if (typeof options.fail === "function") {
            options.fail();
          }
        }
      }
    };

    CreateDowntimeCommand.prototype.outsideDataDateRange = function() {
      return !this.dataDateRange.contains(this.dateTimeRange.dateRange);
    };

    CreateDowntimeCommand.prototype._buildDowntime = function(options) {
      return this.downtime != null ? this.downtime : this.downtime = new RG.Models.Downtime({
        resourceIds: options.resource_ids,
        creatorId: options.creator_id,
        from: this.dateTimeRange.dateRange.startDate,
        to: this.dateTimeRange.dateRange.endDate,
        timeZone: this.timeZones.findWhere({
          name: options.timezone
        }),
        startTime: options.start_time,
        endTime: options.end_time,
        details: options.details,
        leave: options.leave,
        downtimeType: this.type
      });
    };

    CreateDowntimeCommand.prototype._getParameters = function() {
      return this.params != null ? this.params : this.params = {
        resource_ids: _.map(this.resources, function(r) {
          return r.id;
        }),
        creator_id: this.booker.id,
        from: RG.Utils.DateFormatter.getISODate(this.dateTimeRange.dateRange.startDate),
        to: RG.Utils.DateFormatter.getISODate(this.dateTimeRange.dateRange.endDate),
        start_time: this.dateTimeRange.timeRange.startTime,
        end_time: this.dateTimeRange.timeRange.endTime,
        details: this.details,
        leave: this.leave,
        timezone: this.timeZone,
        downtime_type_id: this.type ? this.type.id : null
      };
    };

    CreateDowntimeCommand.prototype._fitsInFirstOrLastDate = function(duration, dateRange, date, startTime, endTime, availableMinutes, timeBooked) {
      if (RG.Utils.DateComparator.equalsYMD(date, dateRange.startDate)) {
        return duration.endsBeforeTime(startTime) || timeBooked + duration.getMinutes() <= availableMinutes;
      } else if (RG.Utils.DateComparator.equalsYMD(date, dateRange.endDate)) {
        return duration.startsAfterTime(endTime) || timeBooked + duration.getMinutes() <= availableMinutes;
      } else {
        return false;
      }
    };

    return CreateDowntimeCommand;

  })();

}).call(this);
(function() {
  $(function() {
    var host, subdomain;
    RG.spin($('.js-dashboard-time-off')[0]);
    if (window.resources == null) {
      window.resources = new RG.Collections.ResourceInstances;
    }
    window.resourceTypes = new RG.Collections.ResourceTypes;
    window.bookers = new RG.Collections.Bookers;
    window.deletedBookers = new RG.Collections.Bookers;
    window.downtimeTypes = new RG.Collections.DowntimeTypes;
    window.downtimes = new RG.Collections.Downtimes;
    window.RG.Popovers = new RG.Utils.PopoverManager;
    window.RG.renderer = new RG.Renderer.Renderer;
    subdomain = window.location.host.substr(0, window.location.host.indexOf("."));
    RG.getApiRoot = function() {
      return "/v1/" + subdomain;
    };
    window.resources.reset([]);
    window.update = function() {
      return Q.delay(10);
    };
    host = window.location.host.substr(0, window.location.host.indexOf("."));
    setTimeout(function() {
      return RG.Utils.DataParser.boot(host);
    }, 100);
    RG.Variables.waitingListManager = new RG.Utils.WaitingListDisplayManager('#waiting_list', '#waiting_list_collapsed', '.toggle_waiting_list');
    RG.Variables.waitingListManager.attach();
    RG.Variables.waitingListManager.perform('toggle');
    return RG.Variables.dataDateRange = new RG.Utils.DateRange(new Date(1970, 0, 1), new Date(1970, 0, 1));
  });

}).call(this);
// Ajax calls for the waitinglist tab-pane tabs on the dashboard
$('a[href="#me"]').click(function() {
  $(".tab-pane.active").load("/dashboard/paged_waiting_list/1?context=me")
  $(".nav.nav-tabs").find("li").toggleClass("active")
  return false
})
$('a[href="#all"]').click(function() {
  $(".tab-pane.active").load("/dashboard/paged_waiting_list/1?context=all")
  $(".nav.nav-tabs").find("li").toggleClass("active")
  return false
})
;
(function() {
  RG.Renderer.GlobalLock = (function() {
    function GlobalLock() {}

    return GlobalLock;

  })();

}).call(this);
(function() {
  RG.Renderer.Renderer = (function() {
    function Renderer() {}

    Renderer.prototype.lock = function(lock) {};

    Renderer.prototype.unlock = function(lock) {};

    return Renderer;

  })();

}).call(this);




































// override kaminari's default click behaviour by providing our own ajax call
$(document).on('click', '.js-waiting-list .pagination .page a, .page-relative', function(event){
  event.preventDefault();
  event.stopPropagation();
  urlPath = $(this).attr('href');
  if (urlPath.match(/#/) === null) {
    $.ajax(urlPath, {
      success: function(data, status, xhr) {

        elementId = $(data).attr('id');
        if (elementId !== undefined) {
          switch(elementId) {
            case "waiting_table_me" :
              $("#waiting_table_me").html(data)
              break;
            case "waiting_table_all" :
              $("#waiting_table_all").html(data)
              break;
            default:
              break;
          }
        }
      }
    });
  }
});


$(document).ready(function(){
    $(document).off('ajax:success');
    new Clipboard("*[data-clipboard-target]");
    $("#calendar_feed_url").on("keydown", function(e) {
        if (!(e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            return false;
        }
    });
});
