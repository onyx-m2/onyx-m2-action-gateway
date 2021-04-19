# Onyx M2 Action Gateway

This project is a web server that proxies actions performed by the Onyx M2
applications on the car and garage.

```diff
! IMPORTANT: This cannot be installed on any of the cloud providers, as Tesla has
! blocked all IP ranges used by these operators. It does very well on a Raspberry
! Pi running at home though.
```

## Disclaimer

This server connects the Internet to your garage and car, and allows real world actions
to be performed on both. The represents a physical security risk, which you take full
responsibility for. Make sure you secure your server!

```diff
! USE AT YOUR OWN RISK
```

## Table of Contents
#### [Installation](#Installation)
#### [Deployment (Home Raspberry Pi)](#Deployment)
#### [API](#API)

# Installation

This is currently a pretty straight forward Fastify server, and requires Node v12+. To
install from Github:

```
cd ~
git clone https://github.com/onyx-m2/onyx-m2-action-gateway.git
cd onyx-m2-action-gateway
npm install
```

Next, setup your environment in a `.env` file, or in environment variables. The
`AUTHORIZATION` key is a shared secret that allows clients to perform actions. Do
not make this something easy to guess, because someone guessing this will have
access to your garage and car.

Enter your Tesla account credentials and the vehicle you want to use. If you have a
MyQ controllable garage (most Liftmaster and Chamberlain garage door openers), configure
the values starting with MYQ below.

If you are unsure what MyQ device and/or Tesla vehicles you have, run the gateway
without configuring these values and your account will be scanned on startup and
all identifiers your have on record will be logged.

```
# .env
PORT=3000
AUTHORIZATION=<shared_secret>
MYQ_USERNAME=<myQ_account_email>
MYQ_PASSWORD=<myQ_account_password>
MYQ_DEVICE=<myQ_device>
TESLA_USERNAME=<tesla_account_email>
TESLA_PASSWORD=<tesla_account_password>
TESLA_VEHICLE_ID=<tesla_car_s_id>
```

You should then be able to run in development mode with
```
npm run dev
```
or in production mode with
```
npm start
```

# Deployment

As mentioned above, this gateway will not work on a cloud provider, and must be deployed
in home to ensure the Tesla commands work. I suggest running this a Raspberry Pi. I
use an old v1 RPi I had lying around, and it works just fine.

Here is a rundown of the installation procedure on a fresh Raspberry Pi OS. I'm
assuming you have a base system with networking setup already.

## Git and Node (v14)

Installing git is simple enough:
```
sudo apt install git
```
Installing Node can be a little tricky, especially if your Pi is running an `ARMv6`
processor (Pi v1 and Pi Zero/W). You can run `uname -m` on the Pi to check.

For `ARMv7` and later processors, you'll be able to install using [NodeSource](https://github.com/nodesource/distributions) with a couple of simple commands:
```
curl -fsSL https://deb.nodesource.com/setup_14.x | sudo -E bash -
sudo apt install -y nodejs
```

For `ARMv6`, the procedure is a little more complicated, as NodeSource doesn't support
it anymore. There are however unofficial binaries that are maintained by the Nodejs team
at [unofficial-builds.nodejs.org](https://unofficial-builds.nodejs.org).

To install the latest v14 binary at the time of this writing:
```
cd ~
wget https://unofficial-builds.nodejs.org/download/release/v14.16.1/node-v14.16.1-linux-armv6l.tar.gz
tar -xf node-v14.16.1-linux-armv6l.tar.gz
cd node-v14.16.1-linux-armv6l
sudo cp -R * /usr/local/
```

At this point, you should be able to check that Node v14 was installed properly by typing
`node -v`.

## Dynamic DNS (Dynu)

In order to access your Pi from the road, you'll have to setup a dynamic DNS that points
to your home IP address. (And you'll have to enable port forwarding for ports `80` and `443`
in your router.)

There are many DDNS providers, but beware, not all will work with SSL correctly. In
particular, built in router DDNS often don't work (mine didn't). I ended up choosing
Dynu because it works, is simple to setup, and free forever.

First, create a free account on [dynu.com](https://www.dynu.com). Then, go to
https://www.dynu.com/en-US/ControlPanel/DDNS and create an entry for your server.

Next, head over to your Pi (using SSH), and install a cronjob to keep Dynu updated
with your current IP address.

```
cd ~
mkdir dynudns
cd dynudns
vi dynu.sh
```

Paste in (changing `USERNAME` and `PASSWORD`)

```
echo url="https://api.dynu.com/nic/update?username=USERNAME&password=PASSWORD" | curl -k -o ~/dynudns/dynu.log -K -`

```

Then continue by making the script executable and editing crontab
```
chmod 700 dynu.sh
crontab -e
```
Paste in
```
`*/5 * * * * ~/dynudns/dynu.sh >/dev/null 2>&1`
```

## Process Management (PM2)

You'll want the server to start on boot up, and restart in case of a crash. An easy way
to accomplish this is by using PM2. Install and configure like this:
```
npm install pm2@latest -g
cd ~/onyx-m2-action-gateway
pm2 start npm --name onyx-m2-action-gateway -- start
pm2 startup
pm2 save
```

PM2 also offers remote monitoring, if that's useful. See [pm2.io](https://pm2.io) for
details.

## Reverse Proxy (NGINX)

You may eventually want to run more than one server on your Pi, and to accomplish this,
you'll need a reverse proxy. This is also useful for using `certbot` to maintain SSL
certificates that are necessary to access the gateway from secure web sites.

Start by installing NGINX by typing
```
sudo apt install nginx
```

Next, create a `/etc/nginx/sites-enabled/<your_server_name>.conf` file and paste in
(changing the server name appropriately):
```
server {
  server_name <your_server_url>;
  location / {
    proxy_pass_header Authorization;
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_buffering off;
    client_max_body_size 0;
    proxy_read_timeout 36000s;
    proxy_redirect off;
  }
```
Finally, run
```
sudo service nginx restart
```
to apply these changes and check for errors.

## Certbot (SSL)

As mentioned above, you'll want your server to support `https` connection, and for this
you'll need an SSL certificate. Thankfully, the good people at the EFF have a tool that
automates the entire process, including future cert updates.

Here's all you need to get SSL working (and answer the questions the certbot will ask)
```
  sudo apt-get install certbot python-certbot-nginx
  sudo certbot --nginx
```

# API

The gateway offers garage and car control endpoints. All endpoints use the `PUT` method.

## Garage

| Endpoint | Description |
| --- | --- |
| `PUT` /garage/open_door | Opens the garage door |
| `PUT` /garage/close_door | Closes the garage door |

## Car

| Endpoint | Description |
| --- | --- |
| `PUT` /car/vent_windows | Opens all the car's windows a little |
| `PUT` /car/close_windows | Closes all the car's windows |
| `PUT` /car/wake_up | Sends the car the signal to wake up |

Note that the car APIs will return a `408 Timeout` if called while the
car is sleeping.
