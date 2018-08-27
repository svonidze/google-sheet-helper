MAPPINGS = [{
    name: 'Tinkoff',
    delimiter: ';',
    encoding: 'windows-1251',
    startRowNumber: 1,
    columnsMapping: [
        {
            sourceColumnLetter: 'A', targetColumnName: 'date',
            conversion: {
                input: { method: fromStringToDate, format: 'dd.MM.yyyy hh:mm:ss' },
                output: { method: dateToString, format: 'yyyy-MM-dd hh:mm:ss' }
            }
        },
        { sourceColumnLetter: 'C', targetColumnName: 'wallet' },
        { sourceColumnLetter: 'D', targetColumnName: 'description' },
        {
            sourceColumnLetter: 'G', targetColumnName: 'unitCost',
            conversion: {
                input: { method: convertToNumber }
            }
        },
        { sourceColumnLetter: 'H', targetColumnName: 'curency' },
        { sourceColumnLetter: 'J', targetColumnName: 'category' },
        { sourceColumnLetter: 'L', targetColumnName: 'contractor' },
    ],
    ignore: [
        { columnLetter: 'L', value: 'Перевод с карты другого банка' }
    ]
}]

TARGET_SHEET_CONFIG = {
    startRowNumber: 3,
    indexes: [
        { unique: true, columns: ['date', 'unitCost', 'curency', 'contractor'] },
        { columns: ['unitCost', 'curency', 'contractor'] }
    ],
    columns: [
        {
            letter: 'A', name: 'date', requried: true, sorting: 'descending',
            conversion: {
                input: { method: fromStringToDate },
                output: { method: dateToString, format: 'yyyy-MM-dd hh:mm:ss' }
            }
        },
        { letter: 'B', name: 'wallet' },
        { letter: 'C', name: 'category' },
        { letter: 'D', name: 'orderNo' },
        { letter: 'E', name: 'description' },
        { letter: 'F', name: 'unitCount' },
        {
            letter: 'G', name: 'unitCost',
            conversion: {
                input: { method: convertToNumber }
            }
        },
        { letter: 'H', name: 'unitCostOffset' },
        { letter: 'I', name: 'totalCost' },
        { letter: 'J', name: 'curency' },
        { letter: 'K', name: 'contractor' },
        { letter: 'L', name: 'contractorAddress' },
        { letter: 'M', name: 'withWhom' },
        { letter: 'N', name: 'campaignName' },
        { letter: 'O', name: 'ignore' },
    ],
}

function onOpen() {
    SpreadsheetApp.getUi()
        .createMenu('Transactions')
        .addItem('Import file', 'openDialog')
        .addToUi();
}

function openDialog() {
    var htmlTemplate = HtmlService.createTemplateFromFile('index');
    //htmlTemplate.data = getExistingRetailers();

    var html = htmlTemplate.evaluate()
        .setSandboxMode(HtmlService.SandboxMode.IFRAME)
        .setWidth(600)
        .setHeight(680);

    SpreadsheetApp.getUi()
        .showModalDialog(html, 'Import');
}

function parseCsvAndAppend(text, delimiter) {
    var mapping = MAPPINGS[0];

    function getColumnInfo(columnName) {
        return TARGET_SHEET_CONFIG.columns
            .filter(function (c) { return c.name === columnName })[0];
    }

    var columnsMapping = mapping.columnsMapping.map(function (cm) {
        var targetColumn = getColumnInfo(cm.targetColumnName)
            || { letter: null, requried: null };
        return {
            source: cm.sourceColumnLetter,
            conversion: cm.conversion,
            target: targetColumn.letter,
            requried: targetColumn.requried
        }
    })

    var dataToInsert = parseCsv(text, delimiter, mapping.startRowNumber, columnsMapping, mapping.ignore);
    console.log('dataToInsert', dataToInsert);

    var sortingColumn = TARGET_SHEET_CONFIG.columns
        .filter(function (col) { return col.sorting })
        .map(function (col) {
            return {
                //letter: col.letter,
                index: getIndex(col.letter),
                ascending: col.soring === 'ascending'
            }
        })[0];
    var minValueOfSortingColumn = dataToInsert.map(function (d) {
            return d[sortingColumn.index];
        })
        .reduce(function (a, b) { return a < b ? a : b; });
    console.log('detected minValueOfSortingColumn', minValueOfSortingColumn)
    
    // exiting data
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    function sortSheet() {
        sheet.sort(sortingColumn.index + 1, sortingColumn.ascending);
    };
    console.log('sortSheet');
    sortSheet();

    function getA1Range(columnLetter, from, to) {
        var a1Range = columnLetter + from
            + ':' + columnLetter;
        if (to) a1Range += to
        return a1Range
    }
    function getColumnLattersToCompare(index) {
        var columnsToCompare = [];
        for (var i in index.columns) {
            var columnName = index.columns[i];
            var column = getColumnInfo(columnName);
            if (!column || !column.letter)
                throw 'Found no column info mapping for columnName ' + columnName + ' in index ' + JSON.stringify(index);
            var columnIndex = getIndex(column.letter);
            columnsToCompare[columnIndex] = column.letter;
        }
        return columnsToCompare;
    }

    var uniqueIndex = TARGET_SHEET_CONFIG.indexes
        .filter(function (index) { return index.unique })[0];
    var uniqueColumnLettersToCompare = getColumnLattersToCompare(uniqueIndex);

    console.log('readData');
    var sheetData = readData(
        sheet.getMaxRows(),
        sheet.getMaxColumns(),
        sortingColumn.index,
        minValueOfSortingColumn,
        function (colIndex) {
            return TARGET_SHEET_CONFIG.columns[colIndex].conversion;
        },
        function (colIndex, lastRowIndex) {
            var columnLetter = uniqueColumnLettersToCompare[colIndex];
            if (!columnLetter)
                return null;

            var a1Range = getA1Range(
                columnLetter,
                TARGET_SHEET_CONFIG.startRowNumber,
                lastRowIndex)
            try {
                var range = sheet.getRange(a1Range);
            } catch (error) {
                console.error(a1Range, error)
                throw error
            }
            return range.getValues();
        }
    );

    console.warn('10 of sheetData', sheetData.slice(10));
    var comparisonResult = compare(dataToInsert, sheetData, uniqueColumnLettersToCompare);

    console.log('writing Data');
    for (var i in comparisonResult.brandNewItems) {
        var newRow = comparisonResult.brandNewItems[i];
        console.log('writing Data row', i);
        sheet.appendRow(newRow);
    }
    console.log('sortSheet');
    sortSheet();

    return {
        exisitngCount: comparisonResult.duplicateItems.length,
        newItems: comparisonResult.brandNewItems
    };
}

function compare(newItems, oldItems, collumsToUse) {
    // TODO imp calculate hash without date, mark it as possible duplicates?
    function generateHash(item) {
        var key = [];
        for (var columnIndex in collumsToUse) {
            if (!columnIndex) continue;
            key.push(item[columnIndex])
        }
        try {
            return JSON.stringify(key);
        } catch (error) {
            console.error(item, error);
            throw error;
        }
    };

    function fillHashes(items) {
        var hashes = {};
        for (var i in items) {
            var hash = generateHash(items[i]);

            hashes[hash] = i;
        }
        return hashes;
    };

    console.log('before oldItemHashes');
    var oldItemHashes = fillHashes(oldItems);
    console.log('10 of oldItemHashes', oldItemHashes);
    console.log('after oldItemHashes');

    var result = {
        brandNewItems: [],
        duplicateItems: [],
    }

    for (var i in newItems) {
        var item = newItems[i];
        var hash = generateHash(item);

        if (oldItemHashes[hash]) {
            result.duplicateItems.push(item);
        }
        else {
            console.log('Hash not found, new item', hash);
            result.brandNewItems.push(item);
        }
    }
    return result;
}

function readData(
    sheetRowNumber,
    columnCount,
    sortingColumnIndex,
    minValueOfSortingColumn,
    funcGetConversionPlan,
    funcGetRawData) {
    var data = [];
    var lastInterestedRowIndex = null;

    for (var colIndex = 0; colIndex < columnCount; colIndex++) {
        var rangeValues = funcGetRawData(colIndex, lastInterestedRowIndex);
        console.log('rangeValues', colIndex, lastInterestedRowIndex, rangeValues);
        if (!rangeValues) {
            continue;
        }
        var conversion = funcGetConversionPlan(colIndex);

        for (var rowIndex = 0; rowIndex < sheetRowNumber; rowIndex++) {
            if (!rangeValues[rowIndex])
                break;
            var value = rangeValues[rowIndex][0];
            value = convert(value, conversion);

            if (lastInterestedRowIndex) {
                if (rowIndex >= lastInterestedRowIndex) break;
            }
            else {
                if (colIndex == sortingColumnIndex) {
                    // console.log('comparison values:', value, minValueOfSortingColumn);
                    if (value < minValueOfSortingColumn) {
                        lastInterestedRowIndex = rowIndex;
                        console.log('Reached the min value, breaking the processing', value, minValueOfSortingColumn);
                        data[rowIndex] = [];
                        break;
                    }
                }
            }

            var item = data[rowIndex];
            if (!item) item = data[rowIndex] = [];

            item[colIndex] = value;
        }
    }

    return data;
}

function parseCsv(text, delimiter, startRowNumber, columnsMapping, ignoreConfig) {
    console.log(delimiter, arguments);
    delimiter = delimiter || ',';
    var content = csvToArray(text, delimiter);

    var ignoreColumnValues = ignoreConfig.map(function (i) {
        return {
            index: getIndex(i.columnLetter),
            value: i.value
        }
    })
    console.log('ignoreColumnValues', ignoreColumnValues);

    var rows = [];
    for (var rowIndex = startRowNumber; rowIndex < content.length; rowIndex++) {
        var sourceRow = content[rowIndex];
        var ignore = ignoreColumnValues.some(function (icv) {
            return sourceRow[icv.index] == icv.value;
        })
        if (ignore) {
            console.warn('Ignored', sourceRow);
            continue;
        }
        var row = map(sourceRow, columnsMapping);
        if (row)
            rows.push(row);
        else
            console.warn('Row could not be added due to validation rules.', content[rowIndex], columnsMapping);
    }

    return rows;
}

function map(row, columnsMapping) {
    var result = [];
    var filledColumnIndexes = [];

    for (var m = 0; m < columnsMapping.length; m++) {
        var columnMapping = columnsMapping[m];
        var colIndex = getIndex(columnMapping.target);
        filledColumnIndexes.push(colIndex);

        if (columnMapping.source) {
            var value = row[getIndex(columnMapping.source)];
            if (columnMapping.requried && !value)
                return null;

            value = convert(value, columnMapping.conversion);

            result[colIndex] = value;
        }
        else
            result[colIndex] = null;
    }

    // if no mapping for a column the logic should fulfill blank gaps, does not relly to the hack
    // columnsMapping: [...{ sourceColumnLetter: 'E' },
    // where no target
    var lastColumnIndexes = filledColumnIndexes[filledColumnIndexes.length - 1];
    for (var i = 0; i < lastColumnIndexes; i++) {
        var exist = filledColumnIndexes.indexOf(i) > -1;
        if (!exist) {
            result[i] = null;
        }
    }

    return result;
}

function convert(value, conversion, allowLog) {
    if (value && conversion) {
        if (allowLog) console.log('before conversion', value);
        value = conversion.input.method(value, conversion.input.format);
        if (allowLog) console.log('after input conversion', value);
        if (conversion.output) value = conversion.output.method(value, conversion.output.format);
        if (allowLog) console.log('after output conversion', value);
    }

    return value;
}

function getIndex(letter) {
    if (!letter || letter.length != 1)
        throw 'Passed "' + letter + '" could not be regognized as one char letter';

    //console.log(letter, letter.charCodeAt(0) - 65);
    return letter.charCodeAt(0) - 65; // 65 = 'A'.charCodeAt(0)
}

// https://stackoverflow.com/a/41563966
function csvToArray(text, delimiter) {
    var p = '';
    var row = [''];
    var ret = [row];
    var i = 0;
    var r = 0;
    var s = !0;
    var l;
    for (var index = 0; index < text.length; index++) {
        l = text[index];

        if ('"' === l) {
            if (s && l === p) row[i] += l;
            s = !s;
        } else if (delimiter === l && s) l = row[++i] = '';
        else if ('\n' === l && s) {
            if ('\r' === p) row[i] = row[i].slice(0, -1);
            row = ret[++r] = [l = '']; i = 0;
        } else row[i] += l;
        p = l;
    }

    return ret;
}