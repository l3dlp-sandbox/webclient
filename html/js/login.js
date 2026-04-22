/**
 * Desktop signin/login functions
 */
var signin = {

    /**
     * Old method functions
     */
    old: {

        /**
         * Starts the login proceedure for v1 accounts
         * @param {String} email The user's email address
         * @param {String} password The user's password
         * @param {String|null} pinCode The two-factor authentication PIN code (6 digit number), or null if N/A
         * @param {Boolean} rememberMe Whether the user clicked the Remember me checkbox or not
         */
        startLogin: function(email, password, pinCode, rememberMe) {

            'use strict';

            postLogin(email, password, pinCode, rememberMe)
                .then((result) => {

                    signin.proceedWithLogin(result);
                })
                .catch(tell)
                .finally(() => {
                    const confirmButton = document.componentSelector('.confirm-account-dialog .login-button');

                    if (confirmButton) {
                        confirmButton.loading = false;
                    }
                });
        }
    },

    /**
     * New secure method functions
     */
    new: {

        /**
         * Start the login process
         * @param {String} email The user's email addresss
         * @param {String} password The user's password as entered
         * @param {String|null} pinCode The two-factor authentication PIN code (6 digit number), or null if N/A
         * @param {Boolean} rememberMe A boolean for if they checked the Remember Me checkbox on the login screen
         * @param {String} salt The user's salt as a Base64 URL encoded string
         */
        startLogin: function(email, password, pinCode, rememberMe, salt) {

            'use strict';

            // Start the login using the new process
            security.login.startLogin(email, password, pinCode, rememberMe, salt, function(result) {

                // Otherwise proceed with regular login
                signin.proceedWithLogin(result);
            });
        }
    },

    /**
     * Proceed to key generation step
     * @param {Number} result The result from the API, e.g. a negative error num or the user type
     */
    proceedWithKeyGeneration: function(result) {

        'use strict';

        hideConfirmAccountDialog();
        security.login.clearCachedLoginState();
        u_type = result;
        loadSubPage('key');
    },

    /**
     * Proceed to the login step
     * @param {Number} result The result from the API, e.g. a negative error num or the user type
     */
    proceedWithLogin: function(result) {

        'use strict';

        const confirmButton = document.componentSelector('.confirm-account-dialog .login-button');

        if (confirmButton) {
            confirmButton.loading = false;
        }

        // Check and handle the common login errors
        if (security.login.checkForCommonErrors(result, signin.old.startLogin, signin.new.startLogin)) {
            return false;
        }

        // If successful result
        if (result !== false && result >= 0) {

            // Otherwise if email confirm code is ok, proceed with RSA key generation
            if (confirmok) {
                signin.proceedWithKeyGeneration(result);
            }
            else {
                // Otherwise proceed with regular login
                u_type = result;

                if (login_next) {
                    loadSubPage(login_next);
                }
                else if (page !== 'login') {
                    init_page();
                }
                else {
                    loadSubPage('fm');
                }
                login_next = false;
            }
        }
        else {
            // Show a failed login
            $('#login-name2').megaInputsShowError().blur();
            $('#login-password2').megaInputsShowError(confirmok ? l[1102] : l[7431]).val('').blur();
            if (document.activeElement) {
                document.activeElement.blur();
            }
            $('#login-password2').select();
        }
    }
};

var login_txt = false;

(function(scope) {

    'use strict';

    function getConfirmAccContent() {
        const {login} = mega.ui;

        if (login.confirmAccountDialogContent) {
            return $(login.confirmAccountDialogContent);
        }

        const dialog = login.confirmAccountDialogContent = mCreateElement('div', {
            class: 'confirm-account-dialog hidden'
        });

        const form = mCreateElement('form', {
            class: 'login-form'
        }, dialog);

        const content = mCreateElement('div', {class: 'form-content'}, form);
        const title = mCreateElement('h2', {class: 'confirm-login-header'}, content);
        title.textContent = l[1131];

        const emailWrap = mCreateElement('div', {class: 'confirm-account-email'}, content);
        const avatarWrap = mCreateElement('div', {class: 'confirm-account-email-avatar'}, emailWrap);
        mCreateElement('div', {class: 'avatar-wrapper small-rounded-avatar'}, avatarWrap);
        mCreateElement('div', {class: 'confirm-account-email-details'}, emailWrap);

        mCreateElement('input', {
            type: 'hidden',
            name: 'login-name2',
            id: 'login-name2',
            value: ''
        }, content);

        mCreateElement('input', {
            type: 'password',
            class: 'pmText',
            name: 'login-password2',
            id: 'login-password2',
            title: l[909],
            autocomplete: 'current-password'
        }, content);

        mCreateElement('div', {class: 'clear'}, content);
        mCreateElement('div', {class: 'footer-container'}, form);

        return $(dialog);
    }

    function hideConfirmAccountDialog() {
        const $dialog = getConfirmAccContent();
        const component = mega.ui.auth.getDialogComponent(page === 'login');

        $dialog.addClass('hidden');

        if (component) {
            component.hide('confirm-account-dialog');
            component.removeClass('page-bound');
        }

        confirmok = false;
    }

    function showConfirmAccountDialog(email) {

        const $dialog = getConfirmAccContent();
        const pageBound = page === 'login';
        const component = mega.ui.auth.getDialogComponent(pageBound);

        if (!component) {
            return;
        }

        const dialogNode = $dialog[0];
        const submitWrap = dialogNode.querySelector('.footer-container');
        const $password = $('#login-password2', $dialog);
        const $name = $('#login-name2', $dialog);
        const $email = $('.confirm-account-email-details', $dialog);
        const $avatar = $('.confirm-account-email-avatar .small-rounded-avatar', $dialog);
        if (submitWrap && !submitWrap.megaButton) {
            submitWrap.megaButton = new MegaButton({
                parentNode: submitWrap,
                componentClassname: 'mega-button login-button right',
                text: l[870],
                typeAttr: 'button'
            });
        }

        const $button = $(submitWrap && submitWrap.megaButton && submitWrap.megaButton.domNode);
        const $inputs = $password.add($button);

        if (email) {
            const meta = generateAvatarMeta(email);

            $name.val(email);
            $email.text(email);
            $avatar.attr('class', `avatar-wrapper small-rounded-avatar color${meta.color}`);
            $avatar.text(email[0].toUpperCase());
        }
        else {
            $name.val('');
            $email.text('');
            $avatar.attr('class', 'avatar-wrapper small-rounded-avatar');
            $avatar.text('');
        }

        const showOptions = {
            name: 'confirm-account-dialog',
            classList: ['confirm-account-dialog-overlay'],
            showClose: !pageBound,
            actionOnBottom: false,
            contents: [dialogNode],
            preventBgClosing: true,
            onClose: () => {
                if (pageBound) {
                    component.removeClass('page-bound');
                }
            },
            noBlurBackground: pageBound
        };

        if (!is_mobile) {
            showOptions.type = 'modal';
            showOptions.sheetHeight = 'auto';
            showOptions.sheetWidth = 'auto';
        }

        component.show(showOptions);

        if (is_mobile || pageBound) {
            placeLangBtnToLogin(is_mobile ? component : false);
        }
        $dialog.removeClass('hidden');

        if (pageBound) {
            component.addClass('page-bound');
            onIdle(() => {
                $('.fm-dialog-overlay').addClass('hidden');
            });
        }

        $inputs.rebind('keydown.initlogin', (e) => {
            if (e.keyCode === 13) {
                e.preventDefault();
                pagelogin();
                return false;
            }
        });

        bindLoginHandler({buttonEl: $button});
        window.accountinputs.init($dialog);

        onIdle(() => {
            $password.val('').trigger('focus');
        });
    }

    // This now only using as confirm page
    function pagelogin() {

        const $formWrapper = getConfirmAccContent();
        const confirmButton = $formWrapper[0].componentSelector('.login-button');
        const $password = $('#login-password2', $formWrapper);
        const e = confirmok ? $('.confirm-account-email-details', $formWrapper).text() :
            $('#login-name2', $formWrapper).val();

        if (!$password.val()) {
            $password.megaInputsShowError(l[1791]);
            $password.focus();
        }
        else if (confirmButton && (confirmButton.loading || confirmButton.disabled)) {
            if (d) {
                console.warn('Aborting login procedure, there is another ongoing...');
            }
        }
        else {
            if (confirmButton) {
                confirmButton.loading = true;
                confirmButton.disabled = true;
                tSleep(9).then(() => {
                    confirmButton.disabled = false;
                });
            }

            var email = e;
            var password = $password.val();
            var rememberMe = true;
            var twoFactorPin = null;

            // Checks if they have an old or new registration type, after this the flow will continue to login
            security.login.checkLoginMethod(email, password, twoFactorPin, rememberMe,
                                            signin.old.startLogin,
                                            signin.new.startLogin);
        }

        return false;
    }

    function postLogin(email, password, pinCode, remember) {

        return new Promise((resolve) => {

            var ctx = {
                checkloginresult(ctx, result) {
                    const {u_k} = window;

                    // Check if we can upgrade the account to v2
                    security.login.checkToUpgradeAccountVersion(result, u_k, password)
                        .catch(dump)
                        .finally(() => resolve(result));
                }
            };
            var passwordaes = new sjcl.cipher.aes(prepare_key_pw(password));
            var uh = stringhash(email.toLowerCase(), passwordaes);

            u_login(ctx, email, password, uh, pinCode, remember);
        });
    }

    /**
     * Binds the login button handler
     *
     * @param options - {buttonEl, withEvents} - Options object
     * @param {jQuery} [options.buttonEl] The button element to bind the handler to.
     * If not provided, it will default to the login button within the main login form.
     * @param {boolean} [options.withEvents=true] Whether to log events when the button is clicked.
     *
     * @returns {void}
     */
    function bindLoginHandler(options) {

        const {buttonEl, withEvents = true} = options;
        const $button = buttonEl || $('button.login-button', $('.main-mid-pad.login'));

        $button.rebind('click.initlogin', () => {

            pagelogin();
            if (withEvents) {

                eventlog(99796);

                if (confirmok) {
                    eventlog(500813);
                }
            }
        });
    }

    function placeLangBtnToLogin(component) {

        const _buildLinks = (parent) => {

            let versionNode = parent.querySelector('.login-page-client-version');

            if (!versionNode) {
                versionNode = mCreateElement('span', {class: 'login-page-client-version'}, parent);
            }

            versionNode.textContent = `V.${buildVersion && buildVersion.website || 'dev'}`;

            let links = parent.querySelector('.login-page-footer-links');

            if (!links) {

                links = mCreateElement('div', {class: 'login-page-footer-links'}, parent);

                const defaultOptions = {
                    parentNode: links,
                    type: 'text',
                    componentClassname: 'clickurl',
                    target: '_blank'
                };

                MegaLink.factory(Object.assign({href: l.mega_help_host, text: l[384]}, defaultOptions));
                MegaLink.factory(Object.assign({href: 'https://mega.io/terms', text: l[385]}, defaultOptions));
            }

            return links;
        };

        let footer = null;

        if (component) {
            footer = component.footerNode;
            const hasFooterContent = footer && footer.childNodes.length > 0;

            if (hasFooterContent) {
                footer.classList.add('login-page-footer');
                _buildLinks(footer);
            }
            else {
                const links = _buildLinks(document.createElement('div'));

                component.addFooter({
                    classList: ['login-page-footer'],
                    slot: [links]
                }, true);

                footer = component.footerNode;
            }
        }
        else if (!is_mobile) {
            const shell = document.querySelector('.login-page-shell');

            if (shell) {
                footer = shell.querySelector('.login-page-footer')
                    || mCreateElement('footer', {class: 'login-page-footer'}, shell);

                _buildLinks(footer);
            }
        }

        if (footer && !footer.querySelector('.login-page-lang')) {

            MegaButton.factory({
                parentNode: footer,
                type: 'normal',
                componentClassname: 'login-page-lang action-link underline',
                icon: 'sprite-fm-mono icon-globe-01-thin-outline',
                iconSize: 16,
                text: getRemappedLangCode(lang).toUpperCase()
            }).on('click', () => {

                if (is_mobile) {
                    mobile.languageMenu.init();
                }
                else {
                    langDialog.show();
                }

                return false;
            });
        }
    }

    // This may just use as confirmation purpose

    function init_login(email) {

        if (!is_mobile) {
            placeLangBtnToLogin();
        }

        if (confirmok) {
            showConfirmAccountDialog(email);
        }
        else {
            hideConfirmAccountDialog();

            if ($.dialog && $.dialog !== 'pro-login-dialog') {
                closeDialog();
            }

            mega.ui.login.openDialog();
        }
    }

    mega.ui.auth = mega.ui.auth || {};
    mega.ui.login = mega.ui.login || {};

    scope.login_email = false;
    scope.postLogin = postLogin;
    scope.bindLoginHandler = bindLoginHandler;
    scope.placeLangBtnToLogin = placeLangBtnToLogin;
    scope.init_login = init_login;

})(this);

/**
 * Logic for the Account forms Inputs behaviour
*/
var accountinputs = {

    /**
     * Initialise inputs events
     * @param {Object} $formWrapper. DOM form wrapper.
     */
    init($formWrapper) {

        'use strict';

        if (!$formWrapper.length) {
            return false;
        }

        var $inputs = $('input:not([type="checkbox"])', $formWrapper);
        mega.ui.MegaInputs($inputs.filter(':not(.megaInputs)'));

        onIdle(() => {
            $inputs.first().focus();
        });

        const focusSelector = 'input:visible, a:visible, button:visible';
        const $focus = $(focusSelector, $formWrapper);
        const $firstFocus = $focus.first();
        const $lastFocus = $focus.last();
        const $header = $('.login-page-header');
        const $headerFocus = $(focusSelector, $header);
        const $lastHeaderFocus = $headerFocus.last();
        const $footer = $('.login-page-footer');
        const $footerFocus = $(focusSelector, $footer);
        const $firstFooterFocus = $footerFocus.first();

        const tapPrevMap = new Map();
        tapPrevMap.set($firstFocus[0], $lastHeaderFocus[0]);
        tapPrevMap.set($firstFooterFocus[0], $lastFocus[0]);

        const tapNextMap = new Map();
        tapNextMap.set($lastFocus[0], $firstFooterFocus[0]);
        tapNextMap.set($lastHeaderFocus[0], $firstFocus[0]);

        $focus.add($headerFocus).add($footerFocus).rebind('keydown.commonevent', e => {

            if (e.key !== 'Tab' || page !== 'login' || page !== 'register') {
                return;
            }

            if (e.shiftKey) {

                const prevFocus = tapPrevMap.get(e.currentTarget);

                if (prevFocus) {

                    prevFocus.focus();
                    return false;
                }
            }
            else {
                const nextFocus = tapNextMap.get(e.currentTarget);

                if (nextFocus) {

                    nextFocus.focus();
                    return false;
                }
            }
        });

        return $formWrapper;
    }
};
