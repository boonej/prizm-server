/**
 * User Model
 *
 * @author DJ Hayden <dj.hayden@stablekernel.com>
 */
var _mongoose   = require('mongoose'),
    _serial     = require('serializer'),
    _crypt      = require('crypto'),
    _prism_home = process.env.PRISM_HOME,
    _           = require('underscore'),
    Trust       = require(_prism_home + 'models/trust').Trust,
    ObjectId    = _mongoose.Schema.Types.ObjectId,
    mObjectId   = _mongoose.Types.ObjectId,
    _utils      = require(_prism_home + 'utils');

var moment = require('moment');
var _ = require('underscore');
var path = require('path');
var fs = require('fs');
var jade = require('jade');
var config = require('config');
var welcomeMail = fs.readFileSync(path.join(__dirname + 
      '/../views/welcome.jade'), 'utf8');
var consentMail = path.join(__dirname + '/../views/consent.jade');
var nonOrgConsentMail = path.join(__dirname + '/../views/non_org_consent.jade');
var mandrill = require('node-mandrill')(config.mandrill.client_secret);
var mandrillEndpointSend = '/messages/send';
var util = require('util');
var baseMail = path.join(__dirname, '/../views/base.jade');
var iPush = require('../classes/i_push');
var ownerGreeting = 'Dear %s,';
var ownerBody1 = '%s has requested to join %s\'s Prizm group. Please go to your admin page <a href="https://www.prizmapp.com/profile/members">here</a> to approve or deny.';
var ownerBody1Alt = '%s has just joined %s\'s Prizm group. Please go to your admin page <a href="https://www.prizmapp.com/profile/members">here</a> to review your members.';
var ownerClosing = 'Thank you,';
var ownerPush = 'has requested to join your Prizm group. Please go to your admin page to approve or deny.';
var ownerPushAlt = 'has just joined your Prizm group. Please go to your admin page to review your members.';
var notify = require(_prism_home + 'lib/helpers/notify');
var uuid      = require('node-uuid');


var orgStatusSchema = new _mongoose.Schema({
  organization          : {type: ObjectId, ref: 'Organization', required: true},
  status                : {type: String, default: 'pending', required: true},
  create_date           : {type: Date, default: Date.now()},
  groups                : [ObjectId],
  role                  : {type: String},
  member_id             : {type: String} 
});

orgStatusSchema.statics.selectFields = function(type){
  return ['_id', 'organization', 'status', 'create_date', 'groups', 'role'];
};

orgStatusSchema.statics.canResolve = function(){
  return [
    {organization: {identifier: '_id', model: 'Organization'}},
    {groups: {identifier: '_id' , model: 'Group'}}
  ];
};


orgStatusSchema.methods.format = function(type, add_fields, callback){
  return {

    organization: this.organization,
    status      : this.status,
    create_date : this.create_date
  }

};


var userSchema = new _mongoose.Schema({
  name                  : {type: String, default: ''},
  first_name            : {type: String, required: true},
  last_name             : {type: String, default: ''},
  email                 : {type: String, required: true,
                          index: {unique: true}, lowercase: true},
  info                  : {type: String, default: null},
  website               : {type: String, default: null},
  ethnicity             : {type: String, default: null},
  religion              : {type: String, default: null},
  phone_number          : {type: String, default: null},
  affiliations          : {type: Array, default:[]},
  password              : {type: String, default: null},
  provider              : {type: String, default: null},
  provider_id           : {type: String, default: null},
  provider_token        : {type: String, default: null},
  provider_token_secret : {type: String, default: null},
  last_provider_auth    : {type: Date, default: null},
  gender                : {type: String, default: null},
  birthday              : {type: String, default: null},
  address               : {type: String, default: null},
  city                  : {type: String, default: null},
  country               : {type: String, default: null},
  state                 : {type: String, default: null},
  zip_postal            : {type: String, default: null},
  cover_photo_url       : {type: String, default: ''},
  profile_photo_url     : {type: String, default: ''},
  create_date           : {type: Date, default: null},
  modify_date           : {type: Date, default: null},
  delete_date           : {type: Date, default: null},
  last_login_date       : {type: Date, default: null},
  posts_count           : {type: Number, default: 0},
  following             : [{_id: ObjectId, date: Date}], 
  followers             : {type: Array, default: []},
  following_count       : {type: Number, default: 0},
  followers_count       : {type: Number, default: 0},
  trust_count           : {type: Number, default: 0},
  type                  : {type: String, default: 'user'},
  date_founded          : {type: Date, default: null},
  mascot                : {type: String, default: null},
  enrollment            : {type: Number, default: null},
  instagram_token       : {type: String, default: null},
  instagram_min_id      : {type: String, default: null},
  twitter_token         : {type: String, default: null},
  twitter_min_id        : {type: String, default: null},
  tumblr_token          : {type: String, default: null},
  tumblr_min_id         : {type: String, default: null},
  tumblr_token_secret   : {type: String, default: null},
  review_key            : {type: String, default: null},
  reset_key             : {type: String, default: null},
  reset_date            : {type: String, default: null},
  password_reset        : {type: String, default: null},
  device_token          : {type: String, default: null},
  subtype               : {type: String, default: null},
  badge_count           : {type: Number, default: 0},
  active                : {type: Boolean, default: true},
  program_code          : {type: String, default: null},
  interests             : {type: Array, default: []},
  insight_count         : {type: Number, default: 0},
  organization          : {type: ObjectId, ref: 'Organization', required: false},
  theme                 : {type: ObjectId, ref: 'Theme', required: false}, 
  unsubscribed          : {type: Boolean, default: false},
  age                   : {type: Number, default: 0},
  pwd_updated           : {type: Boolean, default: false},
  org_status            : {type: Array, default: []},
  visibility            : {type: String, default: null},
  contact_first    : {type: String, default: null},
  push_enabled      : {type: Boolean, default: false},
  contact_last     : {type: String, default: null},
  contact_email         : {type: String, default: null},
  google_devices  : {type: Array, default: []},
  parent_contact        : {
    first: {type: String},
    last: {type: String},
    email: {type: String}
  }, 
},{ versionKey          : false });

userSchema.statics.canResolve = function(){
  return [
    {following: {identifier: '_id' , model: 'User'}},
    {followers: {identifier: '_id' , model: 'User'}},
    {trusts: {identifier: 'user_id', model: 'User'}},
    {interests: {model: 'Interest', identifier: '_id'}},
    {theme: {identifier: '_id', model: 'Theme'}},
    {organization: {identifier: '_id', model: 'Organization'}},
    {'org_status.organization': {identifier: '_id', model: 'Organization'}},
    {'org_status.groups': {identifier: '_id', model: 'Group'}}
  ];
};

userSchema.statics.selectFields = function(type){
  if(type === 'short'){
    return ['_id','name','first_name','last_name','profile_photo_url','type', 
      'active', 'insight_count', 'birthday', 'subtype', 'visibility', 'org_status'];
  }else if(type === 'basic'){
    return ['_id','name','first_name','last_name','profile_photo_url',
            'cover_photo_url','email','info','website','city','state',
            'create_date','posts_count', 'active' ,'following_count','followers_count',
            'instagram_min_id', 'instagram_token', 'twitter_token',
            'twitter_min_id','type', 'device_token', 'subtype', 'trust_count',
            'tumblr_min_id', 'tumblr_token', 'tumblr_token_secret', 'interests',
            'insight_count', 'theme', 'organization', 'birthday', 'org_status', 'visibility', 'contact_first', 'contact_last', 'contact_email'];
  }else if(type == 'advanced'){
    return ['_id','name','first_name','last_name','profile_photo_url',
            'cover_photo_url','email','info','website','city','state',
            'create_date','posts_count', 'active' ,'following_count','followers_count',
            'instagram_min_id', 'instagram_token', 'twitter_token',
            'twitter_min_id','type', 'device_token', 'followers', 'following', 'subtype', 'trust_count',
            'tumblr_min_id', 'tumblr_token', 'tumblr_token_secret', 'interests',
            'insight_count', 'theme', 'organization', 'birthday', 'org_status', 'visibility', 'contact_first', 'contact_last', 'contact_email'];

  }
  else{
    return ['_id','name','first_name','last_name','profile_photo_url',
            'cover_photo_url','email','info','website','city','state',
            'create_date','posts_count','following_count','followers_count',
            'provider','provider_id','provider_token', 'instagram_token',
            'instagram_min_id', 'twitter_token', 'twitter_min_id',
            'provider_token_secret','gender','birthday','address','country',
            'modify_date','delete_date','active','password', 'type', 'device_token',
            'subtype', 'trust_count', 'tumblr_min_id', 'tumblr_token',
            'tumblr_token_secret', 'program_code', 'interests', 'insight_count', 
            'theme', 'organization','pwd_updated','org_status','visibility', 'contact_first', 'contact_last', 'contact_email'];
  }
};

userSchema.statics.findOneCore = function(uid, requestor, next) {
  var Organization = _mongoose.model('Organization');
  var primaryOrg = false;
  var model = this.model('User');
  model.findOne({_id: uid})
  .select({_id: 1, name: 1, first_name: 1, last_name: 1, profile_photo_url: 1, 
    cover_photo_url: 1, zip_postal: 1, info: 1, website: 1, gender: 1,
    birthday: 1, phone_number: 1, program_code: 1, ethnicity: 1, religion: 1, 
    date_founded: 1, mascot: 1, enrollment: 1, contact_first: 1, 
    contact_last:1 , contact_email: 1, email: 1, info: 1, city: 1, state: 1, 
    active: 1, subtype: 1, type: 1, interests: 1, posts_count: 1, 
    followers_count: 1, following_count: 1, 
    followers: {$elemMatch: {_id: requestor}},
   org_status: {$elemMatch: {status: 'active'}}})
  .exec(function(err, user){
    if (user && user.type == 'user') {
      model.populate(user, {path: 'org_status.organization', model: 'Organization'}, 
        function(err, user) {
          model.populate(user, {path: 'org_status.organization.theme', model: 'Theme'}, 
            function(err, user){
              user = user.toObject();
              if (user.org_status.length > 0) {
                user.primary_organization = user.org_status[0].organization._id;
                user.theme = user.org_status[0].organization.theme.background_url;
                user.role = user.org_status[0].role;
                var muted = false;
                _.each(user.org_status[0].organization.mutes, function(mute){
                  if (String(user._id) == String(mute)) {
                    muted = true;
                  }
                });
                delete user.org_status;

                user.allMuted = muted;
              }
              user.is_following = user.followers.length > 0;
              delete user.followers;
              user.interest_count = _.isArray(user.interests)?user.interests.length:0;
              delete user.interests;

              next(err, user);
            });
      });
    } else if (user && user.type == 'institution_verified') {
      Organization.findOne({owner: user._id})
      .populate({path: 'theme', model: 'Theme'})
      .exec(function(err, org){
        user = user.toObject();
        if (org){
          user.primary_organization = org._id;
          user.theme = org.theme.background_url;
          user.role = 'owner';
          user.date_founded = user.date_founded?moment(user.date_founded).calendar():null;
          var muted = false;
          _.each(org.mutes, function(mute){
                  if (String(user._id) == String(mute)) {
                    muted = true;
                  }
                });
                user.allMuted = muted;

          
        }
        user.interest_count = _.isArray(user.interests)?user.interests.length:0;
        user.is_following = user.followers.length > 0;
        delete user.followers;
        next(err, user);
      });
    } else {
      user = user.toObject();
      user.interest_count = _.isArray(user.interests)?user.interests.length:0;
      user.is_following = user.followers.length > 0;
              delete user.followers;
     next(err, user);
    }
  });

};

userSchema.statics.resolvePostTags = function(post, next){
  var postText = post.text || '';
  var commentText = [];
  if (post.comments) {
    commentText = _.pluck(post.comments, 'text');
  }
  commentText.push(postText);
  var userArray = [];
  _.each(commentText, function(comment, idx, list){
    var match = comment.match(/@\S{24}/g);  
    if (match) {
      _.each(match, function(item, idx, list){
        userArray.push(item.substr(1));  
      });
    }
  });
  this.model('User').find({_id: {$in: userArray}}, '_id name', function(err, users){
    next(err, users);
  });
};


userSchema.statics.updateTrustCount = function(user_id, callback){
  this.findOne({_id: user_id}).exec(function(err, user){
    if(err){
      callback(err, null);
    }else{
      Trust.fetchUserTrustCount(user._id.toString(), function(err, count){
        if(err){
          callback(err, null);
        }else{
          if(typeof(count) === 'string') count = parseInt(count);
          if(user.trust_count !== count){
            user.trust_count = count;
            user.save(function(err, saved){
              if(err){
                callback(err, null);
              }else{
                callback(null, true);
              }
            });
          }else{
            callback(null, false);
          }
        }
      });
    }
  });
};

userSchema.statics.updateBadgeCount = function(user_id, number, callback){
  this.update({_id: user_id}, {$set : {badge_count : number}}, function(error, update){
    callback(error, update);
  });
};

userSchema.path('type').validate(function(value){
  return /user|institution|luminary/i.test(value);
});

userSchema.post('init', function(user){
  var $this = this;
  if (this.org_status && this.org_status.length > 0) {
    _.each(this.org_status, function(o, i, l){
      o.member_id = String($this._id);
    });
  }
  var r = new RegExp('https:/s');
  if (user.profile_photo_url) {
    user.profile_photo_url = user.profile_photo_url.replace(r, 'https://s');
  }
  if (user.cover_photo_url) {
    user.cover_photo_url = user.cover_photo_url.replace(r, 'https://s');
  }
  var genabled = user.google_devices && user.google_devices.length > 0;
  if (!user.device_token && !genabled) {
    user.push_enabled = false;
  }
});

userSchema.methods.format = function(type, add_fields, callback){
  var format;
  if(!type) type = 'basic';

  if(type === 'short'){
    format = {
      _id:    this._id,
      name:   this.name,
      first_name: this.first_name,
      last_name: this.last_name,
      profile_photo_url: this.profile_photo_url,
      type: this.type,
      active: this.active,
      insight_count: this.insight_count,
      subtype: this.subtype,
      interests: this.interests
    };
  }

  if(type === 'basic' || type === 'internal' || type === 'advanced'){
    format = {
      _id:                  this._id,
      name:                 this.name,
      first_name:           this.first_name,
      last_name:            this.last_name,
      birthday:             this.birthday,
      gender:               this.gender,
      email:                this.email,
      info:                 this.info,
      website:              this.website,
      city:                 this.city,
      state:                this.state,
      cover_photo_url:      this.cover_photo_url,
      profile_photo_url:    this.profile_photo_url,
      create_date:          this.create_date,
      posts_count:          this.posts_count,
      following_count:      this.following_count,
      followers_count:      this.followers_count,
      trust_count:          this.trust_count,
      type:                 this.type,
      instagram_token:      this.instagram_token,
      instagram_min_id:     this.instagram_min_id,
      twitter_token:        this.twitter_token,
      twitter_min_id:       this.twitter_min_id,
      tumblr_token:         this.tumblr_token,
      tumblr_min_id:        this.tumblr_min_id,
      tumblr_token_secret:  this.tumblr_token_secret,
      device_token:         this.device_token,
      subtype:              this.subtype,
      active:               this.active,
      program_code:         this.program_code,
      interests:            this.interests,
      insight_count:        this.insight_count,
      theme:                this.theme,
      pwd_updated:          this.pwd_updated,
      org_status:           this.org_status,
      visibility:           this.visibility,
      contact_first:        this.contact_first,
      contact_last:         this.contact_last,
      contact_email:        this.contact_email
    };
  }

  if(type === 'internal'){
    format.password               = this.password;
    format.provider               = this.provider;
    format.provider_id            = this.provider_id;
    format.provider_token         = this.provider_token;
    format.provider_token_secret  = this.provider_token_secret;
    format.gender                 = this.gender;
    format.birthday               = this.birthday;
    format.address                = this.address;
    format.country                = this.country;
    format.modify_date            = this.modify_date;
  }

  if(add_fields){
    if(typeof add_fields === 'string') format[add_fields] = this[add_fields];
    if(Array.isArray(add_fields) && add_fields.length > 0){
      for(var i=0; i < add_fields.length; i++){
        format[add_fields[i]] = this[add_fields[i]];
      }
    }
  }
  return format;
};

userSchema.methods.short = function(fields){
  var response = this.shortUser();

  if(fields){
    for(var index in fields){
      response[fields[index]] = this[fields[index]];
    }
  }
  return response;
};

userSchema.methods.createUserSalt = function(){
  return _serial.stringify(this._id+this.create_date.valueOf()+this.email);
};

userSchema.methods.hashPassword = function(){
  if(this.password) {
    var salt = process.env.PRIZM_SALT;
    var pass = this.password;
    this.password = _utils.prismEncrypt(this.password, salt);
    this.pwd_updated = true;
    if (this.password != pass){
      return true;
    }
  }
  return false;
}

userSchema.methods.hashPasswordOld = function(){
  if(this.password && this.create_date && this.email){
    var user_salt = this.createUserSalt();
    var old_pass = this.password;
    this.password = _utils.prismEncrypt(this.password, user_salt);
    if(this.password != old_pass && this.password.length > old_pass.length){
      return true;
    }
  }
  return false;
};

userSchema.methods.findByFacebookId = function(fb_id, callback){
  return this.model('User').findOne({ provider: 'facebook',
                                      provider_id: fb_id }, callback);
};

userSchema.methods.findByTwitterId = function(tw_id, callback){
  return this.model('User').findOne({ provider: 'twitter',
                                      provider_id: tw_id }, callback);
};

userSchema.methods.findByGoogleId = function(google_id, callback){
  return this.model('User').findOne({ provider: 'google',
                                      provider_id: google_id }, callback);
};

userSchema.methods.doesTrustExist = function(user_id){
  if(this.trusts_count === 0){
    return false;
  }else{
    for(var i = 0; i < this.trusts.length; i++){
      if(this.trusts[i].user_id.toString() === user_id.toString()){
        return true;
      }
    }
    return false;
  }
};

userSchema.methods.previousTrustCancelled = function(user_id){
  if(this.trusts_count === 0){
    return false;
  }else{
    for(var i = 0; i < this.trusts.length; i++){
      if(this.trusts[i].user_id.toString() === user_id.toString()){
        if(this.trusts[i].status === 'cancelled' || this.trusts[i].status === 'canceled') return true;
      }
    }
  }
  return false;
};

userSchema.methods.fetchTrustIndexByUserId = function(user_id){
  if(this.trusts_count > 0){
    for(var i=0; i <= this.trusts.length; i++){
      if(this.trusts[i].user_id.toString() === user_id.toString()) return i;
    }
  }else{
    return false;
  }
  return false;
};

userSchema.methods.fetchTrustIndex = function(trust_id, cb){
  if(this.trusts_count > 0){
    for(var i=0; i <= this.trusts.length; i++){
      if(this.trusts[i]._id.toString() === trust_id.toString()){
        cb(i);
        return;
      }
    }
  }else{
    cb(null);
  }
};

userSchema.methods.refresh = function(cb){
  this.model('User').findOne({_id: this._id}, function(err, user){
    if(err) throw err;
    cb(user);
  });
};

userSchema.methods.cleanUserJSON = function(){
  var user = this.toObject();
          delete user.password;
          delete user.comments;
          delete user.likes;
          delete user.provider_token;
          delete user.provider_token_secret;
  return user;
};

userSchema.methods.shortUser = function(){
  var short_user = {
        _id: this._id,
        name: this.name,
        first_name: this.first_name,
        last_name: this.last_name,
        profile_photo_url: this.profile_photo_url
      };
  return short_user;
};

userSchema.methods.follow = function(user, next){
  var User = _mongoose.model('User');
  var isFollowing = false;
  var userID = user && typeof(user) == 'object'?user.toString():user;
  _.each(this.following, function(item, idx, list){
    if (item._id == userID) {
      isFollowing = true;
    }
  });
  if (!isFollowing){
    var followingUpdate = {
      $push: {following: {_id: userID, date: new Date().toString()}},
      $inc: {following_count: 1}
    };
    var followersUpdate = {
      $push: {followers: {_id: this._id.toString(), date: new Date().toString()}},
      $inc: {followers_count: 1}
    }
    User.findOneAndUpdate({_id: this._id}, followingUpdate, function(err, result){
      User.findOneAndUpdate({_id: user}, followersUpdate, function(err, res){
        if (err) console.log(err);
        if (!err) {
          console.log(res._id + ':' + result._id);
          _utils.registerActivityEvent(
            res._id,
            result._id,
            'follow'
          );
        }
      });
      next(err, result);
    });
  } else {
    next(null, null);
  }
}

userSchema.methods.joinOrganization = function(organization, next, approval){
  var invite = null;
  if (organization.organization){
    invite = organization;
    organization = invite.organization;
    console.log('have invite');
  }
  var userStatus = invite?'active':'pending';
  var groups = [];
  if (invite && invite.group){
    groups.push(invite.group);
  }
  var user_update = {
    $push: {org_status: {status: userStatus, 
      organization: organization._id, date: new Date().toString(),
      groups: groups
    }}
  };
  var present = false;
  _.each(this.org_status, function(item, idx, list){
    if (String(item.organization) == String(organization._id)) {
      present = true;
    }
  });

  if (!present) {
    this.model('User').findOneAndUpdate({_id: this._id}, user_update, function(err, result){
      if (!err) {
        _utils.registerActivityEvent(
          result._id,
          organization.owner,
          'group_joined'
          );
      }
      next(err, result, true);
    });
  } else {
    next(null, this, false);
  }
};

userSchema.pre('save', function(next){
  //set create & modify dates
  var birthday = this.birthday?this.birthday.split('-'):false;
  if (birthday && birthday.length == 3) {
    birthday = [birthday[2], birthday[0] - 1, birthday[1]];
    birthday = moment(birthday);
    var age = moment().diff(birthday, 'years');
    if (!this.age || age != this.age) {
      this.age = age;
    }
  }

  if(!this.create_date){
    this.create_date = Date.now();
    this.name = this.first_name + ' ' + this.last_name;
    if(this.password){
      if(!this.hashPassword()) next(false);
    }
    next();
  }else{
    this.modify_date = Date.now();
    if(this.name !== this.first_name + ' ' + this.last_name){
      this.name = this.first_name + ' ' + this.last_name;
    }
    next();
  }
});

userSchema.methods.fetchGroups = function(org_id, next) {
  model = this.model('User');
  var uid = this._id;
  if (this.type == 'user') {
    model.populate(this, {path: 'org_status.groups', model: 'Group'}, function(err, user){
      model.populate(user, {path: 'org_status.groups.leader', model: 'User', select: {_id: 1, name: 1, profile_photo_url: 1, active: 1, type: 1}}, function(err, user){
        var orgs = _.filter(user.org_status, function(obj){
          return String(obj.organization) == String(org_id);
        }); 
        if (orgs.length > 0) {
          org = orgs[0];
          var groups = _.filter(org.groups, function(obj){
            return obj.status == 'active';
          });
          var result = [];
      var incriteria = _.pluck(groups, "_id");
      console.log(incriteria);
      var criteria = {active: true, org_status: {
        $elemMatch: {
          organization: mObjectId(org_id),
          status: 'active'
        }}
      };
      var select = {org_status: {$elemMatch: {groups: incriteria}}};
      model.aggregate([
        {$match: criteria},
        {$project: {org_status: 1}},
        {$unwind: "$org_status"},
        {$unwind: "$org_status.groups"},
        {$group: {_id: "$org_status.groups", count: {$sum: 1} }}
      ]).exec(function(err, counts){
        _.each(groups, function(g) {
        g = g.toObject();
        g.leader_name = g.leader.name;
        g.leader_id = g.leader._id;
        var muted = false;
        _.each(g.mutes, function(mute){
          if (String(uid) == String(mute)){
            muted = true;
          }
        });
        g.muted = muted;
        var object = _.find(counts, function(obj){
          return(String(obj._id) == String(g._id));
        });
        if (object) {
          g.member_count = object.count;
        }
        result.push(g);
      });
      result = _.sortBy(result, 'name');
      next(err, result);

      });      
        } else {
          next(err, []);
        }
      });
    });
  } else if (this.type == 'institution_verified') {
    var Group = _mongoose.model('Group');
    console.log(this._id);
    Group.find({organization: org_id, status: 'active'})
    .populate({path: 'leader', model: 'User', select: {_id: 1, name: 1, profile_photo_url: 1, active: 1}})
    .sort({name: 1})
    .exec(function(err, groups){
      var result = [];
      var incriteria = _.pluck(groups, "_id");
      console.log(incriteria);
      var criteria = {active: true, org_status: {
        $elemMatch: {
          organization: mObjectId(org_id),
          status: 'active'
        }}
      };
      var select = {org_status: {$elemMatch: {groups: incriteria}}};
      model.aggregate([
        {$match: criteria},
        {$project: {org_status: 1}},
        {$unwind: "$org_status"},
        {$unwind: "$org_status.groups"},
        {$group: {_id: "$org_status.groups", count: {$sum: 1} }}
      ]).exec(function(err, counts){
        _.each(groups, function(g) {
        g = g.toObject();
        g.leader_name = g.leader.name;
        g.leader_id = g.leader._id;
        var muted = false;
        _.each(g.mutes, function(mute){
          if (String(uid) == String(mute)){
            muted = true;
          }
        });

        var object = _.find(counts, function(obj){
          return(String(obj._id) == String(g._id));
        });
        if (object) {
          g.member_count = object.count;
        }
        result.push(g);
      });
      next(err, result);

      });


      
    });
  } else {
    next(null, []);
  }
}

userSchema.statics.findBasic = function(params, limit, skip, next){
  var model = this.model('User');
  params.active = true;
  model.find(params)
  .select({_id: 1, name: 1, first_name: 1, last_name: 1, profile_photo_url: 1, type: 1, subtype: 1, type: 1})
  .sort({name: 1})
  .limit(limit)
  .skip(skip)
  .exec(function(err, users) {
    next(err, users);
  });
  
};

userSchema.statics.fetchAvailableTags = function(uid, tag, next){
  var model = this.model('User');
  model.findOne({_id: uid})
  .select({following: 1, followers: 1})
  .exec(function(err, user){
    if (user) {
      model.populate(user, {path: 'following._id', model: 'User', 
        select: {name: 1, _id: 1, profile_photo_url: 1}}, function(err, user){
        model.populate(user, {path: 'followers._id', model: 'User',
          select: {name: 1, _id: 1, profile_photo_url: 1}}, function(err, user) {
            var users = _.pluck(user.followers, '_id');
            users.concat(_.pluck(user.following, '_id'));
            var reg = new RegExp(tag, 'i');
            var result = _.filter(users, function(u){
              if (u) {
                return reg.exec(u.name);
              } else {
                return false;
              }
            });
            next(err, result);
          });
      });
    } else {
      next(err, []);
    }
  });
};

userSchema.statics.findOrganizationUser = function(uid, oid, next){
  var model = this.model('User');
  var params = {_id: uid};
  params.active = true;
  var select = {_id: 1, type: 1};
  select.org_status = {
    $elemMatch: {
      status: 'active',
      organization: mObjectId(oid)
    }
  };
  model.findOne(params)
  .select(select)
  .exec(function(err, user){
    next(err, user);
  });
};

userSchema.statics.findAvailableDirectRecipients = function(user, next){
  var model = this.model('User');
  if (!user.org_status || user.org_status.length != 1) {
    next({error: 'User does not belong to an organization'}, null);
    return;
  }
  var params = {};
  var org_status = {
    organization: user.org_status[0].organization,
    role: 'leader',
    status: 'active'
  };
  model.populate(user, {path: 'org_status.organization', model: 'Organization'}, function(err, user){
    params = {
      $or: [
        {_id: user.org_status[0].organization.owner},
        {org_status: {$elemMatch: org_status}}
      ]
    };
    model.find(params)
    .select({_id: 1, name: 1, first_name: 1, last_name: 1, profile_photo_url: 1, active: 1, type : 1})
    .sort({name: 1})
    .exec(function(err, users){
      next(err, users);
    });
  });
};

userSchema.statics.findOrganizationMembers = function(oid, last, next, exclude){
  var model = this.model('User');
  var params = {org_status: {$elemMatch: {organization: mObjectId(oid), status: 'active'}}, active: true};
  if (last) {
    params.name = {$gt: last};
  }
  if (exclude) {
    params._id = {$ne: exclude._id};
  }
  model.find(params)
  .select({_id: 1, name: 1, first_name: 1, last_name: 1, profile_photo_url: 1, active: 1, type: 1,
    org_status: {$elemMatch: {organization: mObjectId(oid), status: 'active'}}})
  .sort({name: 1})
  .limit(25)
  .exec(function(err, users){
    var results = [];
    _.each(users, function(u){
      u = u.toObject();
      u.role = u.org_status[0].role;
      results.push(u);
    });
    next(err, results);
  });
};

userSchema.statics.findGroupMembers = function(oid, gid, last, next){
  var model = this.model('User');
  var params = {org_status: {$elemMatch: {organization: mObjectId(oid), 
    groups: mObjectId(gid), status: 'active'}}, active: true};
  if (last) {
    params.name = {$gt: last};
  }
  model.find(params)
  .select({_id: 1, name: 1, first_name: 1, last_name: 1, profile_photo_url: 1, active: 1, type: 1,
    org_status: {$elemMatch: {organization: mObjectId(oid), status: 'active'}}})
  .sort({name: 1})
  .limit(25)
  .exec(function(err, users){
    var results = [];
    _.each(users, function(u){
      u = u.toObject();
      u.role = u.org_status[0].role;
      results.push(u);
    });
    next(err, results);
  });


}

userSchema.statics.addToGroup = function(uid, group, next){
  var model = this.model('User');
  model.findOne({_id: uid}, function(err, user){
    console.log(user.name + ': ' + user.org_status.length);
    if (user) {
      _.each(user.org_status, function(o){
        console.log(group.organization + ':' + o.organization);
        if (String(group.organization) == String(o.organization)) {
          var exists = false;
          _.each(o.groups, function(g){
            if (String(g) == String(group._id)){
              exists = true;
            }
          });
          console.log("Exists: " + exists);
          if (!exists) {
            o.groups.push(group._id);
          }
          console.log(o);
        }
      });
      user.markModified('org_status');
      user.save(function(err, result){
        if (next) {
          console.log(err);
          next(err, result);
        } else {
          if (err) {
            console.log(err);
          }
        }
      });
    } else {
      if (next) {
        next(err, user);
      } else {
        console.log(err);
      }
    }
  });
};

userSchema.statics.registerDevice = function(uid, device, next){
  var model = this.model('User');
  model.findOne({_id: uid}, function(err, user){
    if (user) {
      if (!user.google_devices || ! _.isArray(user.google_devices)) {
        user.google_devices = [device];
        user.save(function(err, user){
          next(err, user);
        });
        return;
      }
      var idx = -1;
      _.each(user.google_devices, function(obj, index){
        if (String(obj) == String(device)){
          idx = index;
        }
      });
      if (idx == -1) {
        user.google_devices.push(device);
        user.save(function(err, user){
          next(err, user);
        });
      } else {
        next(err, user);
      }
    }
  });
};

userSchema.statics.fetchHomeFeedCriteria = function(uid, last, next) {
  var model = this.model('User');
  console.log(uid);
  model.findOne({_id: uid})
  .select({_id: 1, org_status: {$elemMatch: {status: 'active'}}, following: 1})
  .exec(function(err, user){
    console.log(err);
    console.log(user);
    model.populate(user, {path: 'org_status.organization', model: 'Organization', 
      select: {_id: 1, owner: 1}}, function(err, user){
      if (user) {
        Trust.find({status: 'accepted', $or: [{to: user._id}, {from: user._id}]})
        .select({from: 1, to: 1})
        .exec(function(err, trusts){
          var t = [];
          if (err) console.log(err);
          if (_.isArray(trusts)) {
            _.each(trusts, function(trust) {
              if (String(trust.to) == String(uid)) {
                t.push(trust.from);
              } else {
                t.push(trust.to);
              }
            });
          }
          var owners = [];
          var orgs = [];
          if (_.isArray(user.org_status)){
            _.each(user.org_status, function(o){
              orgs.push(o.organization._id);
              owners.push(o.organization.owner);
            });
          }
          var following = _.pluck(user.following, '_id');
          var trusted = trusts.concat(owners);
          trusted.push(user._id);
          model.find({org_status: {$elemMatch: {
            organization: {$in: orgs},
            status: 'active'
          }}})
          .select({_id: 1})
          .exec(function(err, users){
            var orgMembers = _.pluck(users, '_id');
            following  = following.concat(orgMembers);
            var criteria = {
              status: 'active',
              is_flagged: false,
              $or: [
                {
                  creator: {$in: following},
                  scope: 'public',
                  category: {$ne: 'personal'},
                  status: 'active'
                },
                {
                  creator: {$in: trusted}, 
                  scope: {$in: ['public', 'trust']},
                  status: 'active',
                  category: {$ne: 'personal'}
                }
              ]
            };
            if (last) {
              criteria.create_date = {$lt: last};
            }
              next(null, criteria);
          });
      });
      } else {
        next(err, null);
      }
    });
  });
};

userSchema.statics.fetchFollowing = function(uid, requestor, skip, limit, next){
  var model = this.model('User');
  model.findOne({_id: uid})
  .select({following: 1})
  .exec(function(err, user) {
    if (user) {
      model.populate(user, {path: 'following._id', model: 'User', select: {_id: 1, 
        name: 1, first_name: 1, last_name: 1, profile_photo_url: 1, type: 1, 
        subtype: 1, type: 1, followers: {$elemMatch: {_id: requestor}}}}, 
        function(err, user){
          var users = _.pluck(user.following, '_id');
          users = limitUsers(users, limit, skip);
          users = flattenShortUsers(users, requestor);
          next(err, users); 
        });
    } else {
      next(err, []);
    }
  });
};

userSchema.statics.fetchFollowers = function(uid, requestor, skip, limit, next){
  var model = this.model('User');
  model.findOne({_id: uid})
  .select({followers: 1})
  .exec(function(err, user) {
    if (user) {
      model.populate(user, {path: 'followers._id', model: 'User', select: {_id: 1, 
        name: 1, first_name: 1, last_name: 1, profile_photo_url: 1, type: 1, 
        subtype: 1, type: 1, followers: {$elemMatch: {_id: requestor}}}}, 
        function(err, user){
          var users = _.pluck(user.followers, '_id');
          users = limitUsers(users, limit, skip);
          users = flattenShortUsers(users, requestor);
          next(err, users); 
        });
    } else {
      next(err, []);
    }
  });
};

userSchema.statics.followUser = function(uid, requestor, next){
  var model = this.model('User');
  var Activity = _mongoose.model('Activity');
  model.findOne({_id: uid}, function(err, user){
    if (user) {
      var following = false;
      _.each(user.followers, function(f){
        if (String(requestor) == String(f._id)) {
          following = true;
        }
      });
      if (!following) {
        user.followers.push({_id: requestor});
        user.save(function(err, user){
          model.findOne({_id: requestor}, function(err, r){
            if (r) {
              r.following.push({_id: uid});
              r.save(function(err, r){
                 new Activity({
                  action: 'follow',
                  to: uid,
                  from: requestor
                }).save(function(err, activity){

                });
              });
            }
          });
          user = user.toObject();
          user.is_following = true;
          next(err, user);
        });
      } else {
        next(err, user);
      }
    } else {
      next(err, user);
    }
  });
};

userSchema.statics.unfollowUser = function(uid, requestor, next){
 var model = this.model('User');

 model.findOne({_id: uid}, function(err, user){
    if (user) {
      var index = -1;
      _.each(user.followers, function(f, idx){
        if (String(requestor) == String(f._id)) {
          index = idx;
        }
      });
      if (index != -1) {
        user.followers.splice(index, 1);
        user.save(function(err, user){
          model.findOne({_id: requestor}, function(err, r){
            if (r) {
              var index = -1;
              _.each(r.following, function(f, idx){
                if (String(uid) == String(f._id)) {
                  index = idx;
                }
              });
              if (index != -1) {
                r.following.splice(index, 1);
              }
              r.save(function(err, r){
              });
            }
          });
          user = user.toObject();
          user.isFollowing = false;
          next(err, user);
        });
      } else {
        next(err, user);
      }
    } else {
      next(err, user);
    }
  });

};

userSchema.methods.checkAndUpdateOrg = function(next) {
  var $this = this;
  var Organization = _mongoose.model('Organization');
  var model = this.model('User');
  if (this.program_code) {
    Organization.findOne({code: this.program_code})
    .populate({path: 'owner', model: 'User'})
    .exec(function(err, organization) {
      if (!err && organization) {
        var in_org = false;
        var date = new Date().toString();
        var user_update = {
          theme: organization.theme,
          $push: {org_status: {status: 'pending', organization: organization._id}}
        };
        var owner_update = {};
        $this.joinOrganization(organization, function(err, saved, sendPush){
          next(err, saved);
          if (saved) {
            if (sendPush){
              notifyOwnerJoined(organization.owner, saved, false);
            }
          }
        });
      }
    });
  }
};

var notifyOwnerJoined = function(owner, user, joined){
  var bodyp = joined?ownerBody1Alt:ownerBody1;
  var pushp = joined?ownerPushAlt:ownerPush;
  var subject = joined?'New Member Added':'New Member Pending';
  var params = {
    body: [
      util.format(ownerGreeting, owner.name),
      util.format(bodyp, user.first_name + ' ' + user.last_name, owner.name)
    ],
    closing: ownerClosing
  };
  var mail = jade.renderFile(baseMail, params);
  mandrill(mandrillEndpointSend, {
    message: {
      to: [{email: owner.email}],
      from_email: 'info@prizmapp.com',
      from_name: 'Prizm',
      subject: subject,
      html: mail}
    }, function (err, response){
      if (err) console.log(err); 
    }); 
    notify.sendNote(owner, {
      title: user.name,
      body: pushp,
      icon: 'notificationlgx_icon'
    }); 

};



var limitUsers = function(users, limit, skip) {
  users = _.reject(users, function(user){return user?false:true;});
  users.reverse();
  var uArr = [];
  var start = -1;
  var max = Number(limit) + Number(skip);
  _.each(users, function(u, i){
    if (skip > 0){
      if (i >= skip) {
        if (i < max) {
          uArr.push(u);
        } 
      }
    } else {
      if (i < max) {
        uArr.push(u);
      }
    }
  });
  return uArr;
};

var flattenShortUsers = function(users, requestor){
  var returnData = [];
  _.each(users, function(u){
    if (u) {
      u = u.toObject();
      if (u.followers) {
        u.is_following = u.followers.length > 0;
        delete u.followers;
      }
      u.is_self = String(u._id) == String(requestor);
      returnData.push(u);
    }
  });
  return returnData;
}

userSchema.statics.resetPassword = function(params, next) {
  var email = params.email;
  var password = params.password;
  var confirmPassword = params.confirmPassword;

  if (email && password && confirmPassword && passwordsMatch(password, confirmPassword)) {
    var model = this.model('User');
    model.findOne({email: email}, function afterFind(err, user) {
      if (user) {
        user.password_reset = password;
        user.reset_date = Date.now();
        user.reset_key = uuid.v1();
        user.save(function(err, saved) {
          return next(err, saved);
        });
      } else {
        return next(err, user);
      }
    });
  } else {
    return next({err: 'Invalid request. '}, null);
  }
};

function passwordsMatch(password, confirmPassword) {
  return password === confirmPassword;
}

exports.User = _mongoose.model('User', userSchema);
_mongoose.model('OrgStatus', orgStatusSchema);
// exports.Trust = _mongoose.model('Trust', trustSchema);
