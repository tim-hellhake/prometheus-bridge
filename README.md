# Prometheus bridge

[![Build Status](https://github.com/tim-hellhake/prometheus-bridge/workflows/Build/badge.svg)](https://github.com/tim-hellhake/prometheus-bridge/actions?query=workflow%3ABuild)
[![dependencies](https://david-dm.org/tim-hellhake/prometheus-bridge.svg)](https://david-dm.org/tim-hellhake/prometheus-bridge)
[![devDependencies](https://david-dm.org/tim-hellhake/prometheus-bridge/dev-status.svg)](https://david-dm.org/tim-hellhake/prometheus-bridge?type=dev)
[![optionalDependencies](https://david-dm.org/tim-hellhake/prometheus-bridge/optional-status.svg)](https://david-dm.org/tim-hellhake/prometheus-bridge?type=optional)
[![license](https://img.shields.io/badge/license-MPL--2.0-blue.svg)](LICENSE)

This bridge starts a webserver with a `/metrics` endpoint which can be scraped by a prometheus server.

# How to use
* Go to `settings/developer` and click `Create local authorization`
* Create a new token and copy it
* Go to the settings of the prometheus bridge and insert the copied token
* Add the scrape endpoint of the bridge to your prometheus config
