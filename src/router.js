let defaultRoute  = /.*/,
    rootRoute     = /^\/$/,
    optionalParam = /\((.*?)\)/g,
    namedParam    = /(\(\?)?:\w+/g,
    splatParam    = /\*\w+/g,
    escapeRegExp  = /[\-{}\[\]+?.,\\\^$|#\s]/g;

const LOAD_ROUTE = Symbol();

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

    [LOAD_ROUTE](state, args) {
        let router = this.router;

        if (this.onload) {
            this.onload(state, args);
            return;
        }

        let page = this.options.view;

        System.import(`~/pages/${page}/${page}`).then((m) => {
            let Controller = m.default;

            router.defaultRegion.attach(new Controller(args));
        });
    }

}

const CONVERT_ROUTE = Symbol();
const ON_POPSTATE = Symbol();
const POPSTATE_EVENT_LISTENER = Symbol();

class Router {

    constructor() {
        this.routes = [];
        this.init();
    }

    init() {}

    route(route, options = {}) {
        if (!(route instanceof RegExp)) {
            options.view = route;
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
        history.scrollRestoration = 'manual';
        window.addEventListener('popstate', this[POPSTATE_EVENT_LISTENER]);

        this[ON_POPSTATE]({target: window});

        return this;
    }

    stop() {
        history.scrollRestoration = 'auto';
        window.removeEventListener('popstate', this[POPSTATE_EVENT_LISTENER]);

        return this;
    }

    navigate(path, state) {
        if (history.state === state && location.pathname === path) {
            return this;
        }

        history.pushState(state, '', path);
        let event = new PopStateEvent('popstate', {state: state});

        window.dispatchEvent(event);

        return this;
    }

    // Internal Methods

    [ON_POPSTATE](e) {
        let state = e.target.history.state;
        let path = e.target.location.pathname;

        for (let route of this.routes) {
            if (route.path.test(path)) {
                route[LOAD_ROUTE](state);
                return;
            }
        }

        if (this.defaultRoute instanceof Route) {
            this.defaultRoute[LOAD_ROUTE](state);
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
