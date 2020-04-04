class HttpError extends Error {
    /**
     * @param {(Error | string)} reason
     * @param {(number)} code
     * @memberof HttpError
     */
    constructor(reason, code = 500) {
        if (typeof reason === 'string') {
            super(reason);
        } else {
            super((reason && reason.message) || 'Internal error');
        }
        this.code = code;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

module.exports = HttpError;
