masks = {
    'dd.MM.yyyy hh:mm:ss': {
        regex: /(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2}):(\d{2})/,
        groups: { yyyy: 3, MM: 2, dd: 1, hh: 4, mm: 5, ss: 6 }
    },
    'yyyy-MM-dd hh:mm:ss': {
        regex: /(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})/,
        groups: { yyyy: 1, MM: 2, dd: 3, hh: 4, mm: 5, ss: 6 }
    },
};

function isValidDate(d) {
    if (Object.prototype.toString.call(d) === "[object Date]") {
        return !isNaN(d.getTime());
    } else {
        return false;
    }
}

function fromStringToDate(dateString, format) {
    var date;

    if (!format) {
        console.log('format not specified');
        for (var maskFormat in masks) {
            console.log('trying ' + maskFormat + ' for ' + dateString);
            date = parseFromStringToDate(dateString, maskFormat, true);

            if (isValidDate(date)) {
                return date;
            }
        }

        date = new Date(dateString);
        console.log('now way, using default for ' + dateString, date);

    }
    else {
        date = parseFromStringToDate(dateString, format);
    }

    if (!isValidDate(date)) {
        throw 'Could not parse "' + dateString + '".';
    }
    return date;
}
function parseFromStringToDate(dateString, format, allowRegexNotMatch) {

    var mask = masks[format];
    if (!mask) throw 'Format "' + format + '" not supported';

    var groups = mask.regex.exec(dateString);
    if (!groups) {
        if (allowRegexNotMatch)
            return null;
        throw 'Could not parse "' + dateString + ' by format "' + format + '"';
    }

    function get(index) {
        var groupIndex = mask.groups[index];
        if (!groupIndex) throw 'Not found group index "' + index + '"';
        return groups[groupIndex];
    }
    return new Date(get('yyyy'), get('MM') - 1, get('dd'), get('hh'), get('mm'), get('ss'));

}

function dateToString (date, format) {
    if(format !== 'yyyy-MM-dd hh:mm:ss'){
        throw 'Format "' + format + '" no supported.'
    }

    function format00(value) {
        return ('0' + value).slice(-2);
    }
    var MM = format00(date.getMonth() + 1); // getMonth() is zero-based
    var dd = format00(date.getDate());
    var hh = format00(date.getHours());
    var mm = format00(date.getMinutes());
    var ss = format00(date.getSeconds());

    return date.getFullYear() + '-' + MM + '-' + dd + ' '
        + hh + ":" + mm + ":" + ss;
};

// String.prototype.toDate = function (format) {
//     return fromStringToDate(this, format);
// };