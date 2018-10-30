var db2 = require('ibm_db2');
var vscode = require('vscode');
var AbstractServer = require('./AbstractServer.js');

module.exports = class DB2Type extends AbstractServer
{
    constructor() {
        super();
        this.type = "db2";
        this.host = "HOST";
        this.port = "50500";
        this.user = "USER";
        this.password = "PASSWORD";
        this.database = "DATABASE";
    }
    

    /**
     * @param {string} host
     * @param {string} user
     * @param {string} password
     * @param {string} database
     * @return {Promise}
     */
    connectPromise(host, user, password, database) {
        this.name = host + " (mysql)";
        var hostAndPort = host.split(":");
        this.host = hostAndPort[0];
        this.port = hostAndPort[1] || "3306";
        this.user = user;
        this.password = password;
        this.database = database;
        
        //TODO: NEED TO RETURN A CONNECTION OBJECT
        
        return new Promise((resolve, reject) => {
            this.connection = db2.open(
                "DRIVER={" + this.type + "}" +
                ";DATABASE=" + this.database + 
                ";UID=" + this.user +
                ";PWD=" + this.password + 
                ";HOSTNAME=" + this.host +
                ";port=" + this.port,
                function(err, conn)
                {
                    if(err)
                    {
                        //console.error("error: ", err.message);
                        reject('DB2 Error: ', err.message)
                    }
                    else
                    {
                        resolve();
                    }
                }
            )
        });

        this.connection = mysql.createConnection({
            'host': this.host,
            'port': this.port,
            'user': user,
            'password': password
        });
        return new Promise((resolve, reject) => {
            this.connection.connect((err) => {
                if (err) {
                    reject('MySQL Error: ' + err.stack);
                } else {
                    if(database === undefined){
                        resolve();
                    }else{
                        this.changeDatabase(database).then(resolve).catch(reject);
                    }
                }
            });
        });
    };

    /**
     * @deprecated new implement is queryPromise
     * @param {string} sql
     * @param {function} func - callback
     */
    query (sql, func){
        this.queryPromise(sql).then(func).catch(errMsg => {
            vscode.window.showErrorMessage(errMsg);
            this.outputMsg(errMsg);
        })
    };

    /**
     * @param {string} sql
     * @return {Promise}
     */
    queryPromise(sql){
        return new Promise((resolve, reject) => {
            this.connection.query(sql, (err, rows) => {
                if(err){
                    reject('MySQL Error: ' + err.stack);
                    return;
                }
                resolve(rows);
            });
        });
    }

    /**
     * @return {Promise<string[], Error>}
     */
    getDatabase(){
        return new Promise((resolve, reject) => {
            this.queryPromise('SHOW DATABASES').then(function(results){
                var allDatabase = [];
                for (var i = 0; i < results.length; i++) {
                    allDatabase.push(results[i].Database);
                }
                resolve(allDatabase);
            }).catch(reject);
        });
    }

    /**
     * @param {string} name - name Database
     * @return {Promise}
     */
    changeDatabase (name){
        return new Promise((resolve, reject) => {
            this.queryPromise('USE `' + name + '`').then(() => {
                this.currentDatabase = name;
                resolve();
            }).catch((err) => {
                this.currentDatabase = null;
                reject(err);
            });
        });
    };

    /**
     * @return {Promise}
     */
    refrestStructureDataBase (){
        var currentStructure = {};
        var tablePromise = [];
        return new Promise((resolve, reject) => {
            this.queryPromise("SHOW tables").then(results => {
                for (let i = 0; i < results.length; i++) {
                    let key = Object.keys(results[i])[0];
                    let tableName = results[i][key];
                    let promise = new Promise((resolve, reject) => {
                        this.queryPromise("SHOW COLUMNS FROM " + tableName).then((column) => {
                            resolve({
                                column : column,
                                tableName : tableName
                            });
                        }).catch(reject);
                    });
                    tablePromise.push(promise);
                }
                Promise.all(tablePromise).then(data => {
                    for (var i = 0; i < data.length; i++) {
                        var columnStructure = data[i].column;
                        var tableName = data[i].tableName;
                        currentStructure[tableName] = columnStructure;
                    }
                    resolve(currentStructure);
                }).catch(reject);
            }).catch(reject);
        });
    }

    /**
     * @param {string} tableName
     * @return {string} a quoted identifier table name
     */
    getIdentifiedTableName(tableName){
        return `\`${tableName}\``;
    }

    /**
     * @param {string} tableName
     * @return {string} a SQL SELECT statement
     */
    getSelectTableSql(tableName){
        return `SELECT * FROM ${this.getIdentifiedTableName(tableName)}`;
    }

}