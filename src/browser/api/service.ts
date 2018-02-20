/*
Copyright 2017 OpenFin Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { Identity, ServiceIdentity } from '../../shapes';
import route from '../../common/route';
import ofEvents from '../of_events';
import { applyPendingServiceConnections } from '../api_protocol/api_handlers/service_middleware';


const serviceMap: Map<string, ServiceIdentity> = new Map();

export module Service {
    export function addEventListener(targetIdentity: Identity, type: string, listener: Function) {
        // treating like an application so it will work for external connections as well
        const eventString = route.service(type, targetIdentity.uuid);
        const errRegex = /^Attempting to call a function in a renderer frame that has been closed or released/;
        let unsubscribe;
        let browserWinIsDead;

        const safeListener = (...args: any[]) => {
            try {
                listener.call(null, ...args);
            } catch (err) {
                browserWinIsDead = errRegex.test(err.message);

                if (browserWinIsDead) {
                    ofEvents.removeListener(eventString, safeListener);
                }
            }
        };

        ofEvents.on(eventString, safeListener);

        unsubscribe = () => {
            ofEvents.removeListener(eventString, safeListener);
        };
        return unsubscribe;
    }

    export function getServiceByUuid(uuid: string) {
        return serviceMap.get(uuid);
    }

    // Could be any identifier
    export function getServiceByName(name: string): any {
        let serviceIdentity;
        serviceMap.forEach((value, key) => {
            if (value.serviceName === name) {
                serviceIdentity = serviceMap.get(key);
            }
        });
        return serviceIdentity;
    }

    export function registerService (identity: Identity, serviceName?: string) {
        // If a service is already registered from that uuid, nack
        const { uuid, name } = identity;
        if (serviceMap.get(uuid)) {
            return false;
        }

        const serviceIdentity = { uuid, name, serviceName };
        serviceMap.set(uuid, serviceIdentity);

        // When service exits, remove from serviceMap
        // Currently assumes this is an application, add logic for external connection here when that becomes option
        ofEvents.once(route.application('closed', uuid), () => {
            serviceMap.delete(uuid);
            ofEvents.emit(route.application('service-disconnected', uuid), {
                uuid,
                name
            });
        });

        ofEvents.emit(route.system('service-connected'), serviceIdentity);

        // execute requests to connect for service that occured before service registration. Timeout ensures registration concludes first.
        setTimeout(() => {
            applyPendingServiceConnections(uuid);
        }, 1);

        return { serviceIdentity };
    }
}
