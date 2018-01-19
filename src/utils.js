export function debounce(func, wait, immediate) {
    var timeout;

    return function () {
        var context = this,
            args = arguments;

        var later = function () {
            timeout = null;

            if (!immediate) {
                func.apply(context, args);
            }
        };

        var callNow = immediate && !timeout;

        clearTimeout(timeout);
        timeout = setTimeout(later, wait);

        if (callNow) {
            func.apply(context, args);
        }
    };
}

export function injectCSS(file) {
    if (typeof file !== 'string') {
        return;
    }

    const links = document.getElementsByTagName('link');

    for (let i = 0; links[i]; i++) {
        if (file === links[i].getAttribute('href')) {
            return;
        }
    }

    const link = document.createElement('link');

    link.href = file;
    link.type = 'text/css';
    link.rel = 'stylesheet';

    document.getElementsByTagName('head')[0].appendChild(link);
}

export default {
    debounce,
    injectCSS
};
