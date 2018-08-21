var discoveries = {
    deviceId : "Controller-1",
    deviceResponse : "discovery",
    devices : [
      {
        deviceId : "Outlet-1",
        description : "433MHz RF Outlet",
        actions : [
          {
            action : "on",
            description : "Turns the outlet on"
  
          },
          {
            action : "off",
            description : "Turns the outlet off"
          }
        ]
      },
      {
        deviceId : "Outlet-2",
        description : "433MHz RF Outlet",
        actions : [
          {
            action : "on",
            description : "Turns the outlet on"
  
          },
          {
            action : "off",
            description : "Turns the outlet off"
          }
        ]
      },
      {
        deviceId : "Alarm-1",
        description : "433MHz Home Alarm System",
        actions : [
          {
            action : "arm-away",
            description : "Arms the system in away mode (motion sensors active)"
          },
          {
            action : "arm-stay",
            description : "Arms the system in stay mode (motion sensors inactive)"
          },
          {
            action : "off",
            description : "Disarms the system"
          },
          {
            action : "panic",
            description : "Triggers the alarm siren (SOS)"
          }
        ]
      }
    ]
  };
  msg.payload = discoveries;
  return msg;