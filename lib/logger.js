'use strict';

const dateFormatOptions = [
    'ru',
    {hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'}
];

module.exports = (req, res) => {
    const date = new Intl.DateTimeFormat(...dateFormatOptions).format(new Date());
    const url = req.url;
    const method = req.method;
    console.log(`${date} [${method}]    ${url}`);
};
