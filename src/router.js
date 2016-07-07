import {debounce} from './utils';

let defaultRoute  = /.*/,
    rootRoute     = /^\/$/,
    optionalParam = /\((.*?)\)/g,
    namedParam    = /(\(\?)?:\w+/g,
    splatParam    = /\*\w+/g,
    escapeRegExp  = /[\-{}\[\]+?.,\\\^$|#\s]/g;

const LOAD_ROUTE = Symbol();
const RESTORE_WINDOW_POSITION = Symbol();

class Route {

    constructor(path, options = {}, router) {
        this.path = path;
        this.router = router;

        if (typeof options === 'string') {
            this.options = {view: options};
        } else {
            this.options = options;
        }

        if (path === defaultRoute) {
            router.defaultRoute = this;
        } else {
            router.routes.push(this);
        }
    }

    load(cb) {
        this.onload = cb;
    }

    [LOAD_ROUTE](state, params) {
        const router = this.router;

        if (this.onload) {
            this.onload(state, params).then(() => {
                this[RESTORE_WINDOW_POSITION]();
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
                this[RESTORE_WINDOW_POSITION]();
                router.loadFailure = false;
            }).catch((e) => {
                if (!router.loadFailure && router.defaultRoute instanceof Route) {
                    router.loadFailure = true;
                    router.defaultRoute[LOAD_ROUTE](state);
                } else {
                    throw e;
                }
            });
        }
    }

    [RESTORE_WINDOW_POSITION]() {
        if (typeof history.state === 'object' && history.state !== null) {
            window.scrollTo(history.state.x || 0, history.state.y || 0);
        } else {
            window.scrollTo(0, 0);
        }

    }

}

const CONVERT_ROUTE = Symbol();
const ON_POPSTATE = Symbol();
const POPSTATE_EVENT_LISTENER = Symbol();
const SCROLL_EVENT_LISTENER = Symbol();
const SAVE_SCROLL_STATE = Symbol();
const SETUP_HISTORY_STATE = Symbol();

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

        if (!(route instanceof RegExp)) {
            options.view = options.view || route;
            route = this[CONVERT_ROUTE](route);
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
        this[SCROLL_EVENT_LISTENER] = debounce(this[SAVE_SCROLL_STATE].bind(this), 100);

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
        if (location.pathname === path) {
            window.scrollTo(0, 0);

            return this;
        }

        this[SAVE_SCROLL_STATE]();

        state.x = state.x || 0;
        state.y = state.y || 0;

        history.pushState(state, '', path);
        let event = new PopStateEvent('popstate', {state: state});

        window.dispatchEvent(event);

        return this;
    }

    // Internal Methods

    [SETUP_HISTORY_STATE]() {
        if (typeof history.state !== 'object') {
            history.replaceState({}, '', location.pathname);
        }
    }

    [SAVE_SCROLL_STATE]() {
        this[SETUP_HISTORY_STATE]();

        let currentState = Object.assign({}, history.state);

        currentState.x = window.scrollX || window.pageXOffset;
        currentState.y = window.scrollY || window.pageYOffset;

        history.replaceState(currentState, '', location.pathname);
    }

    [ON_POPSTATE](e) {
        let state = e.target.history.state;
        let path = e.target.location.pathname;
        let match = false;

        this[SETUP_HISTORY_STATE]();

        for (let route of this.routes) {
            if (route.path.test(path)) {
                let params = route.path.exec(path).slice(1);

                route[LOAD_ROUTE](state, params);
                match = true;
                break;
            }
        }

        if (!match && this.defaultRoute instanceof Route) {
            this.defaultRoute[LOAD_ROUTE](state, params);
        }
    }

    [CONVERT_ROUTE](route) {
        route = route.replace(escapeRegExp, '\\$&')
                     .replace(optionalParam, '(?:$1)?')
                     .replace(namedParam, (match, optional) => optional ? match : '([^/?]+)')
                     .replace(splatParam, '([^?]*?)');

        return new RegExp(`^\/${route}`);
    }

}

export default Router;
