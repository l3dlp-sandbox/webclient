/**
 * Register functionality
 */
mobile.register = {
    show: () => {
        'use strict';

        mega.ui.signup.showDialog();
    },

    toggleLoginContextBanner: (titleText, bodyText, type) => {
        'use strict';

        if (mobile.banner) {
            mobile.banner.hide('login-context', 0);
        }

        if (!bodyText) {
            return;
        }

        MegaMobileBanner.init();
        const banner = mobile.banner.show({
            name: 'login-context',
            title: titleText,
            msgText: bodyText,
            type,
            closeBtn: false
        });

        mBroadcaster.once('pagechange', () => {
            mobile.register.toggleLoginContextBanner();
        });

        banner.actionButton.hide();

        if (mega.ui.alerts) {
            mega.ui.alerts.removeClass('hidden');
        }
    },

    /**
     * Shows the screen with a spinning image while the RSA keys are being generated
     */
    showGeneratingKeysScreen: function() {

        'use strict';

        // Show animation
        $('.mobile.registration-generating-keys').removeClass('hidden');
    }
};


/**
 * Functions for the new secure registration process
 */
mobile.register.new = {

    /**
     * Start the registration process
     * @param {String} firstName The user's first name
     * @param {String} lastName The user's last name
     * @param {String} email The user's email address
     * @param {String} password The user's password
     * @param {Boolean} fromProPage Whether the registration started on the Pro page or not
     * @param {Function} completeCallback A function to run when the registration is complete
     */
    startRegistration: function(firstName, lastName, email, password, fromProPage, completeCallback) {

        'use strict';

        // Show loading dialog
        loadingDialog.show();

        // Set a flag to check at the end of the registration process
        localStorage.signUpStartedInMobileWeb = '1';

        loginFromEphemeral.rv.email = email;
        loginFromEphemeral.rv.password = password;

        // Start the new secure registration process
        security.register.startRegistration(firstName, lastName, email, password, fromProPage, completeCallback);
    },

    /**
     * Complete the initial registration process after sending the user a confirmation email
     * @param {Number} result The result of the API request that sent the user's a confirmation email
     * @param {String} firstName The user's first name
     * @param {String} lastName The user's last name
     * @param {String} email The user's email address
     */
    completeRegistration: function(result, firstName, lastName, email) {

        'use strict';
        loadingDialog.hide();
        // Set some variables which are saved for use later
        var registrationVars = {
            first: firstName,
            last: lastName,
            email: email,
            name: firstName + ' ' + lastName
        };

        // If successful result
        if (result === 0) {

            u_attr.terms = 1;

            security.register.cacheRegistrationData(registrationVars);

            // Try getting the plan number they selected on Pro page
            const planNum = sessionStorage.getItem('proPageContinuePlanNum');

            // If they did come from the Pro page, continue to Pro page Step 2 and skip email confirmation
            if (planNum !== null) {

                // Remove the flag as it's no longer needed
                sessionStorage.removeItem('proPageContinuePlanNum');

                // Continue to the Pro payment page
                loadSubPage('propay_' + planNum);
            }
            // If they were on a page and asked to login or register before accessing, return to that page
            else if (login_next) {
                if (typeof login_next === 'function') {
                    return login_next();
                }

                const nextPageAfterLogin = login_next;
                login_next = false;
                loadSubPage(nextPageAfterLogin);
            }
            else {
                // Otherwise show the signup email confirmation screen
                mega.ui.signup.showLinkDialog(registrationVars, null, true);
            }
        }

        // Show an error if the email is already in use
        else if (result === EEXIST) {
            mobile.messageOverlay.show(l[7869], '').then(() => {
                if (isEphemeral()) {
                    // Prevent the ephemeral session in mobile web if the email has been registered
                    u_logout(true);
                }
            });    // Error. This email address is already in use.
        }
        else if (result === EACCESS) {
            loginFromEphemeral.init();
        }
        else {
            // Show an error
            mobile.messageOverlay.show(l[47], result);      // Oops, something went wrong.
        }
    }
};
