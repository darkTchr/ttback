const express = require('express');
const bodyParser = require('body-parser');
var multer = require('multer')
var path = require('path')
const app = express();
app.use(bodyParser.json());//数据JSON类型
app.use(bodyParser.urlencoded({extended: false}));//扩展 false
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
let OptPool = require('./model/OptPool');
let optPool = new OptPool();
let pool = optPool.getPool();

let storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './uploads/')
    },
    filename: function (req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
})
let upload = multer({storage: storage})


function randomString(len) {
    len = len || 32;
    var $chars = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678';
    var maxPos = $chars.length;
    var pwd = '';
    for (let i = 0; i < len; i++) {
        pwd += $chars.charAt(Math.floor(Math.random() * maxPos));
    }
    return pwd;
}

app.use(function (req, res, next) {
    //允许所有源
    res.header("Access-Control-Allow-Origin", "*");
    //预检请求允许使用的方法或方法列表。
    res.header('Access-Control-Allow-Methods', 'PATCH,PUT, GET, POST, DELETE, OPTIONS');
    //预检请求Access-Control-Expose-Headers 字段中出现的首部信息。
    // 简单首部，如
    // simple headers、Accept、Accept-Language、Content-Language、
    // Content-Type（只限于解析后的值为 application/x-www-form-urlencoded、multipart/form-data 或 text/plain 三种MIME类型（不包括参数））它们始终是被支持的，不需要在这个首部特意列出。
    res.header('Access-Control-Allow-Headers', 'Content-Type,authorization');
    // res.header("Access-Control-Allow-Headers", "X-Requested-With");
    //是否可以将对请求的响应暴露给页面
    res.header("Access-Control-Allow-Credentials", true);
    next();
});

//注册
app.post('/register', (req, res) => {

    let {mobile, code} = req.body;
    if (code === '246810') {
        pool.getConnection(function (err, conn) {
            let sql = `select * from users where mobile=${mobile}`;
            conn.query(sql, (err, result) => {
                if (err) {
                    res.json(err);
                } else if (result.length !== 0) {
                    res.status(999).json({
                        message: '注册失败,手机存在,请登录',
                    });
                } else {
                    let token = randomString() + new Date().getTime();

                    let sql = `insert into users(mobile,token,name) values('${mobile}','${token}','大神')`;
                    conn.query(sql, (err, result) => {
                        if (err) {
                            res.json(err);
                        } else {
                            res.json({
                                message: '注册成功',
                                data: {token}
                            });
                        }
                        conn.release();
                    });
                }

            });
        })
    } else {
        res.status(999).json({
            message: '验证码错误'
        });
    }
});

//登陆,授权
app.post('/authorizations', (req, res) => {

    let {mobile, code} = req.body;

    if (code === '246810') {
        // let token = randomString() + new Date().getTime();
        pool.getConnection(function (err, conn) {
            let sql = `select * from users where mobile=${mobile}`;
            conn.query(sql, (err, result) => {
                if (err) {
                    res.json(err);
                } else {
                    if (result.length !== 0) {
                        res.json({
                            message: 'ok',
                            data: {
                                id: result[0].id,
                                name: result[0].name,
                                mobile: result[0].mobile,
                                photo: result[0].photo,
                                token: result[0].token
                            }
                        });
                    } else {
                        res.status(999).json({
                            message: '无此用户，请注册'
                        });
                    }
                }
                conn.release();
            });

        })

    } else {
        res.status(999).json({
            message: '验证码错误'
        });
    }
});

//获取用户信息
app.get('/user/profile', (req, res) => {
    // res.setHeader("Access-Control-Allow-Origin", "*");
    let Bearer = req.headers.authorization;

    if (Bearer) {
        let token = req.headers.authorization.substring(7);
        pool.getConnection(function (err, conn) {
            let sql = `select * from users where token='${token}'`;
            conn.query(sql, (err, result) => {
                if (err) {
                    res.json(err);
                } else {
                    if (result.length !== 0) {
                        res.json({
                            status: '666',
                            message: '用户信息',
                            data: {
                                id: result[0].id,
                                name: result[0].name,
                                photo: result[0].photo,
                                mobile: result[0].mobile,
                                email: result[0].email,
                                intro: result[0].intro
                            }
                        });
                    } else {
                        res.status(403).json({
                            message: '查无此人,非法访问'
                        });
                    }
                }
                conn.release();
            })

        })
    } else {
        res.status(403).json({
            message: '非法访问'
        });
    }
});

//留言列表
app.get('/articles', (req, res) => {
    let query = req.query;
    let page = query.page;//当前页
    let per_page = query.per_page;//每页几条
    let response_type = query.response_type;//类型
    let start = (page - 1) * per_page;
    if (response_type === 'comment' && per_page === '4') {
        pool.getConnection(function (err, conn) {
            let sql = `select count(*) from ${response_type} ; select * from ${response_type} limit ${start},${per_page}`;
            conn.query(sql, (err, result, fields) => {
                if (err) {
                    res.json(err);
                } else {
                    let total_count = result[0][0]['count(*)']
                    res.json({
                            "message": "OK",
                            "data": {
                                "total_count": total_count, "page": page, "per_page": per_page, "results": result[1]
                            }
                        }
                    );
                }
                conn.release();
            })

        })
    } else {
        res.status(400).json({
            message: '请求参数错误'
        });
    }

})

//更改留言状态
app.put('/comments/status', (req, res) => {
    let query = req.query;
    let article_id = query.article_id;
    let comment_status = req.body.allow_comment ? 1 : 0;
    pool.getConnection(function (err, conn) {
        let sql = `update comment set comment_status=${comment_status} where id=${article_id}`;
        conn.query(sql, (err, result, fields) => {
            if (err) {
                res.json(err);
            } else {
                res.json({
                    message: 'OK'
                })
            }
            conn.release();
        })
    })

})

//素材列表
app.get('/user/images', (req, res) => {

    let query = req.query;
    let page = query.page;//当前页
    let per_page = query.per_page;//每页几条
    let collect = eval(query.collect.toLowerCase()) ? 1 : 0;//collect为false 0 就是查全部数据 collect 为true 1 的话 是查询收藏数据
    let start = (page - 1) * per_page;
    if (per_page === '2') {
        pool.getConnection(function (err, conn) {
            let sql = ``;
            if (collect) {
                //1
                sql = `select count(*) from material  where is_collected=${collect};select * from material where is_collected=${collect} order by id desc limit ${start} , ${per_page}`;
            } else {
                //0
                sql = `select count(*) from material;select * from material order by id desc  limit ${start} , ${per_page}`;
            }

            conn.query(sql, (err, result) => {
                if (err) {
                    res.json(err);
                } else {
                    let total_count = result[0][0]['count(*)']
                    res.json({
                            "message": "OK",
                            "data": {
                                "total_count": total_count, "page": page, "per_page": per_page, "results": result[1]
                            }
                        }
                    );
                }
                conn.release();
            })
        })
    } else {
        res.status(400).json({
            message: '请求参数错误'
        });
    }

})

//修改收藏状态
app.put('/user/images/:target', (req, res) => {

    let target = req.params.target;
    let collect = req.body.collect ? 1 : 0;
    pool.getConnection(function (err, conn) {
        let sql = `update material set is_collected=${collect} where id=${target}`;
        conn.query(sql, (err, result, fields) => {
            if (err) {
                res.json(err);
            } else {
                res.json({
                    message: 'OK'
                })
            }
            conn.release();
        })
    })
})

//删除素材
app.delete('/user/images/:target', (req, res) => {
    let target = req.params.target;
    pool.getConnection(function (err, conn) {
        let sql = `delete from material  where id=${target}`;
        conn.query(sql, (err, result, fields) => {
            if (err) {
                res.json(err);
            } else {
                res.json({
                    message: 'OK'
                })
            }
            conn.release();
        })
    })
})

//上传素材
app.post('/user/images',upload.single('image'), (req, res) => {
    pool.getConnection(function (err, conn) {
        let sql = `insert into material(url) values('http://localhost:3000/${req.file.path}')`;
        conn.query(sql, (err, result, fields) => {
            if (err) {
                res.json(err);
            } else {
                res.json({
                    message: 'OK',
                    data: {
                        id: result.id,
                        url: result.url
                    }
                });
            }
            conn.release();
        })
    })

})

//账户信息
//patch连续多个的相同请求会产生不同的效果
app.patch('/user/profile', (req, res) => {
    let {id, name, mobile, intro, email} = req.body;
    pool.getConnection(function (err, conn) {
        let sql = `update users set name='${name}',mobile='${mobile}',intro='${intro}',email='${email}' where id='${id}'`;
        conn.query(sql, (err, result) => {
            if (err) {
                res.json(err);
            } else {
                res.json({
                    message: 'ok'
                });
            }
            conn.release();
        })
    })
})

//头像上传
//photo
app.patch('/user/photo',upload.single('photo'), (req, res) => {
    pool.getConnection(function (err, conn) {
        let sql = `update users set photo='http://localhost:3000/${req.file.path}' where id = 8`;
        conn.query(sql, (err) => {
            if (err) {
                res.json(err);
            } else {
                res.json({
                    message: 'OK'
                });
            }
            conn.release();
        })
    })
})

app.listen(3000, () => {
    console.log('http://localhost:3000')
})