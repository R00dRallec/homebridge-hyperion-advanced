var Service, Characteristic;
var packageJson = require('./package.json');
var fetch = require('node-fetch');

var savedLightState = false;
var savedAmbilightState = false;
var savedEffectState = false;
var savedBrightness = 0;

// All hyperion system effects
var effects = {
    0: "Atomic swirl",
    1: "Blue mood blobs",
    2: "Breath",
    3: "Candle",
    4: "Cinema brighten lights",
    5: "Cinema dim lights",
    6: "Cold mood blobs",
    7: "Collision",
    8: "Color traces",
    9: "Double swirl",
    10: "Fire",
    11: "Flags Germany/Sweden",
    12: "Full color mood blobs",
    13: "Green mood blobs",
    14: "Knight rider",
    15: "Led Test",
    16: "Led Test - Sequence",
    17: "Light clock",
    18: "Lights",
    19: "Matrix",
    20: "Notify blue",
    21: "Pac-Man",
    22: "Plasma",
    23: "Police Lights Single",
    24: "Police Lights Solid",
    25: "Rainbow mood",
    26: "Rainbow swirl",
    27: "Rainbow swirl fast",
    28: "Random",
    29: "Red mood blobs",
    30: "Sea waves",
    31: "Snake",
    32: "Sparks",
    33: "Strobe red",
    34: "Strobe white",
    35: "System Shutdown",
    36: "Trails",
    37: "Trails color",
    38: "Warm mood blobs",
    39: "Waves with Color",
    40: "X-Mas"
}

module.exports = function(homebridge)
{
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerAccessory('HyperionControl', HyperionControl);
}

function HyperionControl(log, config)
{
    this.log = log;
    this.name = config.name || "Hyperion";
    this.port = config.port || 8090;
    this.url = config.url + ":" + this.port + "/json-rpc";
    this.token = config.token || 0;
    default_effect = Object.keys(effects).find(key => effects[key] === config.effect) || 3; // Default is Candle

    this.headersData = {
        "Content-Type": "application/json"
    };

    if (this.token != 0)
    {
        this.headersData["Authorization"] = "token " + this.token;
    }

    this.manufacturer = packageJson.author;
    this.serial = this.url;
    this.model = packageJson.name;
    this.firmware = packageJson.version;

    this.services = []
    this.light_service = new Service.Lightbulb(this.name);
    this.ambi_service = new Service.Switch("Ambilight");
    this.effect_service = new Service.Television("Effect");
    this.active_effect = default_effect;
}

HyperionControl.prototype = {

    setupServices: function()
    {
        // General information service
        this.informationService = new Service.AccessoryInformation();
        this.informationService
            .setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
            .setCharacteristic(Characteristic.Model, this.model)
            .setCharacteristic(Characteristic.SerialNumber, this.serial)
            .setCharacteristic(Characteristic.FirmwareRevision, this.firmware);
        this.services.push(this.informationService);

        // Light control services (on/off, brightness)
        this.light_service
            .getCharacteristic(Characteristic.On)
            .on('get', this.getState.bind(this))
            .on('set', this.setState.bind(this));

        this.light_service.addCharacteristic(Characteristic.Brightness)
            .on("get", this.getBrightness.bind(this))
            .on("set", this.setBrightness.bind(this));
        this.services.push(this.light_service);

        // Ambilight services
        this.ambi_service
            .getCharacteristic(Characteristic.On)
            .on('get', this.getAmbiState.bind(this))
            .on('set', this.setAmbiState.bind(this));
        this.ambi_service.setCharacteristic(Characteristic.ConfiguredName, "Ambilight");
        this.ambi_service.updateCharacteristic(Characteristic.ConfiguredName, "Ambilight");
        this.services.push(this.ambi_service);

        // Effect Service
        this.effect_service.setCharacteristic(Characteristic.ConfiguredName, "Effect");
        this.effect_service.updateCharacteristic(Characteristic.ConfiguredName, "Effect");
        this.effect_service.setCharacteristic(Characteristic.ActiveIdentifier, this.active_effect);
        this.effect_service.getCharacteristic(Characteristic.ActiveIdentifier)
            .on('set', this.setEffect.bind(this))
            .on('get', this.getEffect.bind(this));
        this.effect_service.getCharacteristic(Characteristic.Active)
            .on('set', this.setEffectStatus.bind(this))
            .on('get', this.getEffectStatus.bind(this));
        this.services.push(this.effect_service);

        // Effect Input Sources
        for (const [index, effect_name] of Object.entries(effects))
        {
            let effect = new Service.InputSource("effect", `effect_${index}`);
            effect
                .setCharacteristic(Characteristic.Identifier, index)
                .setCharacteristic(Characteristic.Name, effect_name)
                .setCharacteristic(Characteristic.IsConfigured, Characteristic.IsConfigured.CONFIGURED)
                .setCharacteristic(Characteristic.InputSourceType, Characteristic.InputSourceType.OTHER)
                .setCharacteristic(Characteristic.TargetVisibilityState, Characteristic.TargetVisibilityState.SHOWN)
                .setCharacteristic(Characteristic.CurrentVisibilityState, Characteristic.CurrentVisibilityState.SHOWN);

            effect.addOptionalCharacteristic(Characteristic.ConfiguredName);
            effect.setCharacteristic(Characteristic.ConfiguredName, effect_name);

            this.effect_service.addLinkedService(effect);
            this.services.push(effect);
        }
    },

    fetchData: async function(bodyData, callback)
    {
        try
        {
            const fetchData = await fetch(this.url,
                {
                    method: 'POST',
                    headers: this.headersData,
                    body: bodyData,
                }
            );

            const responseData = await fetchData.json();

            if (responseData.success)
            {
                callback(responseData);
            }
            else
            {
                callback("error");
            }
        }
        catch (error)
        {
            this.log(error);
            callback("error");
        }
    },

    setEffect: function(value, callback)
    {
        if (value in effects)
        {
            this.active_effect = value;
            this.fetchData('{"command":"effect","effect":{"name":"' + effects[this.active_effect] + '"}, "priority":1}', function(response) {
                    callback();
                }.bind(this));
        }
        else
        {
            callback();
        }
    },

    getEffect: function(callback)
    {
        callback(null, this.active_effect);
    },

    setEffectStatus: function(value, callback)
    {
        if (value)
        {
            this.setEffect(this.active_effect, callback);
        }
        else
        {
            this.fetchData('{"command":"clearall"}', function(response) {
                callback();
            }.bind(this));
        }
    },

    getEffectStatus: function(callback)
    {
        callback(null, savedEffectState);
        this.fetchData('{"command":"serverinfo"}', function(response) {
            if (response != "error")
            {
                savedEffectState = response.info.activeEffects.length == 1;
                this.effect_service.getCharacteristic(Characteristic.Active).updateValue(savedEffectState);
            }
        }.bind(this));
    },

    getAmbiState: function(callback)
    {
        callback(null, savedAmbilightState);
        this.fetchData('{"command":"serverinfo"}', function(response) {
            if (response != "error")
            {
                savedAmbilightState = response.info.grabbers.video.active.length == 1;
                this.ambi_service.getCharacteristic(Characteristic.On).updateValue(savedAmbilightState);
            }
        }.bind(this));
    },

    setAmbiState: function(value, callback)
    {
        this.fetchData('{"command":"componentstate","componentstate":{"component":"V4L","state":' + value + '}}', function(response) {
            callback();
        }.bind(this));
    },

    getState: function(callback)
    {
        callback(null, savedLightState);
        this.fetchData('{"command":"serverinfo"}', function(response) {
            if (response != "error")
            {
                savedLightState = response.info.components[0].enabled;
                this.light_service.getCharacteristic(Characteristic.On).updateValue(savedLightState);
            }
        }.bind(this));
    },

    setState: function(value, callback)
    {
        this.fetchData('{"command":"componentstate","componentstate":{"component":"ALL","state":' + value + '}}', function(response) {
            callback();
        }.bind(this));
    },

    getBrightness: function(callback)
    {
        callback(null, savedBrightness);
        this.fetchData('{"command":"serverinfo"}', function(response) {
            if (response != "error")
            {
                savedBrightness = response.info.adjustment[0].brightness;
                this.light_service.getCharacteristic(Characteristic.Brightness).updateValue(savedBrightness);

            }
        }.bind(this));
    },

    setBrightness: function(value, callback)
    {
        this.fetchData('{"command":"adjustment","adjustment":{"brightness":' + value + '}}', function(response) {
            callback();
        }.bind(this));
    },

    identify: function(callback)
    {
        callback();
    },

    getServices: function()
    {
        this.setupServices();

        return this.services;
    }
}
