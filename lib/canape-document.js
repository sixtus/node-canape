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

var uuid = require('node-uuid');
var Revision = require('./canape-revision');

function Document(json) {
	if (typeof json === 'string') {
		json = JSON.parse(json);
	} else if (!json) {
    json = {};
  }

  if (typeof json !== 'object') {
		throw new Error('A document must be an object');
	}

  this._raw = json;
}

Document.maxHistorySize = 1000; // Couch's default
Document.generateId = uuid.v4; // Earliest form of pluggable algorithm

Document.prototype.__defineGetter__('id', function() {
	var id = this._raw._id;
	if (!id) {
		id = this._raw._id = Document.generateId();
	}
	return id;
});

Document.prototype.__defineGetter__('body', function() {
  return this._raw;
});

Document.prototype.__defineGetter__('deleted', function() {
  return this._raw.hasOwnProperty('_deleted');
});

Document.prototype.__defineGetter__('globallyDeleted', function() {
  return this._raw._deleted === true;
});

Document.prototype.__defineGetter__('conflicts', function() {
  if (this._raw._meta) {
    return this._raw._meta.conflicts;
  }
});

Document.prototype.__defineGetter__('history', function() {
  if (this._raw._meta && this._raw._meta.history) {
    return this._raw._meta.history;
  } else {
    return [];
  }
});

Document.prototype.validate = function() {
  this.id; // triggers getter which ensures an id

  var merge = new Merge();
  merge.addDocument(this._raw);
  this._raw = merge.finalize();
};

Document.prototype.merge = function(other) {
  var merge = new Merge();
  merge.addDocument(this._raw);
  merge.addDocument(other);
  this._raw = merge.finalize();
};

Merge = function() {
  this.history = {};
  this.live = [];
  this.liveHashes = {};
  this.lastHistorySize = 0;
  this.maxUpdateCount = 0;
}

Merge.prototype.addDocument = function(doc, ignoreMeta) {
  this.id = this.id || doc._id;

  var meta = doc._meta;

  if (this.addRevision(doc) && !ignoreMeta && meta) {
    this.addMeta(meta);

    if (!this.lastRev) {
      this.lastRev = doc._rev;
      if (meta.history) {
        this.lastHistorySize = meta.history.length;
      }
    }
  }
}

Merge.prototype.addMeta = function(meta) {
  for (var ii in meta.history) {
    this.addHistory(new Revision(meta.history[ii]));
  }
  for (var ii in meta.conflicts) {
    this.addDocument(meta.conflicts[ii], true);
  }
};

Merge.prototype.addHistory = function(rev) {
  this.history[rev.toString()] = rev;
  if (this.maxUpdateCount < rev.updateCount) {
    this.maxUpdateCount = rev.updateCount;
  }
};

Merge.prototype.addRevision = function(doc) {
  if (!doc._id || doc._id !== this.id) {
    console.warn('Merge ingoring', doc, 'check doc._id');
    return false;
  }

  delete doc._meta;

  var rev = Revision.compute(doc);
  if (rev.replaced) {
    this.addHistory(rev.replaced);
  }

  this.live.push(doc);

  if (!this.liveHashes[rev.hash] || this.liveHashes[rev.hash] < rev.updateCount) {
    this.liveHashes[rev.hash] = rev.updateCount;
    if (this.maxUpdateCount < rev.updateCount) {
      this.maxUpdateCount = rev.updateCount;
    }
  }

  return true;
};

function filterLiveOnly(testDoc) {
  return !testDoc.hasOwnProperty('_deleted');
}

Merge.prototype.finalize = function() {
  var liveVersions = [];

  for (var ii in this.live) {
    var doc = this.live[ii];
    var rev = doc._rev;

    // check if same hash, higher update count exists
    if (this.liveHashes[rev.hash] !== rev.updateCount) {
      this.addHistory(rev);
      continue;
    }

    // check if this revision is already in the history
    if (this.history[rev.toString()]) {
      continue;
    }

    liveVersions.push(doc);
  }

  // sort them by revision, last one is the winner, rest is conflicts
  liveVersions.sort(Revision.sort);
  var winner = liveVersions.pop();

  if (!winner) {
    // this should not happen, but we defend no live versions anyway
    winner = {
      _deleted: true
    };
    Revision.compute(winner);
  }

  // now remove all the tombstones from conflicts
  liveVersions = liveVersions.filter(filterLiveOnly);



  // now let's compute the final history set
  var finalHistory = [];
  for (ii in this.history) {
    finalHistory.push(this.history[ii]);
  }
  finalHistory.sort(Revision.sort);

  // make sure every visible update results in a version change
  if (this.lastRev &&
      finalHistory.length !== lastHistorySize &&
      this.lastRev.hash === winner._rev.hash && this.lastRev.updateCount === winner._rev.updateCount
  ) {
    finalHistory.push(new Revision(winner));
    winner._rev.updateCount++;
  }

  // populate winner._meta
  if (finalHistory.length || liveVersions.length) {
    winner._meta = {};
    if (finalHistory.length) {
      winner._meta.history = finalHistory.slice(-1 * Document.maxHistorySize);
    }
    if (liveVersions.lenght) {
      winner._meta.conflicts = liveVersions;
    }
  }

  return winner;
}

module.exports = Document;