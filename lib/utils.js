
circularReplacer = () => {
    const seen = new WeakSet();
    return (_key, value) => {
        if (value && typeof value === 'object') {
            if (seen.has(value)) return '[Circular]';
            seen.add(value);
        }
        return value;
    };
}

const varToString = (source) => {
    try {
        // null or undefined
        if (source == null) return String(source);

        // Error objects
        if (source instanceof Error) {
            const stack = String(source.stack || '').replace(/\r?\n/g, '\n');
            return `${source.name}: ${source.message}${stack ? `\n${stack}` : ''}`;
        }

        // strings pass through
        if (typeof source === 'string') return source;

        // objects (pretty JSON, circular-safe)
        if (typeof source === 'object') {
            return JSON.stringify(source, circularReplacer(), 2);
        }

        // numbers, booleans, bigint, symbol, function
        return String(source);
    } catch (err) {
        this.homey.app.updateLog("varToString failed: " + varToString(err), 0);
    }
}

module.exports = { varToString };