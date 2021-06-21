
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : options.context || []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.38.2' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    var vetos = [
    	{
    		legis_bill_id: 1085342,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/A3010/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=A3010",
    		vetoed_date: "4/12/2018",
    		enrolled_date: "5/17/2018"
    	},
    	{
    		legis_bill_id: 1072570,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/S1208/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=S1208",
    		vetoed_date: "6/25/2018",
    		enrolled_date: "7/23/2018"
    	},
    	{
    		legis_bill_id: 1095869,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/S1914/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=S1914",
    		vetoed_date: "5/24/2018",
    		enrolled_date: "7/23/2018"
    	},
    	{
    		legis_bill_id: 1055359,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/S878/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=S878",
    		vetoed_date: "6/21/2018",
    		enrolled_date: "8/27/2018"
    	},
    	{
    		legis_bill_id: 1055504,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/S250/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=S250",
    		vetoed_date: "6/30/2018",
    		enrolled_date: "8/27/2018"
    	},
    	{
    		legis_bill_id: 1086997,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/A3267/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=A3267",
    		vetoed_date: "6/21/2018",
    		enrolled_date: "8/27/2018"
    	},
    	{
    		legis_bill_id: 1121018,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/S2662/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=S2662",
    		vetoed_date: "6/25/2018",
    		enrolled_date: "8/27/2018"
    	},
    	{
    		legis_bill_id: 1123203,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/A4262/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=A4262",
    		vetoed_date: "6/25/2018",
    		enrolled_date: "8/27/2018"
    	},
    	{
    		legis_bill_id: 1123211,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/A4261/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=A4261",
    		vetoed_date: "7/1/2018",
    		enrolled_date: "8/27/2018"
    	},
    	{
    		legis_bill_id: 1082227,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/S1697/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=S1697",
    		vetoed_date: "10/29/2018",
    		enrolled_date: "12/17/2018"
    	},
    	{
    		legis_bill_id: 1111583,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/S2455/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=S2455",
    		vetoed_date: "10/29/2018",
    		enrolled_date: "12/17/2018"
    	},
    	{
    		legis_bill_id: 1128190,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/S3074/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=S3074",
    		vetoed_date: "10/29/2018",
    		enrolled_date: "12/17/2018"
    	},
    	{
    		legis_bill_id: 1055877,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/S784/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=S784",
    		vetoed_date: "12/17/2018",
    		enrolled_date: "1/31/2019"
    	},
    	{
    		legis_bill_id: 1095808,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/S1965/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=S1965",
    		vetoed_date: "12/17/2018",
    		enrolled_date: "1/31/2019"
    	},
    	{
    		legis_bill_id: 1121050,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/S2663/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=S2663",
    		vetoed_date: "12/17/2018",
    		enrolled_date: "1/31/2019"
    	},
    	{
    		legis_bill_id: 1056820,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/A557/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=A557",
    		vetoed_date: "12/17/2018",
    		enrolled_date: "1/31/2019"
    	},
    	{
    		legis_bill_id: 1133295,
    		legis_session_id: 1616,
    		session_name: "2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/MT/bill/SB54/2019",
    		state: "MT",
    		state_url: "https://laws.leg.mt.gov/legprd/LAW0210W$BSIV.ActionQuery?P_BILL_NO1=54&P_BLTP_BILL_TYP_CD=SB&Z_ACTION=Find&P_SESS=20191",
    		vetoed_date: "2/20/2019",
    		enrolled_date: "3/8/2019"
    	},
    	{
    		legis_bill_id: 1215667,
    		legis_session_id: 1658,
    		session_name: "116th Congress",
    		session_title: "116th Congress",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/US/bill/HJR46/2019",
    		state: "US",
    		state_url: "https://www.congress.gov/bill/116th-congress/house-joint-resolution/46/all-info",
    		vetoed_date: "3/14/2019",
    		enrolled_date: "3/15/2019"
    	},
    	{
    		legis_bill_id: 1133321,
    		legis_session_id: 1616,
    		session_name: "2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/MT/bill/HB74/2019",
    		state: "MT",
    		state_url: "https://laws.leg.mt.gov/legprd/LAW0210W$BSIV.ActionQuery?P_BILL_NO1=74&P_BLTP_BILL_TYP_CD=HB&Z_ACTION=Find&P_SESS=20191",
    		vetoed_date: "2/21/2019",
    		enrolled_date: "4/10/2019"
    	},
    	{
    		legis_bill_id: 1135458,
    		legis_session_id: 1544,
    		session_name: "66th Legislative Assembly",
    		session_title: "66th Legislative Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/ND/bill/2055/2019",
    		state: "ND",
    		state_url: "https://www.legis.nd.gov/assembly/66-2019/bill-actions/ba2055.html",
    		vetoed_date: "4/3/2019",
    		enrolled_date: "4/10/2019"
    	},
    	{
    		legis_bill_id: 1151354,
    		legis_session_id: 1544,
    		session_name: "66th Legislative Assembly",
    		session_title: "66th Legislative Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/ND/bill/2244/2019",
    		state: "ND",
    		state_url: "https://www.legis.nd.gov/assembly/66-2019/bill-actions/ba2244.html",
    		vetoed_date: "3/15/2019",
    		enrolled_date: "3/22/2019"
    	},
    	{
    		legis_bill_id: 1281614,
    		legis_session_id: 1712,
    		session_name: "2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2020,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/OK/bill/HB1205/2020",
    		state: "OK",
    		state_url: "http://www.oklegislature.gov/BillInfo.aspx?Bill=hb1205&Session=2000",
    		vetoed_date: "4/10/2019",
    		enrolled_date: "4/16/2019"
    	},
    	{
    		legis_bill_id: 1160513,
    		legis_session_id: 1616,
    		session_name: "2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/MT/bill/HB238/2019",
    		state: "MT",
    		state_url: "https://laws.leg.mt.gov/legprd/LAW0210W$BSIV.ActionQuery?P_BILL_NO1=238&P_BLTP_BILL_TYP_CD=HB&Z_ACTION=Find&P_SESS=20191",
    		vetoed_date: "4/3/2019",
    		enrolled_date: "4/18/2019"
    	},
    	{
    		legis_bill_id: 1169717,
    		legis_session_id: 1616,
    		session_name: "2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/MT/bill/HB290/2019",
    		state: "MT",
    		state_url: "https://laws.leg.mt.gov/legprd/LAW0210W$BSIV.ActionQuery?P_BILL_NO1=290&P_BLTP_BILL_TYP_CD=HB&Z_ACTION=Find&P_SESS=20191",
    		vetoed_date: "4/1/2019",
    		enrolled_date: "4/18/2019"
    	},
    	{
    		legis_bill_id: 1190790,
    		legis_session_id: 1616,
    		session_name: "2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/MT/bill/SB217/2019",
    		state: "MT",
    		state_url: "https://laws.leg.mt.gov/legprd/LAW0210W$BSIV.ActionQuery?P_BILL_NO1=217&P_BLTP_BILL_TYP_CD=SB&Z_ACTION=Find&P_SESS=20191",
    		vetoed_date: "3/23/2019",
    		enrolled_date: "4/18/2019"
    	},
    	{
    		legis_bill_id: 1142220,
    		legis_session_id: 1616,
    		session_name: "2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/MT/bill/HB132/2019",
    		state: "MT",
    		state_url: "https://laws.leg.mt.gov/legprd/LAW0210W$BSIV.ActionQuery?P_BILL_NO1=132&P_BLTP_BILL_TYP_CD=HB&Z_ACTION=Find&P_SESS=20191",
    		vetoed_date: "3/27/2019",
    		enrolled_date: "4/29/2019"
    	},
    	{
    		legis_bill_id: 1186797,
    		legis_session_id: 1653,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/WA/bill/HB1866/2019",
    		state: "WA",
    		state_url: "https://app.leg.wa.gov/billsummary?BillNumber=1866&Year=2019&Initiative=false",
    		vetoed_date: "4/18/2019",
    		enrolled_date: "4/29/2019"
    	},
    	{
    		legis_bill_id: 1281333,
    		legis_session_id: 1712,
    		session_name: "2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2020,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/OK/bill/HB1968/2020",
    		state: "OK",
    		state_url: "http://www.oklegislature.gov/BillInfo.aspx?Bill=hb1968&Session=2000",
    		vetoed_date: "4/23/2019",
    		enrolled_date: "4/29/2019"
    	},
    	{
    		legis_bill_id: 1282255,
    		legis_session_id: 1712,
    		session_name: "2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2020,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/OK/bill/SB566/2020",
    		state: "OK",
    		state_url: "http://www.oklegislature.gov/BillInfo.aspx?Bill=sb566&Session=2000",
    		vetoed_date: "4/23/2019",
    		enrolled_date: "4/29/2019"
    	},
    	{
    		legis_bill_id: 1283315,
    		legis_session_id: 1712,
    		session_name: "2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2020,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/OK/bill/SB44/2020",
    		state: "OK",
    		state_url: "http://www.oklegislature.gov/BillInfo.aspx?Bill=sb44&Session=2000",
    		vetoed_date: "4/23/2019",
    		enrolled_date: "4/29/2019"
    	},
    	{
    		legis_bill_id: 1282913,
    		legis_session_id: 1712,
    		session_name: "2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2020,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/OK/bill/HB2465/2020",
    		state: "OK",
    		state_url: "http://www.oklegislature.gov/BillInfo.aspx?Bill=hb2465&Session=2000",
    		vetoed_date: "4/24/2019",
    		enrolled_date: "4/30/2019"
    	},
    	{
    		legis_bill_id: 1160476,
    		legis_session_id: 1633,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/KS/bill/SB22/2019",
    		state: "KS",
    		state_url: "http://kslegislature.org/li/b2019_20/measures/sb22/",
    		vetoed_date: "3/19/2019",
    		enrolled_date: "3/26/2019"
    	},
    	{
    		legis_bill_id: 1281324,
    		legis_session_id: 1712,
    		session_name: "2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2020,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/OK/bill/SB841/2020",
    		state: "OK",
    		state_url: "http://www.oklegislature.gov/BillInfo.aspx?Bill=sb841&Session=2000",
    		vetoed_date: "4/25/2019",
    		enrolled_date: "5/1/2019"
    	},
    	{
    		legis_bill_id: 1282084,
    		legis_session_id: 1712,
    		session_name: "2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2020,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/OK/bill/SB685/2020",
    		state: "OK",
    		state_url: "http://www.oklegislature.gov/BillInfo.aspx?Bill=sb685&Session=2000",
    		vetoed_date: "4/25/2019",
    		enrolled_date: "5/1/2019"
    	},
    	{
    		legis_bill_id: 1283873,
    		legis_session_id: 1712,
    		session_name: "2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2020,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/OK/bill/SB134/2020",
    		state: "OK",
    		state_url: "http://www.oklegislature.gov/BillInfo.aspx?Bill=sb134&Session=2000",
    		vetoed_date: "4/25/2019",
    		enrolled_date: "5/1/2019"
    	},
    	{
    		legis_bill_id: 1177942,
    		legis_session_id: 1616,
    		session_name: "2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/MT/bill/HB323/2019",
    		state: "MT",
    		state_url: "https://laws.leg.mt.gov/legprd/LAW0210W$BSIV.ActionQuery?P_BILL_NO1=323&P_BLTP_BILL_TYP_CD=HB&Z_ACTION=Find&P_SESS=20191",
    		vetoed_date: "3/20/2019",
    		enrolled_date: "5/2/2019"
    	},
    	{
    		legis_bill_id: 1182163,
    		legis_session_id: 1658,
    		session_name: "116th Congress",
    		session_title: "116th Congress",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/US/bill/SJR7/2019",
    		state: "US",
    		state_url: "https://www.congress.gov/bill/116th-congress/senate-joint-resolution/7/all-info",
    		vetoed_date: "4/16/2019",
    		enrolled_date: "4/16/2019"
    	},
    	{
    		legis_bill_id: 1184801,
    		legis_session_id: 1633,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/KS/bill/SB67/2019",
    		state: "KS",
    		state_url: "http://kslegislature.org/li/b2019_20/measures/sb67/",
    		vetoed_date: "5/1/2019",
    		enrolled_date: "5/1/2019"
    	},
    	{
    		legis_bill_id: 1189749,
    		legis_session_id: 1616,
    		session_name: "2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/MT/bill/SB216/2019",
    		state: "MT",
    		state_url: "https://laws.leg.mt.gov/legprd/LAW0210W$BSIV.ActionQuery?P_BILL_NO1=216&P_BLTP_BILL_TYP_CD=SB&Z_ACTION=Find&P_SESS=20191",
    		vetoed_date: "4/18/2019",
    		enrolled_date: "5/2/2019"
    	},
    	{
    		legis_bill_id: 1130634,
    		legis_session_id: 1616,
    		session_name: "2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/MT/bill/SB8/2019",
    		state: "MT",
    		state_url: "https://laws.leg.mt.gov/legprd/LAW0210W$BSIV.ActionQuery?P_BILL_NO1=8&P_BLTP_BILL_TYP_CD=SB&Z_ACTION=Find&P_SESS=20191",
    		vetoed_date: "4/12/2019",
    		enrolled_date: "5/3/2019"
    	},
    	{
    		legis_bill_id: 1147829,
    		legis_session_id: 1616,
    		session_name: "2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/MT/bill/SB100/2019",
    		state: "MT",
    		state_url: "https://laws.leg.mt.gov/legprd/LAW0210W$BSIV.ActionQuery?P_BILL_NO1=100&P_BLTP_BILL_TYP_CD=SB&Z_ACTION=Find&P_SESS=20191",
    		vetoed_date: "4/12/2019",
    		enrolled_date: "5/3/2019"
    	},
    	{
    		legis_bill_id: 1178250,
    		legis_session_id: 1616,
    		session_name: "2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/MT/bill/HB325/2019",
    		state: "MT",
    		state_url: "https://laws.leg.mt.gov/legprd/LAW0210W$BSIV.ActionQuery?P_BILL_NO1=325&P_BLTP_BILL_TYP_CD=HB&Z_ACTION=Find&P_SESS=20191",
    		vetoed_date: "4/3/2019",
    		enrolled_date: "5/3/2019"
    	},
    	{
    		legis_bill_id: 1200002,
    		legis_session_id: 1616,
    		session_name: "2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/MT/bill/SB252/2019",
    		state: "MT",
    		state_url: "https://laws.leg.mt.gov/legprd/LAW0210W$BSIV.ActionQuery?P_BILL_NO1=252&P_BLTP_BILL_TYP_CD=SB&Z_ACTION=Find&P_SESS=20191",
    		vetoed_date: "4/25/2019",
    		enrolled_date: "5/3/2019"
    	},
    	{
    		legis_bill_id: 1203384,
    		legis_session_id: 1616,
    		session_name: "2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/MT/bill/HB487/2019",
    		state: "MT",
    		state_url: "https://laws.leg.mt.gov/legprd/LAW0210W$BSIV.ActionQuery?P_BILL_NO1=487&P_BLTP_BILL_TYP_CD=HB&Z_ACTION=Find&P_SESS=20191",
    		vetoed_date: "4/3/2019",
    		enrolled_date: "5/3/2019"
    	},
    	{
    		legis_bill_id: 1212368,
    		legis_session_id: 1616,
    		session_name: "2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/MT/bill/SB304/2019",
    		state: "MT",
    		state_url: "https://laws.leg.mt.gov/legprd/LAW0210W$BSIV.ActionQuery?P_BILL_NO1=304&P_BLTP_BILL_TYP_CD=SB&Z_ACTION=Find&P_SESS=20191",
    		vetoed_date: "4/9/2019",
    		enrolled_date: "5/3/2019"
    	},
    	{
    		legis_bill_id: 1143118,
    		legis_session_id: 1616,
    		session_name: "2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/MT/bill/HB146/2019",
    		state: "MT",
    		state_url: "https://laws.leg.mt.gov/legprd/LAW0210W$BSIV.ActionQuery?P_BILL_NO1=146&P_BLTP_BILL_TYP_CD=HB&Z_ACTION=Find&P_SESS=20191",
    		vetoed_date: "4/11/2019",
    		enrolled_date: "5/7/2019"
    	},
    	{
    		legis_bill_id: 1178474,
    		legis_session_id: 1616,
    		session_name: "2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/MT/bill/HB332/2019",
    		state: "MT",
    		state_url: "https://laws.leg.mt.gov/legprd/LAW0210W$BSIV.ActionQuery?P_BILL_NO1=332&P_BLTP_BILL_TYP_CD=HB&Z_ACTION=Find&P_SESS=20191",
    		vetoed_date: "4/8/2019",
    		enrolled_date: "5/7/2019"
    	},
    	{
    		legis_bill_id: 1203651,
    		legis_session_id: 1616,
    		session_name: "2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/MT/bill/HB473/2019",
    		state: "MT",
    		state_url: "https://laws.leg.mt.gov/legprd/LAW0210W$BSIV.ActionQuery?P_BILL_NO1=473&P_BLTP_BILL_TYP_CD=HB&Z_ACTION=Find&P_SESS=20191",
    		vetoed_date: "4/8/2019",
    		enrolled_date: "5/7/2019"
    	},
    	{
    		legis_bill_id: 1203718,
    		legis_session_id: 1616,
    		session_name: "2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/MT/bill/HB481/2019",
    		state: "MT",
    		state_url: "https://laws.leg.mt.gov/legprd/LAW0210W$BSIV.ActionQuery?P_BILL_NO1=481&P_BLTP_BILL_TYP_CD=HB&Z_ACTION=Find&P_SESS=20191",
    		vetoed_date: "4/10/2019",
    		enrolled_date: "5/7/2019"
    	},
    	{
    		legis_bill_id: 1206309,
    		legis_session_id: 1616,
    		session_name: "2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/MT/bill/HB500/2019",
    		state: "MT",
    		state_url: "https://laws.leg.mt.gov/legprd/LAW0210W$BSIV.ActionQuery?P_BILL_NO1=500&P_BLTP_BILL_TYP_CD=HB&Z_ACTION=Find&P_SESS=20191",
    		vetoed_date: "4/18/2019",
    		enrolled_date: "5/7/2019"
    	},
    	{
    		legis_bill_id: 1211409,
    		legis_session_id: 1616,
    		session_name: "2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/MT/bill/HB567/2019",
    		state: "MT",
    		state_url: "https://laws.leg.mt.gov/legprd/LAW0210W$BSIV.ActionQuery?P_BILL_NO1=567&P_BLTP_BILL_TYP_CD=HB&Z_ACTION=Find&P_SESS=20191",
    		vetoed_date: "4/15/2019",
    		enrolled_date: "5/7/2019"
    	},
    	{
    		legis_bill_id: 1171159,
    		legis_session_id: 1653,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/WA/bill/SB5573/2019",
    		state: "WA",
    		state_url: "https://app.leg.wa.gov/billsummary?BillNumber=5573&Year=2019&Initiative=false",
    		vetoed_date: "4/25/2019",
    		enrolled_date: "5/8/2019"
    	},
    	{
    		legis_bill_id: 1208800,
    		legis_session_id: 1616,
    		session_name: "2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/MT/bill/HB537/2019",
    		state: "MT",
    		state_url: "https://laws.leg.mt.gov/legprd/LAW0210W$BSIV.ActionQuery?P_BILL_NO1=537&P_BLTP_BILL_TYP_CD=HB&Z_ACTION=Find&P_SESS=20191",
    		vetoed_date: "4/4/2019",
    		enrolled_date: "5/8/2019"
    	},
    	{
    		legis_bill_id: 1238320,
    		legis_session_id: 1616,
    		session_name: "2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/MT/bill/SB329/2019",
    		state: "MT",
    		state_url: "https://laws.leg.mt.gov/legprd/LAW0210W$BSIV.ActionQuery?P_BILL_NO1=329&P_BLTP_BILL_TYP_CD=SB&Z_ACTION=Find&P_SESS=20191",
    		vetoed_date: "4/16/2019",
    		enrolled_date: "5/8/2019"
    	},
    	{
    		legis_bill_id: 1243619,
    		legis_session_id: 1616,
    		session_name: "2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/MT/bill/SB354/2019",
    		state: "MT",
    		state_url: "https://laws.leg.mt.gov/legprd/LAW0210W$BSIV.ActionQuery?P_BILL_NO1=354&P_BLTP_BILL_TYP_CD=SB&Z_ACTION=Find&P_SESS=20191",
    		vetoed_date: "4/16/2019",
    		enrolled_date: "5/8/2019"
    	},
    	{
    		legis_bill_id: 1243713,
    		legis_session_id: 1616,
    		session_name: "2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/MT/bill/HB753/2019",
    		state: "MT",
    		state_url: "https://laws.leg.mt.gov/legprd/LAW0210W$BSIV.ActionQuery?P_BILL_NO1=753&P_BLTP_BILL_TYP_CD=HB&Z_ACTION=Find&P_SESS=20191",
    		vetoed_date: "4/17/2019",
    		enrolled_date: "5/8/2019"
    	},
    	{
    		legis_bill_id: 1200610,
    		legis_session_id: 1635,
    		session_name: "129th Legislature",
    		session_title: "129th Legislature",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/ME/bill/LD822/2019",
    		state: "ME",
    		state_url: "http://legislature.maine.gov/legis/bills/display_ps.asp?LD=822&snum=129",
    		vetoed_date: "4/11/2019",
    		enrolled_date: "5/9/2019"
    	},
    	{
    		legis_bill_id: 1153474,
    		legis_session_id: 1618,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/GA/bill/SB15/2019",
    		state: "GA",
    		state_url: "https://www.legis.ga.gov/legislation/54218",
    		vetoed_date: "4/9/2019",
    		enrolled_date: "5/10/2019"
    	},
    	{
    		legis_bill_id: 1165393,
    		legis_session_id: 1616,
    		session_name: "2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/MT/bill/HB265/2019",
    		state: "MT",
    		state_url: "https://laws.leg.mt.gov/legprd/LAW0210W$BSIV.ActionQuery?P_BILL_NO1=265&P_BLTP_BILL_TYP_CD=HB&Z_ACTION=Find&P_SESS=20191",
    		vetoed_date: "4/8/2019",
    		enrolled_date: "5/10/2019"
    	},
    	{
    		legis_bill_id: 1177566,
    		legis_session_id: 1618,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/GA/bill/HR51/2019",
    		state: "GA",
    		state_url: "https://www.legis.ga.gov/legislation/54343",
    		vetoed_date: "4/11/2019",
    		enrolled_date: "5/10/2019"
    	},
    	{
    		legis_bill_id: 1180156,
    		legis_session_id: 1618,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/GA/bill/HB83/2019",
    		state: "GA",
    		state_url: "https://www.legis.ga.gov/legislation/54417",
    		vetoed_date: "4/4/2019",
    		enrolled_date: "5/10/2019"
    	},
    	{
    		legis_bill_id: 1191338,
    		legis_session_id: 1618,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/GA/bill/SB53/2019",
    		state: "GA",
    		state_url: "https://www.legis.ga.gov/legislation/54539",
    		vetoed_date: "4/5/2019",
    		enrolled_date: "5/10/2019"
    	},
    	{
    		legis_bill_id: 1196301,
    		legis_session_id: 1618,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/GA/bill/SB75/2019",
    		state: "GA",
    		state_url: "https://www.legis.ga.gov/legislation/54699",
    		vetoed_date: "4/5/2019",
    		enrolled_date: "5/10/2019"
    	},
    	{
    		legis_bill_id: 1196304,
    		legis_session_id: 1618,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/GA/bill/HB187/2019",
    		state: "GA",
    		state_url: "https://www.legis.ga.gov/legislation/54671",
    		vetoed_date: "4/4/2019",
    		enrolled_date: "5/10/2019"
    	},
    	{
    		legis_bill_id: 1198193,
    		legis_session_id: 1618,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/GA/bill/SB80/2019",
    		state: "GA",
    		state_url: "https://www.legis.ga.gov/legislation/54748",
    		vetoed_date: "4/5/2019",
    		enrolled_date: "5/10/2019"
    	},
    	{
    		legis_bill_id: 1201014,
    		legis_session_id: 1618,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/GA/bill/HB279/2019",
    		state: "GA",
    		state_url: "https://www.legis.ga.gov/legislation/54883",
    		vetoed_date: "4/11/2019",
    		enrolled_date: "5/10/2019"
    	},
    	{
    		legis_bill_id: 1203052,
    		legis_session_id: 1618,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/GA/bill/SB103/2019",
    		state: "GA",
    		state_url: "https://www.legis.ga.gov/legislation/54942",
    		vetoed_date: "4/9/2019",
    		enrolled_date: "5/10/2019"
    	},
    	{
    		legis_bill_id: 1205437,
    		legis_session_id: 1618,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/GA/bill/HB311/2019",
    		state: "GA",
    		state_url: "https://www.legis.ga.gov/legislation/54983",
    		vetoed_date: "4/11/2019",
    		enrolled_date: "5/10/2019"
    	},
    	{
    		legis_bill_id: 1208289,
    		legis_session_id: 1618,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/GA/bill/SB120/2019",
    		state: "GA",
    		state_url: "https://www.legis.ga.gov/legislation/55070",
    		vetoed_date: "4/9/2019",
    		enrolled_date: "5/10/2019"
    	},
    	{
    		legis_bill_id: 1208915,
    		legis_session_id: 1616,
    		session_name: "2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/MT/bill/HB534/2019",
    		state: "MT",
    		state_url: "https://laws.leg.mt.gov/legprd/LAW0210W$BSIV.ActionQuery?P_BILL_NO1=534&P_BLTP_BILL_TYP_CD=HB&Z_ACTION=Find&P_SESS=20191",
    		vetoed_date: "4/18/2019",
    		enrolled_date: "5/10/2019"
    	},
    	{
    		legis_bill_id: 1208991,
    		legis_session_id: 1616,
    		session_name: "2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/MT/bill/HB532/2019",
    		state: "MT",
    		state_url: "https://laws.leg.mt.gov/legprd/LAW0210W$BSIV.ActionQuery?P_BILL_NO1=532&P_BLTP_BILL_TYP_CD=HB&Z_ACTION=Find&P_SESS=20191",
    		vetoed_date: "4/23/2019",
    		enrolled_date: "5/10/2019"
    	},
    	{
    		legis_bill_id: 1211774,
    		legis_session_id: 1616,
    		session_name: "2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/MT/bill/HB579/2019",
    		state: "MT",
    		state_url: "https://laws.leg.mt.gov/legprd/LAW0210W$BSIV.ActionQuery?P_BILL_NO1=579&P_BLTP_BILL_TYP_CD=HB&Z_ACTION=Find&P_SESS=20191",
    		vetoed_date: "4/11/2019",
    		enrolled_date: "5/10/2019"
    	},
    	{
    		legis_bill_id: 1214124,
    		legis_session_id: 1618,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/GA/bill/SB153/2019",
    		state: "GA",
    		state_url: "https://www.legis.ga.gov/legislation/55249",
    		vetoed_date: "4/5/2019",
    		enrolled_date: "5/10/2019"
    	},
    	{
    		legis_bill_id: 1223537,
    		legis_session_id: 1618,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/GA/bill/HB516/2019",
    		state: "GA",
    		state_url: "https://www.legis.ga.gov/legislation/55536",
    		vetoed_date: "4/11/2019",
    		enrolled_date: "5/10/2019"
    	},
    	{
    		legis_bill_id: 1237242,
    		legis_session_id: 1618,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/GA/bill/HB598/2019",
    		state: "GA",
    		state_url: "https://www.legis.ga.gov/legislation/55804",
    		vetoed_date: "4/11/2019",
    		enrolled_date: "5/10/2019"
    	},
    	{
    		legis_bill_id: 1072781,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/S1246/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=S1246",
    		vetoed_date: "3/25/2019",
    		enrolled_date: "5/13/2019"
    	},
    	{
    		legis_bill_id: 1080254,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/S1500/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=S1500",
    		vetoed_date: "3/25/2019",
    		enrolled_date: "5/13/2019"
    	},
    	{
    		legis_bill_id: 1113044,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/S2475/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=S2475",
    		vetoed_date: "2/25/2019",
    		enrolled_date: "5/13/2019"
    	},
    	{
    		legis_bill_id: 1132166,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/S3240/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=S3240",
    		vetoed_date: "3/14/2019",
    		enrolled_date: "5/13/2019"
    	},
    	{
    		legis_bill_id: 1282879,
    		legis_session_id: 1712,
    		session_name: "2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2020,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/OK/bill/HB2289/2020",
    		state: "OK",
    		state_url: "http://www.oklegislature.gov/BillInfo.aspx?Bill=hb2289&Session=2000",
    		vetoed_date: "5/7/2019",
    		enrolled_date: "5/13/2019"
    	},
    	{
    		legis_bill_id: 1282652,
    		legis_session_id: 1712,
    		session_name: "2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2020,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/OK/bill/SB251/2020",
    		state: "OK",
    		state_url: "http://www.oklegislature.gov/BillInfo.aspx?Bill=sb251&Session=2000",
    		vetoed_date: "5/8/2019",
    		enrolled_date: "5/14/2019"
    	},
    	{
    		legis_bill_id: 1284052,
    		legis_session_id: 1712,
    		session_name: "2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2020,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/OK/bill/HB1018/2020",
    		state: "OK",
    		state_url: "http://www.oklegislature.gov/BillInfo.aspx?Bill=hb1018&Session=2000",
    		vetoed_date: "5/8/2019",
    		enrolled_date: "5/14/2019"
    	},
    	{
    		legis_bill_id: 1284330,
    		legis_session_id: 1712,
    		session_name: "2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2020,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/OK/bill/HB2036/2020",
    		state: "OK",
    		state_url: "http://www.oklegislature.gov/BillInfo.aspx?Bill=hb2036&Session=2000",
    		vetoed_date: "5/8/2019",
    		enrolled_date: "5/14/2019"
    	},
    	{
    		legis_bill_id: 1281522,
    		legis_session_id: 1712,
    		session_name: "2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2020,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/OK/bill/HB1940/2020",
    		state: "OK",
    		state_url: "http://www.oklegislature.gov/BillInfo.aspx?Bill=hb1940&Session=2000",
    		vetoed_date: "5/9/2019",
    		enrolled_date: "5/15/2019"
    	},
    	{
    		legis_bill_id: 1054998,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/A809/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=A809",
    		vetoed_date: "2/21/2019",
    		enrolled_date: "5/13/2019"
    	},
    	{
    		legis_bill_id: 1101736,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/S2129/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=S2129",
    		vetoed_date: "1/31/2019",
    		enrolled_date: "3/18/2019"
    	},
    	{
    		legis_bill_id: 1165699,
    		legis_session_id: 1650,
    		session_name: "123rd General Assembly",
    		session_title: "123rd General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/SC/bill/H3700/2019",
    		state: "SC",
    		state_url: "https://www.scstatehouse.gov/billsearch.php?billnumbers=3700&session=123&summary=B",
    		vetoed_date: "5/8/2019",
    		enrolled_date: "5/15/2019"
    	},
    	{
    		legis_bill_id: 1194659,
    		legis_session_id: 1611,
    		session_name: "86th Legislature Regular Session",
    		session_title: "86th Legislature",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/TX/bill/HB1476/2019",
    		state: "TX",
    		state_url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=86R&Bill=HB1476",
    		vetoed_date: "5/9/2019",
    		enrolled_date: "5/22/2019"
    	},
    	{
    		legis_bill_id: 1281412,
    		legis_session_id: 1712,
    		session_name: "2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2020,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/OK/bill/HB2477/2020",
    		state: "OK",
    		state_url: "http://www.oklegislature.gov/BillInfo.aspx?Bill=hb2477&Session=2000",
    		vetoed_date: "5/23/2019",
    		enrolled_date: "5/23/2019"
    	},
    	{
    		legis_bill_id: 1282228,
    		legis_session_id: 1712,
    		session_name: "2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2020,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/OK/bill/HB1979/2020",
    		state: "OK",
    		state_url: "http://www.oklegislature.gov/BillInfo.aspx?Bill=hb1979&Session=2000",
    		vetoed_date: "5/22/2019",
    		enrolled_date: "5/23/2019"
    	},
    	{
    		legis_bill_id: 1238310,
    		legis_session_id: 1632,
    		session_name: "88th General Assembly",
    		session_title: "88th General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/IA/bill/HF732/2019",
    		state: "IA",
    		state_url: "https://www.legis.iowa.gov/legislation/BillBook?ga=88&ba=HF732",
    		vetoed_date: "5/7/2019",
    		enrolled_date: "5/24/2019"
    	},
    	{
    		legis_bill_id: 1198948,
    		legis_session_id: 1611,
    		session_name: "86th Legislature Regular Session",
    		session_title: "86th Legislature",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/TX/bill/SB746/2019",
    		state: "TX",
    		state_url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=86R&Bill=SB746",
    		vetoed_date: "5/13/2019",
    		enrolled_date: "5/25/2019"
    	},
    	{
    		legis_bill_id: 1129293,
    		legis_session_id: 1611,
    		session_name: "86th Legislature Regular Session",
    		session_title: "86th Legislature",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/TX/bill/SB124/2019",
    		state: "TX",
    		state_url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=86R&Bill=SB124",
    		vetoed_date: "5/15/2019",
    		enrolled_date: "5/27/2019"
    	},
    	{
    		legis_bill_id: 1174745,
    		legis_session_id: 1611,
    		session_name: "86th Legislature Regular Session",
    		session_title: "86th Legislature",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/TX/bill/SB467/2019",
    		state: "TX",
    		state_url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=86R&Bill=SB467",
    		vetoed_date: "5/14/2019",
    		enrolled_date: "5/27/2019"
    	},
    	{
    		legis_bill_id: 1178775,
    		legis_session_id: 1611,
    		session_name: "86th Legislature Regular Session",
    		session_title: "86th Legislature",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/TX/bill/SB511/2019",
    		state: "TX",
    		state_url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=86R&Bill=SB511",
    		vetoed_date: "5/22/2019",
    		enrolled_date: "5/27/2019"
    	},
    	{
    		legis_bill_id: 1181240,
    		legis_session_id: 1611,
    		session_name: "86th Legislature Regular Session",
    		session_title: "86th Legislature",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/TX/bill/SB536/2019",
    		state: "TX",
    		state_url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=86R&Bill=SB536",
    		vetoed_date: "5/16/2019",
    		enrolled_date: "5/27/2019"
    	},
    	{
    		legis_bill_id: 1154869,
    		legis_session_id: 1633,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/KS/bill/HB2033/2019",
    		state: "KS",
    		state_url: "http://kslegislature.org/li/b2019_20/measures/hb2033/",
    		vetoed_date: "5/29/2019",
    		enrolled_date: "5/29/2019"
    	},
    	{
    		legis_bill_id: 1281161,
    		legis_session_id: 1712,
    		session_name: "2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2020,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/OK/bill/SB1055/2020",
    		state: "OK",
    		state_url: "http://www.oklegislature.gov/BillInfo.aspx?Bill=sb1055&Session=2000",
    		vetoed_date: "5/23/2019",
    		enrolled_date: "5/29/2019"
    	},
    	{
    		legis_bill_id: 1281508,
    		legis_session_id: 1712,
    		session_name: "2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2020,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/OK/bill/SB1056/2020",
    		state: "OK",
    		state_url: "http://www.oklegislature.gov/BillInfo.aspx?Bill=sb1056&Session=2000",
    		vetoed_date: "5/23/2019",
    		enrolled_date: "5/29/2019"
    	},
    	{
    		legis_bill_id: 1232902,
    		legis_session_id: 1611,
    		session_name: "86th Legislature Regular Session",
    		session_title: "86th Legislature",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/TX/bill/SB1804/2019",
    		state: "TX",
    		state_url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=86R&Bill=SB1804",
    		vetoed_date: "5/26/2019",
    		enrolled_date: "6/5/2019"
    	},
    	{
    		legis_bill_id: 1244548,
    		legis_session_id: 1645,
    		session_name: "2019-2020 Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NC/bill/S359/2019",
    		state: "NC",
    		state_url: "https://www.ncleg.gov/BillLookUp/2019/S359",
    		vetoed_date: "4/16/2019",
    		enrolled_date: "4/18/2019"
    	},
    	{
    		legis_bill_id: 1238393,
    		legis_session_id: 1616,
    		session_name: "2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/MT/bill/SB330/2019",
    		state: "MT",
    		state_url: "https://laws.leg.mt.gov/legprd/LAW0210W$BSIV.ActionQuery?P_BILL_NO1=330&P_BLTP_BILL_TYP_CD=SB&Z_ACTION=Find&P_SESS=20191",
    		vetoed_date: "4/18/2019",
    		enrolled_date: "5/3/2019"
    	},
    	{
    		legis_bill_id: 1133809,
    		legis_session_id: 1616,
    		session_name: "2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/MT/bill/SB71/2019",
    		state: "MT",
    		state_url: "https://laws.leg.mt.gov/legprd/LAW0210W$BSIV.ActionQuery?P_BILL_NO1=71&P_BLTP_BILL_TYP_CD=SB&Z_ACTION=Find&P_SESS=20191",
    		vetoed_date: "4/5/2019",
    		enrolled_date: "5/9/2019"
    	},
    	{
    		legis_bill_id: 1197502,
    		legis_session_id: 1616,
    		session_name: "2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/MT/bill/SB239/2019",
    		state: "MT",
    		state_url: "https://laws.leg.mt.gov/legprd/LAW0210W$BSIV.ActionQuery?P_BILL_NO1=239&P_BLTP_BILL_TYP_CD=SB&Z_ACTION=Find&P_SESS=20191",
    		vetoed_date: "4/18/2019",
    		enrolled_date: "5/8/2019"
    	},
    	{
    		legis_bill_id: 1206074,
    		legis_session_id: 1616,
    		session_name: "2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/MT/bill/SB266/2019",
    		state: "MT",
    		state_url: "https://laws.leg.mt.gov/legprd/LAW0210W$BSIV.ActionQuery?P_BILL_NO1=266&P_BLTP_BILL_TYP_CD=SB&Z_ACTION=Find&P_SESS=20191",
    		vetoed_date: "4/18/2019",
    		enrolled_date: "5/7/2019"
    	},
    	{
    		legis_bill_id: 1243440,
    		legis_session_id: 1616,
    		session_name: "2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/MT/bill/HB735/2019",
    		state: "MT",
    		state_url: "https://laws.leg.mt.gov/legprd/LAW0210W$BSIV.ActionQuery?P_BILL_NO1=735&P_BLTP_BILL_TYP_CD=HB&Z_ACTION=Find&P_SESS=20191",
    		vetoed_date: "4/18/2019",
    		enrolled_date: "5/7/2019"
    	},
    	{
    		legis_bill_id: 1129306,
    		legis_session_id: 1611,
    		session_name: "86th Legislature Regular Session",
    		session_title: "86th Legislature",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/TX/bill/HB51/2019",
    		state: "TX",
    		state_url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=86R&Bill=HB51",
    		vetoed_date: "5/21/2019",
    		enrolled_date: "6/15/2019"
    	},
    	{
    		legis_bill_id: 1129401,
    		legis_session_id: 1611,
    		session_name: "86th Legislature Regular Session",
    		session_title: "86th Legislature",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/TX/bill/HB109/2019",
    		state: "TX",
    		state_url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=86R&Bill=HB109",
    		vetoed_date: "5/27/2019",
    		enrolled_date: "6/15/2019"
    	},
    	{
    		legis_bill_id: 1129434,
    		legis_session_id: 1611,
    		session_name: "86th Legislature Regular Session",
    		session_title: "86th Legislature",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/TX/bill/HB70/2019",
    		state: "TX",
    		state_url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=86R&Bill=HB70",
    		vetoed_date: "5/16/2019",
    		enrolled_date: "6/15/2019"
    	},
    	{
    		legis_bill_id: 1129493,
    		legis_session_id: 1611,
    		session_name: "86th Legislature Regular Session",
    		session_title: "86th Legislature",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/TX/bill/HB93/2019",
    		state: "TX",
    		state_url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=86R&Bill=HB93",
    		vetoed_date: "5/21/2019",
    		enrolled_date: "6/15/2019"
    	},
    	{
    		legis_bill_id: 1130128,
    		legis_session_id: 1611,
    		session_name: "86th Legislature Regular Session",
    		session_title: "86th Legislature",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/TX/bill/HB345/2019",
    		state: "TX",
    		state_url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=86R&Bill=HB345",
    		vetoed_date: "5/21/2019",
    		enrolled_date: "6/15/2019"
    	},
    	{
    		legis_bill_id: 1130556,
    		legis_session_id: 1611,
    		session_name: "86th Legislature Regular Session",
    		session_title: "86th Legislature",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/TX/bill/HB389/2019",
    		state: "TX",
    		state_url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=86R&Bill=HB389",
    		vetoed_date: "5/15/2019",
    		enrolled_date: "6/15/2019"
    	},
    	{
    		legis_bill_id: 1131466,
    		legis_session_id: 1611,
    		session_name: "86th Legislature Regular Session",
    		session_title: "86th Legislature",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/TX/bill/HB448/2019",
    		state: "TX",
    		state_url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=86R&Bill=HB448",
    		vetoed_date: "5/25/2019",
    		enrolled_date: "6/15/2019"
    	},
    	{
    		legis_bill_id: 1132139,
    		legis_session_id: 1611,
    		session_name: "86th Legislature Regular Session",
    		session_title: "86th Legislature",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/TX/bill/HB455/2019",
    		state: "TX",
    		state_url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=86R&Bill=HB455",
    		vetoed_date: "5/21/2019",
    		enrolled_date: "6/15/2019"
    	},
    	{
    		legis_bill_id: 1132228,
    		legis_session_id: 1611,
    		session_name: "86th Legislature Regular Session",
    		session_title: "86th Legislature",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/TX/bill/HB463/2019",
    		state: "TX",
    		state_url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=86R&Bill=HB463",
    		vetoed_date: "5/25/2019",
    		enrolled_date: "6/15/2019"
    	},
    	{
    		legis_bill_id: 1139106,
    		legis_session_id: 1611,
    		session_name: "86th Legislature Regular Session",
    		session_title: "86th Legislature",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/TX/bill/HB651/2019",
    		state: "TX",
    		state_url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=86R&Bill=HB651",
    		vetoed_date: "5/24/2019",
    		enrolled_date: "6/15/2019"
    	},
    	{
    		legis_bill_id: 1161995,
    		legis_session_id: 1611,
    		session_name: "86th Legislature Regular Session",
    		session_title: "86th Legislature",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/TX/bill/SB390/2019",
    		state: "TX",
    		state_url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=86R&Bill=SB390",
    		vetoed_date: "5/26/2019",
    		enrolled_date: "6/15/2019"
    	},
    	{
    		legis_bill_id: 1162604,
    		legis_session_id: 1611,
    		session_name: "86th Legislature Regular Session",
    		session_title: "86th Legislature",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/TX/bill/HB929/2019",
    		state: "TX",
    		state_url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=86R&Bill=HB929",
    		vetoed_date: "5/16/2019",
    		enrolled_date: "6/15/2019"
    	},
    	{
    		legis_bill_id: 1168721,
    		legis_session_id: 1611,
    		session_name: "86th Legislature Regular Session",
    		session_title: "86th Legislature",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/TX/bill/HB994/2019",
    		state: "TX",
    		state_url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=86R&Bill=HB994",
    		vetoed_date: "5/26/2019",
    		enrolled_date: "6/15/2019"
    	},
    	{
    		legis_bill_id: 1168787,
    		legis_session_id: 1611,
    		session_name: "86th Legislature Regular Session",
    		session_title: "86th Legislature",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/TX/bill/HB1031/2019",
    		state: "TX",
    		state_url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=86R&Bill=HB1031",
    		vetoed_date: "5/15/2019",
    		enrolled_date: "6/15/2019"
    	},
    	{
    		legis_bill_id: 1171302,
    		legis_session_id: 1611,
    		session_name: "86th Legislature Regular Session",
    		session_title: "86th Legislature",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/TX/bill/HB1053/2019",
    		state: "TX",
    		state_url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=86R&Bill=HB1053",
    		vetoed_date: "5/27/2019",
    		enrolled_date: "6/15/2019"
    	},
    	{
    		legis_bill_id: 1171323,
    		legis_session_id: 1611,
    		session_name: "86th Legislature Regular Session",
    		session_title: "86th Legislature",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/TX/bill/HB1059/2019",
    		state: "TX",
    		state_url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=86R&Bill=HB1059",
    		vetoed_date: "5/23/2019",
    		enrolled_date: "6/15/2019"
    	},
    	{
    		legis_bill_id: 1174264,
    		legis_session_id: 1611,
    		session_name: "86th Legislature Regular Session",
    		session_title: "86th Legislature",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/TX/bill/HB1099/2019",
    		state: "TX",
    		state_url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=86R&Bill=HB1099",
    		vetoed_date: "5/22/2019",
    		enrolled_date: "6/15/2019"
    	},
    	{
    		legis_bill_id: 1175397,
    		legis_session_id: 1611,
    		session_name: "86th Legislature Regular Session",
    		session_title: "86th Legislature",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/TX/bill/HB1120/2019",
    		state: "TX",
    		state_url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=86R&Bill=HB1120",
    		vetoed_date: "5/25/2019",
    		enrolled_date: "6/15/2019"
    	},
    	{
    		legis_bill_id: 1177843,
    		legis_session_id: 1611,
    		session_name: "86th Legislature Regular Session",
    		session_title: "86th Legislature",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/TX/bill/HB1174/2019",
    		state: "TX",
    		state_url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=86R&Bill=HB1174",
    		vetoed_date: "5/25/2019",
    		enrolled_date: "6/15/2019"
    	},
    	{
    		legis_bill_id: 1177941,
    		legis_session_id: 1611,
    		session_name: "86th Legislature Regular Session",
    		session_title: "86th Legislature",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/TX/bill/HB1168/2019",
    		state: "TX",
    		state_url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=86R&Bill=HB1168",
    		vetoed_date: "5/17/2019",
    		enrolled_date: "6/15/2019"
    	},
    	{
    		legis_bill_id: 1181590,
    		legis_session_id: 1611,
    		session_name: "86th Legislature Regular Session",
    		session_title: "86th Legislature",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/TX/bill/HB1215/2019",
    		state: "TX",
    		state_url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=86R&Bill=HB1215",
    		vetoed_date: "5/25/2019",
    		enrolled_date: "6/15/2019"
    	},
    	{
    		legis_bill_id: 1182645,
    		legis_session_id: 1611,
    		session_name: "86th Legislature Regular Session",
    		session_title: "86th Legislature",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/TX/bill/SB550/2019",
    		state: "TX",
    		state_url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=86R&Bill=SB550",
    		vetoed_date: "5/23/2019",
    		enrolled_date: "6/15/2019"
    	},
    	{
    		legis_bill_id: 1190780,
    		legis_session_id: 1611,
    		session_name: "86th Legislature Regular Session",
    		session_title: "86th Legislature",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/TX/bill/HB1404/2019",
    		state: "TX",
    		state_url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=86R&Bill=HB1404",
    		vetoed_date: "5/24/2019",
    		enrolled_date: "6/15/2019"
    	},
    	{
    		legis_bill_id: 1191697,
    		legis_session_id: 1611,
    		session_name: "86th Legislature Regular Session",
    		session_title: "86th Legislature",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/TX/bill/SB667/2019",
    		state: "TX",
    		state_url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=86R&Bill=SB667",
    		vetoed_date: "5/24/2019",
    		enrolled_date: "6/15/2019"
    	},
    	{
    		legis_bill_id: 1202259,
    		legis_session_id: 1611,
    		session_name: "86th Legislature Regular Session",
    		session_title: "86th Legislature",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/TX/bill/HB1742/2019",
    		state: "TX",
    		state_url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=86R&Bill=HB1742",
    		vetoed_date: "5/25/2019",
    		enrolled_date: "6/15/2019"
    	},
    	{
    		legis_bill_id: 1202336,
    		legis_session_id: 1611,
    		session_name: "86th Legislature Regular Session",
    		session_title: "86th Legislature",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/TX/bill/SB815/2019",
    		state: "TX",
    		state_url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=86R&Bill=SB815",
    		vetoed_date: "5/27/2019",
    		enrolled_date: "6/15/2019"
    	},
    	{
    		legis_bill_id: 1203430,
    		legis_session_id: 1611,
    		session_name: "86th Legislature Regular Session",
    		session_title: "86th Legislature",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/TX/bill/HB1771/2019",
    		state: "TX",
    		state_url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=86R&Bill=HB1771",
    		vetoed_date: "5/24/2019",
    		enrolled_date: "6/15/2019"
    	},
    	{
    		legis_bill_id: 1203790,
    		legis_session_id: 1611,
    		session_name: "86th Legislature Regular Session",
    		session_title: "86th Legislature",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/TX/bill/HB1806/2019",
    		state: "TX",
    		state_url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=86R&Bill=HB1806",
    		vetoed_date: "5/25/2019",
    		enrolled_date: "6/15/2019"
    	},
    	{
    		legis_bill_id: 1211590,
    		legis_session_id: 1611,
    		session_name: "86th Legislature Regular Session",
    		session_title: "86th Legislature",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/TX/bill/HB2112/2019",
    		state: "TX",
    		state_url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=86R&Bill=HB2112",
    		vetoed_date: "5/25/2019",
    		enrolled_date: "6/15/2019"
    	},
    	{
    		legis_bill_id: 1211933,
    		legis_session_id: 1611,
    		session_name: "86th Legislature Regular Session",
    		session_title: "86th Legislature",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/TX/bill/HB2111/2019",
    		state: "TX",
    		state_url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=86R&Bill=HB2111",
    		vetoed_date: "5/21/2019",
    		enrolled_date: "6/15/2019"
    	},
    	{
    		legis_bill_id: 1216276,
    		legis_session_id: 1611,
    		session_name: "86th Legislature Regular Session",
    		session_title: "86th Legislature",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/TX/bill/HB2348/2019",
    		state: "TX",
    		state_url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=86R&Bill=HB2348",
    		vetoed_date: "5/25/2019",
    		enrolled_date: "6/15/2019"
    	},
    	{
    		legis_bill_id: 1217651,
    		legis_session_id: 1611,
    		session_name: "86th Legislature Regular Session",
    		session_title: "86th Legislature",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/TX/bill/HB2481/2019",
    		state: "TX",
    		state_url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=86R&Bill=HB2481",
    		vetoed_date: "5/25/2019",
    		enrolled_date: "6/15/2019"
    	},
    	{
    		legis_bill_id: 1217780,
    		legis_session_id: 1611,
    		session_name: "86th Legislature Regular Session",
    		session_title: "86th Legislature",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/TX/bill/HB2475/2019",
    		state: "TX",
    		state_url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=86R&Bill=HB2475",
    		vetoed_date: "5/21/2019",
    		enrolled_date: "6/15/2019"
    	},
    	{
    		legis_bill_id: 1220244,
    		legis_session_id: 1611,
    		session_name: "86th Legislature Regular Session",
    		session_title: "86th Legislature",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/TX/bill/HCR86/2019",
    		state: "TX",
    		state_url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=86R&Bill=HCR86",
    		vetoed_date: "5/24/2019",
    		enrolled_date: "6/15/2019"
    	},
    	{
    		legis_bill_id: 1224693,
    		legis_session_id: 1611,
    		session_name: "86th Legislature Regular Session",
    		session_title: "86th Legislature",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/TX/bill/SB1319/2019",
    		state: "TX",
    		state_url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=86R&Bill=SB1319",
    		vetoed_date: "5/24/2019",
    		enrolled_date: "6/15/2019"
    	},
    	{
    		legis_bill_id: 1227730,
    		legis_session_id: 1611,
    		session_name: "86th Legislature Regular Session",
    		session_title: "86th Legislature",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/TX/bill/HB2856/2019",
    		state: "TX",
    		state_url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=86R&Bill=HB2856",
    		vetoed_date: "5/25/2019",
    		enrolled_date: "6/15/2019"
    	},
    	{
    		legis_bill_id: 1228667,
    		legis_session_id: 1611,
    		session_name: "86th Legislature Regular Session",
    		session_title: "86th Legislature",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/TX/bill/HB3022/2019",
    		state: "TX",
    		state_url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=86R&Bill=HB3022",
    		vetoed_date: "5/21/2019",
    		enrolled_date: "6/15/2019"
    	},
    	{
    		legis_bill_id: 1229523,
    		legis_session_id: 1611,
    		session_name: "86th Legislature Regular Session",
    		session_title: "86th Legislature",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/TX/bill/HB3078/2019",
    		state: "TX",
    		state_url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=86R&Bill=HB3078",
    		vetoed_date: "5/23/2019",
    		enrolled_date: "6/15/2019"
    	},
    	{
    		legis_bill_id: 1229543,
    		legis_session_id: 1611,
    		session_name: "86th Legislature Regular Session",
    		session_title: "86th Legislature",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/TX/bill/HB3082/2019",
    		state: "TX",
    		state_url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=86R&Bill=HB3082",
    		vetoed_date: "5/25/2019",
    		enrolled_date: "6/15/2019"
    	},
    	{
    		legis_bill_id: 1229883,
    		legis_session_id: 1611,
    		session_name: "86th Legislature Regular Session",
    		session_title: "86th Legislature",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/TX/bill/HB3195/2019",
    		state: "TX",
    		state_url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=86R&Bill=HB3195",
    		vetoed_date: "5/25/2019",
    		enrolled_date: "6/15/2019"
    	},
    	{
    		legis_bill_id: 1230659,
    		legis_session_id: 1611,
    		session_name: "86th Legislature Regular Session",
    		session_title: "86th Legislature",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/TX/bill/HB3252/2019",
    		state: "TX",
    		state_url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=86R&Bill=HB3252",
    		vetoed_date: "5/24/2019",
    		enrolled_date: "6/15/2019"
    	},
    	{
    		legis_bill_id: 1230805,
    		legis_session_id: 1611,
    		session_name: "86th Legislature Regular Session",
    		session_title: "86th Legislature",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/TX/bill/SB1575/2019",
    		state: "TX",
    		state_url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=86R&Bill=SB1575",
    		vetoed_date: "5/21/2019",
    		enrolled_date: "6/15/2019"
    	},
    	{
    		legis_bill_id: 1231571,
    		legis_session_id: 1611,
    		session_name: "86th Legislature Regular Session",
    		session_title: "86th Legislature",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/TX/bill/HB3490/2019",
    		state: "TX",
    		state_url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=86R&Bill=HB3490",
    		vetoed_date: "5/22/2019",
    		enrolled_date: "6/15/2019"
    	},
    	{
    		legis_bill_id: 1231841,
    		legis_session_id: 1611,
    		session_name: "86th Legislature Regular Session",
    		session_title: "86th Legislature",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/TX/bill/HB3511/2019",
    		state: "TX",
    		state_url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=86R&Bill=HB3511",
    		vetoed_date: "5/22/2019",
    		enrolled_date: "6/15/2019"
    	},
    	{
    		legis_bill_id: 1232686,
    		legis_session_id: 1611,
    		session_name: "86th Legislature Regular Session",
    		session_title: "86th Legislature",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/TX/bill/HB3648/2019",
    		state: "TX",
    		state_url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=86R&Bill=HB3648",
    		vetoed_date: "5/25/2019",
    		enrolled_date: "6/15/2019"
    	},
    	{
    		legis_bill_id: 1232698,
    		legis_session_id: 1611,
    		session_name: "86th Legislature Regular Session",
    		session_title: "86th Legislature",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/TX/bill/SB1861/2019",
    		state: "TX",
    		state_url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=86R&Bill=SB1861",
    		vetoed_date: "5/21/2019",
    		enrolled_date: "6/15/2019"
    	},
    	{
    		legis_bill_id: 1232714,
    		legis_session_id: 1611,
    		session_name: "86th Legislature Regular Session",
    		session_title: "86th Legislature",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/TX/bill/SB1793/2019",
    		state: "TX",
    		state_url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=86R&Bill=SB1793",
    		vetoed_date: "5/21/2019",
    		enrolled_date: "6/15/2019"
    	},
    	{
    		legis_bill_id: 1233534,
    		legis_session_id: 1611,
    		session_name: "86th Legislature Regular Session",
    		session_title: "86th Legislature",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/TX/bill/HB3910/2019",
    		state: "TX",
    		state_url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=86R&Bill=HB3910",
    		vetoed_date: "5/21/2019",
    		enrolled_date: "6/15/2019"
    	},
    	{
    		legis_bill_id: 1240814,
    		legis_session_id: 1611,
    		session_name: "86th Legislature Regular Session",
    		session_title: "86th Legislature",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/TX/bill/HCR133/2019",
    		state: "TX",
    		state_url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=86R&Bill=HCR133",
    		vetoed_date: "5/22/2019",
    		enrolled_date: "6/15/2019"
    	},
    	{
    		legis_bill_id: 1243640,
    		legis_session_id: 1611,
    		session_name: "86th Legislature Regular Session",
    		session_title: "86th Legislature",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/TX/bill/SB2456/2019",
    		state: "TX",
    		state_url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=86R&Bill=SB2456",
    		vetoed_date: "5/23/2019",
    		enrolled_date: "6/15/2019"
    	},
    	{
    		legis_bill_id: 1247344,
    		legis_session_id: 1611,
    		session_name: "86th Legislature Regular Session",
    		session_title: "86th Legislature",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/TX/bill/HB4703/2019",
    		state: "TX",
    		state_url: "https://capitol.texas.gov/BillLookup/History.aspx?LegSess=86R&Bill=HB4703",
    		vetoed_date: "5/25/2019",
    		enrolled_date: "6/15/2019"
    	},
    	{
    		legis_bill_id: 1164431,
    		legis_session_id: 1616,
    		session_name: "2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/MT/bill/HB262/2019",
    		state: "MT",
    		state_url: "https://laws.leg.mt.gov/legprd/LAW0210W$BSIV.ActionQuery?P_BILL_NO1=262&P_BLTP_BILL_TYP_CD=HB&Z_ACTION=Find&P_SESS=20191",
    		vetoed_date: "4/10/2019",
    		enrolled_date: "5/10/2019"
    	},
    	{
    		legis_bill_id: 1189548,
    		legis_session_id: 1616,
    		session_name: "2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/MT/bill/HB394/2019",
    		state: "MT",
    		state_url: "https://laws.leg.mt.gov/legprd/LAW0210W$BSIV.ActionQuery?P_BILL_NO1=394&P_BLTP_BILL_TYP_CD=HB&Z_ACTION=Find&P_SESS=20191",
    		vetoed_date: "4/5/2019",
    		enrolled_date: "5/10/2019"
    	},
    	{
    		legis_bill_id: 1203628,
    		legis_session_id: 1616,
    		session_name: "2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/MT/bill/HB482/2019",
    		state: "MT",
    		state_url: "https://laws.leg.mt.gov/legprd/LAW0210W$BSIV.ActionQuery?P_BILL_NO1=482&P_BLTP_BILL_TYP_CD=HB&Z_ACTION=Find&P_SESS=20191",
    		vetoed_date: "4/8/2019",
    		enrolled_date: "5/10/2019"
    	},
    	{
    		legis_bill_id: 1240510,
    		legis_session_id: 1648,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/PA/bill/HB800/2019",
    		state: "PA",
    		state_url: "https://www.legis.state.pa.us/cfdocs/billinfo/bill_history.cfm?syear=2019&sind=0&body=H&type=B&bn=800",
    		vetoed_date: "6/13/2019",
    		enrolled_date: "6/18/2019"
    	},
    	{
    		legis_bill_id: 1249963,
    		legis_session_id: 1637,
    		session_name: "191st General Court",
    		session_title: "191st General Court",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/MA/bill/H3684/2019",
    		state: "MA",
    		state_url: "https://malegislature.gov/Bills/191/H3684",
    		vetoed_date: "7/1/2019",
    		enrolled_date: "7/10/2019"
    	},
    	{
    		legis_bill_id: 1266937,
    		legis_session_id: 1658,
    		session_name: "116th Congress",
    		session_title: "116th Congress",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/US/bill/SJR38/2019",
    		state: "US",
    		state_url: "https://www.congress.gov/bill/116th-congress/senate-joint-resolution/38/all-info",
    		vetoed_date: "7/24/2019",
    		enrolled_date: "7/24/2019"
    	},
    	{
    		legis_bill_id: 1266972,
    		legis_session_id: 1658,
    		session_name: "116th Congress",
    		session_title: "116th Congress",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/US/bill/SJR37/2019",
    		state: "US",
    		state_url: "https://www.congress.gov/bill/116th-congress/senate-joint-resolution/37/all-info",
    		vetoed_date: "7/24/2019",
    		enrolled_date: "7/24/2019"
    	},
    	{
    		legis_bill_id: 1266992,
    		legis_session_id: 1658,
    		session_name: "116th Congress",
    		session_title: "116th Congress",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/US/bill/SJR36/2019",
    		state: "US",
    		state_url: "https://www.congress.gov/bill/116th-congress/senate-joint-resolution/36/all-info",
    		vetoed_date: "7/24/2019",
    		enrolled_date: "7/24/2019"
    	},
    	{
    		legis_bill_id: 1245562,
    		legis_session_id: 1645,
    		session_name: "2019-2020 Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NC/bill/S392/2019",
    		state: "NC",
    		state_url: "https://www.ncleg.gov/BillLookUp/2019/S392",
    		vetoed_date: "7/16/2019",
    		enrolled_date: "7/29/2019"
    	},
    	{
    		legis_bill_id: 1242192,
    		legis_session_id: 1645,
    		session_name: "2019-2020 Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NC/bill/S320/2019",
    		state: "NC",
    		state_url: "https://www.ncleg.gov/BillLookUp/2019/S320",
    		vetoed_date: "7/22/2019",
    		enrolled_date: "8/2/2019"
    	},
    	{
    		legis_bill_id: 1239165,
    		legis_session_id: 1645,
    		session_name: "2019-2020 Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NC/bill/H370/2019",
    		state: "NC",
    		state_url: "https://www.ncleg.gov/BillLookUp/2019/H370",
    		vetoed_date: "8/20/2019",
    		enrolled_date: "8/21/2019"
    	},
    	{
    		legis_bill_id: 1250347,
    		legis_session_id: 1645,
    		session_name: "2019-2020 Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NC/bill/H645/2019",
    		state: "NC",
    		state_url: "https://www.ncleg.gov/BillLookUp/2019/H645",
    		vetoed_date: "8/7/2019",
    		enrolled_date: "8/22/2019"
    	},
    	{
    		legis_bill_id: 1079885,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/S1364/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=S1364",
    		vetoed_date: "6/27/2019",
    		enrolled_date: "8/23/2019"
    	},
    	{
    		legis_bill_id: 1121931,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/A4135/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=A4135",
    		vetoed_date: "6/20/2019",
    		enrolled_date: "8/23/2019"
    	},
    	{
    		legis_bill_id: 1123662,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/S2804/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=S2804",
    		vetoed_date: "5/23/2019",
    		enrolled_date: "8/23/2019"
    	},
    	{
    		legis_bill_id: 1126967,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/AJR158/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=AJR158",
    		vetoed_date: "6/27/2019",
    		enrolled_date: "8/23/2019"
    	},
    	{
    		legis_bill_id: 1130894,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/S3205/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=S3205",
    		vetoed_date: "6/10/2019",
    		enrolled_date: "8/23/2019"
    	},
    	{
    		legis_bill_id: 1262338,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/A5363/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=A5363",
    		vetoed_date: "6/20/2019",
    		enrolled_date: "8/23/2019"
    	},
    	{
    		legis_bill_id: 1267796,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/S3901/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=S3901",
    		vetoed_date: "6/20/2019",
    		enrolled_date: "8/23/2019"
    	},
    	{
    		legis_bill_id: 1247349,
    		legis_session_id: 1645,
    		session_name: "2019-2020 Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NC/bill/S438/2019",
    		state: "NC",
    		state_url: "https://www.ncleg.gov/BillLookUp/2019/S438",
    		vetoed_date: "8/9/2019",
    		enrolled_date: "8/23/2019"
    	},
    	{
    		legis_bill_id: 1260625,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/S3661/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=S3661",
    		vetoed_date: "6/20/2019",
    		enrolled_date: "8/23/2019"
    	},
    	{
    		legis_bill_id: 1196365,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB412/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB412",
    		vetoed_date: "8/30/2019",
    		enrolled_date: "9/9/2019"
    	},
    	{
    		legis_bill_id: 1208060,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB618/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB618",
    		vetoed_date: "7/1/2019",
    		enrolled_date: "7/12/2019"
    	},
    	{
    		legis_bill_id: 1205398,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB603/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB603",
    		vetoed_date: "6/27/2019",
    		enrolled_date: "7/12/2019"
    	},
    	{
    		legis_bill_id: 1214518,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB1221/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB1221",
    		vetoed_date: "7/8/2019",
    		enrolled_date: "7/30/2019"
    	},
    	{
    		legis_bill_id: 1241033,
    		legis_session_id: 1648,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/PA/bill/HB915/2019",
    		state: "PA",
    		state_url: "https://www.legis.state.pa.us/cfdocs/billinfo/bill_history.cfm?syear=2019&sind=0&body=H&type=B&bn=915",
    		vetoed_date: "6/27/2019",
    		enrolled_date: "7/2/2019"
    	},
    	{
    		legis_bill_id: 1148269,
    		legis_session_id: 1648,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/PA/bill/SB48/2019",
    		state: "PA",
    		state_url: "https://www.legis.state.pa.us/cfdocs/billinfo/bill_history.cfm?syear=2019&sind=0&body=S&type=B&bn=48",
    		vetoed_date: "6/27/2019",
    		enrolled_date: "7/5/2019"
    	},
    	{
    		legis_bill_id: 1271809,
    		legis_session_id: 1637,
    		session_name: "191st General Court",
    		session_title: "191st General Court",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/MA/bill/H4000/2019",
    		state: "MA",
    		state_url: "https://malegislature.gov/Bills/191/H4000",
    		vetoed_date: "7/31/2019",
    		enrolled_date: ""
    	},
    	{
    		legis_bill_id: 1274153,
    		legis_session_id: 1658,
    		session_name: "116th Congress",
    		session_title: "116th Congress",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/US/bill/SJR54/2019",
    		state: "US",
    		state_url: "https://www.congress.gov/bill/116th-congress/senate-joint-resolution/54/all-info",
    		vetoed_date: "10/4/2019",
    		enrolled_date: "10/15/2019"
    	},
    	{
    		legis_bill_id: 1247721,
    		legis_session_id: 1645,
    		session_name: "2019-2020 Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NC/bill/H555/2019",
    		state: "NC",
    		state_url: "https://www.ncleg.gov/BillLookUp/2019/H555",
    		vetoed_date: "8/29/2019",
    		enrolled_date: "8/30/2019"
    	},
    	{
    		legis_bill_id: 1205798,
    		legis_session_id: 1630,
    		session_name: "101st General Assembly",
    		session_title: "101st General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/IL/bill/HB3222/2019",
    		state: "IL",
    		state_url: "https://www.ilga.gov/legislation/BillStatus.asp?DocNum=3222&GAID=15&DocTypeID=HB&SessionID=108&GA=101",
    		vetoed_date: "6/1/2019",
    		enrolled_date: "8/23/2019"
    	},
    	{
    		legis_bill_id: 1139757,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S00644/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S644",
    		vetoed_date: "10/28/2019",
    		enrolled_date: "11/8/2019"
    	},
    	{
    		legis_bill_id: 1153362,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A01605/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A1605",
    		vetoed_date: "10/28/2019",
    		enrolled_date: "11/8/2019"
    	},
    	{
    		legis_bill_id: 1157549,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S01876/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S1876",
    		vetoed_date: "10/28/2019",
    		enrolled_date: "11/8/2019"
    	},
    	{
    		legis_bill_id: 1183144,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S02977/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S2977",
    		vetoed_date: "10/28/2019",
    		enrolled_date: "11/8/2019"
    	},
    	{
    		legis_bill_id: 1183158,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S02976/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S2976",
    		vetoed_date: "10/28/2019",
    		enrolled_date: "11/8/2019"
    	},
    	{
    		legis_bill_id: 1189849,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A04771/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A4771",
    		vetoed_date: "10/28/2019",
    		enrolled_date: "11/8/2019"
    	},
    	{
    		legis_bill_id: 1190115,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A04944/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A4944",
    		vetoed_date: "10/28/2019",
    		enrolled_date: "11/8/2019"
    	},
    	{
    		legis_bill_id: 1199978,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A05442/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A5442",
    		vetoed_date: "10/28/2019",
    		enrolled_date: "11/8/2019"
    	},
    	{
    		legis_bill_id: 1228826,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A06240/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A6240",
    		vetoed_date: "10/28/2019",
    		enrolled_date: "11/8/2019"
    	},
    	{
    		legis_bill_id: 1231219,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A06331/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A6331",
    		vetoed_date: "10/28/2019",
    		enrolled_date: "11/8/2019"
    	},
    	{
    		legis_bill_id: 1233675,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S04333/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S4333",
    		vetoed_date: "10/28/2019",
    		enrolled_date: "11/8/2019"
    	},
    	{
    		legis_bill_id: 1241387,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A06773/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A6773",
    		vetoed_date: "10/28/2019",
    		enrolled_date: "11/8/2019"
    	},
    	{
    		legis_bill_id: 1247843,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S04949/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S4949",
    		vetoed_date: "10/28/2019",
    		enrolled_date: "11/8/2019"
    	},
    	{
    		legis_bill_id: 1250953,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A07129/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A7129",
    		vetoed_date: "10/28/2019",
    		enrolled_date: "11/8/2019"
    	},
    	{
    		legis_bill_id: 1251446,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S05139/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S5139",
    		vetoed_date: "10/28/2019",
    		enrolled_date: "11/8/2019"
    	},
    	{
    		legis_bill_id: 1251570,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S05152/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S5152",
    		vetoed_date: "10/28/2019",
    		enrolled_date: "11/8/2019"
    	},
    	{
    		legis_bill_id: 1252040,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A07228/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A7228",
    		vetoed_date: "10/28/2019",
    		enrolled_date: "11/8/2019"
    	},
    	{
    		legis_bill_id: 1261215,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S05794/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S5794",
    		vetoed_date: "10/28/2019",
    		enrolled_date: "11/8/2019"
    	},
    	{
    		legis_bill_id: 1263766,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S06201/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S6201",
    		vetoed_date: "10/28/2019",
    		enrolled_date: "11/8/2019"
    	},
    	{
    		legis_bill_id: 1264234,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A07829/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A7829",
    		vetoed_date: "10/28/2019",
    		enrolled_date: "11/8/2019"
    	},
    	{
    		legis_bill_id: 1267120,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S06365/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S6365",
    		vetoed_date: "10/28/2019",
    		enrolled_date: "11/8/2019"
    	},
    	{
    		legis_bill_id: 1268258,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A08293/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A8293",
    		vetoed_date: "10/28/2019",
    		enrolled_date: "11/8/2019"
    	},
    	{
    		legis_bill_id: 1223065,
    		legis_session_id: 1645,
    		session_name: "2019-2020 Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NC/bill/H231/2019",
    		state: "NC",
    		state_url: "https://www.ncleg.gov/BillLookUp/2019/H231",
    		vetoed_date: "10/30/2019",
    		enrolled_date: "11/8/2019"
    	},
    	{
    		legis_bill_id: 1238608,
    		legis_session_id: 1645,
    		session_name: "2019-2020 Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NC/bill/S250/2019",
    		state: "NC",
    		state_url: "https://www.ncleg.gov/BillLookUp/2019/S250",
    		vetoed_date: "10/30/2019",
    		enrolled_date: "11/6/2019"
    	},
    	{
    		legis_bill_id: 1241762,
    		legis_session_id: 1645,
    		session_name: "2019-2020 Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NC/bill/H398/2019",
    		state: "NC",
    		state_url: "https://www.ncleg.gov/BillLookUp/2019/H398",
    		vetoed_date: "10/30/2019",
    		enrolled_date: "11/8/2019"
    	},
    	{
    		legis_bill_id: 1248224,
    		legis_session_id: 1645,
    		session_name: "2019-2020 Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NC/bill/S578/2019",
    		state: "NC",
    		state_url: "https://www.ncleg.gov/BillLookUp/2019/S578",
    		vetoed_date: "10/31/2019",
    		enrolled_date: "11/8/2019"
    	},
    	{
    		legis_bill_id: 1138258,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S00025/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S25",
    		vetoed_date: "11/8/2019",
    		enrolled_date: "11/20/2019"
    	},
    	{
    		legis_bill_id: 1138357,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S00181/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S181",
    		vetoed_date: "11/8/2019",
    		enrolled_date: "11/20/2019"
    	},
    	{
    		legis_bill_id: 1142178,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S00870/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S870",
    		vetoed_date: "11/8/2019",
    		enrolled_date: "11/20/2019"
    	},
    	{
    		legis_bill_id: 1142627,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A00648/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A648",
    		vetoed_date: "11/8/2019",
    		enrolled_date: "11/20/2019"
    	},
    	{
    		legis_bill_id: 1149921,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A01034/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A1034",
    		vetoed_date: "11/8/2019",
    		enrolled_date: "11/20/2019"
    	},
    	{
    		legis_bill_id: 1152734,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S01673/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S1673",
    		vetoed_date: "11/8/2019",
    		enrolled_date: "11/20/2019"
    	},
    	{
    		legis_bill_id: 1157926,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A01779/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A1779",
    		vetoed_date: "11/8/2019",
    		enrolled_date: "11/20/2019"
    	},
    	{
    		legis_bill_id: 1164901,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A02050/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A2050",
    		vetoed_date: "11/8/2019",
    		enrolled_date: "11/20/2019"
    	},
    	{
    		legis_bill_id: 1169586,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A02493/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A2493",
    		vetoed_date: "11/8/2019",
    		enrolled_date: "11/20/2019"
    	},
    	{
    		legis_bill_id: 1171586,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S02424/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S2424",
    		vetoed_date: "11/8/2019",
    		enrolled_date: "11/20/2019"
    	},
    	{
    		legis_bill_id: 1184137,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A04055/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A4055",
    		vetoed_date: "11/8/2019",
    		enrolled_date: "11/20/2019"
    	},
    	{
    		legis_bill_id: 1185154,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A04071/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A4071",
    		vetoed_date: "11/8/2019",
    		enrolled_date: "11/20/2019"
    	},
    	{
    		legis_bill_id: 1187053,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A04406/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A4406",
    		vetoed_date: "11/8/2019",
    		enrolled_date: "11/20/2019"
    	},
    	{
    		legis_bill_id: 1189831,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A04880/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A4880",
    		vetoed_date: "11/8/2019",
    		enrolled_date: "11/20/2019"
    	},
    	{
    		legis_bill_id: 1193135,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S03421/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S3421",
    		vetoed_date: "11/8/2019",
    		enrolled_date: "11/20/2019"
    	},
    	{
    		legis_bill_id: 1211573,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A05949/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A5949",
    		vetoed_date: "11/8/2019",
    		enrolled_date: "11/20/2019"
    	},
    	{
    		legis_bill_id: 1218714,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A05990/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A5990",
    		vetoed_date: "11/8/2019",
    		enrolled_date: "11/20/2019"
    	},
    	{
    		legis_bill_id: 1218731,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S04048/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S4048",
    		vetoed_date: "11/8/2019",
    		enrolled_date: "11/20/2019"
    	},
    	{
    		legis_bill_id: 1228614,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S04183/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S4183",
    		vetoed_date: "11/8/2019",
    		enrolled_date: "11/20/2019"
    	},
    	{
    		legis_bill_id: 1236635,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S04398/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S4398",
    		vetoed_date: "11/8/2019",
    		enrolled_date: "11/20/2019"
    	},
    	{
    		legis_bill_id: 1237126,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S04449/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S4449",
    		vetoed_date: "11/8/2019",
    		enrolled_date: "11/20/2019"
    	},
    	{
    		legis_bill_id: 1256817,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A07475/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A7475",
    		vetoed_date: "11/8/2019",
    		enrolled_date: "11/20/2019"
    	},
    	{
    		legis_bill_id: 1256844,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S05545/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S5545",
    		vetoed_date: "11/8/2019",
    		enrolled_date: "11/20/2019"
    	},
    	{
    		legis_bill_id: 1256934,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S05547/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S5547",
    		vetoed_date: "11/8/2019",
    		enrolled_date: "11/20/2019"
    	},
    	{
    		legis_bill_id: 1257058,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A07492/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A7492",
    		vetoed_date: "11/8/2019",
    		enrolled_date: "11/20/2019"
    	},
    	{
    		legis_bill_id: 1260619,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S05741/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S5741",
    		vetoed_date: "11/8/2019",
    		enrolled_date: "11/20/2019"
    	},
    	{
    		legis_bill_id: 1261788,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S05960/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S5960",
    		vetoed_date: "11/19/2019",
    		enrolled_date: "11/20/2019"
    	},
    	{
    		legis_bill_id: 1265486,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A08014/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A8014",
    		vetoed_date: "11/8/2019",
    		enrolled_date: "11/20/2019"
    	},
    	{
    		legis_bill_id: 1266236,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A08104/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A8104",
    		vetoed_date: "11/19/2019",
    		enrolled_date: "11/20/2019"
    	},
    	{
    		legis_bill_id: 1268383,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S06486/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S6486",
    		vetoed_date: "11/8/2019",
    		enrolled_date: "11/20/2019"
    	},
    	{
    		legis_bill_id: 1138072,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S00232/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S232",
    		vetoed_date: "11/19/2019",
    		enrolled_date: "11/25/2019"
    	},
    	{
    		legis_bill_id: 1139248,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A00473/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A473",
    		vetoed_date: "11/19/2019",
    		enrolled_date: "11/25/2019"
    	},
    	{
    		legis_bill_id: 1145976,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S01087/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S1087",
    		vetoed_date: "11/19/2019",
    		enrolled_date: "11/25/2019"
    	},
    	{
    		legis_bill_id: 1146648,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S01073/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S1073",
    		vetoed_date: "11/19/2019",
    		enrolled_date: "11/25/2019"
    	},
    	{
    		legis_bill_id: 1149794,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A01130/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A1130",
    		vetoed_date: "11/19/2019",
    		enrolled_date: "11/25/2019"
    	},
    	{
    		legis_bill_id: 1150255,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A01235/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A1235",
    		vetoed_date: "11/19/2019",
    		enrolled_date: "11/25/2019"
    	},
    	{
    		legis_bill_id: 1152923,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A01483/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A1483",
    		vetoed_date: "11/19/2019",
    		enrolled_date: "11/25/2019"
    	},
    	{
    		legis_bill_id: 1153360,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A01599/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A1599",
    		vetoed_date: "11/19/2019",
    		enrolled_date: "11/25/2019"
    	},
    	{
    		legis_bill_id: 1154838,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S01803/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S1803",
    		vetoed_date: "11/19/2019",
    		enrolled_date: "11/25/2019"
    	},
    	{
    		legis_bill_id: 1155053,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S01813/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S1813",
    		vetoed_date: "11/19/2019",
    		enrolled_date: "11/25/2019"
    	},
    	{
    		legis_bill_id: 1161819,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S01978/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S1978",
    		vetoed_date: "11/19/2019",
    		enrolled_date: "11/25/2019"
    	},
    	{
    		legis_bill_id: 1165552,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S02100/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S2100",
    		vetoed_date: "11/19/2019",
    		enrolled_date: "11/25/2019"
    	},
    	{
    		legis_bill_id: 1176740,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A02946/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A2946",
    		vetoed_date: "11/19/2019",
    		enrolled_date: "11/25/2019"
    	},
    	{
    		legis_bill_id: 1177232,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A03199/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A3199",
    		vetoed_date: "11/19/2019",
    		enrolled_date: "11/25/2019"
    	},
    	{
    		legis_bill_id: 1179102,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A03477/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A3477",
    		vetoed_date: "11/19/2019",
    		enrolled_date: "11/25/2019"
    	},
    	{
    		legis_bill_id: 1183185,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S02975/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S2975",
    		vetoed_date: "11/19/2019",
    		enrolled_date: "11/25/2019"
    	},
    	{
    		legis_bill_id: 1183454,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A03918/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A3918",
    		vetoed_date: "11/19/2019",
    		enrolled_date: "11/25/2019"
    	},
    	{
    		legis_bill_id: 1186235,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A04256/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A4256",
    		vetoed_date: "11/19/2019",
    		enrolled_date: "11/25/2019"
    	},
    	{
    		legis_bill_id: 1187946,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A04623/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A4623",
    		vetoed_date: "11/19/2019",
    		enrolled_date: "11/25/2019"
    	},
    	{
    		legis_bill_id: 1205928,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S03807/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S3807",
    		vetoed_date: "11/19/2019",
    		enrolled_date: "11/25/2019"
    	},
    	{
    		legis_bill_id: 1211640,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A05922/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A5922",
    		vetoed_date: "11/19/2019",
    		enrolled_date: "11/25/2019"
    	},
    	{
    		legis_bill_id: 1230004,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A06306/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A6306",
    		vetoed_date: "11/19/2019",
    		enrolled_date: "11/25/2019"
    	},
    	{
    		legis_bill_id: 1233118,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A06413/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A6413",
    		vetoed_date: "11/19/2019",
    		enrolled_date: "11/25/2019"
    	},
    	{
    		legis_bill_id: 1236698,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S04365/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S4365",
    		vetoed_date: "11/19/2019",
    		enrolled_date: "11/25/2019"
    	},
    	{
    		legis_bill_id: 1238317,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S04492/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S4492",
    		vetoed_date: "11/19/2019",
    		enrolled_date: "11/25/2019"
    	},
    	{
    		legis_bill_id: 1239778,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S04575/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S4575",
    		vetoed_date: "11/19/2019",
    		enrolled_date: "11/25/2019"
    	},
    	{
    		legis_bill_id: 1240043,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S04587/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S4587",
    		vetoed_date: "11/19/2019",
    		enrolled_date: "11/25/2019"
    	},
    	{
    		legis_bill_id: 1244618,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S04809/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S4809",
    		vetoed_date: "11/19/2019",
    		enrolled_date: "11/25/2019"
    	},
    	{
    		legis_bill_id: 1251824,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A07206/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A7206",
    		vetoed_date: "11/19/2019",
    		enrolled_date: "11/25/2019"
    	},
    	{
    		legis_bill_id: 1254998,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A07373/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A7373",
    		vetoed_date: "11/19/2019",
    		enrolled_date: "11/25/2019"
    	},
    	{
    		legis_bill_id: 1255296,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S05422/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S5422",
    		vetoed_date: "11/19/2019",
    		enrolled_date: "11/25/2019"
    	},
    	{
    		legis_bill_id: 1256637,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A07441/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A7441",
    		vetoed_date: "11/19/2019",
    		enrolled_date: "11/25/2019"
    	},
    	{
    		legis_bill_id: 1256686,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S05522/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S5522",
    		vetoed_date: "11/19/2019",
    		enrolled_date: "11/25/2019"
    	},
    	{
    		legis_bill_id: 1257905,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S05640/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S5640",
    		vetoed_date: "11/19/2019",
    		enrolled_date: "11/25/2019"
    	},
    	{
    		legis_bill_id: 1260237,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A07592/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A7592",
    		vetoed_date: "11/19/2019",
    		enrolled_date: "11/25/2019"
    	},
    	{
    		legis_bill_id: 1261029,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S05773/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S5773",
    		vetoed_date: "11/19/2019",
    		enrolled_date: "11/25/2019"
    	},
    	{
    		legis_bill_id: 1261334,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S05849/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S5849",
    		vetoed_date: "11/19/2019",
    		enrolled_date: "11/25/2019"
    	},
    	{
    		legis_bill_id: 1263976,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S06206/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S6206",
    		vetoed_date: "11/19/2019",
    		enrolled_date: "11/25/2019"
    	},
    	{
    		legis_bill_id: 1265505,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A07996/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A7996",
    		vetoed_date: "11/19/2019",
    		enrolled_date: "11/25/2019"
    	},
    	{
    		legis_bill_id: 1267340,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A08193/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A8193",
    		vetoed_date: "11/19/2019",
    		enrolled_date: "11/25/2019"
    	},
    	{
    		legis_bill_id: 1138413,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S00031/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S31",
    		vetoed_date: "11/26/2019",
    		enrolled_date: "12/6/2019"
    	},
    	{
    		legis_bill_id: 1138721,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A00215/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A215",
    		vetoed_date: "11/26/2019",
    		enrolled_date: "12/6/2019"
    	},
    	{
    		legis_bill_id: 1143086,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A00677/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A677",
    		vetoed_date: "11/26/2019",
    		enrolled_date: "12/6/2019"
    	},
    	{
    		legis_bill_id: 1143180,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A00670/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A670",
    		vetoed_date: "11/26/2019",
    		enrolled_date: "12/6/2019"
    	},
    	{
    		legis_bill_id: 1159025,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A01851/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A1851",
    		vetoed_date: "11/26/2019",
    		enrolled_date: "12/6/2019"
    	},
    	{
    		legis_bill_id: 1165218,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A02037/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A2037",
    		vetoed_date: "11/26/2019",
    		enrolled_date: "12/6/2019"
    	},
    	{
    		legis_bill_id: 1166976,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A02404/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A2404",
    		vetoed_date: "11/26/2019",
    		enrolled_date: "12/6/2019"
    	},
    	{
    		legis_bill_id: 1174001,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S02497/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S2497",
    		vetoed_date: "11/26/2019",
    		enrolled_date: "12/6/2019"
    	},
    	{
    		legis_bill_id: 1182997,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S02978/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S2978",
    		vetoed_date: "11/26/2019",
    		enrolled_date: "12/6/2019"
    	},
    	{
    		legis_bill_id: 1186015,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A04236/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A4236",
    		vetoed_date: "11/26/2019",
    		enrolled_date: "12/6/2019"
    	},
    	{
    		legis_bill_id: 1187591,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A04417/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A4417",
    		vetoed_date: "11/26/2019",
    		enrolled_date: "12/6/2019"
    	},
    	{
    		legis_bill_id: 1187825,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S03221/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S3221",
    		vetoed_date: "11/26/2019",
    		enrolled_date: "12/6/2019"
    	},
    	{
    		legis_bill_id: 1195693,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A05176/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A5176",
    		vetoed_date: "11/26/2019",
    		enrolled_date: "12/6/2019"
    	},
    	{
    		legis_bill_id: 1198977,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S03639/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S3639",
    		vetoed_date: "11/26/2019",
    		enrolled_date: "12/6/2019"
    	},
    	{
    		legis_bill_id: 1200101,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S03662/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S3662",
    		vetoed_date: "11/26/2019",
    		enrolled_date: "12/6/2019"
    	},
    	{
    		legis_bill_id: 1203583,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A05625/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A5625",
    		vetoed_date: "11/26/2019",
    		enrolled_date: "12/6/2019"
    	},
    	{
    		legis_bill_id: 1215027,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S03987/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S3987",
    		vetoed_date: "11/26/2019",
    		enrolled_date: "12/6/2019"
    	},
    	{
    		legis_bill_id: 1234868,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A06489/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A6489",
    		vetoed_date: "11/26/2019",
    		enrolled_date: "12/6/2019"
    	},
    	{
    		legis_bill_id: 1237873,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A06599/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A6599",
    		vetoed_date: "11/26/2019",
    		enrolled_date: "12/6/2019"
    	},
    	{
    		legis_bill_id: 1241103,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S04641/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S4641",
    		vetoed_date: "11/26/2019",
    		enrolled_date: "12/6/2019"
    	},
    	{
    		legis_bill_id: 1241259,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S04653/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S4653",
    		vetoed_date: "11/26/2019",
    		enrolled_date: "12/6/2019"
    	},
    	{
    		legis_bill_id: 1249363,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A07062/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A7062",
    		vetoed_date: "11/26/2019",
    		enrolled_date: "12/6/2019"
    	},
    	{
    		legis_bill_id: 1254927,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S05387/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S5387",
    		vetoed_date: "11/26/2019",
    		enrolled_date: "12/6/2019"
    	},
    	{
    		legis_bill_id: 1255253,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S05425/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S5425",
    		vetoed_date: "11/26/2019",
    		enrolled_date: "12/6/2019"
    	},
    	{
    		legis_bill_id: 1256215,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S05485/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S5485",
    		vetoed_date: "11/26/2019",
    		enrolled_date: "12/6/2019"
    	},
    	{
    		legis_bill_id: 1257042,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A07489/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A7489",
    		vetoed_date: "11/26/2019",
    		enrolled_date: "12/6/2019"
    	},
    	{
    		legis_bill_id: 1257557,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S05605/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S5605",
    		vetoed_date: "11/26/2019",
    		enrolled_date: "12/6/2019"
    	},
    	{
    		legis_bill_id: 1257893,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A07559/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A7559",
    		vetoed_date: "11/26/2019",
    		enrolled_date: "12/6/2019"
    	},
    	{
    		legis_bill_id: 1257946,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A07578/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A7578",
    		vetoed_date: "11/26/2019",
    		enrolled_date: "12/6/2019"
    	},
    	{
    		legis_bill_id: 1257984,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S05637/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S5637",
    		vetoed_date: "11/26/2019",
    		enrolled_date: "12/6/2019"
    	},
    	{
    		legis_bill_id: 1260698,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A07611/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A7611",
    		vetoed_date: "11/26/2019",
    		enrolled_date: "12/6/2019"
    	},
    	{
    		legis_bill_id: 1260937,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A07664/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A7664",
    		vetoed_date: "11/26/2019",
    		enrolled_date: "12/6/2019"
    	},
    	{
    		legis_bill_id: 1261482,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S05863/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S5863",
    		vetoed_date: "11/26/2019",
    		enrolled_date: "12/6/2019"
    	},
    	{
    		legis_bill_id: 1261676,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S05918/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S5918",
    		vetoed_date: "11/26/2019",
    		enrolled_date: "12/6/2019"
    	},
    	{
    		legis_bill_id: 1261818,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S05941/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S5941",
    		vetoed_date: "11/26/2019",
    		enrolled_date: "12/6/2019"
    	},
    	{
    		legis_bill_id: 1261875,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S05985/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S5985",
    		vetoed_date: "11/26/2019",
    		enrolled_date: "12/6/2019"
    	},
    	{
    		legis_bill_id: 1262023,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S06041/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S6041",
    		vetoed_date: "11/26/2019",
    		enrolled_date: "12/6/2019"
    	},
    	{
    		legis_bill_id: 1262099,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S06042/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S6042",
    		vetoed_date: "11/26/2019",
    		enrolled_date: "12/6/2019"
    	},
    	{
    		legis_bill_id: 1264124,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A07804/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A7804",
    		vetoed_date: "11/26/2019",
    		enrolled_date: "12/6/2019"
    	},
    	{
    		legis_bill_id: 1264333,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S06212/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S6212",
    		vetoed_date: "11/26/2019",
    		enrolled_date: "12/6/2019"
    	},
    	{
    		legis_bill_id: 1264720,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A07854/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A7854",
    		vetoed_date: "11/26/2019",
    		enrolled_date: "12/6/2019"
    	},
    	{
    		legis_bill_id: 1265039,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A07924/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A7924",
    		vetoed_date: "11/26/2019",
    		enrolled_date: "12/6/2019"
    	},
    	{
    		legis_bill_id: 1265055,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A07929/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A7929",
    		vetoed_date: "11/26/2019",
    		enrolled_date: "12/6/2019"
    	},
    	{
    		legis_bill_id: 1266683,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S06321/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S6321",
    		vetoed_date: "11/26/2019",
    		enrolled_date: "12/6/2019"
    	},
    	{
    		legis_bill_id: 1268218,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A08303/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A8303",
    		vetoed_date: "11/26/2019",
    		enrolled_date: "12/6/2019"
    	},
    	{
    		legis_bill_id: 1268916,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S06554/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S6554",
    		vetoed_date: "11/26/2019",
    		enrolled_date: "12/6/2019"
    	},
    	{
    		legis_bill_id: 1167309,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A02477/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A2477",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/10/2019"
    	},
    	{
    		legis_bill_id: 1254779,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S05343/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S5343",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/10/2019"
    	},
    	{
    		legis_bill_id: 1138257,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S00245/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S245",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1138748,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S00023/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S23",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1138804,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S00494/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S494",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1139167,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A00364/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A364",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1139673,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A00435/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A435",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1139683,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A00290/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A290",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1139760,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A00580/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A580",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1141467,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S00726/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S726",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1152317,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S01577/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S1577",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1152733,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S01674/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S1674",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1152842,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A01460/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A1460",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1154081,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S01720/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S1720",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1157687,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S01873/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S1873",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1164833,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A02040/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A2040",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1165043,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S02070/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S2070",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1165424,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A02363/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A2363",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1165946,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A02315/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A2315",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1166843,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A02455/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A2455",
    		vetoed_date: "12/10/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1168320,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S02198/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S2198",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1171357,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S02394/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S2394",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1171696,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A02632/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A2632",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1174210,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A02698/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A2698",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1178800,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S02785/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S2785",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1179653,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A03552/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A3552",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1186726,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A04294/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A4294",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1187091,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S03125/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S3125",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1189531,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A04737/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A4737",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1190631,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S03344/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S3344",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1197864,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A05254/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A5254",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1198538,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A05342/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A5342",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1199136,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A05386/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A5386",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1199751,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A05425/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A5425",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1199834,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A05459/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A5459",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1200052,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S03686/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S3686",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1207970,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S03829/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S3829",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1209714,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S03840/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S3840",
    		vetoed_date: "12/10/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1212921,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S03918/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S3918",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1213610,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S03951/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S3951",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1219320,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A06007/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A6007",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1225420,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A06157/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A6157",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1225576,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S04118/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S4118",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1230621,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S04269/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S4269",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1233046,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S04308/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S4308",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1237598,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S04467/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S4467",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1240704,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A06740/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A6740",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1242557,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S04699/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S4699",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1242727,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A06832/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A6832",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1247724,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A06980/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A6980",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1251758,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A07202/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A7202",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1251829,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A07199/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A7199",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1252316,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S05202/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S5202",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1253027,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A07248/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A7248",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1253049,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A07261/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A7261",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1253808,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S05291/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S5291",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1254363,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S05315/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S5315",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1255718,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S05430/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S5430",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1256007,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A07414/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A7414",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1257221,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S05582/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S5582",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1257937,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A07574/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A7574",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1260099,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A07587/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A7587",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1260232,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S05690/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S5690",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1260315,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S05716/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S5716",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1260631,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S05737/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S5737",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1260639,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A07644/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A7644",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1261445,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S05855/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S5855",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1261833,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S05933/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S5933",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1261934,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S06048/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S6048",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1261964,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S06113/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S6113",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1261993,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A07710/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A7710",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1264797,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A07835/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A7835",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1265283,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A07941/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A7941",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1265294,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A07940/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A7940",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1265484,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A08007/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A8007",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1265985,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A08060/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A8060",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1267354,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S06382/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S6382",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1267568,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S06427/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S6427",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1267802,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A08276/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A8276",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1267894,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A08261/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A8261",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1268097,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S06472/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S6472",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1268804,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S06535/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S6535",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1268812,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A08347/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A8347",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1268824,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S06553/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S6553",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/13/2019"
    	},
    	{
    		legis_bill_id: 1187635,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A04538/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A4538",
    		vetoed_date: "12/10/2019",
    		enrolled_date: "12/16/2019"
    	},
    	{
    		legis_bill_id: 1243343,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S04724/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S4724",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/16/2019"
    	},
    	{
    		legis_bill_id: 1243405,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S04725/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S4725",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/16/2019"
    	},
    	{
    		legis_bill_id: 1246919,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A06977/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A6977",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/16/2019"
    	},
    	{
    		legis_bill_id: 1248472,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A06998/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A6998",
    		vetoed_date: "12/6/2019",
    		enrolled_date: "12/16/2019"
    	},
    	{
    		legis_bill_id: 1255212,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S05410/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S5410",
    		vetoed_date: "12/10/2019",
    		enrolled_date: "12/16/2019"
    	},
    	{
    		legis_bill_id: 1288209,
    		legis_session_id: 1637,
    		session_name: "191st General Court",
    		session_title: "191st General Court",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/MA/bill/H4246/2019",
    		state: "MA",
    		state_url: "https://malegislature.gov/Bills/191/H4246",
    		vetoed_date: "12/13/2019",
    		enrolled_date: ""
    	},
    	{
    		legis_bill_id: 1251861,
    		legis_session_id: 1648,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/PA/bill/HB321/2019",
    		state: "PA",
    		state_url: "https://www.legis.state.pa.us/cfdocs/billinfo/bill_history.cfm?syear=2019&sind=0&body=H&type=B&bn=321",
    		vetoed_date: "11/21/2019",
    		enrolled_date: "11/21/2019"
    	},
    	{
    		legis_bill_id: 1139293,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A00568/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A568",
    		vetoed_date: "12/10/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1149946,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A00976/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A976",
    		vetoed_date: "12/10/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1150500,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A01283/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A1283",
    		vetoed_date: "12/10/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1152608,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S01634/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S1634",
    		vetoed_date: "12/17/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1154893,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S01810/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S1810",
    		vetoed_date: "12/10/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1155143,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A01619/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A1619",
    		vetoed_date: "12/10/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1155345,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S01817/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S1817",
    		vetoed_date: "12/10/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1155354,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S01820/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S1820",
    		vetoed_date: "12/10/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1165636,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A02257/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A2257",
    		vetoed_date: "12/17/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1165745,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A02284/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A2284",
    		vetoed_date: "12/20/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1166168,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A02199/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A2199",
    		vetoed_date: "12/10/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1166310,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A02326/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A2326",
    		vetoed_date: "12/20/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1166952,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A02372/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A2372",
    		vetoed_date: "12/17/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1174767,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A02785/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A2785",
    		vetoed_date: "12/10/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1175959,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A03059/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A3059",
    		vetoed_date: "12/10/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1176133,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S02622/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S2622",
    		vetoed_date: "12/17/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1176393,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A02947/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A2947",
    		vetoed_date: "12/10/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1176505,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S02682/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S2682",
    		vetoed_date: "12/17/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1176680,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A02853/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A2853",
    		vetoed_date: "12/17/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1178289,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S02769/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S2769",
    		vetoed_date: "12/10/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1180435,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S02854/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S2854",
    		vetoed_date: "12/10/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1183059,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A03839/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A3839",
    		vetoed_date: "12/10/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1186787,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S03118/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S3118",
    		vetoed_date: "12/10/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1186926,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S03101/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S3101",
    		vetoed_date: "12/10/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1187443,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A04431/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A4431",
    		vetoed_date: "12/20/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1187495,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S03158/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S3158",
    		vetoed_date: "12/10/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1187571,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A04436/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A4436",
    		vetoed_date: "12/17/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1187836,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A04432/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A4432",
    		vetoed_date: "12/17/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1189971,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S03291/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S3291",
    		vetoed_date: "12/20/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1190033,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A04941/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A4941",
    		vetoed_date: "12/17/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1192923,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A05006/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A5006",
    		vetoed_date: "12/20/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1193571,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A05021/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A5021",
    		vetoed_date: "12/20/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1194397,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S03435/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S3435",
    		vetoed_date: "12/17/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1195204,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S03465/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S3465",
    		vetoed_date: "12/10/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1197978,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A05301/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A5301",
    		vetoed_date: "12/20/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1198039,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A05324/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A5324",
    		vetoed_date: "12/20/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1199422,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S03659/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S3659",
    		vetoed_date: "12/17/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1200074,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S03675/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S3675",
    		vetoed_date: "12/17/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1204671,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S03801/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S3801",
    		vetoed_date: "12/17/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1206031,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S03813/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S3813",
    		vetoed_date: "12/20/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1206738,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S03816/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S3816",
    		vetoed_date: "12/20/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1209991,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A05820/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A5820",
    		vetoed_date: "12/20/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1210110,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A05767/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A5767",
    		vetoed_date: "12/10/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1210208,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S03841/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S3841",
    		vetoed_date: "12/20/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1211468,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A05940/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A5940",
    		vetoed_date: "12/17/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1213023,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S03922/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S3922",
    		vetoed_date: "12/20/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1213587,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S03946/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S3946",
    		vetoed_date: "12/20/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1219974,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S04040/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S4040",
    		vetoed_date: "12/17/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1225382,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A06146/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A6146",
    		vetoed_date: "12/20/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1228644,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S04165/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S4165",
    		vetoed_date: "12/10/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1228688,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A06214/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A6214",
    		vetoed_date: "12/20/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1228929,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S04203/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S4203",
    		vetoed_date: "12/10/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1235076,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A06497/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A6497",
    		vetoed_date: "12/10/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1239859,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S04571/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S4571",
    		vetoed_date: "12/20/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1240523,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S04632/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S4632",
    		vetoed_date: "12/20/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1241223,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S04654/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S4654",
    		vetoed_date: "12/20/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1243780,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S04770/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S4770",
    		vetoed_date: "12/20/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1250397,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S05113/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S5113",
    		vetoed_date: "12/17/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1251036,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S05133/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S5133",
    		vetoed_date: "12/20/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1251787,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A07215/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A7215",
    		vetoed_date: "12/20/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1252272,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S05207/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S5207",
    		vetoed_date: "12/20/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1254777,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S05344/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S5344",
    		vetoed_date: "12/17/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1254875,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S05381/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S5381",
    		vetoed_date: "12/10/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1255044,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A07390/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A7390",
    		vetoed_date: "12/17/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1255680,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S05453/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S5453",
    		vetoed_date: "12/20/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1256646,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A07456/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A7456",
    		vetoed_date: "12/17/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1256654,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S05511/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S5511",
    		vetoed_date: "12/10/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1257842,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A07547/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A7547",
    		vetoed_date: "12/17/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1257870,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A07562/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A7562",
    		vetoed_date: "12/10/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1261208,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S05792/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S5792",
    		vetoed_date: "12/20/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1261683,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S05905/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S5905",
    		vetoed_date: "12/20/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1261744,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A07686/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A7686",
    		vetoed_date: "12/10/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1261812,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A07705/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A7705",
    		vetoed_date: "12/20/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1261828,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A07701/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A7701",
    		vetoed_date: "12/20/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1261830,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S05932/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S5932",
    		vetoed_date: "12/17/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1261950,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S06081/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S6081",
    		vetoed_date: "12/17/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1261977,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S06110/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S6110",
    		vetoed_date: "12/20/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1262130,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S06130/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S6130",
    		vetoed_date: "12/17/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1264382,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A07830/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A7830",
    		vetoed_date: "12/17/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1264694,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A07856/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A7856",
    		vetoed_date: "12/17/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1265026,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A07874/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A7874",
    		vetoed_date: "12/20/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1265391,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A07962/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A7962",
    		vetoed_date: "12/20/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1265506,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A08008/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A8008",
    		vetoed_date: "12/20/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1265509,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A08003/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A8003",
    		vetoed_date: "12/17/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1265666,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A08031/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A8031",
    		vetoed_date: "12/20/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1266658,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S06330/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S6330",
    		vetoed_date: "12/20/2019",
    		enrolled_date: "12/20/2019"
    	},
    	{
    		legis_bill_id: 1175646,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A02969/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A2969",
    		vetoed_date: "12/17/2019",
    		enrolled_date: "12/23/2019"
    	},
    	{
    		legis_bill_id: 1179474,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S02849/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S2849",
    		vetoed_date: "12/17/2019",
    		enrolled_date: "12/23/2019"
    	},
    	{
    		legis_bill_id: 1162563,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A01966/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A1966",
    		vetoed_date: "12/20/2019",
    		enrolled_date: "12/26/2019"
    	},
    	{
    		legis_bill_id: 1166971,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A02373/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A2373",
    		vetoed_date: "12/20/2019",
    		enrolled_date: "12/26/2019"
    	},
    	{
    		legis_bill_id: 1174395,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A02836/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A2836",
    		vetoed_date: "12/17/2019",
    		enrolled_date: "12/26/2019"
    	},
    	{
    		legis_bill_id: 1182897,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A03939/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A3939",
    		vetoed_date: "12/19/2019",
    		enrolled_date: "12/26/2019"
    	},
    	{
    		legis_bill_id: 1236636,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S04399/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S4399",
    		vetoed_date: "12/20/2019",
    		enrolled_date: "12/26/2019"
    	},
    	{
    		legis_bill_id: 1253708,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S05294/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S5294",
    		vetoed_date: "12/24/2019",
    		enrolled_date: "12/26/2019"
    	},
    	{
    		legis_bill_id: 1256559,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S05496/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S5496",
    		vetoed_date: "12/19/2019",
    		enrolled_date: "12/26/2019"
    	},
    	{
    		legis_bill_id: 1256600,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A07431/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A7431",
    		vetoed_date: "12/24/2019",
    		enrolled_date: "12/26/2019"
    	},
    	{
    		legis_bill_id: 1262663,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A07749/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A7749",
    		vetoed_date: "12/24/2019",
    		enrolled_date: "12/26/2019"
    	},
    	{
    		legis_bill_id: 1264217,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S06208/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S6208",
    		vetoed_date: "12/24/2019",
    		enrolled_date: "12/26/2019"
    	},
    	{
    		legis_bill_id: 1268800,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S06531/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S6531",
    		vetoed_date: "12/17/2019",
    		enrolled_date: "12/26/2019"
    	},
    	{
    		legis_bill_id: 1268872,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S06552/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S6552",
    		vetoed_date: "12/20/2019",
    		enrolled_date: "12/26/2019"
    	},
    	{
    		legis_bill_id: 1269147,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S06597/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S6597",
    		vetoed_date: "12/24/2019",
    		enrolled_date: "12/26/2019"
    	},
    	{
    		legis_bill_id: 1269153,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A08430/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A8430",
    		vetoed_date: "12/24/2019",
    		enrolled_date: "12/26/2019"
    	},
    	{
    		legis_bill_id: 1266172,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S06281/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S6281",
    		vetoed_date: "12/20/2019",
    		enrolled_date: "12/31/2019"
    	},
    	{
    		legis_bill_id: 1268187,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A08299/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A8299",
    		vetoed_date: "12/20/2019",
    		enrolled_date: "12/31/2019"
    	},
    	{
    		legis_bill_id: 1268817,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A08351/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A8351",
    		vetoed_date: "12/20/2019",
    		enrolled_date: "12/31/2019"
    	},
    	{
    		legis_bill_id: 1268869,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S06566/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S6566",
    		vetoed_date: "12/20/2019",
    		enrolled_date: "12/31/2019"
    	},
    	{
    		legis_bill_id: 1139226,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A00486/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A486",
    		vetoed_date: "12/20/2019",
    		enrolled_date: "1/1/2020"
    	},
    	{
    		legis_bill_id: 1179550,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S02844/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S2844",
    		vetoed_date: "12/20/2019",
    		enrolled_date: "1/1/2020"
    	},
    	{
    		legis_bill_id: 1253079,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/A07246/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/A7246",
    		vetoed_date: "12/20/2019",
    		enrolled_date: "1/1/2020"
    	},
    	{
    		legis_bill_id: 1261865,
    		legis_session_id: 1644,
    		session_name: "2019-2020 General Assembly",
    		session_title: "General Assembly",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NY/bill/S05935/2019",
    		state: "NY",
    		state_url: "https://www.nysenate.gov/legislation/bills/2019/S5935",
    		vetoed_date: "12/20/2019",
    		enrolled_date: "1/1/2020"
    	},
    	{
    		legis_bill_id: 1109448,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/A3726/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=A3726",
    		vetoed_date: "6/27/2019",
    		enrolled_date: "8/23/2019"
    	},
    	{
    		legis_bill_id: 1177514,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB295/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB295",
    		vetoed_date: "8/22/2019",
    		enrolled_date: "9/9/2019"
    	},
    	{
    		legis_bill_id: 1190537,
    		legis_session_id: 1638,
    		session_name: "100th Legislature",
    		session_title: "100th Legislature",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/MI/bill/HB4120/2019",
    		state: "MI",
    		state_url: "http://legislature.mi.gov/doc.aspx?2019-HB-4120",
    		vetoed_date: "12/3/2019",
    		enrolled_date: "12/19/2019"
    	},
    	{
    		legis_bill_id: 1266493,
    		legis_session_id: 1638,
    		session_name: "100th Legislature",
    		session_title: "100th Legislature",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/MI/bill/HB4687/2019",
    		state: "MI",
    		state_url: "http://legislature.mi.gov/doc.aspx?2019-HB-4687",
    		vetoed_date: "12/3/2019",
    		enrolled_date: "12/19/2019"
    	},
    	{
    		legis_bill_id: 1101578,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/S2167/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=S2167",
    		vetoed_date: "11/25/2019",
    		enrolled_date: "1/9/2020"
    	},
    	{
    		legis_bill_id: 1229960,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/S3509/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=S3509",
    		vetoed_date: "11/25/2019",
    		enrolled_date: "1/9/2020"
    	},
    	{
    		legis_bill_id: 1131883,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/SB42/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200SB42",
    		vetoed_date: "9/11/2019",
    		enrolled_date: "10/12/2019"
    	},
    	{
    		legis_bill_id: 1131928,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/SB5/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200SB5",
    		vetoed_date: "9/11/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1131939,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/SB1/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200SB1",
    		vetoed_date: "9/14/2019",
    		enrolled_date: "9/27/2019"
    	},
    	{
    		legis_bill_id: 1131973,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/SB10/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200SB10",
    		vetoed_date: "9/6/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1131989,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/SB35/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200SB35",
    		vetoed_date: "9/10/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1140140,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/SB64/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200SB64",
    		vetoed_date: "9/4/2019",
    		enrolled_date: "9/27/2019"
    	},
    	{
    		legis_bill_id: 1147566,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/SB127/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200SB127",
    		vetoed_date: "9/11/2019",
    		enrolled_date: "10/12/2019"
    	},
    	{
    		legis_bill_id: 1161043,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/SB139/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200SB139",
    		vetoed_date: "9/11/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1170188,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/SB154/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200SB154",
    		vetoed_date: "9/9/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1172785,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/SB163/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200SB163",
    		vetoed_date: "9/11/2019",
    		enrolled_date: "10/12/2019"
    	},
    	{
    		legis_bill_id: 1173236,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/S3369/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=S3369",
    		vetoed_date: "3/25/2019",
    		enrolled_date: "5/13/2019"
    	},
    	{
    		legis_bill_id: 1182130,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/SB184/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200SB184",
    		vetoed_date: "9/10/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1184898,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/SB199/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200SB199",
    		vetoed_date: "9/11/2019",
    		enrolled_date: "10/12/2019"
    	},
    	{
    		legis_bill_id: 1184904,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/SB202/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200SB202",
    		vetoed_date: "9/11/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1188483,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/SB212/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200SB212",
    		vetoed_date: "9/11/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1194055,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/SB218/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200SB218",
    		vetoed_date: "9/14/2019",
    		enrolled_date: "10/12/2019"
    	},
    	{
    		legis_bill_id: 1196338,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/SB232/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200SB232",
    		vetoed_date: "9/4/2019",
    		enrolled_date: "9/27/2019"
    	},
    	{
    		legis_bill_id: 1200958,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/SB268/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200SB268",
    		vetoed_date: "9/13/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1203069,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/SB277/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200SB277",
    		vetoed_date: "9/11/2019",
    		enrolled_date: "10/12/2019"
    	},
    	{
    		legis_bill_id: 1203163,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/SB284/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200SB284",
    		vetoed_date: "9/3/2019",
    		enrolled_date: "10/12/2019"
    	},
    	{
    		legis_bill_id: 1205308,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/SB294/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200SB294",
    		vetoed_date: "9/6/2019",
    		enrolled_date: "10/12/2019"
    	},
    	{
    		legis_bill_id: 1205527,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/SB296/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200SB296",
    		vetoed_date: "9/12/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1208068,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/SB305/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200SB305",
    		vetoed_date: "9/11/2019",
    		enrolled_date: "10/12/2019"
    	},
    	{
    		legis_bill_id: 1210827,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/SB349/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200SB349",
    		vetoed_date: "9/11/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1210895,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/SB337/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200SB337",
    		vetoed_date: "9/11/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1212602,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/SB363/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200SB363",
    		vetoed_date: "9/11/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1212606,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/SB365/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200SB365",
    		vetoed_date: "9/10/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1212770,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/SB382/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200SB382",
    		vetoed_date: "9/10/2019",
    		enrolled_date: "10/12/2019"
    	},
    	{
    		legis_bill_id: 1214021,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/SB487/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200SB487",
    		vetoed_date: "9/6/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1214033,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/SB531/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200SB531",
    		vetoed_date: "9/5/2019",
    		enrolled_date: "10/12/2019"
    	},
    	{
    		legis_bill_id: 1214085,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/SB538/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200SB538",
    		vetoed_date: "9/12/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1214132,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/SB484/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200SB484",
    		vetoed_date: "9/11/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1214143,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/SB445/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200SB445",
    		vetoed_date: "9/11/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1214146,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/SB503/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200SB503",
    		vetoed_date: "9/10/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1214181,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/SB518/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200SB518",
    		vetoed_date: "9/11/2019",
    		enrolled_date: "10/12/2019"
    	},
    	{
    		legis_bill_id: 1214197,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/SB428/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200SB428",
    		vetoed_date: "9/6/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1214270,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/SB468/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200SB468",
    		vetoed_date: "9/11/2019",
    		enrolled_date: "10/11/2019"
    	},
    	{
    		legis_bill_id: 1214339,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/SB532/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200SB532",
    		vetoed_date: "9/12/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1215491,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/SB558/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200SB558",
    		vetoed_date: "9/11/2019",
    		enrolled_date: "10/12/2019"
    	},
    	{
    		legis_bill_id: 1215506,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/SB575/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200SB575",
    		vetoed_date: "9/11/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1215704,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/SB611/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200SB611",
    		vetoed_date: "9/6/2019",
    		enrolled_date: "10/12/2019"
    	},
    	{
    		legis_bill_id: 1215736,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/SB696/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200SB696",
    		vetoed_date: "9/13/2019",
    		enrolled_date: "10/9/2019"
    	},
    	{
    		legis_bill_id: 1215745,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/SB577/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200SB577",
    		vetoed_date: "9/11/2019",
    		enrolled_date: "10/9/2019"
    	},
    	{
    		legis_bill_id: 1215790,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/SB628/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200SB628",
    		vetoed_date: "9/9/2019",
    		enrolled_date: "9/27/2019"
    	},
    	{
    		legis_bill_id: 1215873,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/SB704/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200SB704",
    		vetoed_date: "9/12/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1215893,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/SB622/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200SB622",
    		vetoed_date: "9/12/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1215973,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/SB589/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200SB589",
    		vetoed_date: "9/11/2019",
    		enrolled_date: "10/12/2019"
    	},
    	{
    		legis_bill_id: 1216023,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/SB701/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200SB701",
    		vetoed_date: "7/5/2019",
    		enrolled_date: "7/30/2019"
    	},
    	{
    		legis_bill_id: 1216065,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/SB695/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200SB695",
    		vetoed_date: "9/12/2019",
    		enrolled_date: "10/12/2019"
    	},
    	{
    		legis_bill_id: 1216102,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/SB706/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200SB706",
    		vetoed_date: "9/10/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1216112,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/SB598/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200SB598",
    		vetoed_date: "9/11/2019",
    		enrolled_date: "10/12/2019"
    	},
    	{
    		legis_bill_id: 1277975,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/S4139/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=S4139",
    		vetoed_date: "12/16/2019",
    		enrolled_date: "1/13/2020"
    	},
    	{
    		legis_bill_id: 1287101,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/S4289/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=S4289",
    		vetoed_date: "12/16/2019",
    		enrolled_date: "1/13/2020"
    	},
    	{
    		legis_bill_id: 1244106,
    		legis_session_id: 1645,
    		session_name: "2019-2020 Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NC/bill/S354/2019",
    		state: "NC",
    		state_url: "https://www.ncleg.gov/BillLookUp/2019/S354",
    		vetoed_date: "10/31/2019",
    		enrolled_date: "11/8/2019"
    	},
    	{
    		legis_bill_id: 1247900,
    		legis_session_id: 1645,
    		session_name: "2019-2020 Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NC/bill/S553/2019",
    		state: "NC",
    		state_url: "https://www.ncleg.gov/BillLookUp/2019/S553",
    		vetoed_date: "9/10/2019",
    		enrolled_date: "9/20/2019"
    	},
    	{
    		legis_bill_id: 1254351,
    		legis_session_id: 1645,
    		session_name: "2019-2020 Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/NC/bill/H966/2019",
    		state: "NC",
    		state_url: "https://www.ncleg.gov/BillLookUp/2019/H966",
    		vetoed_date: "6/27/2019",
    		enrolled_date: "6/28/2019"
    	},
    	{
    		legis_bill_id: 1055390,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/A1044/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=A1044",
    		vetoed_date: "1/13/2020",
    		enrolled_date: "1/21/2020"
    	},
    	{
    		legis_bill_id: 1055488,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/S691/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=S691",
    		vetoed_date: "1/13/2020",
    		enrolled_date: "1/21/2020"
    	},
    	{
    		legis_bill_id: 1055893,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/A1045/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=A1045",
    		vetoed_date: "1/13/2020",
    		enrolled_date: "1/21/2020"
    	},
    	{
    		legis_bill_id: 1056884,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/A491/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=A491",
    		vetoed_date: "1/13/2020",
    		enrolled_date: "1/21/2020"
    	},
    	{
    		legis_bill_id: 1057332,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/A1526/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=A1526",
    		vetoed_date: "1/13/2020",
    		enrolled_date: "1/21/2020"
    	},
    	{
    		legis_bill_id: 1068796,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/S1083/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=S1083",
    		vetoed_date: "1/13/2020",
    		enrolled_date: "1/21/2020"
    	},
    	{
    		legis_bill_id: 1079905,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/A2731/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=A2731",
    		vetoed_date: "1/13/2020",
    		enrolled_date: "1/21/2020"
    	},
    	{
    		legis_bill_id: 1111220,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/S2429/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=S2429",
    		vetoed_date: "1/13/2020",
    		enrolled_date: "1/21/2020"
    	},
    	{
    		legis_bill_id: 1111363,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/S2421/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=S2421",
    		vetoed_date: "1/13/2020",
    		enrolled_date: "1/21/2020"
    	},
    	{
    		legis_bill_id: 1111381,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/S2425/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=S2425",
    		vetoed_date: "1/13/2020",
    		enrolled_date: "1/21/2020"
    	},
    	{
    		legis_bill_id: 1124666,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/S2835/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=S2835",
    		vetoed_date: "1/13/2020",
    		enrolled_date: "1/21/2020"
    	},
    	{
    		legis_bill_id: 1126319,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/A4382/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=A4382",
    		vetoed_date: "1/13/2020",
    		enrolled_date: "1/21/2020"
    	},
    	{
    		legis_bill_id: 1126382,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/S2897/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=S2897",
    		vetoed_date: "1/13/2020",
    		enrolled_date: "1/21/2020"
    	},
    	{
    		legis_bill_id: 1126580,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/S2958/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=S2958",
    		vetoed_date: "1/13/2020",
    		enrolled_date: "1/21/2020"
    	},
    	{
    		legis_bill_id: 1126591,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/S2957/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=S2957",
    		vetoed_date: "1/13/2020",
    		enrolled_date: "1/21/2020"
    	},
    	{
    		legis_bill_id: 1126936,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/A4463/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=A4463",
    		vetoed_date: "1/13/2020",
    		enrolled_date: "1/21/2020"
    	},
    	{
    		legis_bill_id: 1127980,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/S3063/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=S3063",
    		vetoed_date: "1/13/2020",
    		enrolled_date: "1/21/2020"
    	},
    	{
    		legis_bill_id: 1128029,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/S3062/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=S3062",
    		vetoed_date: "1/13/2020",
    		enrolled_date: "1/21/2020"
    	},
    	{
    		legis_bill_id: 1128382,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/S3137/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=S3137",
    		vetoed_date: "1/13/2020",
    		enrolled_date: "1/21/2020"
    	},
    	{
    		legis_bill_id: 1131908,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB16/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB16",
    		vetoed_date: "9/9/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1131988,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB28/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB28",
    		vetoed_date: "9/10/2019",
    		enrolled_date: "10/12/2019"
    	},
    	{
    		legis_bill_id: 1132042,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB23/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB23",
    		vetoed_date: "9/12/2019",
    		enrolled_date: "10/12/2019"
    	},
    	{
    		legis_bill_id: 1132481,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/S3252/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=S3252",
    		vetoed_date: "1/9/2020",
    		enrolled_date: "1/21/2020"
    	},
    	{
    		legis_bill_id: 1132538,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/S3263/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=S3263",
    		vetoed_date: "1/13/2020",
    		enrolled_date: "1/21/2020"
    	},
    	{
    		legis_bill_id: 1132747,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/A4788/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=A4788",
    		vetoed_date: "1/13/2020",
    		enrolled_date: "1/21/2020"
    	},
    	{
    		legis_bill_id: 1140134,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB166/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB166",
    		vetoed_date: "9/11/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1141650,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB171/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB171",
    		vetoed_date: "9/14/2019",
    		enrolled_date: "10/12/2019"
    	},
    	{
    		legis_bill_id: 1147513,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB197/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB197",
    		vetoed_date: "9/9/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1153473,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB211/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB211",
    		vetoed_date: "9/9/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1170205,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB258/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB258",
    		vetoed_date: "9/11/2019",
    		enrolled_date: "10/12/2019"
    	},
    	{
    		legis_bill_id: 1173370,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/S3393/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=S3393",
    		vetoed_date: "1/13/2020",
    		enrolled_date: "1/21/2020"
    	},
    	{
    		legis_bill_id: 1177461,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB283/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB283",
    		vetoed_date: "9/12/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1177583,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB294/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB294",
    		vetoed_date: "9/11/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1181255,
    		legis_session_id: 1635,
    		session_name: "129th Legislature",
    		session_title: "129th Legislature",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/ME/bill/LD517/2019",
    		state: "ME",
    		state_url: "http://legislature.maine.gov/legis/bills/display_ps.asp?LD=517&snum=129",
    		vetoed_date: "5/23/2019",
    		enrolled_date: "1/21/2020"
    	},
    	{
    		legis_bill_id: 1182066,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB314/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB314",
    		vetoed_date: "9/12/2019",
    		enrolled_date: "10/12/2019"
    	},
    	{
    		legis_bill_id: 1182153,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB318/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB318",
    		vetoed_date: "9/9/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1184892,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB340/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB340",
    		vetoed_date: "9/10/2019",
    		enrolled_date: "10/12/2019"
    	},
    	{
    		legis_bill_id: 1188458,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB357/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB357",
    		vetoed_date: "9/10/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1188472,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB354/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB354",
    		vetoed_date: "9/10/2019",
    		enrolled_date: "10/12/2019"
    	},
    	{
    		legis_bill_id: 1188487,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB344/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB344",
    		vetoed_date: "9/5/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1188536,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB346/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB346",
    		vetoed_date: "9/6/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1191152,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB386/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB386",
    		vetoed_date: "9/9/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1191278,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB372/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB372",
    		vetoed_date: "9/9/2019",
    		enrolled_date: "10/8/2019"
    	},
    	{
    		legis_bill_id: 1194041,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB394/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB394",
    		vetoed_date: "9/11/2019",
    		enrolled_date: "10/2/2019"
    	},
    	{
    		legis_bill_id: 1194121,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB403/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB403",
    		vetoed_date: "9/9/2019",
    		enrolled_date: "10/12/2019"
    	},
    	{
    		legis_bill_id: 1196229,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB411/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB411",
    		vetoed_date: "9/12/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1196317,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB417/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB417",
    		vetoed_date: "9/9/2019",
    		enrolled_date: "10/12/2019"
    	},
    	{
    		legis_bill_id: 1199600,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB449/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB449",
    		vetoed_date: "9/5/2019",
    		enrolled_date: "9/27/2019"
    	},
    	{
    		legis_bill_id: 1200920,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB476/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB476",
    		vetoed_date: "9/11/2019",
    		enrolled_date: "10/12/2019"
    	},
    	{
    		legis_bill_id: 1203002,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB556/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB556",
    		vetoed_date: "9/9/2019",
    		enrolled_date: "10/11/2019"
    	},
    	{
    		legis_bill_id: 1203016,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB512/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB512",
    		vetoed_date: "9/9/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1203055,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB520/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB520",
    		vetoed_date: "9/9/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1203102,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB524/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB524",
    		vetoed_date: "9/11/2019",
    		enrolled_date: "10/8/2019"
    	},
    	{
    		legis_bill_id: 1203129,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB550/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB550",
    		vetoed_date: "9/10/2019",
    		enrolled_date: "10/12/2019"
    	},
    	{
    		legis_bill_id: 1203148,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB506/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB506",
    		vetoed_date: "9/12/2019",
    		enrolled_date: "10/12/2019"
    	},
    	{
    		legis_bill_id: 1203171,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB500/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB500",
    		vetoed_date: "9/5/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1205261,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB594/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB594",
    		vetoed_date: "9/9/2019",
    		enrolled_date: "10/2/2019"
    	},
    	{
    		legis_bill_id: 1205570,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB589/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB589",
    		vetoed_date: "9/11/2019",
    		enrolled_date: "10/12/2019"
    	},
    	{
    		legis_bill_id: 1207204,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/S3270/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=S3270",
    		vetoed_date: "1/13/2020",
    		enrolled_date: "1/21/2020"
    	},
    	{
    		legis_bill_id: 1208072,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB681/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB681",
    		vetoed_date: "9/13/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1208095,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB624/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB624",
    		vetoed_date: "9/5/2019",
    		enrolled_date: "10/12/2019"
    	},
    	{
    		legis_bill_id: 1208157,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB638/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB638",
    		vetoed_date: "9/9/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1208209,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB684/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB684",
    		vetoed_date: "9/10/2019",
    		enrolled_date: "10/12/2019"
    	},
    	{
    		legis_bill_id: 1208248,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB625/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB625",
    		vetoed_date: "9/3/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1210719,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB773/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB773",
    		vetoed_date: "9/9/2019",
    		enrolled_date: "10/7/2019"
    	},
    	{
    		legis_bill_id: 1210720,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB733/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB733",
    		vetoed_date: "9/9/2019",
    		enrolled_date: "10/12/2019"
    	},
    	{
    		legis_bill_id: 1210795,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB751/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB751",
    		vetoed_date: "9/13/2019",
    		enrolled_date: "10/12/2019"
    	},
    	{
    		legis_bill_id: 1210848,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB774/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB774",
    		vetoed_date: "9/9/2019",
    		enrolled_date: "10/12/2019"
    	},
    	{
    		legis_bill_id: 1210879,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB734/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB734",
    		vetoed_date: "9/9/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1210891,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB776/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB776",
    		vetoed_date: "9/9/2019",
    		enrolled_date: "9/27/2019"
    	},
    	{
    		legis_bill_id: 1212460,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB944/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB944",
    		vetoed_date: "9/10/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1212481,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB920/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB920",
    		vetoed_date: "9/13/2019",
    		enrolled_date: "10/12/2019"
    	},
    	{
    		legis_bill_id: 1212567,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB852/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB852",
    		vetoed_date: "9/10/2019",
    		enrolled_date: "10/12/2019"
    	},
    	{
    		legis_bill_id: 1212569,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB869/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB869",
    		vetoed_date: "9/10/2019",
    		enrolled_date: "10/8/2019"
    	},
    	{
    		legis_bill_id: 1212632,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB792/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB792",
    		vetoed_date: "9/14/2019",
    		enrolled_date: "10/12/2019"
    	},
    	{
    		legis_bill_id: 1212634,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB848/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB848",
    		vetoed_date: "9/9/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1212653,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB891/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB891",
    		vetoed_date: "9/11/2019",
    		enrolled_date: "10/12/2019"
    	},
    	{
    		legis_bill_id: 1212672,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB842/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB842",
    		vetoed_date: "9/11/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1212698,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB899/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB899",
    		vetoed_date: "9/5/2019",
    		enrolled_date: "10/12/2019"
    	},
    	{
    		legis_bill_id: 1212752,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB859/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB859",
    		vetoed_date: "9/11/2019",
    		enrolled_date: "10/12/2019"
    	},
    	{
    		legis_bill_id: 1212762,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB803/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB803",
    		vetoed_date: "9/10/2019",
    		enrolled_date: "10/9/2019"
    	},
    	{
    		legis_bill_id: 1212813,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB927/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB927",
    		vetoed_date: "9/10/2019",
    		enrolled_date: "10/9/2019"
    	},
    	{
    		legis_bill_id: 1212834,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB885/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB885",
    		vetoed_date: "9/9/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1212861,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB914/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB914",
    		vetoed_date: "9/9/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1214032,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB1084/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB1084",
    		vetoed_date: "8/12/2019",
    		enrolled_date: "10/12/2019"
    	},
    	{
    		legis_bill_id: 1214036,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB1014/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB1014",
    		vetoed_date: "9/5/2019",
    		enrolled_date: "10/12/2019"
    	},
    	{
    		legis_bill_id: 1214047,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB1086/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB1086",
    		vetoed_date: "9/13/2019",
    		enrolled_date: "10/11/2019"
    	},
    	{
    		legis_bill_id: 1214091,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB1153/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB1153",
    		vetoed_date: "9/11/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1214097,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB1093/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB1093",
    		vetoed_date: "9/6/2019",
    		enrolled_date: "9/27/2019"
    	},
    	{
    		legis_bill_id: 1214116,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB967/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB967",
    		vetoed_date: "9/10/2019",
    		enrolled_date: "10/7/2019"
    	},
    	{
    		legis_bill_id: 1214222,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB993/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB993",
    		vetoed_date: "9/10/2019",
    		enrolled_date: "10/12/2019"
    	},
    	{
    		legis_bill_id: 1214250,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB970/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB970",
    		vetoed_date: "9/5/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1214317,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB1009/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB1009",
    		vetoed_date: "8/22/2019",
    		enrolled_date: "10/12/2019"
    	},
    	{
    		legis_bill_id: 1214342,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB1085/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB1085",
    		vetoed_date: "9/9/2019",
    		enrolled_date: "10/7/2019"
    	},
    	{
    		legis_bill_id: 1214345,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB1075/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB1075",
    		vetoed_date: "9/9/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1214358,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB1036/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB1036",
    		vetoed_date: "9/9/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1214365,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB1092/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB1092",
    		vetoed_date: "9/11/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1214394,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB1181/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB1181",
    		vetoed_date: "9/12/2019",
    		enrolled_date: "10/12/2019"
    	},
    	{
    		legis_bill_id: 1214403,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB1195/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB1195",
    		vetoed_date: "9/10/2019",
    		enrolled_date: "10/11/2019"
    	},
    	{
    		legis_bill_id: 1214407,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB1184/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB1184",
    		vetoed_date: "9/10/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1214442,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB1214/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB1214",
    		vetoed_date: "9/10/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1214460,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB1282/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB1282",
    		vetoed_date: "9/9/2019",
    		enrolled_date: "10/12/2019"
    	},
    	{
    		legis_bill_id: 1214466,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB1252/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB1252",
    		vetoed_date: "9/5/2019",
    		enrolled_date: "10/12/2019"
    	},
    	{
    		legis_bill_id: 1214498,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB1212/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB1212",
    		vetoed_date: "9/9/2019",
    		enrolled_date: "10/9/2019"
    	},
    	{
    		legis_bill_id: 1214508,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB1233/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB1233",
    		vetoed_date: "9/10/2019",
    		enrolled_date: "10/12/2019"
    	},
    	{
    		legis_bill_id: 1214520,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB1227/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB1227",
    		vetoed_date: "9/9/2019",
    		enrolled_date: "9/27/2019"
    	},
    	{
    		legis_bill_id: 1214536,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB1175/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB1175",
    		vetoed_date: "9/9/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1214538,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB1249/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB1249",
    		vetoed_date: "9/11/2019",
    		enrolled_date: "9/27/2019"
    	},
    	{
    		legis_bill_id: 1214861,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/A5072/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=A5072",
    		vetoed_date: "1/13/2020",
    		enrolled_date: "1/21/2020"
    	},
    	{
    		legis_bill_id: 1215433,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB1437/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB1437",
    		vetoed_date: "9/10/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1215516,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB1681/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB1681",
    		vetoed_date: "9/11/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1215527,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB1578/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB1578",
    		vetoed_date: "9/12/2019",
    		enrolled_date: "10/11/2019"
    	},
    	{
    		legis_bill_id: 1215539,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB1732/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB1732",
    		vetoed_date: "9/9/2019",
    		enrolled_date: "10/12/2019"
    	},
    	{
    		legis_bill_id: 1215545,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB1382/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB1382",
    		vetoed_date: "9/9/2019",
    		enrolled_date: "10/12/2019"
    	},
    	{
    		legis_bill_id: 1215551,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB1391/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB1391",
    		vetoed_date: "9/10/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1215559,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB1477/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB1477",
    		vetoed_date: "9/9/2019",
    		enrolled_date: "10/12/2019"
    	},
    	{
    		legis_bill_id: 1215591,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB1658/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB1658",
    		vetoed_date: "9/9/2019",
    		enrolled_date: "9/27/2019"
    	},
    	{
    		legis_bill_id: 1215608,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB1677/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB1677",
    		vetoed_date: "9/12/2019",
    		enrolled_date: "10/12/2019"
    	},
    	{
    		legis_bill_id: 1215705,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB1605/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB1605",
    		vetoed_date: "9/5/2019",
    		enrolled_date: "10/12/2019"
    	},
    	{
    		legis_bill_id: 1215747,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB1688/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB1688",
    		vetoed_date: "9/10/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1215783,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB1466/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB1466",
    		vetoed_date: "9/10/2019",
    		enrolled_date: "10/12/2019"
    	},
    	{
    		legis_bill_id: 1215793,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB1478/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB1478",
    		vetoed_date: "9/11/2019",
    		enrolled_date: "10/12/2019"
    	},
    	{
    		legis_bill_id: 1215813,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB1516/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB1516",
    		vetoed_date: "9/11/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1215818,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB1736/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB1736",
    		vetoed_date: "9/10/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1215848,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB1307/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB1307",
    		vetoed_date: "9/10/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1215882,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB1393/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB1393",
    		vetoed_date: "9/5/2019",
    		enrolled_date: "10/12/2019"
    	},
    	{
    		legis_bill_id: 1215887,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB1440/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB1440",
    		vetoed_date: "9/5/2019",
    		enrolled_date: "10/12/2019"
    	},
    	{
    		legis_bill_id: 1215891,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB1407/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB1407",
    		vetoed_date: "9/9/2019",
    		enrolled_date: "10/11/2019"
    	},
    	{
    		legis_bill_id: 1215895,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB1727/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB1727",
    		vetoed_date: "9/13/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1215899,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB1322/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB1322",
    		vetoed_date: "9/12/2019",
    		enrolled_date: "10/11/2019"
    	},
    	{
    		legis_bill_id: 1215969,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB1718/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB1718",
    		vetoed_date: "9/12/2019",
    		enrolled_date: "10/11/2019"
    	},
    	{
    		legis_bill_id: 1215976,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB1613/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB1613",
    		vetoed_date: "9/9/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1216021,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB1558/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB1558",
    		vetoed_date: "9/9/2019",
    		enrolled_date: "10/9/2019"
    	},
    	{
    		legis_bill_id: 1216119,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB1590/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB1590",
    		vetoed_date: "9/9/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1216168,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB1702/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB1702",
    		vetoed_date: "9/11/2019",
    		enrolled_date: "10/13/2019"
    	},
    	{
    		legis_bill_id: 1262252,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/S3770/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=S3770",
    		vetoed_date: "1/13/2020",
    		enrolled_date: "1/21/2020"
    	},
    	{
    		legis_bill_id: 1264653,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/A5446/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=A5446",
    		vetoed_date: "1/13/2020",
    		enrolled_date: "1/21/2020"
    	},
    	{
    		legis_bill_id: 1266353,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/S3888/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=S3888",
    		vetoed_date: "1/13/2020",
    		enrolled_date: "1/21/2020"
    	},
    	{
    		legis_bill_id: 1269101,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/A5629/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=A5629",
    		vetoed_date: "1/13/2020",
    		enrolled_date: "1/21/2020"
    	},
    	{
    		legis_bill_id: 1270026,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/S4035/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=S4035",
    		vetoed_date: "1/13/2020",
    		enrolled_date: "1/21/2020"
    	},
    	{
    		legis_bill_id: 1279697,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/A5922/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=A5922",
    		vetoed_date: "1/13/2020",
    		enrolled_date: "1/21/2020"
    	},
    	{
    		legis_bill_id: 1286999,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/S4281/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=S4281",
    		vetoed_date: "1/13/2020",
    		enrolled_date: "1/21/2020"
    	},
    	{
    		legis_bill_id: 1291616,
    		legis_session_id: 1531,
    		session_name: "2018-2019 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2018,
    		session_year_end: 2019,
    		legis_url: "https://legiscan.com/NJ/bill/S4331/2018",
    		state: "NJ",
    		state_url: "https://www.njleg.state.nj.us/bills/BillView.asp?BillNumber=S4331",
    		vetoed_date: "1/13/2020",
    		enrolled_date: "1/21/2020"
    	},
    	{
    		legis_bill_id: 1132263,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB130/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB130",
    		vetoed_date: "9/12/2019",
    		enrolled_date: "10/8/2019"
    	},
    	{
    		legis_bill_id: 1177638,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB296/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB296",
    		vetoed_date: "9/9/2019",
    		enrolled_date: "10/2/2019"
    	},
    	{
    		legis_bill_id: 1188450,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB365/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB365",
    		vetoed_date: "9/9/2019",
    		enrolled_date: "10/9/2019"
    	},
    	{
    		legis_bill_id: 1203040,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB551/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB551",
    		vetoed_date: "9/10/2019",
    		enrolled_date: "10/2/2019"
    	},
    	{
    		legis_bill_id: 1215500,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB1591/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB1591",
    		vetoed_date: "9/9/2019",
    		enrolled_date: "9/27/2019"
    	},
    	{
    		legis_bill_id: 1215662,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB1511/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB1511",
    		vetoed_date: "9/9/2019",
    		enrolled_date: "9/27/2019"
    	},
    	{
    		legis_bill_id: 1216084,
    		legis_session_id: 1624,
    		session_name: "2019-2020 Regular Session",
    		session_title: "Regular Session",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/CA/bill/AB1451/2019",
    		state: "CA",
    		state_url: "http://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=201920200AB1451",
    		vetoed_date: "9/11/2019",
    		enrolled_date: "10/7/2019"
    	},
    	{
    		legis_bill_id: 1211856,
    		legis_session_id: 1622,
    		session_name: "31st Legislature",
    		session_title: "31st Legislature",
    		session_year_start: 2019,
    		session_year_end: 2020,
    		legis_url: "https://legiscan.com/AK/bill/HB48/2019",
    		state: "AK",
    		state_url: "http://www.akleg.gov/basis/Bill/Detail/31?Root=HB48",
    		vetoed_date: "5/6/2019",
    		enrolled_date: "10/23/2019"
    	}
    ];

    /* src\App.svelte generated by Svelte v3.38.2 */
    const file = "src\\App.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[4] = list[i];
    	return child_ctx;
    }

    // (15:1) {:else}
    function create_else_block(ctx) {
    	let ul;
    	let h3;
    	let t1;
    	let p;
    	let t3;
    	let each_value = /*billData*/ ctx[0];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			ul = element("ul");
    			h3 = element("h3");
    			h3.textContent = "NYC school list";
    			t1 = space();
    			p = element("p");
    			p.textContent = "Select a school learn more.";
    			t3 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			add_location(h3, file, 16, 3, 340);
    			add_location(p, file, 17, 3, 368);
    			add_location(ul, file, 15, 2, 332);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, ul, anchor);
    			append_dev(ul, h3);
    			append_dev(ul, t1);
    			append_dev(ul, p);
    			append_dev(ul, t3);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(ul, null);
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*billData*/ 1) {
    				each_value = /*billData*/ ctx[0];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(ul, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(ul);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(15:1) {:else}",
    		ctx
    	});

    	return block;
    }

    // (10:1) {#if billData}
    function create_if_block(ctx) {
    	let p0;
    	let a;
    	let t1;
    	let h1;
    	let t2_value = /*billData*/ ctx[0].sesion_name + "";
    	let t2;
    	let t3;
    	let p1;
    	let t4;
    	let t5_value = /*billData*/ ctx[0].state_url + "";
    	let t5;
    	let t6;
    	let p2;
    	let t7;
    	let t8_value = /*billData*/ ctx[0].vetoed_date + "";
    	let t8;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			p0 = element("p");
    			a = element("a");
    			a.textContent = "Go back to veto list";
    			t1 = space();
    			h1 = element("h1");
    			t2 = text(t2_value);
    			t3 = space();
    			p1 = element("p");
    			t4 = text("The state url is ");
    			t5 = text(t5_value);
    			t6 = space();
    			p2 = element("p");
    			t7 = text("The veto date is ");
    			t8 = text(t8_value);
    			attr_dev(a, "href", "#");
    			add_location(a, file, 10, 5, 117);
    			add_location(p0, file, 10, 2, 114);
    			attr_dev(h1, "class", "svelte-1tky8bj");
    			add_location(h1, file, 11, 2, 193);
    			add_location(p1, file, 12, 2, 227);
    			add_location(p2, file, 13, 2, 274);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p0, anchor);
    			append_dev(p0, a);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, h1, anchor);
    			append_dev(h1, t2);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, p1, anchor);
    			append_dev(p1, t4);
    			append_dev(p1, t5);
    			insert_dev(target, t6, anchor);
    			insert_dev(target, p2, anchor);
    			append_dev(p2, t7);
    			append_dev(p2, t8);

    			if (!mounted) {
    				dispose = listen_dev(a, "click", /*click_handler*/ ctx[2], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*billData*/ 1 && t2_value !== (t2_value = /*billData*/ ctx[0].sesion_name + "")) set_data_dev(t2, t2_value);
    			if (dirty & /*billData*/ 1 && t5_value !== (t5_value = /*billData*/ ctx[0].state_url + "")) set_data_dev(t5, t5_value);
    			if (dirty & /*billData*/ 1 && t8_value !== (t8_value = /*billData*/ ctx[0].vetoed_date + "")) set_data_dev(t8, t8_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(p1);
    			if (detaching) detach_dev(t6);
    			if (detaching) detach_dev(p2);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(10:1) {#if billData}",
    		ctx
    	});

    	return block;
    }

    // (19:3) {#each billData as bills}
    function create_each_block(ctx) {
    	let li;
    	let t_value = /*billData*/ ctx[0].session_name + "";
    	let t;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			li = element("li");
    			t = text(t_value);
    			add_location(li, file, 19, 4, 436);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, li, anchor);
    			append_dev(li, t);

    			if (!mounted) {
    				dispose = listen_dev(li, "click", /*click_handler_1*/ ctx[3], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*billData*/ 1 && t_value !== (t_value = /*billData*/ ctx[0].session_name + "")) set_data_dev(t, t_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(li);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(19:3) {#each billData as bills}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let main;

    	function select_block_type(ctx, dirty) {
    		if (/*billData*/ ctx[0]) return create_if_block;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			main = element("main");
    			if_block.c();
    			attr_dev(main, "class", "svelte-1tky8bj");
    			add_location(main, file, 8, 0, 89);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			if_block.m(main, null);
    		},
    		p: function update(ctx, [dirty]) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(main, null);
    				}
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("App", slots, []);
    	let { name } = $$props;
    	let billData;
    	const writable_props = ["name"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => $$invalidate(0, billData = null);
    	const click_handler_1 = () => $$invalidate(0, billData = billData.session_name);

    	$$self.$$set = $$props => {
    		if ("name" in $$props) $$invalidate(1, name = $$props.name);
    	};

    	$$self.$capture_state = () => ({ name, vetos, billData });

    	$$self.$inject_state = $$props => {
    		if ("name" in $$props) $$invalidate(1, name = $$props.name);
    		if ("billData" in $$props) $$invalidate(0, billData = $$props.billData);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [billData, name, click_handler, click_handler_1];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, { name: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*name*/ ctx[1] === undefined && !("name" in props)) {
    			console.warn("<App> was created without expected prop 'name'");
    		}
    	}

    	get name() {
    		throw new Error("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set name(value) {
    		throw new Error("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    		name: 'world'
    	}
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
