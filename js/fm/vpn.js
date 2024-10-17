/** Scripting for VPN-related tasks. */
class VpnCredsManager {
    logIt() {
        console.log('Non-static member.'); // Jenkins
    }

    static getLocations() {

        return api.req({a: 'vpnr'})
            .then(({result}) => {
                assert(Array.isArray(result));

                return result;
            })
            .catch((ex) => {
                console.error('[VPN Manager] Unexpected error from API when fetching locations.', ex);
            });
    }

    static getActiveCredentials() {

        return api.req({a: 'vpng'})
            .then(({result}) => {
                assert(typeof result === 'object');

                return result;
            })
            .catch((ex) => {
                if (ex === ENOENT) {
                    return ex;
                }

                console.error('[VPN Manager] Unexpected error from API when fetching active credentials.', ex);
            });
    }

    static async createCredential() {
        const keypair = nacl.box.keyPair();

        return api.req({a: 'vpnp', k: ab_to_base64(keypair.publicKey)})
            .then(({result}) => {
                assert(typeof result === 'object');

                const cred = {
                    credNum: result[0],
                    vpnSubclusterId: result[1],
                    interfaceV4Address: result[2],
                    interfaceV6Address: result[3],
                    peerPublicKey: result[4],
                    locations: result[5],
                    keypair: keypair,
                };

                return cred;
            })
            .catch((ex) => {
                if (ex === EACCESS) {
                    console.warn('[VPN Manager] You are not authorised to create VPN credentials. '
                        + 'Upgrade to Pro, then try again.');
                    return ex;
                }
                if (ex === ETOOMANY) {
                    console.warn('[VPN Manager] You have exceeded your credential limit. '
                        + 'Please deactivate one credential, then try again.');
                    return ex;
                }

                console.error('[VPN Manager] Unexpected error from API when creating a credential.', ex);
            });
    }

    static deactivateCredential(slotNum) {

        return api.req({a: 'vpnd', s: slotNum})
            .then(({result}) => {
                assert(result === 0);

                return result;
            })
            .catch((ex) => {
                console.error('[VPN Manager] Unexpected error from API when deactivating a credential.', ex);
            });
    }

    static generateIniConfig(cred, locationIndex = 0) {
        // assemble endpoint
        let endpoint = `${cred.locations[locationIndex]}.vpn`;
        if (cred.vpnSubclusterId > 1) {
            endpoint += cred.vpnSubclusterId;
        }
        endpoint += '.mega.nz:51820';

        let config = '[Interface]\n';
        config += `PrivateKey = ${btoa(ab_to_str(cred.keypair.secretKey))}\n`;
        config += `Address = ${cred.interfaceV4Address}/32, ${cred.interfaceV6Address}/128\n`;
        config += 'DNS = 8.8.8.8, 2001:4860:4860::8888\n\n';
        config += '[Peer]\n';
        config += `PublicKey = ${btoa(base64urldecode(cred.peerPublicKey))}\n`;
        config += 'AllowedIPs = 0.0.0.0/0, ::/0\n';
        config += `Endpoint = ${endpoint}\n`;
        return config;
    }
}

/** Frontend scripting specific to the VPN page. */
class VpnPage {
    constructor() {
        this.page = document.querySelector('.fm-right-account-block .fm-account-vpn');
        this.credsContainer = this.page.querySelector('.creds-container');
        this.credTpl = this.page.querySelector('template#cred-slot-tpl');
        this.createCredBtn = this.page.querySelector('.js-create-cred');
        this.postCreateSection = this.page.querySelector('.post-create-section');
        this.emailSupport = this.page.querySelector('.email-support');
        this.downloadConfigBtn = this.postCreateSection.querySelector('.js-download-config');
        this.configQr = this.postCreateSection.querySelector('.config-qr .qr-img');
        this.configDiv = this.postCreateSection.querySelector('.config-output');
        this.configText = this.postCreateSection.querySelector('.config-text');

        this.knownSlotCount = 5;

        this._initLocationDropdown();

        const planName = pro.getProPlanName(u_attr.p);

        const mailtoBody = `${l.support_email_prefill_write_feedback}



                            ${l.support_email_prefill_user_app_info}
                            ${l.support_email_prefill_user_app_name} ${l.pr_vpn}

                            ${l.support_email_prefill_user_information}
                            ${l[670]}: ${lang}
                            ${l.support_email_prefill_user_timezone} ${mega.ipcc}
                            ${l.support_email_prefill_user_account} ${u_attr.email} (${planName})`;

        this.emailSupport.href = `${this.emailSupport.href}&body=${encodeURIComponent(mailtoBody)}`;

        this.createCred = this.createCred.bind(this);
        this.removeCred = this.removeCred.bind(this);
        this._onCredCreated = this._onCredCreated.bind(this);
        this._onCredDeactivated = this._onCredDeactivated.bind(this);

        this.createCredBtn.addEventListener('click', this.createCred);

        // this.postCreateSection.querySelector('.view-ini-config').addEventListener('click', () => {
        //     this.configDiv.classList.remove('hidden');
        // });

        this.page.querySelector('.js-vpn-client-desktop.windows').addEventListener('click', () => {
            eventlog(99858); // "Windows desktop app download"
        });

        this.page.querySelector('.js-vpn-client-desktop.macos').addEventListener('click', () => {
            eventlog(99870); // "MacOS desktop app download"
        });

        this.page.querySelector('.upgrade-to-pro').addEventListener('click', () => {
            eventlog(99856); // "VPN page upgrade acct (via page)"
        });
        this.page.querySelector('.js-download-config').addEventListener('click', () => {
            // Avoid OS behaviour of adding (x) to duplicate downloaded files
            // as the WireGuard client apparently won't work with parenthesis in the filename.
            let randomStr = '';
            for (let i = 0; i < 8; i++) {
                const ascii = (Math.random() < 0.5 ? 65 : 97) + Math.floor(Math.random() * 26);
                randomStr += String.fromCharCode(ascii);
            }

            this.downloadConfigBtn.download = `vpn-${this.downloadConfigBtn.dataset.credNum}-${randomStr}.conf`;
        });

        if (u_attr.p && u_attr.p > 0
            || pro.proplan2.getUserFeature('vpn')
            || d && apipath === 'https://staging.api.mega.co.nz/'){
            this.page.querySelector('.settings-left-block .free-info').classList.add('hidden');
            this.page.querySelector('.settings-left-block .pro-info').classList.remove('hidden');
            this.page.querySelector('.step2-out').classList.remove('hidden');
            eventlog(99855); // "VPN page open (Pro acct)"
        }
        else {
            eventlog(99849); // "VPN page open (Free acct)"
        }

        initPerfectScrollbar($('.disclaimer' , '.settings-left-block'));

        $('.download-qr.android .qr-img', this.page).qrcode({
            width: 230,
            height: 230,
            correctLevel: QRErrorCorrectLevel.H,
            text: 'https://play.google.com/store/apps/details?id=mega.vpn.android.app',
        });
        $('.download-qr.ios .qr-img', this.page).qrcode({
            width: 230,
            height: 230,
            correctLevel: QRErrorCorrectLevel.H,
            text: 'https://apps.apple.com/app/mega-vpn-privacy-online/id6456784858',
        });
    }

    async _initLocationDropdown() {
        const knownNames = {
            'CA-EAST': l.vpn_location_ca_east,
            'CA-WEST': l.vpn_location_ca_west,
            'US-EAST': l.vpn_location_us_east,
            'US-WEST': l.vpn_location_us_west
        };

        const options = { };
        const locations = await VpnCredsManager.getLocations();
        const countries = M.getCountries();

        for (const location of locations) {
            // Check for specific known names first
            if (knownNames[location]) {
                options[location] = knownNames[location];
                continue;
            }

            // Else try by assuming a country code
            if (countries[location]) {
                options[location] = countries[location];
                continue;
            }

            // Still unaccounted for? Try splitting the location - 1st half is probably a country code
            const country = location.split('-', 1);
            if (countries[country[0] || '']) {
                options[location] = `${countries[country]} ${location}`;
                continue;
            }

            // Options exhausted; just use the location code as the option label.
            options[location] = location;
        }

        this.$locationDropdown = $('.location-dropdown', this.page);

        const sortedOptions = Object.fromEntries(Object.entries(options)
            .sort((code, location) => code[1].localeCompare(location[1])));

        const selectedLocation = sortedOptions[Object.keys(sortedOptions)[0]];

        createDropdown(this.$locationDropdown, {
            placeholder: selectedLocation,
            items: sortedOptions,
            selected: selectedLocation,
        });
        bindDropdownEvents(this.$locationDropdown);

        this.$locationDropdown.rebind('change.vpn', () => {
            this.reset();
        });
    }

    async show() {
        this.reset();

        loadingDialog.show('vpn-show-page');
        await this.populateCredsList();
        loadingDialog.hide('vpn-show-page');
    }

    async populateCredsList() {
        let response = await VpnCredsManager.getActiveCredentials();
        response = response === ENOENT ? [] : response; // ENOENT is an expected response; => no creds available
        if (!Array.isArray(response)) {
            console.error('[VPN UI] Unable to fetch active credentials.');
            return;
        }

        $(this.credsContainer).empty();
        const creds = { ...response[0] };
        for (let i = 1; i <= this.knownSlotCount; i++) {
            if (creds[i]) {
                this._addCredElement(i);
                delete creds[i];
            }
            else {
                this._addSlotElement();
            }
        }

        // Render extra creds even if slot count known to webclient is exceeded.
        for (const [credNum] of Object.entries(creds)) {
            this._addCredElement(credNum);
        }

        if (this.recentSlot) {
            const slot = this.credsContainer.children[this.recentSlot - 1];
            if (slot) {
                slot.classList.add('recent');
            }
        }
    }

    async createCred() {
        this.reset();

        loadingDialog.show('vpn-create');
        const cred = await VpnCredsManager.createCredential();
        loadingDialog.hide('vpn-create');

        if (cred === EACCESS) {
            msgDialog(
                `info:!^${l.vpn_eaccess_dialog_upgrade}!${l.vpn_eaccess_dialog_cancel}`,
                '',
                l.vpn_eaccess_dialog_title,
                l.vpn_eaccess_dialog_msg,
                (answer) => {
                    if (answer === false) {
                        eventlog(99857); // "VPN page upgrade acct (via eaccess dlg)"
                        loadSubPage('/pro');
                    }
                });
            return;
        }
        if (cred === ETOOMANY) {
            msgDialog('info', '', l.vpn_etoomany_dialog_title, l.vpn_etoomany_dialog_msg);
            return;
        }

        if (!cred) {
            return; // TODO
        }
        this._onCredCreated();
        this.showStep2(cred);
    }

    async removeCred(credNum) {
        loadingDialog.show('vpn-deactivate');

        msgDialog(
            `warningb:!^${l.vpn_page_delete_credential_confirm}!${l.vpn_page_delete_credential_dialog_cancel}`,
            '', '', l.vpn_page_delete_credential, async(e) => {
                if (!e) {
        await VpnCredsManager.deactivateCredential(credNum);
                }
        loadingDialog.hide('vpn-deactivate');
                this._onCredDeactivated(credNum);
            }
        );
    }

    showStep2(cred) {
        const location = getDropdownValue(this.$locationDropdown);
        const locationIndex = cred.locations.indexOf(location) || 0;
        const config = VpnCredsManager.generateIniConfig(cred, locationIndex);

        this.downloadConfigBtn.dataset.credNum = cred.credNum;
        this.downloadConfigBtn.href = URL.createObjectURL(new Blob([config], { type: 'text/plain' }));
        this.downloadConfigBtn.download = `vpn-${cred.credNum}.conf`;

        this.recentSlot = cred.credNum; // Once list is populated, highlight this slot

        $('.config-qr .qr-img', this.page).qrcode({
            width: 230,
            height: 230,
            correctLevel: QRErrorCorrectLevel.H,
            text: config,
        });

        this.configText.textContent = config;

        this.postCreateSection.classList.remove('hidden');
    }

    reset() {
        this.postCreateSection.classList.add('hidden');
        this.recentSlot = undefined;
        $('.cred-slot.recent', this.credsContainer).removeClass('recent');
        $(this.configQr).empty();
        this.downloadConfigBtn.removeAttribute('href');
        this.downloadConfigBtn.removeAttribute('download');
        delete this.downloadConfigBtn.dataset.credNum;
        this.configDiv.classList.add('hidden');
        this.configText.textContent = '';
    }

    _addSlotElement() {
        const slotClone = this.credTpl.content.cloneNode(true);
        const slotElement = slotClone.querySelector('.cred-slot');

        this.credsContainer.appendChild(slotElement);
    }

    _addCredElement(credNum) {
        const credClone = this.credTpl.content.cloneNode(true);
        const credElement = credClone.querySelector('.cred-slot');
        credElement.classList.add('active');
        credElement.dataset.num = credNum;
        credElement.querySelector('.label').textContent = l.vpn_page_manage_cred_title.replace('%s', credNum);
        const removeBtn = credElement.querySelector('.js-remove');
        removeBtn.addEventListener('click', () => {
            this.removeCred(credNum);
        });

        this.credsContainer.appendChild(credElement);
    }

    _removeCredElement(credNum) {
        const credElement = this.credsContainer.querySelector(`[data-num="${credNum}"]`);
        if (credElement) {
            if (credNum > this.knownSlotCount) {
                credElement.remove();
            }
            else {
                credElement.classList.remove('active');
                delete credElement.dataset.num;
                credElement.querySelector('.label').textContent = l.vpn_page_slot_available;
            }
        }
    }

    _onCredCreated() {
        this.populateCredsList();
    }

    _onCredDeactivated(credNum) {
        this._removeCredElement(credNum);

        if (parseInt(this.downloadConfigBtn.dataset.credNum) === credNum) {
            this.reset();
        }
    }
}
