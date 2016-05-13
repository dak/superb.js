import {patch} from 'incremental-dom';

const DELEGATE_EVENT_SPLITTER = /^(\S+)\s*(.*)$/;

function dispose(obj) {
    delete obj.parent;
    delete obj.el;
    delete obj.regions;
}

class Region {

    constructor(el, parent) {
        this.parent = parent;
        this.controllers = [];

        if (typeof el === 'string') {
            this.el = this.parent.el.querySelector(el);
        } else if (el === null) {
            this.el = parent.el;
        } else {
            this.el = el;
        }
    }

    attach(controller, options) {
        this.empty();
        this.append(controller, options);
    }

    append(controller) {
        controller.parent = this.parent;
        this.controllers = this.controllers || [];
        this.controllers.push(controller);
        this.el.appendChild(controller.el);
    }

    empty() {
        for (let controller of this.controllers) {
            controller.detach();
        }

        if (this.el instanceof Element) {
            while (this.el.firstChild) {
                this.el.removeChild(this.el.firstChild);
            }
        }

        this.controllers.length = 0;
    }

    detach() {
        this.empty();
        dispose(this);
    }

}

class Regions {

    constructor(regions = {}, context) {
        for (let region in regions) {
            if (regions.hasOwnProperty(region)) {
                this[region] = new Region(regions[region], context);
            }
        }

        // Add a self-referential region to attach controllers to
        this.self = new Region(null, context);
    }

}

const DOM_EVENTS = Symbol();
const DELEGATE = Symbol();

class Controller {

    constructor(options = {}) {
        this[DOM_EVENTS] = [];
        this.model = options.model;
        this.view = options.view || {tag: 'div'};
        this.init(...arguments);
        Controller.injectCSS(this.css);
        this.setElement(this.el);
        this.update();
        this.regions = new Regions(this.regions, this);
        this.onLoaded();
    }

    static injectCSS(file) {
        if (typeof file !== 'string') {
            return;
        }

        let links = document.getElementsByTagName('link');

        for (let i = 0; links[i]; i++) {
            if (file === links[i].href) {
                return;
            }
        }

        let link = document.createElement('link');

        link.href = file;
        link.type = 'text/css';
        link.rel = 'stylesheet';

        document.getElementsByTagName('head')[0].appendChild(link);
    }

    setElement(el) {
        if (typeof el === 'string') {
            if (this.parent) {
                this.el = this.parent.querySelector(el);
            } else {
                this.el = document.querySelector(el);
            }
        } else if (!el) {
            this.el = document.createElement(this.view.tag || 'div')
        } else {
            this.el = el;
        }

        if (typeof this.view.id === 'string') {
            this.el.id = this.view.id;
        }

        let classes = this.view.classes || [];
        let attributes = this.view.attributes;

        this.el.classList.add(...classes);

        for (let attribute in attributes) {
            if (attributes.hasOwnProperty(attribute)) {
                this.el.setAttribute(attribute, attributes[attribute]);
            }
        }

        return this;
    }

    update() {
        let data = this.model;

        if (typeof data === 'function') {
            data = data();
        }

        patch(this.el, this.template, data);
        this.delegateEvents();
    }

    onLoaded() {}
    onBeforeClose() {}
    onClose() {}

    delegateEvents(events = this.events) {
        if (typeof events !== 'object') {
            return this;
        }

        this.undelegateEvents();

        for (let key in events) {
            if (!events.hasOwnProperty(key)) {
               continue;
            }

            let method = events[key];

            if (typeof method !== 'function') {
                method = this[method];
            }

            if (!method) {
                continue;
            }

            let event = key.match(DELEGATE_EVENT_SPLITTER);

            this[DELEGATE](event[1], event[2], method.bind(this));
        }
    }

    undelegateEvents() {
        if (this.el instanceof Element) {
            for (let item of this[DOM_EVENTS]) {
                item.el.removeEventListener(item.eventName, item.handler);
            }

            this[DOM_EVENTS].length = 0;
        }

        return this;
    }

    [DELEGATE](eventName, selector, listener) {
        if (typeof selector === 'function') {
            listener = selector;
            selector = null;
        }

        if (selector) {
            let nodes = this.el.querySelectorAll(selector);

            for (let i = 0, len = nodes.length; i < len; i++) {
                let node = nodes[i];

                node.addEventListener(eventName, listener);
                this[DOM_EVENTS].push({el: node, eventName: eventName, listener: listener, selector: selector});
            }
        } else {
            this.el.addEventListener(eventName, listener);
            this[DOM_EVENTS].push({el: this.el, eventName: eventName, listener: listener});
        }

        return this;
    }

    detach() {
        this.onBeforeClose();
        this.onClose();

        for (let region in this.regions) {
            if (this.regions.hasOwnProperty(region)) {
                this.regions[region].detach();
            }
        }

        this.undelegateEvents();

        if (this.el.parent) {
            this.el.parent.el.removeChild(this.el);
        }

        dispose(this);

        return this;
    }

}

export default Controller;
