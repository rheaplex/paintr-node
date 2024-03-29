"use strict";

var child_process = require('child_process');
var fs = require('fs');
var util = require('util');
var zlib = require('zlib');
var _ = require("underscore");
var request = require('request');
var retry = require('retry');
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

var mongo_uri = null
var config = null;

var operation = retry.operation ({ factor: 1 });

var go = function (uri) {
  mongo_uri = uri;
  Config.fetch(mongo_uri, receiveConfig);
};

var receiveConfig = function (c) {
  config = c;
  operation.attempt (function(currentAttempt) {
    fetchPaletteFromColr();
  });
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
                        operation.retry("Couldn't find photo for tags.");
                        return;
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
  return config.working_directory + '/' + state.run_id + "_flickr.jpg";
}

var rasterisedSVGFilepath = function () {
  return config.working_directory + '/' + state.run_id + "_svg.png";
}

var cleanup = function () {
  fs.unlink (workingPhotoFilepath(), function (err) {});
  fs.unlink (rasterisedSVGFilepath(), function (err) {});
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
  rasteriseImage();
};

var describeImage = function () {
  var description = util.format('I found a <a href="http://www.colr.org/scheme/%s">palette</a> with the tags %s at colr.org.<br />Using these tags I found an image on flickr called <a href="http://www.flickr.com/photos/%s/%s/">%s</a> by %s.<br />I then autotraced it and coloured it with the palette.<br />Licensed <a href="http://creativecommons.org/licenses/by-sa/4.0/">CC-BY-SA</a>.',
                                state.palette.id,
                                state.palette.tags.join(", "),
                                state.photo.owner,
                                state.photo.id,
                                state.photo.title,
                                state.photo_details.owner.username);

  return description;
};

var rasteriseImage = function () {
  // ImproveMe: read "png:-" directly using convert.on.stdout
  //            I didn't manage to get this working in the time available
  // None of the imagemagick node.js libraries are suitable
  // Most use file paths anyway
  // gm gives low quality output and buffers that tumblrwrks gets 401s for (!) 
  // imagemagick-native requires libmagick++, which isn't on OpenShift
  var convert = child_process.spawn("convert", ["svg:-",
                                                rasterisedSVGFilepath()]);
  convert.on('close', function (code) {
    fs.readFile(rasterisedSVGFilepath(),
                function (err, data) {
      if (err) throw err;
      cleanup();
      sendToTumblr(data);
    });
  });
  convert.stdin.write(state.svg);
  convert.stdin.end();
};

var sendToTumblr = function (raster) {
  var tumblr = new Tumblr(
  {
    consumerKey: config.tumblr_consumer_key,
    consumerSecret: config.tumblr_consumer_secret,
    accessToken: config.tumblr_access_token,
    accessSecret: config.tumblr_access_secret
  }, config.tumblr_blog_url);
  //var svg = state.svg.replace(/<\?xml[^\?]+\?>/, '');
  //var body = util.format('%s<br />%s',
  //                       svg,
  //                       state.description);
  var caption = '<strong>' + state.run_id + '</strong><br /><small>'
      + state.description + '</small>';
  var post = { type: 'photo',
               //title: state.run_id,
               tags: state.palette.tags.join(','),
               // Having caption here breaks the request!!!
               // So we upload the photo then add the caption later, see below
               //caption: caption,
               data: [raster],
              };
  tumblr.post('/post', post, function(err, result){
    if (err) throw err;
    state.tumblr_post_id = result.id;
    // Because having the caption in the initial request breaks tumblrwrks with:
    // Error: {"meta":{"status":401,"msg":"Not Authorized"},"response":[]}
    // we submit the image then immediately edit it to add the caption.
    tumblr.post('/post/edit', {id:state.tumblr_post_id,
                               caption: caption},
                function(err, result){});
    saveToMongo();
  });
};

var saveToMongo = function () {
  // Compress before archiving
  // No, it will take ages to fill a Gigabyte
  //zlib.gzip(state.svg, function(err, buffer) {
  //  if (err) throw err;
  //  state.svg = buffer.toString();
  //});
  MongoClient.connect(mongo_uri, function(err, db) {
    if(err) throw err;
    var collection = db.collection('paintr');
    collection.insert(state, function (err, doc) {
      if (err) throw err;
      db.close();
    });
  });
};

module.exports.go = go;
