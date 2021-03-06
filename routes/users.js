/**
 * me
 * Handles routing & management for /user* endpoints
 *
 * @author DJ Hayden <dj.hayden@stablekernel.com>
 */
var _mongoose     = require('mongoose'),
    _             = require('underscore'),
    _uuid         = require('node-uuid'),
    _prism_home   = process.env.PRISM_HOME,
    _utils        = require(_prism_home + 'utils'),
    _logger       = require(_prism_home + 'logs'),
    PrismError    = require(_prism_home + 'error'),
    Facebook      = require(_prism_home + 'classes/Facebook'),
    Twitter       = require(_prism_home + 'classes/Twitter'),
    Google        = require(_prism_home + 'classes/Google'),
    User          = require(_prism_home + 'models/user').User,
    Twine         = require(_prism_home + 'classes/Twine'),
    Trust         = require(_prism_home + 'models/trust').Trust,
    Activity      = require(_prism_home + 'models/activity'),
    Post          = require(_prism_home + 'models/post').Post,
    Mail          = require(_prism_home + 'classes/Mail'),
    Organization  = _mongoose.model('Organization'),
    Theme         = _mongoose.model('Theme'),
 ObjectId    = _mongoose.Schema.Types.ObjectId;
var Invite = _mongoose.model('Invite');
var jade = require('jade');
var Interest = _mongoose.model('Interest');
var path = require('path');
var fs = require('fs');
var config = require('config');
var welcomeMail = fs.readFileSync(path.join(__dirname + 
      '/../views/welcome.jade'), 'utf8');
var orgWelcomeMail = path.join(__dirname + '/../views/welcome_org.jade');
var consentMail = path.join(__dirname + '/../views/consent.jade');
var nonOrgConsentMail = path.join(__dirname + '/../views/non_org_consent.jade');
var mandrill = require('node-mandrill')(config.mandrill.client_secret);
var mandrillEndpointSend = '/messages/send';
var util = require('util');
var url = require('url');
var notify = require(_prism_home + 'lib/helpers/notify');
/**
 * TODO: pull logging for errors out into error class (which needs refactoring)
 */
var baseMail = path.join(__dirname, '/../views/base.jade');

var iPush = require('../classes/i_push');
var ownerGreeting = 'Dear %s,';
var ownerBody1 = '%s has requested to join %s\'s Prizm group. Please go to your admin page <a href="https://www.prizmapp.com/profile/members">here</a> to approve or deny.';
var ownerBody1Alt = '%s has just joined %s\'s Prizm group. Please go to your admin page <a href="https://www.prizmapp.com/profile/members">here</a> to review your members.';
var ownerClosing = 'Thank you,';
var ownerPush = 'has requested to join your Prizm group. Please go to your admin page to approve or deny.';
var ownerPushAlt = 'has just joined your Prizm group. Please go to your admin page to review your members.';

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

var checkAndUpdateOrg = function(user, next){
 if (!user) {
    next(null, null);
    return;
 }
 var empty_set = {
  organization: null,
  theme: null
 };
 if (user && user.program_code) {
  Organization.findOne({code: user.program_code})
  .populate({path: 'owner'})
  .exec(function(err, organization){
    if (!err && organization) {
      var in_org = false;
      var date = new Date().toString();
      var user_update = {
        theme: organization.theme,
        $push: {org_status: {status: 'pending', 
          organization: organization._id}}
      };
      var owner_update = {};
      User.findOne({_id: user._id}, function(err, result){
        if (result) {
          console.log('found user');
          var exists = false;
          console.log(result.following);
          if (organization.owner){
            result.follow(organization.owner._id, function(err, res){
              if (err) console.log(err);
            });
          }
          result.joinOrganization(organization, function(err, saved, sendPush){
            next(err, saved);
            if (saved) {
              if (sendPush){
                notifyOwnerJoined(organization.owner, saved, false);
              }
              Invite.findOne({address: saved.email, organization: organization._id})
              .exec(function(err, invite){
                if (invite) {
                  invite.status = 'accepted';
                  invite.user = result._id;
                  invite.save(function(err, inviteResult){
                    if (err) console.log(err);
                  });
                }
              });
            }
          });
          /**
          User.findOneAndUpdate({_id: user._id}, user_update, function(err, saved){
            console.log('updated user');
            var savedUser = saved;
            if (organization.owner) {
             User.findOneAndUpdate({_id: organization.owner}, owner_update, 
                function(err, result){
                  console.log('updated owner');
                  if (!err) {
                    console.log(organization.owner + ':' + user._id);
                    _utils.registerActivityEvent(organization.owner,
                                                         user._id,
                                                         'follow'
                                                         );
                                        }
                });
            }
            next(err, saved);
          }); */
        } else {
          console.log('Could not find user');
          next(err, user);
        } 
      });
    } else {
      console.log('Org did not exist');
      Invite.findOne({code: user.program_code, status: 'sent'})
      .populate({path: 'organization'})
      .exec(function(err, invite) {

        if (invite) {
          invite.status = 'accepted';
          invite.save(function(err, result){
            if (err) console.log(err);
          });
          User.findOne({_id: user._id}, function(err, u){
            Organization.findOne({_id: invite.organization._id})
            .populate({path: 'owner'})
            .exec(function(err, org){
              u.joinOrganization(invite, function(err, saved, groupJoined){
                if (groupJoined){
                  notifyOwnerJoined(org.owner, u, true);
                } 
                next(err, saved);
              });
            });
          });

        } else {

          User.findOneAndUpdate({_id: user._id}, empty_set, next);
        }

      });
    }
  });
 } else {
   if (user.type == 'institution_verified') {
     Organization.findOne({owner: user._id})
     .exec(function(err, org){
        if (org) {
          User.findOneAndUpdate({_id: user._id}, {theme: org.theme, organization: org._id}, next);
        } else {
          User.findOneAndUpdate({_id: user._id}, empty_set, next);
        }
     });
   } else {
    console.log('No org present');
    User.findOneAndUpdate({_id: user._id}, empty_set, next);
   }
 } 
};

exports.parentConsent = function(req, res){
  var uid = req.params.uid;
  var parentContact = {
    first: req.body.first,
    last: req.body.last,
    email: req.body.email
  };
  User.findOneAndUpdate({_id: uid}, {parent_contact: parentContact}, function(err, user){
    if (user) {
      if (user.parent_contact && user.parent_contact.email) {
            if (user.org_status && user.org_status.length > 0) {
              Organization.findOne({_id: user.org_status[0].organization}, function(err, org){
                if (org) {
                  var mail = jade.renderFile(consentMail, {user: user, organization: org});
                  mandrill(mandrillEndpointSend, {message: {
                    to: [{email: user.parent_contact.email}],
                    from_email: 'info@prizmapp.com',
                    from_name: 'Prizm',
                    subject: org.name + ' is using Prizm this year.',
                    html: mail
                  }}, function(err, res){
                    if (err) console.log(err); 
                  });
                }
              });
            } else {
              var mail = jade.renderFile(nonOrgConsentMail, {user: user});
              mandrill(mandrillEndpointSend, {message: {
                  to: [{email: user.parent_contact.email}],
                  from_email: 'info@prizmapp.com',
                  from_name: 'Prizm',
                  subject: user.name + ' just signed up for Prizm.',
                  html: mail
                }}, function(err, res){
                  if (err) console.log(err); 
              });
            }
          }
       _utils.prismResponse(res, user, true); 
    } else {
      if (err) console.log(err);
      res.status(400).send('Invalid information');
    }
  });
};

/*jshint -W087*/

/**
 * Handles User review state
 *
 * @param {HTTPRequest} req The request object
 * @param {HTTPResponse} res The response object
 */
exports.review = function review(req, res){
  if(req.params.id && req.params.review){
    if(req.query.review_key && req.query.approval ||
       req.query.reset_key && req.query.approval){
      User.findOne({_id: req.params.id}, function(err, user){
        if(err){
          _utils.prismResponse(res, null, false, PrismError.serverError);

        }else{
          if(user.review_key === req.query.review_key &&
             user.type === 'institution'){
            user.type = (req.query.approval === 'yes') ? 'institution_verified' : 'user';
            user.review_key = null;
            user.save(function(err, saved){
              if(err){
                _utils.prismResponse(res, null, false, PrismError.serverError);

              }else{
                res.send('Succesfully Reviewed User');
              }
            });
          }else if(user.reset_key === req.query.reset_key &&
                  req.params.review === 'passwordreset'){
            user.password = user.password_reset;
            if(user.hashPassword()){
              user.password_reset = null;
              user.reset_key = null;
              user.reset_date = null;
              user.save(function(err, result){
                if(err){
                  res.send('An error occured while resetting your password, Error: '+JSON.stringify(err));
                }else{
                  res.send('Successfully reset your password! Please login with your new credentials!');
                }
              });
            }else{
              res.send('Unable to reset/hashpassword, please contact system administrator');
            }

          }else{
            res.send('Unable to review user. User is currently not in review');
          }
        }
     });
    }else{
      _utils.prismResponse(res, null, false, PrismError.invalidRequest);
    }
  }else{
    _utils.prismResponse(res, null, false, PrismError.invalidRequest);
  }
};

exports.resetPassword = function(req, res){
  if(req.params.email && req.body.password){
    User.findOne({email: req.params.email}, function(err, result){
      if(err || !result) _utils.prismResponse(res, null, false, PrismError.serverError);
      if(result){
        result.password_reset = req.body.password;
        result.reset_date = new Date();
        result.reset_key = _uuid.v1();
        result.save(function(err, saved){
          if(err){
            _logger.log('error', 'Error returned trying to reset & save password', {err:err});
            _utils.prismResponse(res, null, false, PrismError.serverError);
          }else{
            var mail = new Mail();
            mail.resetPassword(result, function(err, response){
              if(err){
                _utils.prismResponse(res, null, false, PrismError.serverError);
              }else{
                _utils.prismResponse(res, {message: 'Please Verify reset in email'}, true);
              }
            });
          }
        });
      }
    });
  }else{
    _utils.prismResponse(res, null, false, PrismError.invalidRequest);
  }
};

exports.changePassword = function(req, res){
  if(req.params.email && req.body.currentPassword && req.body.newPassword){
    User.findOne({email: req.params.email}, function(err, result){
      if(err || !result) _utils.prismResponse(res, null, false, PrismError.serverError);
      if(result){
        if(hashAndValidatePassword(result, req.body.currentPassword)){
          result.password = req.body.newPassword;
          if(!result.hashPassword()){
            _logger.log('error', 'There was an issue salting the password')
          } 
          else {
            result.save(function(err, saved) {
              if(err){
                _logger.log('error', 'Error returned trying to reset & save password', {err:err});
                _utils.prismResponse(res, null, false, PrismError.serverError);
              }else{
                _utils.prismResponse(res, {message: 'Password has been updated'}, true);
              }
            })
          } 
        }else{
          _logger.log('error', 'User entered the wrong password');
          _utils.prismResponse(res, null, false, PrismError.invalidUserCredentials);
        }
      }
    });
  }else{
    _utils.prismResponse(res, null, false, PrismError.invalidRequest);
  }
};

/**
 * Updates the user to inactive 
 *
 * @param {HTTPRequest} req The request object
 * @param {HTTPResponse} res The response object
 */
exports.deleteUser = function(req, res){
  if(!req.params.id){
    _utils.prismResponse(res, null, false, PrismError.invalidRequest);
  }else{
    User.findOne({_id: req.params.id}, function(error, user){
      if(error){
        _logger.log('error',
                    'A error returned trying to fetch user to delete',
                    {error:error});
        _utils.prismResponse(res, null, false, PrismError.serverError);

      }else{
        user.delete_date = Date.now();
        user.active = false;
        user.save(function(error, saved){
          if(error){
            _logger.log('error',
                        'A error returned trying to save user to delete',
                        {error:error});
            _utils.prismResponse(res, null, false, PrismError.serverError);
          }else{
            var resBlock = function(){
              _utils.prismResponse(res, saved.shortUser(), true);
            };
            Post.update(
              {creator: saved._id}, 
              {$set: {status: 'inactive'}}, 
              {multi: true}, 
              function(err, posts){
                if(err){
                  _utils.prismResponse(res, null, false, PrismError.serverError);
                }else{
                  console.log('Posts set to inactive: ' + JSON.stringify(posts));
                  Trust.update({$or: [{to: req.params.id}, {from: req.params.id}]},
                               {$set: {status: 'inactive'}},
                               {multi: true},
                               function(err, trusts_updated){
                                if(err){
                                  _utils.prismResponse(res, null, false, PrismError.serverError);
                                }else{
                                  resBlock();
                                }
                              });
                }
            });
          }
        });
      }
    });
  }
};

/**
 * Removes device_token from all users that have a matching device_token
 *
 * @param  {String} device The device token identifier
 * @param  {Function} block The callback block to be invoked
 */
var unregisterDeviceFromUsers = function(device, block){
  if(!device || !block) throw new Error('A device id & callback are required');
  User.update(
    {device: device},
    {$set: {device_token: null, push_enabled: false}},
    {multi: true},
    function(err, updated){
      block(err, updated);
  });
};

/**
 * Adds device token to user object for push notifications
 *
 * @param  {HTTPRequest} req The request object
 * @param  {HTTPResponse} res The response object
 */
exports.registerDevice = function(req, res){
  if(req.params.id && req.body.device){
    unregisterDeviceFromUsers(req.body.device, function(err, updated){
      if(err){
        _logger.log('error',
                    'Error unregistering previous devices on device register',
                    {error:err, device:req.body.device, user_id:req.params.id});
        _utils.prismResponse(res, null, false, PrismError.serverError);
      }else{
        User.update(
          {_id: req.params.id},
          {$set: {device_token: req.body.device}},
          function(err, user){
            if(err || !user)  {
              var info = {user:req.params.id, device:req.body.device};
              if(err){
                _logger.log('error',
                            'Error returned while finding user in registerDevice',
                            info);
              }else{
                _logger.log('error',
                            'unable to find user for device registration',
                            info);
              }
              _utils.prismResponse(res, null, false, PrismError.serverError);
              console.log('Could not register device ' + req.body.device + ' for user ' + user.name);

            }else{
              console.log('Registered device ' + req.body.device + ' for user ' + user.name);
              var message = "Successfully registered device for " + req.params.id;
              _utils.prismResponse(res, {message: message}, true);

            }
        });
      }
    });

  }else{
    _utils.prismResponse(res, null, false, PrismError.invalidRequest);
  }
};

/**
 * Removes device token from user object "unregistering" for push notifications
 *
 * This service is only used for the APN Feedback Service callback
 * from the push notification server
 *
 * *NOTE* If a single device shuts off notifications & that device has
 * multiple users, all associated users are "unregistered"
 *
 * @param  {HTTPRequest} req The request object
 * @param  {HTTPResponse} res The response object
 */
exports.unregisterDevice = function(req, res){
  if(req.params.id){
    unregisterDeviceFromUsers(req.params.id, function(err, updated){
      if(err || !updated){
        var info = {device:req.params.id};
        if(err){
          _logger.log('error', 'Error on unregister device', info);
        }else{
          _logger.log('error', 'No user devices found to update', info);
        }
        _utils.prismResponse(res, null, false, PrismError.serverError);

      }else{
        var message = "Successfully unregistered all users from device"+req.params.id;
        _utils.prismResponse  (res, {message:message}, true);
      }
    });
  }else{
    _utils.prismResponse(res, null, false, PrismError.invalidResponse);
  }
};



/**
 * Handles authenticating user login request
 *
 * TODO: create session on success & add logout to destroy session
 *
 * @param  {HTTPRequest} req The request object
 * @param  {HTTPResponse} res The response object
 * @return {User} Returns a valid user object
 */
exports.login = function(req, res){
  if(isValidLoginRequest(req.body)){
    if(isSocialProvider(req.body)){
      handleSocialProviderLogin(req.body, function(error, result){
        if(error || result === false){
          //social login failure - user does not exist or
          //failire to authenticate with social provider
          if(error){
            _utils.prismResponse( res,
                                  null,
                                  false,
                                  error);
          }else{
            console.log(result);
            _utils.prismResponse( res, null, false, PrismError.invalidLoginUserDoesNotExist);
          }
        }else{
          //succesful login - send back returned user object
          _utils.prismResponse( res, result, true);
        }
      });
    }else{
      var user = User.findOne({email: req.body.email, active: true});
      user.select(User.selectFields('internal').join(" "));
      user.exec(function(error, result){
        if(error){
          _utils.prismResponse( res,
                                null,
                                false,
                                PrismError.invalidLoginUserDoesNotExist);
        }else if(result){
          if(hashAndValidatePassword(result, req.body.password)){
            result.last_login_date = new Date(); 
            result.save();
            _utils.prismResponse(res, result.format('basic'), true, null, null);
          }else{
           _utils.prismResponse(res,
                                null,
                                false,
                                PrismError.invalidUserCredentials);
          }
        }else{
          _utils.prismResponse( res,
                                null,
                                false,
                                PrismError.invalidLoginUserDoesNotExist);
        }
      });
    }
  }else{
    _utils.prismResponse( res,
                          null,
                          false,
                          PrismError.invalidLoginRequest);
  }
};

/**
 * Handles User creation if user does not exist
 *
 * @param  {HTTPRequest} req The request object
 * @param  {HTTPResponse} res The response object
 * @return {User} Returns the newly created User object
 */

exports.addInterests = function (req, res) {
  var user = User.findOne({_id: req.params.id}, function (err, user) {
    if (!err) {
      var interests = req.body.interests;
      console.log(interests);
      user.interests = [];
      for (var i = 0; i != interests.length; ++i){
        var id = interests[i];
        var action = interests[i].action;
        Interest.findOne({_id: id}, function(err, interest){
          if (!err){
            if (!interest) {
              Interest.find({}, function(err, objects){
                var interests = objects.filter(function(interest){
                    interest._id === ObjectId(id);
                });
                interest = interests.pop();
                user.interests.push(interest);
                user.save();
              });
            } else {
              user.interests.push(interest);
              user.save();
            }
          }
        });
      }
      _utils.prismResponse(res, user.format('basic'), true); 
    } else {
      res.status(400).send({ error: 'there was a problem' })
    }
  });
}

exports.register = function(req, res){
  if(isValidRegisterRequest(req)){
    //Handle traidtional registration --
    console.log(req.body);
    var newUser = new User({
      first_name: req.body.first_name,
      last_name: req.body.last_name,
      email: req.body.email,
      gender: req.body.gender,
      zip_postal: req.body.zip_postal,
      city: req.body.city,
      state: req.body.state,
      birthday: req.body.birthday
    });

    if(typeof(req.body.password) != 'undefined')
      newUser.password = req.body.password;

    if(typeof(req.body.cover_photo_url) != 'undefined')
      newUser.cover_photo_url = req.body.cover_photo_url;

    if(typeof(req.body.profile_photo_url) != 'undefined')
      newUser.profile_photo_url = req.body.profile_photo_url;
    if (typeof(req.body.program_code) != 'undefined') {
      newUser.program_code = req.body.program_code;
    }

    if(typeof(req.body.type) !== 'undefined') newUser.type = req.body.type;
    if(typeof(req.body.subtype) !== 'undefined') newUser.subtype = req.body.subtype;
   
    if(typeof(req.body.phone_number) !== 'undefined')
        newUser.phone_number = req.body.phone_number;

    if(newUser.type === 'institution'){
     
      if(typeof(req.body.website) !== 'undefined')
        newUser.website = req.body.website;
      if (req.body.contact_first) 
        newUser.contact_first = req.body.contact_first;
      if (req.body.contact_last) 
        newUser.contact_last = req.body.contact_last;
      if (req.body.contact_emaiL)
        newUser.contact_email = req.body.contact_email;

      newUser.review_key = _uuid.v1();
    }

    var handleUserSave = function(error, result){
      if(error || !result){
        _utils.prismResponse( 
          res,
          null,
          false,
          PrismError.invalidRegisterUserExists,
          PrismError.invalidRegisterUserExists.status_code);
        } else{
          if(result.review_key && result.type === 'institution'){
            var mail = new Mail();
            mail.institutionReview(result.toObject());
          }
          var html = false;
          if (result.type == 'institution_verified') {
            html = jade.renderFile(orgWelcomeMail, {user: result});
          } else {
            html = jade.render(welcomeMail, {user: result});
          }
          mandrill(mandrillEndpointSend,{message: {
            to: [{email: result.email}],
            from_email: 'info@prizmapp.com',
            from_name: 'Prizm',
            subject: 'Welcome to Prizm!',
            html: html
          }}, function(err, res){
            if (err) {
              console.log(err);
            } else {
              console.log('email sent');
            }
          });
          _utils.prismResponse(res, result.format('basic'), true);
        }
    };

    

    //check, validate, & handle social registration
    if(isSocialProvider(req.body)){
      handleSocialProviderRegistration(req.body, function(error, social){
        if(error && social === false){
          _utils.prismResponse( res, null, false, error, PrismError.status_code);
        }else if(social){
          newUser.provider = req.body.provider;
          newUser.provider_token = req.body.provider_token;
          newUser.provider_id = social.id;
          if(newUser.provider == 'twitter'){
            newUser.provider_token_secret = req.body.provider_token_secret;
          }
          newUser.save(function(err, result){
            checkAndUpdateOrg(result, function(err, saved){
              handleUserSave(err, saved);
            });
          });
          //testForOrg(newUser, handleUserSave);          
        }else{
          _utils.prismResponse( res, null, false, PrismError.serverError);
        }
      });
    }else{
      newUser.save(function(err, result){
        checkAndUpdateOrg(result, function(err, saved){
          handleUserSave(err, saved);
        });
      });
     // testForOrg(newUser, handleUserSave);
    }

  }else{
    _utils.prismResponse(res, null, false, PrismError.invalidRequest);
  }
};

var formatStringSearchVariable = function(search_string){
  return new RegExp(search_string, "i");
};

/**
 * Fetchs all users.
 *
 * //TODO: this should be moved to a middleware or global object
 * currently checks for user's name in the query object & trys to apply the filter
 * to the query criteria
 *
 * @param  {[type]} req [description]
 * @param  {[type]} res [description]
 * @return {[type]}     [description]
 */
exports.fetchAllUsers = function(req, res){
  var query, options, criteria = {};

  options = _utils.parsedQueryOptions(req.query);
  if(req.query){
    if(req.query.name) criteria = {name: {$regex: formatStringSearchVariable(req.query.name)}};
    if(req.query.first_name) criteria.first_name = {$regex: formatStringSearchVariable(req.query.first_name)};
    if(req.query.last_name) criteria.last_name = {$regex: formatStringSearchVariable(req.query.last_name)};
    if(req.query.feature_identifier){
      criteria.create_date = ( req.query.direction &&
                                  req.query.direction == 'older') ?
                                    {$lt: req.query.feature_identifier} :
                                    {$gt: req.query.feature_identifier};
    }
  }
  criteria.active = true;
  query = _utils.buildQueryObject(User, criteria, options);
  query.select('name first_name last_name profile_photo_url').exec(function(err, users){
    if(err || !users){
      _utils.prismResponse(res,null,false,PrismError.invalidUserRequest);
    }else{
      _utils.prismResponse(res,users,true);
    }
  });
};

/**
 * Fetchs Prism user object by identifier
 *
 * @param  {HTTPRequest} req The request object
 * @param  {HTTPResponse} res The response object
 * @return {User} Returns the valid user object to the response object
 */
exports.fetchUser = function(req, res){
  if(req.params.id){
    var criteria = {_id: req.params.id };
    console.log(req.url);
    var url_parts = url.parse(req.url, true);
    var query = url_parts.query; 
    var push_enabled = query.push_enabled;
    console.log(query);
    if (push_enabled) {
      User.findOneAndUpdate(criteria, {push_enabled: true}, function(err, user){
        if (err) console.log(err); 
      });
    }
    new Twine('User', criteria, req, null, function(error, result){
      if(error){
        _logger.log('Error', 'Error retrieving user by id: ' + req.params.id);
        _utils.prismResponse(res, null, false, PrismError.invalidUserRequest);

      }else{
        _utils.prismResponse(res, result, true);
      }
    });
  }else{
    _utils.prismResponse(res, null, false, PrismError.invalidUserRequest);
  }
};

exports.setUserPushEnabled = function(req, res) {
  if(req.params.uid){
    var criteria = {_id: req.params.uid};
    var enabled = req.body.push_enabled;
    User.findOneAndUpdate(criteria, {push_enabled: enabled}, function(err, user){
      if (user) {
        _utils.prismResponse(res, user, true);
      } else {
        if (err) console.log(err);
        _utils.prismResponse(res, null, false, PrismError.invalidUserRequest);
      }
    });
  } else {
    _utils.prismResponse(res, null, false, PrismError.invalidUserRequest);
  }

}

/**
 * Updates available User object fields
 *
 * @param  {HTTPRequest} req The request object
 * @param  {HTTPResponse} res The response object
 * @return {Post} Returns A Post Object array containing ..
 */
exports.updateUser = function(req, res){
  var did_change_subtype = false;
  if(req.params.id && Object.keys(req.body).length > 0){
    User.findOne({_id: req.params.id}, function(err, user){
      var error = {
        status_code: 400,
        error_info: {
          error: 'unable_to_update_user',
          error_description: 'An error occured while trying to update the user, please try again.'
        }
      };

      if(err || !user){
        _utils.prismResponse(res, null, false, PrismError.invalidUserRequest);
      }else{
        //check updateable body fields & update them if they exist
        var body = req.body;
        if(typeof(body.first_name) !== 'undefined') user.first_name = body.first_name;
        if(typeof(body.last_name) !== 'undefined') user.last_name = body.last_name;
        if(typeof(body.info) !== 'undefined') user.info = body.info;
        if(typeof(body.website) !== 'undefined') user.website = body.website;
        if(typeof(body.ethnicity) !== 'undefined') user.ethnicity = body.ethnicity;
        if(typeof(body.affiliations) !== 'undefined') user.affliations = body.affliations;
        if(body.contact_first) user.contact_first = body.contact_first;
        if(body.contact_last) user.contact_last = body.contact_last;
        if(body.contact_email) user.contact_email = body.contact_email;
        if(typeof(body.program_code) !== 'undefined'){
          user.program_code = body.program_code;
        }
        if(typeof(body.email) !== 'undefined'){
          user.email = body.email;
        }
        if(typeof(body.religion) !== 'undefined') user.religion = body.religion;
        if(typeof(body.gender) !== 'undefined') user.gender = body.gender;
        if(typeof(body.zip_postal) !== 'undefined') user.zip_postal = body.zip_postal;
        if(typeof(body.birthday) !== 'undefined') user.birthday = body.birthday;
        if(typeof(body.profile_photo_url) !== 'undefined') user.profile_photo_url = body.profile_photo_url;
        if(typeof(body.cover_photo_url) !== 'undefined') user.cover_photo_url = body.cover_photo_url;
        if(typeof(body.instagram_token) !== 'undefined') user.instagram_token = body.instagram_token;
        if(typeof(body.instagram_min_id) !== 'undefined') user.instagram_min_id = body.instagram_min_id;
        if(typeof(body.twitter_token) !== 'undefined') user.twitter_token = body.twitter_token;
        if(typeof(body.twitter_min_id) !== 'undefined') user.twitter_min_id = body.twitter_min_id;
        if(typeof(body.phone_number) !== 'undefined') user.phone_number = body.phone_number;
        if(typeof(body.tumblr_token) !== 'undefined') user.tumblr_token = body.tumblr_token;
        if(typeof(body.tumblr_min_id) !== 'undefined') user.tumblr_min_id = body.tumblr_min_id;
        if(typeof(body.tumblr_token_secret) !== 'undefined') user.tumblr_token_secret = body.tumblr_token_secret;
        if(typeof(body.mascot) !== 'undefined') user.mascot = body.mascot;
        if(typeof(body.date_founded) !== 'undefined') user.date_founded = body.date_founded;
        if(typeof(body.enrollment) !== 'undefined') user.enrollment = body.enrollment;
        if(typeof(body.state) !== 'undefined') user.state = body.state;
        if(typeof(body.city) !== 'undefined') user.city = body.city;
        if(typeof(body.type) !=='undefined') user.type = body.type;
        if(typeof(body.subtype) !== 'undefined') {
          user.subtype = body.subtype;
          did_change_subtype = true;
        }
        var handleUserSave = function(err, saved){
         if(err || !saved){
            if (err && err.code == 11000) {
              error =  {
                status_code: 400,
                error_info: {
                  error: 'That email address already exists in our database.',
                  error_description: 'An error occured while trying to update'
                   + 'the user, please try again.'
                }
              };
            }
            _utils.prismResponse(res, null, false, error);
          } else {
          _utils.prismResponse(res, saved.format('basic'), true);
        }
      };
      user.save(function(err, result){
        checkAndUpdateOrg(result, function(err, saved){
          handleUserSave(err, saved);
        });
      });
      //if (user.program_code) {

      // testForOrg(user, handleUserSave);
    };
  });
        /** console.log('finding program');
        Organization.findOne({code: user.program_code}, 
            function(err, organization){
              console.log('found organization');
              console.log(organization);
              if (err) {
                console.log(err);
              } 
              if (organization){
                console.log('found theme');
                user.organization = organization._id;
                user.theme = organization.theme;
              } else {
                user.organization = null;
                user.theme = null;
              }
              user.save(function(err, saved){
                handleUserSave(err, saved);  
              });
            }
        );  
      } else {
        user.theme = null;
        user.organization = null;
        user.save(function(err, saved){
          handleUserSave(err, saved);
        });
      }
    } 
    }); **/

 };
};
/**
 * [fetchUserNewsFeed description]
 * @param  {HTTPRequest} req The request object
 * @param  {HTTPResponse} res The response object
 * @return {Post} Returns A Post Object array containing ..
 */
exports.fetchUserNewsFeed = function(req, res){
  if(req.params.id){
    User.findOne({_id: req.params.id})
      .populate({path: 'org_status.organization', model: 'Organization'})
      .exec(function(err, user){

      if(err || !user){
        _utils.prismResponse(res,null,false,PrismError.invalidUserRequest);

      }else{
        //fetch all posts that are public & the user is following
        var following_array = [];
        var trusts_array = [];
        for(var i = 0; i < user.following.length; i++){
          following_array.push(user.following[i]._id);
        }
        var org = _.filter(user.org_status, function(os){
          return os.status == 'active';
        });
        console.log(org);
        var organizations = _.pluck(org, 'organization');
        console.log(organizations);
        var orgIds = _.pluck(organizations, '_id');
        var owners = _.pluck(organizations, 'owner');
        console.log('Owners: ' + owners);
        console.log('OrgIds: ' + orgIds);
        Trust.find({status: 'accepted', $or : [{to:req.params.id},{from:req.params.id}]}, function(err, trusts){
          if(err){
            _logger.log('error', 'an error was returned while trying to fetch trusts for feed for user: '+req.params.id);
            _utils.prismResponse(res, null, false, PrismError.serverError);

          }else{
            if(_.has(trusts, 'length')){
              for(var t=0; t < trusts.length; t++){
                var trust = trusts[t].toObject();
                var to = trust.to.toString();
                var from = trust.from.toString();
                var item;
                if(to === req.params.id){
                  item = from;
                }else{
                  item = to;
                }
                trusts_array.push(item);
              }
            }
            User.find({org_status: {$elemMatch: {organization: {$in: orgIds}, status: 'active'}}})
            .select({_id: 1})
            .exec(function(err, users){
              if (err) console.log(err);
              var orgArray = [];
              if (users) {
                orgArray = _.pluck(users, '_id');
              }
              var posts_array = [];
              var criteria = {$or: 
                [  
                  {scope: 'public', 
                   status: 'active', 
                   creator: {$in:following_array}},
                   {scope: {$in:['trust', 'public']}, 
                     status: 'active', 
                     creator: {$in:trusts_array}},
                    {creator: user._id, status: 'active'},
                   {scope: {$in:['trust', 'public']},
                     status: 'active',
                     creator: {$in: orgArray}},
                   {scope: {$in:['trust', 'public']},
                     status: 'active',
                     creator: {$in: owners}}
                  ],
                  is_flagged: false
            };
              new Twine('Post', criteria, req, {status: 'active'}, function(err, result){
              if(err){
                _logger.log('error', 'fetch news feed via twine returned error', {error:err});
                _utils.prismResponse(res, null, false, PrismError.serverError);
              }else{
                for(var index in result){
                  if(result[index].status === 'inactive'){
                    delete result[index];
                  }
                }
                _utils.prismResponse(res, result, true);
              }
            });

            });
          }
        });
      }
    });
  }else{
    _utils.prismResponse(res,null,false,PrismError.invalidRequest);
  }
};


//TODO: move to posts route class
/**
 * [createUserPost description]
 * @param  {[type]} req [description]
 * @param  {[type]} res [description]
 * @return {[type]}     [description]
 */
exports.createUserPost = function(req, res){
  if(req.params.id){
    if(req.body.text || req.body.file_path){
      var post = new Post({
        category: req.body.category,
        creator: req.body.creator
      });

      if(req.body.location_longitude != 'undefinded' && req.body.location_latitude != 'undefined'){
        post.location_longitude = req.body.location_longitude;
        post.location_latitude = req.body.location_latitude;
        post.location_name = req.body.location_name;
      }

      if(req.body.file_path && req.body.file_path != 'undefined') post.file_path = req.body.file_path;
      if(req.body.text && req.body.text != 'undefined') post.text = req.body.text;
      if(req.body.scope != 'undefined') post.scope = req.body.scope;
      if(req.body.external_provider !== 'undefined') post.external_provider = req.body.external_provider;
      if(req.body.external_link !== 'undefined') post.external_link = req.body.external_link;
      if(req.body.hash_tags){
        post.hash_tags = req.body.hash_tags;
        post.hash_tags_count = req.body.hash_tags.length;
      }

      if(typeof req.body.origin_post_id !== 'undefined'){
        post.origin_post_id = req.body.origin_post_id;
        post.is_repost = true;
      }

      User.findOne({_id: req.params.id}, function(error, user){
        if(error){
          console.log('Error retrieving user by id: ' + req.params.id);
          _utils.prismResponse(res, null, false, PrismError.invalidUserRequest);

        }else{
          post.type = user.type;
          post.subtype = user.subtype;
          if (user.visibility && user.visibility == 'restricted') {
            post.is_flagged = true;
          }
          if(!_.isUndefined(req.body.accolade_target)){
            post.accolade_target = req.body.accolade_target;
            post.tags.push({_id: req.body.accolade_target});
          }
          post.save(function(error, user_post){
            if(error){
              _logger.log('error', 'Error trying to create/save a new post',
                          { post_object: post,
                            request_body: req.body,
                            user_object: user,
                            post_error: error });
              _utils.prismResponse(res, null, false, PrismError.invalidUserRequest);

            }else{
              Post.findOne({_id: user_post._id})
              .populate('creator', {first_name: 1, last_name:1,  profile_photo_url: 1, type: 1} )
              .exec(function(err, usr){

                //update post count on creator object
                User.findOne({_id: req.body.creator}, function(err, c_user){
                  if(err){
                    console.log(err);
                    _utils.prismResponse(res, null, false, PrismError.serverError);
                  }else{
                    c_user.posts_count = c_user.posts_count+1;
                    c_user.save(function(err, updated_count){
                      if(err){
                        console.log(err);
                        _utils.prismResponse(res, null, false, PrismError.serverError);
                      }else{
                        if(usr.is_repost){
                          usr.fetchRepostShortUser(usr.origin_post_id, function(err, org_user){
                            usr = usr.toObject();
                            usr.origin_post_creator = org_user;

                            //create repost activity
                            _utils.registerActivityEvent(org_user._id,
                                                         req.body.creator,
                                                         'repost',
                                                         user_post._id);

                            _utils.prismResponse(res, usr, true);
                          });

                        }else{
                          //if an accolade_target is set send activity & push notification
                          if(user_post.accolade_target){
                            _utils.registerActivityEvent(user_post.accolade_target,
                                                    req.body.creator,
                                                    'accolade',
                                                    user_post._id);
                          }
                          
                         console.log(c_user); 
                          if (c_user.type == 'institution_verified'){
                            console.log('finding members');
                            Organization.findOne({owner: c_user._id}, function(err, org){
                              if (org){
                                console.log('found organization');
                                Trust.find({from: c_user._id, status: 'accepted'}, function(err, trusts){
                                  var luminaries = [];
                                  if (trusts.length > 0) {
                                    luminaries = _.pluck(trusts, 'to');
                                  }
                                  User.find({
                                    //$or: [
                                        //org_status: {$elemMatch: {organization: org._id, status: 'active'}}
                                     // ,
                                    $or : [
                                      {_id: {$in: luminaries}},
                                      {org_status: {$elemMatch: {organization: org._id, status: 'active'}}}
                                    ]
                                     //   {_id: {$in: luminaries}}
                                      
                                   // ]
                                  }, function(err, users){
                                    if (users) console.log(users.length + ' users found.');
                                    _.each(users, function(member, index, list){
                                      _utils.registerActivityEvent(
                                        member._id,
                                        c_user._id,
                                        'post',
                                        user_post._id
                                      );
                                  });

                                  });
                                });
                                                             }
                            });/**
                            User.find({org_status: {$elemMatch: {ow
                            _.each(c_user.followers, function(follower, index, list){
                              _utils.registerActivityEvent(follower._id, 
                                c_user._id, 
                                'post', 
                                user_post._id); 
                            });   
                            */   
                          }
                          
                          
                          _utils.prismResponse(res, usr, true);
                        }
                      }
                    });
                  }
                });
              });
            }
          });
        }
      });
    }else{
      _logger.error('Invalid Request for create posts.' +
                    ' Missing either text or file_path ', {request_body: req.body});
      _utils.prismResponse(res, null, false, PrismError.invalidRequest,
                                              PrismError.invalidRequest.status_code);
    }

  }else{
    _logger.error('Invalid request for create posts. '+
                  ' Missing user id', {request_params: req.params});
    _utils.prismResponse(res, null, false, PrismError.invalidUserRequest,
                                            PrismError.invalidUserRequest.status_code);
  }
};


//TODO: move to posts route class
/**
 * Fetchs Prism Users posts
 *
 * @param  {HTTPRequest} req The request object
 * @param  {HTTPResponse} res The response object
 * @return {Post} Returns the User.posts subdocument array
 */
exports.fetchUserPosts = function(req, res){
  var fetch_criteria = {};
  var fetch_query, fetch_options;

  _logger.info('fetch users posts params: ', req.params);

  if(req.params.id){
    if(req.query){
      fetch_options = _utils.parsedQueryOptions(req.query);
      if(req.query.feature_identifier){
        if(req.query.direction && req.query.direction == 'older'){
          fetch_criteria = {
            target_id: req.params.id,
            create_date: { $lt: req.query.feature_identifier},
            status: 'active'
          };
        }else{
          fetch_criteria = {
            target_id: req.params.id,
            create_date: { $gt: req.query.feature_identifier},
            status: 'active'
          };
        }

        fetch_query = _utils.buildQueryObject(Post, fetch_criteria, fetch_options);
      }else{
        fetch_criteria = {target_id: req.params.id, status: 'active'};
        fetch_query = _utils.buildQueryObject(Post, fetch_criteria, fetch_options);
      }

    }else{
      fetch_criteria = {_id: req.params.id};
      fetch_query = _utils.buildQueryObject(Post, fetch_criteria);
    }

    var fetch_populate = ['creator', 'first_name last_name profile_photo_url'];
    fetch_query.populate(fetch_populate).exec(function(error, user_posts){

      if(error){
        _logger.error('error', 'Error retrieving by user_id: ', req.params.id);
        _utils.prismResponse(res, null, false, PrismError.invalidUserRequest);

      }else{

          _utils.prismResponse(res, user_posts, true);
      }
    });
  }else{
    _utils.prismResponse(res, null, false, PrismError.invalidUserRequest,
                                            PrismError.invalidUserRequest.status_code);
  }
};

/**
 * Validates the required User properties are present
 * for registration
 *
 * @param  {HTTPRequest} req The request object
 * @return {Boolean}
 */
var isValidRegisterRequest = function(req){
  if( typeof(req.body.first_name) == 'undefined'  ||
      typeof(req.body.zip_postal) == 'undefined'){
    return false;

  }else{
    if(!isSocialProvider(req.body)){
      if(typeof(req.body.email) == 'undefined'){
        return false;
      }
    }
    return true;
  }
};

/**
 * [isValidSocialRegisterRequest description]
 * @param  {[type]}  req
 * @return {Boolean}
 */
var isValidSocialRegisterRequest = function(req){
  if(isValidRegisterRequest(req)){
    if( typeof(req.body.provider) == 'undefined' ||
        typeof(req.body.provider_token) == 'undefined'  ){
      return false;
    }else{
      if(req.body.provider == 'twitter'){
        if(typeof(req.body.provider_token_secret) == 'undefined') return false;
      }

      return true;
    }
  }else{
    return false;
  }
};

/**
 * Takes passed plain text password & hashes it to
 * validate it equals the stored hash password
 *
 * @param  {User} user The located User object
 * @param  {String} password_to_validate The password to validate
 * @return {Boolean}
 */
var hashAndValidatePassword = function(user, password_to_validate){
  //create user hash
  if(user){
    //var hash_salt        =  user.createUserSalt();
    var hash_salt = process.env.PRIZM_SALT;
    var hashed_password  = _utils.prismEncrypt(password_to_validate, hash_salt);
    if(hashed_password == user.password) {
      return true;
    } else {
      var old_salt = user.createUserSalt();
      var hashed_password = _utils.prismEncrypt(password_to_validate, old_salt);
      if (hashed_password == user.password) {
        user.password = password_to_validate;
        user.pwd_updated = true;
        if (user.hashPassword()) {
          user.save();
          return true;
        }
      }
    }
  }
  return false;
};

/**
 * [handleSocialProvider description]
 * @param  {[type]}   body
 * @param  {Function} callback
 * @return {[type]}
 */
var handleSocialProviderLogin = function(body, callback){
  switch(body.provider){
    case 'facebook':
      var fb = new Facebook(body.provider_token);
      fb.authorizeUser(function(error, response){
        if(error){
          // console.log('authorize on login did error: ' + error);
          callback(error, false);
        }else if(response){

          var user = User.findOne({provider_id: response.body.id, active: true});
          user.select(User.selectFields('basic').join(" "));
          user.exec(function(error, response){
            if(error){
              callback(PrismError.serverError, false);
            }else if(response && response._id){
              response.last_login_date = new Date();
              response.save();
              callback(false, response);
            }else{
              callback(PrismError.invalidSocialUser, false);
            }
          });
        }else{
          callback(PrismError.serverError, false);
        }
      });
      break;
    case 'twitter':
      var tw = new Twitter(body.provider_token, body.provider_token_secret);
      tw.authorizeUser(function(error, result){
        if(error){
          _logger.error('Error returned attempting to authorize twitter user: ',
                    error);
          callback(error, false);

        }else if(result){
          _logger.info('Succesfuly returned object from authorizing twitter user: ', result);
          _logger.log(result);

          var user = User.findOne({provider_id: result.id.toString()});
          user.select(User.selectFields('basic').join(" "));
          user.exec(function(error, response){
            if(error){
              _logger.error('Error returned trying to find twitter user in prism.'+
                            ' Users does not exist.', {error: error, twitter_user: result});
              callback(PrismError.invalidSocialUser, false);

            }else if(response && response._id){
              response.last_login_date = new Date();
              response.save();
              _logger.info('Found twitter user to validate login', {user: response});
              callback(false, response);

            }else{
              _logger.warn('Did not find an error or result in fetching twitter user');
              callback(PrismError.invalidSocialUser, false);
            }
          });

        }else{
          _logger.error('A server error occured. No error or'+
                       ' result was retured from authorizing a twitter user');
          callback(PrismError.serverError, false);
        }
      });
      break;
    case 'google':
      var gplus = new Google(body.provider_token);
      gplus.authorizeUser(function(error, result){
        if(error){
          callback(error, false);

        }else if(typeof result.id !== 'undefined'){
          //lookup user by provider_id to ensure exists, otherwise registration is required
          var user = User.findOne({provider_id: result.id.toString()});
          user.select(User.selectFields('basic').join(' '));
          user.exec(function(error, response){
            if(error || !response){
              _logger.log('error', 'Unable to find googleplus user or server error was thrown',
                          {error: error, response: response});
              callback(PrismError.invalideSocialUser, false);
            }

            _logger.log('info', 'Found Google Plus user to validate login', {user: response});
            callback(false, response);
          });

        }else{
          _logger.log('error', 'Unhandled event caused by no error or result returning',
                      {result: result, error: error});
          callback(PrismError.serverError, false);
        }
      });
      break;
    default:
      _logger.log('A unsupported provider type was passed to user registration ',
                  {provider: body.provider});

      callback(PrismError.unsupportedProviderType(body.provider), false);
      break;
  }
};

/**
 * [handleSocialProviderRegistration description]
 * @param  {[type]}   body     [description]
 * @param  {Function} callback [description]
 * @return {[type]}            [description]
 */
var handleSocialProviderRegistration = function(body, callback){
  switch(body.provider){
    case 'facebook':
      var fb = new Facebook(body.provider_token);
      fb.authorizeUser(function(error, response){
        if(error){
          _logger.log('fb authorize error in handleRegistration :',
                      {error: error});

          callback(error, false);
        }else{
          _logger.log('succesful auth & callback with fb authorizeUSer in handleRegistration ',
                      {fb_response_body: response.body});

          callback(false, response.body);
        }
      });
      break;
    case 'twitter':
      var tw = new Twitter(body.provider_token, body.provider_token_secret);
      tw.authorizeUser(function(error, result){
        if(error){
          _logger.error('tw authorize error in handleRegistration: ',
                      {error: error});
          callback(error, false);
        }else{
          _logger.info('succesful auth & response with tw authorizeUser in hanldeRegistration ',
                        {tw_response_body: result});
          callback(false, result);
        }
      });
      break;
    case 'google':
      var gplus = new Google(body.provider_token);
      gplus.authorizeUser(function(error, result){
        if(error || !result){
          _logger.error('unable to authorize googleplus user in handleRegistration: ',
                       {error: error, result: result});
          callback(error, false);

        }else if(result.id){
          _logger.log('info','successful auth & response for googkeplus authroizeUser in reg');
          callback(false, result);

        }else{
          _logger.log('error', 'Unhandled situation with no error and no response from googleplus reg');
        }
      });
      break;
    default:
      //there is no default. therefore the requested provider authorization is
      //not currently supported. Log & reutrn error
      _logger.log('A unsupported provider type was passed to user registration ',
                  {provider: body.provider});

      callback(PrismError.unsupportedProviderType(body.provider), false);
      break;
  }
};

/**
 * Validates the login request body has required properties to
 * process authenticating the user. This can be in the form of
 * traditional authentication {username:pass} OR social authentication
 * which requries {provider, provider_id, & provider_token}
 *
 * @param  {Object}  body The request body object
 * @return {Boolean}
 */
var isValidLoginRequest = function(body){
  // console.log("is valid login request: (body) " + JSON.stringify(body));
  if(body.email && body.password){
    return true;
  }else{
    if(isSocialProvider(body)){
      return true;
    }
    return false;
  }
};

/**
 * Determines if the request body is/has social provider attributes
 *
 * @param  {Object}  body The request body object
 * @return {Boolean}
 */
var isSocialProvider = function(body){
  if(body.provider && body.provider_token){
    console.log('isSocialProvider -- body:' + JSON.stringify(body));
    return true;
  }
  return false;
};

/**
 * Search User
 */
exports.search = function(req, res){
  //create invalid search error;
  var error = {
    status_code: 400,
    error_info: {
      error: 'invalid_search_request',
      error_description: 'A search key & object value must be included in the X-Arguments httpd header'
    }
  };
  if(req.headers['x-arguments']){
    var args = new Buffer(req.headers['x-arguments'], 'base64').toString('utf8');
    args = JSON.parse(args);
    if(!args.search) _utils.prismResponse(res, null, false, error);

    var search_key = Object.keys(args.search)[0];
    if(!search_key) _utils.prismResponse(res, null, false, error);
    var criteria = {};
    criteria[search_key] = {$regex: formatStringSearchVariable(args.search[search_key])};
    criteria.active = true;
    new Twine('User', criteria, req, null, function(err, response){
      if(err) _utils.prismResponse(res, null, false, PrismError.serverError);
      _utils.prismResponse(res, response, true);
    });
  }else{
    _utils.prismResponse(res, null, false, error);
  }
};
