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