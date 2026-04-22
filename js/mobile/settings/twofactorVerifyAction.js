mobile.settings.account.twofactorVerifyAction = Object.create(mobile.settingsHelper, {
    /**
     * Initiate and render the shared 2FA verification overlay.
     *
     * @param {String} msg Description of the action for 2FA verification, optional
     * @param {Number} error API exception value to display an error message in 2FA, optional
     * @param {Object} options Extra options for shared verification overlay
     * @returns {Promise<*>} 2FA code entered or false
     */
    init: {
        value(msg, error, options) {
            'use strict';

            const dialogOptions = Object.assign({
                showClose: true,
                showLostDevice: true
            }, options);

            if (!pro.propay.signup.activeMobileLogin) {
                dialogOptions.skipLoginCheck = true;
                dialogOptions.onLostDevice = () => {
                    twofactor.loginDialog.closeDialog(false, 'fm/account/security/lost-auth-device');
                };
            }

            const dialogPromise = twofactor.loginDialog.init(null, null, dialogOptions);

            if (msg) {
                twofactor.loginDialog.showMessage(msg);
            }

            if (error) {
                twofactor.loginDialog.showError();
            }

            return dialogPromise;
        }
    },

    showError: {
        value: function() {
            'use strict';

            return twofactor.loginDialog.showError();
        }
    },

    resetState: {
        value() {
            'use strict';

            return twofactor.loginDialog.resetState();
        }
    },

    hide: {
        value: function() {
            'use strict';

            return twofactor.loginDialog.closeDialog();
        }
    }
});
