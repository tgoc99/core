import { app } from 'electron';
import { writeToLog } from '../browser/log';
import * as path from 'path';
import ofEvents from '../browser/of_events';
import route from './route';
import { Identity } from '../browser/api_protocol/transport_strategy/api_transport_base';
import { rejects } from 'assert';


export function createTray(identity: Identity): Promise<void> {
    return new Promise((resolve) => {

        // prevent issue with circular dependencies.
        const { Application } = require('../browser/api/application');
        const { deleteApp } = require('../browser/core_state');
        const { uuid } = identity;
        const trayUuid = `tray-${identity.uuid}`;

        try {
            const options = {
                url: `file:///${path.resolve(`${__dirname}/../../assets/tray.html`)}`,
                uuid: trayUuid,
                name: trayUuid,
                mainWindowOptions: {
                    icon: `file:///${path.resolve(`${__dirname}/../../assets/error-icon.png`)}`,
                    defaultHeight: 163, // size increased later to fully fit error message
                    defaultWidth: 180,
                    frame: false,
                    saveWindowState: false,
                    showTaskbarIcon: false,
                    autoShow: false, // shown later after resizing is done
                    alwaysOnTop: true,
                    resizable: false,
                    contextMenu: false,
                    minimizable: false,
                    maximizable: false,
                    nonPersistent: true,
                    customData: {
                        uuid
                    }
                }
            };

            Application.create(options);

            ofEvents.once(route.application('closed', uuid), () => {
                deleteApp(uuid);
            });


            ofEvents.once(route.application('created', uuid), () => {
                resolve();
            });

            Application.run({ uuid: trayUuid });

        } catch (error) {
            writeToLog('info', error);
            rejects(error);
        }
    });
}