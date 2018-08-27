function convertToNumber(value) {
    switch (typeof value) {
        case 'number':
            return value;
        case 'string':
            return parseFloat(value.replace(',', '.'));
        default:
            throw 'Type "' + (typeof value) + '" not supported';
    }
}