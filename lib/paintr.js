"use strict";

var child_process = require('child_process');
var fs = require('fs');
var util = require('util');
var zlib = require('zlib');
var _ = require("underscore");
var request = require('request');
var Flickr = require("node-flickr");
var MongoClient = require('mongodb').MongoClient;
var Tumblr = require('tumblrwks');

var colr = require('../lib/colr.js');
var Config = require('../lib/config.js');

// The module encapsulates this.
// And we can avoid callback function 'this' problems and endless wrappers
// by using functions that refer to it directly.
var state = {
  // This will be called approximately once a day, so is fine
  run_id: (new Date).getTime()
};

var config = null;

var go = function (mongo_url) {
  Config.fetch(mongo_url, receiveConfig);
};

var receiveConfig = function (c) {
  config = c;
  fetchPaletteFromColr();
};

var fetchPaletteFromColr = function () {
  var c = new colr();
  c.newPalette(receivePaletteFromColr);
};

var receivePaletteFromColr = function (palette) {
  state.palette = palette;
  fetchImageFromFlickr();
};

var flickrPhotoUrl = function () {
  return  "http://farm" + state.photo.farm + ".staticflickr.com/"
    + state.photo.server + "/" + state.photo.id + "_"
    + state.photo.secret + "_" + config.flickr_image_size + ".jpg";
};

var searchFlickr = function (flickr) {
  return flickr.get("photos.search",
                    {tags: state.palette.tags.join(','),
                     license: 5, // CC-BY-SA
                     page: 1,
                     per_page: 50},
                    function(result) {
                      if (result.photos.photo.length == 0) {
                        throw "Couldn't find matching photo!";
                      }
                      state.photo = _.sample(result.photos.photo);
                      fetchFlickrPhotoDetails(flickr);
                    });
};

var fetchFlickrPhotoDetails = function(flickr) {
  return flickr.get("photos.getInfo",
                    {photo_id: state.photo.id,
                     secret: state.photo.secret},
                    function(result) {
                      if(result.photo.license != 5) throw "Wrong license!";
                      state.photo_details = result.photo;
                      fetchFlickrPhoto(flickr);
                    });
};

var workingPhotoFilepath = function () {
  return config.working_directory + '/' + state.run_id + ".jpg";
}

var cleanup = function () {
  fs.unlink(workingPhotoFilepath());
};

var fetchFlickrPhoto = function(flickr) {
  var photo_url = flickrPhotoUrl(state.photo);
  var file = fs.createWriteStream(workingPhotoFilepath());
  var response = request(photo_url);
  response.pipe(file);
  response.on('end', function() {
    autotraceImage();
  });
};

var fetchImageFromFlickr = function () {
  var flickr = new Flickr({api_key: config.flickr_api_key});
  searchFlickr(flickr);
};

var autotraceArgs = function () {
  var args = _.clone(config.autotrace_args);
  args.push('--color-count', state.palette.palette.length,
             workingPhotoFilepath());
  return args;
};

var autotraceImage = function () {
  var svg = '';
  var autotrace = child_process.spawn(config.autotrace_command,
                                      autotraceArgs(),
                                      config.autotrace_options);
  autotrace.stdout.on('data', function (data) {
    svg += data.toString();
  });
  autotrace.on('close', function (code) {
    state.imagewidth = svg.match(/<svg[^>]+width="([^"]+)"/)[1];
    state.imageheight = svg.match(/<svg[^>]+height="([^"]+)"/)[1];
    recolourImage(svg);
    cleanup();
  });
};

function replaceColour(match){
  return 'style=\"fill: #'
    + _.sample(state.palette.palette)
    + '; stroke: none;\"';
};

var recolourImage = function (data) {
  var recoloured = data.replace(/style\s*=\s*"[^"]+"/g, replaceColour);
  state.svg = recoloured;
  state.description = describeImage();
  sendToTumblr();
};

var describeImage = function () {
  var description = util.format('<small>I found a <a href="http://www.colr.org/scheme/%s">palette</a> with the tags %s at colr.org.<br />Using these tags I found an image on flickr called <a href="http://www.flickr.com/photos/%s/%s/">%s</a> by %s.<br />I then autotraced it and coloured it with the palette.<br />Licensed <a href="http://creativecommons.org/licenses/by-sa/4.0/">CC-BY-SA</a>.<small>',
                                state.palette.id,
                                state.palette.tags.join(", "),
                                state.photo.owner,
                                state.photo.id,
                                state.photo.title,
                                state.photo_details.owner.username);

  return description;
};

var saveToMongo = function () {
  // Compress before archiving
  // No, it will take ages to fill a Gigabyte
  //zlib.gzip(state.svg, function(err, buffer) {
  //  if (err) throw err;
  //  state.svg = buffer.toString();
  //});
  MongoClient.connect(config.mongo_uri, function(err, db) {
    if(err) throw err;
    var collection = db.collection('paintr');
    collection.insert(state, function (err, doc) {
      if (err) throw err;
      db.close();
    });
  });
};

var sendToTumblr = function () {
  var tumblr = new Tumblr(
  {
    consumerKey: config.tumblr_consumer_key,
    consumerSecret: config.tumblr_consumer_secret,
    accessToken: config.tumblr_access_token,
    accessSecret: config.tumblr_access_secret
  }, config.tumblr_blog_url);
  var body = util.format('%s<br />%s',
                         state.svg,
                         state.description);
  var post = { type: 'text',
               title: state.run_id,
               tags: state.palette.tags.join(','),
               body: body
              };
  tumblr.post('/post', post, function(err, result){
    if (err) throw err;
    state.tumblr_post_id = result.id;
    saveToMongo();
  });
};

module.exports.go = go;
