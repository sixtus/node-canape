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

var Revision = require('../lib/canape-revision');
var Document = require('../lib/canape-document');

module.exports = testCase({
  'Canape Document': testCase({
    'empty constructor': function(test) {
      var doc = new Document();
      test.ok(doc.id);
      test.done();
    },
  }),
  'Canape Merge Algorithm': testCase({
    'simple update': function(test) {
      var value = {
        _id: 'docid',
        exists: true
      };

      var doc = new Document();
      test.ok(doc.update(deepClone(value)));

      test.strictEqual(doc.id, 'docid');
      test.strictEqual(doc.rev.updateCount, 1);
      test.ok(doc.rev.hash);

      var compareValue = deepClone(doc.body);
      delete compareValue._rev;
      delete compareValue._meta;
      test.deepEqual(compareValue, value);
      test.done();
    },
    'conflicting update': function(test) {
      var value = {
        _id: 'docid',
        exists: true
      };

      var conflict = {
        _id: 'docid',
        somethingElse: true
      };

      var doc = new Document();
      test.ok(doc.update(deepClone(value)));
      test.ok(!doc.update(deepClone(conflict)));
      test.strictEqual(doc.numberOfConflicts, 0);

      var compareValue = deepClone(doc.body);
      delete compareValue._rev;
      delete compareValue._meta;
      test.deepEqual(compareValue, value);
      test.done();
    },
    'simple update replay': function(test) {
      var value = {
        _id: 'id',
        exists: true
      };

      var doc = new Document();
      test.ok(doc.update(deepClone(value)));
      test.ok(doc.update(deepClone(value)));

      test.strictEqual(doc.history.length, 0);
      test.strictEqual(doc.conflicts, undefined);
      test.ok(value.exists);

      var compareValue = deepClone(doc.body);
      delete compareValue._rev;
      delete compareValue._meta;
      test.deepEqual(compareValue, value);
      test.done();
    },
    'simple merge replay': function(test) {
      var value = {
        _id: 'id',
        exists: true
      };

      var doc = new Document();
      doc.merge(deepClone(value));
      doc.merge(deepClone(value));

      test.strictEqual(doc.history.length, 0);
      test.strictEqual(doc.conflicts, undefined);
      test.ok(value.exists);

      var compareValue = deepClone(doc.body);
      delete compareValue._rev;
      delete compareValue._meta;
      test.deepEqual(compareValue, value);
      test.done();
    },
    'simple merge update': function(test) {
      var docA = {
        _id: 'doc',
        a: true
      };
      var docB = {
        _id: 'doc',
        b: true
      }

      var revA = Revision.compute(docA);

      // make docB a successor of docA and compute its revision too
      docB._rev = docA._rev;
      var revB = Revision.compute(docB);

      // no stick docA into a Document and merge docB
      var doc = new Document(docA);
      doc.merge(docB);

      // check that we see the right revision (by attribute checking)
      test.ok(!doc.body.a);
      test.ok(doc.body.b);

      // check the correct revision
      test.strictEqual(doc.body._rev.toString(), revB.toString());

      // check that the meta object only contains a single history
      // and that this history is docA._rev
      test.strictEqual(JSON.stringify(doc.body._meta), JSON.stringify({
        history: [revA.toString()]
      }));

      test.done();
    }
  })
});

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}
