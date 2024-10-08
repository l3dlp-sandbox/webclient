
/** Initialise they keys required for operation. */
function init_key() {
    if (typeof u_k_aes === 'undefined') {
        return loadSubPage('start');
    }
    $('.key1').addClass('hidden');
    $('.key2').removeClass('hidden');

    if (typeof u_privk === 'undefined') {
        crypto_rsagenkey();
    }
    else {
        ui_keycomplete();
    }
}

/** Callback called on completion. */
function ui_keycomplete() {
    $('.key1').addClass('hidden');
    $('.key2').addClass('hidden');
    $('.key3').removeClass('hidden');

    // Sets the "Hide Recent Activity" toggle in Settings to `OFF` by default
    mBroadcaster.once('fm:initialized', () => {
        // The value for `showRecents` is `undefined` when toggle is `ON`
        mega.config.set('showRecents', 1);
    });

    const campaignTagger = () => {
        const parse = tryCatch((v) => JSON.parse(v));

        let utm = localStorage.uTagUTM || sessionStorage.uTagUTM;
        if (utm) {
            utm = parse(utm).tags;
        }

        let mtm = localStorage.uTagMTM || sessionStorage.uTagMTM;
        if (mtm) {
            mtm = parse(mtm).tags;
        }

        if (utm || mtm) {
            const payload = JSON.stringify({ ...utm, ...mtm });
            eventlog(500510, payload);

            delete localStorage.uTagUTM;
            delete localStorage.uTagMTM;
            delete sessionStorage.uTagUTM;
            delete sessionStorage.uTagMTM;
        }
    };
    onIdle(campaignTagger);

    if ((typeof (u_attr.p) !== 'undefined') && (u_attr.p >= 1 && u_attr.p <= 4)) {
        loadSubPage('fm');
    }
    else {
        localStorage.keycomplete = true;
        sessionStorage.signinorup = 2;

        // If mobile, log to see how many registrations are completed on mobile and load the cloud drive
        if (is_mobile) {

            // Check if they actually started the registration process on mobile web
            if (localStorage.signUpStartedInMobileWeb) {

                // Remove the flag as it's no longer needed and send a stats log
                localStorage.removeItem('signUpStartedInMobileWeb');
                api_req({ a: 'log', e: 99639, m: 'Started and completed registration on mobile webclient' });
            }
            else {
                // Otherwise they just completed sign up on the mobile web and may have started it on a mobile app
                api_req({ a: 'log', e: 99627, m: 'Completed registration on mobile webclient' });
            }
        }
        else {
            // Otherwise log to see how many registrations are completed on regular webclient
            api_req({ a: 'log', e: 99628, m: 'Completed registration on regular webclient' });
        }

        // if this is a sub-user in a business account.
        // either This is the master  --> wont get the confirmation link until we receive successful payment
        // or, this is a sub-user --> no need to ask them anything after this point
        if (u_attr && u_attr.b) {
            if (page === 'fm') {
                loadSubPage('start');
            }
            else {
                loadSubPage('fm');
            }
        }
        else {
            onIdle(function() {
                authring.initAuthenticationSystem();
            });
            // Load the Pro page to choose plan, or the redeem page if a pending voucher is found.
            loadSubPage(localStorage.voucher ? 'redeem' : 'pro');
        }
    }
}
