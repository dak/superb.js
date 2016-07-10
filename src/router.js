import {debounce} from './utils';

let defaultRoute  = /.*/,
    rootRoute     = /^\/$/,
    optionalParam = /\((.*?)\)/g,
    namedParam    = /(\(\?)?:\w+/g,
    splatParam    = /\*\w+/g,
    escapeRegExp  = /[\-{}\[\]+?.,\\\^$|#\s]/g;

const CONVERT_ROUTE = Symbol();
const LOAD_ROUTE = Symbol();
const RESTORE_WINDOW_POSITION = Symbol();

class Route {

    constructor(path, options = {}, router) {
        if (!(path instanceof RegExp)) {
            options.view = options.view || path;
            path = Route[CONVERT_ROUTE](path);
        }

        if (typeof options === 'string') {
            this.options = {view: options};
        } else {
            this.options = options;
        }

        this.path = path;
        this.router = router;

        if (path === defaultRoute) {
            router.defaultRoute = this;
        } else {
            router.routes.push(this);
        }
    }

    load(cb) {
        this.onload = cb;
    }

    [LOAD_ROUTE](params) {
        const router = this.router;

        if (this.onload) {
            this.onload(params).then(() => {
                Route[RESTORE_WINDOW_POSITION]();
            });

            return;
        }

        let page = this.options.view;

        if (page) {
            const subpage = (params instanceof Array && params.length) > 0 ?
                `${params.join('/')}/${params[params.length - 1]}` :
                page;

            System.import(`~/pages/${page}/${subpage}`).then((m) => {
                const Controller = m.default;

                router.defaultRegion.attach(new Controller(params));
                Route[RESTORE_WINDOW_POSITION]();
                router.loadFailure = false;
            }).catch((e) => {
                if (!router.loadFailure && router.defaultRoute instanceof Route) {
                    router.loadFailure = true;
                    router.defaultRoute[LOAD_ROUTE]();
                } else {
                    throw e;
                }
            });
        }
    }

    static [RESTORE_WINDOW_POSITION]() {
        if (history.state !== null && typeof history.state === 'object') {
            window.scrollTo(history.state.x || 0, history.state.y || 0);
        } else {
            window.scrollTo(0, 0);
        }
    }

    static [CONVERT_ROUTE](route) {
        route = route.replace(escapeRegExp, '\\$&')
                     .replace(optionalParam, '(?:$1)?')
                     .replace(namedParam, (match, optional) => optional ? match : '([^/?]+)')
                     .replace(splatParam, '([^?]*?)');

        return new RegExp(`^\/${route}$`);
    }

}

const ON_POPSTATE = Symbol();
const PATH_CHANGED = Symbol();
const POPSTATE_EVENT_LISTENER = Symbol();
const SCROLL_EVENT_LISTENER = Symbol();
const SETUP_HISTORY_STATE = Symbol();
const SAVE_SCROLL_STATE = Symbol();
const PREVIOUS_PATH = Symbol();
const CURRENT_PATH = Symbol();

class Router {

    constructor() {
        this.routes = [];
        this.init();
    }

    init() {}

    route(route, options = {}) {
        if (typeof options === 'string') {
            options = {view: options};
        }

        return new Route(route, options, this);
    }

    default(options) {
        return new Route(defaultRoute, options, this);
    }

    root(options) {
        return new Route(rootRoute, options, this);
    }

    start() {
        this[POPSTATE_EVENT_LISTENER] = this[ON_POPSTATE].bind(this);
        this[SCROLL_EVENT_LISTENER] = debounce(Router[SAVE_SCROLL_STATE], 100);

        history.scrollRestoration = 'manual';
        window.addEventListener('popstate', this[POPSTATE_EVENT_LISTENER]);
        window.addEventListener('scroll', this[SCROLL_EVENT_LISTENER]);

        this[ON_POPSTATE]({target: window});

        return this;
    }

    stop() {
        history.scrollRestoration = 'auto';
        window.removeEventListener('popstate', this[POPSTATE_EVENT_LISTENER]);
        window.removeEventListener('scroll', this[SCROLL_EVENT_LISTENER]);

        return this;
    }

    navigate(path, state = {}) {
        if (!Router[PATH_CHANGED](path)) {
            if (!path.split('#')[1]) {
                location.hash = '';
                window.scrollTo(0, 0);
            }

            return;
        }

        Router[SAVE_SCROLL_STATE]();

        state.x = state.x || 0;
        state.y = state.y || 0;

        history.pushState(state, '', path);
        let event = new PopStateEvent('popstate', {state: state});

        window.dispatchEvent(event);

        return this;
    }

    // Internal Methods

    [ON_POPSTATE](e) {
        let pathname = e.target.location.pathname;
        const previousPath = Object.assign({}, this[PREVIOUS_PATH]);

        this[PREVIOUS_PATH] = {
            pathname: location.pathname,
            search: location.search,
            hash: location.hash
        };

        if (!Router[PATH_CHANGED](previousPath)) {
            if (previousPath.hash !== location.hash) {
                const el = document.getElementById(location.hash.split('#')[1]);

                if (el instanceof Element) {
                    window.scrollTo(0, el.offsetTop);
                }
            }

            return;
        }

        for (let route of this.routes) {
            if (route.path.test(pathname)) {
                let params = route.path.exec(pathname).slice(1);

                route[LOAD_ROUTE](params);
                return;
            }
        }

        if (this.defaultRoute instanceof Route) {
            this.defaultRoute[LOAD_ROUTE](params);
        }
    }

    static [PATH_CHANGED](loc) {
        if (typeof loc === 'string') {
            return `${location.pathname}${location.search}` !== loc;
        }

        return location.pathname !== loc.pathname ||
            location.search  !== loc.search;
    }

    static [SETUP_HISTORY_STATE]() {
        if (history.state !== null && typeof history.state !== 'object') {
            history.replaceState({}, '', Router[CURRENT_PATH]());
        }
    }

    static [SAVE_SCROLL_STATE]() {
        Router[SETUP_HISTORY_STATE]();

        let currentState = Object.assign({}, history.state);

        currentState.x = window.scrollX || window.pageXOffset;
        currentState.y = window.scrollY || window.pageYOffset;

        history.replaceState(currentState, '', Router[CURRENT_PATH]());
    }

    static [CURRENT_PATH]() {
        return `${location.pathname}${location.search}${location.hash}`;
    }

}

export default Router;
