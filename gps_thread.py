#!/usr/bin/env python3
import os
import time
import select
from collections import deque

GNSS_DEVICE = "/dev/gnss0"
OUTPUT_FILE = "/tmp/delme.gnss"
BUFFER_SIZE = 4096      # how many bytes to keep
IDLE_TIMEOUT = 1.0      # seconds of no data before saving

def main():
    buf = deque(maxlen=BUFFER_SIZE)
    fd = os.open(GNSS_DEVICE, os.O_RDONLY | os.O_NONBLOCK)

    if True:
        last_data_time = time.time()
        while True:
            r, _, _ = select.select([fd], [], [], 0.1)
            if r:
                data = os.read(fd, 256)
                if data:
                    buf.extend(data)
                    last_data_time = time.time()
                    continue
            if len(buf):
                with open(OUTPUT_FILE, "wb") as f:
                    f.write(bytes(buf))
                print(f"Wrote {len(buf)} bytes to {OUTPUT_FILE}")
                buf.clear()
                last_data_time = time.time()

if __name__ == "__main__":
    main()
