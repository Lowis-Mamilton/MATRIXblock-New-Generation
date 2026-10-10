"""Append the board's USB serial output (115200 baud) to a file, with timestamps.

Survives the board resetting or being unplugged. Keep it running while
reproducing a problem, then read the end of the file.

usage: python serial_log.py COMPORT OUTFILE
"""
import sys, time, serial, datetime
port, out = sys.argv[1], sys.argv[2]
with open(out, 'a', encoding='utf-8') as f:
    while True:
        try:
            with serial.Serial(port, 115200, timeout=0.5) as s:
                f.write(f"{datetime.datetime.now():%H:%M:%S.%f} [logger] port open\n"); f.flush()
                while True:
                    line = s.readline()
                    if line:
                        f.write(f"{datetime.datetime.now():%H:%M:%S.%f} {line.decode(errors='replace').rstrip()}\n"); f.flush()
        except Exception as e:
            f.write(f"{datetime.datetime.now():%H:%M:%S.%f} [logger] {e!r}\n"); f.flush()
            time.sleep(1)
