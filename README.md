This is the node.js reimplementation of paintr.

It runs on OpenShift and posts images to tumblr. 

You will need accounts on flickr, OpenShift and tumblr to use it.
OpenShift is free software, the others aren't.

Some notes on installation follow.


* Register a flickr app and get the token here:

http://www.flickr.com/services/apps/create/


* Register a tumblr app, and authenticate here:

https://api.tumblr.com/console/


* Register for OpenShift here:

https://www.openshift.com/app/account/new


* Create an OpenShift node app:

rhc app create APPNAME nodejs-0.10
rhc cartridge add mongodb-2.2 -a APPNAME
rhc cartridge add cron-1.4 -a APPNAME


* In OpenShift, install autotrace:

ssh [your OpenShift application]
cd $OPENSHIFT_DATA_DIR
wget http://mirror.centos.org/centos/6/os/x86_64/Packages/autotrace-0.31.1-26.el6.x86_64.rpm
rpm2cpio autotrace-0.31.1-26.el6.x86_64.rpm | cpio -idmv
exit


* And create a config (inserting the correct values...):

ssh [your OpenShift application]
mongo
use paintr
db.config.insert({
  mongo_uri:'',
  flickr_api_key: '',
  flickr_image_size: 'z',
  tumblr_consumer_key: '',
  tumblr_consumer_secret: '',
  tumblr_access_token: '',
  tumblr_access_secret: '',
  tumblr_blog_url: '.tumblr.com',
  working_directory: '/tmp',
  autotrace_command: 'autotrace',
  autotrace_args: ['--output-format', 'svg',
				   '--despeckle-level',  '10'],
  autotrace_options: {},
  retries: 5
})
exit
exit


