'use strict';

const assert = require('assert');
const SqlString = require('mysql/lib/protocol/SqlString');


class SQLBuilder {

    constructor() {
        this.timezone = 'local';
    }

    /**
     * 执行sql interface
     * @param sql
     * @param params
     * @return {Promise}
     */
    executeSql(sql, params) {
        console.log(sql, params);
    }


    /**
     * query
     * @param sql
     * @param opts
     * @param dbname
     * @param readonly 是否从从库读取数据
     * @returns {*}
     */
    query(sql, opts) {
        if (opts instanceof Array) {
            return this.executeSql(sql, opts);
        }
        sql = this.build(sql, opts);
        return this.executeSql(sql, (opts && opts.params) || null);
    }


    select(tableName, opts) {
        const sql = this._select(tableName, opts);
        return this.executeSql(sql, (opts && opts.params) || null);
    }


    update(tableName, opts) {
        const sql = this._update(tableName, opts);
        return this.executeSql(sql, (opts && opts.params) || null);
    }


    insert(tableName, opts) {
        const sql = this._insert(tableName, opts);
        return this.executeSql(sql, (opts && opts.params) || null);
    }


    /**
     * 封装条件查询接口
     * @param sql
     * @param opts   josn -> {update[], where[], params[], group, having[], orders [[column, sort]], limit, offset}
     * opts.where 查询时的where 子句， opts.update 更新时的更新选项
     */
    build(sql, opts) {
        // 条件sql
        if (!opts) {
            return sql;
        }
        let sql_arr = null;
        let params_arr = null;
        let sql_t = '';
        // insert
        if (this._isExistObject(opts.insert)) {
            sql_arr = [];
            const values_arr = [];
            params_arr = [];
            for (const key in opts.insert) {
                const value = opts.insert[key];
                if (value === undefined || value === null) {
                    continue;
                }
                sql_arr.push('`' + key + '`');
                values_arr.push('?');
                params_arr.push(value);
            }
            sql_t = `(${sql_arr.join(',')}) values (${values_arr.join(',')}) `;
            sql += SqlString.format(sql_t, params_arr, this.stringifyObjects, this.timezone);
            if (this._isExistObject(opts.onUpdate)) {
                sql += ' ON DUPLICATE KEY UPDATE ';
                sql_arr = [];
                params_arr = [];
                for (const key in opts.onUpdate) {
                    const value = opts.onUpdate[key];
                    if (value === undefined || value === null) {
                        continue;
                    }
                    sql_arr.push('`' + key + '`= ?');
                    params_arr.push(value);
                }
                sql_t = sql_arr.join(',');
                sql += SqlString.format(sql_t, params_arr, this.stringifyObjects, this.timezone);
            }
        }
        // update
        const isUpdate = this._isExistObject(opts.update);
        const isLiteralUpdate = this._isExitArray(opts.literalUpdate);
        if (isUpdate || isLiteralUpdate) {
            sql += ' set ';
            if (isUpdate) {
                sql_arr = [];
                params_arr = [];
                for (const key in opts.update) {
                    sql_arr.push('`' + key + '`= ?');
                    params_arr.push(opts.update[key]);
                }
                sql_t = sql_arr.join(',');
                sql += SqlString.format(sql_t, params_arr, this.stringifyObjects, this.timezone);
            }
            if (isLiteralUpdate) {
                sql += (isUpdate ? ', ' : '') + opts.literalUpdate.join(',');
            }
        }
        // 查询
        const isWhere = this._isExistObject(opts.where);
        const isLiteralWhere = this._isExitArray(opts.literalWhere);
        if (isWhere || isLiteralWhere) {
            sql += ' where ';
            if (isWhere) {
                sql_arr = [];
                params_arr = [];
                for (const key in opts.where) {
                    sql_arr.push('`' + key + '`= ?');
                    params_arr.push(opts.where[key]);
                }
                sql_t = `(${sql_arr.join(') and (')})`;
                sql += SqlString.format(sql_t, params_arr, this.stringifyObjects, this.timezone);
            }
            if (isLiteralWhere) {
                sql += (isWhere ? ' and (' : '(') + opts.literalWhere.join(') and (') + ')';
            }
        }
        if (opts.group) {
            sql += ' group by `' + opts.group + '`';
            if (this._isExitArray(opts.having)) {
                sql += ' having (' + opts.having.join(') and (') + ')';
            }
        }
        if (opts.orders) {
            if (this._isExitArray(opts.orders)) {
                sql += ' order by ';
                for (let i = 0, len = opts.orders.length; i < len; i++) {
                    const [ column, sort ] = opts.orders[i];
                    if (i === len - 1) {
                        sql += '`' + column + '` ' + (sort || 'desc');
                    } else {
                        sql += '`' + column + '` ' + (sort || 'desc') + ', ';
                    }
                }
            }
        }
        if (opts.limit) {
            const offset = Number(opts.offset) || 0;
            const size = Number(opts.limit) || 10;
            sql += ' limit ' + offset + ',' + size;
        }
        if (opts.end) {
            sql += opts.end;
        }
        sql = sql.trim();
        if (sql.slice(-1) !== ';') {
            sql += ';';
        }
        return sql;
    }

    _isExistObject(obj) {
        return !(obj instanceof Array) && obj !== null
            && typeof obj === 'object' && Object.keys(obj).length > 0;
    }

    _isExitArray(arr) {
        return arr instanceof Array && arr.length > 0;
    }

    // select * from db_one.person
    _select(tableName, opts) {
        assert(tableName, 'table name is null');
        let sql = 'select ';
        if (opts && opts.fields instanceof Array && opts.fields.length > 0) {
            sql += '`';
            sql += opts.fields.join('`,`');
            sql += '`';
        } else {
            sql += '*';
        }
        sql += ' from ' + tableName;
        return this.build(sql, opts);
    }

    // update db_one.person
    _update(tableName, opts) {
        assert(tableName, 'table name is null');
        const sql = 'update ' + tableName;
        return this.build(sql, opts);
    }

    // insert into db_one.person
    _insert(tableName, opts) {
        assert(tableName, 'table name is null');
        const sql = 'insert into ' + tableName;
        return this.build(sql, opts);
    }

}

module.exports = SQLBuilder;
