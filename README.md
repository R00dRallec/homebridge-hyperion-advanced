# homebridge-hyperion-advanced
Homebridge plugin to turn hyperion ng instance on/off, change brightness and switch between ambilight and an effect.

## Install

```
sudo npm install -g homebridge-hyperion-advanced
```

## Configuration

Example configuration:
```json
{
    "accessory": "HyperionControl",
    "name": "TV Backlight",
    "url": "http://192.168.0.123",
    "port": 8090,
    "token": "abc123abc-abcd-abcd-abcd-abcd1234abcd",
    "effect": "Candle"
}
```

- `accessory` **required**: must always be "HyperionControl"
- `name` optional: displayname of your device (default: Hyperion)
- `url` **required**: IP/URL of your hyperion ng instance
- `port` optional: port of your hyperion ng webserver (default: 8090)
- `token` optional: authorization token (see hyperion ng network configuration)
- `effect` optional: The default effect (default: Candle)
