/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.*
 */

import { Adapter, AddonManagerProxy } from 'gateway-addon';
import { WebThingsClient, Property } from 'webthings-client';
import { Config } from './config';
import { createServer } from 'http';
import { Any } from 'gateway-addon/lib/schema';

function sanitizeNames(s: string) {
  return s
    .split('')
    .map((x) => x.replace(/[^a-zA-Z0-9:_]/, '_'))
    .join('');
}

interface DeviceEntry {
  title: string;
  lastUpdate: Date;
  properties: Record<string, PropertyEntry>;
}

interface PropertyEntry {
  lastUpdate: Date;
  type?: string;
  value: unknown;
}

export class PrometheusBridge extends Adapter {
  private entries: Record<string, DeviceEntry> = {};

  private connectedDevices: string[] = [];

  constructor(
    // eslint-disable-next-line no-unused-vars
    addonManager: AddonManagerProxy,
    id: string,
    private config: Config,
    // eslint-disable-next-line no-unused-vars
    private errorCallback: (error: string) => void
  ) {
    super(addonManager, PrometheusBridge.name, id);
    addonManager.addAdapter(this);
    this.init();
  }

  private async init() {
    try {
      await this.connectToPrometheus();
    } catch (e) {
      this.errorCallback(`${e}`);
    }
  }

  private async connectToPrometheus() {
    const { port, lastUpdateMetric, debug, customLabels } = this.config;

    await this.connectToGateway();

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

      const customLabelsObject: Record<string, unknown> = {};

      for (const customLabel of customLabels ?? []) {
        let key = customLabel.key;
        let value = customLabel.value;

        if (typeof key == 'string' && typeof value === 'string') {
          key = key.trim();
          value = value.trim();

          if (key.length > 0 && value.length > 0) {
            customLabelsObject[key] = value;
          }
        }
      }

      for (const [deviceId, { title, lastUpdate, properties }] of Object.entries(this.entries)) {
        const labels = { ...customLabelsObject, deviceId, deviceTitle: title };

        if (lastUpdateMetric) {
          const diff = (new Date().getTime() - lastUpdate.getTime()) / 1000;
          // eslint-disable-next-line max-len
          response += '# HELP last_device_update Time since the last update of the device\n';
          response += '# TYPE last_device_update gauge\n';
          response += `${this.prometheusFormat('last_device_update', diff, labels)}\n`;
        }

        for (const [property, { value, type, lastUpdate }] of Object.entries(properties)) {
          const additionalLabels: Record<string, string> = {};

          if (typeof type === 'string') {
            additionalLabels.type = type;
          }

          // eslint-disable-next-line max-len
          response += `# HELP ${property} ${property} property of the device ${title} (${deviceId})\n`;
          response += `# TYPE ${property} gauge\n`;
          response += `${this.prometheusFormat(property, value, {
            ...labels,
            ...additionalLabels,
          })}\n`;

          if (lastUpdateMetric) {
            const diff = (new Date().getTime() - lastUpdate.getTime()) / 1000;
            response += '# HELP last_property_update Time since the last update of the property\n';
            response += '# TYPE last_property_update gauge\n';
            response += `${this.prometheusFormat('last_property_update', diff, {
              ...labels,
              property,
            })}\n`;
          }
        }
      }

      res.writeHead(200);
      res.end(response);
    });

    server.listen(port, () => {
      console.debug(`Http server ist listening on port ${port}`);
    });
  }

  private prometheusFormat(
    name: string,
    value: unknown,
    labels: Record<string, unknown> = {}
  ): string {
    const pairs = Object.entries(labels)
      .map(([key, value]) => `${sanitizeNames(key)}="${value}"`)
      .join(', ');

    return `${name}{${pairs}} ${value}`;
  }

  private async connectToGateway() {
    console.debug('Connecting to gateway');

    const { accessToken, deviceSearchInterval, debug } = this.config;

    const webThingsClient = await WebThingsClient.local(accessToken);
    const devices = await webThingsClient.getDevices();

    for (const device of devices) {
      try {
        const deviceId = device.id();

        if (this.connectedDevices.indexOf(deviceId) === -1) {
          device.on('propertyChanged', async (property: Property, value: Any) => {
            const key = property.name;

            if (debug) {
              console.debug(`Received ${deviceId}/${key} => ${value}`);
            }

            if (typeof value === 'boolean') {
              value = value ? 1 : 0;
            }

            if (typeof value === 'number') {
              const { title } = device.description;
              const deviceEntry = this.entries[deviceId] ?? {
                title,
                properties: {},
              };

              deviceEntry.lastUpdate = new Date();

              deviceEntry.properties[sanitizeNames(key)] = {
                value,
                type: property.description['@type'] as unknown as string,
                lastUpdate: new Date(),
              };

              this.entries[deviceId] = deviceEntry;
            } else if (debug) {
              // eslint-disable-next-line max-len
              console.debug(`Ignoring ${deviceId}/${key} because the type is ${typeof value}`);
            }
          });

          console.debug(`Connecting to ${deviceId}`);
          await device.connect();
          this.connectedDevices.push(deviceId);
        }
      } catch (e) {
        console.log(`Could not connect to ${device}: ${e}`);
      }
    }

    setTimeout(() => {
      try {
        this.connectToGateway();
      } catch (e) {
        console.log(`Could not connect to gateway: ${e}`);
      }
    }, (deviceSearchInterval ?? 10) * 1000);
  }
}
