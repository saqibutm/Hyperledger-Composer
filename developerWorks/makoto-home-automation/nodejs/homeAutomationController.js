//
// The Home Automation Controller
//
var client = require('ibmiotf')
var exec = require('child_process').exec

// Logger setup
var winston = require('winston')
// Setup the logger with the specified log level
// For more on Winston log levels, see https://github.com/winstonjs/winston#logging
setupWinstonLogger('debug');
//setupWinstonLogger('info');

// The configuration
var appConfig = require("./config/myAppConfig.json")
var deviceConfig = require("./config/myDeviceConfig.json")

// JSON defintions for working with devices
var discoveryJson = require("./config/discoveryMessage.json")

/**
 * Setup the Winston logger, pass it the log level. For example,
 * 'info', 'debug' and so on. See https://github.com/winstonjs/winston for
 * more info.
 */
function setupWinstonLogger(logLevel) {
    winston.add(winston.transports.File, { filename : "./winston.log"});
    winston.remove(winston.transports.Console);
    winston.add(winston.transports.Console, { timestamp : "true"});
    // Set log level
    winston.level = logLevel;
}

// Create the Application Client
var applicationClient = new client.IotfApplication(appConfig);
winston.info("Connecting application client...");
applicationClient.connect();

/**
 * When a connect message is received, we're good to go
 */
applicationClient.on("connect", function() {
    winston.info("Application client, connected.");
    applicationClient.subscribeToDeviceEvents(appConfig.deviceType);
});

/**
 * When an error is received, process it
 */
applicationClient.on("error", function(err) {
    winston.error("Application Client Error: " + err);
});

/**
 * When a device event is received, process it
 */
applicationClient.on("deviceEvent", function (deviceType, deviceId, eventType, format, payload) {

    winston.info("Device Event from :: " + deviceType + " : " + deviceId + " of event " + eventType + " with payload : " + payload);
    // Is the event a discovery request?
    if (isDiscoveryRequest(deviceType, deviceId, payload)) {
        // Send a discovery message in response to the request for one
        handleDiscoveryMessage();
    } else if (isDeviceRequest(payload)) {
        // Handle the device request
        handleDeviceRequest(payload);
    }
});

// Create the Device Client
var deviceClient = new client.IotfDevice(deviceConfig);
winston.info("Connecting device client...");
deviceClient.connect();

/**
 * When a connect message is received, we're good to go
 */
deviceClient.on("connect", function() {
    winston.info("Device client, connected.");
});

/**
 * When an error is received, process it
 */
deviceClient.on("error", function(err) {
    winston.info("Device Client Error: " + err);
});

/**
 * Investigates the specified deviceType, deviceId, and payload
 * to determine whether or not the payload contains a discovery
 * message.
 * 
 * Return true if so, false otherwise.
 */
function isDiscoveryRequest(deviceType, deviceId, payload) {
    // Sanity check, we may have already checked this, but code gets churned, ya know?
    if (deviceType == appConfig.deviceType && deviceId == appConfig.deviceId) {
        var payloadJson = JSON.parse(payload);
        // Make sure the deviceRequest.deviceId is correct
        if ('d' in payloadJson && 
            'deviceRequest' in payloadJson.d && 
            payloadJson.d.deviceRequest.deviceId == appConfig.deviceId) {
            // Make sure the action is correct
            if (payloadJson.d.deviceRequest.action == "discovery") {
                return true;
            }
        }
    }
    return false;
}

/**
 * Investiates the specified deviceType, deviceId, and payload
 * to determine whether or not the payload contains a device event
 * that is understood by the home automation controller
 */
function isDeviceRequest(payload) {
    var deviceId = extractDeviceIdFromPayload(payload);
    if (deviceId != null) {
        winston.debug("Found deviceId: " + deviceId + " in JSON payload");
        return true;
    }
    return false;
}

/**
 * Send a discovery message
 */
function handleDiscoveryMessage() {
    winston.debug("Sending discovery message...");
    // Publish the response event with the discoveryJson message
    publishEvent("response", discoveryJson);
}

/**
 * Handle the device event contained in the specified payload.
 * Get the metadata for the device first, then get the metadata
 * for the action, and use that to send the action (command) to
 * the device.
 */
function handleDeviceRequest(payload) {
    // Grab the action
    var deviceId = extractDeviceIdFromPayload(payload);
    if (deviceId != null) {
        var action = extractActionFromPayload(payload);
        if (action != null) {
            var actionMetadata = findActionMetadata(deviceId, action, discoveryJson);
            if (actionMetadata != null) {
                // Apply the requested action to the IoT device
                applyIotDeviceAction(actionMetadata);
            } else {
                winston.error("Expected action metadata, but none was found.");
            }
        } else {
            winston.error("Expected an action in the payload for device ID '" + deviceId + "', but none was found!");
        }
    } else {
        winston.error("Expected a device ID in the payload, but none was found!");
    }
}

/**
 * Extracts the deviceId property from the specified payload and
 * returns its value.
 * 
 * @param The payload JSON string from the incoming message
 * 
 * @returns The deviceId property value from the payload
 */
function extractDeviceIdFromPayload(payload) {
    var payloadJson = JSON.parse(payload);
    winston.debug("Payload JSON: " + JSON.stringify(payloadJson));

    // Undefined error? No way, man.
    if ('d' in payloadJson && 'deviceRequest' in payloadJson.d && 
        'deviceId' in payloadJson.d.deviceRequest) {
        return payloadJson.d.deviceRequest.deviceId;
    }
    // Could not find it, return null
    winston.error("Could not locate a device ID in the payload: " + payload);
    return null;
}

/**
 * Extracts the action property from the specified payload and
 * returns its value.
 * 
 * @param The payload JSON string from the incoming message
 * 
 * @returns The deviceId property value from the payload
 */
function extractActionFromPayload(payload) {
    var payloadJson = JSON.parse(payload);
    winston.debug("Payload JSON: " + JSON.stringify(payloadJson));

    // Undefined error? No way, man.
    if ('d' in payloadJson && 'deviceRequest' in payloadJson.d && 
        'action' in payloadJson.d.deviceRequest) {
        return payloadJson.d.deviceRequest.action;
    }
    // Could not find it, return null
    winston.error("Could not locate an action in the payload: " + payload);
    return null;
}

/**
 * Loop through all of the device metadata. When a match on the
 * deviceId is found, search the actions for that deviceId for the 
 * specified action. If the action is found, return its metadata
 * block, which contains the information about its 433MHz encoding
 * and so forth.
 * 
 * @param deviceId - the deviceId to locate in the metadataJson
 * 
 * @param action - the action within the deviceId to locate
 * 
 * @param metadataJson - the metadata to search, should contain both
 * the deviceId we're looking for, and within that device metadata
 * the action as well.
 * 
 * @returns The action metadata that corresponds to the specified action,
 * or null if no match was found.
 */
function findActionMetadata(deviceId, action, metadataJson) {
    winston.debug("Looking for device ID: " + deviceId + " and action '" + action + "'...");
    // Check all of the device requests we know about
    // Sanity check
    winston.debug("Looking through this JSON: " + JSON.stringify(metadataJson));
    // Sanity check. We may have already checked this, but code gets churned, ya know?
    if ('d' in metadataJson && 'devices' in metadataJson.d) {
        var devicesMetadata = metadataJson.d.devices;
        winston.debug("There are " + devicesMetadata.length + " devices to scan through...");
        // Loop through all of the device metadata. When a match on the
        /// deviceId is found, search the actions for that deviceId for the
        /// specified action.
        for (var aa = 0; aa < devicesMetadata.length; aa++) {
            var deviceMetadata = devicesMetadata[aa];
            winston.debug("Looking at device '" + JSON.stringify(deviceMetadata));
            // Found a match?
            if (deviceId == deviceMetadata.deviceId) {
                // If we got here, then we did not find a match on action. Bummer.
                actionMetadata = findActionMetadataWithinDeviceMetadata(action, deviceMetadata);
                if (actionMetadata != null) {
                    return actionMetadata;
                }
            }
            winston.error("Found a match for device ID '" + deviceId + "' but could not find any metadata for action '" + action);
        }
    } else {
        winston.warn("Device JSON did not have the expected structure: " + JSON.stringify(metadataJson));
    }
    return null;
}

/**
 * Find the metadata for the specified action within the block of
 * metadata for the deviceId it belongs to.
 * 
 * @param action - the action to search for
 * 
 * @param deviceMetadata - the metadata block within which to search
 * the actions array, looking for the specified action.
 * 
 * @returns The action metadata block within the actions array, within
 * the specified device metadata, or null if the action could not be
 * located.
 */
function findActionMetadataWithinDeviceMetadata(action, deviceMetadata) {
    // Yes, we have a match on deviceId
    winston.debug("Found matching deviceId: '" + deviceMetadata.deviceId + "' in JSON metadata");
    // Now check for the action for that device ID
    var actionsMetadata = deviceMetadata.actions;
    for (var aa = 0; aa < actionsMetadata.length; aa++) {
        var actionMetadata = actionsMetadata[aa];
        winston.debug("Looking at action '" + JSON.stringify(actionMetadata));
        // Have a match on action?
        if (action == actionMetadata.action) {
            // Yes, we have a match on action
            winston.debug("Found matching action: '" + actionMetadata.action + "' in JSON metadata");
            // Return the action metadata
            return actionMetadata;
        }
    }
    return null;
}

/**
 * THIS ONE IS FOR ALL THE MARBLES!
 * TODO: Need a better description than that.
 */
function applyIotDeviceAction(actionMetadata) {
    // Execute the codesend program and pass it the arguments it needs
    var encoding = actionMetadata.encoding;
    var delay = actionMetadata.delay;

    // Build the transmit command that sends the signal to the
    /// 433MHz IoT device
    var transmitCommand = appConfig.transmitterProgram + " " + encoding + " " + delay;
    winston.debug("Sending command to device: " + transmitCommand);
    // Now execute the transmit command
    exec(transmitCommand, function (error, stdout, stderr) {
        winston.info("stdout: " + stdout);
        winston.info('stderr: ' + stderr);
        if (error) {
            winston.error("Error while invoking command '" + transmitCommand + ": " + error.message.toString());
        }
    });

}

/**
 * Publish the specified JSON message under the specified eventName
 */
function publishEvent(eventName, jsonMessageToPublish) {
    // Use the Device Client to publish the JSON event
    deviceClient.publish(eventName, "json", jsonMessageToPublish);
}
