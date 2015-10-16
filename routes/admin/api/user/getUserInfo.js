/**
 * Created by elenahao on 15/9/7.
 */

'use strict';
var path = require('path');
var Q = require('q');
var Lazy = require('lazy.js');
var _ = require('lodash');
var request = require('request');
var http = require('http');
var iconv = require('iconv-lite');
var fs = require('fs');
var redis = require(path.resolve(global.gpath.app.libs + '/redis'));
var mysql = require(path.resolve(global.gpath.app.libs + '/mysql'));
var Token = require(path.resolve(global.gpath.app.model + '/common/token'));
var User = require(path.resolve(global.gpath.app.model + '/common/user'));

// 调取微信接口获取用户的详细信息
app.get('/admin/api/getInfo/user', function(req, res) {
    console.log("admin userInfo get...");
    var ACCESS_TOKEN = '';
    Token.getAccessToken().then(function resolve(res) {
        if(res.access_token){
            console.log(res.access_token);
            ACCESS_TOKEN = res.access_token;
            //从mysql获取所有用户openid scan 每次获取100
            scan(ACCESS_TOKEN);
        }
    },function reject(err){
        res.status(400).send(JSON.stringify({
            ret: -1,
            msg: err
        }));
    })
});

function scan(ACCESS_TOKEN) {
    var dfd = Q.defer();
    var count = 100;
    var cursor = 0;
    function _scan(ACCESS_TOKEN){
        User.getOpenidByPage(cursor, count).then(function done(openids){
            request({
                url: 'https://api.weixin.qq.com/cgi-bin/user/info/batchget?access_token='+ACCESS_TOKEN,//+'&user_list='+JSON.stringify({user_list: user_list}),
                body: JSON.stringify({user_list: openids}),
                method: 'POST'
            }, function(err, res, body) {
                if (err) console.log(err);
                if (res.statusCode === 200) {
                    res.setEncoding('utf-8');
                    console.log('success');
                    body = body.replace(/\n/g, "").replace(/\r/g, "").replace(/\n\r/g, "").replace(/\r\n/g, "")
                        .replace(/\xEE[\x80-\xBF][\x80-\xBF]|\xEF[\x81-\x83][\x80-\xBF]|\xEF[\\xF0-\\x9F]/g, '')
                        .replace(/([\uE000-\uF8FF]|\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDDFF])/g, '')
                        .replace(/\\/g, "\\\\")
                        .replace(/\\"/g, '')
                        .replace(/\t/g, "\\t")
                        .replace(/\f/g, "\\f");
                    var buf = new Buffer(body);
                    var decoder = new (require('string_decoder').StringDecoder)('utf-8')
                    console.log(decoder.write(buf));
                    //var __body = iconv.decode(buf, 'utf8');
                    var _body = {};
                    try {
                        _body = JSON.parse(decoder.write(buf));
                    } catch (err) {
                        console.log(err);
                        cursor ++;
                        _scan(ACCESS_TOKEN);
                    }
                    if (_body && _body.user_info_list) {
                        var user_info_list = _body.user_info_list;
                        var users = [];
                        for (var i = 0; i < user_info_list.length; i++) {
                            var user = user_info_list[i];
                            var temp = '';
                            if (user && user.nickname) {
                                //console.log(user.nickname);
                                temp = "(" + user.subscribe + ",'" + user.openid + "','" + user.nickname.replace(/\\'/g, "\\\\'").replace(/\'/g, "\\\'") + "'," + user.sex + ",'" + user.language +
                                    "','" + user.city + "','" + user.province + "','" + user.country + "','" + user.headimgurl + "'," + user.subscribe_time +
                                    ",'" + user.unionid + "','" + user.remark + "'," + user.groupid + ")";
                                users.push(temp);
                            }
                        }
                        Q.all(
                            users
                        ).then(function resolve(res) {
                                return mysql.user.updateUser(res.toString());
                            }, function reject(err) {
                                dfd.reject(err);
                            }).then(function resolve(res) {
                                console.log('is update ok:', res);
                                if (openids.length != count) {
                                    dfd.resolve(res);
                                } else {
                                    cursor++;
                                    _scan(ACCESS_TOKEN);
                                }
                            }, function reject(err) {
                                dfd.reject(err);
                            })

                    } else {
                        console.log('出错，重新获取:' + body);
                        var temp = JSON.parse(body);
                        if(temp && temp.errcode == 40001){
                            redis.del('access_token').then(function resolve(res) {
                                return Token.getAccessToken();
                            }, function reject(err) {
                                dfd.reject(err);
                            }).then(function resolve(res) {
                                if (res.access_token) {
                                    cursor++;
                                    _scan(res.access_token);
                                }
                            }, function err(err) {
                                dfd.reject(err);
                            });
                        }else{
                            cursor ++;
                            _scan(ACCESS_TOKEN);
                        }
                    }
                }
            });
        }, function err(err){
            dfd.reject(err);
        })
    }
    _scan(ACCESS_TOKEN);

    return dfd.promise;
}