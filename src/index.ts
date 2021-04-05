/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.*
 */

import { AddonManagerProxy, Database } from 'gateway-addon';
import { Config } from './config';
import { PrometheusBridge } from './prometheus-bridge';

export = async function (
  addonManager: AddonManagerProxy,
  _: unknown,
  // eslint-disable-next-line no-unused-vars
  errorCallback: (packageName: string, error: string) => void
): Promise<void> {
  const id = 'prometheus-bridge';
  const db = new Database(id, '');
  await db.open();
  const config = <Config>(<unknown>await db.loadConfig());
  await db.close();
  new PrometheusBridge(addonManager, id, config, (error: string) => errorCallback(id, error));
};
