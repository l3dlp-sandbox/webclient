lazy(mega.slideshow.settings, 'playVid', () => {
    'use strict';

    const name = 'playVid';

    return new class SlideshowPlayVidSetting extends mega.slideshow.settings.switch {
        /**
         * repeat setting handler
         * @returns {SlideshowPlayVidSetting} instance
         */
        constructor() {
            super(name, 0);
        }

        onConfigChange() {
            mega.slideshow.manager.setState({});
        }
    };
});
