/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.*
 */

import {Adapter, AddonManagerProxy} from 'gateway-addon';
import {WebThingsClient} from 'webthings-client';
import {Config} from './config';
import {createServer} from 'http';

function sanitizeNames(s: string) {
  return s
    .split('')
    .map((x) => x.replace(/[^a-zA-Z0-9:_]/, '_'))
    .join('');
}

export class PrometheusBridge extends Adapter {
  private entries: Record<string, Record<string, unknown>> = {};

  constructor(
    // eslint-disable-next-line no-unused-vars
    addonManager: AddonManagerProxy, id: string, private config: Config,
    // eslint-disable-next-line no-unused-vars
    private errorCallback: (error: string) => void) {
    super(addonManager, PrometheusBridge.name, id);
    addonManager.addAdapter(this);
    this.init();
  }

  private async init() {
    try {
      await this.connectToprometheus();
    } catch (e) {
      this.errorCallback(`${e}`);
    }
  }

  private async connectToprometheus() {
    const {
      port,
      debug,
    } = this.config;

    this.connectToGateway();

    const server = createServer((req, res) => {
      if (debug) {
        // eslint-disable-next-line max-len
        console.debug(`Incoming request on ${req.url} from ${req.socket.remoteAddress}`);
      }

      if (req.method !== 'GET') {
        res.writeHead(405);
        res.end();
        return;
      }

      if (req.url !== '/metrics') {
        res.writeHead(404);
        res.end();
        return;
      }

      let response = '';

      for (const [deviceId, properties] of Object.entries(this.entries)) {
        for (const [property, value] of Object.entries(properties)) {
          response += `${property}{deviceId="${deviceId}"} ${value}\n`;
        }
      }

      res.writeHead(200);
      res.end(response);
    });

    server.listen(port, () => {
      console.debug(`Http server ist listening on port ${port}`);
    });
  }

  private async connectToGateway() {
    console.debug('Connecting to gateway');

    const {
      accessToken,
      debug,
    } = this.config;

    const webThingsClient = await WebThingsClient.local(accessToken);

    webThingsClient.on('propertyChanged', async (deviceId, key, value) => {
      if (debug) {
        console.debug(`Received ${deviceId}/${key} => ${value}`);
      }

      if (typeof value === 'boolean') {
        value = value ? 1 : 0;
      }

      if (typeof value === 'number') {
        const device = this.entries[deviceId] ?? {};
        device[sanitizeNames(key)] = value;
        this.entries[deviceId] = device;
      } else if (debug) {
        // eslint-disable-next-line max-len
        console.debug(`Ignoring ${deviceId}/${key} because the type is ${typeof value}`);
      }
    });

    await webThingsClient.connect();
  }
}
