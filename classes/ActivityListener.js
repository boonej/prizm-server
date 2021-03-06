/**
 * ActivityListener Class
 *
 * @author  DJ Hayden <dj.hayden@stablekernel.com>
 */

/**
 * Module dependencies.
 */
var EventEmitter  = require('events').EventEmitter,
    _             = require('underscore'),
    _util         = require('util'),
    _mongoose     = require('mongoose'),
    _logger       = require(process.env.PRISM_HOME + 'logs.js'),
    Post          = require(process.env.PRISM_HOME + 'models/post').Post,
    User          = require(process.env.PRISM_HOME + 'models/user').User,
    Comment       = require(process.env.PRISM_HOME + 'models/post').Comment,
    Trust         = require(process.env.PRISM_HOME + 'models/trust').Trust,
    Push          = require(process.env.PRISM_HOME + 'classes/PushNotification'),
    Activity      = require(process.env.PRISM_HOME + 'models/activity').Activity;

/**
 * Expose `ActivityListener`.
 */
module.exports = ActivityListener;

/**
 * Initializes The `ActivityListener`
 *
 * @param {[type]} action [description]
 */
function ActivityListener(options){
  EventEmitter.call(this);
  var self = this;
  this.options = (!options) ? {} : options;

  process.on('activity', function(object){
    console.log('received activity event');
    if(typeof object.action !== 'undefined'){
      _logger.log('info', 'activity event emitted', object);
      self.activityHandler(object);

    }else{
      _logger.log('error', 'activity events object does not have a `type` property', object);
    }
  });
}

/**
 * Inherit from `EventEmitter.prototype`
 */
_util.inherits(ActivityListener, EventEmitter);

/**
 * Checks if NODE_ENV is set to test
 *
 * @return {Boolean}
 */
var isInTestMode = function(){
  if(process.env.NODE_ENV === 'test'){
    return true;
  }else{
    return false;
  }
};


/**
 * [activityHandler description]
 * @param  {[type]} activity [description]
 * @return {[type]}        [description]
 */
ActivityListener.prototype.activityHandler = function(activity){
  var self = this;
  if(activity.action && activity.to && activity.from){
    if(activity.to === activity.from) {
      console.log('to is same as from');
      //activity is to & from same user. do not send activity event
      return;

    } else {
      var new_activity = new Activity({
        to: activity.to,
        from: activity.from,
        action: activity.action,
      });
      if(_.has(activity, 'post_id'))
        new_activity.post_id = activity.post_id;

      if(_.has(activity, 'comment_id'))
        new_activity.comment_id = activity.comment_id;

      if(_.has(activity, 'insight_id')) {
        console.log('Received insight notification');
        new_activity.insight_id = activity.insight_id;
      }

      if (_.has(activity, 'insight_target_id')){
        new_activity.insight_target_id = activity.insight_target_id;
      }

      if (_.has(activity, 'group_id')) {
        new_activity.group_id = activity.group_id;
      }

      new_activity.save(function(err, saved){
        if(err){
          _logger.log('error', 'Error occured saving new activity',
                      {activity:activity});
          console.log('could not save activity');
          console.log(err);
          return;
        }
        if(!saved){
          _logger.log('error', 'There was no saved record returned - server error?',
                      {error:err, saved:saved, activity:activity});
          console.log('there was no record returned');
          return;
        }

        _logger.log('info', 'Successfully created '+saved.action+' activity',
                    {saved_activity:saved});

        console.log('sending push');
        new Push('activity', saved, function(result){
          console.log('push sent');
          _logger.log('info', 'Push notification result', result);
        });

        if(saved.action === 'comment' || saved.action === 'like' || saved.action === 'tag')
          self.updateTrust(saved);
      });
    }
  }else{
    _logger.log('error', 'Activity action, to, & from, must be set to create'+
                          ' a new activity record', {activity: activity});
  }
};

/**
 * [activityHandler description]
 * @param  {[type]} object [description]
 * @return {[type]}        [description]
 */

ActivityListener.prototype.updateTrust = function(activity){
  var to_user = activity.to.toString();
  var from_user = activity.from.toString();
  if(to_user && from_user){
    Trust.findTrust(to_user, from_user, function(err, trust){
      if(err){
        _logger.log('error',
                    'An error occured while trying to retrieve trust from activity listener',
                    {error: err});

      }else if(trust){
        var save = false;
        if(activity.from.toString() === trust.to.toString()){
          if(activity.post_id){

            if(activity.action === 'comment'){
              trust.to_comments.push({_id: activity.post_id});
              trust.to_comments_count++;
              save = true;
            }

            if(activity.action === 'like' && !activity.comment_id){
              trust.to_post_likes.push({_id: activity.post_id});
              trust.to_likes_count++;
              save = true;
            }

            if(activity.action === 'like' && activity.comment_id){
              trust.to_comment_likes.push({_id: activity.post_id});
              trust.to_likes_count++;
              save = true;
            }
            if(activity.action === 'tag' && activity.post_id){
              trust.to_posts.push({_id: activity.post_id});
              trust.to_posts_count++;
              save = true;
            }
          }
        }

        if(activity.from.toString() === trust.from.toString()){
          if(activity.post_id){

            if(activity.action === 'comment'){
              trust.from_comments.push({_id: activity.post_id});
              trust.from_comments_count++;
              save = true;
            }

            if(activity.action === 'like' && !activity.comment_id){
              trust.from_post_likes.push({_id: activity.post_id});
              trust.from_likes_count++;
              save = true;
            }

            if(activity.action === 'like' && activity.comment_id){
              trust.from_comment_likes.push({_id: activity.post_id});
              trust.from_likes_count++;
              save = true;
            }

            if(activity.action === 'tag' && activity.post_id){
              trust.from_posts.push({_id: activity.post_id});
              trust.from_posts_count++;
              save = true;
            }
          }
        }

        if(save){
          var log_info = {activity:activity, trust:trust};

          trust.save(function(err, saved){
            if(err) _logger.log('error',
                                'Error saving trusts in activitylistener',
                                log_info);

            if(saved){
              _logger.log('info',
                          'Updated Trust via ActivityListener',
                          log_info);
            }
          });
        }

      }else{
        _logger.log('info', 'Did not find trust for users: '+to_user+
                            ' and '+from_user);
      }
    });
  }else{
    _logger.log('error', 'ActivityListner.updateTrust needs both params: to_user & from_user');
  }
};
