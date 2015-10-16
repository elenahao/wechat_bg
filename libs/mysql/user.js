'use strict'

var Q = require('q');
var pool = require('./client');

exports.findUsersByPage = function (pageNo, pageSize) {
    console.log('in findUsersByPage...');
    var dfd = Q.defer();
    pool.getConnection(function (err, conn) {
        console.log('getConnection...');
        conn.query("select count(*) as u from wx_user", function (err, ret) {
            if (err) {
                dfd.reject(err);
            }
            else {
                var totalCount = ret[0].u;
                var totalPage = Math.ceil(totalCount / pageSize);
                if(pageNo > totalPage){
                    pageNo = totalPage;
                }
                var offset = (pageNo - 1) * pageSize;
                if(offset < 0){
                    offset = 0;
                }
                console.log('totalCount:',totalCount,';totalPage:',totalPage,'offset:',offset);
                conn.query("select u.* from wx_user u limit ?,?", [offset, pageSize], function (err, rows) {
                    if(err){
                        dfd.reject(err);
                    }else{
                        console.log(JSON.stringify({totalCount:totalCount, totalPage:totalPage, users:rows}));
                        dfd.resolve({totalCount:totalCount, totalPage:totalPage, users:rows});
                    }
                });
            }
            conn.release();
        })
    });
    return dfd.promise;
}

exports.addUserOpenid = function (openid) {
    var dfd = Q.defer();
    pool.getConnection(function (err, conn) {
        openid = "('" + openid + "')";
        //console.log(openid);
        conn.query('insert ignore into wx_user(openid) values '+openid, function (err, ret) {
            if (err) {
                console.error(err);
                dfd.reject(err);
            }
            else {
                dfd.resolve(ret);
            }
            conn.release();
        })
    })
    return dfd.promise;
};

exports.findOpenidByPage = function (pageNo, pageSize) {
    console.log('in findOpenidByPage...');
    var dfd = Q.defer();
    pool.getConnection(function (err, conn) {
        console.log('getConnection...');
        //conn.query("select count(*) as u from wx_user where u.nickname is null", function (err, ret) {
        //    if (err) {
        //        dfd.reject(err);
        //    }
        //    else {
                //var totalCount = ret[0].u;
                var totalCount = 12443066;
                var totalPage = Math.ceil(totalCount / pageSize);
                if(pageNo > totalPage){
                    pageNo = totalPage;
                }
                var offset = (pageNo - 1) * pageSize;
                if(offset < 0){
                    offset = 0;
                }
                console.log('totalCount:',totalCount,';totalPage:',totalPage,'offset:',offset);
                conn.query("select u.openid from wx_user u where u.nickname is null limit ?,?", [offset, pageSize], function (err, rows) {
                    if(err){
                        dfd.reject(err);
                    }else{
                        dfd.resolve(rows);
                    }
                });
            //}
            conn.release();
        //})
    });
    return dfd.promise;
}

exports.updateUser = function (users) {
    var dfd = Q.defer();
    pool.getConnection(function (err, conn) {
        //console.log('--'+users+'--');
        if(users && users != ''){
            conn.query('replace into wx_user (subscribe,openid,nickname,sex,language,city,province,country,headimgurl,subscribe_time,unionid,remark,groupid) values '+users, function (err, ret) {
                if (err) {
                    console.error(err);
                    dfd.resolve('mysql update error');
                }
                else {
                    dfd.resolve(ret);
                }
                conn.release();
            })
        }else{
            conn.release();
            dfd.resolve('null data');
        }
    })
    return dfd.promise;
};

