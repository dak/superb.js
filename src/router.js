let defaultRoute  = /.*/,
    rootRoute     = /^\/$/,
    optionalParam = /\((.*?)\)/g,
    namedParam    = /(\(\?)?:\w+/g,
    splatParam    = /\*\w+/g,
    escapeRegExp  = /[\-{}\[\]+?.,\\\^$|#\s]/g;

class Route {

    constructor(path, options = {}, router) {
        this.path = path;
        this.options = options;
        this.router = router;

        if (path === defaultRoute) {
            router.defaultRoute = this;
        } else {
            router.routes.push(this);
        }
    }

    load(state, args) {
        let page = this.options.view;

        System.import(`~/pages/${page}/${page}`).then((m) => {
            let View = m.default;

            this.regions.main.show(new View(args));
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

        for (let route in this.routes) {
            if (route.path.test(path)) {
                route.load(state);
                return;
            }
        }

        if (this.defaultRoute instanceof Route) {
            this.defaultRoute.load(state);
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
