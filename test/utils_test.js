/**
 * Utils Helper Unit Tests
 * @author DJ Hayden <dj.hayden@stablekernel.com>
 */
var _request  = require('request'),
    _mongoose = require('mongoose'),
    _chai     = require('chai'),
    _expect   = _chai.expect,
    _should   = _chai.should(),
    _assert   = _chai.assert,
    uuid      = require('node-uuid');
    _server   = require(process.env.PRISM_HOME + 'server');

describe('Utils Helper Unit Tests', function(done){
  describe('Testing Standard PrismResponse Format', function(done){
    it('should return a standard response format with data array when a valid response is invoked', function(done){
      _request({url: 'https://localhost:3000/testresponseformat/0',
                strictSSL: false,
                json: true
      }, function(err, res, body){
        var string = JSON.stringify(body);
        var result = JSON.parse(string);
        _expect(result).to.have.property('metadata');
        _expect(result).to.have.property('data');
        _expect(result.data).to.be.a('array');
        _expect(result.metadata).to.have.property('success');
        _expect(result.metadata.success).to.equal(true);
        _expect(result.data).to.have.length(2);
        done();
      });
    });
  });

  describe('Testing credentials method', function(done){
    var test_client = uuid.v4();
    var test_secret = uuid.v4();
    var hashed_creds_string = "Basic " +
      (new Buffer(test_client+':'+test_secret).toString('base64'));
    var test_access_token = uuid.v4();
    var bearer_creds_string = "Bearer " + test_access_token;

    it('should finish writing unit tests for these classesszz', function(done){
      done();
    });
  });
});
