import * as React from 'react';
import { Component, Children } from 'react';
import { classNames, supports } from '@tolkam/lib-utils-ui';
import throttle from '@tolkam/lib-utils/throttle';
import debounce from '@tolkam/lib-utils/debounce';
import scrollTo, { TDirection, TEasing } from '@tolkam/lib-scroll-to';
import InView, { IVisibility, ISubject } from '@tolkam/react-in-view';

import * as Hammer from 'hammerjs';

import './defaults.scss';

const WIN = window;
const LOCAL_CLASS_NAME = 'rAgXf';

export default class Frames extends Component<IProps, any> {

    public static defaultProps = {
        startFrame: 0,
        scrollSpeed: 300,
        scrollEasing: 'easeOutQuad',
    };

    /**
     * Scrolling element
     * @type {HTMLDivElement}
     */
    protected parentRef: HTMLDivElement;

    /**
     * Frame elements
     * @type {NodeList}
     */
    protected childrenRefs: NodeListOf<HTMLDivElement>;

    /**
     * Whether client has scroll-snap support
     * @type {boolean}
     */
    protected isLegacy = true;

    /**
     * Scrolling state flag
     * @type {boolean}
     */
    protected isBusy = false;

    /**
     * Current active frame index
     * @type {number}
     */
    protected activeIndex = 0;

    /**
     * Current active frame index
     * @type {HTMLDivElement}
     */
    protected activeFrame: HTMLDivElement;

    /**
     * @param {IProps} props
     */
    public constructor(props: IProps) {
        super(props);

        // check new specs support
        this.isLegacy = !supports('scroll-snap-align: center');

        // throttled, so fires every N ms at most
        this.onWindowChanges = throttle(this.onResize, 200);

        // debounced, so fires at event end
        this.onScroll = debounce(this.onScroll, 50);
    }

    /**
     * {@inheritDoc}
     */
    public componentDidMount() {
        const that = this;

        // force render to populate frames parent ref first
        // and pass it to each frame
        that.setState({}, () => {

            // get children refs
            that.childrenRefs = that.parentRef.childNodes as NodeListOf<HTMLDivElement>;

            WIN.addEventListener('resize', that.onResize);
            that.parentRef.addEventListener('scroll', that.onScroll);

            // start from specific index
            // that.scrollTo(that.props.startFrame!, true);


            const direction = Hammer.DIRECTION_HORIZONTAL;
            // const hammer = new Hammer(that.parentRef, {});
            const hammer = new Hammer.Manager(that.parentRef, {
                recognizers: [
                    [Hammer.Swipe, { direction }],
                    [Hammer.Pan, { direction }, ['swipe']],
                ]
            });

            hammer.on('swipeleft swiperight panleft panright panend pancancel', (e) => {
                console.log(e.type);
                if(e.type == 'swipeleft') {
                    that.next();
                    hammer.stop(true);
                } else if(e.type == 'swiperight') {
                    that.prev();
                    hammer.stop(true);
                } else if(e.type == 'panleft') {
                    console.log(e.deltaX);
                    // scrollTo('Left', that.parentRef, that.parentRef.scrollLeft+1);
                    that.parentRef.scrollLeft = that.parentRef.scrollLeft - e.deltaX;
                }
            });

        });
    }

    /**
     * {@inheritDoc}
     */
    public componentWillUnmount() {
        const that = this;

        WIN.removeEventListener('resize', that.onResize);
        that.parentRef.removeEventListener('scroll', that.onScroll);
    }

    /**
     * {@inheritDoc}
     */
    public render() {
        const that = this;
        const { props, parentRef } = that;
        const { isVertical } = props;
        const offset = '50%'; // always center

        const className = classNames(props.className, LOCAL_CLASS_NAME, {
            [LOCAL_CLASS_NAME + '--h']: !isVertical,
            [LOCAL_CLASS_NAME + '--v']: isVertical,
            [LOCAL_CLASS_NAME + '--legacy']: that.isLegacy,
        });

        const parentProps = {
            ref: (r: HTMLDivElement) => that.parentRef = r,
            className: className,
        };

        const frameInViewProps = {
            parent: parentRef,
            onChanges: that.onIntersect,
            offset: isVertical ? {top: offset, bottom: offset} : {left: offset, right: offset},
            offsetPercentageMode: ('self' as any),
            classNamesPrefix: LOCAL_CLASS_NAME,
        };

        return <div {...parentProps}>
            {parentRef && Children.map(props.children, (child, i) =>
                <InView key={i} {...frameInViewProps}>
                    <div className={LOCAL_CLASS_NAME + '__frame'}>{child}</div>
                </InView>
            )}
        </div>;
    }

    /**
     * Public API
     */
    /**
     * Scrolls to next item
     *
     * @return void
     */
    public next() {
        this.scrollTo(this.getNextIndex(true));
    }

    /**
     * Scrolls to previous item
     *
     * @return void
     */
    public prev() {
        this.scrollTo(this.getNextIndex(false));
    }

    /**
     * Scrolls to index
     *
     * @param {number} next
     * @param {boolean} instant
     */
    protected scrollTo = (next: number, instant: boolean = false) => {
        const that = this;
        const { parentRef, childrenRefs, props } = that;
        const parentClassList = parentRef.classList;
        const pauseSnapClass = LOCAL_CLASS_NAME + '--allow-scroll';

        const speed = instant ? 0 : props.scrollSpeed;
        const direction = props.isVertical ? 'Top' : 'Left';
        const offsetProp = 'offset' + direction;

        const nextChild = childrenRefs[next];
        if (!nextChild) {
            console.warn('No child at index %s', next);
            return;
        }

        that.isBusy = true;
        // parentClassList.add(pauseSnapClass);

        const pixels = nextChild[offsetProp] - parentRef[offsetProp];
        scrollTo(direction, parentRef, pixels, speed, props.scrollEasing, () => {
            // parentClassList.remove(pauseSnapClass);
            that.activeIndex = next;
            that.activeFrame = nextChild;
            that.isBusy = false;
        });
    };

    /**
     * Gets next item index depending on direction
     *
     * @param {boolean} fwd
     * @return {number}
     */
    protected getNextIndex(fwd: boolean) {
        const that = this;
        const total = React.Children.count(that.props.children);
        const current = that.activeIndex;

        return (fwd ? (current + 1) : (current + total - 1)) % total;
    }

    /**
     * Handles window resize
     *
     * @param {Event} e
     */
    protected onResize = (e: Event) => {
        const that = this;
        that.scrollTo(that.activeIndex, true);
    };

    /**
     * Handles parent scroll
     *
     * @param {MouseEvent} e
     */
    protected onScroll = (e: MouseEvent) => {
        // console.log(e);
        const that = this;

        if (!that.isBusy) {
            // that.scrollTo(that.activeIndex);
        }
    };

    protected onIntersect = (v: IVisibility, stop: any, subject: ISubject) => {
        const that = this;
        const  { childrenRefs } = that;

        if (!v.visible || that.isBusy) {
            return;
        }

        const actualIndex = Array.from(childrenRefs).indexOf(subject.element as HTMLDivElement);
        if (actualIndex !== that.activeIndex) {
            that.activeIndex = actualIndex;
            console.log('adjusted');

            // that.scrollTo(that.activeIndex);
        }
    };
}

/**
 * Sets element scroll-snap value
 *
 * @param {HTMLElement} element
 * @param value
 * @return {any}
 */
function setScrollSnap(element: HTMLElement, value: any) {
    const prop = 'scrollSnapType';
    const computedStyle = window.getComputedStyle(element, null);
    const prevValue = computedStyle[prop];

    element.style[prop] = value;

    return prevValue;
}

interface IProps extends React.HTMLAttributes<Frames> {

    // frame to start from, starting from 0
    startFrame?: number;

    // scroll direction
    isVertical?: boolean;

    // scroll speed
    scrollSpeed?: number;

    // scroll easing function name
    scrollEasing?: TEasing;
}
