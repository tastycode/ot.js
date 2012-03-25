var ot = require('../lib/operational-transformation');

function randomInt (n) {
  return Math.floor(Math.random() * n);
}

function randomString (n) {
  var str = '';
  while (n--) {
    var chr = randomInt(26) + 97;
    str = str + String.fromCharCode(chr);
  }
  return str;
}

function randomOperation (rev, str) {
  var operation = new ot.Operation(rev);
  var left;
  while (left = str.length - operation.baseLength) {
    var r = Math.random();
    var l = 1 + randomInt(Math.min(left, 20));
    if (r < 0.2) {
      operation.insert(randomString(l));
    } else if (r < 0.4) {
      operation.delete(str.slice(operation.baseLength, operation.baseLength + l));
    } else {
      operation.retain(l);
    }
  }
  if (Math.random() < 0.3) {
    operation.insert(1 + randomString(10));
  }
  return operation;
}

function times (n, fun) {
  while (n--) {
    fun();
  }
}

function assert (b, msg) {
  if (!b) {
    throw new Error(msg || "assertion error");
  }
}

function assertEqual (a, b) {
  if (a !== b) {
    throw new Error("assertion error: " + a + " !== " + b);
  }
}

function assertThrows (fn) {
  var threw = false;
  try {
    fn();
  } catch (exc) {
    threw = true;
  }
  assert(threw, "Expected function to throw an error");
}

function testLengths () {
  var o = new ot.Operation(0);
  assertEqual(0, o.baseLength);
  assertEqual(0, o.targetLength);
  o.retain(5);
  assertEqual(5, o.baseLength);
  assertEqual(5, o.targetLength);
  o.insert("abc");
  assertEqual(5, o.baseLength);
  assertEqual(8, o.targetLength);
  o.retain(2);
  assertEqual(7, o.baseLength);
  assertEqual(10, o.targetLength);
  o.delete("xy");
  assertEqual(9, o.baseLength);
  assertEqual(10, o.targetLength);
}

function testApply () {
  var str = randomString(50);
  var o = randomOperation(0, str);
  assertEqual(str.length, o.baseLength);
  assertEqual(ot.apply(str, o).length, o.targetLength);
}

function testOpsMerging () {
  function last (arr) { return arr[arr.length-1]; }
  var o = new ot.Operation(0);
  assertEqual(0, o.ops.length);
  o.retain(2);
  assertEqual(1, o.ops.length);
  assertEqual(2, last(o.ops).retain)
  o.retain(3);
  assertEqual(1, o.ops.length);
  assertEqual(5, last(o.ops).retain)
  o.insert("abc");
  assertEqual(2, o.ops.length);
  assertEqual("abc", last(o.ops).insert)
  o.insert("xyz");
  assertEqual(2, o.ops.length);
  assertEqual("abcxyz", last(o.ops).insert)
  o.delete("d");
  assertEqual(3, o.ops.length);
  assertEqual("d", last(o.ops).delete)
  o.delete("d");
  assertEqual(3, o.ops.length);
  assertEqual("dd", last(o.ops).delete)
}

function testToString () {
  var o = new ot.Operation(0);
  o.retain(2);
  o.insert('lorem');
  o.delete('ipsum');
  o.retain(5);
  assertEqual("retain 2, insert 'lorem', delete 'ipsum', retain 5", o.toString());
}

function testFromJSON () {
  var obj = {
    id: '1234',
    baseRevision: 3,
    baseLength: 4,
    targetLength: 5,
    ops: [
      { retain: 2 },
      { delete: "a" },
      { delete: "b" },
      { insert: "cde" }
    ]
  };
  var o = ot.Operation.fromJSON(obj);
  assertEqual('1234', o.id);
  assertEqual(3, o.baseRevision);
  assertEqual(3, o.ops.length);
  assertEqual(4, o.baseLength);
  assertEqual(5, o.targetLength);

  function clone (obj) {
    var copy = {};
    for (var name in obj) {
      if (obj.hasOwnProperty(name)) {
        copy[name] = obj[name];
      }
    }
    return copy;
  }

  function assertIncorrectAfter (fn) {
    var obj2 = clone(obj);
    fn(obj2);
    assertThrows(function () { ot.Operation.fromJSON(obj2); });
  }

  assertIncorrectAfter(function (obj2) { delete obj2.id; });
  assertIncorrectAfter(function (obj2) { obj2.baseRevision = -42; })
  assertIncorrectAfter(function (obj2) { obj2.baseLength += 1; });
  assertIncorrectAfter(function (obj2) { obj2.targetLength -= 1; })
  assertIncorrectAfter(function (obj2) { obj2.ops.push({ insert: 'x' }); });
  assertIncorrectAfter(function (obj2) { obj2.ops.push({ lorem: 'no such operation' }); });
}

function testCompose () {
  // invariant: apply(str, compose(a, b)) === apply(apply(str, a), b)
  var str = randomString(20);
  var a = randomOperation(0, str);
  var afterA = ot.apply(str, a);
  assertEqual(a.targetLength, afterA.length);
  var b = randomOperation(1, afterA);
  var afterB = ot.apply(afterA, b);
  assertEqual(b.targetLength, afterB.length);
  var ab = ot.compose(a, b);
  assertEqual(ab.targetLength, b.targetLength);
  var afterAB = ot.apply(str, ab);
  if (afterB !== afterAB) {
    throw new Error(
      "compose error; str: " + str + ", a: " + a + ", b: " + b
    );
  }
}

function testTransform () {
  // invariant: apply(str, compose(a, b')) = apply(compose(b, a'))
  // where (a', b') = transform(a, b)
  var str = randomString(20);
  var a = randomOperation(0, str);
  var b = randomOperation(0, str);
  var abPrime = ot.transform(a, b);
  var aPrime = abPrime[0];
  var bPrime = abPrime[1];
  var abPrime = ot.compose(a, bPrime);
  var baPrime = ot.compose(b, aPrime);
  var afterAbPrime = ot.apply(str, abPrime);
  var afterBaPrime = ot.apply(str, baPrime);
  if (afterAbPrime !== afterBaPrime) {
    throw new Error(
      "transform error; str: " + str + ", a: " + a + ", b: " + b
    );
  }
}

exports.run = function () {
  var n = 500;
  testLengths();
  testOpsMerging();
  testToString();
  testFromJSON();
  times(n, testApply);
  times(n, testCompose);
  times(n, testTransform);
};