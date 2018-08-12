Firestorm
============

Pixelblaze Firestorm is a centralized control console for [Pixelblaze WiFi LED controllers](https://www.bhencke.com/pixelblaze)

This syncronizes pattern timers and allows switching patterns across all Pixelblaze controllers on a network.

Installation
==========

```
yarn
yarn build
yarn start
```

This installs the dependencies, compiles the react app portion, then serves the whole thing.

Beacon and Time Sync Server
=========
Pixelblaze v2.10 and above send out broadcast UDP packets that are used for discovery, and accept reply packets for time synchronization. The server participates in a time sync algorithm similar to NTP, allowing any number of Pixelblazes to have sychronized animations.


Firestorm UI
=========
The UI will show all unique pattern names on the network, and selecting a name will activate it on all Pixelblazes that have that pattern name.

Firestorm API
=========
The API is pretty simple at this point. 

## /discover

Returns a list of all known Pixelblaze controllers along with their pattern list and current settings.

e.g.

```
[
  {
    "lastSeen": 1534033419191,
    "address": "192.168.1.215",
    "id": 6909667,
    "programList": [
      {
        "id": "8gjB89jqQojktXgc4",
        "name": "sparks"
      },
      ...
    ],
    "ver": "2.10",
    "exp": 0,
    "pixelCount": 100,
    "ledType": 1,
    "dataSpeed": 12000000,
    "colorOrder": "BGR",
    "sequenceTimer": 15,
    "sequencerEnable": false,
    "brightness": 1,
    "name": "Desk 2"
  },
  ...
]
```

## /command

Sets a stickly command state for the given Pixelblaze IDs.
`programName` is a bit special as it will convert to whatever ID has that name on the local Pixelblaze. This makes it easy to create different patterns, then name them similarly in order to create control groups.

Most other settings (e.g. the above) can be changed through this API, for example `brightness` (coming soon to the UI). Pattern upload and management is not supported in this API.

If a Pixelblaze is unavailable or drops off the network temporarily, the settings will be reapplied when it comes back, for up to 5 minutes.

```
{
  "command": {
    "programName": "blink fade"
  },
  "ids": [
    6909667,
    9398311
  ]
}
```