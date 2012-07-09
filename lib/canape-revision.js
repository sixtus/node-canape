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

var crypto = require('crypto');

var revPattern = /(\d+)(-(.+))?/;
var hashUnderscoredKeys = {
  _attachments: true
};

/*
 * Revision is a helper class for managing deterministic revision numbers.
 *
 * A revision is composed out of an update count, a '-', and the first 10 digits
 * of the body's md5.
 *
 * @see `Revision.compute` for details on how the hash is computed.
 */
function Revision(revSource, optionalHash) {
  // sanitize optionalHash
  if (optionalHash) {
    optionalHash = optionalHash.toString().substring(0, 10);
  }

  if (revSource instanceof Revision) {
    this.updateCount = revSource.updateCount;
    this.hash = revSource.hash;
  } else if (Array.isArray(revSource)) {
    return Revision.uniq(revSource);
  } else if (!optionalHash && revSource && typeof revSource === 'object') {
    return Revision.compute(revSource);
  } else if (revSource) {
    var match = (revSource._rev || revSource).toString().match(revPattern);
    if (match) {
      this.updateCount = match[1] | 0;
      this.hash = (match[3] || optionalHash);
      if (revSource._rev) {
        this.source = revSource;
      }
    }
  }

  // ensure updateCount is a number
  this.updateCount = this.updateCount | 0;

  // see if the optionalHash would cause a new revision
  if (optionalHash && optionalHash !== this.hash) {
    this.replaced = this.toString();
    this.updateCount++;
    this.hash = optionalHash;
  } else if (!this.hash) { // make sure hash is set
    this.hash = '0000000000';
  } else { // sanitize hash
    this.hash = this.hash.substring(0, 10);
  }
}

Revision.prototype.toJSON = Revision.prototype.toString = function() {
  return this.updateCount + '-' + this.hash;
};

/*
 * Revision have a total order. This method implements it.
 *
 * Usage: arrayOfRevisions.sort(Revision.sort)
 */
Revision.sort = function(a, b) {
  if (!(a instanceof Revision)) {
    a = new Revision(a);
  }
  if (!(b instanceof Revision)) {
    b = new Revision(b);
  }

  if (a.updateCount < b.updateCount) {
    return -1;
  } else if (a.updateCount > b.updateCount) {
    return 1;
  } else if (a.hash === b.hash) {
    return 0;
  } else {
    return a.hash < b.hash ? -1 : 1;
  }
};

/*
 * Returns a sorted array of unique revisions
 */
Revision.uniq = function(source) {
  // uniqing anything but an array doesn't make a lot of sense
  if (!Array.isArray(source)) {
    return new Revision(source);
  }

  // copy into a uniquing data structure
  var uniqer = [];
  for (var ii = 0; ii < source.length; ii++) {
    var curRev = source[ii];
    if (!(curRev instanceof Revision)) {
      curRev = new Revision(curRev);
    }
    var countUniq = uniqer[curRev.updateCount] = uniqer[curRev.updateCount] || {};
    countUniq[curRev.hash] = curRev;
  }

  // now pull it back out of it in sorted order
  var result = [];
  for (ii in uniqer) {
    var revs = uniqer[ii];
    var keys = Object.keys(revs).sort();
    for (var jj in keys) {
      result.push(revs[keys[jj]]);
    }
  }

  return result;
};

/*
 * The actual revision computation algorithm.
 *
 * For the document itself, all keys starting with '_' are ignored.
 * Exceptions:
 * '_attachments' is included for CouchDb compatibility.
 *
 * No key is ignored on embedded objects.
 *
 * The hash algorithm is equivalent of an md5 of the utf8 representation of the
 * document with all ignored keys omitted.
 *
 * To make the hash deterministic, all objects (both the outer document and all
 * embedded objects) are serialized with sorted key order.
 *
 * The key order is defined as Object.keys(obj).sort().
 */
Revision.compute = function(source, hash) {
  var outer = !hash;
  var ii;

  hash = hash || crypto.createHash('md5');

  if (Array.isArray(source)) {
    hash.update('[', 'utf8');
    for (ii = 0; ii < source.length;) {
      Revision.compute(source[ii], hash);
      if (++ii != source.length) {
        hash.update(',', 'utf8');
      }
    }
    hash.update(']', 'utf8');
    return;
  } else if (source && typeof source === 'object') {
    var keys = Object.keys(source).sort();
    hash.update('{', 'utf8');
    for (ii = 0; ii < keys.length;) {
      var key = keys[ii];
      if (!outer || key[0] !== '_' || hashUnderscoredKeys[key]) {
        hash.update(JSON.stringify(key) + ':', 'utf8');
        Revision.compute(source[key], hash);
        if (++ii != keys.length) {
          hash.update(',', 'utf8');
        }
      } else {
        ++ii;
      }
    }
    hash.update('}', 'utf8');
  } else {
    hash.update(JSON.stringify(source), 'utf8');
    return;
  }

  if (outer) {
    return source._rev = new Revision(source, hash.digest('hex'));
  }
};

module.exports = Revision;
