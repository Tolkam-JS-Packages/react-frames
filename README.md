# tolkam/react-frames

Base for building slider-like (carousel) components.

## Usage

````tsx
import { render } from 'react-dom';
import Frames from '@tolkam/react-frames';

const element = <Frames swipeable loop>
    <div>Frame One - swipe me</div>
    <div>Frame Two - swipe me</div>
    <div>Frame Three - swipe me</div>
</Frames>

render(element, document.getElementById('app'));
````

## Documentation

The code is rather self-explanatory and API is intended to be as simple as possible. Please, read the sources/Docblock if you have any questions. See [Usage](#usage) and [IProps](/src/index.tsx#L451) for quick start.

## License

Proprietary / Unlicensed 🤷
