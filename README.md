Firestorm
============

Pixelblaze Firestorm is a centralized control console for [Pixelblaze WiFi LED controllers](https://www.bhencke.com/pixelblaze)

This syncronizes pattern timers and allows switching patterns across all Pixelblaze controllers on a network.

Installation
==========

```
yarn
yarn build
yarn server

# or to run on a different port, in case you get access denied for port 80:
PORT=3000 yarn server
```

This installs the dependencies, compiles the react app portion, then serves the whole thing.

Installing on Raspberry Pi
=========

This can take some time, and might not be the most optimal path (if you have something better please let me know, prefferably with a PR)

```
#first get node, yarn, npm going
curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add -
echo "deb https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list

sudo apt-get update
sudo apt-get install nodejs npm yarn authbind

#npm seems to be out of date initially
sudo npm install -g npm

sudo npm install -g pm2

#authbind lets us bind to port 80 as non-root
sudo touch /etc/authbind/byport/80
sudo chown pi /etc/authbind/byport/80
sudo chmod 755 /etc/authbind/byport/80

alias pm2='authbind --deep pm2'

#run pm2 on boot
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u pi --hp /home/pi

#now get Firestorm 
cd ~
git clone https://github.com/simap/Firestorm.git
cd Firestorm

yarn
yarn build

#I believe the pm2 alias with authbind is critical here
#alternatively `authbind --deep pm2 start server.js` might work
pm2 start server.js 
pm2 save

```


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
