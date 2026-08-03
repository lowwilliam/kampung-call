"""WebBridge helper for the heritage-pack verification session."""
import json
import sys
import time
import urllib.request

SESSION = "heritage-pack-verification"
DAEMON = "http://127.0.0.1:10086/command"


def cmd(action, args):
    body = json.dumps({"action": action, "args": args, "session": SESSION}).encode()
    req = urllib.request.Request(DAEMON, data=body,
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as r:
        return json.load(r)


def ev(code):
    return cmd("evaluate", {"code": code})


def front():
    cmd("cdp", {"method": "Page.bringToFront", "params": {}})


def shot(path):
    return cmd("screenshot", {"format": "png", "path": path})


def walk(seconds):
    ev("dispatchEvent(new KeyboardEvent('keydown',{key:'w'}));'go'")
    end = time.time() + seconds
    while time.time() < end:
        front()
        time.sleep(1.0)
    return ev("dispatchEvent(new KeyboardEvent('keyup',{key:'w'}));"
              "JSON.stringify(window.__playerPos())")


if __name__ == "__main__":
    mode = sys.argv[1]
    if mode == "traverse":
        lat, lon, flat, flon, secs, label = (sys.argv[2], sys.argv[3], sys.argv[4],
                                             sys.argv[5], float(sys.argv[6]), sys.argv[7])
        print("start:", ev(f"window.__teleport({lat},{lon},{flat},{flon});"
                           "JSON.stringify(window.__playerPos())"))
        print("end:", walk(secs), label)
    elif mode == "shot":
        print(shot(sys.argv[2]))
    elif mode == "ev":
        print(ev(sys.argv[2]))
    elif mode == "front":
        front()
        print("front-ok")
