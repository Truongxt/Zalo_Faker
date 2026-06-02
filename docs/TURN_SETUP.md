# TURN setup for WebRTC calls

If two users are on different networks, WebRTC often cannot send audio/video with STUN only. The app must have a reachable TURN server.

Current app env points to:

```env
VITE_TURN_URL=turn:taklo.duckdns.org:3478
EXPO_PUBLIC_TURN_URL=turn:taklo.duckdns.org:3478
```

From outside, `taklo.duckdns.org:3478` must answer on both TCP and UDP. The media relay port range must also be open.

## Quick check

Run this from a machine outside the server:

```bash
node scripts/check-turn.js taklo.duckdns.org 3478
```

Both lines should be OK:

```text
TCP 3478: OK
UDP 3478: OK
```

If either line fails, mobile-to-web calls across different networks can connect signaling but will not receive audio/video.

## Install coturn on Ubuntu

```bash
sudo apt update
sudo apt install -y coturn
```

Edit `/etc/turnserver.conf`:

```conf
listening-port=3478
listening-ip=0.0.0.0
relay-ip=0.0.0.0

# If the server is behind cloud NAT, use:
# external-ip=PUBLIC_IP/PRIVATE_IP
# Example for this deployment:
# external-ip=13.212.107.150/172.31.x.x
external-ip=13.212.107.150

realm=taklo.duckdns.org
server-name=taklo.duckdns.org
lt-cred-mech
user=webrtc:CHANGE_THIS_PASSWORD
fingerprint

min-port=49160
max-port=49200
no-multicast-peers
no-loopback-peers
```

Enable and start:

```bash
sudo sed -i 's/^#\\?TURNSERVER_ENABLED=.*/TURNSERVER_ENABLED=1/' /etc/default/coturn
sudo systemctl enable --now coturn
sudo systemctl status coturn --no-pager
```

## Firewall / security group

Open these inbound rules to the TURN server:

```text
TCP 3478
UDP 3478
UDP 49160-49200
```

If using TLS TURN later, also open:

```text
TCP 5349
```

For AWS EC2, add these rules in the EC2 security group. If `ufw` is enabled on the VM:

```bash
sudo ufw allow 3478/tcp
sudo ufw allow 3478/udp
sudo ufw allow 49160:49200/udp
sudo ufw reload
```

## Verify in the app

After TURN is reachable, temporarily set:

```env
VITE_ICE_TRANSPORT_POLICY=relay
EXPO_PUBLIC_ICE_TRANSPORT_POLICY=relay
```

Then rebuild/redeploy:

```bash
cd apps/web
npm run build
```

For mobile, Expo public env values are embedded at build time, so rebuild the APK/development build after changing `.env`:

```bash
cd apps/mobile
npx expo run:android
```

If calls work with `relay`, TURN is working. Change both policies back to `all` for normal use.
