"use strict";

var MongoClient = require('mongodb').MongoClient;

var fetch = function (callback) {
  MongoClient.connect('mongodb://127.0.0.1:27017/paintr', function(err, db) {
    if(err) throw err;
    var collection = db.collection('config');
    collection.find().sort({_id:1}).limit(1).nextObject(function (err, doc) {
      if (err) throw err;
      db.close();
      callback(doc);
    });
  });
};

module.exports.fetch = fetch;
