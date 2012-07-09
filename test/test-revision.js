// Copyright Hagen Rother, hagen@rother.cc
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var testCase = require('nodeunit').testCase;
var crypto = require('crypto');
var Revision = require('../lib/canape-revision').Revision;

module.exports = testCase({
  'Canape Revision': testCase({
    'empty constructor': function(test) {
      var emptyRev = new Revision();
      test.strictEqual(emptyRev.updateCount, 0);
      test.strictEqual(emptyRev.hash, '0000000000');
      test.strictEqual(emptyRev.toString(), '0-0000000000');
      test.strictEqual(emptyRev.toJSON(), '0-0000000000');
      test.done();
    },
    'constructor with valid rev': function(test) {
      var validRev = new Revision('2-abc');
      test.strictEqual(validRev.updateCount, 2);
      test.strictEqual(validRev.hash, 'abc');
      test.strictEqual(validRev.toString(), '2-abc');
      test.strictEqual(validRev.toJSON(), '2-abc');
      test.done();
    },
    'constructor with two valid params (int, string)': function(test) {
      var twoParamRev = new Revision(3, 'def');
      test.strictEqual(twoParamRev.updateCount, 3);
      test.strictEqual(twoParamRev.hash, 'def');
      test.strictEqual(twoParamRev.toString(), '3-def');
      test.strictEqual(twoParamRev.toJSON(), '3-def');
      test.done();
    },
    'constructor with two valid params (string, string)': function(test) {
      var twoParamRev = new Revision('4', '123');
      test.strictEqual(twoParamRev.updateCount, 4);
      test.strictEqual(twoParamRev.hash, '123');
      test.strictEqual(twoParamRev.toString(), '4-123');
      test.strictEqual(twoParamRev.toJSON(), '4-123');
      test.done();
    },
    'constructor with new rev': function(test) {
      var newRev = new Revision('5-def', '123');
      test.strictEqual(newRev.updateCount, 6);
      test.strictEqual(newRev.hash, '123');
      test.strictEqual(newRev.toString(), '6-123');
      test.strictEqual(newRev.toJSON(), '6-123');
      test.strictEqual(newRev.replaced, '5-def');
      test.done();
    },
    'constructor with same rev': function(test) {
      var newRev = new Revision('5-def', 'def');
      test.strictEqual(newRev.updateCount, 5);
      test.strictEqual(newRev.hash, 'def');
      test.strictEqual(newRev.toString(), '5-def');
      test.strictEqual(newRev.toJSON(), '5-def');
      test.ok(!newRev.replaced);
      test.done();
    },
    'constructor with [revs]': function(test) {
      var arrayRevs = new Revision(['10-def', '2-345', '2-345', '10-abc', '1-abc']);
      test.ok(Array.isArray(arrayRevs));
      test.strictEqual(arrayRevs.length, 4);
      test.ok(arrayRevs[0] instanceof Revision);
      test.ok(arrayRevs[1] instanceof Revision);
      test.ok(arrayRevs[2] instanceof Revision);
      test.ok(arrayRevs[3] instanceof Revision);
      test.strictEqual(JSON.stringify(arrayRevs), '["1-abc","2-345","10-abc","10-def"]');
      test.done();
    },
    'idempotent revision computation': function(test) {
      var expected = {
        _attachments: {
          a:'aa',
          b: 'bb'
        },
        a: true,
        b: {
          ba: null,
          bb: 'hallo'
        },
        c: 3,
        d: [null, 'b', 'a', true, 2, 1.2]
      };

      var expectedHash = crypto.createHash('md5');
      expectedHash.update(JSON.stringify(expected), 'utf8');
      expectedHash = expectedHash.digest('hex').substring(0, 10);

      var doc = {
        _rev: '1-' + expectedHash,
        c: 3,
        b: {
          bb: 'hallo',
          ba: null
        },
        _id: '123',
        d: [null, 'b', 'a', true, 2, 1.2],
        a: true,
        _attachments: {
          b: 'bb',
          a:'aa'
        },
        _meta: {
          foo: 'bar'
        }
      };

      var docRev = Revision.compute(doc);
      var expectedRev = Revision.compute(expected);
      // expected._rev now exists, make sure it's not modifying the rev 
      var reCheckRev = Revision.compute(expected);

      test.strictEqual(docRev.hash, expectedHash);
      test.strictEqual(docRev.toString(), expectedRev.toString());
      test.strictEqual(reCheckRev.toString(), expectedRev.toString());

      // do update and compute again
      delete expected._rev;
      expected.a = false;
      doc.a = false;

      // compute again using alternative syntaxes
      var docRev2 = new Revision(doc);
      expectedRev = Revision(expected); // omiting 'new' only works for documents

      // we deleted expected._rev so the updateCount should be 1
      test.strictEqual(expectedRev.updateCount, 1);

      // doc's updateCount should be 2 (because we didn't delete doc._rev)
      test.strictEqual(docRev2.updateCount, 2);

      // but their hash should be same
      test.strictEqual(docRev2.hash, expectedRev.hash);

      // also doc should correctly report a replaced hash
      test.strictEqual(docRev2.replaced.toString(), docRev.toString());

      test.done();
    }
  })
});