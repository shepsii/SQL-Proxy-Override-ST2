Ext.define('Ban.data.proxy.Sql', {

    override: 'Ext.data.proxy.Sql',

    getSchemaString: function() {
        var me = this,
            schema = [],
            model = me.getModel(),
            idProperty = model.getIdProperty(),
            fields = model.getFields().items,
            uniqueIdStrategy = me.getUniqueIdStrategy(),
            ln = fields.length,
            i, field, type, name, persist;

        for (i = 0; i < ln; i++) {
            field = fields[i];
            type = field.getType().type;
            name = field.getName();
            persist = field.getPersist();
            if (!persist) {
                continue;
            }

            if (name === idProperty) {
                if (uniqueIdStrategy) {
                    type = me.convertToSqlType(type);
                    schema.unshift(idProperty + ' ' + type);
                } else {
                    schema.unshift(idProperty + ' INTEGER PRIMARY KEY AUTOINCREMENT');
                }
            } else {
                type = me.convertToSqlType(type);
                schema.push(name + ' ' + type);
            }
        }

        return schema.join(', ');
    },

    insertRecords: function(records, transaction, callback, scope) {
        var me = this,
            table = me.getTable(),
            columns = me.getColumns(),
            totalRecords = records.length,
            executed = 0,
            tmp = [],
            insertedRecords = [],
            errors = [],
            uniqueIdStrategy = me.getUniqueIdStrategy(),
            i, ln, placeholders, result;

        result = new Ext.data.ResultSet({
            records: insertedRecords,
            success: true
        });

        for (i = 0, ln = columns.length; i < ln; i++) {
            tmp.push('?');
        }
        placeholders = tmp.join(', ');

        Ext.each(records, function (record) {
            var id = record.getId(),
                data = me.getRecordData(record),
                values = me.getColumnValues(columns, data);

            transaction.executeSql(
                'INSERT INTO ' + table + ' (' + columns.join(', ') + ') VALUES (' + placeholders + ')', values,
                function (transaction, resultSet) {

                    // FIX TO DECODE ARRAY/OBJECT FIELDS
                    data = me.decodeRecordData(data);

                    executed++;

                    insertedRecords.push({
                        clientId: id,
                        id: uniqueIdStrategy ? id : resultSet.insertId,
                        data: data,
                        node: data
                    });

                    if (executed === totalRecords && typeof callback == 'function') {
                        callback.call(scope || me, result, errors.length > 0 ? errors : null);
                    }
                },
                function (transaction, error) {
                    executed++;
                    errors.push({
                        clientId: id,
                        error: error
                    });

                    if (executed === totalRecords && typeof callback == 'function') {
                        callback.call(scope || me, result, errors);
                    }
                }
            );
        });
    },

    selectRecords: function(transaction, params, callback, scope) {
        var me = this,
            table = me.getTable(),
            idProperty = me.getModel().getIdProperty(),
            sql = 'SELECT * FROM ' + table,
            records = [],
            filterStatement = ' WHERE ',
            sortStatement = ' ORDER BY ',
            i, ln, data, result, count, rows, filter, sorter, property, value;

        result = new Ext.data.ResultSet({
            records: records,
            success: true
        });

        if (!Ext.isObject(params)) {
            sql += filterStatement + idProperty + ' = \'' + params + '\'';
        } else {
            ln = params.filters && params.filters.length;
            if (ln) {
                for (i = 0; i < ln; i++) {
                    filter = params.filters[i];
                    property = filter.getProperty();
                    value = filter.getValue();
                    if (property !== null) {
                        sql += filterStatement + property + ' ' + (filter.getAnyMatch() ? ('LIKE \'%' + value + '%\'') : ('= \'' + value + '\''));
                        filterStatement = ' AND ';
                    }
                }
            }

            ln = params.sorters && params.sorters.length;
            if (ln) {
                for (i = 0; i < ln; i++) {
                    sorter = params.sorters[i];
                    property = sorter.getProperty();
                    if (property !== null) {
                        sql += sortStatement + property + ' ' + sorter.getDirection();
                        sortStatement = ', ';
                    }
                }
            }

            // handle start, limit, sort, filter and group params
            if (params.page !== undefined) {
                sql += ' LIMIT ' + parseInt(params.start, 10) + ', ' + parseInt(params.limit, 10);
            }
        }

        transaction.executeSql(sql, null,
            function(transaction, resultSet) {
                rows = resultSet.rows;
                count = rows.length;

                for (i = 0, ln = count; i < ln; i++) {

                    // FIX TO DECODE ARRAY/OBJECT FIELDS
                    data = me.decodeRecordData(rows.item(i));

                    records.push({
                        clientId: null,
                        id: data[idProperty],
                        data: data,
                        node: data
                    });
                }

                result.setSuccess(true);
                result.setTotal(count);
                result.setCount(count);

                if (typeof callback == 'function') {
                    callback.call(scope || me, result);
                }
            },
            function(transaction, errors) {
                result.setSuccess(false);
                result.setTotal(0);
                result.setCount(0);

                if (typeof callback == 'function') {
                    callback.call(scope || me, result);
                }
            }
        );
    },

    updateRecords: function (transaction, records, callback, scope) {
        var me = this,
            table = me.getTable(),
            columns = me.getColumns(),
            totalRecords = records.length,
            idProperty = me.getModel().getIdProperty(),
            executed = 0,
            updatedRecords = [],
            errors = [],
            i, ln, result;

        result = new Ext.data.ResultSet({
            records: updatedRecords,
            success: true
        });

        Ext.each(records, function (record) {
            var id = record.getId(),
                data = me.getRecordData(record),
                values = me.getColumnValues(columns, data),
                updates = [];

            for (i = 0, ln = columns.length; i < ln; i++) {
                updates.push(columns[i] + ' = ?');
            }

            transaction.executeSql(
                'UPDATE ' + table + ' SET ' + updates.join(', ') + ' WHERE ' + idProperty + ' = ?', values.concat(id),
                function (transaction, resultSet) {
                    executed++;

                    // FIX TO DECODE ARRAY/OBJECT FIELDS
                    data = me.decodeRecordData(data);

                    updatedRecords.push({
                        clientId: id,
                        id: id,
                        data: data,
                        node: data
                    });

                    if (executed === totalRecords && typeof callback == 'function') {
                        callback.call(scope || me, result, errors.length > 0 ? errors : null);
                    }
                },
                function (transaction, error) {
                    executed++;
                    errors.push({
                        clientId: id,
                        error: error
                    });

                    if (executed === totalRecords && typeof callback == 'function') {
                        callback.call(scope || me, result, errors);
                    }
                }
            );
        });
    },

    decodeRecordData: function (data) {

        var key, newData = {}, fields = this.getModel().getFields().items, fieldTypes = {};
        Ext.each(fields, function (field) {
            fieldTypes[field.getName()] = field.config.type;
        });

        for (key in data) {
            if (Ext.isDefined(fieldTypes[key]) && (fieldTypes[key] == 'object' || fieldTypes[key] == 'array')) {
                if (Ext.isEmpty(data[key])) {
                    newData[key] = null;
                } else {
                    newData[key] = Ext.decode(data[key]);
                }
            } else {
                newData[key] = data[key];
            }
        }

        return newData;
    },

    getRecordData: function (record) {
        var me = this,
            fields = record.getFields(),
            idProperty = record.getIdProperty(),
            uniqueIdStrategy = me.getUniqueIdStrategy(),
            data = {},
            name, value, newValue;

        fields.each(function (field) {
            if (field.getPersist()) {
                name = field.getName();
                if (name === idProperty && !uniqueIdStrategy) {
                    return;
                }
                value = record.get(name);
                if (field.getType().type == 'date') {
                    newValue = me.writeDate(field, value);
                }
                else if (!Ext.isDefined(value)) {
                    newValue = "";
                }
                else if (field.getType().type == 'auto' && (Ext.isObject(value) || Ext.isArray(value))) {
                    if (Ext.isEmpty(value)) {
                        newValue = "";
                    } else {
                        newValue = Ext.encode(value);
                    }
                } else {
                    newValue = value;
                }
                data[name] = newValue;
            }
        }, this);

        return data;
    },

    convertToSqlType: function(type) {
        switch (type.toLowerCase()) {
            case 'date':
            case 'string':
            case 'array':
            case 'object':
            case 'auto':
                return 'TEXT';
            case 'int':
                return 'INTEGER';
            case 'float':
                return 'REAL';
            case 'bool':
                return 'NUMERIC';
        }
    },

    getDatabaseObject: function () {

        if (!Ban.getConfig().isWebApp()) {
            return window.sqlitePlugin.openDatabase(this.getDatabase(), '1.0', 'Sencha Database', -1);
        }

        return openDatabase(this.getDatabase(), '1.0', 'Sencha Database', 5 * 1024 * 1024);

    }

});