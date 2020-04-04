// @ts-check
'use strict';

/** @type [string, Intl.DateTimeFormatOptions] */
const dateFormatOptions = [
    'ru',
    {
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    }
];

module.exports = (req, res) => {
    const date = new Intl.DateTimeFormat(...dateFormatOptions).format(new Date());
    console.log(`${date} [${req.method}]    ${req.url}`);
};
