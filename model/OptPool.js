const mysql = require('mysql');
const mysqlConfig = require('../config/mysql.config');

function OptPool() {
    this.flag = true;//是否连接过
    this.pool = mysql.createPool(mysqlConfig);

    this.getPool = function () {
        if (this.flag) {
            //监听connection事件
            this.pool.on('connection', function (connection) {
                //表示自增长字段每次递增的量，其默认值是1，取值范围是1 .. 65535
                connection.query("SET SESSION auto_increment_increment=1");
                this.flag = false;
            });
        }
        return this.pool;
    }

};
module.exports = OptPool;