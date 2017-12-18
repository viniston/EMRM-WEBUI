window.rgStorage = {
    set: function (key, value) {
        try {
            return window.localStorage.setItem(key, value);
        } catch (ex) { }
    },
    get: function (key) {
        try {
            return window.localStorage.getItem(key);
        } catch (ex) {
            return null;
        }
    },
    delete: function (key) {
        try {
            return window.localStorage.removeItem(key);
        } catch (ex) {
            return null;
        }
    },
    has: function (key) {
        return window.rgStorage.get(key) !== null;
    }
};
