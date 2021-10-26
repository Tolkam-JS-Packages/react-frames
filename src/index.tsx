import { Children, ReactChildren, ReactNode, PureComponent, HTMLProps } from 'react';
import { classNames } from '@tolkam/lib-utils-ui';
import { throttle } from '@tolkam/lib-utils';
import { getLongestDuration } from '@tolkam/lib-css-events';
import * as Hammer from 'hammerjs';
import './defaults.scss';

const WIN = window;
const WIN_EVENTS = 'load resize';
const LOCAL_CLASS_NAME = 'rAgXf';

export default class Frames extends PureComponent<IProps, any> {

    /**
     * Default props
     * @type {IProps}
     */
    public static defaultProps = {
        startFrame: 0,
        frameBoundary: 0.25,
        loop: false,
        clonesCount: 2,
        draggingClass: 'is-dragging',
        transitionClass: 'is-moving',
    };

    /**
     * Pointer event names
     * @type {string}
     */
    public readonly SWIPE_PREV: string = 'swipeleft';
    public readonly SWIPE_NEXT: string = 'swiperight';
    public readonly PAN_PREV: string = 'panleft';
    public readonly PAN_NEXT: string = 'panright';
    public readonly PAN_START: string = 'panstart';
    public readonly PAN_END: string = 'panend';
    public readonly PAN_CANCEL: string = 'pancancel';

    /**
     * Hammer instance
     * @type {HammerManager}
     */
    protected hammer: HammerManager;

    /**
     * Scrolling element
     * @type {HTMLDivElement}
     */
    protected parent: HTMLDivElement;

    /**
     * Frames container
     * @type {NodeList}
     */
    protected container: HTMLDivElement;

    /**
     * Frame elements
     * @type {NodeList}
     */
    protected frames: NodeListOf<HTMLDivElement>;

    /**
     * Current frames size
     * @type {number}
     */
    protected frameSize = 0;

    /**
     * Index of current active frame
     * @type {number}
     */
    protected activeIndex = 0;

    /**
     * @param {IProps} props
     */
    public constructor(props: IProps) {
        super(props);

        // throttled, so fires every N ms at most
        this.onWindowChanges = throttle(this.onWindowChanges, 100);

        // adjust axis
        if (props.isVertical) {
            this.SWIPE_PREV = 'swipeup';
            this.SWIPE_NEXT = 'swipedown';
            this.PAN_PREV = 'panup';
            this.PAN_NEXT = 'pandown';
        }

        this.activeIndex = props.startFrame!;
    }

    /**
     * {@inheritDoc}
     */
    public componentDidMount() {
        const that = this;
        const props = that.props;
        const isVertical = props.isVertical;

        // setup Hammer
        // @see https://github.com/hammerjs/hammer.js/issues/1050
        const direction = Hammer.DIRECTION_ALL;
        const touchAction = 'pan-' + (isVertical ? 'x' : 'y');

        that.hammer = new Hammer.Manager(that.parent, {
            recognizers: [
                [Hammer.Swipe, { direction }],
                [Hammer.Pan, { direction, threshold: 5, pointers: 0 }, ['swipe']],
            ],
            touchAction,
        });

        const events = [];
        if (props.swipeable) {
            events.push(that.SWIPE_PREV, that.SWIPE_NEXT);
        }
        if (props.draggable) {
            events.push(that.PAN_START, that.PAN_PREV, that.PAN_NEXT, that.PAN_END, that.PAN_CANCEL);
        }

        that.hammer.on(events.join(' '), that.onEvents);
        Hammer.on(WIN, WIN_EVENTS, that.onWindowChanges);

        // calculate sizes and populate values
        that.init();
    }

    /**
     * {@inheritDoc}
     */
    public componentDidUpdate() {
        this.init();
    }

    /**
     * {@inheritDoc}
     */
    public componentWillUnmount() {
        this.hammer.destroy();
        Hammer.off(WIN, WIN_EVENTS, this.onWindowChanges);
    }

    /**
     * {@inheritDoc}
     */
    public render() {
        const that = this;
        const { props } = that;

        const framesProps = {
            className: props.frameClass,
        };

        return <div
            ref={(r: HTMLDivElement) => that.parent = r}
            className={classNames(props.className, LOCAL_CLASS_NAME)}
        >
            <div className={props.containerClass}>
                {that.getChildren(props.children, framesProps, (props.loop! ? that.getClonesCount() : 0))}
            </div>
        </div>;
    }

    /**
     * Moves to next item
     *
     * @return void
     */
    public next() {
        this.goToFrame(this.getNextIndex(true));
    }

    /**
     * Moves to previous item
     *
     * @return void
     */
    public prev() {
        this.goToFrame(this.getNextIndex(false));
    }

    /**
     * Goes to specified index
     *
     * @param {number} index
     */
    public goTo(index: number) {
        const that = this;

        // compensate 'public' index and internal one (with clones)
        that.goToFrame(that.props.loop ? index + that.getClonesCount() : index);
    }

    /**
     * Recalculates sizes and positions
     *
     * @return void
     */
    public recalculate() {
        this.init();
    }

    /**
     * Gets parent HTMLElement
     *
     * @return {HTMLDivElement}
     */
    public get parentElement(): HTMLDivElement {
        return this.parent;
    }

    /**
     * Renders children, optionally with clones
     *
     * @return {any}
     */
    protected getChildren(children: ReactChildren | ReactNode, childrenProps: any, clonesCount: number) {
        const childrenArr = Children.toArray(children);
        const childrenCount = childrenArr.length;
        const withClones = childrenArr.slice();

        if (!childrenCount) {
            return null;
        }

        if (clonesCount) {
            // pre clones
            for (let i = childrenCount - 1; i >= (childrenCount - clonesCount); i--) {
                withClones.unshift(childrenArr[i]);
            }

            // post clones
            for (let i = 0; i < clonesCount; i++) {
                withClones.push(childrenArr[i]);
            }
        }

        return withClones.map((child: any, i) => {
            return <div {...childrenProps} key={i}>{child}</div>;
        });
    }

    /**
     * Initializes elements and sizes
     *
     * @return void
     */
    protected init() {
        const that = this;

        // collect children
        that.container = that.parent.firstChild as HTMLDivElement;
        that.frames = that.container.childNodes as NodeListOf<HTMLDivElement>;

        // set element sizes store current frame size
        that.frameSize = that.setSizes();

        // activate current frame
        that.goToFrame(that.activeIndex, false);
    }

    /**
     * Handles pointer events
     *
     * @param {HammerInput} e
     */
    protected onEvents = (e: HammerInput) => {
        const that = this;
        const { hammer, activeIndex, frameSize, props } = that;
        let delta = e['delta' + (props.isVertical ? 'Y' : 'X')];

        // @see https://github.com/hammerjs/hammer.js/issues/1050
        if (e.srcEvent.type === 'pointercancel') {
            return;
        }

        switch (e.type) {
            case(that.PAN_PREV) :
            case(that.PAN_NEXT) :
                const framePos = -activeIndex * frameSize;

                // switch to next frame as soon as panned to it
                if (Math.abs(delta) > frameSize) {
                    delta > 0 ? that.prev() : that.next();
                    hammer.stop(true);
                    break;
                }

                // slow down when not in loop mode and no frames left
                if (that.isOutOfBounds(framePos + delta) && !props.loop) {
                    delta *= 0.15;
                }

                that.moveContainerBy(framePos + delta);
                break;

            case(that.SWIPE_PREV) :
            case(that.SWIPE_NEXT) :
                delta > 0 ? that.prev() : that.next();
                hammer.stop(true);
                break;

            case(that.PAN_END) :
            case(that.PAN_CANCEL) :
                if (Math.abs(delta) > frameSize * props.frameBoundary!) {
                    delta > 0 ? that.prev() : that.next();
                } else {
                    that.goToFrame(activeIndex);
                }
                break;
        }
    };

    /**
     * Handles window size changes
     *
     * return void
     */
    protected onWindowChanges = () => {
        this.init();
    };

    /**
     * Shows frame by index
     *
     * @param {number} index
     * @param {boolean} animate
     */
    protected goToFrame(index: number, animate: boolean = true) {
        const that = this;
        const { frames, props } = that;
        const { onFrameUpdate, loop } = props;
        const framesCount = frames.length;

        if (!framesCount || index < 0 || index > framesCount) {
            return;
        }

        that.moveContainerBy(-index * that.frameSize, animate, () => {
            const clonesCount = that.getClonesCount();
            const firstRealIndex = clonesCount;
            const lastRealIndex = (framesCount - 1) - clonesCount;

            // if loop - skip clone to next frame without animation
            if (loop && (index < firstRealIndex || index > lastRealIndex)) {

                const isForward = that.activeIndex <= index; // treat same indexes as forward

                that.goToFrame(isForward ? firstRealIndex : lastRealIndex, false);
            } else {
                that.activeIndex = index;

                // compensate 'public' index and internal one (with clones)
                onFrameUpdate && onFrameUpdate(loop ? index - clonesCount : index);
            }
        });
    }

    /**
     * Moves container by specified amount
     *
     * @param {number} pixels
     * @param {boolean} animate
     * @param {() => any} done
     */
    protected moveContainerBy(pixels: number, animate: boolean = false, done?: () => any) {
        const that = this;
        const { props, container, parent } = that;
        const classList = parent.classList;
        const transitionClass = props.transitionClass!;

        container.style['transform'] = `translate${(props.isVertical ? 'Y' : 'X')}(${pixels}px)`;

        if (animate) {
            classList.add(transitionClass);
            setTimeout(() => {
                classList.remove(transitionClass);
                done && done();
            }, getLongestDuration(container));
        } else {
            done && done();
        }
    }

    /**
     * Calculates next valid frame index
     *
     * @param {boolean} forward
     * @return {number}
     */
    protected getNextIndex(forward: boolean) {
        const that = this;
        const current = that.activeIndex;

        return forward ? Math.min(current + 1, that.frames.length - 1) : Math.max(current - 1, 0);
    }

    /**
     * Ensures that clones count is not higher than children count
     *
     * @return {number}
     */
    protected getClonesCount(): number {
        const props = this.props;
        return Math.min(props.clonesCount!, Children.count(props.children));
    }

    /**
     * Checks if container position is out of bounds
     *
     * @return {boolean}
     */
    protected isOutOfBounds(position: number) {
        const that = this;
        const { frameSize, frames, activeIndex } = that;
        const last = frames.length - 1;

        return (activeIndex === 0 && position >= 0) || (activeIndex === last && position <= -frameSize * last);
    }

    /**
     * Sets container and frames sizes
     *
     * @return number
     */
    protected setSizes(): number {
        const that = this;
        const { parent, container, frames, props } = that;
        const isVertical = props.isVertical;
        const dimension = !isVertical ? 'Width' : 'Height';
        const dimensionLower = dimension.toLowerCase();
        const framesCount = frames.length;

        container.style[dimensionLower] = (framesCount * 100) + '%';
        frames.forEach((child) => {
            if ((child instanceof HTMLElement)) {
                child.style[dimensionLower] = (100 / framesCount) + '%';
            }
        });

        // return parent['client' + dimension];

        // fractional value to move with a less than one pixel precision
        return parent.getBoundingClientRect()[dimensionLower];
    }
}

interface IProps extends HTMLProps<Frames> {

    // dragging enabled
    draggable?: boolean;

    // swiping enabled
    swipeable?: boolean;

    // move direction
    isVertical?: boolean;

    // number between 0 and 1 - percentage of visible frame to consider as active
    frameBoundary?: number;

    // frame to start from, starting from 0
    startFrame?: number;

    // cycle frames
    loop?: boolean;

    // number of clones in loop mode
    clonesCount?: number;

    // class names
    containerClass?: string;
    frameClass?: string;
    draggingClass?: string;
    transitionClass?: string;

    // frame update callback
    onFrameUpdate?: (activeIndex: number) => void;
}
