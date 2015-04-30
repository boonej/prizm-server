var mongoose = require('mongoose');
var ObjectId      = mongoose.Schema.Types.ObjectId;

var groupSchema = new mongoose.Schema({
  name          : {type: String, required: true, index: true},
  description   : {type: String, default: ''},
  organization  : {type: ObjectId, ref: 'Organization', required: true},
  leader        : {type: ObjectId, ref: 'User', required: false},
  create_date   : {type: Date} 
});

groupSchema.statics.selectFields = function(type){
  return ['_id', 'name', 'description', 'organization', 'leader', 'create_date'];
};

groupSchema.statics.canResolve = function(){
  return [
    {organization: {identifier: '_id', model: 'Organization'}},
    {leader: {identifier: '_id' , model: 'User'}}
  ];
};


groupSchema.methods.format = function(type, add_fields, callback){
  return {
    name        : this.name,
    description : this.description,
    organization: this.organization,
    leader      : this.leader,
    create_date : this.create_date
  }

};

groupSchema.pre('save', function(next){
  if (!this.create_date) {
    this.create_date = Date.now();
  }
  next();
});

groupSchema.statics.newGroup = function(obj, next){
  if (obj.organization && obj.name) {
    var model = new this(obj);
    model.save(function(err, group){
      console.log('Error: ' + err);
      console.log('Group: ' + group);
      next(err, group);
    });
  } else {
    next({err: 'no organization or object name'}, false);
  }
}

mongoose.model('Group', groupSchema);