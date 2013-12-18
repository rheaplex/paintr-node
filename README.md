* Create an OpenShift node app and add the Mongo and cron cartridges:

rhc cartridge add cron-1.4 -a APPNAME


* In OpenShift, install autotrace:

ssh [your OpenShift application]
cd $OPENSHIFT_DATA_DIR
wget http://mirror.centos.org/centos/6/os/x86_64/Packages/autotrace-0.31.1-26.el6.x86_64.rpm
rpm2cpio autotrace-0.31.1-26.el6.x86_64.rpm | cpio -idmv
exit


* And create a config (inserting the correct values...)

ssh [your OpenShift application]
mongo
use paintr
db.config.insert({
  mongo_uri:'mongodb://127.0.0.1:2701/paintr',
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
  autotrace_options: {env: 'LD_LIBRARY_PATH=$OPENSHIFT_DATA_DIR/usr/lib64/'},
  retries: 5
})
exit
exit


* Register a tumblr app, and authenticate here:

https://api.tumblr.com/console/

